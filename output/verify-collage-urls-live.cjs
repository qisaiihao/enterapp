const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const puppeteer = require('puppeteer-core');

(async () => {
  const browser = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
  try {
    const page = await browser.newPage();
    page.setDefaultTimeout(60000);
    const cloudSchemeRequests = [];
    page.on('request', request => { if (request.url().startsWith('cloud://')) cloudSchemeRequests.push(request.url()); });
    await page.goto('http://localhost:8081/#/pages-collage/collage-studio/collage-studio', { waitUntil: 'networkidle2' });
    const report = await page.evaluate(async () => {
      const batches = [];
      const sdk = uni.$tcb;
      const getTempFileURL = sdk.getTempFileURL.bind(sdk);
      sdk.getTempFileURL = options => {
        batches.push(options.fileList.length);
        return getTempFileURL(options);
      };
      const { default: cache } = await import('/cache/core/file-url.js');
      cache.invalidate();
      const { getOfficialMaterials } = await import('/api-cache/collage-materials.js');
      const groups = await getOfficialMaterials({ type: 'background', forceRefresh: true });
      const materials = groups.flatMap(group => group.materials);
      const previews = [];
      for (let i = 0; i < materials.length; i += 6) {
        previews.push(...await Promise.all(materials.slice(i, i + 6).map(async material => {
          const image = new Image();
          image.src = material.url;
          await image.decode();
          return { name: material.name, width: image.naturalWidth, height: image.naturalHeight };
        })));
      }
      const { importOfficialImage } = await import('/utils/collage/official.js');
      const { removeFile } = await import('/utils/collage/storage.js');
      const imported = [];
      const target = materials.find(item => item.id === '3d00e15d6ab9e8a000ab3b303475acd2');
      if (!target) throw new Error('Missing reported material');
      // Also exercise recovery of an old picker entry containing a raw cloud ID.
      for (const item of [target, { ...target, url: target.fileID }]) {
        const saved = await importOfficialImage(item);
        try {
          const image = new Image();
          image.src = saved.path;
          await image.decode();
          const canvas = document.createElement('canvas');
          canvas.width = saved.width; canvas.height = saved.height;
          canvas.getContext('2d').drawImage(image, 0, 0);
          const exported = canvas.toDataURL('image/png');
          imported.push({ name: item.name, width: saved.width, height: saved.height, persisted: saved.ref.startsWith('idb:'), exported: exported.startsWith('data:image/png;base64,') });
        } finally { await removeFile(saved.ref); }
      }
      return { count: materials.length, groups: groups.length, batches, allHttps: materials.every(item => item.url.startsWith('https://')), previewCount: previews.length, imported };
    });
    assert.equal(report.count, 101);
    assert.deepEqual(report.batches, [50, 50, 1]);
    assert.equal(report.allHttps, true);
    assert.equal(report.previewCount, 101);
    assert.equal(cloudSchemeRequests.length, 0);
    assert.ok(report.imported.every(item => item.persisted && item.exported && item.width === 900 && item.height === 1200));
    fs.writeFileSync(path.join(__dirname, 'collage-url-live-result.json'), JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report, null, 2));
  } finally { await browser.close(); }
})().catch(error => { console.error(error.message); process.exitCode = 1; });
