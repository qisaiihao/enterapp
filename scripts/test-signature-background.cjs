const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { parse } = require('@babel/parser');

const root = path.join(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
function loadModule(file, globals = {}) {
    const source = read(file).replace(/^import .*;\r?\n/gm, '')
        .replace(/export \{([^}]+)\};/g, 'module.exports = {$1};');
    const sandbox = { module: { exports: {} }, ...globals };
    vm.runInNewContext(source, sandbox, { filename: file });
    return sandbox.module.exports;
}
const { removeSignatureBackground } = loadModule('utils/signatureMatting.js');

function fixture(width, height, background = [255, 255, 255, 255]) {
    const data = new Uint8ClampedArray(width * height * 4);
    for (let y = 0; y < height; y += 1) {
        for (let x = 0; x < width; x += 1) data.set(typeof background === 'function' ? background(x, y) : background, (y * width + x) * 4);
    }
    return { width, height, data };
}
function put(img, x, y, pixel) { img.data.set(pixel, (y * img.width + x) * 4); }
function pixel(img, x, y) { return Array.from(img.data.slice((y * img.width + x) * 4, (y * img.width + x) * 4 + 4)); }

function pixelTests() {
    for (const alpha of [0, 128]) {
        const img = fixture(12, 12, [0, 0, 0, alpha]);
        put(img, 6, 6, [0, 0, 0, 255]);
        put(img, 7, 6, [230, 230, 230, 80]);
        const original = img.data.slice();
        assert.equal(removeSignatureBackground(img).reason, 'transparent');
        assert.deepEqual(img.data, original, 'existing transparency and all stroke colors must survive byte for byte');
    }
    const contaminated = fixture(12, 12);
    put(contaminated, 2, 2, [0, 0, 0, 255]);
    put(contaminated, 6, 6, [0, 0, 0, 255]);
    removeSignatureBackground(contaminated);
    assert.equal(pixel(contaminated, 5, 5)[3], 0, 'a black border sample must not prevent removal of white paper');
    assert.equal(pixel(contaminated, 2, 2)[3], 255, 'edge strokes must remain');
    assert.equal(pixel(contaminated, 6, 6)[3], 255, 'isolated dots must remain');

    for (const ink of [[20, 20, 20], [20, 65, 165], [185, 20, 20]]) {
        const img = fixture(192, 128, (x, y) => {
            const gray = Math.round(180 + x * 60 / 191 + y * 8 / 127);
            return [gray, gray, gray, 255];
        });
        const original = img.data.slice();
        for (let x = 20; x < 172; x += 1) {
            for (const [y, coverage] of [[60, 1], [61, 0.5], [62, 0.2]]) {
                const bg = pixel(img, x, y);
                put(img, x, y, [...ink.map((color, c) => Math.round(coverage * color + (1 - coverage) * bg[c])), 255]);
            }
        }
        assert.equal(removeSignatureBackground(img).reason, 'removed');
        let residue = 0;
        for (let y = 0; y < 128; y += 1) for (let x = 0; x < 192; x += 1) {
            if (y >= 60 && y <= 62 && x >= 20 && x < 172) continue;
            if (pixel(img, x, y)[3] > 4) residue += 1;
        }
        assert.equal(residue, 0, 'smooth photographic shading must not leave a gray rectangle');
        for (const [y, alpha] of [[60, 255], [61, 128], [62, 51]]) {
            const p = pixel(img, 90, y);
            assert.ok(Math.abs(p[3] - alpha) <= 4, 'coverage should preserve antialiased thin strokes');
            for (let c = 0; c < 3; c += 1) assert.ok(Math.abs(p[c] - ink[c]) <= 8, 'recover ink color instead of keeping a pale fringe');
            const i = (y * 192 + 90) * 4;
            for (let c = 0; c < 3; c += 1) {
                const recomposed = p[c] * p[3] / 255 + original[i + c] * (1 - p[3] / 255);
                const expected = ink[c] * alpha / 255 + original[i + c] * (1 - alpha / 255);
                assert.ok(Math.abs(recomposed - expected) < 4, 'matte must reconstruct the original on paper');
            }
        }
        const once = img.data.slice();
        removeSignatureBackground(img);
        assert.deepEqual(img.data, once, 'already processed signature must be idempotent');
    }
    const warm = fixture(64, 32, [245, 235, 205, 255]);
    put(warm, 30, 15, [35, 35, 35, 255]);
    removeSignatureBackground(warm);
    assert.equal(pixel(warm, 0, 0)[3], 0);
    assert.deepEqual(pixel(warm, 30, 15), [35, 35, 35, 255]);
    const dark = fixture(10, 10, [30, 30, 30, 255]);
    put(dark, 5, 5, [255, 255, 255, 255]);
    const original = dark.data.slice();
    assert.equal(removeSignatureBackground(dark).reason, 'unsupported-background');
    assert.deepEqual(dark.data, original);
    assert.equal(removeSignatureBackground(fixture(1, 1)).reason, 'empty');
    assert.throws(() => removeSignatureBackground({ width: 0, height: 2, data: [] }));
}

async function adapterTests() {
    const events = [];
    const context = { setData(values) { Object.assign(this, values); }, async $nextTick() { events.push('resize'); } };
    const uni = {
        getImageInfo({ success }) { success({ width: 800, height: 200, path: 'native-original.png' }); },
        createCanvasContext(id, owner) {
            assert.equal(id, 'signatureCanvas');
            assert.equal(owner, context);
            return { clearRect() {}, drawImage(src) { assert.equal(src, 'native-original.png'); }, draw(reserve, callback) { setImmediate(() => { events.push('draw'); callback(); }); } };
        },
        canvasGetImageData(options) {
            assert.equal(events.at(-1), 'draw');
            events.push('read');
            const img = fixture(options.width, options.height);
            put(img, 20, 20, [0, 0, 0, 255]);
            options.success(img);
        },
        canvasPutImageData(options) {
            assert.equal(options.data[3], 0);
            setImmediate(() => { events.push('write'); options.success({}); });
        },
        canvasToTempFilePath(options) {
            assert.equal(events.at(-1), 'write');
            assert.equal(options.canvasId, 'signatureCanvas');
            assert.equal(options.destWidth, 600);
            assert.equal(options.destHeight, 150);
            assert.equal(options.fileType, 'png');
            events.push('export');
            options.success({ tempFilePath: 'native-result.png' });
        }
    };
    const { processSignatureFile, signatureSize } = loadModule('utils/signatureImage.js', { removeSignatureBackground, uni });
    assert.equal((await processSignatureFile('original.png', { context })).filePath, 'native-result.png');
    assert.deepEqual(events, ['resize', 'draw', 'read', 'write', 'export']);
    assert.equal(signatureSize(1, 99999, 600).width, 1);
    await assert.rejects(processSignatureFile('original.png', { context, isCurrent: () => false }), /取消/);
    uni.canvasGetImageData = ({ fail }) => fail(new Error('read failed'));
    await assert.rejects(processSignatureFile('original.png', { context }), /read failed/);
    uni.canvasToTempFilePath = options => {
        assert.equal(events.at(-1), 'draw', 'background-off path should not read/write pixels');
        assert.equal(options.destWidth, 600);
        options.success({ tempFilePath: 'plain.png' });
    };
    assert.equal((await processSignatureFile('original.png', { context, removeBackground: false })).filePath, 'plain.png');

    const miniImage = fixture(32, 16);
    put(miniImage, 12, 8, [0, 0, 0, 255]);
    const miniCanvas = {
        createImage() { return { width: 32, height: 16, set src(value) { queueMicrotask(() => this.onload()); } }; },
        getContext() { return { clearRect() {}, drawImage() {}, getImageData() { return miniImage; }, putImageData() {} }; }
    };
    const mini = loadModule('utils/signatureImage.js', {
        removeSignatureBackground,
        wx: { getAccountInfoSync() {} },
        uni: {
            createSelectorQuery() {
                const query = {
                    in(owner) { assert.equal(owner, context); return query; },
                    select(id) { assert.equal(id, '#signatureCanvas'); return query; },
                    fields() { return query; }, exec(callback) { callback([{ node: miniCanvas }]); }
                };
                return query;
            },
            canvasToTempFilePath(options) {
                assert.equal(options.canvas, miniCanvas);
                assert.equal(miniImage.data[3], 0);
                assert.equal(pixel(miniImage, 12, 8)[3], 255);
                assert.equal(options.fileType, 'png');
                options.success({ tempFilePath: 'mini-result.png' });
            }
        }
    });
    assert.equal((await mini.processSignatureFile('mini.png', { context })).filePath, 'mini-result.png');
}

function loadPage(processor, ui, extras = {}) {
    let source = read('pages-user/profile-edit/profile-edit.vue').match(/<script>([\s\S]*?)<\/script>/)[1];
    const imports = parse(source, { sourceType: 'module' }).program.body.filter(node => node.type === 'ImportDeclaration');
    for (const node of imports.reverse()) source = source.slice(0, node.start) + source.slice(node.end);
    source = source.replace('export default', 'module.exports =');
    const sandbox = { module: { exports: {} }, console: { warn() {}, log() {}, error() {} }, getApp: () => ({}), AppActionSheet: {}, AppDialog: {}, processSignatureFile: processor,
        getCurrentPlatform: () => 'app', STICKER_AVATAR_PATHS: [], uni: ui, ...extras };
    vm.runInNewContext(source, sandbox);
    const definition = sandbox.module.exports;
    return Object.assign(definition.data(), definition.methods, { onUnload: definition.onUnload, setData(values) { Object.assign(this, values); } });
}

async function lifecycleTests() {
    const calls = [], pending = [], uploads = [];
    let hidden = 0;
    const ui = { showLoading() {}, hideLoading() { hidden += 1; }, showToast() {}, showModal() {} };
    const processor = (src, options) => new Promise((resolve, reject) => { calls.push({ src, ...options }); pending.push({ resolve, reject }); });
    const page = loadPage(processor, ui, {
        normalizeStickerAvatarPath: value => value, isStickerAvatar: () => false,
        uploadFile: async (cloudPath, filePath) => { uploads.push(filePath); return 'cloud://confirmed'; }
    });
    Object.assign(page, { signaturePreview: 'saved.png', signatureUrl: 'cloud://saved', hasChanges: true });
    page.originalData.signatureUrl = 'cloud://saved';
    page.moderateProfileContent = () => { throw new Error('must not moderate an unconfirmed candidate'); };
    const settle = () => new Promise(resolve => setImmediate(resolve));
    const originalState = () => [page.signaturePreview, page.signatureTempPath, page.signatureUrl, page.signatureOriginalPath, page.autoRemoveSignatureBg];
    const saved = originalState();
    const first = page.processSignatureImage('true-original.png');
    await settle();
    assert.equal(page.isProcessingSignature, true);
    assert.deepEqual(originalState(), saved, 'processing does not replace the accepted signature');
    const second = page.onToggleSignatureBg({ detail: { value: false } });
    assert.equal(calls.length, 1, 'shared canvas tasks must not overlap');
    pending[0].resolve({ filePath: 'stale.png', changed: true });
    await first;
    await settle();
    assert.equal(page.signatureCandidate, null);
    assert.equal(hidden, 0, 'stale task must not dismiss current loading');
    assert.equal(calls[1].src, 'true-original.png');
    assert.equal(calls[1].removeBackground, false);
    pending[1].resolve({ filePath: 'plain.png', changed: false });
    await second;
    assert.equal(page.signatureCandidate.filePath, 'plain.png');
    assert.equal(page.isProcessingSignature, false);
    assert.deepEqual(originalState(), saved);
    await page.onSaveChanges();
    assert.equal(uploads.length, 0, 'pending preview must never be uploaded');
    page.confirmSignaturePreview();
    assert.equal(page.signaturePreview, 'plain.png');
    assert.equal(page.signatureTempPath, 'plain.png');
    assert.equal(page.signatureOriginalPath, 'true-original.png');
    assert.equal(page.autoRemoveSignatureBg, false);
    assert.equal(page.signatureCandidate, null);
    const third = page.onToggleSignatureBg({ detail: { value: true } });
    await settle();
    assert.equal(calls[2].src, 'true-original.png');
    pending[2].resolve({ filePath: 'clean.png', changed: true });
    await third;
    assert.equal(page.signatureCandidate.filePath, 'clean.png');
    assert.equal(page.signaturePreview, 'plain.png');
    page.confirmSignaturePreview();
    const confirmed = originalState();
    await page.onToggleSignatureBg({ detail: { value: false } });
    assert.equal(page.signatureCandidate.filePath, 'plain.png');
    page.cancelSignaturePreview();
    assert.deepEqual(originalState(), confirmed, 'canceling a toggle restores the confirmed signature and switch');
    assert.equal(page.signaturePendingRemoveBg, null);
    await page.onToggleSignatureBg({ detail: { value: false } });
    page.confirmSignaturePreview();
    await page.onToggleSignatureBg({ detail: { value: true } });
    page.confirmSignaturePreview();
    assert.equal(calls.length, 3, 'toggle should reuse the two versions without compression');
    assert.equal(page.signaturePreview, 'clean.png');
    assert.equal(page.signatureOriginalPath, 'true-original.png');

    const failed = page.processSignatureImage('new-original.png');
    await settle();
    pending[3].reject(new Error('export failed'));
    await failed;
    assert.equal(page.signatureCandidate.filePath, 'new-original.png');
    assert.equal(page.signatureCandidate.reason, 'failed');
    assert.deepEqual(originalState(), confirmed, 'failed processing only offers the original for review');
    page.cancelSignaturePreview();
    assert.deepEqual(originalState(), confirmed, 'canceling a new upload preserves even an unsaved accepted signature');
    await page.onToggleSignatureBg({ detail: { value: false } });
    assert.equal(calls.length, 4, 'canceling another source restores the accepted source cache');
    page.onSignaturePreviewError();
    assert.equal(page.signatureCandidate, null);
    assert.deepEqual(originalState(), confirmed, 'broken preview must not replace the accepted signature');
    page.confirmSignaturePreview();
    assert.deepEqual(originalState(), confirmed, 'confirming twice or after cancellation must have no effect');

    const canceled = page.processSignatureImage('cancel-during-processing.png');
    await settle();
    page.cancelSignaturePreview();
    const hiddenOnCancel = hidden;
    pending[4].resolve({ filePath: 'after-cancel.png' });
    await canceled;
    assert.equal(page.signatureCandidate, null, 'late processing must not reopen the dialog after cancellation');
    assert.deepEqual(originalState(), confirmed);
    assert.equal(hidden, hiddenOnCancel);

    // Actual save reaches the uploader with the accepted result only.
    page.moderateProfileContent = async () => ({ passed: true });
    page.callCloudFunction = async () => ({ result: { success: false, message: 'fixture: no remote writes' } });
    await page.onSaveChanges();
    await settle();
    assert.deepEqual(uploads, ['clean.png']);

    // A newly chosen image during asynchronous moderation invalidates that save.
    let finishModeration;
    page.moderateProfileContent = () => new Promise(resolve => { finishModeration = resolve; });
    const saving = page.onSaveChanges();
    const changedDuringSave = page.processSignatureImage('during-moderation.png');
    await settle();
    finishModeration({ passed: true });
    await saving;
    assert.equal(uploads.length, 1);
    page.cancelSignaturePreview();
    pending[5].resolve({ filePath: 'unapproved.png' });
    await changedDuringSave;

    const closing = page.processSignatureImage('last-original.png');
    await settle();
    page.onUnload();
    const hiddenOnClose = hidden;
    pending[6].resolve({ filePath: 'after-close.png' });
    await closing;
    assert.equal(page.signatureCandidate, null);
    assert.deepEqual(originalState(), confirmed);
    assert.equal(hidden, hiddenOnClose);
    await page.processSignatureImage('picker-after-close.png');
    assert.equal(calls.length, 7, 'late picker callbacks must not restart a closed page');
}

async function shareTests() {
    const source = read('utils/shareCanvas.js').replace(/^import .*;\r?\n/gm, '')
        .replace(/^export \{[\s\S]*?\};\r?\n/gm, '').replace('export default shareCanvas;', 'module.exports = shareCanvas;');
    const requested = [];
    const sandbox = { module: { exports: {} }, console,
        fileUrlCache: { getTempUrl: async () => 'https://example.test/signature.png' },
        wx: { createOffscreenCanvas() { throw new Error('sharing must not remove a user-selected background'); } },
        uni: { getImageInfo({ src, success }) { requested.push(src); success({ path: 'downloaded-signature.png' }); } }
    };
    vm.runInNewContext(source, sandbox);
    const prepare = sandbox.module.exports.prepareSignatureForCard;
    assert.equal(await prepare('cloud://signature'), 'downloaded-signature.png');
    assert.deepEqual(requested, ['https://example.test/signature.png'], 'mini program must load the resolved URL');
    assert.equal(await prepare('cloud://signature'), 'downloaded-signature.png');
    assert.equal(requested.length, 1);
}

(async () => {
    pixelTests();
    await adapterTests();
    await lifecycleTests();
    await shareTests();
    console.log('[test-signature-background] PASS (matting, native canvas, cancellation, original preservation, sharing)');
})().catch(error => { console.error(error); process.exitCode = 1; });
