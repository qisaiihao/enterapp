const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { parse } = require('@babel/parser');

const root = path.resolve(__dirname, '..');
const plain = value => JSON.parse(JSON.stringify(value));
let sourcePosts = [];
let queryError = false;
const queries = [];
const db = {
  command: { aggregate: {}, in: ids => ids },
  collection(name) {
    assert.equal(name, 'posts');
    const query = {};
    return {
      where(filter) { query.ids = filter._id; return this; },
      field(fields) { query.fields = fields; return this; },
      limit(limit) { query.limit = limit; return this; },
      async get() {
        queries.push(plain(query));
        if (queryError) throw new Error('temporary query failure');
        return { data: sourcePosts.filter(post => query.ids.includes(post._id)).slice(0, query.limit || 20)
          .map(post => Object.fromEntries(Object.entries(post).filter(([key]) => query.fields[key]))) };
      }
    };
  }
};
const server = { exports: {}, console: { warn() {} }, require(name) {
  assert.equal(name, 'wx-server-sdk');
  return { init() {}, database: () => db };
} };
vm.runInNewContext(fs.readFileSync(path.join(root, 'functions/getWeeklyContent/index.js'), 'utf8') + `
exports.review = { normalizeSnapshot, hydrateSnapshotCardData, buildDetailFromIssue, buildDetailFromTopic };
getAuthorFeaturedCountMap = async () => ({});
`, server);
const { normalizeSnapshot, hydrateSnapshotCardData, buildDetailFromIssue, buildDetailFromTopic } = server.exports.review;

const componentSource = fs.readFileSync(path.join(root, 'components/weekly/WeeklyFeatureDetailView.vue'), 'utf8');
let componentScript = componentSource.match(/<script>([\s\S]*?)<\/script>/)[1];
const imports = parse(componentScript, { sourceType: 'module' }).program.body.filter(node => node.type === 'ImportDeclaration');
const componentContext = { module: { exports: {} } };
for (const node of imports) for (const binding of node.specifiers) componentContext[binding.local.name] = {};
for (const node of imports.reverse()) componentScript = componentScript.slice(0, node.start) + componentScript.slice(node.end);
vm.runInNewContext(componentScript.replace('export default', 'module.exports ='), componentContext);
const getCardCopy = componentContext.module.exports.methods.getCardCopy;
assert.ok(componentSource.includes('{{ getCardCopy(card) }}'), 'The rendered card must use the highlight-aware copy');

(async () => {
  const content = '\n 第一行\r\n\r\n第二行\n第三行\n第四行\n第五行\n最后的高光句';
  const opening = '第一行\n第二行\n第三行\n第四行';
  const cases = [
    [{ highlightLines: [' 最后的高光句 ', '', null], highlightSentence: '旧高光' }, '最后的高光句'],
    [{ highlightLines: ['第二行', '第四行'] }, '第二行\n第四行'],
    [{ highlightLines: ['\n', null, {}], highlightSentence: ' 最后的高光句 ' }, '最后的高光句'],
    [{ highlightLines: [], highlightSentence: ' \n ' }, opening],
    [{}, opening],
    [{ seriesBlocks: [{ content: '第一首', highlightSentence: '第一首高光' }, { highlightLines: ['第二首高光'] }] }, '第一首高光\n第二首高光'],
    [{ seriesPoems: [{ highlightSentence: '旧组诗高光' }] }, '旧组诗高光']
  ];
  for (const [extra, expected] of cases) {
    const input = { postId: 'poem', title: '标题', content, copy: '旧摘要', ...extra };
    const before = plain(input);
    const normalized = normalizeSnapshot(input);
    assert.equal(normalized.copy, expected);
    assert.equal(getCardCopy(normalized), expected);
    assert.equal(normalized.content, content, 'Full poem remains available to share/detail views');
    assert.deepEqual(input, before, 'Normalization does not mutate stored snapshots');
  }
  assert.equal(getCardCopy({ content, copy: '旧摘要', highlightLines: ['最后的高光句'] }), '最后的高光句');
  assert.equal(getCardCopy({ content, highlightSentence: '旧版高光字段' }), '旧版高光字段');
  assert.equal(getCardCopy({ content }), opening);
  assert.equal(getCardCopy({ copy: '一\n二\n三\n四\n五' }), '一\n二\n三\n四');

  sourcePosts = [
    { _id: 'poem', highlightLines: ['最后的高光句'], backgroundColor: '#222222', textColor: '#ffffff' },
    { _id: 'removed', highlightLines: [], highlightSentence: '' }
  ];
  const snapshots = [
    normalizeSnapshot({ postId: 'poem', content, backgroundColor: '#eeeeee', textColor: '#111111', votes: 3 }),
    normalizeSnapshot({ postId: 'removed', content, highlightLines: ['已取消的高光'] }),
    normalizeSnapshot({ postId: 'missing', content, highlightSentence: '历史高光' })
  ];
  const before = plain(snapshots);
  const hydrated = await hydrateSnapshotCardData(snapshots);
  assert.equal(hydrated[0].copy, '最后的高光句', 'Existing snapshots with colors must still fetch highlights');
  assert.equal(hydrated[0].backgroundColor, '#eeeeee');
  assert.equal(hydrated[0].textColor, '#111111');
  assert.equal(hydrated[0].votes, 3);
  assert.equal(hydrated[1].copy, opening, 'Removing highlights restores the opening lines');
  assert.deepEqual(plain(hydrated[1].highlightLines), []);
  assert.equal(hydrated[2].copy, '历史高光', 'Unavailable source posts retain their snapshot');
  assert.deepEqual(plain(snapshots), before);
  assert.ok(queries[0].fields.highlightLines && queries[0].fields.highlightSentence && queries[0].fields.seriesBlocks);

  for (const [build, snapshotKey] of [[buildDetailFromIssue, 'featuredSnapshots'], [buildDetailFromTopic, 'selectedSnapshots']]) {
    const detail = await build({ _id: 'weekly', title: '周刊', [snapshotKey]: [snapshots[0]] });
    assert.equal(detail.posts[0].copy, '最后的高光句');
    assert.equal(getCardCopy(detail.posts[0]), '最后的高光句');
  }

  queries.length = 0;
  sourcePosts = Array.from({ length: 101 }, (_, index) => ({ _id: String(index), highlightSentence: `高光${index}` }));
  const many = await hydrateSnapshotCardData(sourcePosts.map(post => normalizeSnapshot({ postId: post._id, content })));
  assert.deepEqual(queries.map(query => query.ids.length), [100, 1]);
  assert.equal(many.at(-1).copy, '高光100');
  assert.equal(many[30].copy, '高光30', 'Queries must not stop at the default 20 records');
  queryError = true;
  assert.equal(await hydrateSnapshotCardData(snapshots), snapshots, 'A lookup failure keeps usable snapshot text');
  console.log('PASS: highlight priority, legacy/series fields, four-line fallback, existing weekly/topic snapshots, removals, batching and query failure');
})().catch(error => { console.error(error); process.exitCode = 1; });
