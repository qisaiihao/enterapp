/**
 * 兼容层：重定向到新的缓存模块位置
 * @deprecated 请使用 @/cache 代替
 */
import searchStore from '../cache/stores/search.js';

export const { searchCache, SearchCache } = searchStore;
export default searchStore;

if (typeof module !== 'undefined' && module.exports) {
  module.exports = searchStore;
  module.exports.default = searchStore;
}
