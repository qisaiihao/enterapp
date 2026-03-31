/**
 * 兼容层：重定向到新的缓存模块位置
 * @deprecated 请使用 @/cache 代替
 */
import cacheManager from '../cache/core/manager.js';

export default cacheManager;

if (typeof module !== 'undefined' && module.exports) {
  module.exports = cacheManager;
  module.exports.default = cacheManager;
}
