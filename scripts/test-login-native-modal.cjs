const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { parse } = require('@babel/parser');
const root = path.join(__dirname, '..');

function load(file, globals, named = [], app = true) {
    const imports = {};
    let source = fs.readFileSync(path.join(root, file), 'utf8');
    if (file.endsWith('.vue')) source = source.match(/<script>([\s\S]*?)<\/script>/)[1];
    if (!app) source = source.replace(/\/\/ #ifdef APP-PLUS[\s\S]*?\/\/ #endif/g, '');
    for (const node of parse(source, { sourceType: 'module' }).program.body.reverse()) {
        if (node.type === 'ImportDeclaration') {
            for (const specifier of node.specifiers) imports[specifier.local.name] = {};
            source = source.slice(0, node.start) + source.slice(node.end);
        } else if (node.type === 'ExportNamedDeclaration') {
            source = source.slice(0, node.start) + source.slice(node.declaration.start);
        } else if (node.type === 'ExportDefaultDeclaration') {
            source = source.slice(0, node.start) + 'module.exports = ' + source.slice(node.declaration.start);
        }
    }
    if (named.length) source += `\nmodule.exports = { ${named.join(', ')} };`;
    const context = { module: { exports: {} }, console, ...imports, ...globals };
    vm.runInNewContext(source, context, { filename: file });
    return context.module.exports;
}

async function main() {
    const nativeRequests = [];
    const navigations = [];
    const state = { isLoggedIn: false };
    const owner = {};
    let backCount = 0;
    const uni = {
        showModal(options) {
            nativeRequests.push(options);
            if (!options.success && !options.fail) return Promise.resolve({ confirm: true, cancel: false });
        },
        showActionSheet() {},
        getStorageSync() { return null; },
        navigateTo(options) { navigations.push(options.url); },
        navigateBack() { backCount++; }
    };
    const globals = { uni, getCurrentPages: () => [{ route: 'pages/index/index', $vm: owner }] };
    const overlays = load('utils/appOverlay.js', globals,
        ['installAppOverlays', 'showNativeModal', 'registerOverlayHost', 'answerOverlay']);
    assert.equal((await overlays.showNativeModal({ title: 'before install' })).confirm, true);
    overlays.installAppOverlays();
    overlays.installAppOverlays();
    assert.equal((await overlays.showNativeModal({ title: 'after install' })).confirm, true);
    const authGlobals = { ...globals, ...overlays, getAppState: () => state };
    const auth = load('utils/authHelper.js', authGlobals, ['requireLogin', 'checkLoginOrPrompt']);

    // No overlay host: App prompts must immediately reach the saved platform API.
    let confirmed = 0;
    const confirm = auth.requireLogin({ onConfirm: () => confirmed++ });
    assert.equal(nativeRequests.at(-1).title, '需要登录');
    nativeRequests.at(-1).success({ confirm: true });
    assert.equal(await confirm, true);
    assert.equal(confirmed, 1);
    assert.deepEqual(navigations, ['/pages/login/login']);

    let displayed;
    overlays.registerOverlayHost(owner, request => { displayed = request; });
    assert.equal(displayed, null, 'native prompt must not also be queued for a late host');
    let cancelled = 0;
    const cancel = auth.requireLogin({ onCancel: () => cancelled++ });
    nativeRequests.at(-1).success({ confirm: false, cancel: true });
    assert.equal(await cancel, false);
    assert.equal(cancelled, 1);
    assert.equal(navigations.length, 1);
    assert.equal(displayed, null, 'mounted host must not receive the App login prompt');
    const failure = auth.requireLogin();
    nativeRequests.at(-1).fail({ errMsg: 'showModal:fail' });
    assert.equal(await failure, false);

    // Exercise the actual "我" click handler and the publish page's onLoad guard.
    const tab = load('custom-tab-bar/index.vue', { ...globals, ...auth, getApp: () => ({ globalData: state }) });
    tab.methods.switchTab.call({}, { currentTarget: { dataset: { index: 3, path: '/pages/profile/profile' } } });
    assert.equal(nativeRequests.at(-1).content, '查看个人主页需要登录，请先登录');
    nativeRequests.at(-1).success({ confirm: true });
    assert.deepEqual(navigations, ['/pages/login/login', '/pages/login/login']);
    const publish = load('pages-publish/add/add.vue', { ...globals, ...auth });
    const loading = publish.onLoad.call({}, {});
    assert.equal(nativeRequests.at(-1).content, '发帖前请先登录');
    nativeRequests.at(-1).success({ confirm: false, cancel: true });
    await loading;
    assert.equal(backCount, 1, 'cancelling the writing prompt returns to the previous page');

    const callCount = nativeRequests.length;
    state.isLoggedIn = true;
    assert.equal(await auth.checkLoginOrPrompt(), true);
    assert.equal(nativeRequests.length, callCount, 'logged-in users are not prompted');
    state.isLoggedIn = false;
    const webAuth = load('utils/authHelper.js', authGlobals, ['requireLogin'], false);
    const webCancel = webAuth.requireLogin();
    assert.equal(nativeRequests.length, callCount, 'H5 retains the existing custom prompt');
    assert.equal(displayed.options.title, '需要登录');
    overlays.answerOverlay(owner, displayed, 'cancel');
    assert.equal(await webCancel, false);
    console.log('[test-login-native-modal] PASS: native API before/after install, missing/mounted host, confirm/cancel/failure, profile/write entry points and H5 behavior');
}

main().catch(error => { console.error(error); process.exitCode = 1; });
