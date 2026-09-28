const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const sharp=require('C:/Users/qisaihao/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const root=__dirname,items=JSON.parse(fs.readFileSync(path.join(root,'inventory.json')));
const names=[
 '绿灯阶影','暮色归巷','墨绿金雾','粉樱留白','暗窗红花','燃橘秋树','青窗花影','嫩绿枝网','绯色枝影','青枝夜花','雾山素描',
 '冷蓝水纹','银光浅漾','深海碎银','水面回环',
 '霜枫远山','丹枫浅山','古松渔舟','松风云岭',
 '米色织纸','雪白纤维纸','乳白细纸','柔白褶纸','浅白揉纸','横线信笺','浅牛皮纸','柔雾白纸','深牛皮褶纸','银灰折纸','浅米素纸','暖沙纸','灰绿旧纸','白纸折痕','乳黄棉纸','雪白揉纹','细格白布纸','象牙素纸',
 '青绯飞鸟','赭霞归雁','苍绿连山','浅草群鸟','暮蓝远山','浅碧秋声',
 '月相银幕','灰蓝残页','雾中白鸟',
 '钴蓝铅字','旧页折线','蓝色字环','浅灰铅字',
 '池光浮影','浅黄春枝','绿叶篱网','碧色疏枝','水光微澜',
 '蓝桃云霞','粉绿花雾',
 '蓝白旧巷','橄榄街角','粉樱骑楼','紫瓦深巷','碧荷繁花','蓝影花窗','淡紫窗光','粉荷浅水','青灰古门','绯红楼影'
];
function group(n){return n<=11?'暗调与花影':n<=15?'冷界余音':n<=19?'古风山水':n<=37?'纸张质感':n<=43?'飞鸟秋山':n<=46?'海市幻象':n<=50?'铅字蓝':n<=55?'闪茵光影':n<=57?'云霞渐变':'版画光影';}
function author(n){return n<=11?'入妁（定制＆盲盒已满）':n<=15?'AKAI':n<=19?'董叨叨吃不饱':n<=37?'37度旅行':n<=43?'不知何名':n<=50?'彼彼彼岸花':n<=55?'月悦相池～':n<=57?'夏小雪':'anchobi';}
async function main(){
 if(names.length!==items.length)throw Error('Name count mismatch');
 const materials=[];
 for(const x of items){
  const n=x.number,name=names[n-1],category=group(n);
  const dir=path.join(root,'backgrounds',category);fs.mkdirSync(dir,{recursive:true});
  const dest=path.join(dir,`${String(n).padStart(2,'0')}-${name}.jpg`);
  // User requested a quarter-turn for the landscape moon phases, without padding.
  await sharp(x.path).rotate(n===44?90:undefined).resize(900,1200,{fit:'cover',position:'centre'}).jpeg({quality:92,mozjpeg:true}).toFile(dest);
  const bytes=fs.readFileSync(dest),metadata=await sharp(dest).metadata();
  if(metadata.width!==900||metadata.height!==1200)throw Error(`Invalid size ${name}`);
  materials.push({key:`local-${x.sha256.slice(0,24)}`,name,group:category,file:path.relative(root,dest).replaceAll('\\','/'),width:900,height:1200,bytes:bytes.length,sha256:crypto.createHash('sha256').update(bytes).digest('hex'),originalWidth:x.width,originalHeight:x.height,source:{kind:'user-provided',originalFilename:x.file,originalPath:x.path,originalSha256:x.sha256,author:author(n),license:'用户提供，未独立核验授权；保留原文件名及作者信息'},changes:n===44?'按用户要求顺时针旋转90度，再居中裁切为3:4；900×1200 JPEG，无留白。':'居中裁切为宽3高4，缩放至900×1200，JPEG压缩；未改绘。'});
 }
 fs.writeFileSync(path.join(root,'manifest.json'),JSON.stringify({batchId:'collage-backgrounds-local-20260928',createdAt:new Date().toISOString(),materials},null,2));
 for(let start=0;start<materials.length;start+=24){
  const batch=materials.slice(start,start+24),tiles=[];
  for(let j=0;j<batch.length;j++){
   const x=batch[j],left=j%6*190+8,top=Math.floor(j/6)*286+8;
   tiles.push({input:await sharp(path.join(root,x.file)).resize(174,232).toBuffer(),left,top});
   tiles.push({input:Buffer.from(`<svg width="180" height="45"><text x="0" y="18" font-family="Microsoft YaHei" font-size="14">${String(start+j+1).padStart(2,'0')} ${x.name}</text><text x="0" y="39" font-family="Microsoft YaHei" font-size="12" fill="#666">${x.group}</text></svg>`),left,top:top+234});
  }
  await sharp({create:{width:1140,height:Math.ceil(batch.length/6)*286,channels:3,background:'#eeece6'}}).composite(tiles).jpeg({quality:90}).toFile(path.join(root,`总览-${start/24+1}.jpg`));
 }
 const rows=materials.map((x,n)=>`| ${n+1} | ${x.name} | ${x.group} | ${x.source.author} | ${x.source.originalFilename} |`).join('\n');
 fs.writeFileSync(path.join(root,'README.md'),`# 本地拼贴背景批处理\n\n共 ${materials.length} 张，全部为 900×1200（宽3高4），原图保持不变。成品位于 backgrounds/，原文件名与新名称对应见下表。横版月相图按用户要求顺时针旋转90度，再裁切为竖版3:4，不加留白。\n\n来源为用户指定的本地文件夹；作者信息按原文件名保留，未将这些图片声明为 CC0。manifest.json 保留原始路径、文件哈希、处理方式。upload-receipt.json 保留云端入库记录。\n\n| 编号 | 新名称 | 分组 | 原文件作者标记 | 原文件名 |\n|---|---|---|---|---|\n${rows}\n`);
 console.log(`Prepared ${materials.length} files; ${(materials.reduce((s,x)=>s+x.bytes,0)/1024/1024).toFixed(1)} MB`);
}
main().catch(e=>{console.error(e);process.exitCode=1});
