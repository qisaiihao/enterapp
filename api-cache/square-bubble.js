import { callCloudAndUnwrap } from './_shared/cloud-wrapper.js';

export const SQUARE_BUBBLE_TARGETS = [
  { value: 'weekly', label: '周刊', url: '/pages-content/weekly-home/weekly-home' },
  { value: 'activities', label: '活动', url: '/pages-content/activity-list/activity-list' },
  { value: 'ranking', label: '本周热榜', url: '/pages-content/weekly-ranking/weekly-ranking' },
  { value: 'topics', label: '主题精选', url: '/pages-content/weekly-topic-submission/weekly-topic-submission' }
];

export async function getSquareBubbleConfig(context) {
  const result = await callCloudAndUnwrap('squareBubbleConfig', { action: 'get' },
    { context, requireAuth: false, injectOpenId: false, silent: true }, '加载气泡失败');
  return result.config;
}

export async function saveSquareBubbleConfig(config, context) {
  const result = await callCloudAndUnwrap('squareBubbleConfig', { ...config, action: 'save' },
    { context, requireAuth: true }, '保存气泡失败');
  return result.config;
}
