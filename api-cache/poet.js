/**
 * 诗人相关 API 缓存层
 */
import cacheManager from '@/cache/core/manager.js';
import { uploadFile } from '@/utils/uploader.js';
import { callCloudAndUnwrap } from './_shared/cloud-wrapper.js';

// 诗人信息缓存：TTL 10min + SWR 5min
const POET_INFO_TTL = 10 * 60 * 1000;
const POET_INFO_SWR = 5 * 60 * 1000;
const nsPoetInfo = cacheManager.namespace('poet:info', { persistent: true, maxItems: 500 });

// 诗人列表缓存
const POET_LIST_TTL = 10 * 60 * 1000;
const POET_LIST_SWR = 5 * 60 * 1000;
const nsPoetList = cacheManager.namespace('poet:list', { persistent: true, maxItems: 100 });

export async function getPoetList({ limit = 50, context, onBackgroundUpdate } = {}) {
  const key = `list:${limit}`;
  return nsPoetList.getOrFetch(
    key,
    async () => {
      const result = await callCloudAndUnwrap(
        'getPoetList',
        { limit },
        { pageTag: 'poet:list', context, injectOpenId: true },
        '加载诗人列表失败'
      );
      return result.poets || [];
    },
    {
      ttlMs: POET_LIST_TTL,
      swrMs: POET_LIST_SWR,
      onBackgroundUpdate
    }
  );
}

export function invalidatePoetList() {
  nsPoetList.clear();
}

export async function getPoetInfo(poetName, context) {
  if (!poetName) {
    return { name: '', avatar: '', bio: '' };
  }

  const trimmedName = poetName.trim();
  const key = encodeURIComponent(trimmedName);
  return nsPoetInfo.getOrFetch(
    key,
    async () => {
      const result = await callCloudAndUnwrap(
        'getPoetInfo',
        { poetName: trimmedName },
        { pageTag: 'poet-profile:info', context, injectOpenId: true },
        '加载诗人信息失败'
      );
      return result.poetInfo || { name: trimmedName, avatar: '', bio: '' };
    },
    { ttlMs: POET_INFO_TTL, swrMs: POET_INFO_SWR }
  );
}

export function invalidatePoetInfo(poetName) {
  if (!poetName) return;
  const key = encodeURIComponent(poetName.trim());
  nsPoetInfo.delete(key);
}

// 诗人作品缓存：TTL 3min + SWR 1min
const POET_POSTS_TTL = 3 * 60 * 1000;
const POET_POSTS_SWR = 60 * 1000;

function poetPostsNs(poetName) {
  const key = encodeURIComponent(poetName.trim());
  return cacheManager.namespace(`poetPosts:${key}`, { persistent: true, maxItems: 200 });
}

export async function getPoetPosts({ poetName, page = 0, pageSize = 10, context }) {
  if (!poetName) {
    return { posts: [], total: 0 };
  }

  const ns = poetPostsNs(poetName);
  const key = `page:${page}:size:${pageSize}`;
  return ns.getOrFetch(
    key,
    async () => {
      const result = await callCloudAndUnwrap(
        'getPoetPosts',
        { poetName, page, pageSize },
        { pageTag: 'poet-profile:posts', context, injectOpenId: true },
        '加载作品失败'
      );
      return {
        posts: result.posts || [],
        total: result.total || 0
      };
    },
    { ttlMs: POET_POSTS_TTL, swrMs: POET_POSTS_SWR }
  );
}

export function invalidatePoetPosts(poetName, page, pageSize = 10) {
  if (!poetName) return;
  const ns = poetPostsNs(poetName);
  if (typeof page === 'number') {
    ns.delete(`page:${page}:size:${pageSize}`);
    return;
  }
  ns.clear();
}

export async function updatePoetInfo({ poetName, bio, avatarPath, context }) {
  if (!poetName) {
    return { success: false, message: '诗人名字不能为空' };
  }

  let avatarFileID = '';
  if (avatarPath) {
    try {
      const app = getApp();
      const openid = app.globalData?.openid || 'unknown';
      const cloudPath = `poets/${poetName.trim()}/${openid}_${Date.now()}.jpg`;
      avatarFileID = await uploadFile(cloudPath, avatarPath);
      if (!avatarFileID) {
        throw new Error('上传返回空fileID');
      }
    } catch (uploadErr) {
      console.error('上传诗人头像失败:', uploadErr);
      return { success: false, message: '上传头像失败' };
    }
  }

  try {
    const result = await callCloudAndUnwrap(
      'updatePoetInfo',
      {
        poetName,
        bio,
        avatarFileID
      },
      { pageTag: 'poet-profile:update', context, injectOpenId: true },
      '更新失败'
    );

    invalidatePoetInfo(poetName);
    invalidatePoetList();
    return {
      success: true,
      avatar: result.avatar || '',
      bio: result.bio || ''
    };
  } catch (err) {
    return {
      success: false,
      message: err.message || '更新失败'
    };
  }
}
