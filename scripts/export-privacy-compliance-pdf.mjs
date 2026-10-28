import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import MarkdownIt from 'markdown-it';
import puppeteer from 'puppeteer-core';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');

const sourcePath = path.join(repoRoot, 'docs', 'compliance', 'poementer-privacy-compliance-report.md');
const outputHtmlPath = path.join(repoRoot, 'docs', 'compliance', '回车键Poementer隐私合规检测报告.html');
const outputPdfPath = path.join(repoRoot, 'docs', 'compliance', '回车键Poementer隐私合规检测报告.pdf');

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
  if (envPath && await fileExists(envPath)) return envPath;

  const candidates = [
    path.join(process.env.LOCALAPPDATA || '', 'Google', 'Chrome', 'Application', 'chrome.exe'),
    path.join(process.env.PROGRAMFILES || '', 'Google', 'Chrome', 'Application', 'chrome.exe'),
    path.join(process.env['PROGRAMFILES(X86)'] || '', 'Google', 'Chrome', 'Application', 'chrome.exe'),
    path.join(process.env.PROGRAMFILES || '', 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
    path.join(process.env['PROGRAMFILES(X86)'] || '', 'Microsoft', 'Edge', 'Application', 'msedge.exe')
  ].filter(Boolean);

  for (const candidate of candidates) {
    if (await fileExists(candidate)) return candidate;
  }

  const puppeteerCacheDir = path.join(process.env.USERPROFILE || '', '.cache', 'puppeteer', 'chrome');
  if (await fileExists(puppeteerCacheDir)) {
    const versionDirs = await fs.readdir(puppeteerCacheDir, { withFileTypes: true });
    for (const dir of versionDirs) {
      if (!dir.isDirectory()) continue;
      const maybeChrome = path.join(puppeteerCacheDir, dir.name, 'chrome-win64', 'chrome.exe');
      if (await fileExists(maybeChrome)) return maybeChrome;
    }
  }

  throw new Error('未找到可用的 Chromium/Chrome/Edge 可执行文件，请设置 PUPPETEER_EXECUTABLE_PATH。');
}

function buildHtmlDocument(bodyHtml) {
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <title>回车键Poementer移动互联网应用程序隐私合规检测报告</title>
  <style>
    @page { size: A4 portrait; margin: 0; }
    * { box-sizing: border-box; }
    html, body {
      margin: 0; padding: 0; background: #fff; color: #1b1f24;
      font-family: "SimSun", "Songti SC", "STSong", serif;
      -webkit-print-color-adjust: exact; print-color-adjust: exact;
    }
    body { font-size: 10.5pt; line-height: 1.55; }
    main { padding: 16mm 16mm 14mm; }
    h1 { font-size: 19pt; text-align: center; margin: 0 0 4mm; color: #10233e; letter-spacing: 0.02em; line-height: 1.3; }
    h2 {
      font-size: 14pt; margin: 6mm 0 3mm; padding-bottom: 1.4mm;
      border-bottom: 0.4mm solid #324d75; color: #10233e;
    }
    h3 { font-size: 11.8pt; margin: 4mm 0 2mm; color: #203d61; }
    h4 { font-size: 10.8pt; margin: 3mm 0 1.5mm; color: #26435f; }
    p, li, td, th, blockquote { font-size: 10.5pt; line-height: 1.55; }
    p { margin: 0 0 2mm; text-align: justify; }
    ul, ol { padding-left: 6mm; margin: 0 0 2.4mm; }
    li { margin-bottom: 1mm; }
    table { width: 100%; border-collapse: collapse; margin: 0 0 3mm; table-layout: fixed; }
    th, td { border: 0.25mm solid #8395aa; padding: 1.6mm 2mm; vertical-align: top; word-break: break-word; }
    th { background: #eaf0f7; font-weight: 700; text-align: left; }
    blockquote {
      border-left: 1mm solid #a5b7ca; padding: 1.6mm 3mm; margin: 0 0 3mm;
      color: #3a4a5a; background: #f6f8fb;
    }
    code { font-family: Consolas, "Courier New", monospace; font-size: 9.5pt; padding: 0 0.8mm; background: #f1f4f8; }
    hr { border: none; border-top: 0.25mm solid #c8d3df; margin: 5mm 0; }
    h2, h3, table, blockquote, li, p { break-inside: avoid-page; }
    table { break-inside: auto; }
    tr { break-inside: avoid-page; }
  </style>
</head>
<body>
<main>
${bodyHtml}
</main>
</body>
</html>`;
}

async function main() {
  await fs.mkdir(path.dirname(outputPdfPath), { recursive: true });

  const markdownRaw = (await fs.readFile(sourcePath, 'utf8')).replace(/\r\n/g, '\n');
  const md = new MarkdownIt({ html: true, linkify: false, typographer: false, breaks: false });
  const bodyHtml = md.render(markdownRaw);
  const html = buildHtmlDocument(bodyHtml);
  await fs.writeFile(outputHtmlPath, html, 'utf8');

  const executablePath = await findChromeExecutable();
  const browser = await puppeteer.launch({
    executablePath,
    headless: true,
    args: ['--disable-gpu', '--allow-file-access-from-files', '--font-render-hinting=medium']
  });

  try {
    const page = await browser.newPage();
    await page.goto(pathToFileURL(outputHtmlPath).href, { waitUntil: 'networkidle0' });
    await page.pdf({
      path: outputPdfPath,
      format: 'A4',
      printBackground: true,
      preferCSSPageSize: true,
      displayHeaderFooter: true,
      margin: { top: '12mm', bottom: '12mm', left: '16mm', right: '16mm' },
      headerTemplate: `<div style="width:100%;font-size:9px;color:#1f2d3d;text-align:center;padding-top:4px;font-family:SimSun, STSong, serif;">回车键（Poementer）移动互联网应用程序隐私合规检测报告</div>`,
      footerTemplate: `<div style="width:100%;font-size:8px;color:#5b6670;text-align:center;padding-bottom:4px;font-family:SimSun, STSong, serif;">第 <span class="pageNumber"></span> 页 / 共 <span class="totalPages"></span> 页</div>`
    });
  } finally {
    await browser.close();
  }

  console.log(`[export-privacy-compliance-pdf] HTML 已生成: ${outputHtmlPath}`);
  console.log(`[export-privacy-compliance-pdf] PDF 已生成: ${outputPdfPath}`);
  console.log(`[export-privacy-compliance-pdf] 采用浏览器: ${executablePath}`);
}

main().catch((error) => {
  console.error('[export-privacy-compliance-pdf] 失败:', error);
  process.exitCode = 1;
});
