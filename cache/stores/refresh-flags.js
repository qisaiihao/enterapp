/**
 * 刷新标记缓存存储
 * 
 * 用于跨页面通信，标记某些数据需要刷新
 * 比事件驱动更简单，适合页面重新显示时检查
 * 
 * 命名空间: refresh:flags
 * TTL: 无（手动清除）
 * 持久化: 否（内存缓存即可）
 * 
 * 注意：这是一个过渡方案，后续应该迁移到纯事件驱动
 */
import cacheManager from '../core/manager.js';

const NS = cacheManager.namespace('refresh:flags', { persistent: false, maxItems: 50 });

/**
 * 预定义的刷新标记
 */
const FLAGS = {
  INDEX: 'index',        // 首页
  PROFILE: 'profile',    // 个人主页
  POEM: 'poem',          // 诗歌页
  MOUNTAIN: 'mountain',  // 山页面
  DISCOVER: 'discover',  // 发现页
  USER_POSTS: 'userPosts', // 用户帖子
};

/**
 * 设置刷新标记
 * @param {string} flag - 标记名称
 * @param {boolean} value - 是否需要刷新，默认 true
 */
function setRefreshFlag(flag, value = true) {
  if (!flag) return;
  NS.set(flag, value);
  console.log(`[refresh-flags] 设置刷新标记: ${flag} = ${value}`);
}

/**
 * 获取并清除刷新标记
 * @param {string} flag - 标记名称
 * @returns {boolean} 是否需要刷新
 */
function consumeRefreshFlag(flag) {
  if (!flag) return false;
  const value = NS.get(flag);
  if (value) {
    NS.delete(flag);
    console.log(`[refresh-flags] 消费刷新标记: ${flag}`);
  }
  return !!value;
}

/**
 * 获取刷新标记（不清除）
 * @param {string} flag - 标记名称
 * @returns {boolean} 是否需要刷新
 */
function getRefreshFlag(flag) {
  if (!flag) return false;
  return !!NS.get(flag);
}

/**
 * 清除刷新标记
 * @param {string} flag - 标记名称
 */
function clearRefreshFlag(flag) {
  if (!flag) return;
  NS.delete(flag);
}

/**
 * 设置多个刷新标记
 * @param {string[]} flags - 标记名称数组
 */
function setMultipleRefreshFlags(flags) {
  if (!Array.isArray(flags)) return;
  flags.forEach(flag => setRefreshFlag(flag, true));
}

/**
 * 清除所有刷新标记
 */
function clearAllRefreshFlags() {
  NS.clear();
}

/**
 * 帖子创建后设置相关刷新标记
 */
function onPostCreated() {
  setMultipleRefreshFlags([FLAGS.INDEX, FLAGS.PROFILE, FLAGS.POEM, FLAGS.MOUNTAIN, FLAGS.DISCOVER]);
}

/**
 * 头像/资料更新后设置相关刷新标记
 */
function onProfileUpdated() {
  setMultipleRefreshFlags([FLAGS.INDEX, FLAGS.PROFILE, FLAGS.POEM, FLAGS.MOUNTAIN, FLAGS.DISCOVER]);
}

const refreshFlags = {
  FLAGS,
  setRefreshFlag,
  consumeRefreshFlag,
  getRefreshFlag,
  clearRefreshFlag,
  setMultipleRefreshFlags,
  clearAllRefreshFlags,
  onPostCreated,
  onProfileUpdated,
};

export {
  FLAGS,
  setRefreshFlag,
  consumeRefreshFlag,
  getRefreshFlag,
  clearRefreshFlag,
  setMultipleRefreshFlags,
  clearAllRefreshFlags,
  onPostCreated,
  onProfileUpdated,
};

export default refreshFlags;

if (typeof module !== 'undefined' && module.exports) {
  module.exports = refreshFlags;
  module.exports.default = refreshFlags;
}
