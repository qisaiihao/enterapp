import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import puppeteer from 'puppeteer-core';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');

const manifestPath = path.join(repoRoot, 'docs', 'deliverables', '回车键Poementer软件-源程序选编清单.json');
const outputHtmlPath = path.join(repoRoot, 'docs', 'deliverables', '回车键Poementer软件-源程序登记提交版.html');
const outputPdfPath = path.join(repoRoot, 'docs', 'deliverables', '回车键Poementer软件-源程序登记提交版.pdf');
const outputIndexPath = path.join(repoRoot, 'docs', 'deliverables', '回车键Poementer软件-源程序页码清单.md');

const ROWS_PER_PAGE = 50;
const MAX_CODE_COLUMNS = 96;
const TAB_SIZE = 2;
const EDGE_PAGE_COUNT = 30;

function normalizeLineEndings(value) {
  return String(value || '').replace(/\r\n/g, '\n').replace(/\uFEFF/g, '');
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
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

async function readUtf8(filePath) {
  return fs.readFile(filePath, 'utf8');
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
      const candidate = path.join(puppeteerCacheDir, dir.name, 'chrome-win64', 'chrome.exe');
      if (await fileExists(candidate)) {
        return candidate;
      }
    }
  }

  throw new Error('未找到可用的 Chrome/Chromium 浏览器，请设置 PUPPETEER_EXECUTABLE_PATH。');
}

function expandTabs(line, size = TAB_SIZE) {
  let result = '';
  let column = 0;

  for (const ch of line) {
    if (ch === '\t') {
      const spaces = size - (column % size || 0);
      result += ' '.repeat(spaces || size);
      column += spaces || size;
      continue;
    }

    result += ch;
    column += getDisplayWidth(ch);
  }

  return result;
}

function getDisplayWidth(ch) {
  const code = ch.codePointAt(0);
  if (!code) return 1;

  if (
    code >= 0x1100 && (
      code <= 0x115f ||
      code === 0x2329 ||
      code === 0x232a ||
      (code >= 0x2e80 && code <= 0xa4cf && code !== 0x303f) ||
      (code >= 0xac00 && code <= 0xd7a3) ||
      (code >= 0xf900 && code <= 0xfaff) ||
      (code >= 0xfe10 && code <= 0xfe19) ||
      (code >= 0xfe30 && code <= 0xfe6f) ||
      (code >= 0xff00 && code <= 0xff60) ||
      (code >= 0xffe0 && code <= 0xffe6) ||
      (code >= 0x1f300 && code <= 0x1faf6)
    )
  ) {
    return 2;
  }

  return 1;
}

function wrapByDisplayWidth(line, maxColumns) {
  if (!line) return [''];

  const segments = [];
  let current = '';
  let width = 0;

  for (const ch of Array.from(line)) {
    const charWidth = getDisplayWidth(ch);

    if (width > 0 && width + charWidth > maxColumns) {
      segments.push(current);
      current = ch;
      width = charWidth;
      continue;
    }

    current += ch;
    width += charWidth;
  }

  if (current || segments.length === 0) {
    segments.push(current);
  }

  return segments;
}

function createDividerRow(item) {
  return {
    type: 'divider',
    filePath: item.path,
    label: item.label,
    originalLineNumber: null,
    continuation: false,
    codeText: `FILE ${item.order.toString().padStart(2, '0')} | ${item.path} | ${item.label}`
  };
}

function createCodeRows(item, originalLineNumber, line) {
  const expanded = expandTabs(line, TAB_SIZE);
  const segments = wrapByDisplayWidth(expanded, MAX_CODE_COLUMNS);

  return segments.map((segment, index) => ({
    type: 'code',
    filePath: item.path,
    label: item.label,
    originalLineNumber,
    continuation: index > 0,
    codeText: segment
  }));
}

function createFillerRow() {
  return {
    type: 'filler',
    filePath: '',
    label: '',
    originalLineNumber: null,
    continuation: false,
    codeText: ''
  };
}

async function loadManifestItems() {
  const raw = normalizeLineEndings(await readUtf8(manifestPath));
  const items = JSON.parse(raw)
    .slice()
    .sort((a, b) => Number(a.order) - Number(b.order));

  const seenOrders = new Set();
  const seenPaths = new Set();
  const loaded = [];

  for (const item of items) {
    if (!item || typeof item.path !== 'string' || typeof item.label !== 'string') {
      throw new Error('选编清单存在无效项，必须包含 order/path/label。');
    }

    if (seenOrders.has(item.order)) {
      throw new Error(`选编清单存在重复 order: ${item.order}`);
    }
    if (seenPaths.has(item.path)) {
      throw new Error(`选编清单存在重复 path: ${item.path}`);
    }

    seenOrders.add(item.order);
    seenPaths.add(item.path);

    const absolutePath = path.join(repoRoot, item.path);
    if (!await fileExists(absolutePath)) {
      throw new Error(`选编源码不存在: ${item.path}`);
    }

    const rawSource = normalizeLineEndings(await readUtf8(absolutePath));
    const lines = rawSource.endsWith('\n')
      ? rawSource.slice(0, -1).split('\n')
      : rawSource.split('\n');

    loaded.push({
      order: Number(item.order),
      path: item.path,
      label: item.label,
      absolutePath,
      rawLineCount: lines.length || 1,
      sourceLines: lines.length ? lines : ['']
    });
  }

  return loaded;
}

function buildSequence(items) {
  const rows = [];

  for (const item of items) {
    const startVisualRow = rows.length + 1;
    rows.push(createDividerRow(item));

    for (let index = 0; index < item.sourceLines.length; index += 1) {
      const lineNumber = index + 1;
      const line = item.sourceLines[index];
      rows.push(...createCodeRows(item, lineNumber, line));
    }

    const endVisualRow = rows.length;
    item.visualRowCount = endVisualRow - startVisualRow + 1;
    item.visualRowStart = startVisualRow;
    item.visualRowEnd = endVisualRow;
  }

  return rows;
}

function paginateRows(rows) {
  const pages = [];

  for (let cursor = 0; cursor < rows.length; cursor += ROWS_PER_PAGE) {
    const chunk = rows.slice(cursor, cursor + ROWS_PER_PAGE);
    while (chunk.length < ROWS_PER_PAGE) {
      chunk.push(createFillerRow());
    }
    pages.push({
      fullPageNumber: pages.length + 1,
      rows: chunk
    });
  }

  return pages;
}

function uniqueInOrder(values) {
  const seen = new Set();
  const result = [];

  for (const value of values) {
    if (!value || seen.has(value)) continue;
    seen.add(value);
    result.push(value);
  }

  return result;
}

function getMeaningfulRows(page) {
  return page.rows.filter((row) => row.type !== 'filler');
}

function getCodeRows(page) {
  return page.rows.filter((row) => row.type === 'code');
}

function summarizePage(page, totalFullPages, submissionTotalPages) {
  const meaningfulRows = getMeaningfulRows(page);
  const codeRows = getCodeRows(page);
  const firstCodeRow = codeRows[0] || meaningfulRows[0] || createFillerRow();
  const lastCodeRow = codeRows[codeRows.length - 1] || meaningfulRows[meaningfulRows.length - 1] || createFillerRow();
  const files = uniqueInOrder(meaningfulRows.map((row) => row.filePath));
  const fileDisplay = files.length === 0
    ? '无'
    : files.length === 1
      ? files[0]
      : `${files[0]} -> ${files[files.length - 1]}（共 ${files.length} 个文件）`;

  const firstLabel = firstCodeRow.originalLineNumber
    ? `${firstCodeRow.filePath}:${firstCodeRow.originalLineNumber}${firstCodeRow.continuation ? '↳' : ''}`
    : firstCodeRow.filePath;
  const lastLabel = lastCodeRow.originalLineNumber
    ? `${lastCodeRow.filePath}:${lastCodeRow.originalLineNumber}${lastCodeRow.continuation ? '↳' : ''}`
    : lastCodeRow.filePath;

  return {
    fullPageNumber: page.fullPageNumber,
    submissionPageNumber: page.submissionPageNumber,
    totalFullPages,
    submissionTotalPages,
    fileDisplay,
    rangeDisplay: `${firstLabel} -> ${lastLabel}`
  };
}

function assignFilePageRanges(items, fullPages, totalFullPages) {
  const frontPages = totalFullPages > EDGE_PAGE_COUNT * 2
    ? new Set(Array.from({ length: EDGE_PAGE_COUNT }, (_, index) => index + 1))
    : new Set(Array.from({ length: totalFullPages }, (_, index) => index + 1));
  const backPages = totalFullPages > EDGE_PAGE_COUNT * 2
    ? new Set(Array.from({ length: EDGE_PAGE_COUNT }, (_, index) => totalFullPages - EDGE_PAGE_COUNT + 1 + index))
    : new Set(Array.from({ length: totalFullPages }, (_, index) => index + 1));

  for (const item of items) {
    const pages = [];
    for (const page of fullPages) {
      if (page.rows.some((row) => row.filePath === item.path)) {
        pages.push(page.fullPageNumber);
      }
    }

    item.pageStart = pages[0] || 0;
    item.pageEnd = pages[pages.length - 1] || 0;
    item.fullPageCount = pages.length;

    const flags = [];
    if (pages.some((pageNo) => frontPages.has(pageNo))) {
      flags.push('前30页');
    }
    if (pages.some((pageNo) => backPages.has(pageNo))) {
      flags.push('后30页');
    }
    item.selectedSegment = flags.length ? flags.join(' + ') : '未入选';
  }
}

function selectPages(fullPages) {
  if (fullPages.length <= EDGE_PAGE_COUNT * 2) {
    return fullPages.slice();
  }

  return [
    ...fullPages.slice(0, EDGE_PAGE_COUNT),
    ...fullPages.slice(fullPages.length - EDGE_PAGE_COUNT)
  ];
}

function renderCodeCell(text) {
  return text ? escapeHtml(text) : '&nbsp;';
}

function renderRow(row, slot) {
  const slotText = String(slot).padStart(2, '0');

  if (row.type === 'divider') {
    return `
      <tr class="divider-row">
        <td class="slot-cell">${slotText}</td>
        <td class="line-cell">FILE</td>
        <td class="code-cell">${renderCodeCell(row.codeText)}</td>
      </tr>
    `;
  }

  if (row.type === 'filler') {
    return `
      <tr class="filler-row">
        <td class="slot-cell">${slotText}</td>
        <td class="line-cell">&nbsp;</td>
        <td class="code-cell">&nbsp;</td>
      </tr>
    `;
  }

  const lineLabel = row.continuation ? '↳' : String(row.originalLineNumber);
  return `
    <tr class="code-row">
      <td class="slot-cell">${slotText}</td>
      <td class="line-cell">${escapeHtml(lineLabel)}</td>
      <td class="code-cell">${renderCodeCell(row.codeText)}</td>
    </tr>
  `;
}

function renderPage(page, totalFullPages, submissionTotalPages) {
  const rowsHtml = page.rows
    .map((row, index) => renderRow(row, index + 1))
    .join('\n');

  return `
    <section class="page">
      <table class="code-grid">
        <colgroup>
          <col class="slot-col">
          <col class="line-col">
          <col class="code-col">
        </colgroup>
        <tbody>
          ${rowsHtml}
        </tbody>
      </table>
    </section>
  `;
}

function buildHtml(pages, totalFullPages) {
  const sectionsHtml = pages
    .map((page) => renderPage(page, totalFullPages, pages.length))
    .join('\n');

  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>回车键Poementer软件源程序登记提交版</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 12mm;
    }

    * {
      box-sizing: border-box;
    }

    html,
    body {
      margin: 0;
      padding: 0;
      background: #ffffff;
      color: #000000;
      font-family: "Consolas", "Courier New", monospace;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    body {
      font-size: 6.45pt;
    }

    .page {
      width: 186mm;
      height: 273mm;
      margin: 0 auto;
      padding: 0;
      break-after: page;
      page-break-after: always;
      overflow: hidden;
    }

    .page:last-child {
      break-after: auto;
      page-break-after: auto;
    }

    .code-grid {
      width: 100%;
      height: 273mm;
      border-collapse: collapse;
      table-layout: fixed;
      border: 0.2mm solid #000000;
    }

    .slot-col {
      width: 8.5mm;
    }

    .line-col {
      width: 13.5mm;
    }

    .code-col {
      width: auto;
    }

    .code-grid tr {
      height: 5.46mm;
    }

    .code-grid td {
      border-right: 0.12mm solid #000000;
      border-bottom: 0.12mm solid #000000;
      padding: 0.15mm 0.75mm;
      vertical-align: middle;
      overflow: hidden;
      white-space: pre;
      text-overflow: clip;
      line-height: 1;
      background: #ffffff;
    }

    .code-grid tr:last-child td {
      border-bottom: 0;
    }

    .code-grid td:last-child {
      border-right: 0;
    }

    .slot-cell,
    .line-cell {
      color: #000000;
      text-align: right;
    }

    .code-cell {
      color: #000000;
    }

    .divider-row td {
      background: #ffffff;
      color: #000000;
      font-weight: 700;
    }

    .filler-row td {
      color: #000000;
      background: #ffffff;
    }
  </style>
</head>
<body>
${sectionsHtml}
</body>
</html>`;
}

function buildIndexMarkdown(items, totalFullPages, selectedPages) {
  const selectedRangeText = totalFullPages > EDGE_PAGE_COUNT * 2
    ? `完整序列前 ${EDGE_PAGE_COUNT} 页与后 ${EDGE_PAGE_COUNT} 页`
    : `完整序列全部 ${totalFullPages} 页`;

  const lines = [
    '# 回车键Poementer软件源程序页码清单',
    '',
    '## 1. 总体说明',
    '',
    `- 选编文件数量：${items.length}`,
    `- 完整源程序序列页数：${totalFullPages}`,
    `- 最终提交页数：${selectedPages.length}`,
    `- 提交策略：${selectedRangeText}`,
    `- 每页固定源码行数：${ROWS_PER_PAGE}`,
    '',
    '## 2. 文件页码映射',
    '',
    '| 顺序 | 源码路径 | 说明 | 原始行数 | 视觉行数 | 完整序列页码区间 | 入选区段 |',
    '| --- | --- | --- | ---: | ---: | --- | --- |'
  ];

  for (const item of items) {
    const pageRange = item.pageStart && item.pageEnd
      ? `${item.pageStart}-${item.pageEnd}`
      : '-';
    lines.push(
      `| ${item.order} | \`${item.path}\` | ${item.label} | ${item.rawLineCount} | ${item.visualRowCount} | ${pageRange} | ${item.selectedSegment} |`
    );
  }

  lines.push(
    '',
    '## 3. 说明',
    '',
    '- “视觉行数”包含文件标识行、源码续行和实际源码显示行，用于固定 50 行源码网格分页。',
    '- 最终 PDF 采用 A4 竖版、白底黑字、每页固定 50 行源码网格，页脚按 1-60 编排。',
    '- HTML 版可作为导入 Word 后继续调整页眉、页码和打印边距的源文件。',
    '- 当前清单按功能主链排序：启动与调用链 -> 身份主流程 -> 内容主链前端 -> 内容主链云函数。'
  );

  return `${lines.join('\n')}\n`;
}

async function writeOutputs(html, pagesIndex) {
  await ensureDirFor(outputHtmlPath);
  await ensureDirFor(outputPdfPath);
  await ensureDirFor(outputIndexPath);

  await fs.writeFile(outputHtmlPath, html, 'utf8');
  await fs.writeFile(outputIndexPath, pagesIndex, 'utf8');
}

async function exportPdf() {
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
      landscape: false,
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
        <div style="width:100%;font-size:9px;color:#1d2f40;text-align:center;padding-top:4px;font-family:SimSun, Songti SC, STSong, serif;">
          回车键Poementer软件
        </div>
      `,
      footerTemplate: `
        <div style="width:100%;font-size:8px;color:#566371;text-align:center;padding-bottom:4px;font-family:SimSun, Songti SC, STSong, serif;">
          第 <span class="pageNumber"></span> 页 / 共 <span class="totalPages"></span> 页
        </div>
      `
    });
  } finally {
    await browser.close();
  }
}

async function main() {
  const items = await loadManifestItems();
  const rows = buildSequence(items);
  const fullPages = paginateRows(rows);
  const selectedPages = selectPages(fullPages).map((page, index) => ({
    ...page,
    submissionPageNumber: index + 1
  }));

  assignFilePageRanges(items, fullPages, fullPages.length);

  const html = buildHtml(selectedPages, fullPages.length);
  const indexMarkdown = buildIndexMarkdown(items, fullPages.length, selectedPages);

  await writeOutputs(html, indexMarkdown);
  await exportPdf();

  console.log(`[export-source-pdf] 完整序列页数: ${fullPages.length}`);
  console.log(`[export-source-pdf] 最终提交页数: ${selectedPages.length}`);
  console.log(`[export-source-pdf] HTML 已生成: ${outputHtmlPath}`);
  console.log(`[export-source-pdf] PDF 已生成: ${outputPdfPath}`);
  console.log(`[export-source-pdf] 页码清单已生成: ${outputIndexPath}`);
}

main().catch((error) => {
  console.error('[export-source-pdf] 失败:', error);
  process.exitCode = 1;
});
