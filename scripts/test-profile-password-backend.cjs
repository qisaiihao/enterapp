const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const initialUser = { _id: 'user-1', _openid: 'owner', poemId: 'poet-1', nickName: '小诗人', phoneNumber: '13800138000' };
const oldPassword = 'private-old-password';
const newPassword = 'private-new-password';

function runtime(users = [initialUser], options = {}) {
  let rows = structuredClone(users);
  let version = 0;
  const state = { logs: [], writes: 0, transactions: 0, failQuery: false, failWrite: false, beforeTransaction: null };
  const matches = (row, filter) => Object.entries(filter).every(([key, value]) => row[key] === value);

  function collection(transaction) {
    const data = () => transaction ? transaction.rows : rows;
    return {
      where(filter) {
        let limit = Infinity;
        const query = {
          limit(value) { limit = value; return query; },
          async get() {
            if (state.failQuery) throw new Error(`Database request includes ${newPassword}`);
            return { data: structuredClone(data().filter(row => matches(row, filter)).slice(0, limit)) };
          },
          async update({ data: values }) {
            const selected = data().filter(row => matches(row, filter));
            for (const row of selected) Object.assign(row, structuredClone(values));
            state.writes += selected.length;
            version += 1;
            return { stats: { updated: selected.length } };
          }
        };
        return query;
      },
      doc(id) {
        return {
          async get() { return { data: structuredClone(data().find(row => row._id === id) || null) }; },
          async update({ data: values }) {
            if (state.failWrite) throw new Error(`Database request includes ${values.password}`);
            const row = data().find(item => item._id === id);
            assert.ok(row);
            Object.assign(row, structuredClone(values));
            transaction.writes += 1;
            return { stats: { updated: 1 } };
          }
        };
      }
    };
  }

  const db = {
    collection(name) { assert.equal(name, 'users'); return collection(); },
    async runTransaction(callback) {
      state.transactions += 1;
      if (state.beforeTransaction) {
        const before = state.beforeTransaction;
        state.beforeTransaction = null;
        await before(rows);
        version += 1;
      }
      for (let attempt = 0; attempt < 8; attempt += 1) {
        const start = version;
        const transaction = { rows: structuredClone(rows), writes: 0 };
        const result = await callback({ collection(name) { assert.equal(name, 'users'); return collection(transaction); } });
        if (start !== version) continue;
        if (transaction.writes) {
          rows = transaction.rows;
          state.writes += transaction.writes;
          version += 1;
        }
        return result;
      }
      throw new Error('transaction conflicts');
    }
  };
  const cloud = {
    init() {}, database: () => db,
    getWXContext: () => options.wxContext || { OPENID: 'owner' },
    async callFunction() { return { result: { success: true } }; }
  };
  const log = (...args) => state.logs.push(JSON.stringify(args));
  const cache = {};
  function load(relative) {
    if (cache[relative]) return cache[relative];
    const module = { exports: {} };
    const sandbox = {
      module, exports: module.exports,
      global: options.tcb ? { tcb: { database: () => db } } : {},
      console: { log, warn: log, error: log },
      require(name) {
        if (name === 'wx-server-sdk') return cloud;
        if (name === './password') return load('functions/updateUserProfile/password.js');
        if (name === './_lib/login-audit') return { async recordSuccessfulLogin() {} };
        if (name === './_lib/wechat-auth') return {
          async prepareWechatLogin() { return { needBindWechat: false }; },
          safeUser(user) { const result = { ...user }; delete result.password; return result; }
        };
        throw new Error(`Unexpected module ${name}`);
      }
    };
    vm.runInNewContext(fs.readFileSync(path.join(root, relative), 'utf8'), sandbox, { filename: relative });
    cache[relative] = module.exports;
    return module.exports;
  }
  const main = load('functions/updateUserProfile/index.js').main;
  return {
    state,
    get rows() { return rows; },
    request: (event, context = {}) => main(event, context),
    status: () => main({ action: 'getPasswordStatus' }, {}),
    set: (password = newPassword, extra = {}) => main({ action: 'updatePassword', mode: 'set', newPassword: password, ...extra }, {}),
    change: (previous = oldPassword, password = newPassword, extra = {}) => main({ action: 'updatePassword', mode: 'change', oldPassword: previous, newPassword: password, ...extra }, {}),
    login: load('functions/loginWithCredentials/index.js').main
  };
}

async function main() {
  for (const tcb of [false, true]) {
    const first = runtime([initialUser], { tcb });
    assert.equal((await first.status()).hasPassword, false);
    const set = await first.set();
    assert.equal(set.success, true);
    assert.equal(set.hasPassword, true);
    assert.equal(first.rows[0].password, newPassword);
    assert.equal(Number.isFinite(first.rows[0].passwordUpdatedAt.getTime()), true);
    assert.equal((await first.status()).hasPassword, true);
    assert.equal((await first.login({ account: initialUser.poemId, password: newPassword })).success, true);
    assert.equal((await first.set('other-secret')).code, 'PASSWORD_ALREADY_SET');
    assert.equal(first.rows[0].password, newPassword);
    assert.equal(first.state.writes, 1);
  }

  const existing = runtime([{ ...initialUser, password: oldPassword }]);
  const status = await existing.status();
  assert.deepEqual(Object.keys(status).sort(), ['hasPassword', 'success']);
  assert.equal(status.hasPassword, true);
  const changed = await existing.change();
  assert.equal(changed.success, true);
  assert.equal(existing.rows[0].password, newPassword);
  assert.equal((await existing.login({ account: initialUser.poemId, password: oldPassword })).code, 'INVALID_CREDENTIALS');
  assert.equal((await existing.login({ account: initialUser.phoneNumber, password: newPassword })).success, true);

  const wrong = runtime([{ ...initialUser, password: oldPassword }]);
  assert.equal((await wrong.change('wrong-secret')).code, 'INVALID_OLD_PASSWORD');
  for (const password of ['', undefined, null, { $ne: null }]) {
    assert.equal((await wrong.request({ action: 'updatePassword', mode: 'change', oldPassword: password, newPassword })).code, 'OLD_PASSWORD_REQUIRED');
  }
  assert.equal(wrong.rows[0].password, oldPassword);
  assert.equal(wrong.state.writes, 0);

  for (const password of ['', 'short', 'x'.repeat(33), ' padded ', {}, null, undefined]) {
    const invalid = runtime();
    assert.equal((await invalid.request({ action: 'updatePassword', mode: 'set', newPassword: password })).code, 'INVALID_PASSWORD');
    assert.equal(invalid.state.writes, 0);
  }
  for (const password of ['123456', 'x'.repeat(32), '含有中文的密码', 'inner space']) {
    assert.equal((await runtime().set(password)).success, true);
  }
  for (const mode of ['', undefined, null, {}, 'reset']) {
    assert.equal((await runtime().set(newPassword, { mode })).code, 'INVALID_PASSWORD_MODE');
  }

  const empty = runtime();
  const noPassword = await empty.change();
  assert.equal(noPassword.code, 'PASSWORD_NOT_SET');
  assert.equal(noPassword.hasPassword, false);
  assert.equal(empty.state.writes, 0);

  const hashed = runtime([{ ...initialUser, passwordHash: 'private-hash', passwordSalt: 'private-salt' }]);
  assert.equal((await hashed.status()).hasPassword, true);
  assert.equal((await hashed.set()).code, 'PASSWORD_ALREADY_SET');
  assert.equal((await hashed.change('private-hash')).code, 'PASSWORD_RESET_REQUIRED');
  assert.equal(hashed.state.writes, 0);

  const concurrentSet = runtime();
  const setResults = await Promise.all(['first-secret', 'second-secret'].map(password => concurrentSet.set(password)));
  assert.equal(setResults.filter(result => result.success).length, 1);
  assert.equal(setResults.filter(result => result.code === 'PASSWORD_ALREADY_SET').length, 1);
  assert.equal(concurrentSet.state.writes, 1);

  const concurrentChange = runtime([{ ...initialUser, password: oldPassword }]);
  const changeResults = await Promise.all(['first-secret', 'second-secret'].map(password => concurrentChange.change(oldPassword, password)));
  assert.equal(changeResults.filter(result => result.success).length, 1);
  assert.equal(changeResults.filter(result => result.code === 'INVALID_OLD_PASSWORD').length, 1);
  assert.equal(concurrentChange.state.writes, 1);

  const switched = runtime();
  switched.state.beforeTransaction = rows => { rows[0].password = oldPassword; };
  assert.equal((await switched.set()).code, 'PASSWORD_ALREADY_SET');
  assert.equal(switched.rows[0].password, oldPassword);
  const removed = runtime();
  removed.state.beforeTransaction = rows => { rows.splice(0, 1); };
  assert.equal((await removed.set()).code, 'USER_NOT_FOUND');
  assert.equal(removed.state.writes, 0);

  const missing = runtime([]);
  assert.equal((await missing.status()).code, 'USER_NOT_FOUND');
  assert.equal((await missing.set()).code, 'USER_NOT_FOUND');
  const duplicate = runtime([initialUser, { ...initialUser, _id: 'duplicate' }]);
  assert.equal((await duplicate.status()).code, 'AMBIGUOUS_ACCOUNT');
  assert.equal((await duplicate.set()).code, 'AMBIGUOUS_ACCOUNT');
  const anonymous = runtime([initialUser], { wxContext: {} });
  assert.equal((await anonymous.status()).code, 'NO_OPENID');
  assert.equal((await anonymous.set()).code, 'NO_OPENID');
  assert.equal((await anonymous.set(newPassword, { openid: { $ne: null } })).code, 'NO_OPENID');
  assert.equal((await anonymous.request({ action: 'getPasswordStatus' }, { OPENID: 'owner' })).success, true);

  const noBypass = runtime([{ ...initialUser, password: oldPassword }]);
  for (const field of ['password', 'passwordHash', 'passwordSalt', 'newPassword', 'oldPassword']) {
    assert.equal((await noBypass.request({ [field]: newPassword, region: '上海' })).code, 'PASSWORD_ACTION_REQUIRED');
  }
  assert.equal(noBypass.rows[0].password, oldPassword);
  assert.equal(noBypass.state.writes, 0);
  assert.equal((await noBypass.request({ region: '上海', poemId: 'updated-poem-id' })).success, true);
  assert.equal(noBypass.rows[0].region, '上海');
  assert.equal(noBypass.rows[0].poemId, 'updated-poem-id');
  assert.equal(noBypass.rows[0].password, oldPassword);

  const failed = runtime();
  failed.state.failQuery = true;
  assert.equal((await failed.status()).code, 'PASSWORD_STATUS_FAILED');
  assert.equal((await failed.set()).code, 'PASSWORD_UPDATE_FAILED');
  failed.state.failQuery = false;
  failed.state.failWrite = true;
  assert.equal((await failed.set()).code, 'PASSWORD_UPDATE_FAILED');
  assert.equal(failed.rows[0].password, undefined);
  assert.equal(failed.state.writes, 0);

  for (const example of [existing, wrong, hashed, noBypass, failed]) {
    const serialized = example.state.logs.join('\n');
    for (const secret of [oldPassword, newPassword, 'private-hash', 'private-salt']) {
      assert.equal(serialized.includes(secret), false, `Logs exposed ${secret}`);
    }
  }
  console.log('Profile password backend tests passed: status, first setup, old-password checks, validation, concurrency, login compatibility, failure rollback and redaction.');
}

main().catch(error => { console.error(error); process.exitCode = 1; });
