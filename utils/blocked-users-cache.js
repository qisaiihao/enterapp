/**
 * 兼容层：重定向到新的缓存模块位置
 * @deprecated 请使用 @/cache 代替
 */
import blockedUsersCache from '../cache/stores/blocked-users.js';

export default blockedUsersCache;

if (typeof module !== 'undefined' && module.exports) {
  module.exports = blockedUsersCache;
  module.exports.default = blockedUsersCache;
}

