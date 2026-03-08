/**
 * 搜索相关 API 封装
 */
const { callCloudAndUnwrap } = require('./_shared/cloud-wrapper.js');

function getSearchSuggestions(keyword, limit = 8, options = {}) {
  if (!keyword || !keyword.trim()) {
    return Promise.resolve({ suggestions: [] });
  }

  return callCloudAndUnwrap(
    'getSearchSuggestions',
    {
      keyword: keyword.trim(),
      limit
    },
    Object.assign({
      pageTag: 'search',
      injectOpenId: false
    }, options),
    '获取搜索建议失败'
  );
}

function searchPosts(keyword, searchParams = {}, options = {}) {
  if (!keyword || !keyword.trim()) {
    return Promise.reject(new Error('搜索关键词不能为空'));
  }

  const params = {
    keyword: keyword.trim(),
    limit: searchParams.limit || 20,
    filter: searchParams.filter || 'all',
    offset: searchParams.offset || 0,
    page: searchParams.page || 1,
    sort: searchParams.sort || 'relevance'
  };

  return callCloudAndUnwrap(
    'searchPosts',
    params,
    Object.assign({
      pageTag: 'search',
      injectOpenId: true
    }, options),
    '搜索失败'
  );
}

function recordSearchStats(keyword, options = {}) {
  if (!keyword || !keyword.trim()) {
    return Promise.resolve({ success: true });
  }

  return callCloudAndUnwrap(
    'searchStats',
    {
      keyword: keyword.trim(),
      action: 'record'
    },
    Object.assign({
      pageTag: 'search',
      injectOpenId: true,
      silent: true
    }, options),
    '记录搜索统计失败'
  );
}

function getHotSearches(limit = 10, options = {}) {
  return callCloudAndUnwrap(
    'searchStats',
    {
      action: 'getHotSearches',
      limit
    },
    Object.assign({
      pageTag: 'search',
      injectOpenId: false
    }, options),
    '获取热门搜索失败'
  );
}

function advancedSearch(searchCriteria, options = {}) {
  if (!searchCriteria) {
    return Promise.reject(new Error('搜索条件不能为空'));
  }

  const hasKeyword = searchCriteria.keyword && searchCriteria.keyword.trim();
  const hasTags = searchCriteria.tags && searchCriteria.tags.length > 0;
  const hasAuthor = searchCriteria.author && searchCriteria.author.trim();

  if (!hasKeyword && !hasTags && !hasAuthor) {
    return Promise.reject(new Error('请至少提供一个搜索条件'));
  }

  const params = {
    keyword: hasKeyword ? searchCriteria.keyword.trim() : '',
    tags: hasTags ? searchCriteria.tags : [],
    author: hasAuthor ? searchCriteria.author.trim() : '',
    dateRange: searchCriteria.dateRange || '',
    contentType: searchCriteria.contentType || 'all',
    limit: searchCriteria.pagination?.limit || 20,
    offset: searchCriteria.pagination?.offset || 0
  };

  return callCloudAndUnwrap(
    'advancedSearch',
    params,
    Object.assign({
      pageTag: 'search',
      injectOpenId: true
    }, options),
    '高级搜索失败'
  );
}

function searchUsers(keyword, limit = 10, options = {}) {
  if (!keyword || !keyword.trim()) {
    return Promise.resolve({ users: [] });
  }

  return callCloudAndUnwrap(
    'searchUsers',
    {
      keyword: keyword.trim(),
      limit
    },
    Object.assign({
      pageTag: 'search',
      injectOpenId: true
    }, options),
    '搜索用户失败'
  );
}

function getSearchHistory(limit = 10, options = {}) {
  return callCloudAndUnwrap(
    'getSearchHistory',
    { limit },
    Object.assign({
      pageTag: 'search',
      requireAuth: true
    }, options),
    '获取搜索历史失败'
  );
}

function clearSearchHistory(options = {}) {
  return callCloudAndUnwrap(
    'clearSearchHistory',
    {},
    Object.assign({
      pageTag: 'search',
      requireAuth: true
    }, options),
    '清除搜索历史失败'
  );
}

module.exports = {
  getSearchSuggestions,
  searchPosts,
  recordSearchStats,
  getHotSearches,
  advancedSearch,
  searchUsers,
  getSearchHistory,
  clearSearchHistory
};
