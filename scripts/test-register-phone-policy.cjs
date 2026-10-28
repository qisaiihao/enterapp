const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { parse } = require('@babel/parser');
const { baseParse } = require('@vue/compiler-dom');

const root = path.join(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const quiet = { log() {}, warn() {}, error() {} };
const phone = '13800138000';
const destination = '/pages/poem-square/poem-square';
const existingUser = { _id: 'old-user', _openid: 'old-openid', poemId: 'old-poet', phoneNumber: '' };

// 执行各端实际编译保留的代码，避免把 App 的 isApp getter 带入网页/小程序测试。
function preprocess(source, platform) {
  const stack = [true];
  const compiled = source.split(/\r?\n/).filter(line => {
    const directive = line.replace(/\s*-->\s*$/, '').match(/^\s*(?:\/\/|<!--)\s*#(ifdef|ifndef|endif)\s*(.*?)\s*$/);
    if (!directive) return stack.at(-1);
    const [, kind, target] = directive;
    if (kind === 'endif') {
      assert.ok(stack.length > 1, 'conditional compilation must be balanced');
      stack.pop();
    } else {
      const enabled = target.split(/\s*\|\|\s*/).includes(platform);
      stack.push(stack.at(-1) && (kind === 'ifdef' ? enabled : !enabled));
    }
    return false;
  }).join('\n');
  assert.equal(stack.length, 1, 'conditional compilation must be balanced');
  return compiled;
}

function loadPage(file, platform, globals) {
  let source = preprocess(read(file).match(/<script>([\s\S]*?)<\/script>/)[1], platform);
  const imports = {};
  for (const node of parse(source, { sourceType: 'module' }).program.body.reverse()) {
    if (node.type === 'ImportDeclaration') {
      for (const specifier of node.specifiers) imports[specifier.local.name] = {};
      source = source.slice(0, node.start) + source.slice(node.end);
    } else if (node.type === 'ExportDefaultDeclaration') {
      source = source.slice(0, node.start) + 'module.exports = ' + source.slice(node.declaration.start);
    }
  }
  const context = { module: { exports: {} }, console: quiet, ...imports, ...globals };
  vm.runInNewContext(read('utils/loginClientInfo.js').replace(/^export /gm, ''), context);
  vm.runInNewContext(source, context, { filename: `${file} (${platform})` });
  const page = context.module.exports;
  const state = { ...page.data() };
  for (const [name, method] of Object.entries(page.methods)) state[name] = method.bind(state);
  for (const [name, method] of Object.entries(page.computed)) {
    Object.defineProperty(state, name, { get: method.bind(state) });
  }
  return state;
}

function runtime(platform = 'APP-PLUS', options = {}, file = 'pages/register/register.vue') {
  const calls = [], toasts = [], navigation = [], sessions = [], storage = new Map();
  const timeouts = new Map(), intervals = new Map();
  const appState = { isLoggedIn: false, userInfo: null, openid: null };
  let timerId = 0, authCalls = 0, oneClickCalls = 0;
  const auth = { currentUser: null, async signInAnonymously() { authCalls++; return { uid: 'anonymous' }; } };
  const uni = {
    showToast: data => toasts.push(data), showLoading() {}, hideLoading() {}, showModal() {},
    getStorageSync: key => storage.get(key), setStorageSync: (key, value) => storage.set(key, value),
    switchTab: data => navigation.push(data.url), reLaunch: data => navigation.push(data.url),
    preLogin: data => data.success({}), closeAuthView() {},
    login(data) {
      oneClickCalls++;
      if (options.oneClickError) data.fail(options.oneClickError);
      else data.success(options.oneClickResult || { authResult: { access_token: 'token', openid: 'univerify-openid' } });
    }
  };
  async function cloud(name, data) {
    calls.push({ name, data });
    switch (name) {
      case 'registerUser': return { result: { success: true, openid: 'new-openid', userInfo: { _id: 'new-user', ...data } } };
      case 'getPhoneNumberByToken': return options.phoneResult || { result: { code: 0, phoneNumber: phone } };
      case 'verifySmsCode':
        if (options.verifyError) throw options.verifyError;
        if (options.verifyPromise) return options.verifyPromise;
        return options.verifyResult || { result: { success: true } };
      case 'sendSmsCode': return options.sendResult || { result: { success: true } };
      case 'loginWithCredentials': return { result: { success: true, userInfo: existingUser } };
      case 'updateUser': return { result: { success: true } };
      default: throw new Error(`Unexpected cloud call: ${name}`);
    }
  }
  const globals = {
    uni, wx: { cloud: { auth: () => auth } }, getApp: () => ({ globalData: appState }),
    getCurrentPlatform: () => ({ 'APP-PLUS': 'app', 'APP-HARMONY': 'app-harmony', H5: 'h5', 'MP-WEIXIN': 'mp-weixin' })[platform],
    cloudCall: cloud,
    uniCloud: { callFunction: data => cloud(data.name, data.data) },
    applyAuthenticatedUserSession: async (userInfo, data) => sessions.push({ userInfo, ...data }),
    getAppState: () => appState, getOpenid: () => appState.openid,
    setUserSession(userInfo, openid) { Object.assign(appState, { userInfo, openid }); },
    patchAppState: data => Object.assign(appState, data),
    resetAllCachesOnAccountChange: async () => {},
    setTimeout: callback => { timeouts.set(++timerId, callback); return timerId; },
    clearTimeout: id => timeouts.delete(id),
    setInterval: callback => { intervals.set(++timerId, callback); return timerId; },
    clearInterval: id => intervals.delete(id)
  };
  const state = loadPage(file, platform, globals);
  Object.assign(state, {
    poemId: 'new-poet', nickName: '新用户', password: 'secret-password', confirmPassword: 'secret-password',
    $tcb: { auth: () => auth, callFunction: data => cloud(data.name, data.data) }
  });
  // AppMotion 退出完毕后触发页面的实际关闭 handler 和可选完成回调。
  const busyExpression = binding(phoneModal(file, platform), 'busy')?.exp.content;
  const motion = {
    rendered: false,
    dismiss(callback) {
      if (busyExpression && vm.runInNewContext(busyExpression, { isApp: state.isApp, isBindingPhone: state.isBindingPhone })) return;
      motion.rendered = false;
      state.closeBindPhoneModal();
      if (callback) return callback();
    }
  };
  state.$refs = { phoneMotion: motion };
  return {
    state, calls, toasts, navigation, sessions, storage, intervals, appState,
    get registrations() { return calls.filter(item => item.name === 'registerUser'); },
    get authCalls() { return authCalls; }, get oneClickCalls() { return oneClickCalls; },
    flushNavigation() { for (const [id, callback] of timeouts) { timeouts.delete(id); callback(); } }
  };
}

function elements(node) {
  return [node, ...(node.children || []).flatMap(elements)].filter(item => item.type === 1);
}
function directive(node, name) { return node.props.find(prop => prop.type === 7 && prop.name === name); }
function binding(node, name) {
  return node?.props.find(prop => prop.type === 7 && prop.name === 'bind' && prop.arg?.content === name);
}
function phoneModal(file, platform) {
  const source = read(file);
  const template = preprocess(source.slice(source.indexOf('<template>') + '<template>'.length,
    source.lastIndexOf('</template>', source.indexOf('<script>'))), platform);
  return elements(baseParse(template)).find(node => node.props.some(prop => prop.type === 6 && prop.name === 'ref' && prop.value.content === 'phoneMotion'));
}
function buttonWithText(modal, text) {
  return elements(modal).find(node => node.children.some(child => child.type === 2 && child.content.trim() === text));
}
async function tap(state, button) {
  const expression = directive(button, 'on').exp.content;
  await vm.runInNewContext(expression, { $refs: state.$refs, skipBindPhoneAndRegister: state.skipBindPhoneAndRegister });
}
const settle = () => new Promise(resolve => setImmediate(resolve));

async function appRegistrationTests() {
  const modal = phoneModal('pages/register/register.vue', 'APP-PLUS');
  const skip = buttonWithText(modal, '跳过'), cancel = buttonWithText(modal, '取消');
  assert.equal(directive(skip, 'if').exp.content, '!isApp', 'only non-App registration may display Skip');
  assert.ok(directive(cancel, 'else'), 'App registration displays Cancel instead');
  assert.equal(directive(cancel, 'on').exp.content, '$refs.phoneMotion.dismiss()', 'cancel has no registration callback');

  for (const platform of ['APP-PLUS', 'APP-HARMONY']) {
    for (const fromGithub of [false, true]) {
      const r = runtime(platform);
      r.state.fromGithub = fromGithub;
      r.state.githubData = { openid: 'github-new-user' };
      await r.state.submitRegister();
      assert.equal(r.state.isApp, true);
      assert.equal(r.registrations.length, 0, 'App direct submit without a bound phone cannot register');
      assert.equal(r.authCalls, 0, 'phone requirement runs before anonymous authentication');
      assert.equal(r.state.showBindPhoneModal, true);
      await r.state.skipBindPhoneAndRegister();
      assert.equal(r.registrations.length, 0, 'App cannot bypass binding by calling the old skip method');
      assert.equal(r.state.showBindPhoneModal, true);
    }
  }

  const harmony = runtime('APP-HARMONY');
  await harmony.state.onRegister();
  assert.equal(harmony.state.isApp, true);
  assert.equal(harmony.state.showBindPhoneModal, true, 'Harmony registration opens SMS binding when one-click is unsupported');
  assert.equal(harmony.oneClickCalls, 0);
  assert.equal(harmony.registrations.length, 0);

  const dismissed = runtime();
  Object.assign(dismissed.state, { showBindPhoneModal: true, smsPhoneNumber: phone, smsCode: '123456' });
  dismissed.state.startSmsCountdown();
  dismissed.state.$refs.phoneMotion.rendered = true;
  await tap(dismissed.state, cancel);
  assert.equal(dismissed.state.showBindPhoneModal, false);
  assert.equal(dismissed.state.phoneNumber, '', 'entering a number without verification does not bind it');
  assert.equal(dismissed.intervals.size, 0);
  assert.equal(dismissed.registrations.length, 0, 'App cancel does not create an account');
  dismissed.state.showBindPhoneModal = true;
  dismissed.state.closeBindPhoneModal();
  assert.equal(dismissed.registrations.length, 0, 'mask/close handler does not create an account');
  dismissed.flushNavigation();
  assert.deepEqual(dismissed.navigation, []);

  for (const options of [
    { oneClickError: { errMsg: 'login:fail cancel' } },
    { oneClickResult: {} },
    { phoneResult: { result: { code: -1, message: '获取手机号失败' } } }
  ]) {
    const failed = runtime('APP-PLUS', options);
    await failed.state.onRegister();
    await settle();
    assert.equal(failed.oneClickCalls, 1, 'App registration first attempts one-click binding');
    assert.equal(failed.state.showBindPhoneModal, true, 'one-click failure/cancellation falls back to SMS');
    assert.equal(failed.state.phoneNumber, '');
    assert.equal(failed.registrations.length, 0);
    assert.equal(failed.state.isGettingPhone, false);
  }

  for (const options of [
    { verifyResult: { result: { success: false, message: '验证码错误' } } },
    { verifyError: new Error('network failure') }
  ]) {
    const failed = runtime('APP-PLUS', options);
    Object.assign(failed.state, { showBindPhoneModal: true, smsPhoneNumber: phone, smsCode: '123456' });
    await failed.state.handleBindPhoneForRegister();
    assert.equal(failed.registrations.length, 0, 'unsuccessful SMS verification never registers');
    assert.equal(failed.state.phoneNumber, '');
    assert.equal(failed.state.showBindPhoneModal, true);
    assert.equal(failed.state.isBindingPhone, false);
  }
  const missingCode = runtime();
  missingCode.state.smsPhoneNumber = phone;
  await missingCode.state.handleBindPhoneForRegister();
  assert.equal(missingCode.calls.length, 0, 'an incomplete code does not verify or register');

  for (const method of ['oneclick', 'sms']) {
    const success = runtime();
    if (method === 'oneclick') await success.state.onRegister();
    else {
      Object.assign(success.state, { showBindPhoneModal: true, smsPhoneNumber: phone, smsCode: '123456' });
      await success.state.handleBindPhoneForRegister();
    }
    await settle();
    assert.equal(success.registrations.length, 1, `${method} verified phone completes registration once`);
    assert.equal(success.registrations[0].data.phoneNumber, phone);
    assert.equal(success.sessions.length, 1);
    assert.equal(success.state.isRegistering, false);
    success.flushNavigation();
    assert.deepEqual(success.navigation, [destination]);
    if (method === 'sms') assert.equal(success.calls.find(call => call.name === 'verifySmsCode').data.scene, 'binding');
  }
}

async function unchangedPlatformTests() {
  const web = runtime('H5');
  assert.equal(web.state.isApp, false);
  await web.state.onRegister();
  assert.equal(web.state.showBindPhoneModal, true);
  assert.equal(web.registrations.length, 0);
  assert.equal(web.oneClickCalls, 0);
  const skip = buttonWithText(phoneModal('pages/register/register.vue', 'H5'), '跳过');
  web.state.$refs.phoneMotion.rendered = true;
  await tap(web.state, skip);
  assert.equal(web.registrations.length, 1, 'web registration still supports Skip');
  assert.equal(web.registrations[0].data.phoneNumber, '');
  const mp = runtime('MP-WEIXIN');
  assert.equal(mp.state.isApp, false);
  assert.equal(phoneModal('pages/register/register.vue', 'MP-WEIXIN'), undefined, 'mini-program has no new phone requirement UI');
  await mp.state.onRegister();
  assert.equal(mp.registrations.length, 1, 'mini-program still registers without a phone');
  assert.equal(mp.registrations[0].data.phoneNumber, '');
  assert.equal(mp.state.showBindPhoneModal, false);
  assert.equal(mp.oneClickCalls, 0);
}

async function smsVerificationSnapshotTests() {
  for (const platform of ['APP-PLUS', 'APP-HARMONY', 'H5']) {
    const r = runtime(platform);
    const modal = phoneModal('pages/register/register.vue', platform);
    const busy = binding(modal, 'busy');
    assert.ok(busy, 'registration modal exposes verification busy state');
    const inputs = elements(modal).filter(node => node.tag === 'input');
    assert.equal(inputs.length, 2, 'phone and SMS code inputs are both covered');
    const expressions = [busy, ...inputs.map(node => binding(node, 'disabled'))];
    for (const expression of expressions) {
      assert.ok(expression, 'each verification input exposes disabled state');
      for (const isBindingPhone of [false, true]) {
        const locked = vm.runInNewContext(expression.exp.content, { isApp: r.state.isApp, isBindingPhone });
        assert.equal(locked, platform !== 'H5' && isBindingPhone, 'verification locks only the App modal and inputs');
      }
    }
  }

  for (const platform of ['APP-PLUS', 'H5']) {
    let resolveVerification;
    const verifyPromise = new Promise(resolve => { resolveVerification = resolve; });
    const pending = runtime(platform, { verifyPromise });
    Object.assign(pending.state, { showBindPhoneModal: true, smsPhoneNumber: phone, smsCode: '123456' });
    pending.state.$refs.phoneMotion.rendered = true;
    const verifying = pending.state.handleBindPhoneForRegister();
    assert.equal(pending.state.isBindingPhone, true);
    const request = pending.calls.find(call => call.name === 'verifySmsCode');
    assert.equal(request.data.phone, phone);
    assert.equal(request.data.code, '123456');
    pending.state.smsPhoneNumber = '13900139000';
    pending.state.smsCode = '654321';
    if (platform === 'APP-PLUS') {
      const cancel = buttonWithText(phoneModal('pages/register/register.vue', platform), '取消');
      await tap(pending.state, cancel);
      assert.equal(pending.state.showBindPhoneModal, true, 'App cannot dismiss the modal during verification');
      assert.equal(pending.state.$refs.phoneMotion.rendered, true);
    }
    assert.equal(pending.registrations.length, 0, 'a pending verification cannot create an account');
    resolveVerification({ result: { success: true } });
    await verifying;
    await settle();
    assert.equal(pending.registrations.length, 1);
    assert.equal(pending.registrations[0].data.phoneNumber, phone, 'registration uses the verified request snapshot, even if current inputs changed');
    assert.equal(pending.state.phoneNumber, phone);
    assert.equal(pending.state.isBindingPhone, false);
    assert.equal(pending.state.showBindPhoneModal, false, 'successful verification releases busy state before dismissing');
    assert.equal(pending.state.$refs.phoneMotion.rendered, false);
    assert.equal(pending.state.smsPhoneNumber, '');
    assert.equal(pending.state.smsCode, '');
  }
}

async function existingAccountTests() {
  const old = runtime('APP-PLUS', {}, 'pages/login/login.vue');
  await old.state.handleLoginResult({ result: { success: true, userInfo: existingUser, openid: existingUser._openid, isPhoneVerified: false } });
  assert.equal(old.appState.isLoggedIn, true, 'old App account gets a session without a phone');
  assert.equal(old.storage.get('userOpenId'), existingUser._openid);
  assert.equal(old.state.showBindPhoneModal, true);
  const later = buttonWithText(phoneModal('pages/login/login.vue', 'APP-PLUS'), '稍后再说');
  assert.ok(later, 'old App accounts retain the optional phone binding action');
  old.state.$refs.phoneMotion.rendered = true;
  await tap(old.state, later);
  assert.equal(old.state.showBindPhoneModal, false);
  assert.equal(old.appState.isLoggedIn, true, 'skipping optional binding preserves the existing account session');
  assert.equal(old.appState.userInfo.phoneNumber, '');
  assert.deepEqual(old.navigation, [destination]);
  assert.equal(old.registrations.length, 0);

  const github = runtime();
  Object.assign(github.state, {
    fromGithub: true, bindPoemId: 'old-poet', bindPassword: 'old-password',
    githubData: { openid: 'github-existing', githubEmail: 'old@example.test', accessToken: 'github-token' }
  });
  await github.state.handleBindGithubToAccount();
  assert.equal(github.sessions.length, 1, 'binding GitHub to an existing App account does not require a phone');
  assert.equal(github.sessions[0].openid, existingUser._openid);
  assert.equal(github.registrations.length, 0);
  github.flushNavigation();
  assert.deepEqual(github.navigation, [destination]);
}

Promise.resolve().then(appRegistrationTests).then(smsVerificationSnapshotTests).then(unchangedPlatformTests).then(existingAccountTests).then(() => {
  console.log('[test-register-phone-policy] PASS: App/Harmony phone requirement, cancel/skip guards, one-click/SMS success and failure, verification snapshots and busy UI, H5/MP compatibility, and existing account login/GitHub binding');
}).catch(error => { console.error(error); process.exitCode = 1; });
