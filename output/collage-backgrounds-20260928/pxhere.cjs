const fs=require('node:fs'), path=require('node:path');
const {promisify}=require('node:util');
const execFile=promisify(require('node:child_process').execFile);
const sharp=require('C:/Users/qisaihao/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const root=__dirname;
async function get(url,dest){if(!fs.existsSync(dest))await execFile('curl.exe',['-fLsS','--max-time','40','--retry','1','-o',dest,url]);}
async function main(){
 const ids=process.argv.slice(2).map(Number);
 const items=[];
 fs.mkdirSync(path.join(root,'originals'),{recursive:true});
 for(let n=0;n<ids.length;n+=4) await Promise.all(ids.slice(n,n+4).map(async id=>{
  try{
   const page=path.join(root,'sources',`pxhere-${id}.html`);await get(`https://pxhere.com/en/photo/${id}`,page);
   const html=fs.readFileSync(page,'utf8');
   if(!html.includes('CC0 Public Domain'))throw Error('CC0 label missing');
   const url=html.match(/https:\/\/get\.pxhere\.com\/photo\/[^"<>\s]+\.jpg/)?.[0] || html.match(/<meta property="og:image" content="([^"]+)"/)?.[1];
   if(!url)throw Error('No image URL');
   const original=path.join(root,'originals',`pxhere-${id}.jpg`);await get(url,original);
   const info=await sharp(original).metadata();
   items.push({id,source:`https://pxhere.com/en/photo/${id}`,url,width:info.width,height:info.height,license:'CC0',file:`originals/pxhere-${id}.jpg`});
   console.log(id, info.width, info.height);
  }catch(e){console.log('failed',id,e.message.slice(0,100));}
 }));
 let prior=[];try{prior=JSON.parse(fs.readFileSync(path.join(root,'pxhere.json')));}catch{}
 const all=[...new Map([...prior,...items].map(x=>[x.id,x])).values()];
 fs.writeFileSync(path.join(root,'pxhere.json'),JSON.stringify(all,null,2));
 const tiles=[];
 for(let n=0;n<all.length;n++){
  const x=all[n],left=n%6*180,top=Math.floor(n/6)*255;
  tiles.push({input:await sharp(path.join(root,x.file)).resize(170,225,{fit:'contain',background:'#eee9e0'}).jpeg().toBuffer(),left,top});
  tiles.push({input:Buffer.from(`<svg width="175" height="24"><text x="4" y="18" font-family="Arial" font-size="14">${x.id}</text></svg>`),left,top:top+225});
 }
 await sharp({create:{width:1080,height:Math.ceil(all.length/6)*255,channels:3,background:'#eee9e0'}}).composite(tiles).jpeg({quality:90}).toFile(path.join(root,'pxhere-preview.jpg'));
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
