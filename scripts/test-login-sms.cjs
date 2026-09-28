const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const { parse } = require('@babel/parser');
const root = path.join(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const quiet = { log() {}, warn() {}, error() {} };
const phone = '13800138000';
const idFor = value => `login_${crypto.createHash('sha256').update(value).digest('hex')}`;
const user = { _id: 'user', _openid: 'owner', phoneNumber: phone, poemId: 'poet', password: 'secret' };

function runtime(users = [user], cryptoOverrides = {}) {
  // 模拟旧云端能力：禁止 node: 导入，且不提供较新的 crypto.randomInt。
  const legacyCrypto = {
    createHash: crypto.createHash,
    randomBytes: crypto.randomBytes,
    timingSafeEqual: crypto.timingSafeEqual,
    ...cryptoOverrides
  };
  let tables = { sms_codes: {}, sms_logs: {}, users: Object.fromEntries(users.map(item => [item._id, item])) };
  let version = 0, nextId = 0;
  const state = { sent: [], sendFails: false, dbFails: false, beforeSend: null, beforeTransaction: null, failConsume: false };
  const matches = (row, filter) => Object.entries(filter).every(([key, value]) =>
    value && value.op === 'gte' ? row[key] >= value.value : value && value.op === 'gt' ? row[key] > value.value : row[key] === value);
  function collection(name, transaction) {
    const data = () => (transaction ? transaction.tables : tables)[name];
    const write = () => { if (state.dbFails) throw new Error('db unavailable'); if (transaction) transaction.dirty = true; else version++; };
    return {
      doc(id) {
        return {
          async get() { if (state.dbFails) throw new Error('db unavailable'); return { data: structuredClone(data()[id] || null) }; },
          async set({ data: value }) { write(); data()[id] = { ...structuredClone(value), _id: id }; },
          async update({ data: value }) {
            if (state.failConsume && name === 'sms_codes' && value.used) throw new Error('code write failed');
            write(); assert.ok(data()[id]); Object.assign(data()[id], structuredClone(value));
          }
        };
      },
      async add({ data: value }) { write(); const id = `record-${++nextId}`; data()[id] = { ...structuredClone(value), _id: id }; return { _id: id }; },
      where(filter) {
        let limit = Infinity, order;
        const rows = () => {
          if (state.dbFails) throw new Error('db unavailable');
          let result = Object.values(data()).filter(row => matches(row, filter));
          if (order) result.sort((a, b) => b[order] - a[order]);
          return result.slice(0, limit);
        };
        const query = {
          limit(value) { limit = value; return query; },
          orderBy(key) { order = key; return query; },
          async get() { return { data: structuredClone(rows()) }; },
          async count() { return { total: rows().length }; },
          async update({ data: value }) { const selected = rows(); write(); for (const row of selected) Object.assign(row, structuredClone(value)); return { stats: { updated: selected.length } }; }
        };
        return query;
      }
    };
  }
  const db = {
    command: { gte: value => ({ op: 'gte', value }), gt: value => ({ op: 'gt', value }) },
    collection: name => collection(name),
    async runTransaction(callback) {
      if (state.beforeTransaction) await state.beforeTransaction();
      for (let retry = 0; retry < 12; retry++) {
        const startVersion = version;
        const transaction = { tables: structuredClone(tables), dirty: false };
        const result = await callback({ collection: name => collection(name, transaction) });
        if (startVersion !== version) continue;
        if (transaction.dirty) { tables = transaction.tables; version++; }
        return result;
      }
      throw new Error('transaction conflicts');
    }
  };
  const cloud = { init() {}, database: () => db, getWXContext: () => ({ OPENID: 'wechat', CLIENTIP: 'test-ip' }) };
  const config = { testMode: false, limits: { sendInterval: 60, codeExpireTime: 300, dailyLimitPerPhone: 10, dailyLimitPerIP: 50 } };
  const provider = {
    getProviderName: () => 'TestSms',
    async sendVerificationCode(target, code) {
      state.sent.push({ phone: target, code });
      if (state.beforeSend) await state.beforeSend();
      return { success: !state.sendFails, message: state.sendFails ? 'failure' : 'sent' };
    }
  };
  const cache = {};
  function load(file) {
    if (cache[file]) return cache[file];
    const module = { exports: {} };
    const context = { module, exports: module.exports, console: quiet, Buffer,
      require(name) {
        if (name === 'wx-server-sdk') return cloud;
        if (name === './config') return config;
        if (name === './sms-providers') return { SmsProviderFactory: { createProvider: () => provider } };
        if (name === 'crypto') return legacyCrypto;
        assert.ok(!name.startsWith('node:'), `Cloud runtime does not support ${name}`);
        return load(path.join(path.dirname(file), `${name}.js`));
      }
    };
    vm.runInNewContext(read(file), context, { filename: file });
    cache[file] = module.exports;
    return module.exports;
  }
  return {
    state, config,
    get tables() { return tables; },
    send: load('functions/sendSmsCode/index.js').main,
    login: load('functions/loginWithPhone/index.js').main,
    verify: load('functions/verifySmsCode/index.js').main,
    reset: load('functions/resetPassword/index.js').main,
    credentials: load('functions/loginWithCredentials/index.js').main,
    record: (scene = 'login') => tables.sms_codes[idFor(phone).replace('login_', `${scene}_`)],
    rate: () => tables.sms_codes[idFor(phone).replace('login_', 'login_rate_')],
    code: () => state.sent.at(-1).code,
    cooldown() { tables.sms_codes[idFor(phone).replace('login_', 'login_rate_')].createdAt = new Date(Date.now() - 61000); }
  };
}

async function backendTests() {
  const samples = [0xffffff, 0, 899999];
  const legacy = runtime([user], { randomBytes(size) {
    if (size !== 3) return crypto.randomBytes(size);
    const value = samples.shift();
    assert.notEqual(value, undefined);
    const bytes = Buffer.alloc(3);
    bytes.writeUIntBE(value, 0, 3);
    return bytes;
  } });
  assert.equal((await legacy.send({ phone, scene: 'login' }, {})).success, true);
  assert.equal(legacy.code(), '100000', 'reject out-of-range random bytes before generating the lower bound');
  legacy.cooldown();
  assert.equal((await legacy.send({ phone, scene: 'login' }, {})).success, true);
  assert.equal(legacy.code(), '999999', 'six-digit upper bound');
  assert.equal((await legacy.login({ phoneNumber: phone, code: legacy.code() })).success, true);
  assert.equal(samples.length, 0);
  const r = runtime();
  assert.equal((await r.login({ phoneNumber: phone })).code, 'INVALID_CODE');
  assert.equal((await r.login({ phoneNumber: phone, code: '123456' })).success, false);
  for (const input of [undefined, {}, { phone: { $ne: null }, scene: 'login' }]) assert.equal((await r.send(input, {})).success, false);
  const sent = await r.send({ phone: `+86${phone}`, scene: 'login' }, {});
  assert.equal(sent.success, true);
  assert.equal(sent.data.remainTime, 60);
  assert.equal(sent.data.expireTime, 300);
  assert.equal(r.state.sent[0].phone, phone);
  assert.equal(r.record().code, undefined, 'login codes are not stored in plaintext');
  assert.equal(r.record().status, 'sent');
  assert.equal((await r.send({ phone, scene: 'login' }, {})).code, 'SEND_LIMIT_EXCEEDED');
  assert.equal(r.state.sent.length, 1);
  assert.equal((await r.verify({ phone, code: r.code(), scene: 'login' })).code, 'INVALID_SCENE');
  assert.equal((await r.login({ phoneNumber: '13900139000', code: r.code() })).success, false);
  const success = await r.login({ phoneNumber: `+86${phone}`, code: r.code() });
  assert.equal(success.success, true);
  assert.equal(success.openid, 'owner');
  assert.equal(success.userInfo.password, undefined);
  assert.equal(success.needBindWechat, true);
  assert.equal(success.isPhoneVerified, true);
  assert.equal((await r.login({ phoneNumber: phone, code: r.code() })).success, false, 'replay must fail');

  const wrong = runtime();
  await wrong.send({ phone, scene: 'login' }, {});
  const wrongCode = wrong.code() === '000000' ? '999999' : '000000';
  for (let count = 1; count <= 5; count++) {
    assert.equal((await wrong.login({ phoneNumber: phone, code: wrongCode })).code, count === 5 ? 'CODE_ATTEMPTS_EXCEEDED' : 'CODE_INVALID');
  }
  assert.equal((await wrong.login({ phoneNumber: phone, code: wrong.code() })).code, 'CODE_ATTEMPTS_EXCEEDED');
  const previousCode = wrong.code();
  wrong.cooldown();
  await wrong.send({ phone, scene: 'login' }, {});
  assert.equal(wrong.record().attempts, 0);
  if (previousCode !== wrong.code()) assert.equal((await wrong.login({ phoneNumber: phone, code: previousCode })).success, false);
  wrong.record().expiredAt = new Date(Date.now() - 1);
  assert.equal((await wrong.login({ phoneNumber: phone, code: wrong.code() })).success, false);

  const concurrent = runtime();
  const sends = await Promise.all([concurrent.send({ phone, scene: 'login' }, {}), concurrent.send({ phone, scene: 'login' }, {})]);
  assert.equal(sends.filter(result => result.success).length, 1);
  assert.equal(concurrent.state.sent.length, 1);
  const logins = await Promise.all([concurrent.login({ phoneNumber: phone, code: concurrent.code() }), concurrent.login({ phoneNumber: phone, code: concurrent.code() })]);
  assert.equal(logins.filter(result => result.success).length, 1, 'only one transaction consumes the code');

  for (const [users, expected] of [[[], 'PHONE_NOT_REGISTERED'], [[user, { ...user, _id: 'duplicate' }], 'AMBIGUOUS_ACCOUNT']]) {
    const scenario = runtime(users);
    await scenario.send({ phone, scene: 'login' }, {});
    assert.equal((await scenario.login({ phoneNumber: phone, code: scenario.code() })).code, expected);
    assert.equal(scenario.record().used, true);
  }
  const failed = runtime();
  failed.state.sendFails = true;
  assert.equal((await failed.send({ phone, scene: 'login' }, {})).code, 'SEND_FAILED');
  assert.equal((await failed.login({ phoneNumber: phone, code: failed.code() })).success, false);
  failed.state.dbFails = true;
  assert.equal((await failed.send({ phone: '13900139000', scene: 'login' }, {})).success, false);
  assert.equal(failed.state.sent.length, 1, 'database failure must not send an SMS');
  assert.equal((await failed.login({ phoneNumber: phone, code: failed.code() })).success, false);

  const pending = runtime();
  pending.state.beforeSend = async () => assert.equal((await pending.login({ phoneNumber: phone, code: pending.code() })).success, false);
  await pending.send({ phone, scene: 'login' }, {});
  pending.cooldown();
  pending.rate().sendCount = 10;
  delete pending.tables.sms_codes[idFor(phone)];
  assert.equal((await pending.send({ phone, scene: 'login' }, {})).code, 'SEND_LIMIT_EXCEEDED');
  const ip = runtime();
  ip.config.limits.dailyLimitPerIP = 1;
  await ip.send({ phone, scene: 'login' }, {});
  assert.equal((await ip.send({ phone: '13900139000', scene: 'login' }, {})).code, 'SEND_LIMIT_EXCEEDED');
  const binding = runtime();
  await binding.send({ phone, scene: 'binding' }, {});
  assert.equal((await binding.login({ phoneNumber: phone, code: binding.code() })).success, false, 'binding code cannot log in');
  assert.equal((await binding.verify({ phone, code: binding.code(), scene: 'binding' })).success, true, 'existing binding still works');
}

async function resetTests() {
  const r = runtime([user, { ...user, _id: 'other', phoneNumber: '13900139000', poemId: 'other-poet' }]);
  const request = () => ({ phoneNumber: phone, code: r.code(), newPassword: 'new-secret', openid: 'other', userId: 'other' });
  assert.equal((await r.send({ phone, scene: 'resetPassword' }, {})).success, true);
  assert.equal(r.record('resetPassword').scene, 'resetPassword');
  assert.equal((await r.send({ phone, scene: 'login' }, {})).code, 'SEND_LIMIT_EXCEEDED', 'login and reset share quota');
  assert.equal((await r.login({ phoneNumber: phone, code: r.code() })).success, false, 'reset code cannot log in');
  assert.equal((await r.verify({ phone, code: r.code(), scene: 'resetPassword' })).success, false, 'generic verifier cannot consume reset code');
  for (const newPassword of ['', 'short', 'a'.repeat(33), ' padded ', {}, null]) {
    assert.equal((await r.reset({ ...request(), newPassword })).code, 'INVALID_PASSWORD');
  }
  assert.equal((await r.reset({ ...request(), code: undefined })).code, 'INVALID_CODE');
  assert.equal((await r.reset({ ...request(), phoneNumber: {} })).code, 'INVALID_PHONE');
  assert.equal((await r.reset({ ...request(), code: '000000' })).success, false);
  assert.equal(r.tables.users.user.password, 'secret');
  const success = await r.reset(request());
  assert.equal(success.success, true);
  assert.equal(success.userInfo, undefined, 'reset must not log in automatically or return user data');
  assert.equal(r.tables.users.user.password, 'new-secret');
  assert.equal(r.tables.users.other.password, 'secret', 'caller-provided user ID is ignored');
  assert.equal(r.record('resetPassword').used, true);
  assert.equal((await r.reset({ ...request(), newPassword: 'replayed-secret' })).success, false);
  assert.equal((await r.credentials({ account: phone, password: 'secret' })).success, false);
  assert.equal((await r.credentials({ account: phone, password: 'new-secret' })).success, true);

  const wrongScene = runtime();
  await wrongScene.send({ phone, scene: 'login' }, {});
  assert.equal((await wrongScene.reset({ phoneNumber: phone, code: wrongScene.code(), newPassword: 'new-secret' })).success, false);
  wrongScene.cooldown();
  await wrongScene.send({ phone, scene: 'binding' }, {});
  assert.equal((await wrongScene.reset({ phoneNumber: phone, code: wrongScene.code(), newPassword: 'new-secret' })).success, false);

  const attempts = runtime();
  await attempts.send({ phone, scene: 'resetPassword' }, {});
  const failures = await Promise.all(Array.from({ length: 5 }, () => attempts.reset({ phoneNumber: phone, code: '000000', newPassword: 'new-secret' })));
  assert.equal(failures.filter(item => item.success).length, 0);
  assert.equal(attempts.record('resetPassword').attempts, 5);
  assert.equal((await attempts.reset({ phoneNumber: phone, code: attempts.code(), newPassword: 'new-secret' })).code, 'CODE_ATTEMPTS_EXCEEDED');
  attempts.cooldown();
  await attempts.send({ phone, scene: 'resetPassword' }, {});
  attempts.record('resetPassword').expiredAt = new Date(Date.now() - 1);
  assert.equal((await attempts.reset({ phoneNumber: phone, code: attempts.code(), newPassword: 'new-secret' })).success, false);

  const concurrent = runtime();
  await concurrent.send({ phone, scene: 'resetPassword' }, {});
  const results = await Promise.all(['first-secret', 'second-secret'].map(newPassword => concurrent.reset({ phoneNumber: phone, code: concurrent.code(), newPassword })));
  assert.equal(results.filter(item => item.success).length, 1, 'one reset per code');

  const rollback = runtime();
  await rollback.send({ phone, scene: 'resetPassword' }, {});
  rollback.state.failConsume = true;
  assert.equal((await rollback.reset({ phoneNumber: phone, code: rollback.code(), newPassword: 'new-secret' })).code, 'RESET_FAILED');
  assert.equal(rollback.tables.users.user.password, 'secret', 'password update rolls back when code consumption fails');
  assert.equal(rollback.record('resetPassword').used, false);
  rollback.state.failConsume = false;
  assert.equal((await rollback.reset({ phoneNumber: phone, code: rollback.code(), newPassword: 'new-secret' })).success, true);

  for (const [users, expected] of [[[], 'PHONE_NOT_REGISTERED'], [[user, { ...user, _id: 'duplicate' }], 'AMBIGUOUS_ACCOUNT']]) {
    const scenario = runtime(users);
    await scenario.send({ phone, scene: 'resetPassword' }, {});
    assert.equal((await scenario.reset({ phoneNumber: phone, code: scenario.code(), newPassword: 'new-secret' })).code, expected);
    for (const stored of Object.values(scenario.tables.users)) assert.equal(stored.password, 'secret');
  }
  const changed = runtime();
  await changed.send({ phone, scene: 'resetPassword' }, {});
  changed.state.beforeTransaction = () => { changed.tables.users.user.phoneNumber = '13900139000'; };
  assert.equal((await changed.reset({ phoneNumber: phone, code: changed.code(), newPassword: 'new-secret' })).code, 'PHONE_CHANGED');
  assert.equal(changed.tables.users.user.password, 'secret');
}

async function frontendTests() {
  const r = runtime();
  const toasts = [], intervals = new Map();
  let timerId = 0;
  const context = { module: { exports: {} }, console: quiet,
    uni: { showToast: data => toasts.push(data), showLoading() {}, hideLoading() {} },
    setInterval: callback => { intervals.set(++timerId, callback); return timerId; },
    clearInterval: id => intervals.delete(id)
  };
  let source = read('pages/login/login.vue').match(/<script>([\s\S]*?)<\/script>/)[1];
  for (const node of parse(source, { sourceType: 'module' }).program.body.reverse()) {
    if (node.type === 'ImportDeclaration') {
      for (const specifier of node.specifiers) context[specifier.local.name] = {};
      source = source.slice(0, node.start) + source.slice(node.end);
    } else if (node.type === 'ExportDefaultDeclaration') source = source.slice(0, node.start) + 'module.exports = ' + source.slice(node.declaration.start);
  }
  vm.runInNewContext(source, context);
  const page = context.module.exports;
  const state = { ...page.data() };
  for (const [name, method] of Object.entries(page.methods)) state[name] = method.bind(state);
  for (const [name, method] of Object.entries(page.computed)) Object.defineProperty(state, name, { get: method.bind(state) });
  state.callCloudFunction = (name, data) => name === 'sendSmsCode' ? r.send(data, {}) : r.login(data);
  let loggedIn = false;
  state.handleLoginResult = async result => { assert.equal(result.success, true); loggedIn = true; };
  state.switchLoginMethod('sms');
  assert.equal(state.canLogin, false);
  await state.sendLoginSmsCode();
  assert.equal(r.state.sent.length, 0);
  state.loginPhoneNumber = phone;
  await state.sendLoginSmsCode();
  assert.equal(state.loginSmsCountdown, 60);
  assert.equal(state.isSendingLoginSms, false);
  await state.sendLoginSmsCode();
  assert.equal(r.state.sent.length, 1);
  state.loginSmsCode = r.code();
  assert.equal(state.canLogin, true);
  await state.onLogin();
  assert.equal(loggedIn, true);
  assert.equal(state.isLogging, false);
  state.isLogging = true;
  state.switchLoginMethod('password');
  assert.equal(state.loginMethod, 'sms');
  state.isLogging = false;
  state.loginSmsDeadline = Date.now() - 1000;
  page.onShow.call(state);
  assert.equal(state.loginSmsCountdown, 0);
  assert.equal(intervals.size, 0);
  // The recovery form validates matching passwords, sends its own scene and returns to login.
  r.cooldown();
  state.switchLoginMethod('reset');
  state.callCloudFunction = (name, data) => name === 'sendSmsCode' ? r.send(data, {}) : r.reset(data);
  await state.sendLoginSmsCode();
  assert.equal(r.record('resetPassword').scene, 'resetPassword');
  state.loginSmsCode = r.code();
  state.resetNewPassword = 'new-secret';
  state.resetConfirmPassword = 'different';
  await state.submitPasswordReset();
  assert.equal(toasts.at(-1).title, '两次输入的密码不一致');
  assert.equal(r.tables.users.user.password, 'secret');
  state.resetConfirmPassword = 'new-secret';
  await state.submitPasswordReset();
  assert.equal(r.tables.users.user.password, 'new-secret');
  assert.equal(state.loginMethod, 'password');
  assert.equal(state.account, phone);
  assert.equal(state.password, '');
  assert.equal(state.resetNewPassword, '');
  assert.equal(state.resetConfirmPassword, '');
  assert.equal(state.loginSmsCode, '');
  state.loginSmsDeadline = Date.now() - 1000;
  page.onShow.call(state);
  state.callCloudFunction = async () => ({ result: { success: false, code: 'SEND_LIMIT_EXCEEDED', data: { remainTime: 25 } } });
  await state.sendLoginSmsCode();
  assert.equal(state.loginSmsCountdown, 25);
  page.onUnload.call(state);
  assert.equal(intervals.size, 0);
  state.startLoginSmsCountdown();
  assert.equal(intervals.size, 0, 'unloaded page must not start a timer');
}

async function logRedactionTests() {
  const logs = [];
  let submitted;
  const source = read('utils/cloudCall.js').replace(/^import .*;\r?$/gm, '').replace('export async function cloudCall', 'async function cloudCall').replace('export default', 'const exportedHelpers =');
  const context = {
    module: { exports: {} }, console: { log: (...args) => logs.push(args), warn() {}, error() {} },
    getCloudFunctionMethod: () => 'tcb'
  };
  vm.runInNewContext(source + '\nmodule.exports = cloudCall;', context);
  await context.module.exports('resetPassword', { newPassword: 'private-new-password', code: '654321' }, {
    injectOpenId: false, context: { $tcb: { __skipAuth: true, async callFunction(options) { submitted = options.data; return { result: { success: true } }; } } }
  });
  assert.equal(submitted.newPassword, 'private-new-password');
  assert.equal(submitted.code, '654321');
  assert.ok(!JSON.stringify(logs).includes('private-new-password'));
  assert.ok(!JSON.stringify(logs).includes('654321'));
}

Promise.resolve().then(backendTests).then(resetTests).then(frontendTests).then(logRedactionTests).then(() => {
  console.log('SMS login/recovery tests passed: isolation, rate limits, expiry, attempts, atomic reset, replay, compatibility, forms and log redaction.');
}).catch(error => { console.error(error); process.exitCode = 1; });
