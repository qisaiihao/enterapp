import cacheManager from '@/cache/core/manager.js';
import { cloudCall } from '@/utils/cloudCall.js';

const NOTICE_TTL_MS = 60 * 1000;
const NOTICE_SWR_MS = 30 * 1000;

const noticeNs = cacheManager.namespace('activities:notices', { persistent: true, maxItems: 16 });

function getSuccessResult(res) {
  const result = res && res.result ? res.result : null;
  if (!result || !result.success) return null;
  return result;
}

function normalizeNotice(item = {}) {
  const value = item.value || item._id || '';
  const title = typeof item.title === 'string' ? item.title.trim() : '';
  if (!value || !title) return null;
  return {
    value,
    kicker: item.kicker || '公告',
    title,
    summary: item.summary || '',
    mark: item.mark || '',
    tone: item.tone || 'default',
    sortWeight: Number(item.sortWeight) || 0
  };
}

async function fetchActivityNotices({ limit, context } = {}) {
  const res = await cloudCall(
    'getRecentActivities',
    {
      noticeOnly: true,
      noticeLimit: limit
    },
    { pageTag: 'activities:notices', context, injectOpenId: false }
  );

  const result = getSuccessResult(res);
  if (!result) return { notices: [] };
  const notices = (Array.isArray(result.notices) ? result.notices : [])
    .map(normalizeNotice)
    .filter(Boolean);

  return { notices };
}

export async function getActivityNotices({
  limit = 6,
  context,
  forceRefresh = false,
  onBackgroundUpdate
} = {}) {
  const safeLimit = Math.min(10, Math.max(1, Number(limit) || 6));
  const key = `limit:${safeLimit}`;
  const fetcher = () => fetchActivityNotices({ limit: safeLimit, context });

  if (forceRefresh) {
    noticeNs.delete(key);
  }

  return noticeNs.getOrFetch(
    key,
    fetcher,
    {
      ttlMs: NOTICE_TTL_MS,
      swrMs: NOTICE_SWR_MS,
      onBackgroundUpdate
    }
  );
}

export function invalidateActivityNotices() {
  noticeNs.clear();
}

export default {
  getActivityNotices,
  invalidateActivityNotices
};
