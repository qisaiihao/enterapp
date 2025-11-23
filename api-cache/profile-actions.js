import cacheManager from '@/_utils/cache-manager';
const { cloudCall } = require('@/utils/cloudCall.js');

// 帖子操作相关缓存
const nsPostActions = cacheManager.namespace('post-actions', { persistent: true, maxItems: 100 });

/**
 * 切换帖子可见性
 * @param {string} postId - 帖子ID
 * @param {Object} context - 页面上下文
 * @returns {Promise<Object>}
 */
export async function togglePostVisibility(postId, context) {
  console.log('【profile-actions】切换帖子可见性:', postId);

  const res = await cloudCall('getMyProfileData', {
    action: 'togglePostVisibility',
    postId: postId
  }, {
    pageTag: 'profile:toggle-visibility',
    context,
    requireAuth: true
  });

  if (res && res.result && res.result.success) {
    // 清除相关缓存
    const { invalidateMyPosts } = require('./my.js');
    invalidateMyPosts();

    return {
      success: true,
      isHidden: res.result.isHidden
    };
  }

  throw new Error(res?.result?.message || '操作失败');
}

/**
 * 删除帖子
 * @param {string} postId - 帖子ID
 * @param {Object} context - 页面上下文
 * @returns {Promise<Object>}
 */
export async function deletePost(postId, context) {
  console.log('【profile-actions】删除帖子:', postId);

  const res = await cloudCall('deletePost', {
    postId: postId
  }, {
    pageTag: 'profile:delete-post',
    context,
    requireAuth: true
  });

  if (res && res.result && res.result.success) {
    // 清除相关缓存
    const { invalidateMyPosts } = require('./my.js');
    invalidateMyPosts();

    return { success: true };
  }

  throw new Error(res?.result?.message || '删除失败');
}

/**
 * 保存草稿
 * @param {Object} draftData - 草稿数据
 * @param {Object} context - 页面上下文
 * @returns {Promise<Object>}
 */
export async function saveDraft(draftData, context) {
  console.log('【profile-actions】保存草稿:', draftData);

  const res = await cloudCall('getMyProfileData', {
    action: 'saveDraft',
    draftData: draftData
  }, {
    pageTag: 'profile:save-draft',
    context,
    requireAuth: true
  });

  if (res && res.result && res.result.success) {
    return {
      success: true,
      draftId: res.result.draftId
    };
  }

  throw new Error(res?.result?.message || '保存草稿失败');
}

/**
 * 获取帖子详情
 * @param {string} postId - 帖子ID
 * @param {Object} context - 页面上下文
 * @returns {Promise<Object>}
 */
export async function getPostDetail(postId, context) {
  console.log('【profile-actions】获取帖子详情:', postId);

  const res = await cloudCall('getPostDetail', {
    postId: postId
  }, {
    pageTag: 'profile:post-detail',
    context
  });

  if (res && res.result && res.result.post) {
    return {
      success: true,
      post: res.result.post
    };
  }

  throw new Error(res?.result?.message || '获取帖子详情失败');
}

/**
 * 取消收藏
 * @param {string} favoriteId - 收藏ID
 * @param {Object} context - 页面上下文
 * @returns {Promise<Object>}
 */
export async function removeFavorite(favoriteId, context) {
  console.log('【profile-actions】取消收藏:', favoriteId);

  const res = await cloudCall('getMyProfileData', {
    action: 'removeFromFavorites',
    favoriteId: favoriteId
  }, {
    pageTag: 'profile:remove-favorite',
    context,
    requireAuth: true
  });

  if (res && res.result && res.result.success) {
    // 清除相关缓存
    const { invalidateMyFavorites } = require('./my.js');
    invalidateMyFavorites();

    return { success: true };
  }

  throw new Error(res?.result?.message || '取消收藏失败');
}

/**
 * 获取关注者数量
 * @param {Object} context - 页面上下文
 * @returns {Promise<number>}
 */
export async function getFollowerCount(context) {
  console.log('【profile-actions】获取关注者数量');

  const res = await cloudCall('follow', {
    action: 'getFollowerList',
    skip: 0,
    limit: 1
  }, {
    pageTag: 'profile:follower-count',
    context,
    requireAuth: true
  });

  if (res && res.result && typeof res.result.total === 'number') {
    return res.result.total;
  }

  return 0;
}

/**
 * 更新用户信息
 * @param {Object} userInfo - 用户信息
 * @param {Object} context - 页面上下文
 * @returns {Promise<Object>}
 */
export async function updateUserInfo(userInfo, context) {
  console.log('【profile-actions】更新用户信息:', userInfo);

  const res = await cloudCall('getMyProfileData', {
    action: 'updateUserInfo',
    userInfo: userInfo
  }, {
    pageTag: 'profile:update-info',
    context,
    requireAuth: true
  });

  if (res && res.result && res.result.success) {
    // 清除用户信息缓存
    const { invalidateMyInfo } = require('./my.js');
    invalidateMyInfo();

    return { success: true };
  }

  throw new Error(res?.result?.message || '更新用户信息失败');
}

/**
 * 退出登录
 * @param {Object} context - 页面上下文
 * @returns {Promise<Object>}
 */
export async function logout(context) {
  console.log('【profile-actions】退出登录');

  const res = await cloudCall('login', {}, {
    pageTag: 'profile:logout',
    context
  });

  if (res && res.result && res.result.openid) {
    // 重置所有缓存
    const { resetAllCachesOnAccountChange } = require('@/utils/accountCacheReset.js');
    resetAllCachesOnAccountChange();

    return {
      success: true,
      anonymousOpenid: res.result.openid
    };
  }

  throw new Error('退出登录失败');
}