# 字体系统指南

最后更新：2026-09-09。

本指南说明当前字体加载流程。App 本地字体的修改约束与验收记录以[字体模块约定](../app-font-contract.md)为准。

## 验证状态

App 本地汇文明朝修复、独立模块拆分和自动检查接入后，用户已确认真机实测正常。质量检查、App 构建及小程序构建均通过。用户未提供具体机型、系统版本或逐项验收结果，不据此宣称所有平台和场景均完成真机测试。

## 使用与命名

- 诗歌内容默认使用汇文明朝，导航、按钮、表单等界面元素使用系统字体。
- 卡片可选字体还包括小小皓体、字体圈欣意吉祥宋、南西雅致黑、文楷、龙藏体。
- `汇文明朝` 是配置和显示名；`Huiwen-mincho` 是注册与 Canvas 绘制名。
- 旧名称输入通过 `normalizeFontName()` 兼容；Canvas 通过 `getRuntimeFontFamily()` 取得名称，不在业务代码中另建映射。
- CSS 声明不能代替卡片绘制前的字体注册检查。

## 模块职责

| 文件 | 职责 |
| --- | --- |
| `utils/appFontLoader.js` | 固定 App 本地字体源、转换 file URL、按页面注册与合并任务 |
| `utils/fontManager.js` | 跨端入口、名称兼容、其他字体的下载和缓存 |
| `utils/builtinFontReady.js` | 汇文明朝就绪状态和 font-loaded 通知 |
| `main.js` | 各端预加载；App 在页面 onReady 执行 |
| `App.vue` | 非微信小程序端的中文字体名 CSS 声明 |
| `components/FontSelectorModal.vue` | 字体选择、加载状态与预览事件 |
| `pages/post-detail/post-detail.vue` | 卡片加载字体、绘制、降级与重绘调度 |
| `components/weekly/WeeklyShareCardModal.vue` | 周刊卡片加载与绘制调度 |
| `utils/shareCanvas.js`、`utils/timelineShareCanvas.js` | 使用运行时名称测量、排版和绘制 |

## 平台差异

### App（App-vue）

汇文明朝固定读取 `/static/fonts/Huiwen-mincho-compressed.woff2`，当前文件为 7,993,880 字节，约 7.62 MiB。此分支不经过云端地址解析或旧云端字体缓存。

页面 onReady → fontManager.ensureFontAvailable → AppFontLoader → 将包内路径转换为完整 file:// URL → uni.loadFontFace 注册 Huiwen-mincho → 当前页面标记就绪。

同页并发请求共用任务，新页面重新注册，返回仍存在的页面可复用。加载期间切换页面，旧结果不能标记新页面已加载；失败后允许重试。

本地打包避免网络下载，但仍需异步读取和注册，不能理解成“启动瞬间即可使用”。其他字体通过通用管理器下载或读取缓存，再注册到当前页面。

### 微信小程序

main.js 在启动时调用管理器预加载。汇文明朝使用配置的云存储 HTTPS WOFF2 地址，交给 uni.loadFontFace 注册；其他字体先将云文件 ID 转为 HTTPS 地址。

当前远程加载分支没有主动保存本地持久字体文件。当前运行中已加载可以复用，但不能承诺重启后直接可用。加载耗时取决于网络和运行环境，不承诺固定 1–2 秒。进度包含定时模拟值，不是字节级下载进度。

### H5

使用站点静态资源 `/static/fonts/Huiwen-mincho-compressed.woff2`。启动代码包含 preload、CSS 声明和中文名称 FontFace 预加载；卡片的运行时名称由管理器注册，并等待 document.fonts.ready。

站点静态资源仍可能需要首次网络下载。其他字体优先下载到 IndexedDB 缓存，再通过 FontFace 注册。

## 卡片制作与降级

生成图片前先调用 ensureFontAvailable，等待注册及平台生效延迟，再用 Canvas 测量、排版并导出。选择未加载字体时，成功后才切换选择；失败保留原选择。预览变更使用防抖减少重复绘制。

- 一般加载失败时，本次卡片回退系统字体，不覆盖用户选择的字体配置。
- 小程序汇文明朝有特殊等待分支：保持字体名称先绘制，实际可能使用替代字体；随后收到就绪通知且弹窗和状态仍匹配时，重新生成。
- isFontCached 只说明文件资源状态，不能代替 isFontLoaded。App 不应直接查看全局 loadedFonts 集合判断当前页面是否可绘制。

## 检查命令

```bash
npm run test:app-font
npm run check:quality
npm run build:app
npm run build:mp-weixin
```

check:quality 已包含字体测试，build:app 通过 prebuild:app 先执行字体测试。回归覆盖本地路径、名称兼容、旧云端缓存隔离、同页请求合并、页面切换、失败重试及 WOFF2 文件存在性与长度。

开发命令为 `npm run dev:app`、`npm run dev:mp-weixin`、`npm run dev:h5`。CLI 构建输出位于 `dist/build/app`、`dist/build/mp-weixin`、`dist/build/h5`；HBuilderX 运行输出以其配置为准。

## 排查与维护

1. App 先检查包内 WOFF2 是否存在、转换后是否为正确 file:// 地址、调用时页面是否就绪。不要通过改回云端掩盖本地路径问题。
2. 通过 `fontManager.isFontLoaded('汇文明朝')` 查询当前状态，并核对注册与 Canvas 使用的运行时名称。
3. 小程序检查 HTTPS 请求和注册回调；H5 检查静态资源请求、FontFace 注册和 Canvas 名称。
4. 修改字体、资源或生命周期时，同步维护模块约定和测试；业务页面不另写下载、路径转换或注册逻辑。
5. 自动测试不模拟真实 WebView 渲染。相关行为变化后，按[真机验收清单](../app-font-contract.md#自动保护与验证)复查预览、导出及页面切换，并记录实际验证范围。

历史文档中的“字体包 +15 KB”“App/H5 不需要预加载”“小程序后续启动一定直接复用字体”等描述已不适用于当前实现。
