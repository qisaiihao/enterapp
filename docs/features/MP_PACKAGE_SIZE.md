# 微信小程序包体积

2026-09-09 排查：小程序主包目录约 10.28 MiB，主要为汇文明朝 WOFF2（7.62 MiB）、贴纸头像（0.65 MiB）和未使用的 `road-dark.svg`（0.43 MiB）。

`project.config.json` 的 `packOptions.ignore` 排除上述三项。微信开发者工具预览、上传时应用该配置，编译输出目录仍保留源文件副本，不能直接用整个目录大小判断实际包大小。

- 小程序字体已有 HTTPS 加载逻辑，贴纸头像由 `defaultAvatar.js` 转换为云端地址。
- TabBar 使用 PNG 暗色图标，没有使用 `road-dark.svg`。
- App/H5 的本地资源保留；App 字体路径、页面注册和字体文件不变。
- 不要删除源目录 `static/fonts`，App 必须将其打入安装包。
- `npm run build:mp-weixin` 结束后自动运行包体积检查；也可单独执行 `npm run check:mp-size`。
- 检查脚本按生成的分包和打包排除配置计算未压缩体积，主包或任一分包超过 2 MiB 时失败。最终大小以开发者工具为准。

配置机制参考：[微信官方 miniprogram-slim 打包排除说明](https://github.com/wechat-miniprogram/miniprogram-slim/blob/master/docs/deps.md)。
