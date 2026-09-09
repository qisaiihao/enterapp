const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const now = new Date('2026-09-09T02:00:00Z');
const start = new Date(now.getTime() - 7 * 86400000);
let posts = Array.from({ length: 1101 }, (_, index) => ({
  _id: `poem-${index}`, isPoem: true, isOriginal: index !== 1100,
  createTime: new Date(now.getTime() - index * 1000), votes: 0
}));
posts.push(
  { _id: 'boundary', isPoem: true, createTime: start },
  { _id: 'expired', isPoem: true, createTime: new Date(start.getTime() - 1) },
  { _id: 'future', isPoem: true, createTime: new Date(now.getTime() + 1) },
  { _id: 'hidden', isPoem: true, isHidden: true, createTime: now },
  { _id: 'non-poem', isPoem: false, createTime: now }
);
const queriedIds = [];
const command = {
  aggregate: {}, neq: value => ({ neq: value }), lte: value => ({ end: value }),
  gte: value => ({ and: other => ({ start: value, end: other.end }) })
};
const db = {
  command,
  collection(name) {
    assert.equal(name, 'posts');
    let where, skip = 0, limit = 100;
    return {
      where(value) { where = value; return this; },
      orderBy() { return this; },
      skip(value) { skip = value; return this; },
      limit(value) { limit = value; return this; },
      async get() {
        assert.equal(where.createTime.end.getTime() - where.createTime.start.getTime(), 7 * 86400000);
        return { data: posts.filter(post => post.isPoem === where.isPoem &&
          post.isHidden !== where.isHidden.neq &&
          (!where.isOriginal || post.isOriginal === where.isOriginal) &&
          post.createTime >= where.createTime.start && post.createTime <= where.createTime.end
        ).sort((a, b) => b.createTime - a.createTime).slice(skip, skip + limit) };
      }
    };
  }
};
const context = { exports: {}, console, require: () => ({ init() {}, database: () => db }) };
vm.createContext(context);
vm.runInContext(fs.readFileSync(path.join(__dirname, '../functions/getWeeklyContent/index.js'), 'utf8'), context);
context.getPostStatsMap = async ids => {
  assert.ok(ids.length <= 100);
  queriedIds.push(...ids);
  return new Map(ids.map(id => [id, {
    votes: id === 'poem-1100' ? 1000 : 1,
    comments: id === 'poem-1' ? 4 : 0,
    views: id === 'poem-2' ? 7 : 0
  }]));
};

(async () => {
  const ranking = await context.computeRecentWeeklyRanking({ now, limit: 20 });
  assert.equal(ranking.length, 20);
  assert.equal(ranking[0].postId, 'poem-1100', '第 1000 首以后的高分诗歌也能上榜');
  assert.equal(ranking[0].isOriginal, false, '所有公开诗歌均参与排名');
  assert.equal(ranking[1].postId, 'poem-1');
  assert.equal(ranking[2].postId, 'poem-2');
  assert.equal(ranking[0].score, 3000);
  assert.ok(queriedIds.includes('boundary'), '七天边界包含在内');
  for (const id of ['expired', 'future', 'hidden', 'non-poem']) assert.ok(!queriedIds.includes(id), id);
  assert.equal(new Set(queriedIds).size, 1102, '全部候选都统计热度');

  const computeRanking = context.computeRecentWeeklyRanking;
  context.computeRecentWeeklyRanking = options => computeRanking({ ...options, now });
  Object.assign(context, {
    listPublishedIssues: async () => [], listPublishedTopics: async () => [],
    getConfiguredFeaturedIssueIds: async () => [], getIssueViewCountMap: async () => new Map(),
    getCallerOpenid: () => '', attachLikedStateToDetail: async () => {},
    attachLikedToSnapshotList: async items => items
  });
  const home = await context.exports.main({ mode: 'home' });
  const detail = await context.exports.main({ mode: 'ranking' });
  assert.equal(home.rankingItems.length, 10, '没有已发布周刊也能展示首页热榜');
  assert.equal(detail.rankingItems.length, 20);
  assert.deepEqual(Array.from(home.rankingItems, item => item.postId), Array.from(detail.rankingItems.slice(0, 10), item => item.postId));
  posts = [];
  const empty = await context.exports.main({ mode: 'ranking' });
  assert.equal(empty.rankingItems.length, 0, '没有近期诗歌时不回退到旧快照');
  console.log('最近七天自动热榜回归检查通过');
})().catch(error => { console.error(error); process.exitCode = 1; });
