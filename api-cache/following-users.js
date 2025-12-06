import cacheManager from '@/_utils/cache-manager';
const { cloudCall } = require('@/utils/cloudCall.js');

// 关注用户列表：TTL 5分钟 + SWR 2分钟
const TTL_MS = 5 * 60 * 1000;
const SWR_MS = 2 * 60 * 1000;

// 使用独立的 following:users 命名空间
const ns = cacheManager.namespace('following:users', { persistent: true, maxItems: 32 });

/**
 * 获取关注用户列表（按最近发帖时间排序）
 * @param {Object} options
 * @param {number} options.limit - 最大数量
 * @param {Object} options.context - 页面上下文
 * @param {boolean} options.forceRefresh - 是否强制刷新
 * @param {Function} options.onBackgroundUpdate - SWR后台更新回调
 */
async function getFollowingUsers({
  limit = 50,
  context,
  forceRefresh = false,
  onBackgroundUpdate
} = {}) {
  const key = `following-users:limit:${limit}`;

  console.log('🔍 [following-users] 请求数据 - key:', key, 'forceRefresh:', forceRefresh);

  // 强制刷新时跳过缓存
  if (forceRefresh) {
    console.log('🔍 [following-users] 强制刷新，跳过缓存');
    const res = await cloudCall(
      'getFollowingUsersWithUpdate',
      { limit },
      { pageTag: 'following', context, requireAuth: true }
    );
    console.log('🔍 [following-users] 云函数返回 - success:', res?.result?.success, 'users数量:', res?.result?.users?.length);
    if (res && res.result && res.result.success) {
      return res.result.users || [];
    }
    return [];
  }

  // 使用缓存
  return ns.getOrFetch(
    key,
    async () => {
      console.log('🔍 [following-users] 缓存未命中，调用云函数');
      const res = await cloudCall(
        'getFollowingUsersWithUpdate',
        { limit },
        { pageTag: 'following', context, requireAuth: true }
      );
      console.log('🔍 [following-users] 云函数返回 - success:', res?.result?.success, 'users数量:', res?.result?.users?.length);
      if (res && res.result && res.result.success) {
        return res.result.users || [];
      }
      return [];
    },
    { 
      ttlMs: TTL_MS, 
      swrMs: SWR_MS,
      onBackgroundUpdate
    }
  );
}

/**
 * 清除关注用户列表缓存
 */
function invalidateFollowingUsers() {
  ns.clear();
  console.log('🔍 [following-users] 清除所有缓存');
}

module.exports = {
  getFollowingUsers,
  invalidateFollowingUsers
};
