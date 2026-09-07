const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

let allowed = false;
let stored = null;
let readError = null;
let writes = 0;
const db = {
  command: { aggregate: {} },
  serverDate: () => 'server-time',
  collection(name) {
    assert.equal(name, 'adminConfig');
    return {
      doc(id) {
        assert.equal(id, 'contact');
        return { async set({ data }) { stored = data; writes++; } };
      },
      where(query) {
        assert.equal(query._id, 'contact');
        return { limit: () => ({ async get() {
          if (readError) throw readError;
          return { data: stored ? [stored] : [] };
        } }) };
      }
    };
  }
};
function load(relativePath) {
  const sandbox = {
    exports: {}, console: { log() {}, error() {} },
    require(name) {
      if (name === 'wx-server-sdk') return { init() {}, database: () => db };
      if (name === './_lib/admin-auth') return { isAdminByPoemId: async () => allowed };
      if (name === './_lib/activity') return {};
      throw new Error(`Unexpected dependency: ${name}`);
    }
  };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', relativePath), 'utf8'), sandbox);
  return sandbox.exports.main;
}

(async () => {
  const save = load('functions/adminManager/index.js');
  const read = load('functions/getContactConfig/index.js');
  assert.equal((await read()).contactText, '');
  const event = { action: 'updateContactConfig', openid: 'test-admin', qrCode: 'cloud://env/contact/qr.png', contactText: ' 微信：example\n邮箱：a@example.com ' };
  assert.equal((await save(event)).success, false);
  assert.equal(writes, 0, 'Non-admin must not write');
  allowed = true;
  assert.equal((await save({ ...event, openid: '' })).success, false);
  for (const invalid of [
    { qrCode: '' }, { qrCode: '/tmp/qr.png' }, { qrCode: null },
    { contactText: '   ' }, { contactText: 'a'.repeat(2001) }, { contactText: {} }
  ]) assert.equal((await save({ ...event, ...invalid })).success, false);
  assert.equal(writes, 0, 'Invalid input must not write');
  assert.equal((await save(event)).success, true);
  assert.equal(writes, 1);
  const config = await read();
  assert.equal(config.contactText, event.contactText.trim());
  assert.equal(config.qrCode, event.qrCode);
  assert.equal(config.updatedBy, undefined, 'Public endpoint must omit administrator metadata');
  await save({ ...event, qrCode: 'cloud://env/contact/new.png', contactText: '新联系方式' });
  assert.equal((await read()).contactText, '新联系方式');
  readError = { errCode: -502005 };
  assert.equal((await read()).success, true, 'Missing collection should show an empty state');
  readError = new Error('Network unavailable');
  assert.equal((await read()).success, false, 'Operational errors must not look like empty configuration');
  console.log('Contact configuration tests passed');
})().catch(error => { console.error(error); process.exitCode = 1; });
