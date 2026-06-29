import cacheManager from '@/cache/core/manager.js';
import { buildCacheKey } from './cache-key-builder.js';
import fileUrlCache from '@/_utils/file-url-cache';
import { hydrateTempUrls } from '@/cache/core/hydrate.js';
import { cloudCall } from '@/utils/cloudCall.js';
import likeStatusCache from '@/cache/stores/like-status.js';

const LIST_TTL_MS = 60 * 1000;
const LIST_SWR_MS = 30 * 1000;
const POSTS_TTL_MS = 60 * 1000;
const POSTS_SWR_MS = 30 * 1000;
const DETAIL_TTL_MS = 60 * 1000;
const DETAIL_SWR_MS = 30 * 1000;
const ACTIVITY_ASSET_PUBLIC_BASE_URL = 'https://636c-cloud1-5gb0pbyl400845f5-1378788263.tcb.qcloud.la';
const ACTIVITY_ASSET_AUTHORITIES = new Set([
  'cloud1-5gb0pbyl400845f5-1378788263',
  'cloud1-5gb0pbyl400845f5.cloud1-5gb0pbyl400845f5-1378788263',
  'cloud1-5gb0pbyl400845f5.636c-cloud1-5gb0pbyl400845f5-1378788263'
]);

const listNs = cacheManager.namespace('activities:list', { persistent: true, maxItems: 128 });
const detailNs = cacheManager.namespace('activities:detail', { persistent: true, maxItems: 128 });

function getSuccessResult(res) {
  const result = res && res.result ? res.result : null;
  if (!result || !result.success) return null;
  return result;
}

function resolveActivityAssetUrl(fileId) {
  if (typeof fileId !== 'string' || !fileId.startsWith('cloud://')) {
    return '';
  }

  const match = fileId.trim().match(/^cloud:\/\/([^/]+)\/(.+)$/);
  if (!match) {
    return '';
  }

  const authority = match[1];
  const filePath = match[2].replace(/^\/+/, '');
  if (!ACTIVITY_ASSET_AUTHORITIES.has(authority) || !filePath.startsWith('activities/')) {
    return '';
  }

  return `${ACTIVITY_ASSET_PUBLIC_BASE_URL}/${filePath}`;
}

function buildFallbackCoverUrlMap(fileIds = []) {
  return fileIds.reduce((map, fileId) => {
    const publicUrl = resolveActivityAssetUrl(fileId);
    if (publicUrl) {
      map[fileId] = publicUrl;
    }
    return map;
  }, {});
}

async function hydrateActivitiesCover(activities = []) {
  const list = Array.isArray(activities) ? activities : [];
  if (list.length === 0) return [];

  const fileIds = Array.from(new Set(
    list
      .map(item => (item && typeof item.coverImage === 'string' ? item.coverImage : ''))
      .filter(url => url && url.startsWith('cloud://'))
  ));

  if (fileIds.length === 0) {
    return list;
  }

  let urlMap = {};
  try {
    urlMap = await fileUrlCache.getTempUrls(fileIds);
  } catch (error) {
    console.warn('[activities cache] cover url hydrate failed:', error);
  }

  const fallbackMap = buildFallbackCoverUrlMap(fileIds);
  urlMap = { ...fallbackMap, ...urlMap };

  return list.map((item) => {
    if (!item || typeof item.coverImage !== 'string' || !item.coverImage.startsWith('cloud://')) {
      return item;
    }
    const tempUrl = urlMap[item.coverImage];
    if (!tempUrl) return item;
    return {
      ...item,
      coverImage: tempUrl,
      coverImageFileId: item.coverImage
    };
  });
}

async function hydrateSingleActivityCover(activity) {
  if (!activity || typeof activity !== 'object') return null;
  const list = await hydrateActivitiesCover([activity]);
  return list[0] || activity;
}

async function fetchRecentActivitiesPage({ page, pageSize, scene, context }) {
  const res = await cloudCall(
    'getRecentActivities',
    {
      skip: page * pageSize,
      limit: pageSize,
      scene
    },
    { pageTag: 'activities:list', context, injectOpenId: true }
  );

  const result = getSuccessResult(res);
  if (!result) return { activities: [], hasMore: false, total: 0 };

  const activities = await hydrateActivitiesCover(result.activities || []);
  return {
    activities,
    hasMore: !!result.hasMore,
    total: Number(result.total) || 0
  };
}

async function fetchActivityDetailData({ activityId, context }) {
  const res = await cloudCall(
    'getRecentActivities',
    { activityId },
    { pageTag: 'activities:detail', context, injectOpenId: true }
  );
  const result = getSuccessResult(res);
  if (!result || !result.activity) return { activity: null };
  const activity = await hydrateSingleActivityCover(result.activity);
  return { activity };
}

async function fetchActivityPostsPage({ activityId, page, pageSize, context }) {
  const res = await cloudCall(
    'getPostList',
    {
      skip: page * pageSize,
      limit: pageSize,
      includeActivity: true,
      activityId
    },
    { pageTag: 'activities:posts', context, injectOpenId: true }
  );
  const result = getSuccessResult(res);
  if (!result) return { posts: [], hasMore: false };
  const posts = Array.isArray(result.posts) ? result.posts : [];
  await hydrateTempUrls(posts);
  try {
    likeStatusCache.preloadFromPosts(posts);
  } catch (error) {
    console.warn('[activities cache] preload like status failed:', error);
  }
  return {
    posts,
    hasMore: posts.length === pageSize
  };
}

export async function getRecentActivities({
  page = 0,
  pageSize = 10,
  scene = 'recent',
  context,
  forceRefresh = false,
  onBackgroundUpdate
} = {}) {
  const safeScene = scene === 'join' ? 'join' : 'recent';
  const key = `page:${page}:size:${pageSize}:scene:${safeScene}`;
  const fetcher = () => fetchRecentActivitiesPage({ page, pageSize, scene: safeScene, context });

  if (forceRefresh && page === 0) {
    listNs.delete(key);
  }

  const data = await listNs.getOrFetch(
    key,
    fetcher,
    {
      ttlMs: LIST_TTL_MS,
      swrMs: LIST_SWR_MS,
      onBackgroundUpdate
    }
  );

  return data || { activities: [], hasMore: false, total: 0 };
}

export async function getActivityDetail({
  activityId,
  context,
  forceRefresh = false,
  onBackgroundUpdate
} = {}) {
  const safeActivityId = typeof activityId === 'string' ? activityId.trim() : '';
  if (!safeActivityId) {
    return { activity: null };
  }

  const key = `id:${safeActivityId}`;
  const fetcher = () => fetchActivityDetailData({ activityId: safeActivityId, context });

  if (forceRefresh) {
    detailNs.delete(key);
  }

  const data = await detailNs.getOrFetch(
    key,
    fetcher,
    {
      ttlMs: DETAIL_TTL_MS,
      swrMs: DETAIL_SWR_MS,
      onBackgroundUpdate
    }
  );
  return data || { activity: null };
}

function activityPostsNamespace(activityId) {
  return cacheManager.namespace(`activities:posts:${activityId}`, { persistent: true, maxItems: 128 });
}

export async function getActivityPosts({
  activityId,
  page = 0,
  pageSize = 10,
  context,
  forceRefresh = false,
  onBackgroundUpdate
} = {}) {
  if (!activityId) {
    return { posts: [], hasMore: false };
  }

  const ns = activityPostsNamespace(activityId);
  const key = buildCacheKey({ page, pageSize, includeActivity: true, activityId });
  const fetcher = () => fetchActivityPostsPage({ activityId, page, pageSize, context });

  if (forceRefresh && page === 0) {
    ns.delete(key);
  }

  const data = await ns.getOrFetch(
    key,
    fetcher,
    {
      ttlMs: POSTS_TTL_MS,
      swrMs: POSTS_SWR_MS,
      onBackgroundUpdate
    }
  );

  return data || { posts: [], hasMore: false };
}

export function invalidateRecentActivities({ page, pageSize = 10, scene = 'recent' } = {}) {
  const safeScene = scene === 'join' ? 'join' : 'recent';
  if (typeof page === 'number') {
    const key = `page:${page}:size:${pageSize}:scene:${safeScene}`;
    listNs.delete(key);
    return;
  }
  listNs.clear();
  detailNs.clear();
}

export function invalidateActivityDetail({ activityId } = {}) {
  const safeActivityId = typeof activityId === 'string' ? activityId.trim() : '';
  if (!safeActivityId) {
    detailNs.clear();
    return;
  }
  detailNs.delete(`id:${safeActivityId}`);
}

export function invalidateActivityPosts({ activityId, page, pageSize = 10 } = {}) {
  if (!activityId) return;
  const ns = activityPostsNamespace(activityId);
  if (typeof page === 'number') {
    const key = buildCacheKey({ page, pageSize, includeActivity: true, activityId });
    ns.delete(key);
    return;
  }
  ns.clear();
}
