# App 诗歌卡片字体模块约定

本约定保护已通过真机验证的本地汇文明朝加载流程。目标是隔离变化并自动发现回归，不是禁止按新需求维护代码。

## 当前验收记录（2026-09-07）

- App 本地汇文明朝路径和按页面注册的修复：用户确认运行正常。
- 抽取 `appFontLoader.js`、接入自动检查后的版本：用户再次确认“实测没问题”。该模块拆分已完成用户真机验收。
- 自动验证已通过：`npm run check:quality`、`npm run build:app`（含字体前置测试）、`npm run build:mp-weixin`。
- 本次反馈未提供具体机型、系统版本和逐项测试清单，不将其记为 Android/iOS 全机型或全部场景覆盖。下面的验收清单用于后续变更回归。

## 模块职责

| 文件 | 职责 |
| --- | --- |
| `utils/appFontLoader.js` | 固定 App 内置字体名称和路径；转换 file URL；按页面保存注册状态、合并加载任务、拒绝过期页面结果 |
| `utils/fontManager.js` | 跨端入口、名称兼容、其他字体的资源下载和缓存；App 注册委托给独立模块 |
| `main.js` | App 页面 onReady 触发预加载 |
| `utils/shareCanvas.js`、`utils/timelineShareCanvas.js` | 通过 fontManager 的运行时名称绘制 Canvas |
| `scripts/test-app-font.cjs` | 模拟 App 环境运行真实模块及管理器，检查行为和包内字体资源 |

## 必须保持的行为

1. 汇文明朝业务名称为 `汇文明朝`，运行时名称为 `Huiwen-mincho`。两者各有用途，不可随意替换其中一端。
2. App 字体源固定为 `/static/fonts/Huiwen-mincho-compressed.woff2`；此分支不接受云端缓存，也不调用其他字体的下载回调。
3. 路径转换结果必须是可加载的 `file://` URL；Android 安装包的 `apps/` 路径须转换成 `/android_asset/apps/`，防止视图层再次拼接 `_www`。
4. App 注册以页面为单位。相同页面并发请求合并，不同页面独立注册；已存在页面再次显示时可复用其状态。
5. 无页面时不注册；页面切换后的旧加载结果不标记新页面已加载；失败任务清理后允许重试。
6. 注册和 Canvas 使用相同运行时名称；业务端继续等待 `ensureFontAvailable()` 后再绘制。
7. 小程序的 HTTPS 加载和 H5 的 FontFace/缓存逻辑独立于本模块。

## 自动保护与验证

- `npm run test:app-font`：单独运行字体回归测试。
- `npm run check:quality`：编码、语法和字体测试。
- `npm run build:app`：通过 prebuild 钩子先执行字体测试，再编译 App。
- 共用管理器变动后运行 `npm run build:mp-weixin`。

自动测试覆盖本地路径、名称兼容、旧云缓存隔离、同页并发、页面切换、失败后重试及 WOFF2 文件存在性与长度。测试使用模拟的 plus/uni，不证明系统 WebView 实际渲染效果。

真机验收：重新运行含字体资源的 App，首次打开诗歌卡片；切换字体后切回汇文明朝；退出详情后进入另一首诗；返回先前页面；检查预览和保存图片中的字体。可以在诗歌已加载后断网验证默认字体仍可生成。涉及周刊卡片时也检查周刊分享。

这些是开发约束和本地命令保护，并非仓库服务端强制规则；直接跳过检查仍可能引入错误。若后续配置 CI，应把 `npm run check:quality` 作为必需检查。
