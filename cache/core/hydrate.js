/** 将帖子图片交给统一链接缓存解析，保留文件身份以便过期后续期。 */
import fileUrlCache from './file-url';

const FIELDS = ['imageUrl', 'coverImage', 'originalImageUrl', 'authorAvatar', 'authorSignature',
  'poemBgImage', 'imageUrls', 'originalImageUrls'];
const isCloud = value => typeof value === 'string' && value.startsWith('cloud://');
const sameValue = (a, b) => Array.isArray(a) && Array.isArray(b)
  ? a.length === b.length && a.every((value, index) => value === b[index]) : a === b;
const copy = value => Array.isArray(value) ? value.slice() : value;

function sourcesFor(post) {
  if (!post || typeof post !== 'object') return [];
  const stored = post._cloudFileSources || {};
  return FIELDS.map(field => {
    const current = post[field];
    const previous = stored[field];
    // 页面已经换了图片时，以新字段为准，不能用旧文件 ID 将它覆盖。
    const source = previous && (sameValue(current, previous.display) || sameValue(current, previous.source))
      ? previous.source : current;
    return { field, source: copy(source), current: copy(current) };
  });
}

export async function hydrateTempUrls(posts = []) {
  if (!Array.isArray(posts) || posts.length === 0) return posts;
  const entries = posts.filter(post => post && typeof post === 'object').map(post => ({ post, fields: sourcesFor(post) }));
  const ids = new Set();
  entries.forEach(({ fields }) => fields.forEach(({ source }) => {
    (Array.isArray(source) ? source : [source]).filter(isCloud).forEach(id => ids.add(id));
  }));
  if (!ids.size) return posts;
  const map = await fileUrlCache.getTempUrls(Array.from(ids));
  const convert = value => isCloud(value) && map[value] ? map[value] : value;
  entries.forEach(({ post, fields }) => {
    const stored = {};
    fields.forEach(({ field, source, current }) => {
      if (!sameValue(post[field], current)) return;
      if (!(Array.isArray(source) ? source : [source]).some(isCloud)) return;
      const display = Array.isArray(source) ? source.map(convert) : convert(source);
      post[field] = display;
      stored[field] = { source: copy(source), display: copy(display) };
    });
    if (Object.keys(stored).length) post._cloudFileSources = stored;
    else delete post._cloudFileSources;
  });
  return posts;
}

export function warmTempUrlsFromPosts(posts = []) {
  const ids = new Set();
  if (!Array.isArray(posts)) return;
  posts.forEach(post => sourcesFor(post).forEach(({ source }) => {
    (Array.isArray(source) ? source : [source]).filter(isCloud).forEach(id => ids.add(id));
  }));
  if (ids.size) fileUrlCache.warm(Array.from(ids));
}
