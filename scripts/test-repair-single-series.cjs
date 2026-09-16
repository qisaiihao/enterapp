const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { planPost, guardFor, scan, applyPlan } = require('./repair-single-series.cjs');

const block = { subtitle: '小标题', content: '正文\n第二行', highlightSentence: '第二行' };
const original = {
  _id: 'single', isSeries: true, seriesBlockCount: 1, seriesBlocks: [block],
  title: '标题', content: block.content, highlightLines: ['第二行'], highlightSentence: '第二行',
  isPoem: true, isOriginal: false, author: '作者', votes: 5, commentCount: 2,
  createTime: { $date: '2026-09-01T00:00:00Z' }
};
const patch = { isSeries: false, seriesBlocks: [], seriesBlockCount: 0 };
assert.deepEqual(planPost(original).patch, patch);
assert.deepEqual(planPost({ ...original, seriesBlocks: [block, { content: ' \n ' }] }).patch, patch);
assert.equal(planPost({ ...original, seriesBlocks: [block, block] }).reason, 'multiple-poems');
assert.equal(planPost({ ...original, seriesBlocks: [block, { imageUrl: 'cloud://image' }] }).reason, 'multiple-poems');
assert.equal(planPost({ ...original, seriesBlocks: [], seriesBlockCount: 1 }).reason, 'no-verifiable-poem');
assert.equal(planPost({ ...original, seriesPoems: [{ content: '不同正文' }] }).reason, 'conflicting-series-fields');
assert.equal(planPost({ ...original, seriesBlocks: [block, 'invalid'] }).reason, 'malformed-series-fields');
assert.equal(planPost({ ...original, isPoem: false, publishMode: 'normal' }).patch.isPoem, undefined);
const missing = planPost({ _id: 'missing', isSeries: true, seriesBlocks: [block] }).patch;
assert.equal(missing.title, block.subtitle);
assert.equal(missing.content, block.content);
assert.deepEqual(missing.highlightLines, ['第二行']);
assert.equal(missing.highlightSentence, '第二行');
assert.deepEqual(planPost({ ...original, seriesPoems: [block] }).patch.seriesPoems, []);
assert.ok(guardFor(original, patch).$and.some(clause => clause.seriesBlocks?.$size === 1));
assert.ok(guardFor(original, patch).$and.some(clause => clause['seriesBlocks.0.content']?.$eq === block.content));

(async () => {
  const multiple = { _id: 'multiple', isSeries: true, seriesBlocks: [block, block] };
  let current = structuredClone(original);
  let writes = 0;
  const db = {
    envId: 'test-env',
    async query(query) {
      if (query._id || query.$and) return [structuredClone(current)];
      return current.isSeries ? [structuredClone(current), multiple] : [multiple];
    },
    async update(query, update) {
      writes++;
      assert.deepEqual(query, guardFor(original, patch));
      assert.deepEqual(update, { $set: patch });
      current = { ...current, ...structuredClone(update.$set) };
      return { MatchedNum: 1, ModifiedNum: 1 };
    }
  };
  const plan = await scan(db);
  assert.equal(writes, 0, 'Scanning must not write to the database');
  assert.equal(plan.summary.candidates, 1);
  assert.equal(plan.summary.skipped['multiple-poems'], 1);
  assert.deepEqual(plan.candidates[0].before, original, 'Backup must include every original field');
  const root = path.resolve(__dirname, '../unpackage/database-backups');
  fs.mkdirSync(root, { recursive: true });
  const directory = fs.mkdtempSync(path.join(root, 'test-single-series-'));
  const file = path.join(directory, 'plan.json');
  fs.writeFileSync(file, JSON.stringify(plan));
  await applyPlan(db, file);
  assert.equal(writes, 1);
  assert.deepEqual(current, { ...original, ...patch }, 'Only intended fields may change');
  assert.equal((await scan(db)).summary.candidates, 0, 'Already repaired posts must not be selected again');
  await assert.rejects(applyPlan(db, file), /already has an apply journal/);
  assert.equal(writes, 1, 'Repeated apply must not write twice');
  const conflictFile = path.join(directory, 'conflict.json');
  fs.writeFileSync(conflictFile, JSON.stringify(plan));
  await assert.rejects(applyPlan({ ...db, update: async () => ({ MatchedNum: 0 }) }, conflictFile), /Post changed since scan/);
  const wrongEnvFile = path.join(directory, 'wrong-env.json');
  fs.writeFileSync(wrongEnvFile, JSON.stringify({ ...plan, envId: 'wrong-env' }));
  await assert.rejects(applyPlan(db, wrongEnvFile), /environment mismatch/);
  console.log('[test-repair-single-series] PASS (selection, preservation, backup, conflicts, repeat protection and verification)');
})().catch(error => { console.error(error); process.exitCode = 1; });
