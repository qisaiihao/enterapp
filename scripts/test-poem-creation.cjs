const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createRequire } = require('node:module');
const { parse } = require('@babel/parser');
const cloud = require('wx-server-sdk');
const { memoryDb } = require('./helpers/posts-memory-db.cjs');
cloud.init({ env: 'poem-creation-test' });
const command = cloud.database().command;
const root = path.resolve(__dirname, '..');
const quiet = { log() {}, warn() {}, error() {} };
const plain = value => JSON.parse(JSON.stringify(value));
const fields = { creationDate: '2026-10-12', creationLocation: '杭州，窗前', showCreationDate: true, showCreationLocation: true };

function load(file, globals = {}) {
    let source = fs.readFileSync(path.join(root, file), 'utf8');
    if (file.endsWith('.vue')) source = source.match(/<script>([\s\S]*?)<\/script>/)[1];
    const bindings = {};
    for (const node of parse(source, { sourceType: 'module' }).program.body.reverse()) {
        if (node.type === 'ImportDeclaration') {
            for (const spec of node.specifiers) bindings[spec.local.name] = () => {};
            source = source.slice(0, node.start) + source.slice(node.end);
        } else if (node.type === 'ExportDefaultDeclaration') {
            source = source.slice(0, node.start) + 'module.exports = ' + source.slice(node.declaration.start);
        } else if (node.type === 'ExportNamedDeclaration') {
            source = source.slice(0, node.start) + source.slice(node.declaration ? node.declaration.start : node.end);
        }
    }
    if (file === 'utils/poemCreation.js') source += '\nmodule.exports = { getCreationFields, getCreationLabel };';
    const sandbox = { ...bindings, module: { exports: {} }, console: quiet, ...globals };
    vm.runInNewContext(source, sandbox, { filename: file });
    return sandbox.module.exports;
}
const creation = load('utils/poemCreation.js');
function backend(mem, name) {
    const filename = path.join(root, 'functions', name, 'index.js');
    const localRequire = createRequire(filename);
    const sandbox = { exports: {}, process, Buffer, console: quiet, require(id) {
        if (id === 'wx-server-sdk') return {
            init() {}, database: () => mem.db, getWXContext: () => ({ OPENID: 'owner' }),
            callFunction: async () => ({ result: { success: true, passed: true, code: 'MODERATION_OFF' } })
        };
        return localRequire(id);
    } };
    vm.runInNewContext(fs.readFileSync(filename, 'utf8'), sandbox, { filename });
    return event => sandbox.exports.main(event, {});
}

async function main() {
    const poem = { publishMode: 'poem', isOriginal: true, ...fields };
    assert.equal(creation.getCreationLabel(poem), '2026.10.12 · 杭州，窗前');
    assert.equal(creation.getCreationLabel({ ...poem, showCreationDate: false }), '杭州，窗前');
    assert.equal(creation.getCreationLabel({ ...poem, showCreationLocation: false }), '2026.10.12');
    for (const change of [{ showCreationDate: false, showCreationLocation: false }, { isOriginal: false }, { publishMode: 'normal' }, { creationDate: '', creationLocation: '  ' }]) {
        assert.equal(creation.getCreationLabel({ ...poem, ...change }), '');
    }
    assert.equal(creation.getCreationLabel({ isPoem: true, isOriginal: true }), '');

    const requests = [];
    const globals = { ...creation, uni: { getStorageSync: () => ({ nickName: '作者' }) },
        async contentAudit(data) { requests.push(data); return { code: 0, postId: 'new' }; },
        async updatePostContent(id, { data }) { requests.push(data); return { success: true }; }
    };
    const add = load('pages-publish/add/add.vue', globals);
    const preview = load('pages-publish/preview/preview.vue', globals);
    const state = { ...add.data(), ...fields, content: '月光落在窗前', publishMode: 'poem', isOriginal: true,
        selectedTags: [], buildDiscussionSentenceGroups: () => [],
        publishSuccess() {}, publishFail(error) { throw error; } };
    const editorState = { ...state, ...creation.getCreationFields(),
        setData(data) { Object.assign(this, data); }, scheduleWorkingDraftSave() {} };
    const previewState = { post: { isPoem: true, isOriginal: true, ...creation.getCreationFields(),
        editData: { publishMode: 'poem', isOriginal: true } }, getAddPageVm: () => editorState };
    const creationEditor = load('components/add/PoemCreationEditor.vue');
    const form = { $emit(event, change) { preview.methods.onCreationChange.call(previewState, change); } };
    creationEditor.methods.changeDate.call(form, { detail: { value: fields.creationDate } });
    creationEditor.methods.changeLocation.call(form, { detail: { value: fields.creationLocation } });
    assert.deepEqual(plain(creation.getCreationFields(previewState.post)), fields);
    assert.deepEqual(plain(creation.getCreationFields(previewState.post.editData)), fields);
    assert.deepEqual(plain(creation.getCreationFields(editorState)), fields);
    assert.equal(preview.computed.creationLabel.call(previewState), '2026.10.12 · 杭州，窗前');
    creationEditor.methods.changeLocation.call(form, { detail: { value: '' } });
    assert.equal(preview.computed.creationLabel.call(previewState), '2026.10.12');
    assert.equal(editorState.creationLocation, '');
    creationEditor.methods.changeDate.call(form, { detail: { value: '' } });
    assert.equal(preview.computed.creationLabel.call(previewState), '');
    creationEditor.methods.changeDate.call(form, { detail: { value: '2026年秋' } });
    assert.equal(preview.computed.creationLabel.call(previewState), '2026年秋');
    creationEditor.methods.changeDate.call(form, { detail: { value: '17:30-18:00' } });
    assert.equal(preview.computed.creationLabel.call(previewState), '17:30-18:00');
    creationEditor.methods.changeDate.call(form, { detail: { value: fields.creationDate } });
    creationEditor.methods.changeLocation.call(form, { detail: { value: fields.creationLocation } });
    const draft = add.methods.buildWorkingDraftData.call(editorState);
    assert.deepEqual(plain(creation.getCreationFields(draft)), fields);
    const restored = { ...add.data(), setData(data) { Object.assign(this, data); },
        buildDefaultBlocks: add.methods.buildDefaultBlocks, buildDefaultSeriesBlocks: add.methods.buildDefaultSeriesBlocks,
        syncWorkingDraftSession() {}, updatePlaceholder() {}, checkCanPublish() {} };
    const restoreName = Object.keys(add.methods).find(key => /restore.*Draft/i.test(key));
    add.methods[restoreName].call(restored, draft);
    assert.deepEqual(plain(creation.getCreationFields(restored)), fields);
    for (const edit of [false, true]) {
        for (const entry of ['add', 'preview']) {
            requests.length = 0;
            const data = { ...state, isEditMode: edit, editingPostId: edit ? 'existing' : '' };
            if (entry === 'add') await add.methods.submitToDatabase.call(data, []);
            else await preview.methods.submitToDatabase.call({ post: {}, publishSuccess() {}, publishFail(error) { throw error; } }, data, []);
            assert.equal(requests.length, 1);
            assert.deepEqual(plain(creation.getCreationFields(requests[0])), fields, `${entry} edit=${edit}`);
        }
    }

    const previous = process.env.POSTS_WRITE_SCHEMA;
    try {
        for (const version of ['1', '2']) {
            process.env.POSTS_WRITE_SCHEMA = version;
            const mem = memoryDb({ users: [{ _openid: 'owner', nickName: '作者' }], posts: [], votes_log: [], activities: [] }, command);
            for (const name of ['contentCheck', 'createPost']) {
                const result = await backend(mem, name)({ ...poem, content: '月光落在窗前' });
                assert.ok(result.postId, JSON.stringify(result));
                const stored = mem.tables.posts.find(post => post._id === result.postId);
                assert.deepEqual(plain(creation.getCreationFields(stored)), fields, `${name} schema=${version}`);
                const update = backend(mem, 'updatePostContent');
                const hidden = await update({ postId: result.postId, data: { showCreationDate: false, showCreationLocation: false } });
                assert.equal(hidden.success, true, JSON.stringify(hidden));
                const next = mem.tables.posts.find(post => post._id === result.postId);
                assert.equal(creation.getCreationLabel(next), '');
                assert.equal(next.creationDate, fields.creationDate);
                assert.equal(next.creationLocation, fields.creationLocation);
                await update({ postId: result.postId, data: { ...fields, creationLocation: '苏州' } });
                const detail = await backend(mem, 'getPostDetail')({ postId: result.postId });
                assert.equal(creation.getCreationLabel(detail.post), '2026.10.12 · 苏州');
                await update({ postId: result.postId, data: { isOriginal: false } });
                const nonOriginal = mem.tables.posts.find(post => post._id === result.postId);
                assert.ok(!nonOriginal.creationDate && !nonOriginal.creationLocation);
                assert.equal(creation.getCreationLabel(nonOriginal), '');
            }
        }
    } finally {
        if (previous === undefined) delete process.env.POSTS_WRITE_SCHEMA;
        else process.env.POSTS_WRITE_SCHEMA = previous;
    }

    const canvas = load('utils/shareCanvas.js', { ...creation, fontManager: { getRuntimeFontFamily: () => 'Huiwen-mincho' } });
    const painted = [];
    const ctx = { font: '', measureText(text) { return { width: text.length * parseInt(this.font) }; },
        clearRect() {}, beginPath() {}, moveTo() {}, lineTo() {}, arcTo() {}, quadraticCurveTo() {}, closePath() {},
        fill() {}, save() {}, restore() {}, stroke() {}, setLineWidth() {}, setStrokeStyle() {}, setTextAlign() {}, setFillStyle() {},
        setGlobalAlpha(value) { this.alpha = value; }, fillText(text, x, y) { painted.push({ text, x, y, alpha: this.alpha }); } };
    const post = { ...poem, content: '月光落在窗前', authorName: '作者', creationLocation: '一处很长的创作地点'.repeat(4) };
    const options = { post, measureCtx: ctx, shareConfig: {}, canvasWidth: 750, shouldShowSignature: true };
    const sized = await canvas.calculateShareCardHeight(options);
    const without = await canvas.calculateShareCardHeight({ ...options, post: { ...post, showCreationDate: false, showCreationLocation: false } });
    assert.ok(sized.creationLines.length > 1, 'Long locations wrap');
    assert.ok(sized.canvasHeight > without.canvasHeight, 'Canvas reserves footer height');
    await canvas.drawShareCardContent({ ...options, ...sized, ctx });
    const footer = painted.filter(item => item.alpha === 0.65);
    assert.equal(footer.map(item => item.text).join(''), creation.getCreationLabel(post));
    assert.ok(painted.find(item => item.text === '作者').y > footer.at(-1).y, 'Signature follows the footer');
    assert.ok(painted.every(item => item.y < sized.canvasHeight - 30), 'All text fits inside the card');
    console.log('Poem creation: independent options, drafts, publishing, both storage schemas, editing, detail and share layout passed.');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
