import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import MarkdownIt from 'markdown-it';
import puppeteer from 'puppeteer-core';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');

const TITLE = '回车键Poementer软件-Vue3迁移改造计划';
const HEADER_TITLE = '回车键Poementer软件';
const sourcePath = path.join(repoRoot, 'docs', 'deliverables', `${TITLE}.md`);
const outputHtmlPath = path.join(repoRoot, 'docs', 'deliverables', `${TITLE}.html`);
const outputPdfPath = path.join(repoRoot, 'docs', 'deliverables', `${TITLE}.pdf`);

function normalizeLineEndings(value) {
  return String(value || '').replace(/\r\n/g, '\n');
}

async function readUtf8(filePath) {
  return fs.readFile(filePath, 'utf8');
}

async function ensureDirFor(filePath) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
}

async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function findChromeExecutable() {
  const envPath = process.env.PUPPETEER_EXECUTABLE_PATH;
  if (envPath && await fileExists(envPath)) {
    return envPath;
  }

  const candidates = [
    path.join(process.env.USERPROFILE || '', '.cache', 'puppeteer', 'chrome'),
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

  const puppeteerCacheDir = path.join(process.env.USERPROFILE || '', '.cache', 'puppeteer', 'chrome');
  if (await fileExists(puppeteerCacheDir)) {
    const versionDirs = await fs.readdir(puppeteerCacheDir, { withFileTypes: true });
    for (const dir of versionDirs) {
      if (!dir.isDirectory()) continue;
      const maybeChrome = path.join(puppeteerCacheDir, dir.name, 'chrome-win64', 'chrome.exe');
      if (await fileExists(maybeChrome)) {
        return maybeChrome;
      }
    }
  }

  throw new Error('未找到可用的 Chromium / Chrome / Edge 可执行文件，请先安装浏览器或设置 PUPPETEER_EXECUTABLE_PATH。');
}

function buildHtmlDocument(bodyHtml) {
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${TITLE}</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 18mm 14mm 18mm 14mm;
    }

    * {
      box-sizing: border-box;
    }

    html,
    body {
      margin: 0;
      padding: 0;
      background: #fff;
      color: #1b1f24;
      font-family: "SimSun", "Songti SC", "STSong", serif;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    body {
      font-size: 10.5pt;
      line-height: 1.65;
    }

    .document {
      width: 100%;
    }

    .cover-page {
      min-height: 236mm;
      display: flex;
      flex-direction: column;
      justify-content: center;
      padding: 10mm 8mm;
      background: linear-gradient(180deg, #f4f8fc 0%, #ffffff 48%, #f7fbff 100%);
      border: 0.35mm solid #cad8e6;
    }

    .cover-kicker {
      font-size: 13pt;
      letter-spacing: 0.2em;
      color: #31567c;
      margin-bottom: 12mm;
    }

    .cover-page h1 {
      margin: 0 0 8mm;
      font-size: 24pt;
      line-height: 1.3;
      color: #13283d;
    }

    .cover-subtitle {
      margin: 0 0 14mm;
      font-size: 11pt;
      color: #41556b;
    }

    .cover-meta {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 4mm 8mm;
      margin-bottom: 14mm;
    }

    .cover-meta div {
      padding: 3.2mm 4mm;
      border: 0.25mm solid #d1dde9;
      background: rgba(255, 255, 255, 0.88);
    }

    .cover-meta span {
      display: block;
      margin-bottom: 1mm;
      font-size: 8.8pt;
      color: #5d6b7a;
    }

    .cover-meta strong {
      font-size: 10.5pt;
      color: #1a2f47;
      font-weight: 700;
    }

    .cover-note {
      margin-top: auto;
      padding-top: 6mm;
      border-top: 0.3mm solid #d6e1eb;
      color: #435264;
    }

    .cover-note p {
      margin: 0 0 1.8mm;
      text-align: left;
    }

    .page-break {
      break-before: page;
      page-break-before: always;
      height: 0;
    }

    h2,
    h3,
    h4,
    p,
    ul,
    ol,
    table,
    blockquote,
    pre {
      margin-top: 0;
    }

    h2 {
      margin-bottom: 4mm;
      padding-bottom: 1.4mm;
      border-bottom: 0.45mm solid #324d75;
      color: #10233e;
      font-size: 15.5pt;
      line-height: 1.3;
    }

    h3 {
      margin-bottom: 2.2mm;
      color: #203d61;
      font-size: 11.8pt;
      line-height: 1.35;
    }

    h4 {
      margin-bottom: 1.4mm;
      color: #294b6b;
      font-size: 10.8pt;
      line-height: 1.4;
    }

    p {
      margin-bottom: 2.2mm;
      text-align: justify;
    }

    ul,
    ol {
      margin-bottom: 2.4mm;
      padding-left: 5.8mm;
    }

    li {
      margin-bottom: 1mm;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 3mm;
      table-layout: fixed;
    }

    th,
    td {
      border: 0.25mm solid #8395aa;
      padding: 1.7mm 2mm;
      vertical-align: top;
      word-break: break-word;
      font-size: 10pt;
      line-height: 1.5;
    }

    th {
      background: #eaf0f7;
      text-align: left;
      font-weight: 700;
    }

    blockquote {
      margin-bottom: 3mm;
      padding: 2mm 2.8mm;
      border-left: 1mm solid #a5b7ca;
      background: #f6f8fb;
      color: #3a4a5a;
    }

    code {
      padding: 0 0.8mm;
      background: #f1f4f8;
      font-family: "Consolas", "Courier New", monospace;
      font-size: 9.2pt;
    }

    pre {
      overflow: auto;
      margin-bottom: 3mm;
      padding: 2.4mm 2.8mm;
      border: 0.25mm solid #d0dbe6;
      background: #f8fbfd;
    }

    pre code {
      padding: 0;
      background: transparent;
      display: block;
      white-space: pre-wrap;
      word-break: break-word;
      line-height: 1.45;
    }

    a {
      color: #1f4f88;
      text-decoration: none;
    }

    hr {
      border: none;
      border-top: 0.25mm solid #d5dee8;
      margin: 4mm 0;
    }

    tr,
    img,
    pre,
    blockquote {
      break-inside: avoid;
      page-break-inside: avoid;
    }
  </style>
</head>
<body>
  <article class="document">
${bodyHtml}
  </article>
</body>
</html>`;
}

async function main() {
  await ensureDirFor(outputHtmlPath);
  await ensureDirFor(outputPdfPath);

  const markdownRaw = normalizeLineEndings(await readUtf8(sourcePath));
  const preparedMarkdown = markdownRaw.replace(/\n<!--PAGE_BREAK-->\n/g, '\n<div class="page-break"></div>\n');

  const md = new MarkdownIt({
    html: true,
    linkify: true,
    typographer: false,
    breaks: false
  });

  const bodyHtml = md.render(preparedMarkdown);
  const html = buildHtmlDocument(bodyHtml);
  await fs.writeFile(outputHtmlPath, html, 'utf8');

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
    await page.goto(pathToFileURL(outputHtmlPath).href, { waitUntil: 'networkidle0' });
    await page.pdf({
      path: outputPdfPath,
      format: 'A4',
      printBackground: true,
      preferCSSPageSize: true,
      displayHeaderFooter: true,
      margin: {
        top: '14mm',
        bottom: '14mm',
        left: '10mm',
        right: '10mm'
      },
      headerTemplate: `
        <div style="width:100%;font-size:9px;color:#1f2d3d;text-align:center;padding-top:4px;font-family:SimSun, Songti SC, STSong, serif;">
          ${HEADER_TITLE}
        </div>
      `,
      footerTemplate: `
        <div style="width:100%;font-size:8px;color:#5b6670;text-align:center;padding-bottom:4px;font-family:SimSun, Songti SC, STSong, serif;">
          第 <span class="pageNumber"></span> 页 / 共 <span class="totalPages"></span> 页
        </div>
      `
    });
  } finally {
    await browser.close();
  }

  console.log(`[export-vue3-migration-pdf] HTML generated: ${outputHtmlPath}`);
  console.log(`[export-vue3-migration-pdf] PDF generated: ${outputPdfPath}`);
  console.log(`[export-vue3-migration-pdf] Browser used: ${executablePath}`);
}

main().catch((error) => {
  console.error('[export-vue3-migration-pdf] Failed:', error);
  process.exitCode = 1;
});
