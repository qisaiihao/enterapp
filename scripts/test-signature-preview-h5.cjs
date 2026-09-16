const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const puppeteer = require('puppeteer-core');

(async () => {
    const browser = await puppeteer.launch({
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe',
        headless: true
    });
    try {
        const page = await browser.newPage();
        await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
        await page.goto((process.env.H5_URL || 'http://127.0.0.1:8081/') + '#/pages/login/login', { waitUntil: 'networkidle2' });
        await page.waitForFunction(() => typeof getCurrentPages === 'function' && getCurrentPages().at(-1)?.$vm);
        await page.evaluate(async () => {
            const source = await (await fetch('/components/overlay/AppDialog.vue')).text();
            const { h, render, nextTick } = await import(source.match(/from "([^"\n]*vue\.runtime\.esm\.js[^"\n]*)"/)[1]);
            const overlay = await import(source.match(/from "([^"\n]*utils\/appOverlay\.js[^"\n]*)"/)[1]);
            const original = (await import('/pages-user/profile-edit/profile-edit.vue')).default;
            const review = window.__signaturePreviewReview = { moderationCalls: 0, remoteCalls: 0 };
            const component = { ...original, onLoad: undefined, onShow: undefined, onReady: undefined,
                methods: { ...original.methods,
                    async moderateProfileContent() { review.moderationCalls += 1; return { passed: false, message: 'fixture' }; },
                    async callCloudFunction() { review.remoteCalls += 1; throw new Error('unexpected remote request'); }
                }
            };
            const container = document.createElement('div');
            container.id = 'signature-preview-review';
            document.body.appendChild(container);
            const node = h(component);
            node.appContext = getCurrentPages().at(-1).$vm.$.appContext;
            render(node, container);
            review.instance = node.component.proxy;
            const canvas = document.createElement('canvas');
            canvas.width = 480;
            canvas.height = 160;
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = '#f3efe5';
            ctx.fillRect(0, 0, 480, 160);
            ctx.strokeStyle = '#1b2941';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(50, 115);
            ctx.bezierCurveTo(240, 30, 100, 20, 145, 95);
            ctx.bezierCurveTo(165, 150, 230, 10, 245, 65);
            ctx.bezierCurveTo(290, 140, 370, 15, 420, 75);
            ctx.stroke();
            review.source = canvas.toDataURL('image/png');
            review.instance.signaturePreview = review.source;
            review.instance.signatureUrl = 'cloud://saved-fixture';
            review.instance.originalData.signatureUrl = 'cloud://saved-fixture';
            review.instance.nickName = 'fixture edited';
            review.open = async () => { await review.instance.processSignatureImage(review.source); await nextTick(); };
            review.back = () => overlay.appOverlayPageMixin.onBackPress({ from: 'backbutton' });
            review.setTheme = async mode => {
                uni.setStorageSync('poementerThemeMode', mode);
                uni.$emit('theme:changed', { mode });
                await nextTick();
            };
            await review.setTheme('light');
            await review.open();
        });
        const dialog = '#signature-preview-review .app-dialog';
        await page.waitForSelector(dialog);
        const initial = await page.evaluate(async () => {
            const review = window.__signaturePreviewReview, instance = review.instance;
            await instance.onSaveChanges();
            const panel = document.querySelector('#signature-preview-review .app-dialog');
            const rect = panel.getBoundingClientRect();
            return { count: panel.querySelectorAll('uni-image').length, text: panel.textContent,
                checker: getComputedStyle(panel.querySelector('.signature-confirm-result')).backgroundImage,
                inViewport: rect.left >= 0 && rect.right <= innerWidth && rect.top >= 0 && rect.bottom <= innerHeight,
                unchanged: instance.signaturePreview === review.source && instance.signatureTempPath === null && instance.signatureUrl === 'cloud://saved-fixture',
                candidateChanged: instance.signatureCandidate.changed, moderationCalls: review.moderationCalls };
        });
        assert.equal(initial.count, 2);
        assert.match(initial.text, /原图/);
        assert.match(initial.text, /去白底效果/);
        assert.match(initial.text, /使用签名/);
        assert.notEqual(initial.checker, 'none');
        assert.equal(initial.inViewport, true);
        assert.equal(initial.unchanged, true);
        assert.equal(initial.candidateChanged, true);
        assert.equal(initial.moderationCalls, 0);
        const output = path.join(__dirname, '../unpackage/signature-preview-review');
        fs.mkdirSync(output, { recursive: true });
        await page.screenshot({ path: path.join(output, 'light.png') });
        await page.click(dialog + ' .app-dialog-button:first-child');
        await page.waitForFunction(() => window.__signaturePreviewReview.instance.signatureCandidate === null);
        assert.equal(await page.evaluate(() => window.__signaturePreviewReview.instance.signatureTempPath), null);

        await page.evaluate(async () => { await window.__signaturePreviewReview.setTheme('dark'); await window.__signaturePreviewReview.open(); });
        await page.waitForSelector('#signature-preview-review .app-dialog-mask.overlay-dark');
        await page.screenshot({ path: path.join(output, 'dark.png') });
        assert.equal(await page.evaluate(() => window.__signaturePreviewReview.back()), true);
        await page.waitForFunction(() => window.__signaturePreviewReview.instance.signatureCandidate === null);
        assert.equal(await page.evaluate(() => window.__signaturePreviewReview.instance.signatureTempPath), null);

        await page.evaluate(() => window.__signaturePreviewReview.open());
        await page.waitForSelector(dialog);
        await page.click(dialog + ' .app-dialog-button:last-child');
        await page.waitForFunction(() => window.__signaturePreviewReview.instance.signatureCandidate === null);
        assert.equal(await page.evaluate(() => {
            const { instance, source } = window.__signaturePreviewReview;
            return instance.signatureTempPath.startsWith('data:image/png') && instance.signatureTempPath !== source &&
                instance.signatureOriginalPath === source && instance.signatureUrl === '';
        }), true);
        await page.evaluate(async () => {
            const review = window.__signaturePreviewReview;
            review.accepted = review.instance.signatureTempPath;
            await review.instance.onToggleSignatureBg({ detail: { value: false } });
        });
        await page.waitForSelector(dialog);
        await page.click(dialog + ' .app-dialog-button:first-child');
        assert.equal(await page.evaluate(() => {
            const { instance, accepted } = window.__signaturePreviewReview;
            return instance.signatureTempPath === accepted && instance.autoRemoveSignatureBg === true;
        }), true);
        await page.evaluate(async () => {
            const review = window.__signaturePreviewReview;
            await review.open();
            review.instance.signatureCandidate.reason = 'failed';
        });
        assert.match(await page.$eval(dialog, el => el.textContent), /处理未成功/);
        await page.click(dialog + ' .app-dialog-button:first-child');
        assert.equal(await page.evaluate(() => window.__signaturePreviewReview.remoteCalls), 0);
        console.log('[test-signature-preview-h5] PASS (real page processing, comparison, confirm/cancel/back, themes, upload gate)');
    } finally {
        await browser.close();
    }
})().catch(error => { console.error(error); process.exitCode = 1; });
