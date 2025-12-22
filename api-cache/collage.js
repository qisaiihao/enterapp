import { cloudCall } from '@/utils/cloudCall';

/**
 * 获取拼贴诗词库
 * @param {Object} options
 * @param {number} options.limit 每组返回数量，默认10，范围3-20
 * @param {Array<string>} options.groups 词组类型，默认 ['nouns','verbs','imagery']
 * @param {number} options.seed 可选，前后端复现同一批次
 */
export function getCollageWords(options = {}) {
  const payload = Object.assign(
    {
      mode: 'words',
      limit: 10,
      groups: ['nouns', 'verbs', 'imagery']
    },
    options
  );

  return cloudCall('getCollagePoetry', payload, {
    pageTag: 'collage',
    injectOpenId: false
  });
}

// 备用：获取拼贴诗列表
export function getCollageList({ page = 0, pageSize = 10 } = {}) {
  return cloudCall(
    'getCollagePoetry',
    { page, pageSize },
    { pageTag: 'collage' }
  );
}
