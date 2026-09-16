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
        await page.setContent('<!doctype html><html><body></body></html>');
        for (const file of ['utils/signatureMatting.js', 'utils/signatureImage.js']) {
            const source = fs.readFileSync(path.join(__dirname, '..', file), 'utf8')
                .replace(/^import .*;\r?\n/gm, '').replace(/^export \{[^}]+\};/gm, '');
            await page.addScriptTag({ content: source });
        }
        const results = await page.evaluate(async () => {
            const decode = async src => {
                const img = new Image();
                await new Promise((resolve, reject) => { img.onload = resolve; img.onerror = reject; img.src = src; });
                const canvas = document.createElement('canvas');
                canvas.width = img.width;
                canvas.height = img.height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0);
                return { width: img.width, height: img.height, data: ctx.getImageData(0, 0, img.width, img.height).data };
            };
            const pixel = (img, x, y) => Array.from(img.data.slice((y * img.width + x) * 4, (y * img.width + x) * 4 + 4));
            const source = document.createElement('canvas');
            source.width = 1600;
            source.height = 500;
            const ctx = source.getContext('2d');
            const gradient = ctx.createLinearGradient(0, 0, 1600, 0);
            gradient.addColorStop(0, '#b6b6b6');
            gradient.addColorStop(1, '#f7f7f7');
            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, 1600, 500);
            ctx.strokeStyle = '#1441a5';
            ctx.lineWidth = 10;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(150, 200);
            ctx.bezierCurveTo(500, 100, 850, 300, 1450, 200);
            ctx.stroke();
            ctx.fillStyle = '#1441a5';
            ctx.fillRect(790, 198, 20, 6);
            const jpeg = source.toDataURL('image/jpeg', 0.85);
            const started = performance.now();
            const processed = await processSignatureFile(jpeg);
            const elapsedMs = Math.round(performance.now() - started);
            const clean = await decode(processed.filePath);
            const backgrounds = [pixel(clean, 0, 0), pixel(clean, 40, 20), pixel(clean, 300, 20), pixel(clean, 590, 170)];
            let coloredEdges = 0, paleEdges = 0;
            for (let i = 0; i < clean.data.length; i += 4) {
                if (clean.data[i + 3] > 30 && clean.data[i + 3] < 220) {
                    coloredEdges += 1;
                    if (Math.min(clean.data[i], clean.data[i + 1], clean.data[i + 2]) > 150) paleEdges += 1;
                }
            }
            const plain = await decode((await processSignatureFile(jpeg, { removeBackground: false })).filePath);

            const transparent = document.createElement('canvas');
            transparent.width = 300;
            transparent.height = 100;
            const tctx = transparent.getContext('2d');
            tctx.fillStyle = '#000';
            tctx.fillRect(60, 20, 180, 5);
            tctx.fillStyle = 'rgba(230,230,230,0.5)';
            tctx.fillRect(60, 25, 180, 1);
            const transparentSource = transparent.toDataURL('image/png');
            const transparentResult = await processSignatureFile(transparentSource);
            const before = await decode(transparentSource), after = await decode(transparentResult.filePath);
            let maxDifference = 0;
            for (let i = 0; i < before.data.length; i += 1) maxDifference = Math.max(maxDifference, Math.abs(before.data[i] - after.data[i]));
            let failed = false;
            try { await processSignatureFile('data:image/png;base64,invalid'); } catch (_) { failed = true; }
            return { width: clean.width, height: clean.height, isPng: processed.filePath.startsWith('data:image/png;base64,'),
                changed: processed.changed, backgrounds, coloredEdges, paleEdges, plainBackground: pixel(plain, 10, 10),
                transparentReason: transparentResult.reason, maxDifference, failed, elapsedMs };
        });
        assert.equal(results.width, 600);
        assert.equal(results.height, 188);
        assert.equal(results.isPng, true);
        assert.equal(results.changed, true);
        for (const p of results.backgrounds) assert.ok(p[3] <= 4, `paper residue: ${p}`);
        assert.ok(results.coloredEdges > 30, 'keep soft antialiased edges');
        assert.equal(results.paleEdges, 0, 'edges must not retain the white paper color');
        assert.equal(results.plainBackground[3], 255, 'disabled removal must keep paper opaque');
        assert.equal(results.transparentReason, 'transparent');
        assert.ok(results.maxDifference <= 1, 'transparent PNG must survive browser decode/export');
        assert.equal(results.failed, true, 'invalid image must reject instead of hanging');
        console.log(`[test-signature-h5] PASS (real Canvas/JPEG/PNG, ${results.coloredEdges} soft edge pixels, processing ${results.elapsedMs}ms)`);
    } finally {
        await browser.close();
    }
})().catch(error => { console.error(error); process.exitCode = 1; });
