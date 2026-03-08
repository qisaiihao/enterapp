import cacheManager from '@/_utils/cache-manager';
const { cloudCall } = require('@/utils/cloudCall.js');
const { callCloudAndUnwrap, getResult } = require('./_shared/cloud-wrapper.js');

// 帖子操作相关缓存
const nsPostActions = cacheManager.namespace('post-actions', { persistent: true, maxItems: 100 });

/**
 * 切换帖子可见性
 */
export async function togglePostVisibility(postId, context) {
  console.log('【profile-actions】切换帖子可见性:', postId);

  const result = await callCloudAndUnwrap(
    'getMyProfileData',
    {
      action: 'togglePostVisibility',
      postId
    },
    {
      pageTag: 'profile:toggle-visibility',
      context,
      requireAuth: true
    },
    '操作失败'
  );

  const { invalidateMyPosts } = require('./my.js');
  invalidateMyPosts();

  return {
    success: true,
    isHidden: result.isHidden
  };
}

/**
 * 删除帖子
 */
export async function deletePost(postId, context) {
  console.log('【profile-actions】删除帖子:', postId);

  await callCloudAndUnwrap(
    'deletePost',
    { postId },
    {
      pageTag: 'profile:delete-post',
      context,
      requireAuth: true
    },
    '删除失败'
  );

  const { invalidateMyPosts } = require('./my.js');
  invalidateMyPosts();

  return { success: true };
}

/**
 * 保存草稿
 */
export async function saveDraft(draftData, context) {
  console.log('【profile-actions】保存草稿:', draftData);

  const result = await callCloudAndUnwrap(
    'getMyProfileData',
    {
      action: 'saveDraft',
      draftData
    },
    {
      pageTag: 'profile:save-draft',
      context,
      requireAuth: true
    },
    '保存草稿失败'
  );

  return {
    success: true,
    draftId: result.draftId
  };
}

/**
 * 获取帖子详情
 */
export async function getPostDetail(postId, context) {
  console.log('【profile-actions】获取帖子详情:', postId);

  const res = await cloudCall('getPostDetail', {
    postId
  }, {
    pageTag: 'profile:post-detail',
    context
  });

  const result = getResult(res);
  if (result.post) {
    return {
      success: true,
      post: result.post
    };
  }

  throw new Error(result.message || '获取帖子详情失败');
}

/**
 * 取消收藏
 */
export async function removeFavorite(favoriteId, context) {
  console.log('【profile-actions】取消收藏:', favoriteId);

  await callCloudAndUnwrap(
    'getMyProfileData',
    {
      action: 'removeFromFavorite',
      favoriteId
    },
    {
      pageTag: 'profile:remove-favorite',
      context,
      requireAuth: true
    },
    '取消收藏失败'
  );

  const { invalidateMyFavorites } = require('./my.js');
  invalidateMyFavorites();

  return { success: true };
}

/**
 * 获取关注者数量
 */
export async function getFollowerCount(context) {
  console.log('【profile-actions】获取关注者数量');

  const result = await callCloudAndUnwrap(
    'follow',
    {
      action: 'getFollowerList',
      skip: 0,
      limit: 1
    },
    {
      pageTag: 'profile:follower-count',
      context,
      requireAuth: true
    },
    '获取关注者数量失败'
  );

  return typeof result.total === 'number' ? result.total : 0;
}

/**
 * 更新用户信息
 */
export async function updateUserInfo(userInfo, context) {
  console.log('【profile-actions】更新用户信息:', userInfo);

  await callCloudAndUnwrap(
    'getMyProfileData',
    {
      action: 'updateUserInfo',
      userInfo
    },
    {
      pageTag: 'profile:update-info',
      context,
      requireAuth: true
    },
    '更新用户信息失败'
  );

  const { invalidateMyInfo } = require('./my.js');
  invalidateMyInfo();

  return { success: true };
}

/**
 * 退出登录
 */
export async function logout(context) {
  console.log('【profile-actions】退出登录');

  const res = await cloudCall('login', {}, {
    pageTag: 'profile:logout',
    context
  });

  const result = getResult(res);
  if (result.openid) {
    const { resetAllCachesOnAccountChange } = require('@/utils/accountCacheReset.js');
    resetAllCachesOnAccountChange();

    return {
      success: true,
      anonymousOpenid: result.openid
    };
  }

  throw new Error('退出登录失败');
}
