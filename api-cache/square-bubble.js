import { callCloudAndUnwrap } from './_shared/cloud-wrapper.js';
import cacheManager from '@/cache/core/manager.js';

// 公共运营配置允许最多延迟 5 分钟；保存成功立即覆盖本机缓存。
const configCache = cacheManager.namespace('square:bubble', { persistent: true, maxItems: 1 });
const CONFIG_TTL_MS = 5 * 60 * 1000;

export const SQUARE_BUBBLE_TARGETS = [
  { value: 'weekly', label: '周刊', url: '/pages-content/weekly-home/weekly-home' },
  { value: 'activities', label: '活动', url: '/pages-content/activity-list/activity-list' },
  { value: 'ranking', label: '本周热榜', url: '/pages-content/weekly-ranking/weekly-ranking' },
  { value: 'topics', label: '主题精选', url: '/pages-content/weekly-topic-submission/weekly-topic-submission' }
];

export async function getSquareBubbleConfig(context) {
  return configCache.getOrFetch('config', async () => {
    const result = await callCloudAndUnwrap('squareBubbleConfig', { action: 'get' },
      { context, requireAuth: false, injectOpenId: false, silent: true }, '加载气泡失败');
    return result.config;
  }, { ttlMs: CONFIG_TTL_MS });
}

export async function saveSquareBubbleConfig(config, context) {
  const result = await callCloudAndUnwrap('squareBubbleConfig', { ...config, action: 'save' },
    { context, requireAuth: true }, '保存气泡失败');
  configCache.set('config', result.config, { ttlMs: CONFIG_TTL_MS });
  return result.config;
}
