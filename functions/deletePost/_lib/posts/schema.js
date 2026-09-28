'use strict';

// Storage is deliberately smaller than the legacy API view. Never persist a view.
const has = (value, key) => Object.prototype.hasOwnProperty.call(value || {}, key);
const list = value => Array.isArray(value) ? value : [];
const text = value => typeof value === 'string' ? value : '';
const bool = value => value === true || value === 'true';
const isAnonymousPost = post => !!post && (bool(post.isAnonymous) || post._openid === '123456');
const FIELDS = new Set(`_openid title content createTime updateTime publishMode isOriginal
  votes commentCount viewCount discussionCount author authorName authorAvatar authorSignature
  backgroundColor textColor tags highlightLines sentenceGroups seriesBlocks isSeries
  isFoundPoetry isAnonymous realAuthorOpenid isHidden activityId activityTitleSnapshot
  activityPublishTime joinedActivityId joinedActivityTitleSnapshot joinedActivityAt
  parentPostId quotedPostId quotedPostTitle quotedPostAuthor quotedPostAuthorId
  imageUrls originalImageUrls poemBgImage isMergedFrom mergedToSeriesId auditStatus auditTime
  embedding`.split(/\s+/));
const ALIASES = ['isPoem', 'isDiscussion', 'isActivityPost', 'authorNameSnapshot',
  'authorAvatarSnapshot', 'anonymousAuthorName', 'highlightSentence', 'discussionSentences',
  'seriesBlockCount', 'seriesCoverImage', 'seriesCoverHighlight', 'imageUrl',
  'originalImageUrl', 'createdAt', 'updatedAt', 'isVoted', 'isAuthor', 'fileIDs', 'originalFileIDs'];
const SPARSE = new Set(['isSeries', 'isFoundPoetry', 'isAnonymous', 'isHidden']);

function modeOf(post) {
  if (post.schemaVersion === 2) return post.publishMode;
  if (['normal', 'poem', 'discussion'].includes(post.publishMode)) return post.publishMode;
  if (bool(post.isDiscussion)) return 'discussion';
  return bool(post.isPoem) || bool(post.isSeries) ? 'poem' : 'normal';
}

function blocksOf(blocks) {
  return list(blocks).map(block => {
    const out = {};
    for (const key of ['id', 'order', 'subtitle', 'content', 'imageUrl', 'backgroundColor', 'textColor']) {
      if (block[key] !== undefined && block[key] !== '') out[key] = block[key];
    }
    const lines = list(block.highlightLines).length ? block.highlightLines : (block.highlightSentence ? [block.highlightSentence] : []);
    if (lines.length) out.highlightLines = lines;
    if (!out.subtitle && block.subTitle) out.subtitle = block.subTitle;
    return out;
  });
}

function canonicalInput(input, partial = false) {
  const out = { ...input };
  const alias = (key, old) => { if (!has(out, key) && has(out, old)) out[key] = out[old]; };
  alias('authorName', 'authorNameSnapshot');
  alias('authorAvatar', 'authorAvatarSnapshot');
  alias('createTime', 'createdAt');
  alias('updateTime', 'updatedAt');
  alias('joinedActivityId', 'joinActivityId');
  alias('joinedActivityTitleSnapshot', 'joinActivityTitleSnapshot');
  alias('imageUrls', 'fileIDs');
  alias('originalImageUrls', 'originalFileIDs');
  alias('sentenceGroups', 'discussionSentences');
  if (!has(out, 'imageUrls') && has(out, 'imageUrl')) out.imageUrls = out.imageUrl ? [out.imageUrl] : [];
  if (!has(out, 'originalImageUrls') && has(out, 'originalImageUrl')) out.originalImageUrls = out.originalImageUrl ? [out.originalImageUrl] : [];
  if (!has(out, 'highlightLines') && has(out, 'highlightSentence')) out.highlightLines = out.highlightSentence ? [out.highlightSentence] : [];
  if (has(out, 'seriesBlocks')) out.seriesBlocks = blocksOf(out.seriesBlocks);
  if (!has(out, 'publishMode') && (!partial || has(out, 'isPoem') || has(out, 'isDiscussion'))) out.publishMode = modeOf(out);
  if (bool(out.isAnonymous) && !out.authorName) out.authorName = out.anonymousAuthorName || '匿名用户';
  return out;
}

function compactCreate(input) {
  const source = canonicalInput(input);
  if (!source._openid) throw new Error('帖子缺少作者身份');
  if (!['normal', 'poem', 'discussion'].includes(source.publishMode)) throw new Error('无效的发布类型');
  if (source.publishMode === 'poem' && !has(source, 'isOriginal')) throw new Error('诗歌必须明确原创状态');
  if (source.activityId && source.joinedActivityId) throw new Error('官方活动与参与活动不能同时设置');
  if (bool(source.isAnonymous) && !source.realAuthorOpenid) throw new Error('匿名帖子缺少真实归属');
  if (bool(source.isSeries) && !list(source.seriesBlocks).length) throw new Error('组诗不能为空');
  if (source.activityId && (source.publishMode !== 'normal' || bool(source.isAnonymous))) throw new Error('官方活动帖子类型无效');
  if (source.publishMode !== 'poem') {
    for (const key of ['author', 'isOriginal', 'seriesBlocks', 'isSeries']) delete source[key];
  } else if (bool(source.isSeries)) {
    source.content = list(source.seriesBlocks).map(block => block.content || '').join('\n\n');
  }
  if (source.publishMode !== 'discussion') delete source.sentenceGroups;
  if (!bool(source.isAnonymous)) delete source.realAuthorOpenid;
  if (bool(source.isAnonymous)) {
    source._openid = '123456';
    source.authorName = source.anonymousAuthorName || '匿名用户';
    if (source.author) source.author = source.authorName;
    source.authorAvatar = '/static/images/avatar.png';
    delete source.authorSignature;
  }
  if (!source.activityId) for (const key of ['activityTitleSnapshot', 'activityPublishTime']) delete source[key];
  if (!source.joinedActivityId) for (const key of ['joinedActivityTitleSnapshot', 'joinedActivityAt']) delete source[key];
  if (!bool(source.isSeries)) delete source.seriesBlocks;
  const out = { schemaVersion: 2 };
  for (const key of FIELDS) {
    const value = source[key];
    if (value === undefined || value === null || value === '' || (Array.isArray(value) && !value.length)) continue;
    if (SPARSE.has(key)) { if (bool(value)) out[key] = true; }
    else out[key] = value;
  }
  if (out.publishMode === 'poem') out.isOriginal = bool(source.isOriginal);
  out.createTime = source.createTime || new Date();
  out.votes = 0;
  out.commentCount = 0;
  out.auditStatus = source.auditStatus || 'approved';
  out.auditTime = source.auditTime || out.createTime;
  if (JSON.stringify(out.originalImageUrls) === JSON.stringify(out.imageUrls)) delete out.originalImageUrls;
  if (out.poemBgImage === list(out.imageUrls)[0]) delete out.poemBgImage;
  if (!out.title && !out.content && !list(out.imageUrls).length && !list(out.seriesBlocks).length) throw new Error('帖子内容不能为空');
  return out;
}

function compactPatch(input, command) {
  const source = canonicalInput(input, true);
  const out = {};
  for (const [key, value] of Object.entries(source)) {
    if (!FIELDS.has(key) || value === undefined) continue;
    if (value === null || value === '' || (Array.isArray(value) && !value.length) || (SPARSE.has(key) && !bool(value))) out[key] = command.remove();
    else if (SPARSE.has(key) || key === 'isOriginal') out[key] = bool(value);
    else out[key] = value;
  }
  // Remove deprecated names even if an older editor sends them back.
  for (const key of ALIASES) if (has(input, key)) out[key] = command.remove();
  if (has(source, 'publishMode') && source.publishMode !== 'poem') {
    for (const key of ['isOriginal', 'isSeries', 'seriesBlocks', 'seriesBlockCount', 'seriesCoverImage', 'seriesCoverHighlight']) out[key] = command.remove();
  }
  if (has(source, 'publishMode') && source.publishMode !== 'discussion') {
    out.sentenceGroups = command.remove();
    out.discussionSentences = command.remove();
  }
  if (source.isSeries === false) out.seriesBlocks = command.remove();
  if (has(source, 'joinedActivityId') && !source.joinedActivityId) {
    for (const key of ['joinedActivityId', 'joinedActivityTitleSnapshot', 'joinedActivityAt']) out[key] = command.remove();
  }
  if (has(source, 'imageUrls')) {
    for (const key of ['imageUrl', 'originalImageUrl', 'poemBgImage']) out[key] = command.remove();
    if (!has(source, 'originalImageUrls') || JSON.stringify(source.originalImageUrls) === JSON.stringify(source.imageUrls)) out.originalImageUrls = command.remove();
  }
  if (source.isAnonymous === false) out.realAuthorOpenid = command.remove();
  return out;
}

function toPostView(post) {
  if (!post || typeof post !== 'object') return post;
  const v2 = post.schemaVersion === 2;
  const out = { ...post };
  out.publishMode = modeOf(post);
  out.isPoem = v2 ? out.publishMode === 'poem' : (has(post, 'isPoem') ? post.isPoem : out.publishMode === 'poem');
  out.isDiscussion = v2 ? out.publishMode === 'discussion' : (has(post, 'isDiscussion') ? post.isDiscussion : out.publishMode === 'discussion');
  out.isActivityPost = v2 ? !!post.activityId : (post.isActivityPost === true || !!post.activityId);
  for (const key of ['isOriginal', ...SPARSE]) out[key] = post[key] === true;
  out.isAnonymous = isAnonymousPost(post);
  out.title = text(post.title);
  out.content = text(post.content);
  out.tags = list(post.tags);
  out.sentenceGroups = list(post.sentenceGroups).length ? post.sentenceGroups : (!v2 ? list(post.discussionSentences) : []);
  out.discussionSentences = out.sentenceGroups.map(group => ({ sentences: group.sentences, comment: group.comment }));
  out.highlightLines = list(post.highlightLines).length ? post.highlightLines : (!v2 && post.highlightSentence ? [post.highlightSentence] : []);
  out.highlightSentence = out.highlightLines[0] || '';
  out.seriesBlocks = list(post.seriesBlocks).map(block => ({ ...block, highlightSentence: list(block.highlightLines)[0] || block.highlightSentence || '' }));
  out.seriesBlockCount = v2 ? out.seriesBlocks.length : (post.seriesBlockCount || out.seriesBlocks.length);
  out.isSeries = out.isSeries || out.seriesBlocks.length > 0;
  out.seriesCoverImage = (!v2 && post.seriesCoverImage) || (out.seriesBlocks[0] || {}).imageUrl || '';
  out.seriesCoverHighlight = (!v2 && post.seriesCoverHighlight) || out.highlightSentence;
  out.imageUrls = list(post.imageUrls).length ? post.imageUrls : (!v2 && post.imageUrl ? [post.imageUrl] : []);
  out.originalImageUrls = list(post.originalImageUrls).length ? post.originalImageUrls : (!v2 && post.originalImageUrl ? [post.originalImageUrl] : out.imageUrls);
  out.imageUrl = out.imageUrls[0] || '';
  out.originalImageUrl = out.originalImageUrls[0] || '';
  out.poemBgImage = post.poemBgImage || (out.isPoem ? out.imageUrl : '');
  out.authorName = post.authorName || (!v2 && post.authorNameSnapshot) || '';
  out.authorAvatar = post.authorAvatar || (!v2 && post.authorAvatarSnapshot) || '';
  out.authorNameSnapshot = out.authorName;
  out.authorAvatarSnapshot = out.authorAvatar;
  out.anonymousAuthorName = out.isAnonymous ? ((v2 && post.authorName) || post.anonymousAuthorName || '匿名用户') : '';
  if (out.isAnonymous) {
    // 兼容早期匿名帖将真实作者存入 _openid 的写法，内部仍保留所有权。
    out.realAuthorOpenid = resolveOwner(post);
    out._openid = '123456';
    out.authorName = out.anonymousAuthorName;
    out.authorNameSnapshot = out.authorName;
    if (out.author) out.author = out.authorName;
    out.authorAvatar = '/static/images/avatar.png';
    out.authorAvatarSnapshot = out.authorAvatar;
    out.authorSignature = '';
  }
  return out;
}

const resolveOwner = post => post && (isAnonymousPost(post)
  ? (post.realAuthorOpenid || (post._openid !== '123456' ? post._openid : undefined))
  : post._openid);
module.exports = { FIELDS, ALIASES, SPARSE, has, compactCreate, compactPatch, toPostView, resolveOwner, isAnonymousPost };
