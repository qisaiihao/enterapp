const FEED_REFRESH_KEYS = Object.freeze([
  'shouldRefreshIndex',
  'shouldRefreshProfile',
  'shouldRefreshPoem',
  'shouldRefreshMountain'
]);

const ADMIN_ACTIVITY_REFRESH_KEYS = Object.freeze([
  'shouldRefreshAdminActivities',
  'shouldRefreshAdminActivityPosts'
]);

function setRefreshFlag(key, value = true) {
  try {
    uni.setStorageSync(key, value);
  } catch (error) {
    console.error('[refresh-flags] set flag failed:', key, error);
  }
}

function consumeRefreshFlag(key) {
  try {
    const value = uni.getStorageSync(key);
    if (value) {
      uni.removeStorageSync(key);
      return true;
    }
    return false;
  } catch (error) {
    console.error('[refresh-flags] consume flag failed:', key, error);
    return false;
  }
}

function setFeedRefreshFlags() {
  FEED_REFRESH_KEYS.forEach((key) => setRefreshFlag(key, true));
}

function consumeFeedRefreshFlags() {
  const flags = {};
  FEED_REFRESH_KEYS.forEach((key) => {
    flags[key] = consumeRefreshFlag(key);
  });
  return flags;
}

function setAdminActivityRefreshFlag(key) {
  if (!ADMIN_ACTIVITY_REFRESH_KEYS.includes(key)) return;
  setRefreshFlag(key, true);
}

module.exports = {
  FEED_REFRESH_KEYS,
  ADMIN_ACTIVITY_REFRESH_KEYS,
  setRefreshFlag,
  consumeRefreshFlag,
  setFeedRefreshFlags,
  consumeFeedRefreshFlags,
  setAdminActivityRefreshFlag
};
