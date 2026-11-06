const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createRequire } = require('node:module');
const { parse } = require('@babel/parser');
const cloud = require('wx-server-sdk');
const { memoryDb } = require('./helpers/posts-memory-db.cjs');
cloud.init({ env: 'poem-typography-test' });
const command = cloud.database().command;
const root = path.resolve(__dirname, '..');
const quiet = { log() {}, warn() {}, error() {} };

function load(file, globals = {}) {
    let source = fs.readFileSync(path.join(root, file), 'utf8');
    if (file.endsWith('.vue')) source = source.match(/<script>([\s\S]*?)<\/script>/)[1];
    const bindings = {};
    const names = [];
    for (const node of parse(source, { sourceType: 'module' }).program.body.reverse()) {
        if (node.type === 'ImportDeclaration') {
            for (const spec of node.specifiers) bindings[spec.local.name] = () => {};
            source = source.slice(0, node.start) + source.slice(node.end);
        } else if (node.type === 'ExportDefaultDeclaration') {
            source = source.slice(0, node.start) + 'module.exports = ' + source.slice(node.declaration.start);
        } else if (node.type === 'ExportNamedDeclaration') {
            if (node.declaration?.id) names.push(node.declaration.id.name);
            for (const item of node.declaration?.declarations || []) names.push(item.id.name);
            source = source.slice(0, node.start) + source.slice(node.declaration ? node.declaration.start : node.end);
        }
    }
    source += names.length ? `\nObject.assign(module.exports, { ${names.join(', ')} });` : '';
    const sandbox = { ...bindings, module: { exports: {} }, console: quiet, ...globals };
    vm.runInNewContext(source, sandbox, { filename: file });
    return sandbox.module.exports;
}

function backend(mem, name) {
    const filename = path.join(root, 'functions', name, 'index.js');
    const localRequire = createRequire(filename);
    const sandbox = { exports: {}, process, Buffer, console: quiet, require(id) {
        return id === 'wx-server-sdk' ? {
            init() {}, database: () => mem.db, getWXContext: () => ({ OPENID: 'owner' }),
            callFunction: async () => ({ result: { success: true, passed: true, code: 'MODERATION_OFF' } })
        } : localRequire(id);
    } };
    vm.runInNewContext(fs.readFileSync(filename, 'utf8'), sandbox, { filename });
    return event => sandbox.exports.main(event, {});
}

async function main() {
    for (const file of ['functions/createPost/index.js', 'functions/createSeriesFromSingles/index.js', 'functions/updatePostContent/index.js',
        'functions/getPortfolioItems/index.js', 'functions/getPostList/index.js', 'functions/_shared/posts/index.js', 'functions/_shared/posts/query.js', 'functions/_shared/posts/schema.js']) {
        require('acorn').parse(fs.readFileSync(path.join(root, file), 'utf8'), { ecmaVersion: 2018 });
    }
    const typography = load('utils/poemTypography.js');
    const { normalizePoemFontSize: size, getPoemFontVars: vars } = typography;
    assert.equal(size(), 14);
    assert.equal(size(''), 14);
    assert.equal(size('20'), 20);
    assert.equal(size(20.6), 21);
    assert.equal(size(9), 12);
    assert.equal(size(80), 36);
    assert.equal(Object.keys(vars({ isPoem: true })).length, 0, 'Old poems retain their existing reading size');
    assert.equal(vars({ publishMode: 'normal', poemFontSize: 20 })['--app-read-post-size'], '40rpx', 'Normal posts retain their selected base size');
    assert.equal(vars({ isPoem: true, poemFontSize: 20 })['--app-read-post-size'], '40rpx');
    assert.equal(vars({ isPoem: true, poemFontSize: 20 }, { '--app-read-post-size': '34rpx' })['--app-read-post-size'], '48.57rpx', 'Reader enlargement still applies');

    const toolbar = load('components/add/PoemTypographyToolbar.vue', typography);
    const control = { value: 14, ...toolbar.data.call({ value: 14 }), $emit(name, value) { assert.equal(name, 'change'); this.value = value; } };
    for (const [name, method] of Object.entries(toolbar.methods)) control[name] = method.bind(control);
    control.draftSize = '21'; control.commitSize(); assert.equal(control.value, 21);
    control.commitSize({ detail: { value: '24' } }); assert.equal(control.value, 24, 'Confirm uses the input value before throttled input events arrive');
    control.applySize(21);
    control.step(1); assert.equal(control.value, 22);
    control.selectPreset({ detail: { value: 5 } }); assert.equal(control.value, 24);
    control.draftSize = ''; control.commitSize(); assert.equal(control.draftSize, '24');
    control.draftSize = '99'; control.commitSize(); assert.equal(control.value, 36);
    control.step(1); assert.equal(control.value, 36);
    control.applySize(control.defaultSize); assert.equal(control.value, 14);
    control.editingSize = true;
    control.onSizeInput({ detail: { value: '20' } });
    control.onSizeBlur({ detail: { value: '20' } });
    control.applySize(21);
    control.onSizeInput({ detail: { value: '20' } });
    control.step(-1);
    assert.equal(control.value, 20, 'A delayed input event after blur cannot overwrite a newer toolbar size');

    const content = '\n  风从窗前经过\n把月光留在纸上\n';
    const selected = content.indexOf('月光');
    const spans = [{ start: selected, end: selected + 2, fontSize: 24 }];
    const plain = value => JSON.parse(JSON.stringify(value));
    const delta = typography.poemToEditorDelta(content, spans);
    assert.deepEqual(plain(typography.poemFromEditorDelta(delta)), { content, poemTextStyles: spans }, 'Preserve leading spaces, stanza breaks and trailing newline');
    const richContent = '月光落下\n山河仍醒着';
    const richStyles = [{ start: 0, end: 2, fontSize: 24, bold: true, italic: true, underline: true, strike: true, color: '#906161', backgroundColor: '#f4e8b8', letterSpacing: 2 },
        { start: 4, end: 5, lineHeight: 2, marginTop: 8, marginBottom: 12, indent: 1, align: 'center' },
        { start: richContent.length, end: richContent.length + 1, lineHeight: 1.5, align: 'right' }];
    const richDelta = typography.poemToEditorDelta(richContent, richStyles);
    assert.deepEqual(plain(typography.poemFromEditorDelta(richDelta)), { content: richContent, poemTextStyles: richStyles }, 'Inline and paragraph formats retain the last paragraph delimiter');
    assert.deepEqual(plain(require('../functions/_shared/posts/schema').normalizePoemTextStyles(richStyles, richContent)), richStyles, 'Client and cloud keep the same rich formats');
    const paragraphs = typography.getPoemParagraphs(richContent, richStyles);
    assert.equal(paragraphs[0].format.align, 'center');
    assert.equal(paragraphs[1].format.align, 'right');
    assert.equal(paragraphs[0].runs[0].bold, true);
    const pure = load('pages-publish/add/addPure.js', typography);
    const discussionGroups = pure.buildDiscussionSentenceGroups([
        { type: 'content', text: '  月光落下  ', poemTextStyles: [{ start: 2, end: 4, bold: true }] },
        { type: 'quote', text: ' 风声\n 雨声 ', poemTextStyles: [{ start: 1, end: 3, italic: true }, { start: 3, end: 4, align: 'center' }] }
    ]);
    assert.deepEqual(plain(discussionGroups[0].commentTextStyles), [{ start: 0, end: 2, bold: true }], 'Trimming discussion text remaps selected words');
    assert.deepEqual(plain(discussionGroups[1].sentenceTextStyles), [{ start: 0, end: 2, italic: true }, { start: 2, end: 3, align: 'center' }], 'Quote line formatting follows normalized quote text');
    const runs = typography.getPoemTextRuns('把月光留在纸上', spans, content);
    assert.deepEqual(plain(runs), [{ text: '把' }, { text: '月光', fontSize: 24 }, { text: '留在纸上' }]);
    const richEditor = load('components/add/PoemTextEditor.vue', { ...typography, window: {}, uni: { showToast() {} } });
    const formats = [];
    let value;
    const editorContext = {
        getSelectionText({ success }) { success({ text: '月光' }); },
        format(name, size) { formats.push({ name, size }); }
    };
    const field = { editorContext, $emit(name, data) { assert.equal(name, 'change'); value = data; } };
    richEditor.methods.formatSelection.call(field, 24);
    richEditor.methods.formatSelection.call(field, 24);
    assert.deepEqual(formats, [{ name: 'fontSize', size: '24px' }], 'Formatting uses the editor selection');
    richEditor.methods.onInput.call(field, { detail: { delta } });
    assert.deepEqual(plain(value), { content, poemTextStyles: spans });
    let undos = 0;
    field.maxLength = 500;
    editorContext.undo = () => { undos++; };
    richEditor.methods.onInput.call(field, { detail: { delta: { ops: [{ insert: '字'.repeat(501) + '\n' }] } } });
    assert.equal(undos, 1, 'Discussion quote limit remains 500 characters');

    const requests = [];
    const globals = { ...typography, ...load('utils/poemCreation.js'), ...load('utils/poemDisplay.js'),
        uni: { getStorageSync: () => ({ nickName: '作者' }) },
        contentAudit: async data => { requests.push(data); return { code: 0, postId: 'new' }; },
        updatePostContent: async (id, { data }) => { requests.push(data); return { success: true }; }
    };
    const add = load('pages-publish/add/add.vue', globals);
    const preview = load('pages-publish/preview/preview.vue', globals);
    const loadedBlocks = add.methods.buildDefaultBlocks({ content, poemFontSize: 18, poemTextStyles: spans });
    const switched = { blocks: loadedBlocks, setData(data) { Object.assign(this, data); }, updatePlaceholder() {}, checkCanPublish() {}, scheduleWorkingDraftSave() {} };
    add.methods.onModeSelect.call(switched, { mode: 'discussion', isOriginal: false });
    assert.deepEqual(plain(switched.poemTextStyles), spans, 'Switching a restored post to discussion retains its text formatting');
    const editor = { ...add.data(), publishMode: 'poem', isOriginal: true, content,
        setData(data) { Object.assign(this, data); }, saves: 0,
        checkCanPublish() {},
        scheduleWorkingDraftSave() { this.saves++; }, buildDiscussionSentenceGroups: () => [],
        publishSuccess() {}, publishFail(error) { throw error; } };
    add.methods.onPoemTextChange.call(editor, { content, poemTextStyles: spans });
    assert.equal(editor.poemFontSize, 14, 'Formatting a selection does not change the base font size');
    assert.deepEqual(plain(editor.poemTextStyles), spans);
    assert.equal(editor.saves, 1);
    assert.equal(editor.content, content);
    const draft = add.methods.buildWorkingDraftData.call(editor);
    assert.deepEqual(plain(draft.poemTextStyles), spans);
    const restored = { ...add.data(), setData(data) { Object.assign(this, data); },
        buildDefaultBlocks: add.methods.buildDefaultBlocks, buildDefaultSeriesBlocks: add.methods.buildDefaultSeriesBlocks,
        syncWorkingDraftSession() {}, updatePlaceholder() {}, checkCanPublish() {} };
    add.methods.restoreDraftState.call(restored, draft);
    assert.deepEqual(plain(restored.poemTextStyles), spans);
    const prepare = { getAddPageVm: () => null };
    assert.equal(preview.methods.preparePreviewPost.call(prepare, { content: editor.content, editData: { publishMode: 'poem', poemFontSize: 22 } }).poemFontSize, 22);
    const prepared = preview.methods.preparePreviewPost.call(prepare, { content, editData: { publishMode: 'poem', poemTextStyles: spans } });
    assert.deepEqual(plain(prepared.poemTextStyles), spans);
    assert.ok(!fs.readFileSync(path.join(root, 'pages-publish/preview/preview.vue'), 'utf8').includes('PoemTypographyToolbar'), 'Preview is display only');
    for (const edit of [false, true]) {
        for (const entry of ['add', 'preview']) {
            requests.length = 0;
            const data = { ...editor, isEditMode: edit, editingPostId: edit ? 'existing' : '' };
            if (entry === 'add') await add.methods.submitToDatabase.call(data, []);
            else await preview.methods.submitToDatabase.call({ post: {}, publishSuccess() {}, publishFail(error) { throw error; } }, data, []);
            assert.equal(requests.length, 1);
            assert.deepEqual(plain(requests[0].poemTextStyles), spans, `${entry} edit=${edit}`);
        }
    }

    const { expandFields } = require('../functions/_shared/posts/query');
    assert.equal(expandFields({ content: true }).poemFontSize, true, 'Feed projections retain typography');
    assert.equal(expandFields({ content: true }).poemTextStyles, true);
    const previous = process.env.POSTS_WRITE_SCHEMA;
    try {
        for (const version of ['1', '2']) {
            process.env.POSTS_WRITE_SCHEMA = version;
            const mem = memoryDb({ users: [{ _openid: 'owner', nickName: '作者' }], posts: [], votes_log: [], activities: [] }, command);
            for (const name of ['contentCheck', 'createPost']) {
                const result = await backend(mem, name)({ publishMode: 'poem', isOriginal: true, content, poemFontSize: 24, poemTextStyles: spans });
                assert.ok(result.postId, JSON.stringify(result));
                assert.equal(mem.tables.posts.find(post => post._id === result.postId).poemFontSize, 24, `${name} schema=${version}`);
                assert.deepEqual(plain(mem.tables.posts.find(post => post._id === result.postId).poemTextStyles), spans);
                const update = backend(mem, 'updatePostContent');
                assert.equal((await update({ postId: result.postId, data: { poemFontSize: 18 } })).success, true);
                const detail = await backend(mem, 'getPostDetail')({ postId: result.postId });
                assert.equal(detail.post.poemFontSize, 18);
                assert.deepEqual(plain(detail.post.poemTextStyles), spans);
                await update({ postId: result.postId, data: { poemFontSize: 100 } });
                assert.equal(mem.tables.posts.find(post => post._id === result.postId).poemFontSize, 36);
                await update({ postId: result.postId, data: { poemTextStyles: [{ ...spans[0], fontSize: 30 }] } });
                assert.equal(mem.tables.posts.find(post => post._id === result.postId).poemTextStyles[0].fontSize, 30);
            }
            const seriesResult = await backend(mem, 'createPost')({ publishMode: 'poem', isOriginal: true, content,
                isSeries: true, seriesBlocks: [{ id: 'part-one', content, poemTextStyles: spans }, { id: 'part-two', content: '下一首' }] });
            assert.ok(seriesResult.postId, JSON.stringify(seriesResult));
            const feed = await backend(mem, 'getPostList')({ openid: 'owner', isPoem: true, isOriginal: true, limit: 20 });
            assert.equal(feed.success, true, JSON.stringify(feed));
            assert.deepEqual(plain(feed.posts.find(post => post._id === seriesResult.postId).seriesBlocks[0].poemTextStyles), spans, 'Series list cards retain per-poem styles');
            const richPost = await backend(mem, 'contentCheck')({ publishMode: 'poem', isOriginal: true, content: richContent, poemTextStyles: richStyles });
            assert.ok(richPost.postId, JSON.stringify(richPost));
            assert.deepEqual(plain((await backend(mem, 'getPostDetail')({ postId: richPost.postId })).post.poemTextStyles), richStyles, 'Publication and detail preserve rich formatting');
            await backend(mem, 'updatePostContent')({ postId: richPost.postId, data: { content: richContent, poemTextStyles: richStyles } });
            assert.deepEqual(plain(mem.tables.posts.find(post => post._id === richPost.postId).poemTextStyles), richStyles, 'Editing preserves rich formatting');
            for (const name of ['createPost', 'contentCheck']) {
                const normal = await backend(mem, name)({ publishMode: 'normal', isPoem: false, content: richContent, poemFontSize: 14, poemTextStyles: richStyles });
                assert.ok(normal.postId, JSON.stringify(normal));
                assert.deepEqual(plain((await backend(mem, 'getPostDetail')({ postId: normal.postId })).post.poemTextStyles), richStyles, 'Normal posts retain formatting');
                await backend(mem, 'updatePostContent')({ postId: normal.postId, data: { publishMode: 'normal', isPoem: false, content: richContent, poemFontSize: 14, poemTextStyles: richStyles } });
                assert.deepEqual(plain(mem.tables.posts.find(post => post._id === normal.postId).poemTextStyles), richStyles);
                const discussionContent = pure.mergeDiscussionContent(discussionGroups, discussionGroups[0].comment);
                const discussion = await backend(mem, name)({ publishMode: 'discussion', isDiscussion: true, content: discussionContent, poemFontSize: 14, poemTextStyles: [], sentenceGroups: discussionGroups });
                assert.ok(discussion.postId, JSON.stringify(discussion));
                const detail = (await backend(mem, 'getPostDetail')({ postId: discussion.postId })).post;
                assert.deepEqual(plain(detail.sentenceGroups), plain(discussionGroups), 'Discussion body and quote formats survive publishing');
                assert.ok(detail.poemTextStyles.some(style => style.bold) && detail.poemTextStyles.some(style => style.italic), 'Flattened discussion content keeps both formats for sharing');
                mem.tables.votes_log.push({ postId: discussion.postId, _openid: 'owner', type: 'post' });
                const discussionFeed = await backend(mem, 'getDiscussionPosts')({ limit: 100 });
                assert.equal(discussionFeed.success, true, JSON.stringify(discussionFeed));
                assert.deepEqual(plain(discussionFeed.posts.find(post => post._id === discussion.postId).sentenceGroups), plain(discussionGroups), 'Discussion list retains body and quote formatting');
                assert.equal(discussionFeed.posts.find(post => post._id === discussion.postId).isVoted, true, 'Discussion list keeps the current user vote lookup');
                await backend(mem, 'updatePostContent')({ postId: discussion.postId, data: { publishMode: 'discussion', isDiscussion: true, content: discussionContent, sentenceGroups: discussionGroups } });
                assert.deepEqual(plain((await backend(mem, 'getPostDetail')({ postId: discussion.postId })).post.sentenceGroups), plain(discussionGroups), 'Discussion formats survive editing');
            }
        }
    } finally {
        if (previous === undefined) delete process.env.POSTS_WRITE_SCHEMA;
        else process.env.POSTS_WRITE_SCHEMA = previous;
    }

    const canvas = load('utils/shareCanvas.js', globals);
    const ctx = { font: '', measureText(text) { return { width: text.length * parseInt(this.font) }; } };
    const options = { post: { content: '一行较长的诗句'.repeat(15), poemFontSize: 24 }, measureCtx: ctx, shareConfig: {}, shouldShowSignature: false };
    const sized = await canvas.calculateShareCardHeight(options);
    assert.equal(sized.fontSize, 65);
    const standard = await canvas.calculateShareCardHeight({ ...options, post: { content: options.post.content } });
    assert.equal(standard.fontSize, 38);
    assert.ok(sized.canvasHeight > standard.canvasHeight, 'Large type reserves the height of all wrapped lines');
    const override = await canvas.calculateShareCardHeight({ ...options, shareConfig: { fontSize: 44 } });
    assert.equal(override.fontSize, 44, 'Share controls can override saved typography');
    const mixed = await canvas.calculateShareCardHeight({ ...options, post: { content, poemFontSize: 14, poemTextStyles: spans } });
    assert.ok(mixed.styledLines.some(line => line.runs.some(run => run.text === '月光' && run.fontSize === 65)));
    assert.equal(mixed.styledLines.flatMap(line => line.runs).map(run => run.text).join(''), content.replace(/\n/g, ''));
    const painted = [];
    const drawCtx = { ...ctx, clearRect() {}, beginPath() {}, moveTo() {}, lineTo() {}, arcTo() {}, quadraticCurveTo() {}, closePath() {}, fill() {},
        save() {}, restore() {}, stroke() {}, setLineWidth() {}, setStrokeStyle() {}, setTextAlign() {}, setFillStyle() {}, setGlobalAlpha() {},
        fillText(text, x, y) { painted.push({ text, x, y, font: this.font }); } };
    await canvas.drawShareCardContent({ ...options, post: { content, poemFontSize: 14, poemTextStyles: spans }, ...mixed, canvasWidth: 750, ctx: drawCtx });
    assert.ok(painted.some(item => item.text === '月光' && item.font.startsWith('65px ')), 'Canvas paints selected words at their saved size');
    assert.ok(painted.some(item => item.text.includes('留在纸上') && item.font.startsWith('38px ')), 'Canvas leaves neighboring text at its base size');
    assert.ok(painted.filter(item => item.text !== 'poementer').every(item => item.y < mixed.canvasHeight - 30), 'Mixed sizes remain inside the exported card');
    const richCtx = { font: '', measureText(text) { return { width: Array.from(text).length * parseFloat(this.font.match(/([\d.]+)px/)[1]) }; } };
    const richLayout = typography.layoutPoemText(richCtx, richContent, richStyles, 28, 14, 480, 'Huiwen-mincho');
    assert.equal(richLayout[0].before, 16);
    assert.equal(richLayout[0].after, 24);
    assert.equal(richLayout[0].lineHeight, 96);
    const decorationLines = [], backgrounds = [], richPaint = [];
    let strokeY;
    typography.drawPoemTextLayout({ ...richCtx, setFillStyle() {}, setStrokeStyle() {}, setLineWidth() {}, beginPath() {},
        moveTo(x, y) { strokeY = y; }, lineTo(x, y) { decorationLines.push({ x, y, strokeY }); }, stroke() {},
        fillRect(...args) { backgrounds.push(args); }, fillText(text, x, y) { richPaint.push({ text, x, y, font: this.font }); }
    }, richLayout, { x: 60, top: 80, fontFamily: 'Huiwen-mincho', textColor: '#222222' });
    assert.ok(richPaint.some(item => item.font === 'italic bold 48px Huiwen-mincho'), 'Canvas uses the saved weight, slant, size and runtime font name');
    assert.equal(decorationLines.length, 2, 'Underline and strike are painted');
    assert.ok(backgrounds.length > 0, 'Text background is painted');
    assert.ok(richPaint.at(-1).x > richPaint[0].x, 'Paragraph alignment changes the text origin');
    const rawBlocks = [{ content, poemTextStyles: spans }, { content: '下一首', poemTextStyles: [{ start: 0, end: 1, fontSize: 20 }] }];
    const merged = typography.mergeSeriesTextStyles(rawBlocks);
    assert.equal(merged[1].start, content.length + 2);
    const seriesFields = typography.getPoemTypographyFields({ isSeries: true, seriesBlocks: rawBlocks });
    assert.deepEqual(plain(seriesFields.poemTextStyles), plain(merged));
    console.log('Poem typography: selection formatting, Delta round trip, drafts, publishing, V1/V2 editing, preview without controls, reading scale and mixed-size canvas layout passed.');
}

main().catch(error => { console.error(error); process.exitCode = 1; });
