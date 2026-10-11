const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createRequire } = require('node:module');
const cloud = require('wx-server-sdk');
cloud.init({ env: 'posts-contract-test' });
const sdk = cloud.database(), command = sdk.command;
const { compactCreate, compactPatch, toPostView, createPostsDatabase, compatibleWhere, withPostResponse } = require('../functions/_shared/posts');
const { ALIASES } = require('../functions/_shared/posts/schema');
const { matches, memoryDb } = require('./helpers/posts-memory-db.cjs');
const base={_openid:'owner',title:'诗',content:'一\n二',publishMode:'poem',isPoem:true,isOriginal:true,
  author:'署名',authorName:'昵称',authorNameSnapshot:'昵称',authorAvatar:'avatar',authorAvatarSnapshot:'avatar',
  backgroundColor:'#97D4F1',textColor:'#041A38',highlightLines:['二'],highlightSentence:'二',
  isAnonymous:false,isDiscussion:false,isSeries:false,isActivityPost:false,anonymousAuthorName:'匿名用户',
  seriesBlocks:[],sentenceGroups:[],discussionSentences:[],joinedActivityId:'',activityId:'',
  realAuthorOpenid:null,authorSignature:'',tags:[],auditStatus:'approved',auditTime:new Date(1),
  createTime:new Date(1),updateTime:new Date(2),isHidden:true,votes:0,commentCount:0};

async function main(){
  const modern=compactCreate(base);
  assert.equal(Object.keys(modern).length,19,'sample stores 19 application fields plus generated _id');
  for(const key of ALIASES)assert.ok(!(key in modern),key+' must not be stored');
  assert.equal(modern.isHidden,true);
  assert.equal(modern.backgroundColor,base.backgroundColor);
  assert.equal(modern.votes,0);
  assert.equal(compactCreate({...base,isOriginal:false}).isOriginal,false);
  assert.throws(()=>compactCreate({...base,isOriginal:undefined,publishMode:'bad'}));
  assert.throws(()=>compactCreate({...base,isSeries:true,seriesBlocks:[]}));
  assert.throws(()=>compactCreate({...base,isAnonymous:true}));
  const view=toPostView(modern);
  assert.equal(view.isPoem,true); assert.equal(view.highlightSentence,'二'); assert.equal(view.authorNameSnapshot,'昵称');
  const old=toPostView({_id:'old',isPoem:true,authorNameSnapshot:'旧昵称',imageUrl:'old-image',highlightSentence:'旧句',discussionSentences:[{sentences:['句'],comment:'评'}]});
  assert.equal(old.authorName,'旧昵称');assert.deepEqual(old.imageUrls,['old-image']);assert.equal(old.highlightSentence,'旧句');assert.equal(old.sentenceGroups.length,1);
  const noResurrection=toPostView({...modern,highlightLines:[],highlightSentence:'stale'});
  assert.equal(noResurrection.highlightSentence,'');
  const images=compactCreate({...base,imageUrls:['compressed'],originalImageUrls:['original'],poemBgImage:'compressed'});
  assert.equal(images.poemBgImage,undefined);assert.deepEqual(images.originalImageUrls,['original']);
  assert.equal(compactCreate({...base,imageUrls:['same'],originalImageUrls:['same']}).originalImageUrls,undefined);
  const series=compactCreate({...base,isSeries:true,seriesBlocks:[{content:'甲',highlightSentence:'甲'},{content:'乙'}]});
  assert.equal(series.content,'甲\n\n乙');assert.equal(toPostView(series).seriesBlockCount,2);
  const anon=compactCreate({...base,isAnonymous:true,realAuthorOpenid:'owner',authorSignature:'private'});
  assert.equal(anon._openid,'123456');assert.equal(anon.authorSignature,undefined);
  const response=await withPostResponse(async()=>({post:toPostView(anon)}))();
  assert.ok(!JSON.stringify(response).includes('realAuthorOpenid'));assert.equal(response.post.authorSignature,'');

  const rows=[
    {_id:'old-poem',isPoem:true,isOriginal:true,createTime:6},
    {_id:'new-poem',schemaVersion:2,publishMode:'poem',isOriginal:true,createTime:5},
    {_id:'old-talk',isDiscussion:true,createTime:4},
    {_id:'new-talk',schemaVersion:2,publishMode:'discussion',createTime:3},
    {_id:'old-normal',createTime:2},
    {_id:'new-normal',schemaVersion:2,publishMode:'normal',createTime:1}
  ];
  for(const [filter,expected]of [
    [{isPoem:true},['old-poem','new-poem']],
    [{isDiscussion:true},['old-talk','new-talk']],
    [{isPoem:command.neq(true),isDiscussion:command.neq(true)},['old-normal','new-normal']],
    [command.and([{isPoem:true},{isOriginal:true}]),['old-poem','new-poem']],
    [command.or([{isPoem:true},{isDiscussion:true}]),rows.slice(0,4).map(row=>row._id)]
  ]){
    const condition=compatibleWhere(filter);
    assert.deepEqual(rows.filter(row=>matches(row,condition)).map(row=>row._id),expected);
    // Exercise the real SDK encoder: raw logical trees must not contain unencoded SDK objects.
    const encoded=JSON.stringify(sdk.collection('posts').where(condition));
    assert.ok(!encoded.includes('\\"operands\\"'),encoded);
  }
  assert.ok(matches({schemaVersion:2,publishMode:'normal'},compatibleWhere({isAnonymous:false,isHidden:command.neq(true)})));
  assert.ok(matches({schemaVersion:2,publishMode:'normal',activityId:'a'},compatibleWhere({isActivityPost:true})));
  const memory=memoryDb({posts:[...rows,{...modern,_id:'editable'}]},command);
  const db=createPostsDatabase(memory.db);
  const first=await db.collection('posts').where({isPoem:true}).orderBy('createTime','desc').skip(0).limit(1).get();
  assert.equal(first.data[0]._id,'old-poem');
  const second=await db.collection('posts').where({isPoem:true}).orderBy('createTime','desc').skip(1).limit(1).get();
  assert.equal(second.data[0]._id,'new-poem');
  assert.equal(memory.calls.length,2,'one DB read per page, no extra compatibility lookups');
  const projected=await db.collection('posts').doc('editable').field({highlightSentence:true,isPoem:true}).get();
  assert.equal(projected.data.highlightSentence,'二');assert.equal(projected.data.isPoem,true);
  const aggregate=await db.collection('posts').aggregate().match({_id:'editable'}).limit(1).project({title:1,isPoem:1,highlightSentence:1}).end();
  assert.equal(aggregate.list[0].highlightSentence,'二');assert.equal(aggregate.list[0].isPoem,true);
  const last=memory.calls.at(-1);assert.equal(last.stages[0][0],'match');assert.equal(last.stages[1][0],'limit');
  const count=await db.collection('posts').aggregate().match({isPoem:true}).count('total').end();
  assert.equal(count.list[0].total,3);assert.ok(!memory.calls.at(-1).stages.some(([key])=>key==='addFields'));
  await db.collection('posts').doc('editable').get();
  const before=memory.calls.length;
  await db.collection('posts').doc('editable').update({data:{highlightLines:[],highlightSentence:'stale',title:'改题'}});
  assert.equal(memory.calls.length-before,1,'known-schema edits need only the existing write');
  const stored=memory.tables.posts.find(post=>post._id==='editable');
  assert.equal(stored.title,'改题');assert.ok(!('highlightSentence'in stored));assert.ok(!('highlightLines'in stored));assert.equal(stored.content,base.content);
  await db.collection('posts').where({_openid:'owner'}).update({data:{authorName:'新昵称',authorNameSnapshot:'新昵称'}});
  assert.equal(stored.authorName,'新昵称');assert.ok(!('authorNameSnapshot'in stored));
  const modePatch=compactPatch({isPoem:false,isDiscussion:true,isOriginal:false},command);
  assert.equal(modePatch.publishMode,'discussion');assert.equal(modePatch.isPoem.operator,'remove');

  const previous=process.env.POSTS_WRITE_SCHEMA;
  process.env.POSTS_WRITE_SCHEMA='2';
  const newPost=await db.collection('posts').add({data:base});
  assert.equal(memory.tables.posts.find(post=>post._id===newPost._id).schemaVersion,2);
  process.env.POSTS_WRITE_SCHEMA='1';
  const legacyPost=await db.collection('posts').add({data:base});
  assert.equal(memory.tables.posts.find(post=>post._id===legacyPost._id).isPoem,true);
  if(previous===undefined)delete process.env.POSTS_WRITE_SCHEMA;else process.env.POSTS_WRITE_SCHEMA=previous;

  // Run actual create entrypoints, checking their storage rather than just builders.
  for(const name of ['contentCheck','createPost','createDiscussionPost','createSeriesFromSingles','uploadCollagePoetry']){
    const mem=memoryDb({users:[{_openid:'owner',nickName:'昵称',avatarUrl:'avatar'}],posts:[{_id:'source',_openid:'owner',title:'源诗',content:'源句',isPoem:true,isOriginal:true,createTime:new Date()}]},command);
    const filename=path.resolve('functions',name,'index.js'),localRequire=createRequire(filename);
    const sandbox={exports:{},console:{log(){},warn(){},error(){}},process,Buffer,
      require(module){if(module==='wx-server-sdk')return {init(){},database:()=>mem.db,getWXContext:()=>({OPENID:'owner'}),uploadFile:async()=>({fileID:'cloud://image'}),callFunction:async()=>({result:{success:true,passed:true,code:'MODERATION_OFF'}})};return localRequire(module);}};
    vm.runInNewContext(fs.readFileSync(filename,'utf8'),sandbox,{filename});
    process.env.POSTS_WRITE_SCHEMA='2';
    const event=['contentCheck','createPost'].includes(name)?{...base,openid:'owner'}:name==='createDiscussionPost'?{quotedPostId:'source',content:'讨论',sentenceGroups:[{sentences:['源句'],comment:'评论'}]}:name==='uploadCollagePoetry'?{fileContent:'aGVsbG8=',cloudPath:'test/image.png'}:{blocks:[{postId:'source'}],title:'组诗'};
    const result=await sandbox.exports.main(event,{});
    assert.ok(result.postId,JSON.stringify({name,result}));
    const document=mem.tables.posts.find(row=>row._id===result.postId);
    assert.equal(document.schemaVersion,2,name);
    for(const key of ALIASES)assert.ok(!(key in document),name+': '+key);
    if(name==='contentCheck')assert.deepEqual(mem.calls.filter(call=>call.name==='posts').map(call=>call.op),['add'],'main publish performs a single posts write');
  }
  if(previous===undefined)delete process.env.POSTS_WRITE_SCHEMA;else process.env.POSTS_WRITE_SCHEMA=previous;

  const editMemory=memoryDb({posts:[{...compactCreate({...base,isAnonymous:true,realAuthorOpenid:'owner'}),_id:'anonymous'},
    {...modern,_id:'normal'}, {...base,_id:'legacy'}],users:[{_openid:'owner',nickName:'账号名',avatarUrl:'avatar'}],votes_log:[]},command);
  function loadHandler(name,caller='owner'){
    const filename=path.resolve('functions',name,'index.js'),localRequire=createRequire(filename);
    const sandbox={exports:{},console:{log(){},warn(){},error(){}},process,Buffer,
      require(module){
        if(module==='wx-server-sdk')return {init(){},database:()=>editMemory.db,getWXContext:()=>({OPENID:caller}),callFunction:async()=>({result:{success:true,passed:true,code:'MODERATION_OFF'}})};
        if(module==='./_lib/get-blocked-user-ids')return async()=>[];
        return localRequire(module);
      }};
    vm.runInNewContext(fs.readFileSync(filename,'utf8'),sandbox,{filename});return sandbox.exports.main;
  }
  const detail=await loadHandler('getPostDetail')({postId:'anonymous'},{});
  assert.equal(detail.success,true);assert.equal(detail.post.isAuthor,true);assert.equal(detail.post.isPoem,true);
  assert.ok(!('realAuthorOpenid'in detail.post));
  assert.equal((await loadHandler('getPostDetail','stranger')({postId:'anonymous'},{})).code,'POST_HIDDEN');
  const edit=loadHandler('updatePostContent');
  const updated=await edit({postId:'normal',data:{title:'编辑后',highlightLines:[],fileIDs:[],joinedActivityId:''}},{});
  assert.equal(updated.success,true,JSON.stringify(updated));
  const edited=editMemory.tables.posts.find(post=>post._id==='normal');
  for(const key of ['isPoem','isDiscussion','highlightLines','highlightSentence','imageUrl','imageUrls','joinedActivityId'])assert.ok(!(key in edited),key);
  assert.equal(edited.content,base.content);assert.equal(edited.backgroundColor,base.backgroundColor);
  assert.equal((await edit({postId:'legacy',data:{title:'旧帖编辑'}},{})).success,true);
  assert.equal(editMemory.tables.posts.find(post=>post._id==='legacy').isPoem,true);
  const visibility=await loadHandler('updatePostVisibility')({postId:'anonymous',hidden:false},{});
  assert.equal(visibility.success,true);assert.ok(!('isHidden'in editMemory.tables.posts[0]));
  const page=await loadHandler('getPostList')({isPoem:true,isOriginal:true,skip:0,limit:10},{});
  assert.equal(page.success,true,JSON.stringify(page));assert.equal(page.posts.length,1,'only unhidden anonymous post is in public feed');
  assert.equal(page.posts[0].isPoem,true);assert.ok(!('realAuthorOpenid'in page.posts[0]));
  console.log('Posts V1/V2 contract, SDK predicates, pagination, projections, sparse writes, rollout and creation tests passed');
}
main().catch(error=>{console.error(error);process.exitCode=1;});
