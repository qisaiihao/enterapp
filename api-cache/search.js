/**
 * 搜索相关API缓存层
 */
const { cloudCall } = require('../utils/cloudCall.js');

/**
 * 获取搜索建议
 * @param {string} keyword - 搜索关键词
 * @param {number} limit - 建议数量限制
 * @param {Object} options - 额外选项
 * @returns {Promise} 搜索建议列表
 */
function getSearchSuggestions(keyword, limit = 8, options = {}) {
    if (!keyword || !keyword.trim()) {
        return Promise.resolve([]);
    }

    return cloudCall('getSearchSuggestions', {
        keyword: keyword.trim(),
        limit: limit
    }, Object.assign({
        pageTag: 'search',
        injectOpenId: false,
        ...options
    }));
}

/**
 * 搜索帖子
 * @param {string} keyword - 搜索关键词
 * @param {Object} searchParams - 搜索参数
 * @param {number} searchParams.limit - 结果数量限制
 * @param {string} searchParams.filter - 过滤条件
 * @param {number} searchParams.offset - 偏移量（分页）
 * @param {Object} options - 额外选项
 * @returns {Promise} 搜索结果
 */
function searchPosts(keyword, searchParams = {}, options = {}) {
    if (!keyword || !keyword.trim()) {
        return Promise.reject(new Error('搜索关键词不能为空'));
    }

    const params = {
        keyword: keyword.trim(),
        limit: searchParams.limit || 20,
        filter: searchParams.filter || 'all',
        offset: searchParams.offset || 0
    };

    return cloudCall('searchPosts', params, Object.assign({
        pageTag: 'search',
        injectOpenId: true,
        ...options
    }));
}

/**
 * 记录搜索统计
 * @param {string} keyword - 搜索关键词
 * @param {Object} options - 额外选项
 * @returns {Promise} 记录结果
 */
function recordSearchStats(keyword, options = {}) {
    if (!keyword || !keyword.trim()) {
        return Promise.resolve();
    }

    return cloudCall('searchStats', {
        keyword: keyword.trim(),
        action: 'record'
    }, Object.assign({
        pageTag: 'search',
        injectOpenId: true,
        silent: true, // 静默调用，不显示loading
        ...options
    }));
}

/**
 * 获取热门搜索
 * @param {number} limit - 数量限制
 * @param {Object} options - 额外选项
 * @returns {Promise} 热门搜索列表
 */
function getHotSearches(limit = 10, options = {}) {
    return cloudCall('searchStats', {
        action: 'getHotSearches',
        limit: limit
    }, Object.assign({
        pageTag: 'search',
        injectOpenId: false,
        ...options
    }));
}

/**
 * 高级搜索
 * @param {Object} searchCriteria - 搜索条件
 * @param {string} searchCriteria.keyword - 关键词
 * @param {Array} searchCriteria.tags - 标签列表
 * @param {string} searchCriteria.author - 作者
 * @param {string} searchCriteria.dateRange - 日期范围
 * @param {string} searchCriteria.contentType - 内容类型
 * @param {Object} searchCriteria.pagination - 分页信息
 * @param {Object} options - 额外选项
 * @returns {Promise} 搜索结果
 */
function advancedSearch(searchCriteria, options = {}) {
    if (!searchCriteria) {
        return Promise.reject(new Error('搜索条件不能为空'));
    }

    // 至少需要一个搜索条件
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

    return cloudCall('advancedSearch', params, Object.assign({
        pageTag: 'search',
        injectOpenId: true,
        ...options
    }));
}

/**
 * 搜索用户
 * @param {string} keyword - 搜索关键词
 * @param {number} limit - 结果数量限制
 * @param {Object} options - 额外选项
 * @returns {Promise} 用户搜索结果
 */
function searchUsers(keyword, limit = 10, options = {}) {
    if (!keyword || !keyword.trim()) {
        return Promise.resolve([]);
    }

    return cloudCall('searchUsers', {
        keyword: keyword.trim(),
        limit: limit
    }, Object.assign({
        pageTag: 'search',
        injectOpenId: true,
        ...options
    }));
}

/**
 * 获取搜索历史
 * @param {number} limit - 历史记录数量限制
 * @param {Object} options - 额外选项
 * @returns {Promise} 搜索历史列表
 */
function getSearchHistory(limit = 10, options = {}) {
    return cloudCall('getSearchHistory', {
        limit: limit
    }, Object.assign({
        pageTag: 'search',
        requireAuth: true,
        ...options
    }));
}

/**
 * 清除搜索历史
 * @param {Object} options - 额外选项
 * @returns {Promise} 清除结果
 */
function clearSearchHistory(options = {}) {
    return cloudCall('clearSearchHistory', {}, Object.assign({
        pageTag: 'search',
        requireAuth: true,
        ...options
    }));
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