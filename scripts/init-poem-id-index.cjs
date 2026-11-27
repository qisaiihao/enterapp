const assert = require('node:assert/strict');
const { setTimeout: delay } = require('node:timers/promises');
const cloudbase = require('@cloudbase/node-sdk');
const { createManager } = require('./init-societies-db.cjs');
const { indexName } = require('../functions/_shared/poem-id');
const { envId } = require('../cloudbaserc.json');
const { region } = require('./app-versions/config.json');

const fields = [{ Name: 'poemId', Direction: '1' }];
// CloudBase uses MongoDB comparison rules. $gt: '' indexes nonempty strings.
const filter = { poemId: { $gt: '' } };

async function indexReady(database) {
  const { Indexes } = await database.describeCollection('users');
  assert(Array.isArray(Indexes), '未取得 users 索引列表');
  const index = Indexes.find(item => item.Name === indexName);
  if (!index) return false;
  assert(index.Unique === true && index.Keys?.length === 1 && index.Keys[0].Name === 'poemId',
    '已有同名索引，定义与预期不同');
  return true;
}

async function main(args) {
  assert(args.length === 0 || (args.length === 1 && args[0] === '--apply'),
    '用法：npm run init:poem-id-index [-- --apply]');
  const manager = await createManager({ envId, region });
  const { secretId, secretKey, token, proxy } = manager.getManagerConfig();
  const db = cloudbase.init({ env: envId, region, secretId, secretKey, sessionToken: token, proxy }).database();
  const _ = db.command;
  const existing = await indexReady(manager.database);
  const result = await db.collection('users').aggregate()
    .match({ poemId: _.gt('') })
    .group({ _id: '$poemId', records: _.aggregate.sum(1) })
    .match({ records: _.gt(1) })
    .count('groups').end();
  const rows = result.data ?? result.list;
  assert(Array.isArray(rows), '未取得 Poem ID 重号统计');
  const duplicateGroups = rows[0]?.groups ?? 0;
  assert.equal(duplicateGroups, 0, `仍有 ${duplicateGroups} 组完全相同的 Poem ID，请先处理重号`);
  if (existing || args.length === 0) {
    console.log(JSON.stringify({ envId, indexName, ready: existing, duplicateGroups }));
    return;
  }
  await manager.database.updateCollection('users', { CreateIndexes: [{ IndexName: indexName, MgoKeySchema: {
    MgoIndexKeys: fields, MgoIsUnique: true, PartialFilterExpression: JSON.stringify(filter)
  } }] });
  for (let attempt = 0; attempt < 12; attempt++) {
    if (await indexReady(manager.database)) {
      console.log(JSON.stringify({ envId, indexName, ready: true, duplicateGroups }));
      return;
    }
    await delay(1500);
  }
  throw new Error('索引创建已提交，尚未在索引列表中查到');
}

main(process.argv.slice(2)).catch(error => {
  console.error('Poem ID 索引检查失败', error.code || error.message);
  process.exitCode = 1;
});
