const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { parse } = require('@babel/parser');

function loadModule(file, globals = {}) {
  let source = fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
  if (file.endsWith('.vue')) source = source.match(/<script>([\s\S]*?)<\/script>/)[1];
  const nodes = parse(source, { sourceType: 'module' }).program.body;
  const bindings = {};
  for (const node of nodes.slice().reverse()) {
    if (node.type === 'ImportDeclaration') {
      for (const specifier of node.specifiers) bindings[specifier.local.name] = {};
      source = source.slice(0, node.start) + source.slice(node.end);
    } else if (node.type === 'ExportNamedDeclaration') {
      source = source.slice(0, node.start) + source.slice(node.declaration ? node.declaration.start : node.end);
    } else if (node.type === 'ExportDefaultDeclaration') {
      source = source.slice(0, node.start) + 'module.exports = ' + source.slice(node.declaration.start);
    }
  }
  const sandbox = {
    ...bindings, ...globals, module: { exports: {} },
    console: { log() {}, warn() {}, error() {} }
  };
  vm.runInNewContext(source, sandbox, { filename: file });
  return sandbox.module.exports;
}

function plain(value) {
  return JSON.parse(JSON.stringify(value));
}

function freezeDeep(value) {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(freezeDeep);
    Object.freeze(value);
  }
  return value;
}

function componentContext(component, props) {
  const context = { ...props };
  for (const [name, getter] of Object.entries(component.computed)) {
    Object.defineProperty(context, name, { get: () => getter.call(context) });
  }
  return context;
}

const display = loadModule('utils/poemDisplay.js');
const indentation = [' ', '  ', '\t', '\u3000', '\u00a0', '\u1680', '\u2002', '\u2009', '\u202f', '\u205f'];
for (const prefix of indentation) {
  const line = `${prefix}第一行  行中空格\t  `;
  assert.equal(display.normalizePoemDisplayLine(line), line,
    `Preserve indentation and inline/trailing spaces: ${JSON.stringify(prefix)}`);
}
assert.equal(display.normalizePoemDisplayLine(), '');
assert.equal(display.normalizePoemDisplayLine(null), '');
for (const blank of ['', ' \t\u3000\u00a0', '\u180e\u200b\u200d\u2060\ufeff']) {
  assert.equal(display.normalizePoemDisplayLine(blank), '', 'Normalize only entirely blank lines');
}

const content = '\r\n \t\u3000\r\n  第一行  \r\n\t第二行\r\n \t\r\n\u3000第三行\r\n';
const expectedContent = '  第一行  \n\t第二行\n\n\u3000第三行\n';
assert.equal(display.normalizePoemDisplayText(content), expectedContent,
  'Remove leading blank lines, normalize CRLF, and preserve stanza gaps and indentation');
assert.equal(display.normalizePoemDisplayText(' \t\r\n\u3000'), '');
assert.deepEqual(plain(display.normalizePoemDisplayLines(['', ' \t', '  佳句  ', '\u3000次句', null])),
  ['  佳句  ', '\u3000次句'], 'Filter blank highlights without trimming visible lines');
assert.deepEqual(plain(display.normalizePoemDisplayLines(null)), []);
assert.deepEqual(plain(display.normalizeSeriesBlocksForDisplay(null)), []);

const original = freezeDeep({
  _id: 'indented-poem', isPoem: true, isSeries: true,
  content, highlightLines: ['  第一行  ', ' ', '\u3000第三行'],
  seriesBlocks: [{
    id: 'part-one', subtitle: '第一首', content,
    highlightSentence: '\t第二行', highlightLines: [' ', '\t第二行']
  }, { id: 'blank', content: ' \t' }],
  displayContent: '第一行\n第二行\n第三行',
  displayHighlightLines: ['第一行', '第三行'],
  displaySeriesPoems: [{ content: '旧缓存' }]
});
const before = plain(original);
const normalized = display.attachPoemDisplayFields(original);
assert.equal(normalized.displayContent, expectedContent, 'Rebuild old display caches from raw content');
assert.deepEqual(plain(normalized.displayHighlightLines), ['  第一行  ', '\u3000第三行']);
assert.equal(normalized.displaySeriesPoems.length, 1);
assert.equal(normalized.displaySeriesPoems[0].content, expectedContent);
assert.equal(normalized.displaySeriesPoems[0].highlightSentence, '\t第二行');
assert.deepEqual(plain(normalized.displaySeriesPoems[0].highlightLines), ['\t第二行']);
assert.equal(normalized.content, original.content);
assert.equal(normalized.highlightLines, original.highlightLines);
assert.equal(normalized.seriesBlocks, original.seriesBlocks);
assert.deepEqual(plain(original), before, 'Display normalization must not modify stored content or source arrays');

const square = loadModule('pages/poem-square/poem-square.vue', {
  ...display, getLatestLikeStatus: () => null,
  likeIcon: { getLikeIcon: () => '/static/images/seed.png' }
});
const page = {
  isBrokenSignatureUrl: () => false,
  generateRandomBackgroundColor: () => '#a4c4bd'
};
const card = loadModule('components/poem/PoemCard.vue');
for (const isSeries of [false, true]) {
  const post = square.methods.normalizePoemCardPost.call(page, { ...original, isSeries });
  assert.equal(post.displayContent, expectedContent, 'Original page must retain indentation after loading cached posts');
  assert.deepEqual(plain(post.displayHighlightLines), ['  第一行  ', '\u3000第三行']);
  assert.equal(post.content, original.content);
  assert.equal(post.highlightLines, original.highlightLines);
  assert.equal(post.seriesBlocks, original.seriesBlocks);
  const rendered = componentContext(card, { post, enableSeries: true });
  assert.deepEqual(plain(rendered.highlightLines), ['  第一行  ', '\u3000第三行']);
  if (isSeries) assert.equal(rendered.currentSeriesPoem.content, expectedContent);
}
assert.deepEqual(plain(original), before, 'Original page preparation must leave source poem fields intact');

const activityCard = loadModule('components/activity/ActivityPoemCard.vue', display);
function preview(item, collapsedMaxLines = 2, expanded = false) {
  return componentContext(activityCard, { item, collapsedMaxLines, expanded }).collapsedPreviewLines;
}
assert.deepEqual(plain(preview({ content: '  首行\n \t\n\u3000次行  \n\t末行' })),
  ['  首行', '\u3000次行...'], 'Limited body previews preserve indentation when appending ellipsis');
assert.deepEqual(plain(preview({ content: '  首行\n\u3000次行  ' })),
  ['  首行', '\u3000次行  '], 'Untruncated preview lines preserve trailing spaces too');
assert.deepEqual(plain(preview({
  content: '正文不用于高光预览', highlightLines: ['  首句', ' ', '\t次句  ', '\u3000末句']
})), ['  首句', '\t次句...'], 'Limited highlight previews preserve indentation');
assert.deepEqual(plain(preview({
  content: '正文', displayHighlightLines: ['  缓存首句', '\u3000缓存次句…', '\t缓存末句']
})), ['  缓存首句', '\u3000缓存次句…'], 'Do not duplicate an existing ellipsis');
assert.deepEqual(plain(preview({ content }, 0)), []);
assert.deepEqual(plain(preview({ content }, 2, true)), []);

console.log('Poem display: whitespace preservation, cached original-page cards, series, highlights and limited previews passed.');
