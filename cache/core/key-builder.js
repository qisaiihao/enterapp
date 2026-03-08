/**
 * 统一的缓存键构建工具
 * 确保所有页面使用相同的缓存键生成逻辑，实现跨页面缓存共享
 */

/**
 * 构建缓存键（统一逻辑）
 * @param {Object} params - 查询参数
 * @param {number} params.page - 页码，从0开始
 * @param {number} params.pageSize - 每页数量
 * @param {boolean} [params.isPoem] - 是否只获取诗歌
 * @param {boolean} [params.isOriginal] - 是否只获取原创
 * @param {boolean} [params.isDiscussion] - 是否只获取讨论
 * @param {string} [params.tag] - 标签筛选
 * @param {boolean} [params.excludeAnonymous] - 是否排除匿名
 * @param {boolean} [params.includeActivity] - 是否查询活动帖子
 * @param {string} [params.activityId] - 活动ID
 * @returns {string} 缓存键
 */
export function buildCacheKey(params) {
  const {
    page,
    pageSize,
    isPoem,
    isOriginal,
    isDiscussion,
    tag,
    excludeAnonymous,
    includeActivity,
    activityId
  } = params;
  const parts = [];
  
  if (typeof isPoem === 'boolean') parts.push(`poem:${isPoem}`);
  if (typeof isOriginal === 'boolean') parts.push(`orig:${isOriginal}`);
  if (typeof isDiscussion === 'boolean') parts.push(`disc:${isDiscussion}`);
  if (tag) parts.push(`tag:${tag}`);
  if (excludeAnonymous) parts.push('exclAnon:true');
  if (includeActivity === true) parts.push('inclAct:true');
  if (activityId) parts.push(`act:${activityId}`);
  
  const filterKey = parts.length > 0 ? parts.join(':') : 'all';
  return `page:${page}:size:${pageSize}:${filterKey}`;
}

/**
 * 解析缓存键，提取查询参数
 */
export function parseCacheKey(cacheKey) {
  const match = cacheKey.match(/^page:(\d+):size:(\d+):(.+)$/);
  if (!match) return null;
  
  const [, page, pageSize, filterKey] = match;
  const params = {
    page: parseInt(page, 10),
    pageSize: parseInt(pageSize, 10)
  };
  
  if (filterKey === 'all') return params;
  
  const parts = filterKey.split(':');
  for (let i = 0; i < parts.length; i += 2) {
    const key = parts[i];
    const value = parts[i + 1];
    
    switch (key) {
      case 'poem': params.isPoem = value === 'true'; break;
      case 'orig': params.isOriginal = value === 'true'; break;
      case 'disc': params.isDiscussion = value === 'true'; break;
      case 'tag': params.tag = value; break;
      case 'exclAnon': if (value === 'true') params.excludeAnonymous = true; break;
      case 'inclAct': if (value === 'true') params.includeActivity = true; break;
      case 'act': params.activityId = value; break;
    }
  }
  
  return params;
}

/**
 * 检查两个查询参数是否匹配
 */
export function isQueryMatch(params1, params2) {
  return buildCacheKey(params1) === buildCacheKey(params2);
}
