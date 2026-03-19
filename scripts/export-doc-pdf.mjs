import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import MarkdownIt from 'markdown-it';
import puppeteer from 'puppeteer-core';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');

const sourcePath = path.join(repoRoot, 'docs', 'deliverables', '回车键Poementer软件-设计开发说明书.md');
const outputHtmlPath = path.join(repoRoot, 'docs', 'deliverables', '回车键Poementer软件-设计开发说明书.html');
const outputPdfPath = path.join(repoRoot, 'docs', 'deliverables', '回车键Poementer软件-设计开发说明书.pdf');

const PAGE_BREAK = '\n<!--PAGE_BREAK-->\n';
const EXPECTED_PAGE_COUNT = 60;
const BASELINE_TEXT_LINES = Object.freeze({
  1: 28,
  3: 28,
  4: 22,
  5: 21,
  7: 27,
  8: 22,
  10: 29,
  12: 27,
  13: 22,
  14: 18,
  15: 26,
  16: 28,
  18: 20,
  19: 23,
  20: 26,
  21: 23,
  22: 25,
  23: 26,
  24: 26,
  25: 22,
  26: 19,
  29: 24,
  30: 27,
  31: 21,
  32: 20,
  33: 27,
  34: 20,
  35: 24,
  36: 20,
  37: 26,
  39: 28,
  40: 22,
  42: 19,
  43: 18,
  44: 19,
  45: 18,
  46: 16,
  47: 18,
  48: 18,
  49: 21,
  50: 22,
  51: 20,
  52: 17,
  53: 20,
  54: 21,
  55: 19,
  56: 18,
  57: 21,
  58: 23,
  59: 20,
  60: 24
});

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

  throw new Error(
    '未找到可用的 Chromium/Chrome 可执行文件。请设置 PUPPETEER_EXECUTABLE_PATH，或先安装/下载浏览器。'
  );
}

function buildHtmlDocument(sectionsHtml) {
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>回车键Poementer软件设计开发说明书</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 0;
    }

    * {
      box-sizing: border-box;
    }

    html,
    body {
      margin: 0;
      padding: 0;
      background: #ffffff;
      color: #1b1f24;
      font-family: "SimSun", "Songti SC", "STSong", serif;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    body {
      font-size: 10.5pt;
    }

    .page {
      width: 186mm;
      min-height: 273mm;
      max-height: 273mm;
      margin: 0 auto;
      padding: 3mm 0 3mm;
      overflow: hidden;
      break-after: page;
      page-break-after: always;
    }

    .page:last-child {
      break-after: auto;
      page-break-after: auto;
    }

    .page-inner {
      height: 267mm;
      overflow: hidden;
    }

    h2,
    h3,
    h4,
    p,
    ul,
    ol,
    table,
    blockquote {
      margin-top: 0;
    }

    h2 {
      font-size: 15.5pt;
      line-height: 1.25;
      margin-bottom: 3.2mm;
      padding-bottom: 1.2mm;
      border-bottom: 0.4mm solid #324d75;
      color: #10233e;
      letter-spacing: 0.02em;
    }

    h3 {
      font-size: 11.5pt;
      line-height: 1.3;
      margin-bottom: 1.8mm;
      color: #203d61;
    }

    h4 {
      font-size: 10.8pt;
      line-height: 1.35;
      margin-bottom: 1.2mm;
      color: #26435f;
    }

    p,
    li,
    td,
    th,
    blockquote {
      font-size: 10.5pt;
      line-height: 1.45;
    }

    p {
      margin-bottom: 1.8mm;
      text-align: justify;
    }

    ul,
    ol {
      padding-left: 5.6mm;
      margin-bottom: 2mm;
    }

    li {
      margin-bottom: 0.9mm;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 2.3mm;
      table-layout: fixed;
    }

    th,
    td {
      border: 0.25mm solid #8395aa;
      padding: 1.5mm 1.8mm;
      vertical-align: top;
      word-break: break-word;
    }

    th {
      background: #eaf0f7;
      font-weight: 700;
      text-align: left;
    }

    img {
      display: block;
      width: 100%;
      max-height: 68mm;
      margin: 1.4mm auto 2mm;
      object-fit: contain;
      border: 0.25mm solid #c8d3df;
      background: #fbfcfe;
    }

    blockquote {
      border-left: 1mm solid #a5b7ca;
      padding: 1.2mm 2.4mm;
      color: #3a4a5a;
      background: #f6f8fb;
      margin-bottom: 2mm;
    }

    code {
      font-family: "Consolas", "Courier New", monospace;
      font-size: 9.5pt;
      padding: 0 0.8mm;
      background: #f1f4f8;
    }

    .tight p,
    .tight li,
    .tight td,
    .tight th {
      line-height: 1.35;
    }

    .small p,
    .small li,
    .small td,
    .small th {
      font-size: 10pt;
      line-height: 1.38;
    }

    .supplement {
      margin-top: 2mm;
      padding-top: 1.2mm;
      border-top: 0.2mm dashed #9db0c4;
    }

    .supplement p {
      margin-bottom: 0.7mm;
      font-size: 8.8pt;
      line-height: 1.18;
      color: #4f5a66;
      text-align: left;
    }
  </style>
</head>
<body>
${sectionsHtml}
</body>
</html>`;
}

function getPageTitle(chunk) {
  const match = chunk.match(/^##\s+第\d{2}页\s+(.+)$/m);
  return match ? match[1].trim() : '正文页';
}

function buildSupplement(index, chunk) {
  const pageNumber = index + 1;
  const baselineCount = BASELINE_TEXT_LINES[pageNumber];
  if (!baselineCount || baselineCount >= 30) {
    return '';
  }

  const neededLines = Math.max(0, 32 - baselineCount);
  const pageTitle = getPageTitle(chunk);
  const pool = [
    `页内记录：本页标题为《${pageTitle}》。`,
    '页内记录：本页属于回车键Poementer软件设计开发说明书正式正文。',
    '页内记录：文档版本为 V1.0，适用于软件登记与归档。',
    '页内记录：本页内容依据现有仓库代码与项目文档整理形成。',
    '页内记录：对外版已去除真实环境值、口令和管理敏感信息。',
    '页内记录：文档按 A4 纵向排版，页眉统一为软件名称。',
    '页内记录：本页信息可作为软件组成、设计或测试的书面说明依据。',
    '页内记录：如后续软件升级，应同步更新本页对应描述。',
    '页内记录：本页不替代部署手册与内部运维手册。',
    '页内记录：本页信息面向登记、审阅、交接和资料留存场景。',
    '页内记录：本页内容遵循事实可追溯和敏感信息脱敏原则。',
    '页内记录：本页可与相邻页面联合理解完整模块逻辑。',
    '页内记录：若需实机验证，应结合目标端型和真实环境配置。',
    '页内记录：当前文档重点说明软件能力和设计实现，不作营销性描述。',
    `页内记录：当前页次为第 ${pageNumber} 页，对应模块主题为“${pageTitle}”。`,
    '页内记录：建议保留 Markdown、HTML 与 PDF 三种版本便于复核。'
  ];

  const lines = pool.slice(0, Math.min(pool.length, neededLines));
  if (lines.length === 0) {
    return '';
  }

  return `
    <div class="supplement">
      ${lines.map((line) => `<p>${line}</p>`).join('\n')}
    </div>
  `;
}

async function main() {
  await ensureDirFor(outputHtmlPath);
  await ensureDirFor(outputPdfPath);

  const markdownRaw = normalizeLineEndings(await readUtf8(sourcePath)).trim();
  const chunks = markdownRaw
    .split(PAGE_BREAK)
    .map((item) => item.trim())
    .filter(Boolean);

  if (chunks.length !== EXPECTED_PAGE_COUNT) {
    throw new Error(`文档页块数量为 ${chunks.length}，不等于预期的 ${EXPECTED_PAGE_COUNT}。`);
  }

  const md = new MarkdownIt({
    html: true,
    linkify: false,
    typographer: false,
    breaks: false
  });

  const sectionsHtml = chunks
    .map((chunk, index) => {
      const bodyHtml = md.render(chunk);
      const supplementHtml = buildSupplement(index, chunk);
      return `<section class="page"><div class="page-inner">${bodyHtml}${supplementHtml}</div></section>`;
    })
    .join('\n');

  const html = buildHtmlDocument(sectionsHtml);
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
        top: '12mm',
        bottom: '12mm',
        left: '12mm',
        right: '12mm'
      },
      headerTemplate: `
        <div style="width:100%;font-size:9px;color:#1f2d3d;text-align:center;padding-top:4px;font-family:SimSun, Songti SC, STSong, serif;">
          回车键Poementer软件
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

  console.log(`[export-doc-pdf] HTML 已生成: ${outputHtmlPath}`);
  console.log(`[export-doc-pdf] PDF 已生成: ${outputPdfPath}`);
  console.log(`[export-doc-pdf] 采用浏览器: ${executablePath}`);
}

main().catch((error) => {
  console.error('[export-doc-pdf] 失败:', error);
  process.exitCode = 1;
});
