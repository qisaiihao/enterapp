import { cloudCall } from '@/utils/cloudCall.js';
import { resetAllCachesOnAccountChange } from '@/utils/accountCacheReset.js';
import { callCloudAndUnwrap, getResult } from './_shared/cloud-wrapper.js';
import {
  invalidateMyFavorites,
  invalidateMyInfo,
  invalidateMyPosts
} from './my.js';

export async function togglePostVisibility(postId, context) {
  console.log('[profile-actions] toggle post visibility', postId);

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
    'Toggle post visibility failed'
  );

  invalidateMyPosts();

  return {
    success: true,
    isHidden: result.isHidden
  };
}

export async function deletePost(postId, context) {
  console.log('[profile-actions] delete post', postId);

  await callCloudAndUnwrap(
    'deletePost',
    { postId },
    {
      pageTag: 'profile:delete-post',
      context,
      requireAuth: true
    },
    'Delete post failed'
  );

  invalidateMyPosts();

  return { success: true };
}

export async function saveDraft(draftData, context) {
  console.log('[profile-actions] save draft', draftData);

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
    'Save draft failed'
  );

  return {
    success: true,
    draftId: result.draftId
  };
}

export async function getPostDetail(postId, context) {
  console.log('[profile-actions] get post detail', postId);

  const res = await cloudCall(
    'getPostDetail',
    { postId },
    {
      pageTag: 'profile:post-detail',
      context
    }
  );

  const result = getResult(res);
  if (result.post) {
    return {
      success: true,
      post: result.post
    };
  }

  throw new Error(result.message || 'Get post detail failed');
}

export async function removeFavorite(favoriteId, context) {
  console.log('[profile-actions] remove favorite', favoriteId);

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
    'Remove favorite failed'
  );

  invalidateMyFavorites();

  return { success: true };
}

export async function getFollowerCount(context) {
  console.log('[profile-actions] get follower count');

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
    'Get follower count failed'
  );

  return typeof result.total === 'number' ? result.total : 0;
}

export async function updateUserInfo(userInfo, context) {
  console.log('[profile-actions] update user info', userInfo);

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
    'Update user info failed'
  );

  invalidateMyInfo();

  return { success: true };
}

export async function logout(context) {
  console.log('[profile-actions] logout');

  const res = await cloudCall(
    'login',
    {},
    {
      pageTag: 'profile:logout',
      context
    }
  );

  const result = getResult(res);
  if (result.openid) {
    resetAllCachesOnAccountChange();

    return {
      success: true,
      anonymousOpenid: result.openid
    };
  }

  throw new Error('Logout failed');
}
