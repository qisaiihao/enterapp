/**
 * 帖子相关 API 缓存层
 */
import cacheManager from '@/cache/core/manager';
import {
  callCloudAndGetResult,
  callCloudAndUnwrap,
  isSuccessResult
} from './_shared/cloud-wrapper.js';

// 帖子详情缓存：TTL 2min + SWR 1min
const POST_DETAIL_TTL = 2 * 60 * 1000;
const POST_DETAIL_SWR = 60 * 1000;

const nsDetail = cacheManager.namespace('posts:detail', { persistent: true, maxItems: 200 });

function normalizePostDetailResult(result = {}) {
  if (!result.post) {
    throw new Error(result.error || result.message || '获取帖子详情失败');
  }
  return {
    post: result.post,
    commentCount: typeof result.commentCount === 'number'
      ? result.commentCount
      : (result.post.commentCount || 0),
    comments: Array.isArray(result.comments) ? result.comments : []
  };
}

function buildUpdatePayload(postId, updateData) {
  if (updateData && typeof updateData === 'object' && updateData.data && typeof updateData.data === 'object') {
    return {
      postId,
      data: updateData.data
    };
  }
  return {
    postId,
    ...(updateData || {})
  };
}

/**
 * 获取帖子详情（带缓存）
 * @param {string} postId 帖子 ID
 * @param {Object} options 调用选项
 * @returns {Promise<{post:Object, commentCount:number, comments:Array}>}
 */
async function getPostDetail(postId, options = {}) {
  if (!postId) {
    throw new Error('帖子ID不能为空');
  }

  const { forceRefresh = false, ...cloudOptions } = options;
  if (forceRefresh) {
    nsDetail.delete(postId);
  }

  return nsDetail.getOrFetch(
    postId,
    async () => {
      const result = await callCloudAndGetResult(
        'getPostDetail',
        { postId },
        Object.assign({
          injectOpenId: false,
          pageTag: 'post-detail'
        }, cloudOptions)
      );
      return normalizePostDetailResult(result);
    },
    { ttlMs: POST_DETAIL_TTL, swrMs: POST_DETAIL_SWR }
  );
}

/**
 * 从列表缓存预填充帖子详情
 * @param {Object} postFromList 列表中的帖子对象
 */
function prefillPostDetail(postFromList) {
  if (!postFromList || !postFromList._id) {
    return;
  }
  const postId = postFromList._id;
  const existing = nsDetail.get(postId);
  if (!existing) {
    nsDetail.set(postId, {
      post: { ...postFromList, _partialFromList: true },
      commentCount: postFromList.commentCount || 0,
      comments: []
    }, { ttlMs: 30 * 1000 });
  }
}

/**
 * 失效帖子详情缓存
 * @param {string} postId 帖子 ID
 */
function invalidatePostDetail(postId) {
  if (postId) {
    nsDetail.delete(postId);
  }
}

function syncPostDetailCommentCount(postId, commentCount) {
  if (!postId || typeof commentCount !== 'number') {
    return false;
  }

  return nsDetail.update(postId, (detail) => {
    if (!detail || typeof detail !== 'object') {
      return detail;
    }

    const nextPost = detail.post && typeof detail.post === 'object'
      ? { ...detail.post, commentCount }
      : detail.post;

    return {
      ...detail,
      post: nextPost,
      commentCount
    };
  });
}

/**
 * 更新帖子内容
 * @param {string} postId 帖子 ID
 * @param {Object} updateData 更新数据
 * @param {Object} options 调用选项
 * @returns {Promise<Object>}
 */
async function updatePostContent(postId, updateData, options = {}) {
  if (!postId) {
    throw new Error('帖子ID不能为空');
  }
  if (!updateData || Object.keys(updateData).length === 0) {
    throw new Error('更新数据不能为空');
  }

  const result = await callCloudAndUnwrap(
    'updatePostContent',
    buildUpdatePayload(postId, updateData),
    Object.assign({
      pageTag: 'post-detail',
      requireAuth: true
    }, options),
    '更新失败'
  );

  invalidatePostDetail(postId);
  return result;
}

/**
 * 删除帖子
 * @param {string} postId 帖子 ID
 * @param {Object} options 调用选项
 * @returns {Promise<Object>}
 */
async function deletePost(postId, options = {}) {
  if (!postId) {
    throw new Error('帖子ID不能为空');
  }
  const result = await callCloudAndUnwrap(
    'deletePost',
    { postId },
    Object.assign({
      pageTag: 'post-detail',
      requireAuth: true
    }, options),
    '删除失败'
  );
  invalidatePostDetail(postId);
  return result;
}

/**
 * 收藏/取消收藏帖子
 * @param {string} postId 帖子 ID
 * @param {boolean} isFavorite 是否收藏
 * @param {Object} options 调用选项
 * @returns {Promise<Object>}
 */
async function togglePostFavorite(postId, isFavorite, options = {}) {
  if (!postId) {
    throw new Error('帖子ID不能为空');
  }
  return callCloudAndUnwrap(
    'togglePostFavorite',
    { postId, isFavorite },
    Object.assign({
      pageTag: 'post-detail',
      requireAuth: true
    }, options),
    '操作失败'
  );
}

/**
 * 记录浏览（保持容错，失败不抛错）
 * @param {string} postId 帖子 ID
 * @param {Object} options 调用选项
 * @returns {Promise<Object>}
 */
async function recordPostView(postId, options = {}) {
  if (!postId) {
    throw new Error('帖子ID不能为空');
  }

  const result = await callCloudAndGetResult(
    'recordView',
    {
      postId,
      timestamp: Date.now()
    },
    Object.assign({
      pageTag: 'post-detail',
      injectOpenId: false,
      silent: true
    }, options)
  );

  return isSuccessResult(result) ? result : { success: false };
}

/**
 * 批量获取帖子
 * @param {Array<string>} postIds 帖子 ID 列表
 * @param {Object} options 调用选项
 * @returns {Promise<Object>}
 */
async function batchGetPosts(postIds, options = {}) {
  if (!Array.isArray(postIds) || postIds.length === 0) {
    throw new Error('帖子ID数组不能为空');
  }

  return callCloudAndUnwrap(
    'batchGetPosts',
    { postIds },
    Object.assign({
      pageTag: 'post-detail',
      injectOpenId: false
    }, options),
    '获取帖子失败'
  );
}

/**
 * 获取相关推荐帖子
 * @param {string} postId 帖子 ID
 * @param {Object} options 调用选项
 * @returns {Promise<Array>}
 */
async function getRelatedPosts(postId, options = {}) {
  if (!postId) {
    throw new Error('帖子ID不能为空');
  }

  const result = await callCloudAndUnwrap(
    'getRelatedPosts',
    { postId },
    Object.assign({
      pageTag: 'post-detail',
      injectOpenId: false
    }, options),
    '获取相关推荐失败'
  );

  return Array.isArray(result.posts) ? result.posts : [];
}

const postApi = {
  getPostDetail,
  prefillPostDetail,
  invalidatePostDetail,
  syncPostDetailCommentCount,
  updatePostContent,
  deletePost,
  togglePostFavorite,
  recordPostView,
  batchGetPosts,
  getRelatedPosts
};

export {
  getPostDetail,
  prefillPostDetail,
  invalidatePostDetail,
  syncPostDetailCommentCount,
  updatePostContent,
  deletePost,
  togglePostFavorite,
  recordPostView,
  batchGetPosts,
  getRelatedPosts
};

export default postApi;

if (typeof module !== 'undefined' && module.exports) {
  module.exports = postApi;
  module.exports.default = postApi;
}
