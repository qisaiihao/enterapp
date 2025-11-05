import cacheManager from '@/_utils/cache-manager';
const { cloudCall } = require('@/utils/cloudCall.js');

// 消息列表缓存：TTL 90s + SWR 45s
// 消息需要一定的实时性，但可以接受短期缓存
const TTL_MS = 90 * 1000;  // 90秒过期
const SWR_MS = 45 * 1000;  // 45秒后台刷新

const ns = cacheManager.namespace('messages', { persistent: true, maxItems: 64 });

/**
 * 获取消息列表（带缓存）
 * @param {Object} options
 * @param {number} options.page - 页码，从0开始
 * @param {number} options.pageSize - 每页数量
 * @param {string} options.type - 消息类型：'like' | 'comment' | 'favorite' | 'follow' | null (全部)
 * @param {Object} options.context - 页面上下文
 * @param {boolean} options.forceRefresh - 是否强制刷新（跳过缓存）
 */
export async function getMessages({ page = 0, pageSize = 10, type = null, context, forceRefresh = false } = {}) {
  // 构建缓存键：包含类型和分页信息
  const typeKey = type || 'all';
  const cacheKeySuffix = (page === 0 && forceRefresh) ? `:ts:${Date.now()}` : '';
  const key = `type:${typeKey}:page:${page}:size:${pageSize}${cacheKeySuffix}`;
  
  console.log('🔍 [messages-cache] 请求数据 - type:', typeKey, 'page:', page, 'pageSize:', pageSize, 'forceRefresh:', forceRefresh, 'key:', key);
  
  // 第一页且强制刷新时，跳过缓存直接调用云函数
  if (page === 0 && forceRefresh) {
    console.log('🔍 [messages-cache] 第一页强制刷新，跳过缓存直接调用云函数');
    const res = await cloudCall(
      'getMessages',
      { skip: page * pageSize, limit: pageSize, type: type || null },
      { pageTag: 'messages', context, requireAuth: true }
    );
    if (res && res.result && res.result.success) {
      return {
        messages: res.result.messages || [],
        unreadCount: res.result.unreadCount || 0,
        totalCount: res.result.totalCount || 0
      };
    }
    return {
      messages: [],
      unreadCount: 0,
      totalCount: 0
    };
  }
  
  // 使用缓存
  return ns.getOrFetch(
    key,
    async () => {
      console.log('🔍 [messages-cache] 缓存未命中，调用云函数 - type:', typeKey, 'page:', page);
      const res = await cloudCall(
        'getMessages',
        { skip: page * pageSize, limit: pageSize, type: type || null },
        { pageTag: 'messages', context, requireAuth: true }
      );
      console.log('🔍 [messages-cache] 云函数返回 - success:', res?.result?.success, 'messages数量:', res?.result?.messages?.length);
      if (res && res.result && res.result.success) {
        return {
          messages: res.result.messages || [],
          unreadCount: res.result.unreadCount || 0,
          totalCount: res.result.totalCount || 0
        };
      }
      return {
        messages: [],
        unreadCount: 0,
        totalCount: 0
      };
    },
    { ttlMs: TTL_MS, swrMs: SWR_MS }
  );
}

/**
 * 清除消息缓存
 * @param {Object} options
 * @param {string} options.type - 消息类型，如果指定则只清除该类型的缓存
 * @param {number} options.page - 页码，如果指定则只清除该页的缓存
 */
export function invalidateMessages({ type, page, pageSize = 10 } = {}) {
  if (typeof type === 'string') {
    const typeKey = type || 'all';
    if (typeof page === 'number') {
      // 清除特定类型和页码的缓存
      ns.delete(`type:${typeKey}:page:${page}:size:${pageSize}`);
      console.log(`🔍 [messages-cache] 清除缓存 - type:${typeKey}, page:${page}`);
    } else {
      // 清除该类型的所有分页缓存
      const keys = ns.keys();
      keys.forEach(k => {
        if (k.startsWith(`type:${typeKey}:page:`)) {
          ns.delete(k);
        }
      });
      console.log(`🔍 [messages-cache] 清除缓存 - type:${typeKey}, 所有分页`);
    }
  } else {
    // 清除所有消息缓存
    ns.clear();
    console.log('🔍 [messages-cache] 清除所有消息缓存');
  }
}

