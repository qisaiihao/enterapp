import fileUrlCache from './file-url-cache';

function collectCloudIdsFromPost(post) {
  const out = [];
  const pushIfCloud = (v) => { if (typeof v === 'string' && v.startsWith('cloud://')) out.push(v); };
  pushIfCloud(post.imageUrl);
  pushIfCloud(post.originalImageUrl);
  pushIfCloud(post.authorAvatar);
  pushIfCloud(post.poemBgImage);
  if (Array.isArray(post.imageUrls)) post.imageUrls.forEach(pushIfCloud);
  if (Array.isArray(post.originalImageUrls)) post.originalImageUrls.forEach(pushIfCloud);
  return out;
}

export async function hydrateTempUrls(posts = []) {
  if (!Array.isArray(posts) || posts.length === 0) return posts;
  const ids = new Set();
  posts.forEach(p => collectCloudIdsFromPost(p).forEach(id => ids.add(id)));
  if (ids.size === 0) return posts;
  const map = await fileUrlCache.getTempUrls(Array.from(ids));
  const convert = (v) => (typeof v === 'string' && map[v]) ? map[v] : v;
  posts.forEach(p => {
    if (p.imageUrl) p.imageUrl = convert(p.imageUrl);
    if (p.originalImageUrl) p.originalImageUrl = convert(p.originalImageUrl);
    if (p.authorAvatar) p.authorAvatar = convert(p.authorAvatar);
    if (p.poemBgImage) p.poemBgImage = convert(p.poemBgImage);
    if (Array.isArray(p.imageUrls)) p.imageUrls = p.imageUrls.map(convert);
    if (Array.isArray(p.originalImageUrls)) p.originalImageUrls = p.originalImageUrls.map(convert);
  });
  return posts;
}

export function warmTempUrlsFromPosts(posts = []) {
  const ids = new Set();
  posts.forEach(p => collectCloudIdsFromPost(p).forEach(id => ids.add(id)));
  if (ids.size > 0) fileUrlCache.warm(Array.from(ids));
}

