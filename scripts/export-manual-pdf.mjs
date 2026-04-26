import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import MarkdownIt from 'markdown-it';
import puppeteer from 'puppeteer-core';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');
const deliverableDir = path.join(repoRoot, 'docs', 'deliverables');
const assetsDir = path.join(deliverableDir, 'assets');

const outputMarkdownPath = path.join(deliverableDir, '回车键Poementer软件-操作手册.md');
const outputHtmlPath = path.join(deliverableDir, '回车键Poementer软件-操作手册.html');
const outputPdfPath = path.join(deliverableDir, '回车键Poementer软件-操作手册.pdf');

async function ensureDir(dirPath) {
  await fs.mkdir(dirPath, { recursive: true });
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
      const candidate = path.join(puppeteerCacheDir, dir.name, 'chrome-win64', 'chrome.exe');
      if (await fileExists(candidate)) {
        return candidate;
      }
    }
  }

  throw new Error('未找到可用的 Chrome/Chromium 浏览器，请设置 PUPPETEER_EXECUTABLE_PATH。');
}

function svgFrame(title, body, options = {}) {
  const { accent = '#111111', height = 760 } = options;
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="390" height="${height}" viewBox="0 0 390 ${height}">
  <rect width="390" height="${height}" fill="#ffffff"/>
  <rect x="21" y="18" width="348" height="${height - 36}" rx="28" fill="#ffffff" stroke="#111111" stroke-width="2"/>
  <rect x="154" y="30" width="82" height="5" rx="2.5" fill="#111111"/>
  <text x="195" y="70" text-anchor="middle" font-family="SimSun, Songti SC, serif" font-size="19" font-weight="700" fill="${accent}">${title}</text>
  ${body}
</svg>`;
}

const assets = {
  'manual-splash.svg': svgFrame('启动页', `
  <text x="195" y="260" text-anchor="middle" font-family="Georgia, serif" font-size="34" fill="#111111">poementer</text>
  <line x1="246" y1="235" x2="246" y2="271" stroke="#111111" stroke-width="3"/>
  <rect x="244" y="458" width="83" height="48" rx="8" fill="#ffffff" stroke="#111111" stroke-width="2"/>
  <path d="M286 469 L306 469 L306 486 L295 486" fill="none" stroke="#111111" stroke-width="3"/>
  <text x="286" y="491" text-anchor="middle" font-family="Arial, sans-serif" font-size="16" fill="#111111">Enter</text>
  <text x="195" y="556" text-anchor="middle" font-family="SimSun, Songti SC, serif" font-size="16" fill="#555555">加载完成后点击进入</text>
`, { height: 720 }),

  'manual-login.svg': svgFrame('登录', `
  <text x="195" y="130" text-anchor="middle" font-family="Georgia, serif" font-size="28" fill="#111111">poementer</text>
  <rect x="62" y="205" width="266" height="48" rx="8" fill="#ffffff" stroke="#111111" stroke-width="1.5"/>
  <text x="82" y="235" font-family="SimSun, Songti SC, serif" font-size="15" fill="#777777">请输入 Poem ID</text>
  <rect x="62" y="274" width="266" height="48" rx="8" fill="#ffffff" stroke="#111111" stroke-width="1.5"/>
  <text x="82" y="304" font-family="SimSun, Songti SC, serif" font-size="15" fill="#777777">请输入密码</text>
  <text x="304" y="354" text-anchor="end" font-family="SimSun, Songti SC, serif" font-size="15" fill="#111111">注册</text>
  <rect x="247" y="575" width="90" height="52" rx="8" fill="#ffffff" stroke="#111111" stroke-width="2"/>
  <path d="M294 588 L317 588 L317 608 L305 608" fill="none" stroke="#111111" stroke-width="3"/>
  <text x="292" y="611" text-anchor="middle" font-family="Arial, sans-serif" font-size="15" fill="#111111">Enter</text>
  <text x="195" y="665" text-anchor="middle" font-family="SimSun, Songti SC, serif" font-size="14" fill="#666666">输入账号密码后点击右下角 Enter</text>
`),

  'manual-register.svg': svgFrame('注册', `
  <circle cx="195" cy="128" r="37" fill="#f7f7f7" stroke="#111111" stroke-width="1.5"/>
  <text x="195" y="136" text-anchor="middle" font-family="SimSun, Songti SC, serif" font-size="15" fill="#555555">头像</text>
  <text x="195" y="183" text-anchor="middle" font-family="SimSun, Songti SC, serif" font-size="14" fill="#555555">点击更换头像</text>
  <rect x="58" y="220" width="274" height="44" rx="7" fill="#ffffff" stroke="#111111" stroke-width="1.3"/>
  <text x="77" y="248" font-family="SimSun, Songti SC, serif" font-size="14" fill="#555555">Poem ID</text>
  <rect x="58" y="281" width="274" height="44" rx="7" fill="#ffffff" stroke="#111111" stroke-width="1.3"/>
  <text x="77" y="309" font-family="SimSun, Songti SC, serif" font-size="14" fill="#555555">密码</text>
  <rect x="58" y="342" width="274" height="44" rx="7" fill="#ffffff" stroke="#111111" stroke-width="1.3"/>
  <text x="77" y="370" font-family="SimSun, Songti SC, serif" font-size="14" fill="#555555">确认密码</text>
  <rect x="58" y="403" width="274" height="44" rx="7" fill="#ffffff" stroke="#111111" stroke-width="1.3"/>
  <text x="77" y="431" font-family="SimSun, Songti SC, serif" font-size="14" fill="#555555">昵称</text>
  <text x="195" y="490" text-anchor="middle" font-family="SimSun, Songti SC, serif" font-size="14" fill="#555555">已有账号？ 去登录</text>
  <rect x="247" y="575" width="90" height="52" rx="8" fill="#ffffff" stroke="#111111" stroke-width="2"/>
  <text x="292" y="608" text-anchor="middle" font-family="Arial, sans-serif" font-size="15" fill="#111111">Enter</text>
`),

  'manual-main.svg': svgFrame('主界面', `
  <circle cx="292" cy="107" r="18" fill="#ffffff" stroke="#111111" stroke-width="3"/>
  <line x1="306" y1="121" x2="322" y2="137" stroke="#111111" stroke-width="3"/>
  <rect x="333" y="94" width="28" height="30" rx="5" fill="#ffffff" stroke="#111111" stroke-width="2"/>
  <path d="M66 152 C86 135 112 146 111 170 C98 183 76 179 66 152 Z" fill="#f7f7f7" stroke="#111111"/>
  <text x="83" y="203" text-anchor="middle" font-family="SimSun, Songti SC, serif" font-size="15" fill="#555555">活动</text>
  <path d="M326 169 L360 169 L346 188 L346 214 L340 214 L340 188 Z" fill="#ffffff" stroke="#555555" stroke-width="3"/>
  <rect x="64" y="242" width="262" height="150" rx="17" fill="#0a2340"/>
  <text x="92" y="292" font-family="SimSun, Songti SC, serif" font-size="18" font-weight="700" fill="#ffffff">不想</text>
  <text x="92" y="324" font-family="SimSun, Songti SC, serif" font-size="18" font-weight="700" fill="#ffffff">留在春夜里的</text>
  <text x="92" y="356" font-family="SimSun, Songti SC, serif" font-size="18" font-weight="700" fill="#ffffff">是一阵会呜咽的风</text>
  <rect x="62" y="430" width="266" height="78" rx="15" fill="#e8e8e8" stroke="#111111" stroke-width="1"/>
  <text x="92" y="478" font-family="SimSun, Songti SC, serif" font-size="18" fill="#111111">《梦》</text>
  <rect x="42" y="556" width="306" height="70" rx="17" fill="#ffffff" stroke="#111111" stroke-width="1.4"/>
  <text x="73" y="600" font-family="SimSun, Songti SC, serif" font-size="15" fill="#111111">广场</text>
  <text x="151" y="600" font-family="SimSun, Songti SC, serif" font-size="15" fill="#111111">原创</text>
  <text x="229" y="600" font-family="SimSun, Songti SC, serif" font-size="15" fill="#999999">读诗</text>
  <text x="307" y="600" font-family="SimSun, Songti SC, serif" font-size="15" fill="#999999">我</text>
`),

  'manual-detail.svg': svgFrame('作品详情', `
  <circle cx="74" cy="106" r="18" fill="#f5f5f5" stroke="#111111"/>
  <text x="104" y="112" font-family="SimSun, Songti SC, serif" font-size="15" fill="#111111">作者昵称</text>
  <rect x="54" y="148" width="282" height="190" rx="16" fill="#0a2340"/>
  <text x="91" y="206" font-family="SimSun, Songti SC, serif" font-size="19" font-weight="700" fill="#ffffff">春夜</text>
  <text x="91" y="244" font-family="SimSun, Songti SC, serif" font-size="18" font-weight="700" fill="#ffffff">我本该被遗忘的</text>
  <text x="91" y="282" font-family="SimSun, Songti SC, serif" font-size="18" font-weight="700" fill="#ffffff">此夜，潺潺...</text>
  <text x="74" y="390" font-family="Arial, sans-serif" font-size="15" fill="#111111">Like  Comment  Favorite  Share</text>
  <rect x="55" y="433" width="280" height="56" rx="9" fill="#ffffff" stroke="#111111"/>
  <text x="75" y="465" font-family="SimSun, Songti SC, serif" font-size="14" fill="#555555">写下评论...</text>
  <line x1="55" y1="532" x2="335" y2="532" stroke="#111111"/>
  <text x="55" y="568" font-family="SimSun, Songti SC, serif" font-size="16" fill="#111111">评论列表</text>
  <circle cx="70" cy="613" r="12" fill="#f1f1f1" stroke="#111111"/>
  <text x="94" y="619" font-family="SimSun, Songti SC, serif" font-size="14" fill="#111111">评论内容与回复入口</text>
`),

  'manual-publish.svg': svgFrame('发布编辑', `
  <rect x="58" y="112" width="274" height="290" rx="12" fill="#ffffff" stroke="#111111" stroke-width="1.5"/>
  <text x="78" y="149" font-family="SimSun, Songti SC, serif" font-size="15" fill="#777777">在这里写下诗歌或讨论内容...</text>
  <line x1="78" y1="183" x2="312" y2="183" stroke="#dddddd"/>
  <line x1="78" y1="222" x2="312" y2="222" stroke="#dddddd"/>
  <line x1="78" y1="261" x2="312" y2="261" stroke="#dddddd"/>
  <rect x="318" y="160" width="34" height="192" rx="17" fill="#ffffff" stroke="#111111"/>
  <text x="335" y="193" text-anchor="middle" font-family="SimSun, Songti SC, serif" font-size="12" fill="#111111">标签</text>
  <text x="335" y="231" text-anchor="middle" font-family="SimSun, Songti SC, serif" font-size="12" fill="#111111">图片</text>
  <text x="335" y="269" text-anchor="middle" font-family="SimSun, Songti SC, serif" font-size="12" fill="#111111">模式</text>
  <text x="335" y="307" text-anchor="middle" font-family="SimSun, Songti SC, serif" font-size="12" fill="#111111">颜色</text>
  <rect x="68" y="438" width="86" height="31" rx="15" fill="#ffffff" stroke="#111111"/>
  <text x="111" y="459" text-anchor="middle" font-family="SimSun, Songti SC, serif" font-size="13" fill="#111111">诗歌</text>
  <rect x="168" y="438" width="86" height="31" rx="15" fill="#ffffff" stroke="#111111"/>
  <text x="211" y="459" text-anchor="middle" font-family="SimSun, Songti SC, serif" font-size="13" fill="#111111">讨论</text>
  <rect x="247" y="575" width="90" height="52" rx="8" fill="#ffffff" stroke="#111111" stroke-width="2"/>
  <text x="292" y="608" text-anchor="middle" font-family="Arial, sans-serif" font-size="15" fill="#111111">Next</text>
`),

  'manual-preview.svg': svgFrame('发布预览', `
  <rect x="57" y="112" width="276" height="238" rx="18" fill="#0a2340"/>
  <text x="88" y="176" font-family="SimSun, Songti SC, serif" font-size="19" font-weight="700" fill="#ffffff">预览作品内容</text>
  <text x="88" y="217" font-family="SimSun, Songti SC, serif" font-size="17" fill="#ffffff">确认排版、颜色、图片</text>
  <text x="88" y="258" font-family="SimSun, Songti SC, serif" font-size="17" fill="#ffffff">无误后提交发布</text>
  <rect x="59" y="386" width="272" height="44" rx="8" fill="#ffffff" stroke="#111111"/>
  <text x="79" y="413" font-family="SimSun, Songti SC, serif" font-size="14" fill="#555555">选择作品集 / 收藏夹</text>
  <rect x="59" y="453" width="272" height="44" rx="8" fill="#ffffff" stroke="#111111"/>
  <text x="79" y="480" font-family="SimSun, Songti SC, serif" font-size="14" fill="#555555">匿名发布 / 可见范围</text>
  <rect x="226" y="570" width="110" height="46" rx="8" fill="#111111"/>
  <text x="281" y="599" text-anchor="middle" font-family="SimSun, Songti SC, serif" font-size="16" fill="#ffffff">发布</text>
`),

  'manual-profile.svg': svgFrame('个人中心', `
  <circle cx="96" cy="128" r="36" fill="#f5f5f5" stroke="#111111"/>
  <text x="148" y="119" font-family="SimSun, Songti SC, serif" font-size="18" font-weight="700" fill="#111111">用户昵称</text>
  <text x="148" y="150" font-family="SimSun, Songti SC, serif" font-size="13" fill="#555555">签名与诗人信息</text>
  <text x="76" y="230" font-family="SimSun, Songti SC, serif" font-size="15" fill="#111111">作品  32</text>
  <text x="166" y="230" font-family="SimSun, Songti SC, serif" font-size="15" fill="#111111">关注  18</text>
  <text x="256" y="230" font-family="SimSun, Songti SC, serif" font-size="15" fill="#111111">粉丝  96</text>
  <rect x="58" y="272" width="274" height="48" rx="8" fill="#ffffff" stroke="#111111"/>
  <text x="80" y="302" font-family="SimSun, Songti SC, serif" font-size="15" fill="#111111">编辑资料</text>
  <rect x="58" y="342" width="274" height="48" rx="8" fill="#ffffff" stroke="#111111"/>
  <text x="80" y="372" font-family="SimSun, Songti SC, serif" font-size="15" fill="#111111">作品集</text>
  <rect x="58" y="412" width="274" height="48" rx="8" fill="#ffffff" stroke="#111111"/>
  <text x="80" y="442" font-family="SimSun, Songti SC, serif" font-size="15" fill="#111111">收藏夹</text>
  <rect x="58" y="482" width="274" height="48" rx="8" fill="#ffffff" stroke="#111111"/>
  <text x="80" y="512" font-family="SimSun, Songti SC, serif" font-size="15" fill="#111111">消息与设置</text>
  <rect x="42" y="618" width="306" height="70" rx="17" fill="#ffffff" stroke="#111111" stroke-width="1.4"/>
  <text x="305" y="662" text-anchor="middle" font-family="SimSun, Songti SC, serif" font-size="15" fill="#111111">我</text>
`),

  'manual-search.svg': svgFrame('搜索', `
  <rect x="55" y="102" width="280" height="44" rx="22" fill="#ffffff" stroke="#111111"/>
  <text x="82" y="130" font-family="SimSun, Songti SC, serif" font-size="14" fill="#777777">搜索作品、作者、标签</text>
  <text x="58" y="190" font-family="SimSun, Songti SC, serif" font-size="16" font-weight="700" fill="#111111">搜索历史</text>
  <rect x="58" y="214" width="84" height="30" rx="15" fill="#ffffff" stroke="#111111"/>
  <text x="100" y="235" text-anchor="middle" font-family="SimSun, Songti SC, serif" font-size="13" fill="#111111">春夜</text>
  <rect x="152" y="214" width="84" height="30" rx="15" fill="#ffffff" stroke="#111111"/>
  <text x="194" y="235" text-anchor="middle" font-family="SimSun, Songti SC, serif" font-size="13" fill="#111111">远方</text>
  <text x="58" y="304" font-family="SimSun, Songti SC, serif" font-size="16" font-weight="700" fill="#111111">搜索结果</text>
  <rect x="58" y="332" width="274" height="88" rx="10" fill="#ffffff" stroke="#111111"/>
  <text x="78" y="366" font-family="SimSun, Songti SC, serif" font-size="15" fill="#111111">作品标题或摘录</text>
  <text x="78" y="395" font-family="SimSun, Songti SC, serif" font-size="13" fill="#555555">作者、标签、互动数</text>
  <rect x="58" y="446" width="274" height="88" rx="10" fill="#ffffff" stroke="#111111"/>
  <text x="78" y="480" font-family="SimSun, Songti SC, serif" font-size="15" fill="#111111">用户或诗人结果</text>
  <text x="78" y="509" font-family="SimSun, Songti SC, serif" font-size="13" fill="#555555">进入主页查看作品</text>
`),

  'manual-flow.svg': `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="780" height="360" viewBox="0 0 780 360">
  <rect width="780" height="360" fill="#ffffff"/>
  <defs>
    <marker id="arrow" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto">
      <path d="M0,0 L9,3 L0,6 Z" fill="#111111"/>
    </marker>
  </defs>
  <g font-family="SimSun, Songti SC, serif" font-size="18" fill="#111111">
    <rect x="35" y="55" width="120" height="56" rx="8" fill="#ffffff" stroke="#111111"/>
    <text x="95" y="90" text-anchor="middle">启动软件</text>
    <line x1="155" y1="83" x2="215" y2="83" stroke="#111111" marker-end="url(#arrow)"/>
    <rect x="215" y="55" width="120" height="56" rx="8" fill="#ffffff" stroke="#111111"/>
    <text x="275" y="90" text-anchor="middle">登录/注册</text>
    <line x1="335" y1="83" x2="395" y2="83" stroke="#111111" marker-end="url(#arrow)"/>
    <rect x="395" y="55" width="120" height="56" rx="8" fill="#ffffff" stroke="#111111"/>
    <text x="455" y="90" text-anchor="middle">浏览主界面</text>
    <line x1="515" y1="83" x2="575" y2="83" stroke="#111111" marker-end="url(#arrow)"/>
    <rect x="575" y="55" width="150" height="56" rx="8" fill="#ffffff" stroke="#111111"/>
    <text x="650" y="90" text-anchor="middle">查看详情互动</text>
    <line x1="455" y1="111" x2="455" y2="174" stroke="#111111" marker-end="url(#arrow)"/>
    <rect x="380" y="174" width="150" height="56" rx="8" fill="#ffffff" stroke="#111111"/>
    <text x="455" y="209" text-anchor="middle">编辑作品</text>
    <line x1="530" y1="202" x2="590" y2="202" stroke="#111111" marker-end="url(#arrow)"/>
    <rect x="590" y="174" width="135" height="56" rx="8" fill="#ffffff" stroke="#111111"/>
    <text x="657" y="209" text-anchor="middle">预览发布</text>
    <line x1="455" y1="230" x2="455" y2="290" stroke="#111111" marker-end="url(#arrow)"/>
    <rect x="380" y="290" width="150" height="48" rx="8" fill="#ffffff" stroke="#111111"/>
    <text x="455" y="321" text-anchor="middle">作品沉淀</text>
  </g>
</svg>`
};

async function writeAssets() {
  await ensureDir(assetsDir);
  await Promise.all(Object.entries(assets).map(([name, svg]) => {
    return fs.writeFile(path.join(assetsDir, name), svg, 'utf8');
  }));
}

function buildManualMarkdown() {
  return `# 回车键Poementer软件操作手册

| 项目 | 内容 |
| --- | --- |
| 软件名称 | 回车键Poementer软件 |
| 文档名称 | 操作手册 |
| 文档版本 | V1.0 |
| 适用对象 | 普通用户、内容创作者、运营管理员、软件登记审查人员 |
| 适用端 | 微信小程序、H5、App |
| 编制日期 | 2026-04-26 |

## 1. 软件简介

回车键Poementer软件是一款面向诗歌创作、作品展示、评论互动、作品集沉淀与活动运营的多端软件。用户可以在软件内登录账号、浏览广场内容、查看原创诗歌、发布诗歌或讨论、参与点赞评论、维护个人资料、管理作品集与收藏夹。

本手册以普通用户完整使用流程为主线，覆盖“启动软件、登录注册、主界面浏览、作品详情互动、作品发布、个人中心管理、搜索与消息”等主要功能。截图为依据当前界面结构整理的清晰操作截图，用于展示功能入口、按钮位置和页面操作顺序。

![软件操作总流程](assets/manual-flow.svg)

<div class="page-break"></div>

## 2. 启动软件与进入首页

![启动页截图](assets/h5-screenshots/splash.png)

### 2.1 启动步骤

1. 在微信小程序、H5 地址或 App 图标中打开“回车键Poementer软件”。
2. 软件显示启动页，并执行字体、图片、缓存与登录态预加载。
3. 页面显示 Enter 进入按钮后，点击 Enter。
4. 如果本地存在有效登录态，软件进入主界面；如果没有有效账号，则进入登录页或允许浏览公开内容。

### 2.2 注意事项

| 情况 | 处理方式 |
| --- | --- |
| 首次使用 | 建议先注册账号，后续可跨端保存作品和互动记录 |
| 网络较慢 | 等待加载完成后重试，公开内容可在部分场景下继续浏览 |
| 重复打开 | 软件可能跳过启动动画，直接进入主页面 |

<div class="page-break"></div>

## 3. 登录与注册

![登录页截图](assets/h5-screenshots/login.png)

### 3.1 使用 Poem ID 登录

1. 在登录页输入已注册的 Poem ID。
2. 在密码输入框输入账号密码。
3. 检查两个输入框均不为空。
4. 点击右下角 Enter 按钮提交登录。
5. 登录成功后，软件写入本地登录状态并跳转主界面。

### 3.2 使用微信或第三方登录

微信小程序端可使用微信授权登录；H5 或 App 可按已配置能力使用账号密码、GitHub OAuth 或手机号相关登录能力。第三方登录成功后，软件会绑定用户标识，并把用户资料、关注、作品和互动数据归入同一账号。

![注册页截图](assets/h5-screenshots/register.png)

### 3.3 新用户注册

1. 在登录页点击“注册”进入注册页。
2. 可点击头像区域选择头像，也可以使用默认头像。
3. 依次填写 Poem ID、密码、确认密码、昵称。
4. 确认两次密码一致。
5. 点击右下角 Enter 完成注册。
6. 注册成功后进入主界面；如当前端要求绑定手机号，则按弹窗完成验证码绑定或选择稍后处理。

<div class="page-break"></div>

## 4. 主界面说明

![主界面截图](assets/h5-screenshots/main.png)

### 4.1 主界面组成

| 区域 | 功能说明 |
| --- | --- |
| 顶部搜索入口 | 搜索作品、作者、标签和讨论内容 |
| 消息入口 | 查看点赞、评论、关注等消息通知 |
| 活动入口 | 查看近期活动和活动作品 |
| 筛选入口 | 对广场或原创列表进行内容类型筛选 |
| 内容列表 | 展示诗歌、讨论、拼贴诗等内容卡片 |
| 底部导航 | 在广场、原创、读诗、我之间切换 |

### 4.2 底部导航

| 导航项 | 操作结果 |
| --- | --- |
| 广场 | 查看推荐、关注、讨论等综合内容 |
| 原创 | 查看原创诗歌列表，支持筛选和进入发布 |
| 读诗 | 查看精选阅读内容、发现页和活动相关内容 |
| 我 | 进入个人中心，管理资料、作品、收藏和消息 |

<div class="page-break"></div>

## 5. 浏览作品与互动

![作品详情截图](assets/h5-screenshots/detail.png)

### 5.1 浏览作品

1. 在主界面上下滑动浏览作品卡片。
2. 点击作品卡片进入详情页。
3. 详情页展示作者信息、完整作品内容、标签、评论区和操作按钮。
4. 点击作者头像或昵称可进入作者主页。

### 5.2 点赞、评论、收藏与分享

| 操作 | 步骤 | 结果 |
| --- | --- | --- |
| 点赞 | 点击作品下方 Like 或爱心按钮 | 页面即时显示点赞状态，服务端保存点赞记录 |
| 评论 | 点击评论入口，在输入框填写内容并提交 | 评论追加到作品详情页，并触发作者消息 |
| 收藏 | 点击 Favorite 或收藏入口，选择收藏夹 | 作品进入个人收藏夹，后续可在个人中心查看 |
| 分享 | 点击 Share 入口 | 按端能力生成分享链接、分享卡片或图片 |

### 5.3 未登录状态说明

未登录用户可浏览公开内容；当执行点赞、评论、收藏、关注、发布等需要身份的操作时，软件会提示用户先登录或注册。

<div class="page-break"></div>

## 6. 发布作品

![发布编辑页截图](assets/h5-screenshots/publish.png)

### 6.1 进入发布页

1. 在原创、广场或相关页面点击发布入口。
2. 软件进入发布编辑页。
3. 在主输入区域填写诗歌、讨论或组诗内容。
4. 可通过右侧工具栏添加标签、上传图片、切换发布模式、选择高光或颜色。

### 6.2 编辑内容

| 功能 | 操作说明 |
| --- | --- |
| 输入正文 | 在编辑区直接输入诗歌、讨论文字或组诗段落 |
| 添加图片 | 点击图片工具，选择本地图片，软件上传至云存储 |
| 设置标签 | 点击标签工具，选择已有标签或输入自定义标签 |
| 切换模式 | 在诗歌、讨论、组诗等模式之间切换 |
| 设置样式 | 选择背景色、字体色或高光样式，用于作品卡片展示 |

![发布预览页截图](assets/h5-screenshots/preview.png)

### 6.3 预览与提交

1. 编辑完成后点击右下角下一步。
2. 在预览页检查排版、颜色、图片、标签和可见范围。
3. 选择作品集或收藏归档位置。
4. 如需要匿名发布，开启匿名选项。
5. 点击“发布”，软件执行内容审核、图片保存和帖子创建。
6. 发布成功后返回列表，作品进入广场或原创列表。

<div class="page-break"></div>

## 7. 个人中心与内容管理

![个人中心截图](assets/h5-screenshots/profile.png)

### 7.1 个人资料

1. 点击底部导航“我”进入个人中心。
2. 查看头像、昵称、签名、作品数量、关注数量和粉丝数量。
3. 点击“编辑资料”修改头像、昵称、签名、Poem ID、密码或绑定信息。
4. 保存后返回个人中心，页面展示最新资料。

### 7.2 作品集、收藏和消息

| 功能 | 操作方式 |
| --- | --- |
| 作品集 | 进入作品集列表，新建文件夹或查看已发布作品 |
| 收藏夹 | 查看收藏作品，可按文件夹整理 |
| 我的点赞 | 查看已点赞过的作品 |
| 关注与粉丝 | 查看关注用户与粉丝列表，并可进入用户主页 |
| 消息中心 | 查看评论、点赞、关注、系统通知等消息 |
| 屏蔽用户 | 管理已屏蔽用户，减少不希望看到的内容 |

<div class="page-break"></div>

## 8. 搜索、标签与活动

![搜索页截图](assets/h5-screenshots/search.png)

### 8.1 搜索内容

1. 点击主界面顶部搜索入口。
2. 输入关键词，例如作品标题、诗句、作者昵称或标签。
3. 点击搜索或选择搜索建议。
4. 在结果列表中点击作品进入详情，或点击用户进入主页。
5. 搜索历史会保留常用关键词，可在搜索页再次使用。

### 8.2 标签筛选

1. 在作品卡片或发布页选择标签。
2. 点击标签进入标签筛选页。
3. 页面按标签展示相关作品。
4. 可继续进入作品详情、作者主页或参与互动。

### 8.3 活动功能

1. 点击主界面活动入口查看近期活动。
2. 进入活动详情页阅读活动说明、时间和参与规则。
3. 点击参与或发布入口，按活动模式发布作品。
4. 活动作品会归入对应活动列表，运营人员可在后台进行活动管理。

<div class="page-break"></div>

## 9. 管理端与异常处理

### 9.1 管理端主要能力

后台页面面向管理员开放，主要用于活动管理、活动作品管理、帖子审核、诗人资料维护、反馈列表查看和密码找回辅助。普通用户不会在主界面直接看到后台入口。

| 管理功能 | 功能说明 |
| --- | --- |
| 活动管理 | 新建、编辑、下架活动 |
| 活动帖子 | 查看活动参与作品，处理违规或异常内容 |
| 帖子管理 | 管理公开内容、处理删除和可见性 |
| 反馈管理 | 查看用户反馈，跟进问题 |
| 诗人管理 | 维护诗人信息和展示资料 |

### 9.2 常见异常处理

| 异常现象 | 处理建议 |
| --- | --- |
| 登录失败 | 检查 Poem ID 和密码；确认网络正常后重试 |
| 图片上传失败 | 更换网络或压缩图片后重新上传 |
| 发布失败 | 检查内容是否为空、图片是否上传完成、内容是否通过审核 |
| 列表加载慢 | 下拉刷新或重新进入页面；缓存会在后台更新 |
| 消息未及时刷新 | 进入消息页后下拉刷新，或重新打开软件 |

## 10. 完整操作流程示例

1. 用户打开软件，进入启动页并点击 Enter。
2. 输入 Poem ID 和密码完成登录；新用户先注册。
3. 在主界面浏览广场内容，点击作品进入详情。
4. 在详情页点赞、评论或收藏作品。
5. 返回原创页，点击发布入口进入编辑页。
6. 输入诗歌内容，设置标签和颜色，进入预览页。
7. 确认无误后发布作品。
8. 进入个人中心，在作品集中查看已发布作品，并在消息中心查看互动通知。

## 11. 文档交付说明

本操作手册与《回车键Poementer软件设计开发说明书》配套提交：操作手册用于证明软件可操作流程，设计开发说明书用于说明软件结构、功能模块、接口、流程、数据和运行设计。源程序提交稿另以 A4 竖版、白底黑字、每页 50 行、共 60 页方式生成。`;
}

function buildHtml(markdownHtml) {
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>回车键Poementer软件操作手册</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 16mm 14mm 16mm 14mm;
    }

    * {
      box-sizing: border-box;
    }

    html,
    body {
      margin: 0;
      padding: 0;
      background: #ffffff;
      color: #111111;
      font-family: "SimSun", "Songti SC", "STSong", serif;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    body {
      font-size: 10.5pt;
      line-height: 1.55;
    }

    h1 {
      text-align: center;
      font-size: 22pt;
      margin: 44mm 0 18mm;
      letter-spacing: 0;
    }

    h2 {
      font-size: 15pt;
      line-height: 1.3;
      margin: 0 0 6mm;
      padding-bottom: 1.5mm;
      border-bottom: 0.3mm solid #111111;
    }

    h3 {
      font-size: 12pt;
      margin: 5mm 0 2mm;
    }

    p {
      margin: 0 0 3mm;
      text-align: justify;
    }

    ol,
    ul {
      margin: 0 0 4mm;
      padding-left: 7mm;
    }

    li {
      margin-bottom: 1.1mm;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      margin: 3mm 0 5mm;
      table-layout: fixed;
    }

    th,
    td {
      border: 0.25mm solid #111111;
      padding: 1.6mm 2mm;
      vertical-align: top;
      word-break: break-word;
    }

    th {
      font-weight: 700;
      background: #ffffff;
    }

    img {
      display: block;
      width: auto;
      max-width: 100%;
      max-height: 165mm;
      margin: 3mm auto 5mm;
      object-fit: contain;
      border: 0.25mm solid #111111;
      background: #ffffff;
    }

    .page-break {
      break-after: page;
      page-break-after: always;
      height: 0;
    }

    code {
      font-family: "Consolas", "Courier New", monospace;
      font-size: 9.5pt;
    }
  </style>
</head>
<body>
${markdownHtml}
</body>
</html>`;
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
      printBackground: true,
      preferCSSPageSize: true,
      displayHeaderFooter: true,
      margin: {
        top: '14mm',
        bottom: '14mm',
        left: '14mm',
        right: '14mm'
      },
      headerTemplate: `
        <div style="width:100%;font-size:9px;color:#111111;text-align:center;padding-top:4px;font-family:SimSun, Songti SC, STSong, serif;">
          回车键Poementer软件
        </div>
      `,
      footerTemplate: `
        <div style="width:100%;font-size:8px;color:#111111;text-align:center;padding-bottom:4px;font-family:SimSun, Songti SC, STSong, serif;">
          第 <span class="pageNumber"></span> 页 / 共 <span class="totalPages"></span> 页
        </div>
      `
    });
  } finally {
    await browser.close();
  }

  console.log(`[export-manual-pdf] 采用浏览器: ${executablePath}`);
}

async function main() {
  await ensureDir(deliverableDir);
  await writeAssets();

  const markdown = buildManualMarkdown();
  await fs.writeFile(outputMarkdownPath, `${markdown}\n`, 'utf8');

  const md = new MarkdownIt({
    html: true,
    linkify: false,
    typographer: false,
    breaks: false
  });

  const html = buildHtml(md.render(markdown));
  await fs.writeFile(outputHtmlPath, html, 'utf8');
  await exportPdf();

  console.log(`[export-manual-pdf] Markdown 已生成: ${outputMarkdownPath}`);
  console.log(`[export-manual-pdf] HTML 已生成: ${outputHtmlPath}`);
  console.log(`[export-manual-pdf] PDF 已生成: ${outputPdfPath}`);
}

main().catch((error) => {
  console.error('[export-manual-pdf] 失败:', error);
  process.exitCode = 1;
});
