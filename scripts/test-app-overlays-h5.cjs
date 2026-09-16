const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const puppeteer = require('puppeteer-core');

async function main() {
  const browser = await puppeteer.launch({
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    headless: true, args: ['--no-sandbox']
  });
  const screenshots = path.join(os.tmpdir(), 'enterkey-overlay-review');
  fs.mkdirSync(screenshots, { recursive: true });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 });
    await page.goto((process.env.H5_URL || 'http://127.0.0.1:8081/') + '#/pages/login/login', { waitUntil: 'networkidle2', timeout: 60000 });
    await page.waitForFunction(() => typeof uni !== 'undefined' && typeof getCurrentPages === 'function' && getCurrentPages().length > 0);
    await page.evaluate(() => {
      window.__overlayResults = [];
      uni.showModal({
        title: '保存草稿', content: '检测到你有未完成的内容，是否保存为草稿？',
        confirmText: '保存', cancelText: '不保存',
        success: result => window.__overlayResults.push(result)
      });
    });
    await page.waitForSelector('.app-dialog');
    const size = await page.$eval('.app-dialog', el => {
      const rect = el.getBoundingClientRect();
      return { width: rect.width, left: rect.left, right: rect.right };
    });
    assert.ok(size.left >= 16 && size.right <= 374 && size.width > 250);
    await page.screenshot({ path: path.join(screenshots, 'dialog-light.png') });
    await page.click('.app-dialog-button:last-child');
    await page.waitForSelector('.app-dialog', { hidden: true });
    assert.equal(await page.evaluate(() => window.__overlayResults[0].confirm), true);

    await page.evaluate(() => uni.showActionSheet({
      itemList: ['编辑', '隐藏', '删除该动态'],
      success: result => window.__overlayResults.push(result)
    }));
    await page.waitForSelector('.app-sheet');
    assert.equal(await page.$$eval('.app-sheet-item', elements => elements.length), 3);
    await page.screenshot({ path: path.join(screenshots, 'sheet-light.png') });
    await page.click('.app-sheet-item:first-child');
    await page.waitForSelector('.app-sheet', { hidden: true });
    assert.equal(await page.evaluate(() => window.__overlayResults[1].tapIndex), 0);

    await page.evaluate(() => {
      uni.setStorageSync('poementerThemeMode', 'dark');
      uni.$emit('theme:changed', { mode: 'dark' });
      uni.showModal({ title: '确认删除', content: '删除后无法恢复，确定删除吗？', confirmText: '删除', success: result => window.__overlayResults.push(result) });
    });
    await page.waitForSelector('.app-dialog-mask.overlay-dark');
    await page.screenshot({ path: path.join(screenshots, 'dialog-dark.png') });
    await page.click('.app-dialog-button:first-child');
    await page.waitForSelector('.app-dialog', { hidden: true });
    assert.equal(await page.evaluate(() => window.__overlayResults[2].cancel), true);

    await page.evaluate(() => {
      uni.showModal({ title: '第一条', success: () => {} });
      uni.showModal({ title: '第二条', showCancel: false, success: () => {} });
    });
    await page.waitForFunction(() => document.querySelector('.app-dialog-title')?.textContent === '第一条');
    await page.click('.app-dialog-button:last-child');
    await page.waitForFunction(() => document.querySelector('.app-dialog-title')?.textContent === '第二条');
    assert.equal(await page.$$eval('.app-dialog-button', elements => elements.length), 1);
    await page.click('.app-dialog-button');
    await page.waitForSelector('.app-dialog', { hidden: true });

    await page.evaluate(() => uni.showModal({
      title: '即将离开页面',
      fail: result => window.__overlayResults.push(result)
    }));
    await page.waitForSelector('.app-dialog');
    await page.evaluate(() => new Promise((resolve, reject) => {
      uni.navigateTo({ url: '/pages/register/register', success: resolve, fail: reject });
    }));
    await page.waitForFunction(() => location.hash.includes('/pages/register/register'));
    await page.waitForFunction(() => getCurrentPages().at(-1)?.route === 'pages/register/register');
    await page.waitForSelector('.app-dialog', { hidden: true });
    assert.equal(await page.evaluate(() => window.__overlayResults.at(-1).errMsg), 'showModal:fail page closed');
    await page.evaluate(() => uni.showModal({ title: '新页面', success() {} }));
    await page.waitForFunction(() => document.querySelector('.app-dialog-title')?.textContent === '新页面');
    await page.click('.app-dialog-button:last-child');
    await page.waitForSelector('.app-dialog', { hidden: true });
    console.log('[test-app-overlays-h5] PASS: real page host, confirm/cancel, menus, dark mode and queue');
    console.log(`Screenshots: ${screenshots}`);
  } finally {
    await browser.close();
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
