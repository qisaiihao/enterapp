/**
 * 我的点赞相关API缓存层
 */
import cacheManager from '@/cache/core/manager.js';
import { cloudCall } from '../utils/cloudCall.js';

// 使用独立的 myLikes 命名空间
const ns = cacheManager.namespace('myLikes', { persistent: true, maxItems: 64 });

/**
 * 获取我的点赞帖子列表
 * @param {Object} options - 查询选项
 * @param {number} options.page - 页码，从0开始
 * @param {number} options.pageSize - 每页数量
 * @param {boolean} options.forceRefresh - 是否强制刷新
 * @param {Object} options.context - 页面上下文
 * @returns {Promise} 点赞帖子列表
 */
async function getMyLikedPosts({
  page = 0,
  pageSize = 10,
  forceRefresh = false,
  context
} = {}) {
  // 构建缓存键
  const key = `page:${page}:size:${pageSize}`;

  console.log('🔍 [myLikes] 请求数据 - key:', key, 'forceRefresh:', forceRefresh);

  if (forceRefresh && page === 0) {
    ns.delete(key);
  }

  return ns.getOrFetch(
    key,
    async () => {
      console.log('🔍 [myLikes] 缓存未命中，调用云函数 - key:', key);
      const res = await cloudCall(
        'getMyLikedPosts',
        {
          skip: page * pageSize,
          limit: pageSize
        },
        { pageTag: 'my-likes', context, requireAuth: true }
      );
      console.log('🔍 [myLikes] 云函数返回 - success:', res?.result?.success, 'posts数量:', res?.result?.posts?.length);
      if (res && res.result && res.result.success) {
        return res.result.posts || [];
      }
      return [];
    },
    { ttlMs: 2 * 60 * 1000, swrMs: 30 * 1000 } // 2分钟TTL，30秒SWR
  );
}

/**
 * 清除我的点赞帖子列表缓存
 * @param {Object} options - 清除选项
 * @param {number} options.page - 页码，如果指定则只清除该页的缓存
 * @param {number} options.pageSize - 每页数量
 */
function invalidateMyLikedPosts({ page, pageSize = 10 } = {}) {
  if (typeof page === 'number') {
    // 清除特定页的缓存
    const key = `page:${page}:size:${pageSize}`;
    ns.delete(key);
    console.log(`🔍 [myLikes] 清除缓存 - key: ${key}`);
  } else {
    // 清除所有缓存
    ns.clear();
    console.log(`🔍 [myLikes] 清除所有缓存`);
  }
}

/**
 * 取消点赞帖子
 * @param {string} postId - 帖子ID
 * @param {Object} options - 额外选项
 * @returns {Promise} 操作结果
 */
function unlikePost(postId, options = {}) {
  if (!postId) {
    return Promise.reject(new Error('帖子ID不能为空'));
  }

  return cloudCall('unlikePost', {
    postId: postId
  }, Object.assign({
    pageTag: 'my-likes',
    requireAuth: true,
    ...options
  }));
}

/**
 * 批量取消点赞
 * @param {Array} postIds - 帖子ID数组
 * @param {Object} options - 额外选项
 * @returns {Promise} 操作结果
 */
function batchUnlikePosts(postIds, options = {}) {
  if (!Array.isArray(postIds) || postIds.length === 0) {
    return Promise.reject(new Error('帖子ID数组不能为空'));
  }

  return cloudCall('batchUnlikePosts', {
    postIds: postIds
  }, Object.assign({
    pageTag: 'my-likes',
    requireAuth: true,
    ...options
  }));
}

/**
 * 获取点赞统计信息
 * @param {Object} options - 额外选项
 * @returns {Promise} 统计信息
 */
function getLikeStats(options = {}) {
  return cloudCall('getLikeStats', {}, Object.assign({
    pageTag: 'my-likes',
    requireAuth: true,
    ...options
  }));
}

const myLikesApi = {
  getMyLikedPosts,
  invalidateMyLikedPosts,
  unlikePost,
  batchUnlikePosts,
  getLikeStats
};

export {
  getMyLikedPosts,
  invalidateMyLikedPosts,
  unlikePost,
  batchUnlikePosts,
  getLikeStats
};

export default myLikesApi;

if (typeof module !== 'undefined' && module.exports) {
  module.exports = myLikesApi;
  module.exports.default = myLikesApi;
}
