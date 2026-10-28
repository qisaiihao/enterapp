// Copy into each cloud function package with scripts/sync-moderation-gate.cjs.
const MAX_IMAGES = 9;
const IMAGES_PER_REQUEST = 3;
const IMAGE_KEYS = ['images', 'fileIDs', 'imageUrls', 'originalImageUrls', 'imageUrl', 'seriesCoverImage'];

function splitContent(content = {}) {
  const images = [];
  const addImage = value => {
    if (typeof value === 'string' && value.trim()) images.push(value.trim());
  };
  const text = { ...content };
  for (const key of IMAGE_KEYS) {
    const value = content[key];
    if (Array.isArray(value)) value.forEach(addImage);
    else addImage(value);
    delete text[key];
  }
  // These aliases must not leak into the text-only subrequest either.
  for (const key of ['originalFileIDs', 'originalImageUrl', 'poemBgImage', 'type']) delete text[key];
  if (Array.isArray(content.seriesBlocks)) {
    text.seriesBlocks = content.seriesBlocks.map(block => {
      if (!block || typeof block !== 'object') return block;
      addImage(block.imageUrl);
      const value = { ...block };
      delete value.imageUrl;
      return value;
    });
  }
  return { text, images: [...new Set(images)] };
}

function hasText(content) {
  const present = value => typeof value === 'string' ? Boolean(value.trim())
    : Array.isArray(value) && value.some(present);
  if (['title', 'content', 'text', 'author', 'nickname', 'signature', 'anonymousAuthorName',
    'highlightSentence', 'seriesCoverHighlight', 'highlightLines', 'tags'].some(key => present(content[key]))) return true;
  const groups = [
    ...(Array.isArray(content.sentenceGroups) ? content.sentenceGroups : []),
    ...(Array.isArray(content.discussionSentences) ? content.discussionSentences : [])
  ];
  if (groups.some(group => group && (present(group.comment) || present(group.sentences)))) return true;
  return (Array.isArray(content.seriesBlocks) ? content.seriesBlocks : []).some(block => block
    && ['subtitle', 'content', 'highlightSentence', 'highlightLines'].some(key => present(block[key])));
}

function failureForAudit(audit) {
  const failure = {
    success: false,
    code: (audit && audit.code) || 'MODERATION_UNAVAILABLE',
    message: (audit && audit.message) || '内容审核暂时不可用，请稍后重试'
  };
  for (const key of ['passed', 'failedType', 'suggestion', 'requestId']) {
    if (audit && audit[key] !== undefined) failure[key] = audit[key];
  }
  return failure;
}

async function moderateBeforeWrite(cloud, content = {}) {
  const { text, images } = splitContent(content);
  if (images.length > MAX_IMAGES) {
    return { success: false, passed: false, code: 'CONTENT_TOO_LARGE', message: '内容过长或图片过多，无法完成审核' };
  }
  try {
    const requests = [];
    // All text stays in one request so contentCheck enforces its whole-text limit.
    // Override type after spreading content to prevent recursive batch dispatch.
    if (hasText(text)) requests.push({ ...text, type: 'text' });
    for (let offset = 0; offset < images.length; offset += IMAGES_PER_REQUEST) {
      requests.push({ type: 'image', images: images.slice(offset, offset + IMAGES_PER_REQUEST) });
    }
    for (const data of requests) {
      // Each request can outlast contentCheck's 60-second limit; otherwise the SDK
      // defaults to 15s. The outer function must allow time for every batch and writes.
      const response = await cloud.callFunction({ name: 'contentCheck', data, timeout: 70000 });
      const audit = response && (response.result || response);
      if (!audit || audit.success !== true || audit.passed !== true) return failureForAudit(audit);
    }
    return null;
  } catch (error) {
    console.error('[moderation] cloud function unavailable:', error.code || error.message);
    return { success: false, code: 'MODERATION_UNAVAILABLE', message: '内容审核暂时不可用，请稍后重试' };
  }
}

module.exports = { moderateBeforeWrite };
