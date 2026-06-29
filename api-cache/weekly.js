import cacheManager from '@/cache/core/manager.js';
import { callCloudAndUnwrap } from './_shared/cloud-wrapper.js';
import { hydrateTempUrls } from '@/cache/core/hydrate.js';

const TTL_MS = 60 * 1000;
const SWR_MS = 30 * 1000;
const weeklyNs = cacheManager.namespace('weekly:content', { persistent: true, maxItems: 128 });

async function hydrateWeeklyPosts(items = []) {
  const list = Array.isArray(items) ? items : [];
  await hydrateTempUrls(list);
  return list;
}

async function hydrateWeeklyPayload(payload = {}) {
  if (Array.isArray(payload.rankingItems)) {
    await hydrateWeeklyPosts(payload.rankingItems);
  }
  if (Array.isArray(payload.issues)) {
    await hydrateWeeklyPosts(payload.issues);
  }
  if (payload.currentIssue && Array.isArray(payload.currentIssue.featuredSnapshots)) {
    await hydrateWeeklyPosts(payload.currentIssue.featuredSnapshots);
  }
  if (payload.detail && Array.isArray(payload.detail.posts)) {
    await hydrateWeeklyPosts(payload.detail.posts);
  }
  return payload;
}

async function fetchWeeklyContent(payload = {}, { context } = {}) {
  const result = await callCloudAndUnwrap(
    'getWeeklyContent',
    payload,
    {
      pageTag: `weekly:${payload.mode || 'home'}`,
      context,
      injectOpenId: false,
      requireAuth: false,
      silent: true
    },
    '获取周刊内容失败'
  );
  return hydrateWeeklyPayload(result);
}

async function getWeeklyContent({
  mode = 'home',
  id = '',
  skip = 0,
  limit = 20,
  context,
  forceRefresh = false,
  onBackgroundUpdate,
  recordView = false
} = {}) {
  const safeMode = String(mode || 'home');
  const key = `${safeMode}:id:${id || ''}:skip:${skip}:limit:${limit}:view:${recordView ? 1 : 0}`;
  if (forceRefresh) {
    weeklyNs.delete(key);
  }

  try {
    const data = await weeklyNs.getOrFetch(
      key,
      () => fetchWeeklyContent({ mode: safeMode, id, skip, limit, recordView }, { context }),
      { ttlMs: TTL_MS, swrMs: SWR_MS, onBackgroundUpdate }
    );
    return data || {};
  } catch (error) {
    return {};
  }
}

function invalidateWeeklyContent() {
  weeklyNs.clear();
}

function getWeeklyHome(options = {}) {
  return getWeeklyContent({ ...options, mode: 'home' });
}

function getWeeklyIssues(options = {}) {
  return getWeeklyContent({ ...options, mode: 'issues' });
}

function getWeeklyIssueDetail(options = {}) {
  return getWeeklyContent({ ...options, mode: 'issueDetail' });
}

function getWeeklyTopics(options = {}) {
  return getWeeklyContent({ ...options, mode: 'topics' });
}

function getWeeklyTopicDetail(options = {}) {
  return getWeeklyContent({ ...options, mode: 'topicDetail' });
}

function getWeeklyRanking(options = {}) {
  return getWeeklyContent({ ...options, mode: 'ranking' });
}

const weeklyApi = {
  getWeeklyContent,
  getWeeklyHome,
  getWeeklyIssues,
  getWeeklyIssueDetail,
  getWeeklyTopics,
  getWeeklyTopicDetail,
  getWeeklyRanking,
  invalidateWeeklyContent
};

export {
  getWeeklyContent,
  getWeeklyHome,
  getWeeklyIssues,
  getWeeklyIssueDetail,
  getWeeklyTopics,
  getWeeklyTopicDetail,
  getWeeklyRanking,
  invalidateWeeklyContent
};

export default weeklyApi;
