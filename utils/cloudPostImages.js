import { hydrateTempUrls } from '@/cache/core/hydrate.js';

const RAW_IMAGE_FUNCTIONS = new Set([
  'getPostList', 'getHotFeed', 'getFollowingPosts', 'getDiscussionPosts', 'getRecommendationFeed'
]);

export function prepareCloudPostImages(name, payload) {
  // 1.7.0 不发送此能力参数，服务端继续返回 HTTPS。显式 false 可用于回退。
  if (RAW_IMAGE_FUNCTIONS.has(name) && payload.rawImages !== false) payload.rawImages = true;
}

export async function resolveCloudPostImages(name, response) {
  if (!RAW_IMAGE_FUNCTIONS.has(name)) return response;
  const result = response && (response.result || response);
  if (result && result.success && Array.isArray(result.posts)) await hydrateTempUrls(result.posts);
  return response;
}
