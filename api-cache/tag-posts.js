import cacheManager from '@/_utils/cache-manager';
const { cloudCall } = require('@/utils/cloudCall.js');

// 标签页分页：TTL 90s + SWR 45s
// 【优化】统一使用 posts:list 命名空间，实现跨页面缓存复用
const TTL_MS = 90 * 1000;
const SWR_MS = 45 * 1000;

// 使用统一的 posts:list 命名空间，以便与其他页面共享缓存
const ns = cacheManager.namespace('posts:list', { persistent: true, maxItems: 256 });

/**
 * 构建缓存键（与 post-list.js 保持一致）
 * @param {Object} params - 查询参数
 */
function buildCacheKey(params) {
  const { page, pageSize, isPoem, isOriginal, isDiscussion, tag, excludeAnonymous } = params;
  const parts = [];
  
  if (typeof isPoem === 'boolean') parts.push(`poem:${isPoem}`);
  if (typeof isOriginal === 'boolean') parts.push(`orig:${isOriginal}`);
  if (typeof isDiscussion === 'boolean') parts.push(`disc:${isDiscussion}`);
  if (tag) parts.push(`tag:${tag}`);
  if (excludeAnonymous) parts.push('exclAnon:true');
  
  const filterKey = parts.length > 0 ? parts.join(':') : 'all';
  return `page:${page}:size:${pageSize}:${filterKey}`;
}

/**
 * 获取标签帖子列表（复用统一缓存）
 * @param {Object} options
 * @param {string} options.tag - 标签名称
 * @param {number} options.page - 页码，从0开始
 * @param {number} options.pageSize - 每页数量
 * @param {Object} options.context - 页面上下文
 */
export async function getTagPosts({ tag, page = 0, pageSize = 10, context } = {}) {
  // 构建统一的缓存键（包含 tag 参数）
  const key = buildCacheKey({ page, pageSize, tag });
  
  console.log('🔍 [tag-posts] 请求数据 - tag:', tag, 'key:', key);
  
  return ns.getOrFetch(
    key,
    async () => {
      console.log('🔍 [tag-posts] 缓存未命中，调用云函数 - tag:', tag);
      const res = await cloudCall(
        'getPostList',
        { skip: page * pageSize, limit: pageSize, tag },
        { pageTag: `tag:${tag}`, context }
      );
      console.log('🔍 [tag-posts] 云函数返回 - success:', res?.result?.success, 'posts数量:', res?.result?.posts?.length);
      if (res && res.result && res.result.success) {
        return res.result.posts || [];
      }
      return [];
    },
    { ttlMs: TTL_MS, swrMs: SWR_MS }
  );
}

/**
 * 清除标签帖子列表缓存
 * @param {Object} options
 * @param {string} options.tag - 标签名称
 * @param {number} options.page - 页码，如果指定则只清除该页的缓存
 * @param {number} options.pageSize - 每页数量
 */
export function invalidateTagPosts({ tag, page, pageSize = 10 } = {}) {
  if (typeof page === 'number') {
    // 清除特定标签的特定页缓存
    const key = buildCacheKey({ page, pageSize, tag });
    ns.delete(key);
    console.log(`🔍 [tag-posts] 清除缓存 - key: ${key}`);
  } else {
    // 清除所有匹配标签的缓存
    const prefix = buildCacheKey({ page: 0, pageSize, tag });
    const prefixWithoutPage = prefix.replace(/^page:\d+:size:/, '');
    const keys = ns.keys();
    keys.forEach(k => {
      if (k.includes(prefixWithoutPage)) {
        ns.delete(k);
      }
    });
    console.log(`🔍 [tag-posts] 清除缓存 - prefix: ${prefixWithoutPage}, 清除数量: ${keys.filter(k => k.includes(prefixWithoutPage)).length}`);
  }
}

