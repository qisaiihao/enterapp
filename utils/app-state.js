const OPENID_KEYS = ['userOpenId', 'openid'];

const DEFAULT_STATE = {
  userInfo: null,
  openid: null,
  isLoggedIn: false,
  _loginProcessStarted: false,
  _loginProcessCompleted: false
};

function getAppInstance() {
  if (typeof getApp !== 'function') {
    return null;
  }
  try {
    return getApp();
  } catch (_) {
    return null;
  }
}

function ensureState() {
  const app = getAppInstance();
  if (!app) {
    return { ...DEFAULT_STATE };
  }
  app.globalData = app.globalData || {};
  Object.keys(DEFAULT_STATE).forEach((key) => {
    if (typeof app.globalData[key] === 'undefined') {
      app.globalData[key] = DEFAULT_STATE[key];
    }
  });
  return app.globalData;
}

function readOpenidFromStorage() {
  if (typeof uni === 'undefined' || typeof uni.getStorageSync !== 'function') {
    return null;
  }

  for (const key of OPENID_KEYS) {
    try {
      const value = uni.getStorageSync(key);
      if (value) {
        return value;
      }
    } catch (_) {}
  }

  return null;
}

export function getAppState() {
  return ensureState();
}

export function patchAppState(partial = {}) {
  const state = ensureState();
  Object.keys(partial).forEach((key) => {
    state[key] = partial[key];
  });
  return state;
}

export function setUserSession(userInfo, openid = null) {
  const nextOpenid = openid || (userInfo && (userInfo._openid || userInfo.openid)) || null;
  const partial = {
    userInfo: userInfo || null,
    isLoggedIn: !!userInfo
  };

  if (nextOpenid) {
    partial.openid = nextOpenid;
  }

  return patchAppState(partial);
}

export function markLoginProcessStarted() {
  return patchAppState({
    _loginProcessStarted: true
  });
}

export function markLoginProcessCompleted() {
  return patchAppState({
    _loginProcessStarted: true,
    _loginProcessCompleted: true
  });
}

export function getOpenid() {
  const state = ensureState();
  if (state.openid) {
    return state.openid;
  }

  const openid = readOpenidFromStorage();
  if (openid) {
    patchAppState({ openid });
    return openid;
  }

  return null;
}
