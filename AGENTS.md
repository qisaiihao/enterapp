# 项目修改约束

## App 诗歌卡片字体

App 汇文明朝加载修复及独立模块拆分均已通过用户真机验证（2026-09-07）。修改字体管理、应用生命周期、卡片绘制或字体资源时，先阅读 [字体模块约定](docs/app-font-contract.md)。

- `utils/appFontLoader.js` 负责 App 路径转换和按页面注册；业务页面通过 `fontManager.ensureFontAvailable()` / `isFontLoaded()` 调用，不另写字体下载和注册逻辑。
- App 汇文明朝只读取安装包内 `static/fonts/Huiwen-mincho-compressed.woff2`，不得因通用缓存、平台初始化或重构而改走云端。
- 显示名为“汇文明朝”，注册和 Canvas 绘制名为 `Huiwen-mincho`；旧名称映射保留兼容。
- App 预加载保留在页面 `onReady`，加载状态按页面隔离；不得使用全局已加载标志跳过新页面注册。
- 相关修改必须通过 `npm run check:quality` 和 `npm run build:app`。涉及跨端管理器时再运行 `npm run build:mp-weixin`。
- 不得通过删除测试、放宽断言来掩盖回归。明确的新需求可以调整约定，但须同步更新测试和文档，并说明行为变化。
- 自动测试不能代替真机验证；改变路径、注册时机或绘制名称后，报告真机验证是否完成。
