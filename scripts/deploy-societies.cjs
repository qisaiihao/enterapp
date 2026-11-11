'use strict';
// Scope is deliberately limited to societyManager and the society collections.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { createManager, initialize } = require('./init-societies-db.cjs');
const root = path.resolve(__dirname, '..');
const INDEXES = {
  societies: [['status', '-createdAt']],
  society_applications: [['status', '-submittedAt']],
  society_members: [['societyId', 'status', '-joinedAt'], ['userId', 'status', '-createdAt']],
  society_join_requests: [['societyId', 'status', '-createdAt'], ['userId', '-createdAt']],
  society_follows: [['userId', 'following', '-createdAt']],
  society_publications: [['status', '-publishedAt'], ['societyId', 'status', '-publishedAt'], ['societyId', 'authorId', 'status', '-publishedAt']],
  society_news: [['status', '-createdAt'], ['societyId', 'status', '-createdAt'], ['societyId', 'status', '-pinned', '-createdAt', '-_id']],
  society_events: [['status', '-createdAt'], ['societyId', 'status', '-createdAt'], ['societyId', 'status', '-createdAt', '-_id'], ['societyId', 'status', 'endTime']],
  society_calls: [['status', '-createdAt'], ['status', '-createdAt', '-_id'], ['status', 'deadline', '-_id'], ['status', '-deadline', '-_id'], ['societyId', 'status', '-createdAt'], ['societyId', 'status', '-createdAt', '-_id'], ['hostSocietyIds', 'status', '-createdAt'], ['invitedSocietyIds', 'status', '-createdAt']],
  society_registrations: [['eventId', 'status', '-createdAt'], ['userId', '-createdAt'], ['societyId', 'status']],
  society_submissions: [['callId', 'status', '-createdAt'], ['callId', '-createdAt'], ['userId', '-createdAt'], ['societyId', 'status', '-submittedAt']],
  society_notifications: [['userId', '-createdAt'], ['userId', 'category', '-createdAt'], ['userId', 'read']]
};
async function main() {
  const args = process.argv.slice(2);
  assert.ok(args.every(arg => ['--apply', '--verify'].includes(arg)), '参数仅支持 --apply / --verify');
  const { envId } = require('../cloudbaserc.json');
  if (!args.length) { console.log(JSON.stringify({ envId, function: 'societyManager', indexes: INDEXES, mode: 'preview' }, null, 2)); return; }
  const manager = await createManager({ envId });
  const output = path.join(root, 'output/societies-deploy-20261102');
  fs.mkdirSync(output, { recursive: true });
  if (args.includes('--apply')) {
    const detail = await manager.functions.getFunctionDetail('societyManager');
    const download = await manager.functions.getFunctionDownloadUrl('societyManager');
    const backup = path.join(output, `before-${Date.now()}.zip`);
    const response = await fetch(download.Url);
    assert.ok(response.ok, '旧代码备份失败');
    fs.writeFileSync(backup, Buffer.from(await response.arrayBuffer()));
    fs.writeFileSync(backup + '.json', JSON.stringify({ runtime: detail.Runtime, timeout: detail.Timeout, memory: detail.MemorySize, hash: download.CodeSha256 }, null, 2));
    console.log('旧版函数已备份');
    await initialize(manager, envId, console.log);
    for (const [table, definitions] of Object.entries(INDEXES)) {
      const existing = (await manager.database.describeCollection(table)).Indexes || [];
      for (const keys of definitions) {
        const schema = keys.map(key => ({ Name: key.replace(/^-/, ''), Direction: key.startsWith('-') ? '-1' : '1' }));
        if (existing.some(index => index.Keys?.length === schema.length && index.Keys.every((key, i) => key.Name === schema[i].Name && String(key.Direction) === schema[i].Direction))) continue;
        const name = indexName(keys);
        if (existing.some(index => index.Name === name)) throw Object.assign(new Error(), { code: 'INDEX_DEFINITION_CONFLICT' });
        await manager.database.updateCollection(table, { CreateIndexes: [{ IndexName: name, MgoKeySchema: { MgoIndexKeys: schema, MgoIsUnique: false } }] });
        console.log(`[索引] ${table}/${name}`);
      }
    }
    await manager.functions.updateFunctionConfig({ name: 'societyManager', timeout: 300, memorySize: 256 });
    await manager.functions.updateFunctionCode({ func: { name: 'societyManager', runtime: detail.Runtime, handler: 'index.main', installDependency: true, isWaitInstall: true }, functionPath: path.join(root, 'functions/societyManager') });
    console.log('societyManager 已更新');
  }
  const verification = { envId, checkedAt: new Date().toISOString(), checks: [] };
  const detail = await manager.functions.getFunctionDetail('societyManager');
  assert.equal(detail.Status, 'Active');
  for (const action of ['home', 'list', 'callList', 'publicMembers', 'saveContent', 'registration', 'registrations', 'submitWork', 'reviewWork', 'myParticipation', 'publishWork', 'statistics', 'acceptHost', 'memberList', 'requestList', 'changeMember', 'updateSociety', 'notifications', 'unreadNotifications', 'readNotification']) {
    const response = await manager.functions.invokeFunction('societyManager', { action });
    assert.equal(response.InvokeResult, 0);
    const result = JSON.parse(response.RetMsg);
    if (['home', 'list', 'callList'].includes(action)) assert.equal(result.success, true, action);
    else if (action === 'publicMembers') assert.equal(result.code, 'INVALID_REQUEST', action);
    else assert.equal(result.code, 'AUTH_REQUIRED', action);
    verification.checks.push({ action, success: result.success, code: result.code });
  }
  fs.writeFileSync(path.join(output, 'verification.json'), JSON.stringify(verification, null, 2));
  console.log('线上公开读取与20项接口鉴权检查通过');
}
if (require.main === module) main().catch(error => { console.error('诗社部署/验收失败：', error.code || error.name); process.exitCode = 1; });
function indexName(keys) { return 'soc_' + keys.map(key => key.startsWith('-') ? 'desc_' + key.slice(1) : key).join('_'); }
module.exports = { INDEXES, indexName };
