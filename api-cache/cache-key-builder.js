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
 * @returns {string} 缓存键
 */
export function buildCacheKey(params) {
  const { page, pageSize, isPoem, isOriginal, isDiscussion, tag, excludeAnonymous } = params;
  const parts = [];
  
  // 确保参数类型一致性：只有明确传入 boolean 值才加入缓存键
  if (typeof isPoem === 'boolean') parts.push(`poem:${isPoem}`);
  if (typeof isOriginal === 'boolean') parts.push(`orig:${isOriginal}`);
  if (typeof isDiscussion === 'boolean') parts.push(`disc:${isDiscussion}`);
  if (tag) parts.push(`tag:${tag}`);
  if (excludeAnonymous) parts.push('exclAnon:true');
  
  // 如果没有筛选条件，使用 'all' 作为过滤键
  const filterKey = parts.length > 0 ? parts.join(':') : 'all';
  return `page:${page}:size:${pageSize}:${filterKey}`;
}

/**
 * 解析缓存键，提取查询参数
 * @param {string} cacheKey - 缓存键
 * @returns {Object} 查询参数
 */
export function parseCacheKey(cacheKey) {
  const match = cacheKey.match(/^page:(\d+):size:(\d+):(.+)$/);
  if (!match) {
    return null;
  }
  
  const [, page, pageSize, filterKey] = match;
  const params = {
    page: parseInt(page, 10),
    pageSize: parseInt(pageSize, 10)
  };
  
  if (filterKey === 'all') {
    return params;
  }
  
  const parts = filterKey.split(':');
  for (let i = 0; i < parts.length; i += 2) {
    const key = parts[i];
    const value = parts[i + 1];
    
    switch (key) {
      case 'poem':
        params.isPoem = value === 'true';
        break;
      case 'orig':
        params.isOriginal = value === 'true';
        break;
      case 'disc':
        params.isDiscussion = value === 'true';
        break;
      case 'tag':
        params.tag = value;
        break;
      case 'exclAnon':
        if (value === 'true') {
          params.excludeAnonymous = true;
        }
        break;
    }
  }
  
  return params;
}

/**
 * 检查两个查询参数是否匹配（用于缓存共享判断）
 * @param {Object} params1 - 查询参数1
 * @param {Object} params2 - 查询参数2
 * @returns {boolean} 是否匹配
 */
export function isQueryMatch(params1, params2) {
  return buildCacheKey(params1) === buildCacheKey(params2);
}

