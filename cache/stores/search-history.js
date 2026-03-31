/**
 * 搜索历史缓存存储
 * 
 * 命名空间: search:history
 * TTL: 无限（持久化）
 * 持久化: 是
 * 
 * 存储结构：单个键 'list' 存储历史数组
 */
import cacheManager from '../core/manager.js';

const NS = cacheManager.namespace('search:history', { persistent: true, maxItems: 100 });
const HISTORY_KEY = 'list';
const MAX_HISTORY = 20;
const MAX_DISPLAY = 10;

/**
 * 获取搜索历史列表
 * @returns {string[]} 搜索历史数组
 */
function getSearchHistory() {
  try {
    return NS.get(HISTORY_KEY) || [];
  } catch (_) {
    return [];
  }
}

/**
 * 获取显示用的搜索历史（最多10条）
 * @returns {string[]} 搜索历史数组
 */
function getDisplayHistory() {
  return getSearchHistory().slice(0, MAX_DISPLAY);
}

/**
 * 添加搜索关键词到历史
 * @param {string} keyword - 搜索关键词
 */
function addSearchHistory(keyword) {
  if (!keyword || typeof keyword !== 'string') return;
  
  const trimmed = keyword.trim();
  if (!trimmed) return;
  
  try {
    let history = getSearchHistory();
    
    // 移除重复项
    history = history.filter(item => item !== trimmed);
    
    // 添加到开头
    history.unshift(trimmed);
    
    // 限制数量
    if (history.length > MAX_HISTORY) {
      history = history.slice(0, MAX_HISTORY);
    }
    
    // 保存（无TTL，永久保存）
    NS.set(HISTORY_KEY, history);
    
    console.log(`[search-history] 添加搜索历史: "${trimmed}"`);
  } catch (e) {
    console.warn('[search-history] 保存失败:', e);
  }
}

/**
 * 删除单条搜索历史
 * @param {string} keyword - 要删除的关键词
 */
function removeSearchHistory(keyword) {
  if (!keyword) return;
  
  try {
    let history = getSearchHistory();
    history = history.filter(item => item !== keyword);
    NS.set(HISTORY_KEY, history);
  } catch (_) {}
}

/**
 * 清空搜索历史
 */
function clearSearchHistory() {
  try {
    NS.delete(HISTORY_KEY);
    console.log('[search-history] 已清空搜索历史');
  } catch (_) {}
}

/**
 * 获取统计信息
 */
function getStats() {
  const history = getSearchHistory();
  return {
    count: history.length,
    maxHistory: MAX_HISTORY,
    maxDisplay: MAX_DISPLAY
  };
}

const searchHistoryStore = {
  getSearchHistory,
  getDisplayHistory,
  addSearchHistory,
  removeSearchHistory,
  clearSearchHistory,
  getStats,
  
  // 常量
  MAX_HISTORY,
  MAX_DISPLAY
};

export {
  getSearchHistory,
  getDisplayHistory,
  addSearchHistory,
  removeSearchHistory,
  clearSearchHistory,
  getStats,
  MAX_HISTORY,
  MAX_DISPLAY
};

export default searchHistoryStore;

if (typeof module !== 'undefined' && module.exports) {
  module.exports = searchHistoryStore;
  module.exports.default = searchHistoryStore;
}
