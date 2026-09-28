const fs = require('node:fs');
const path = require('node:path');
const { promisify } = require('node:util');
const execFile = promisify(require('node:child_process').execFile);
const sharp = require('C:/Users/qisaihao/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const root = __dirname;
async function download(url, dest) {
  await execFile('curl.exe', ['-fL', '-sS', '--retry', '2', '--max-time', '45', '-o', dest, url]);
}
async function main() {
  const queries = ['paper texture incategory:CC-Zero', 'paper texture public domain', 'old paper blank', 'book cover texture', 'marbled paper', 'notebook paper blank', 'folder paper vintage', 'fabric texture incategory:CC-Zero'];
  let all = [];
  for (let n = 0; n < queries.length; n++) {
    const dest = path.join(root, 'sources', `search-${n}.json`);
    const params = new URLSearchParams({ action: 'query', format: 'json', generator: 'search', gsrsearch: queries[n], gsrnamespace: '6', gsrlimit: '30', prop: 'imageinfo', iiprop: 'url|extmetadata|size', iiurlwidth: '240' });
    if (!fs.existsSync(dest)) await download(`https://commons.wikimedia.org/w/api.php?${params}`, dest);
    const result = JSON.parse(fs.readFileSync(dest));
    const pages = Object.values(result.query?.pages || {});
    all.push(...pages);
    console.log('search', queries[n], pages.length);
  }
  const unique = [...new Map(all.map(x => [x.pageid, x])).values()].filter(x => /^(CC0|Public domain|No restrictions)$/.test(x.imageinfo?.[0].extmetadata?.LicenseShortName?.value || '') && x.imageinfo[0].width >= 900 && x.imageinfo[0].height >= 900 && /\.(jpe?g|png)$/i.test(x.title));
  fs.writeFileSync(path.join(root, 'candidates.json'), JSON.stringify(unique, null, 2));
  fs.mkdirSync(path.join(root, 'thumbs'), {recursive:true});
  for (let n = 0; n < unique.length; n += 4) await Promise.all(unique.slice(n, n+4).map(async x => {
    const dest = path.join(root, 'thumbs', `${x.pageid}.jpg`);
    if (!fs.existsSync(dest)) try { await download(x.imageinfo[0].thumburl, dest); } catch(e) {console.log('thumb failed', x.pageid);}
  }));
  const tiles=[];
  const valid=[];
  for (const x of unique) {
    try {
      const tile=await sharp(path.join(root, 'thumbs', `${x.pageid}.jpg`)).resize(150,190,{fit:'contain',background:'#eee9e0'}).jpeg().toBuffer();
      const n=valid.length; valid.push(x);
      tiles.push({input:tile,left:(n%7)*160+5,top:Math.floor(n/7)*220+5});
      const label=Buffer.from(`<svg width="155" height="24"><text x="4" y="18" font-family="Arial" font-size="13">${x.pageid}</text></svg>`);
      tiles.push({input:label,left:(n%7)*160,top:Math.floor(n/7)*220+195});
    } catch(e) {}
  }
  await sharp({create:{width:1120,height:Math.ceil(valid.length/7)*220,channels:3,background:'#eee9e0'}}).composite(tiles).jpeg({quality:85}).toFile(path.join(root,'candidates.jpg'));
  console.log('candidates',valid.length);
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
