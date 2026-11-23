import { callCloudAndUnwrap } from './_shared/cloud-wrapper.js';
import cacheManager from '@/cache/core/manager.js';

// 公共运营配置允许最多延迟 5 分钟；保存成功立即覆盖本机缓存。
const configCache = cacheManager.namespace('square:bubble', { persistent: true, maxItems: 1 });
const CONFIG_TTL_MS = 5 * 60 * 1000;

export const SQUARE_BUBBLE_TARGETS = [
  { value: 'weekly', label: '周刊', url: '/pages-content/weekly-home/weekly-home' },
  { value: 'weekly-selection', label: '本周精选', url: '/pages-content/weekly-selection/weekly-selection' },
  { value: 'ranking', label: '本周热榜', url: '/pages-content/weekly-ranking/weekly-ranking' },
  { value: 'topics', label: '主题精选', url: '/pages-content/weekly-topic-submission/weekly-topic-submission' },
  { value: 'activities', label: '活动', url: '/pages/activity/activity' },
  { value: 'societies', label: '诗社', url: '/pages-community/home/home' },
  { value: 'collage', label: '拼贴诗', url: '/pages-collage/collage-square/collage-square' },
  { value: 'search', label: '搜索', url: '/pages-tools/search/search' },
  { value: 'messages', label: '消息', url: '/pages-tools/messages/messages' },
  { value: 'favorites', label: '收藏', url: '/pages-content/favorite-folders/favorite-folders' },
  { value: 'portfolio', label: '作品集', url: '/pages-content/portfolio/portfolio' },
  { value: 'feed', label: '广场', url: '/pages/index/index', type: 'switchTab' },
  { value: 'mine', label: '我的', url: '/pages/profile/profile', type: 'switchTab' },
  { value: 'feedback', label: '意见反馈', url: '/pages-tools/feedback/feedback' },
  { value: 'contact', label: '联系我们', url: '/pages-tools/contact/contact' }
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
