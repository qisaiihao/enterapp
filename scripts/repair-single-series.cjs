// Default: read-only scan and local backup. Writes require --apply <plan.json>.
const fs = require('node:fs');
const path = require('node:path');
const { isDeepStrictEqual } = require('node:util');
const { createRequire } = require('node:module');

const ROOT = path.resolve(__dirname, '..');
const has = (object, key) => Object.prototype.hasOwnProperty.call(object, key);
const text = value => typeof value === 'string' ? value.trim() : '';
const SERIES_QUERY = { $or: [
  { isSeries: true },
  { 'seriesBlocks.0': { $exists: true } },
  { 'seriesPoems.0': { $exists: true } }
] };

function validBlocks(value) {
  return Array.isArray(value) ? value.filter(block => block && (
    text(block.content) || text(block.subtitle) || text(block.subTitle) || text(block.imageUrl)
  )) : [];
}

function planPost(post) {
  const blocks = validBlocks(post.seriesBlocks);
  const poems = validBlocks(post.seriesPoems);
  if (blocks.length > 1 || poems.length > 1) return { reason: 'multiple-poems' };
  if (blocks.length === 0 && poems.length === 0) return { reason: 'no-verifiable-poem' };
  if (blocks.length && poems.length && (
    text(blocks[0].content) !== text(poems[0].content) ||
    text(blocks[0].subtitle || blocks[0].subTitle) !== text(poems[0].subtitle || poems[0].subTitle)
  )) return { reason: 'conflicting-series-fields' };
  // Do not infer a single poem from malformed historical data.
  for (const key of ['seriesBlocks', 'seriesPoems']) {
    if (has(post, key) && post[key] != null && !Array.isArray(post[key])) return { reason: 'malformed-series-fields' };
    if (Array.isArray(post[key]) && post[key].some(b => b != null && (typeof b !== 'object' || Array.isArray(b)))) {
      return { reason: 'malformed-series-fields' };
    }
  }
  const block = blocks[0] || poems[0];
  const patch = { isSeries: false, seriesBlocks: [], seriesBlockCount: 0 };
  if (has(post, 'seriesPoems')) patch.seriesPoems = [];
  if (!text(post.title) && text(block.subtitle || block.subTitle)) patch.title = text(block.subtitle || block.subTitle);
  if (!text(post.content) && text(block.content)) patch.content = block.content;
  if (!text(post.content) && !text(block.content) && text(block.subtitle || block.subTitle)) {
    patch.content = text(block.subtitle || block.subTitle);
  }
  const highlights = Array.isArray(block.highlightLines)
    ? block.highlightLines.filter(line => text(line)).slice(0, 3) : [];
  if (!highlights.length && text(block.highlightSentence)) highlights.push(block.highlightSentence);
  if (!highlights.length && text(block.content)) highlights.push(block.content.split(/\r?\n/).find(line => text(line)));
  if ((!Array.isArray(post.highlightLines) || post.highlightLines.length === 0) && highlights.length) {
    patch.highlightLines = highlights;
  }
  const finalHighlights = patch.highlightLines || post.highlightLines || [];
  if (!text(post.highlightSentence) && finalHighlights.length) patch.highlightSentence = finalHighlights[0];
  for (const key of ['backgroundColor', 'textColor']) {
    if (!text(post[key]) && text(block[key])) patch[key] = block[key];
  }
  if (!text(post.imageUrl) && text(block.imageUrl)) {
    patch.imageUrl = block.imageUrl;
    if (!Array.isArray(post.imageUrls) || !post.imageUrls.length) patch.imageUrls = [block.imageUrl];
    if (!text(post.poemBgImage)) patch.poemBgImage = block.imageUrl;
  }
  return { patch };
}

async function connect() {
  const cliRoot = process.env.CLOUDBASE_CLI_ROOT || path.join(process.env.APPDATA || '', 'npm/node_modules/@cloudbase/cli');
  const cliRequire = createRequire(path.join(cliRoot, 'package.json'));
  const { authSupevisor } = cliRequire('./lib/utils/auth.js');
  const credential = await authSupevisor.getLoginState();
  if (!credential) throw new Error('CloudBase CLI is not logged in. Run tcb login first.');
  const CloudBase = cliRequire('@cloudbase/manager-node');
  const { envId } = JSON.parse(fs.readFileSync(path.join(ROOT, 'cloudbaserc.json'), 'utf8'));
  const manager = new CloudBase({ envId, secretId: credential.secretId, secretKey: credential.secretKey, token: credential.token });
  const { EnvInfo } = await manager.env.getEnvInfo();
  const tag = EnvInfo?.Databases?.[0]?.InstanceId;
  if (!tag) throw new Error('Database instance not found.');
  const service = manager.commonService('flexdb');
  return {
    envId,
    async query(query, limit = 100) {
      const result = await service.call({ Action: 'Query', Param: {
        TableName: 'posts', Tag: tag, MgoQuery: JSON.stringify(query),
        MgoSort: JSON.stringify([{ key: '_id', direction: 1 }]), MgoLimit: limit, MgoOffset: 0
      } });
      const data = typeof result.Data === 'string' ? JSON.parse(result.Data) : result.Data;
      if (!Array.isArray(data)) throw new Error('Unexpected database query response.');
      return data.map(row => typeof row === 'string' ? JSON.parse(row) : row);
    },
    async update(query, update) {
      return service.call({ Action: 'UpdateItem', Param: {
        TableName: 'posts', Tag: tag, MgoQuery: JSON.stringify(query), MgoUpdate: JSON.stringify(update),
        MgoIsMulti: false, MgoUpsert: false
      } });
    }
  };
}

async function scan(db) {
  const posts = [];
  let lastId;
  while (true) {
    const query = lastId ? { $and: [SERIES_QUERY, { _id: { $gt: lastId } }] } : SERIES_QUERY;
    const batch = await db.query(query);
    if (!batch.length) break;
    posts.push(...batch);
    lastId = batch.at(-1)._id;
    if (batch.length < 100) break;
  }
  const candidates = [];
  const skipped = [];
  for (const post of posts) {
    const result = planPost(post);
    if (result.patch) candidates.push({ before: post, patch: result.patch });
    else skipped.push({ id: post._id, reason: result.reason, storedCount: post.seriesBlockCount });
  }
  const summary = {
    scanned: posts.length, candidates: candidates.length,
    skipped: skipped.reduce((counts, item) => { counts[item.reason] = (counts[item.reason] || 0) + 1; return counts; }, {})
  };
  return { version: 1, envId: db.envId, createdAt: new Date().toISOString(), summary, candidates, skipped };
}

function guardFor(before, patch) {
  const keys = new Set(['isSeries', 'seriesBlocks', 'seriesPoems', 'seriesBlockCount', ...Object.keys(patch)]);
  const clauses = [{ _id: before._id }];
  // FlexDB may reorder object keys in returned JSON; comparing entire nested
  // objects would then fail MongoDB's order-sensitive object equality.
  function matchValue(key, value) {
    if (Array.isArray(value)) {
      clauses.push({ [key]: { $size: value.length } });
      value.forEach((item, index) => matchValue(`${key}.${index}`, item));
    } else if (value && typeof value === 'object' && Object.keys(value).length) {
      for (const [child, item] of Object.entries(value)) matchValue(`${key}.${child}`, item);
      if (/^(seriesBlocks|seriesPoems)\.\d+$/.test(key)) {
        for (const child of ['content', 'subtitle', 'subTitle', 'imageUrl', 'highlightSentence', 'highlightLines', 'backgroundColor', 'textColor']) {
          if (!has(value, child)) clauses.push({ [`${key}.${child}`]: { $exists: false } });
        }
      }
    } else clauses.push({ [key]: { $eq: value } });
  }
  for (const key of keys) {
    if (has(before, key)) matchValue(key, before[key]);
    else clauses.push({ [key]: { $exists: false } });
  }
  return { $and: clauses };
}

async function applyPlan(db, planFile) {
  const plan = JSON.parse(fs.readFileSync(planFile, 'utf8'));
  if (plan.version !== 1 || plan.envId !== db.envId || !Array.isArray(plan.candidates)) throw new Error('Invalid plan or environment mismatch.');
  // Check the entire backup and plan before performing the first write.
  for (const item of plan.candidates) {
    if (!item.before?._id || !isDeepStrictEqual(planPost(item.before).patch, item.patch)) throw new Error('Invalid candidate patch.');
  }
  const journal = `${planFile}.applied.jsonl`;
  if (fs.existsSync(journal)) throw new Error('This plan already has an apply journal; inspect it before retrying.');
  for (const { before, patch } of plan.candidates) {
    const matches = await db.query(guardFor(before, patch), 1);
    if (matches.length !== 1) throw new Error(`Preflight mismatch for ${before._id}; no posts were updated.`);
  }
  fs.writeFileSync(journal, '', { flag: 'wx' });
  let updated = 0;
  for (const { before, patch } of plan.candidates) {
    const result = await db.update(guardFor(before, patch), { $set: patch });
    fs.appendFileSync(journal, JSON.stringify({ id: before._id, result, at: new Date().toISOString() }) + '\n');
    if (Number(result.MatchedNum) !== 1) throw new Error(`Post changed since scan: ${before._id}; stopped without overwriting it.`);
    const [after] = await db.query({ _id: before._id }, 1);
    if (!after || Object.entries(patch).some(([key, value]) => !isDeepStrictEqual(after[key], value))) {
      throw new Error(`Verification failed for ${before._id}; inspect backup and journal.`);
    }
    updated++;
    if (updated % 10 === 0) console.log(JSON.stringify({ updated, total: plan.candidates.length }));
  }
  const remaining = await scan(db);
  fs.writeFileSync(`${planFile}.verification.json`, JSON.stringify({ updated, verifiedAt: new Date().toISOString(), ...remaining.summary }, null, 2));
  console.log(JSON.stringify({ envId: db.envId, updated, remaining: remaining.summary, backup: planFile }, null, 2));
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length && !(args.length === 2 && args[0] === '--apply')) throw new Error('Usage: node scripts/repair-single-series.cjs [--apply <plan.json>]');
  const db = await connect();
  if (args[0] === '--apply') return applyPlan(db, path.resolve(args[1]));
  const plan = await scan(db);
  const directory = path.join(ROOT, 'unpackage/database-backups', `single-series-${new Date().toISOString().replace(/[:.]/g, '-')}`);
  fs.mkdirSync(directory, { recursive: true });
  const planFile = path.join(directory, 'plan.json');
  fs.writeFileSync(planFile, JSON.stringify(plan, null, 2), { flag: 'wx' });
  console.log(JSON.stringify({ envId: db.envId, ...plan.summary, backup: planFile }, null, 2));
}

module.exports = { planPost, guardFor, scan, applyPlan, connect };
if (require.main === module) main().catch(error => { console.error(error.message); process.exitCode = 1; });
