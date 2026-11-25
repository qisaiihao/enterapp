import cacheManager from '@/cache/core/manager.js';
import { getAppState } from '@/utils/app-state.js';
import { callCloudAndUnwrap } from './_shared/cloud-wrapper.js';

const SNAPSHOT_TTL_MS = 5 * 60 * 1000;
const FRESH_MS = 15 * 1000;

const ns = cacheManager.namespace('messages', { persistent: true, maxItems: 64 });
const pending = new Map();

export function getMessageViewer() {
  const state = getAppState();
  return state.isLoggedIn ? state.openid || state.userInfo?._openid || state.userInfo?.openid || '' : '';
}

function cachePrefix(viewer) {
  return `user:${encodeURIComponent(viewer)}:type:`;
}

function messagePageKey(viewer, type, page, pageSize) {
  return `${cachePrefix(viewer)}${type || 'all'}:page:${page}:size:${pageSize}`;
}

export function getCachedMessages({ pageSize = 10, type = null } = {}) {
  const viewer = getMessageViewer();
  return viewer ? ns.get(messagePageKey(viewer, type, 0, pageSize)) : undefined;
}

async function fetchMessagesPage({ viewer, page, pageSize, type, context }) {
  const result = await callCloudAndUnwrap(
    'getMessages',
    { openid: viewer, skip: page * pageSize, limit: pageSize, type: type || null },
    { pageTag: 'messages', context, requireAuth: true, silent: true },
    '加载消息失败'
  );

  return {
    messages: result.messages || [],
    unreadCount: result.unreadCount || 0,
    totalCount: result.totalCount || 0,
    fetchedAt: Date.now()
  };
}

/**
 * 获取消息列表（带缓存）
 */
export async function getMessages({ page = 0, pageSize = 10, type = null, context, forceRefresh = false } = {}) {
  const viewer = getMessageViewer();
  if (!viewer) throw new Error('请先登录');
  const key = messagePageKey(viewer, type, page, pageSize);
  const running = pending.get(key);
  if (running && running.version === ns.getVersion(key)) return running.promise;

  if (page === 0 && !forceRefresh) {
    const cached = ns.get(key);
    if (cached && Date.now() - cached.fetchedAt < FRESH_MS) return cached;
  }

  const version = ns.getVersion(key);
  const task = { version };
  task.promise = fetchMessagesPage({ viewer, page, pageSize, type, context }).then((result) => {
    if (getMessageViewer() === viewer && ns.getVersion(key) === version) {
      if (page === 0) ns.set(key, result, { ttlMs: SNAPSHOT_TTL_MS });
      else ns.delete(key);
    }
    return result;
  }).finally(() => {
    if (pending.get(key) === task) pending.delete(key);
  });
  pending.set(key, task);
  return task.promise;
}

export function prefetchMessages(context, { forceRefresh = false } = {}) {
  if (!getMessageViewer()) return;
  return getMessages({ context, forceRefresh }).catch(() => {});
}

/**
 * 标记消息已读
 */
export async function markMessagesAsRead(messageIds, context) {
  if (!Array.isArray(messageIds) || messageIds.length === 0) {
    return { success: true };
  }

  const result = await callCloudAndUnwrap(
    'markMessagesAsRead',
    { messageIds },
    { pageTag: 'messages', context, requireAuth: true },
    '标记已读失败'
  );

  return {
    success: true,
    modifiedCount: result.modifiedCount || 0
  };
}

/**
 * 将当前用户的全部消息标记为已读
 */
export async function markAllMessagesAsRead(context) {
  const result = await callCloudAndUnwrap(
    'markMessagesAsRead',
    { markAll: true },
    { pageTag: 'messages:markAll', context, requireAuth: true },
    '标记已读失败'
  );

  return {
    success: true,
    modifiedCount: result.updated || 0
  };
}

/**
 * 删除单条消息
 */
export async function deleteMessageById(messageId, context) {
  if (!messageId) {
    throw new Error('消息ID不能为空');
  }

  const viewer = getMessageViewer();
  await callCloudAndUnwrap(
    'deleteMessage',
    { messageId },
    { pageTag: 'messages', context, requireAuth: true },
    '删除失败'
  );

  invalidateMessages({ viewer });
  return { success: true };
}

/**
 * 清空消息
 */
export async function clearMessages(context) {
  const viewer = getMessageViewer();
  await callCloudAndUnwrap(
    'clearAllMessages',
    {},
    { pageTag: 'messages', context, requireAuth: true },
    '清空失败'
  );

  invalidateMessages({ viewer });
  return { success: true };
}

/**
 * 清除消息缓存
 */
export function invalidateMessages({ type, viewer = getMessageViewer() } = {}) {
  if (!viewer) return;
  const prefix = cachePrefix(viewer) + (type === undefined ? '' : `${type || 'all'}:page:`);
  for (const key of ns.keys()) {
    if (key.startsWith(prefix)) ns.delete(key);
  }
}
