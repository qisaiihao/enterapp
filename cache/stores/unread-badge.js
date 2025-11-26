/**
 * 未读消息红点同步管理器
 * 
 * 解决问题：
 * 1. 跨页面小红点同步
 * 2. 读消息后小红点不消失
 * 3. 页面切换时小红点状态不一致
 * 
 * 原理：
 * - 使用全局状态 + 事件广播
 * - 每次变更都立即通知所有订阅者
 */

const cacheManager = require('../core/manager');
const { EVENTS } = require('@/utils/events.js');

// 内存中的全局未读数（所有页面共享）
let _globalUnreadCount = 0;
let _initialized = false;

/**
 * 初始化未读数（应用启动时调用一次）
 */
async function initUnreadCount() {
  if (_initialized) return _globalUnreadCount;
  
  try {
    const { getUnreadCount } = require('@/api-cache/unread.js');
    const count = await getUnreadCount();
    _globalUnreadCount = count || 0;
    _initialized = true;
    console.log('[unread-badge] 初始化未读数:', _globalUnreadCount);
  } catch (e) {
    console.warn('[unread-badge] 初始化失败:', e);
  }
  
  return _globalUnreadCount;
}

/**
 * 获取当前未读数（同步方法，立即返回）
 */
function getUnreadCount() {
  return _globalUnreadCount;
}

/**
 * 设置未读数并广播
 * @param {number} count - 新的未读数
 */
function setUnreadCount(count) {
  const newCount = Math.max(0, count | 0);
  if (_globalUnreadCount !== newCount) {
    _globalUnreadCount = newCount;
    _broadcast(newCount);
    console.log('[unread-badge] 更新未读数:', newCount);
  }
}

/**
 * 减少未读数（读了几条消息）
 * @param {number} delta - 减少的数量
 */
function decreaseUnread(delta = 1) {
  setUnreadCount(_globalUnreadCount - delta);
}

/**
 * 清零未读数
 */
function clearUnread() {
  setUnreadCount(0);
}

/**
 * 强制刷新未读数（从服务器获取最新）
 */
async function refreshUnreadCount() {
  try {
    const { invalidateUnread, getUnreadCount: fetchUnread } = require('@/api-cache/unread.js');
    invalidateUnread(); // 清缓存
    const count = await fetchUnread();
    setUnreadCount(count || 0);
    return _globalUnreadCount;
  } catch (e) {
    console.warn('[unread-badge] 刷新失败:', e);
    return _globalUnreadCount;
  }
}

/**
 * 广播未读数变化
 */
function _broadcast(count) {
  try {
    if (typeof uni !== 'undefined' && uni.$emit) {
      uni.$emit(EVENTS.UNREAD_CHANGED, { count });
    }
  } catch (_) {}
}

/**
 * 订阅未读数变化（组件 mounted 时调用）
 * @param {Function} callback - (count) => void
 * @returns {Function} 取消订阅函数
 */
function subscribe(callback) {
  if (typeof callback !== 'function') return () => {};
  
  // 立即用当前值回调一次
  try { callback(_globalUnreadCount); } catch (_) {}
  
  // 订阅事件
  const handler = ({ count }) => {
    try { callback(count); } catch (_) {}
  };
  
  try {
    if (typeof uni !== 'undefined' && uni.$on) {
      uni.$on(EVENTS.UNREAD_CHANGED, handler);
    }
  } catch (_) {}
  
  // 返回取消订阅函数
  return () => {
    try {
      if (typeof uni !== 'undefined' && uni.$off) {
        uni.$off(EVENTS.UNREAD_CHANGED, handler);
      }
    } catch (_) {}
  };
}

module.exports = {
  initUnreadCount,
  getUnreadCount,
  setUnreadCount,
  decreaseUnread,
  clearUnread,
  refreshUnreadCount,
  subscribe
};
