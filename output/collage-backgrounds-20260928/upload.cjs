// Uses the existing CloudBase CLI login in memory; never writes credentials.
const fs=require('node:fs'),path=require('node:path');
const sharp=require('C:/Users/qisaihao/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const {validateMaterialInput,validateGroupInput}=require('../../functions/adminManager/_lib/collage-material');
const cliRoot=path.join(process.env.APPDATA,'npm/node_modules/@cloudbase/cli');
const {authSupevisor}=require(path.join(cliRoot,'lib/utils/auth.js'));
const tcb=require('@cloudbase/node-sdk');
const root=__dirname,manifest=JSON.parse(fs.readFileSync(path.join(root,'manifest.json')));
const receiptPath=path.join(root,'upload-receipt.json');
let receipt={batchId:manifest.batchId,environment:'cloud1-5gb0pbyl400845f5',groups:[],materials:[]};
if(fs.existsSync(receiptPath))receipt=JSON.parse(fs.readFileSync(receiptPath));
function checkpoint(){fs.writeFileSync(receiptPath,JSON.stringify(receipt,null,2));}
async function main(){
  const auth=await authSupevisor.getLoginState();
  if(!auth?.secretId||!auth?.secretKey)throw Error('CloudBase login required');
  const app=tcb.init({env:receipt.environment,secretId:auth.secretId,secretKey:auth.secretKey,sessionToken:auth.token});
  const db=app.database();
  // Validate the entire pack before the first remote write.
  for(const x of manifest.materials){
    const image=await sharp(path.join(root,x.file)).metadata();
    if(image.width!==900||image.height!==1200)throw Error(`Unexpected dimensions: ${x.key}`);
    if(!validateGroupInput({type:'background',name:x.group}).ok)throw Error(`Invalid group: ${x.group}`);
  }
  const previous=await db.collection('collage_materials').limit(1000).get();
  if(!receipt.existingMaterialIds){receipt.existingMaterialIds=previous.data.map(x=>x._id);checkpoint();}
  const names=[...new Set(manifest.materials.map(x=>x.group))];
  const groupIds=new Map();
  for(let n=0;n<names.length;n++){
    const name=names[n];
    const current=await db.collection('collage_material_groups').where({type:'background',name}).get();
    let id=current.data[0]?._id;
    if(!id){const result=await db.collection('collage_material_groups').add({type:'background',name,sort:Date.now()+n,createdAt:db.serverDate(),updatedAt:db.serverDate(),createdBy:'local-admin',batchId:manifest.batchId});id=result.id;}
    if(!id)throw Error(`Missing group ID: ${name}`);
    groupIds.set(name,id);
    if(!receipt.groups.some(x=>x.id===id))receipt.groups.push({id,name});checkpoint();
  }
  for(const x of manifest.materials){
    const existing=await db.collection('collage_materials').where({batchId:manifest.batchId,sourceKey:x.key}).get();
    if(existing.data.length){console.log('already uploaded',x.name);continue;}
    const saved=receipt.materials.find(y=>y.key===x.key);
    const cloudPath=`collage-materials/background/${manifest.batchId}/${x.key}.jpg`;
    const fileID=saved?.fileID||(await app.uploadFile({cloudPath,fileContent:fs.createReadStream(path.join(root,x.file))})).fileID;
    const record=saved||{key:x.key,name:x.name,cloudPath,fileID};
    if(!saved)receipt.materials.push(record);checkpoint();
    const check=validateMaterialInput({type:'background',name:x.name,fileID,groupId:groupIds.get(x.group),width:x.width,height:x.height});
    if(!check.ok)throw Error(check.error);
    const added=await db.collection('collage_materials').add({...check.value,createdAt:db.serverDate(),updatedAt:db.serverDate(),createdBy:'local-admin',batchId:manifest.batchId,sourceKey:x.key,source:x.source,processing:x.changes,sha256:x.sha256});
    record.id=added.id;record.groupId=groupIds.get(x.group);checkpoint();
    console.log('uploaded',x.name);
  }
  const final=await db.collection('collage_materials').limit(1000).get();
  const mine=final.data.filter(x=>x.batchId===manifest.batchId);
  if(mine.length!==manifest.materials.length)throw Error('Uploaded count mismatch');
  if(receipt.existingMaterialIds.some(id=>!final.data.some(x=>x._id===id)))throw Error('An existing material is missing');
  const urls=await app.getTempFileURL({fileList:mine.map(x=>x.fileID)});
  if(urls.fileList.some(x=>!x.tempFileURL))throw Error('Some file URLs could not be resolved');
  receipt.verifiedAt=new Date().toISOString();receipt.verifiedCount=mine.length;receipt.totalBackgroundCount=final.data.filter(x=>x.type==='background').length;checkpoint();
  console.log('VERIFIED',mine.length,'new backgrounds;',receipt.totalBackgroundCount,'total; existing materials preserved');
}
main().catch(e=>{console.error(e.code||e.name,e.message);process.exitCode=1;});
