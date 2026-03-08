import cacheManager from '@/_utils/cache-manager';
const { callCloudAndUnwrap } = require('./_shared/cloud-wrapper.js');

// 消息列表缓存：TTL 90s + SWR 45s
const TTL_MS = 90 * 1000;
const SWR_MS = 45 * 1000;

const ns = cacheManager.namespace('messages', { persistent: true, maxItems: 64 });

async function fetchMessagesPage({ page, pageSize, type, context }) {
  const result = await callCloudAndUnwrap(
    'getMessages',
    { skip: page * pageSize, limit: pageSize, type: type || null },
    { pageTag: 'messages', context, requireAuth: true },
    '加载消息失败'
  );

  return {
    messages: result.messages || [],
    unreadCount: result.unreadCount || 0,
    totalCount: result.totalCount || 0
  };
}

/**
 * 获取消息列表（带缓存）
 */
export async function getMessages({ page = 0, pageSize = 10, type = null, context, forceRefresh = false } = {}) {
  const typeKey = type || 'all';
  const cacheKeySuffix = (page === 0 && forceRefresh) ? `:ts:${Date.now()}` : '';
  const key = `type:${typeKey}:page:${page}:size:${pageSize}${cacheKeySuffix}`;

  if (page === 0 && forceRefresh) {
    return fetchMessagesPage({ page, pageSize, type, context });
  }

  return ns.getOrFetch(
    key,
    () => fetchMessagesPage({ page, pageSize, type, context }),
    { ttlMs: TTL_MS, swrMs: SWR_MS }
  );
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
 * 删除单条消息
 */
export async function deleteMessageById(messageId, context) {
  if (!messageId) {
    throw new Error('消息ID不能为空');
  }

  await callCloudAndUnwrap(
    'deleteMessage',
    { messageId },
    { pageTag: 'messages', context, requireAuth: true },
    '删除失败'
  );

  return { success: true };
}

/**
 * 清空消息
 */
export async function clearMessages(context) {
  await callCloudAndUnwrap(
    'clearAllMessages',
    {},
    { pageTag: 'messages', context, requireAuth: true },
    '清空失败'
  );

  return { success: true };
}

/**
 * 清除消息缓存
 */
export function invalidateMessages({ type, page, pageSize = 10 } = {}) {
  if (typeof type === 'string') {
    const typeKey = type || 'all';
    if (typeof page === 'number') {
      ns.delete(`type:${typeKey}:page:${page}:size:${pageSize}`);
      return;
    }
    const keys = ns.keys();
    keys.forEach((k) => {
      if (k.startsWith(`type:${typeKey}:page:`)) {
        ns.delete(k);
      }
    });
    return;
  }

  ns.clear();
}
