/**
 * 业务缓存存储统一导出
 */

const avatarCache = require('./avatar');
const followCache = require('./follow');
const signatureCache = require('./signature');
const { searchCache } = require('./search');
const blockedUsersCache = require('./blocked-users');
const likeStatusCache = require('./like-status');
const searchHistoryCache = require('./search-history');
const refreshFlags = require('./refresh-flags');
const unreadBadge = require('./unread-badge');

module.exports = {
  avatarCache,
  followCache,
  signatureCache,
  searchCache,
  blockedUsersCache,
  likeStatusCache,
  searchHistoryCache,
  refreshFlags,
  unreadBadge
};
