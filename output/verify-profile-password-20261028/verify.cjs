const assert = require('node:assert/strict');
const path = require('node:path');
const puppeteer = require('puppeteer-core');

(async () => {
  const base = 'http://127.0.0.1:8081/';
  const browser = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
    await page.setRequestInterception(true);
    page.on('request', request => /^https?:/.test(request.url()) && !request.url().startsWith(base) ? request.abort() : request.continue());
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.evaluateOnNewDocument(() => {
      localStorage.clear();
      const user = { _openid: 'password-fixture', nickName: '密码测试', poemId: 'long-poem-id-for-layout', avatarUrl: '/static/images/avatar.png', phoneNumber: '13800138000' };
      window.__passwordFixture = { user, password: '', writes: 0 };
      window.__tcbAppInstance = {
        __skipAuth: true,
        async callFunction({ name, data }) {
          const fixture = window.__passwordFixture;
          if (name === 'login') return { result: { openid: user._openid } };
          if (name === 'updateUserProfile' && data.action === 'getPasswordStatus') return { result: { success: true, hasPassword: !!fixture.password } };
          if (name === 'updateUserProfile' && data.action === 'updatePassword') {
            if (fixture.password && data.oldPassword !== fixture.password) return { result: { success: false, code: 'INVALID_OLD_PASSWORD', message: '原密码错误，请重新输入' } };
            fixture.password = data.newPassword;
            fixture.writes++;
            return { result: { success: true, hasPassword: true } };
          }
          return { result: { success: true, userInfo: { ...user }, posts: [], activities: [], folders: [], config: { enabled: false } } };
        }
      };
    });
    await page.goto(base + '#/pages/login/login', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => typeof getCurrentPages === 'function' && getCurrentPages().at(-1)?.$vm);
    await page.evaluate(async () => {
      const { setUserSession } = await import('/utils/app-state.js');
      const user = window.__passwordFixture.user;
      setUserSession({ ...user }, user._openid);
      uni.setStorageSync('userInfo', { ...user });
      uni.setStorageSync('userOpenId', user._openid);
      await uni.navigateTo({ url: '/pages-user/profile-edit/profile-edit' });
    });
    await page.waitForFunction(() => getCurrentPages().at(-1)?.$vm.originalData?.nickName === '密码测试');
    await page.waitForFunction(() => document.querySelector('.poem-id-input input')?.value === 'long-poem-id-for-layout');
    const selector = '.profile-edit-page > .container .password-edit-link';
    const layout = await page.$eval(selector, element => {
      const link = element.getBoundingClientRect();
      const input = element.parentElement.querySelector('.poem-id-input').getBoundingClientRect();
      return { underline: getComputedStyle(element).textDecorationLine, inputRight: input.right, linkLeft: link.left, right: link.right, width: innerWidth };
    });
    assert.equal(layout.underline, 'underline');
    assert.ok(layout.inputRight <= layout.linkLeft && layout.right <= layout.width, JSON.stringify(layout));
    await page.screenshot({ path: path.join(__dirname, 'profile-390.png') });
    await page.evaluate(() => { getCurrentPages().at(-1).$vm.onNicknameInput({ detail: { value: '未保存昵称' } }); });
    await page.click(selector);
    await page.waitForFunction(() => document.querySelector('.edit-password-modal .modal-title')?.textContent === '设置密码');
    await page.$eval('.edit-password-modal', async element => { await Promise.all(element.getAnimations({ subtree: true }).map(animation => animation.finished)); });
    assert.equal(await page.$$eval('.edit-password-modal input', elements => elements.length), 2);
    await page.screenshot({ path: path.join(__dirname, 'set-password-390.png') });
    const fill = async values => {
      const inputs = await page.$$('.edit-password-modal input');
      for (let index = 0; index < inputs.length; index++) {
        await inputs[index].click({ clickCount: 3 });
        await inputs[index].press('Backspace');
        await inputs[index].type(values[index], { delay: 30 });
      }
    };
    await fill(['test-new-password', 'test-new-password']);
    await page.click('.edit-password-modal .confirm-btn');
    await page.waitForFunction(() => !document.querySelector('.edit-password-modal')).catch(async error => {
      console.log(await page.evaluate(() => {
        const edit = getCurrentPages().at(-1).$vm;
        return { error: edit.passwordError, checking: edit.isCheckingPassword, updating: edit.isUpdatingPassword,
          newLength: edit.newPassword.length, confirmLength: edit.confirmPassword.length, owner: edit.passwordOwnerOpenid,
          fakePasswords: [edit.newPassword, edit.confirmPassword],
          storedOwner: uni.getStorageSync('userOpenId'), writes: window.__passwordFixture.writes };
      }));
      throw error;
    });
    assert.equal(await page.evaluate(() => window.__passwordFixture.password), 'test-new-password');
    assert.equal(await page.evaluate(() => getCurrentPages().at(-1).$vm.nickName), '未保存昵称');
    await page.click(selector);
    await page.waitForFunction(() => document.querySelectorAll('.edit-password-modal input').length === 3);
    await page.$eval('.edit-password-modal', async element => { await Promise.all(element.getAnimations({ subtree: true }).map(animation => animation.finished)); });
    await fill(['wrong-password', 'test-changed-password', 'test-changed-password']);
    await page.click('.edit-password-modal .confirm-btn');
    await page.waitForFunction(() => document.querySelector('.edit-password-modal .password-error')?.textContent.includes('原密码错误'));
    assert.equal(await page.evaluate(() => window.__passwordFixture.writes), 1);
    await page.screenshot({ path: path.join(__dirname, 'change-password-390.png') });
    await fill(['test-new-password', 'test-changed-password', 'test-changed-password']);
    await page.click('.edit-password-modal .confirm-btn');
    await page.waitForFunction(() => !document.querySelector('.edit-password-modal'));
    assert.equal(await page.evaluate(() => window.__passwordFixture.password), 'test-changed-password');
    await page.setViewport({ width: 320, height: 720, isMobile: true, hasTouch: true });
    const narrow = await page.$eval(selector, element => {
      const link = element.getBoundingClientRect();
      const input = element.parentElement.querySelector('.poem-id-input').getBoundingClientRect();
      return { inputWidth: input.width, inputRight: input.right, linkLeft: link.left, right: link.right, width: innerWidth };
    });
    assert.ok(narrow.inputWidth > 0 && narrow.inputRight <= narrow.linkLeft && narrow.right <= narrow.width, JSON.stringify(narrow));
    await page.screenshot({ path: path.join(__dirname, 'profile-320.png') });
    await page.click(selector);
    await page.waitForFunction(() => document.querySelectorAll('.edit-password-modal input').length === 3);
    await page.$eval('.edit-password-modal', async element => { await Promise.all(element.getAnimations({ subtree: true }).map(animation => animation.finished)); });
    await page.screenshot({ path: path.join(__dirname, 'change-password-320.png') });
    assert.deepEqual(errors, []);
    console.log(JSON.stringify({ passed: true, layout, narrow, writes: 2, errors }));
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
