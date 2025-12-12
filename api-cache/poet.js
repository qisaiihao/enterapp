/**
 * 诗人相关API缓存层
 * 用于管理诗人信息和诗人作品的缓存
 */
import cacheManager from '@/cache/core/manager';
const { cloudCall } = require('@/utils/cloudCall.js');
const { uploadFile } = require('@/utils/uploader.js');

// 诗人信息缓存：TTL 10min + SWR 5min（诗人信息变化不频繁）
const POET_INFO_TTL = 10 * 60 * 1000;  // 10分钟
const POET_INFO_SWR = 5 * 60 * 1000;   // 5分钟

const nsPoetInfo = cacheManager.namespace('poet:info', { persistent: true, maxItems: 500 });

// 诗人列表缓存
const POET_LIST_TTL = 10 * 60 * 1000;  // 10分钟
const POET_LIST_SWR = 5 * 60 * 1000;   // 5分钟
const nsPoetList = cacheManager.namespace('poet:list', { persistent: true, maxItems: 100 });

/**
 * 获取诗人列表
 * @param {Object} params - 参数
 * @param {number} params.limit - 数量限制
 * @param {Object} params.context - 上下文
 * @param {Function} params.onBackgroundUpdate - SWR后台更新回调
 * @returns {Promise<Array>} 诗人列表
 */
export async function getPoetList({ limit = 50, context, onBackgroundUpdate } = {}) {
  const key = `list:${limit}`;
  return nsPoetList.getOrFetch(key, async () => {
    const res = await cloudCall('getPoetList', { limit }, { 
      pageTag: 'poet:list', 
      context, 
      injectOpenId: true 
    });
    if (res && res.result && res.result.success) {
      return res.result.poets || [];
    }
    return [];
  }, { 
    ttlMs: POET_LIST_TTL, 
    swrMs: POET_LIST_SWR,
    onBackgroundUpdate
  });
}

/**
 * 使诗人列表缓存失效
 */
export function invalidatePoetList() {
  nsPoetList.clear();
}

/**
 * 获取诗人信息
 * @param {string} poetName - 诗人名字
 * @param {Object} context - 上下文（用于云函数调用）
 * @returns {Promise<Object>} 诗人信息
 */
export async function getPoetInfo(poetName, context) {
  if (!poetName) return { name: '', avatar: '', bio: '' };
  
  const key = encodeURIComponent(poetName.trim());
  return nsPoetInfo.getOrFetch(key, async () => {
    const res = await cloudCall('getPoetInfo', { poetName }, { 
      pageTag: 'poet-profile:info', 
      context, 
      injectOpenId: true 
    });
    if (res && res.result && res.result.success) {
      return res.result.poetInfo || { name: poetName, avatar: '', bio: '' };
    }
    return { name: poetName, avatar: '', bio: '' };
  }, { ttlMs: POET_INFO_TTL, swrMs: POET_INFO_SWR });
}

/**
 * 使诗人信息缓存失效
 * @param {string} poetName - 诗人名字
 */
export function invalidatePoetInfo(poetName) {
  if (!poetName) return;
  const key = encodeURIComponent(poetName.trim());
  nsPoetInfo.delete(key);
}

// 诗人作品缓存：TTL 3min + SWR 1min
const POET_POSTS_TTL = 3 * 60 * 1000;
const POET_POSTS_SWR = 60 * 1000;

/**
 * 获取诗人作品的命名空间
 * @param {string} poetName - 诗人名字
 */
function poetPostsNs(poetName) {
  const key = encodeURIComponent(poetName.trim());
  return cacheManager.namespace(`poetPosts:${key}`, { persistent: true, maxItems: 200 });
}

/**
 * 获取诗人作品列表
 * @param {Object} params - 参数
 * @param {string} params.poetName - 诗人名字
 * @param {number} params.page - 页码（从0开始）
 * @param {number} params.pageSize - 每页数量
 * @param {Object} params.context - 上下文
 * @returns {Promise<Object>} { posts: [], total: 0 }
 */
export async function getPoetPosts({ poetName, page = 0, pageSize = 10, context }) {
  if (!poetName) return { posts: [], total: 0 };
  
  const ns = poetPostsNs(poetName);
  const key = `page:${page}:size:${pageSize}`;
  
  return ns.getOrFetch(key, async () => {
    const res = await cloudCall('getPoetPosts', { poetName, page, pageSize }, {
      pageTag: 'poet-profile:posts',
      context,
      injectOpenId: true
    });
    if (res && res.result && res.result.success) {
      return {
        posts: res.result.posts || [],
        total: res.result.total || 0
      };
    }
    return { posts: [], total: 0 };
  }, { ttlMs: POET_POSTS_TTL, swrMs: POET_POSTS_SWR });
}

/**
 * 使诗人作品缓存失效
 * @param {string} poetName - 诗人名字
 * @param {number} page - 页码（可选，不传则清除所有）
 * @param {number} pageSize - 每页数量
 */
export function invalidatePoetPosts(poetName, page, pageSize = 10) {
  if (!poetName) return;
  
  const ns = poetPostsNs(poetName);
  if (typeof page === 'number') {
    ns.delete(`page:${page}:size:${pageSize}`);
  } else {
    ns.clear();
  }
}

/**
 * 更新诗人信息（头像/简介）
 * @param {Object} params - 参数
 * @param {string} params.poetName - 诗人名字
 * @param {string} params.bio - 简介（可选）
 * @param {string} params.avatarPath - 头像本地路径（可选，需要先上传）
 * @param {Object} params.context - 上下文
 * @returns {Promise<Object>} { success: boolean, avatar?: string, bio?: string }
 */
export async function updatePoetInfo({ poetName, bio, avatarPath, context }) {
  if (!poetName) {
    return { success: false, message: '诗人名字不能为空' };
  }
  
  let avatarFileID = '';
  
  // 如果有头像路径，先上传图片
  if (avatarPath) {
    try {
      const app = getApp();
      const openid = app.globalData?.openid || 'unknown';
      const cloudPath = `poets/${poetName.trim()}/${openid}_${Date.now()}.jpg`;
      
      // 使用统一的上传工具，支持多端兼容和自动回退
      avatarFileID = await uploadFile(cloudPath, avatarPath);
      
      if (!avatarFileID) {
        throw new Error('上传返回空fileID');
      }
    } catch (uploadErr) {
      console.error('上传诗人头像失败:', uploadErr);
      return { success: false, message: '上传头像失败' };
    }
  }
  
  // 调用云函数更新
  const res = await cloudCall('updatePoetInfo', {
    poetName,
    bio,
    avatarFileID
  }, {
    pageTag: 'poet-profile:update',
    context,
    injectOpenId: true
  });
  
  console.log('【updatePoetInfo】云函数返回:', res);
  
  if (res && res.result && res.result.success) {
    // 更新成功，使缓存失效
    invalidatePoetInfo(poetName);
    
    return {
      success: true,
      avatar: res.result.avatar || '',
      bio: res.result.bio || ''
    };
  }
  
  return {
    success: false,
    message: res?.result?.error || '更新失败'
  };
}
