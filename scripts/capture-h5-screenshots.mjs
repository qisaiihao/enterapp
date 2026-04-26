import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');
const outputDir = path.join(repoRoot, 'docs', 'deliverables', 'assets', 'h5-screenshots');
const baseUrl = process.env.H5_URL || 'http://127.0.0.1:8081/';
const loginUser = process.env.H5_LOGIN_USER || '';
const loginPassword = process.env.H5_LOGIN_PASSWORD || '';

const publicPages = [
  ['splash', '#/pages/splash/splash', 4500],
  ['login', '#/pages/login/login', 2500],
  ['register', '#/pages/register/register', 2500]
];

const appPages = [
  ['main', '#/pages/poem-square/poem-square', 6500],
  ['profile', '#/pages/profile/profile', 4500],
  ['search', '#/pages-tools/search/search', 3500]
];
const publishSampleText = '\u8f6f\u8457\u6587\u6863\u622a\u56fe\u793a\u4f8b\n\u767b\u5f55\u540e\u53d1\u5e03\u9875\u53ef\u8f93\u5165\u4f5c\u54c1\u5185\u5bb9';

async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch (_) {
    return false;
  }
}

async function findChromeExecutable() {
  const envPath = process.env.PUPPETEER_EXECUTABLE_PATH;
  if (envPath && await fileExists(envPath)) {
    return envPath;
  }

  const candidates = [
    path.join(process.env.LOCALAPPDATA || '', 'Google', 'Chrome', 'Application', 'chrome.exe'),
    path.join(process.env.PROGRAMFILES || '', 'Google', 'Chrome', 'Application', 'chrome.exe'),
    path.join(process.env['PROGRAMFILES(X86)'] || '', 'Google', 'Chrome', 'Application', 'chrome.exe'),
    path.join(process.env.PROGRAMFILES || '', 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
    path.join(process.env['PROGRAMFILES(X86)'] || '', 'Microsoft', 'Edge', 'Application', 'msedge.exe')
  ].filter(Boolean);

  for (const candidate of candidates) {
    if (await fileExists(candidate)) {
      const stats = await fs.stat(candidate);
      if (stats.isFile()) {
        return candidate;
      }
    }
  }

  throw new Error('未找到可用的 Chrome/Chromium 浏览器，请设置 PUPPETEER_EXECUTABLE_PATH。');
}

async function dismissBootMask(page) {
  await page.evaluate(() => {
    try {
      window.localStorage.setItem('lastSplashVisitTime', '0');
      if (typeof window.__ENTERAPP_HIDE_BOOT_MASK__ === 'function') {
        window.__ENTERAPP_HIDE_BOOT_MASK__();
      }
      const mask = document.getElementById('app-loading-mask');
      if (mask && mask.parentNode) {
        mask.parentNode.removeChild(mask);
      }
    } catch (_) {
      // no-op
    }
  });
}

async function login(page) {
  if (!loginUser || !loginPassword) {
    return false;
  }

  await page.goto(`${baseUrl}#/pages/login/login`, { waitUntil: 'domcontentloaded' });
  await page.waitForNetworkIdle({ idleTime: 700, timeout: 12000 }).catch(() => {});
  await new Promise((resolve) => setTimeout(resolve, 1600));
  await dismissBootMask(page);
  await page.waitForSelector('input', { timeout: 20000 });
  const inputs = await page.$$('input');
  if (inputs.length < 2) {
    throw new Error(`登录输入框数量异常: ${inputs.length}`);
  }
  await inputs[0].click({ clickCount: 3 });
  await inputs[0].type(loginUser, { delay: 20 });
  await inputs[1].click({ clickCount: 3 });
  await inputs[1].type(loginPassword, { delay: 20 });
  const clicked = await page.evaluate(() => {
    const btn = document.querySelector('.enter-key-btn');
    if (!btn) return false;
    btn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
    return true;
  });
  if (!clicked) {
    await page.touchscreen.tap(340, 760);
  }
  await page.waitForNetworkIdle({ idleTime: 800, timeout: 30000 }).catch(() => {});
  await new Promise((resolve) => setTimeout(resolve, 5000));
  await dismissBootMask(page);
  console.log('[capture-h5] 已完成登录态准备');
  return true;
}

async function capture() {
  await fs.mkdir(outputDir, { recursive: true });
  const executablePath = await findChromeExecutable();
  const browser = await puppeteer.launch({
    executablePath,
    headless: true,
    args: [
      '--disable-gpu',
      '--allow-file-access-from-files',
      '--font-render-hinting=medium'
    ]
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({
      width: 390,
      height: 844,
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true
    });
    page.setDefaultNavigationTimeout(45000);

    await page.evaluateOnNewDocument(() => {
      try {
        window.localStorage.setItem('lastSplashVisitTime', '0');
      } catch (_) {
        // no-op
      }
    });

    for (const [name, hash, waitMs] of publicPages) {
      const url = `${baseUrl}${hash}`;
      const outputPath = path.join(outputDir, `${name}.png`);
      await page.goto(url, { waitUntil: 'domcontentloaded' });
      await page.waitForNetworkIdle({ idleTime: 700, timeout: 12000 }).catch(() => {});
      await new Promise((resolve) => setTimeout(resolve, waitMs));
      await dismissBootMask(page);
      await page.screenshot({ path: outputPath, fullPage: false });
      console.log(`[capture-h5] ${name}: ${outputPath}`);
    }

    await login(page);

    for (const [name, hash, waitMs] of appPages) {
      const url = `${baseUrl}${hash}`;
      const outputPath = path.join(outputDir, `${name}.png`);
      await page.goto(url, { waitUntil: 'domcontentloaded' });
      await page.waitForNetworkIdle({ idleTime: 700, timeout: 12000 }).catch(() => {});
      await new Promise((resolve) => setTimeout(resolve, waitMs));
      await dismissBootMask(page);
      await page.screenshot({ path: outputPath, fullPage: false });
      console.log(`[capture-h5] ${name}: ${outputPath}`);
    }

    await page.goto(`${baseUrl}#/pages-publish/add/add`, { waitUntil: 'domcontentloaded' });
    await page.waitForNetworkIdle({ idleTime: 700, timeout: 12000 }).catch(() => {});
    await new Promise((resolve) => setTimeout(resolve, 3500));
    await dismissBootMask(page);
    await page.evaluate((value) => {
      const textarea = document.querySelector('textarea');
      if (!textarea) return;
      textarea.value = value;
      textarea.dispatchEvent(new InputEvent('input', {
        bubbles: true,
        inputType: 'insertText',
        data: value
      }));
    }, publishSampleText);
    await new Promise((resolve) => setTimeout(resolve, 1000));
    const publishPath = path.join(outputDir, 'publish.png');
    await page.screenshot({ path: publishPath, fullPage: false });
    console.log(`[capture-h5] publish: ${publishPath}`);

    await page.evaluate(() => {
      const btn = document.querySelector('.floating-action-btn');
      if (btn) {
        btn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
      }
    });
    await page.waitForNetworkIdle({ idleTime: 700, timeout: 12000 }).catch(() => {});
    await new Promise((resolve) => setTimeout(resolve, 3500));
    const previewPath = path.join(outputDir, 'preview.png');
    await page.screenshot({ path: previewPath, fullPage: false });
    console.log(`[capture-h5] preview: ${previewPath}`);

    await page.goto(`${baseUrl}#/pages/poem-square/poem-square`, { waitUntil: 'domcontentloaded' });
    await page.waitForNetworkIdle({ idleTime: 700, timeout: 12000 }).catch(() => {});
    await new Promise((resolve) => setTimeout(resolve, 5000));
    await dismissBootMask(page);
    await page.touchscreen.tap(195, 188);
    await new Promise((resolve) => setTimeout(resolve, 1200));
    await page.touchscreen.tap(288, 637);
    await page.waitForFunction(() => location.href.includes('post-detail'), { timeout: 10000 }).catch(() => {});
    await page.waitForNetworkIdle({ idleTime: 700, timeout: 12000 }).catch(() => {});
    await new Promise((resolve) => setTimeout(resolve, 4500));
    const detailPath = path.join(outputDir, 'detail.png');
    await page.screenshot({ path: detailPath, fullPage: false });
    console.log(`[capture-h5] detail: ${detailPath}`);

    console.log(`[capture-h5] 使用浏览器: ${executablePath}`);
  } finally {
    await browser.close();
  }
}

capture().catch((error) => {
  console.error('[capture-h5] 失败:', error);
  process.exitCode = 1;
});
