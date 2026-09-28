const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const sharp = require('C:/Users/qisaihao/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const root = __dirname;
// Position can be adjusted per image after inspecting the overview.
const selected = [
  [650847,'旧信纸','旧纸与档案'], [650326,'折痕牛皮纸','旧纸与档案'],
  [650850,'砂金旧纸','旧纸与档案'], [650841,'蜂蜜色书页','旧纸与档案'],
  [650837,'酒红绒纸','素色肌理'], [650329,'砖红纸面','素色肌理'],
  [650845,'奶油信纸','素色肌理'], [978331,'纤维和纸','素色肌理'],
  [1258433,'金黄揉纸','褶皱与拼接'], [1581409,'胶带纸箱','褶皱与拼接'],
  [1025915,'焦边旧纸','旧纸与档案'], [813098,'旧布拼接','褶皱与拼接'],
  [699344,'浅杏细格','素色肌理'], [689102,'深苔绿肌理','素色肌理'],
  [645030,'湖蓝刷纹','素色肌理'], [1263439,'浅草绿纸','水彩底色'],
  [1442985,'薄荷揉纸','褶皱与拼接'], [1619829,'灰蓝再生纸','素色肌理'],
  [720722,'蓝色墨迹','水彩底色'], [1110070,'海盐青绿','水彩底色'],
  [1412537,'粉褐手工纸','素色肌理'], [1201393,'旧书铅字','书页与文具'],
  [1436955,'浅粉细纹','素色肌理'], [1459513,'一枚回形针','书页与文具'],
  [1013999,'蔷薇纸纹','素色肌理'], [1110056,'暖橙水彩','水彩底色'],
  [1622102,'浅桃粉纸','素色肌理'], [945512,'空白手记','书页与文具'],
  ['commons-34753833','橘色旧封纸','旧纸与档案'], ['commons-43240888','橄榄绿古书','书页与文具']
];
async function main() {
 const px = JSON.parse(fs.readFileSync(path.join(root,'pxhere.json')));
 const commons = JSON.parse(fs.readFileSync(path.join(root,'candidates.json')));
 const records=[];
 for(const [id,name,group] of selected){
  const key = typeof id === 'number' ? `pxhere-${id}` : id;
  const original = path.join(root,'originals',`${key}.jpg`);
  if(!fs.existsSync(original)){console.log('missing',key);continue;}
  const metadata = await sharp(original).metadata();
  let source;
  if(typeof id === 'number'){
    const item=px.find(x=>x.id===id);
    if(!item)throw Error(`Missing source record ${key}`);
    const html=fs.readFileSync(path.join(root,'sources',`${key}.html`),'utf8');
    const jsonld=html.match(/<script type="application\/ld\+json">(.*?)<\/script>/s)?.[1];
    const author=jsonld ? JSON.parse(jsonld).author?.name : '';
    source={page:item.source,image:item.url,author:author||'PxHere contributor',license:'CC0 1.0',licenseUrl:'https://creativecommons.org/publicdomain/zero/1.0/'};
  }else{
    const item=commons.find(x=>x.pageid===Number(id.split('-')[1]));const info=item.imageinfo[0],ext=info.extmetadata;
    source={page:info.descriptionurl,image:info.url,author:ext.Artist?.value||'',license:ext.LicenseShortName.value,licenseUrl:ext.LicenseUrl?.value||info.descriptionurl};
  }
  const folder=path.join(root,'backgrounds',group);fs.mkdirSync(folder,{recursive:true});
  const filename=`${String(records.length+1).padStart(2,'0')}-${name}.jpg`;
  const dest=path.join(folder,filename);
  let pipeline=sharp(original).rotate();
  // Preserve the olive book cover, excluding the ruler and facing page.
  if(key==='commons-43240888') pipeline=pipeline.extract({left:130,top:110,width:1600,height:2500});
  if(key==='pxhere-1459513') pipeline=pipeline.extract({left:300,top:0,width:1525,height:2034});
  await pipeline.resize(900,1200,{fit:'cover',position:'centre'}).jpeg({quality:90,mozjpeg:true}).toFile(dest);
  const bytes=fs.readFileSync(dest);
  records.push({key,name,group,file:path.relative(root,dest).replaceAll('\\','/'),width:900,height:1200,bytes:bytes.length,sha256:crypto.createHash('sha256').update(bytes).digest('hex'),originalWidth:metadata.width,originalHeight:metadata.height,source,changes:'Portrait 3:4 crop; resized to 900 x 1200; JPEG compression. No generative edits.'});
 }
 fs.writeFileSync(path.join(root,'manifest.json'),JSON.stringify({batchId:'collage-backgrounds-20260928',createdAt:new Date().toISOString(),materials:records},null,2));
 const tiles=[];
 for(let n=0;n<records.length;n++){
  const item=records[n],left=n%6*180+10,top=Math.floor(n/6)*280+15;
  tiles.push({input:await sharp(path.join(root,item.file)).resize(160,213).toBuffer(),left,top});
  tiles.push({input:Buffer.from(`<svg width="175" height="50"><text x="1" y="22" font-family="Microsoft YaHei" font-size="15" fill="#34342c">${String(n+1).padStart(2,'0')} ${item.name}</text><text x="1" y="43" font-family="Microsoft YaHei" font-size="12" fill="#727266">${item.group}</text></svg>`),left,top:top+215});
 }
 await sharp({create:{width:1080,height:Math.ceil(records.length/6)*280,channels:3,background:'#efede6'}}).composite(tiles).jpeg({quality:90}).toFile(path.join(root,'总览.jpg'));
 const rows=records.map((x,n)=>`| ${n+1} | ${x.name} | ${x.group} | [原图页面](${x.source.page}) | ${x.source.license} |`).join('\n');
 fs.writeFileSync(path.join(root,'README.md'),`# 拼贴诗背景素材包\n\n共 ${records.length} 张；全部为宽 900 × 高 1200 px，竖版 3:4，JPEG。\n\nbackgrounds/ 下按组保存成品，originals/ 保留下载的原图。总览.jpg 可快速挑选。manifest.json 包含逐图来源、授权页面、原始尺寸、处理说明和校验值；sources/ 保存检索与授权依据。来源网站将入选素材标记为 CC0 或无已知版权限制，详见逐图来源。\n\n仅裁切、缩放与压缩，未使用生成式 AI 改绘。\n\n| 序号 | 名称 | 分组 | 来源 | 来源标注 |\n|---|---|---|---|---|\n${rows}\n`);
 console.log('Prepared',records.length,'images;',Math.round(records.reduce((s,x)=>s+x.bytes,0)/1024/1024*10)/10,'MB');
}
main().catch(e=>{console.error(e);process.exitCode=1;});
