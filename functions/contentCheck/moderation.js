// Server-side Tencent Cloud TMS/IMS moderation. Never log submitted text or image URLs.
const MAX_TEXT_LENGTH = 30000;
const TEXT_CHUNK_LENGTH = 9000;
const MAX_IMAGES = 9;

function collectText(input = {}) {
  const fragments = [];
  const add = (value) => {
    if (typeof value === 'string' && value.trim()) fragments.push(value.trim());
  };
  for (const key of ['title', 'content', 'text', 'author', 'nickname', 'signature', 'anonymousAuthorName', 'highlightSentence', 'seriesCoverHighlight']) add(input[key]);
  for (const line of (Array.isArray(input.highlightLines) ? input.highlightLines : [])) add(line);
  for (const tag of (Array.isArray(input.tags) ? input.tags : [])) add(tag);
  const groups = [
    ...(Array.isArray(input.sentenceGroups) ? input.sentenceGroups : []),
    ...(Array.isArray(input.discussionSentences) ? input.discussionSentences : [])
  ];
  for (const group of groups) {
    add(group && group.comment);
    for (const sentence of (group && Array.isArray(group.sentences) ? group.sentences : [])) add(sentence);
  }
  for (const block of (Array.isArray(input.seriesBlocks) ? input.seriesBlocks : [])) {
    add(block && block.subtitle);
    add(block && block.content);
    add(block && block.highlightSentence);
    for (const line of (block && Array.isArray(block.highlightLines) ? block.highlightLines : [])) add(line);
  }
  return [...new Set(fragments)].join('\n');
}

function collectImages(input = {}) {
  const values = [
    ...(Array.isArray(input.fileIDs) ? input.fileIDs : []),
    ...(Array.isArray(input.images) ? input.images : []),
    ...(Array.isArray(input.imageUrls) ? input.imageUrls : []),
    ...(Array.isArray(input.originalImageUrls) ? input.originalImageUrls : []),
    ...((Array.isArray(input.seriesBlocks) ? input.seriesBlocks : []).map(block => block && block.imageUrl))
  ];
  if (input.imageUrl) values.push(input.imageUrl);
  if (input.seriesCoverImage) values.push(input.seriesCoverImage);
  return [...new Set(values.filter(value => typeof value === 'string' && value.trim()).map(value => value.trim()))];
}

function splitText(value) {
  const chars = Array.from(value);
  const chunks = [];
  for (let offset = 0; offset < chars.length; offset += TEXT_CHUNK_LENGTH) {
    chunks.push(chars.slice(offset, offset + TEXT_CHUNK_LENGTH).join(''));
  }
  return chunks;
}

function responseForSuggestion(suggestion, kind, requestId) {
  if (suggestion === 'Pass') return null;
  const review = suggestion === 'Review';
  return {
    success: true,
    passed: false,
    code: review ? 'REVIEW_REQUIRED' : suggestion === 'Block' ? 'CONTENT_BLOCKED' : 'MODERATION_UNAVAILABLE',
    message: review ? '内容需要人工复核，请联系客服' : suggestion === 'Block' ? `${kind}未通过安全审核，请修改后重试` : '内容审核暂时不可用，请稍后重试',
    failedType: kind === '图片内容' ? 'image' : 'text',
    suggestion,
    requestId
  };
}

function createModerationService(cloud, env = process.env, injectedClients = null) {
  let clients = injectedClients;
  function getClients() {
    if (clients) return clients;
    const secretId = env.TENCENT_SECRET_ID || env.TENCENTCLOUD_SECRET_ID;
    const secretKey = env.TENCENT_SECRET_KEY || env.TENCENTCLOUD_SECRET_KEY;
    if (!secretId || !secretKey) throw new Error('MISSING_TENCENT_CREDENTIALS');
    const { tms } = require('tencentcloud-sdk-nodejs-tms');
    const { ims } = require('tencentcloud-sdk-nodejs-ims');
    const base = { credential: { secretId, secretKey }, region: env.TENCENT_MODERATION_REGION || 'ap-guangzhou' };
    clients = {
      text: new tms.v20201229.Client(base),
      image: new ims.v20201229.Client(base)
    };
    return clients;
  }

  async function imageUrl(value) {
    if (value.startsWith('cloud://')) {
      const result = await cloud.getTempFileURL({ fileList: [value] });
      const item = result && result.fileList && result.fileList[0];
      if (!item || item.status !== 0 || !item.tempFileURL) throw new Error('IMAGE_URL_UNAVAILABLE');
      return item.tempFileURL;
    }
    if (!/^https:\/\//i.test(value)) throw new Error('INVALID_IMAGE_URL');
    return value;
  }

  async function moderate(input = {}) {
    // Safe rollout: existing production behavior stays unchanged until explicitly enabled.
    if (env.CONTENT_MODERATION_MODE !== 'enforce') {
      return { success: true, passed: true, code: 'MODERATION_OFF', message: '审核未启用' };
    }
    const text = collectText(input);
    const images = collectImages(input);
    if (Array.from(text).length > MAX_TEXT_LENGTH || images.length > MAX_IMAGES) {
      return { success: false, passed: false, code: 'CONTENT_TOO_LARGE', message: '内容过长或图片过多，无法完成审核' };
    }
    if (!text && !images.length) return { success: true, passed: true, message: '无待审核内容' };

    try {
      const api = getClients();
      for (const chunk of splitText(text)) {
        const request = { Content: Buffer.from(chunk, 'utf8').toString('base64'), Type: 'TEXT' };
        if (env.TENCENT_TMS_BIZ_TYPE) request.BizType = env.TENCENT_TMS_BIZ_TYPE;
        const result = await api.text.TextModeration(request);
        const failed = responseForSuggestion(result && result.Suggestion, '文本内容', result && result.RequestId);
        if (failed) return failed;
      }
      for (const value of images) {
        const request = { FileUrl: await imageUrl(value) };
        if (env.TENCENT_IMS_BIZ_TYPE) request.BizType = env.TENCENT_IMS_BIZ_TYPE;
        const result = await api.image.ImageModeration(request);
        const failed = responseForSuggestion(result && result.Suggestion, '图片内容', result && result.RequestId);
        if (failed) return failed;
      }
      return { success: true, passed: true, message: '审核通过' };
    } catch (error) {
      console.error('[contentCheck] moderation unavailable:', error.code || error.message);
      return { success: false, passed: false, code: 'MODERATION_UNAVAILABLE', message: '内容审核暂时不可用，请稍后重试' };
    }
  }

  return { moderate };
}

module.exports = { createModerationService, collectText, collectImages, splitText };
