/**
 * 业务缓存存储统一导出
 */

import avatarCache from './avatar.js';
import followCache from './follow.js';
import signatureCache from './signature.js';
import { searchCache } from './search.js';
import blockedUsersCache from './blocked-users.js';
import likeStatusCache from './like-status.js';
import searchHistoryCache from './search-history.js';
import refreshFlags from './refresh-flags.js';
import unreadBadge from './unread-badge.js';
import activityBadge from './activity-badge.js';

const stores = {
  avatarCache,
  followCache,
  signatureCache,
  searchCache,
  blockedUsersCache,
  likeStatusCache,
  searchHistoryCache,
  refreshFlags,
  unreadBadge,
  activityBadge
};

export {
  avatarCache,
  followCache,
  signatureCache,
  searchCache,
  blockedUsersCache,
  likeStatusCache,
  searchHistoryCache,
  refreshFlags,
  unreadBadge,
  activityBadge
};

export default stores;

if (typeof module !== 'undefined' && module.exports) {
  module.exports = stores;
  module.exports.default = stores;
}
