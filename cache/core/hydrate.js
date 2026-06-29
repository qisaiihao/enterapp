/**
 * URL Hydrate 工具
 * 批量将帖子中的 cloud:// URL 转换为可访问的临时 URL
 */

import fileUrlCache from './file-url';

function collectCloudIdsFromPost(post) {
  const out = [];
  const pushIfCloud = (v) => { 
    if (typeof v === 'string' && v.startsWith('cloud://')) out.push(v); 
  };
  pushIfCloud(post.imageUrl);
  pushIfCloud(post.coverImage);
  pushIfCloud(post.originalImageUrl);
  pushIfCloud(post.authorAvatar);
  pushIfCloud(post.authorSignature);
  pushIfCloud(post.poemBgImage);
  if (Array.isArray(post.imageUrls)) post.imageUrls.forEach(pushIfCloud);
  if (Array.isArray(post.originalImageUrls)) post.originalImageUrls.forEach(pushIfCloud);
  return out;
}

/**
 * 批量转换帖子列表中的 cloud:// URL
 * @param {Array} posts - 帖子列表
 * @returns {Promise<Array>} 转换后的帖子列表
 */
export async function hydrateTempUrls(posts = []) {
  if (!Array.isArray(posts) || posts.length === 0) return posts;
  
  const ids = new Set();
  posts.forEach(p => collectCloudIdsFromPost(p).forEach(id => ids.add(id)));
  if (ids.size === 0) return posts;
  
  const map = await fileUrlCache.getTempUrls(Array.from(ids));
  const convert = (v) => (typeof v === 'string' && map[v]) ? map[v] : v;
  
  posts.forEach(p => {
    if (p.imageUrl) p.imageUrl = convert(p.imageUrl);
    if (p.coverImage) p.coverImage = convert(p.coverImage);
    if (p.originalImageUrl) p.originalImageUrl = convert(p.originalImageUrl);
    if (p.authorAvatar) p.authorAvatar = convert(p.authorAvatar);
    if (p.authorSignature) p.authorSignature = convert(p.authorSignature);
    if (p.poemBgImage) p.poemBgImage = convert(p.poemBgImage);
    if (Array.isArray(p.imageUrls)) p.imageUrls = p.imageUrls.map(convert);
    if (Array.isArray(p.originalImageUrls)) p.originalImageUrls = p.originalImageUrls.map(convert);
  });
  
  return posts;
}

/**
 * 预热帖子列表中的 cloud:// URL（异步，不阻塞）
 * @param {Array} posts - 帖子列表
 */
export function warmTempUrlsFromPosts(posts = []) {
  const ids = new Set();
  posts.forEach(p => collectCloudIdsFromPost(p).forEach(id => ids.add(id)));
  if (ids.size > 0) fileUrlCache.warm(Array.from(ids));
}
