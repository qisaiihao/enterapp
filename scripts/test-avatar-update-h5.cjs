// Real save -> navigateBack -> profile onShow, with isolated in-memory cloud fixtures.
const assert = require('node:assert/strict');
const puppeteer = require('puppeteer-core');
const base = process.env.H5_URL || 'http://127.0.0.1:8081/';
(async () => {
  const browser = await puppeteer.launch({ executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 390, height: 844, isMobile: true });
    await page.setRequestInterception(true);
    page.on('request', req => /^https?:/.test(req.url()) && !req.url().startsWith(base) ? req.abort() : req.continue());
    const errors = [];
    page.on('pageerror', err => errors.push(err.message));
    await page.evaluateOnNewDocument(staleProfile => {
      localStorage.clear();
      const user = { _openid: 'avatar-fixture', nickName: '头像测试', poemId: 'avatar-fixture', avatarUrl: '/static/images/avatar.png?old' };
      window.__avatarFixture = { user, calls: [], events: [] };
      window.__tcbAppInstance = {
        __skipAuth: true,
        async uploadFile() { return { fileID: 'cloud://avatar-fixture/new.jpg' }; },
        async getTempFileURL({ fileList }) { return { fileList: fileList.map(fileID => ({ fileID, tempFileURL: '/static/images/avatar.png?new' })) }; },
        async callFunction({ name, data }) {
          window.__avatarFixture.calls.push({ name, data });
          if (name === 'login') return { result: { openid: user._openid } };
          if (name === 'updateUserProfile') Object.assign(user, data);
          const readUser = { ...user };
          if (staleProfile && name === 'getMyProfileData') readUser.avatarUrl = '/static/images/avatar.png?old';
          return { result: { success: true, userInfo: readUser, user: { ...user }, posts: [], activities: [],
            folders: [], count: 0, followerCount: 0, followingCount: 0, unreadCount: 0, config: { enabled: false }, passed: true } };
        }
      };
    }, process.env.STALE_PROFILE === '1');
    await page.goto(base + '#/pages/login/login', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => typeof getCurrentPages === 'function' && getCurrentPages().at(-1)?.$vm);
    await page.evaluate(async () => {
      const { setUserSession } = await import('/utils/app-state.js');
      const { user, events } = window.__avatarFixture;
      setUserSession({ ...user }, user._openid);
      uni.setStorageSync('userInfo', { ...user });
      uni.setStorageSync('userOpenId', user._openid);
      uni.$on('avatar-updated', payload => events.push(payload));
      await uni.switchTab({ url: '/pages/profile/profile' });
    });
    await page.waitForSelector('.profile-avatar-large image, .profile-avatar-large uni-image', { timeout: 20000 });
    await page.evaluate(() => getCurrentPages().at(-1).$vm.navigateToEditProfile());
    await page.waitForFunction(() => getCurrentPages().at(-1)?.route === 'pages-user/profile-edit/profile-edit' && getCurrentPages().at(-1).$vm.originalData.nickName);
    const saved = await page.evaluate(async () => {
      const edit = getCurrentPages().at(-1).$vm;
      edit.processAvatar('/static/images/avatar.png?picked');
      await edit.onSaveChanges();
      const profile = getCurrentPages().find(p => p.route === 'pages/profile/profile').$vm;
      return { avatar: profile.userInfo.avatarUrl, stored: uni.getStorageSync('userInfo')?.avatarUrl, events: window.__avatarFixture.events };
    });
    await page.waitForFunction(() => getCurrentPages().at(-1)?.route === 'pages/profile/profile');
    await page.waitForFunction(() => !getCurrentPages().at(-1).$vm.isAtomicRefreshing);
    const returned = await page.evaluate(() => ({
      avatar: getCurrentPages().at(-1).$vm.userInfo.avatarUrl,
      dom: document.querySelector('.profile-avatar-large img')?.getAttribute('src'),
      stored: uni.getStorageSync('userInfo')?.avatarUrl,
      calls: window.__avatarFixture.calls.map(c => c.name)
    }));
    console.log(JSON.stringify({ saved, returned, errors }, null, 2));
    assert.equal(errors.length, 0);
    assert.equal(saved.events.length, 1, 'save must emit the avatar update');
    assert.match(returned.avatar, /new/, 'returning profile must display saved avatar');
    assert.match(returned.dom, /new/, 'rendered image must also use the saved avatar');
    assert.match(returned.stored, /new/, 'session storage must not be overwritten with old avatar');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
