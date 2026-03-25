# 小程序汇文明朝字体配置说明

## 当前方案

### 1. 字体配置更新（`utils/fontManager.js`）

`汇文明朝` 现在同时保留旧字段 `mpWeixinUrl`，并新增有序候选源 `mpWeixinSources`：

```javascript
'汇文明朝': {
    displayName: '汇文明朝',
    filename: 'Huiwen-mincho-compressed.woff2',
    cloudPath: 'cloud://cloud1-5gb0pbyl400845f5.636c-cloud1-5gb0pbyl400845f5-1378788263/fonts/Huiwen-mincho-compressed.woff2',
    mpWeixinUrl: 'https://636c-cloud1-5gb0pbyl400845f5-1378788263.tcb.qcloud.la/fonts/Huiwen-mincho-compressed.woff2',
    mpWeixinSources: [
        { url: 'https://636c-cloud1-5gb0pbyl400845f5-1378788263.tcb.qcloud.la/fonts/Huiwen-mincho-compressed.woff2', format: 'woff2' },
        { url: 'https://636c-cloud1-5gb0pbyl400845f5-1378788263.tcb.qcloud.la/fonts/Huiwen-mincho-compressed.woff', format: 'woff' },
        { url: 'https://636c-cloud1-5gb0pbyl400845f5-1378788263.tcb.qcloud.la/fonts/Huiwen-mincho-compressed.ttf', format: 'ttf' }
    ],
    version: '1.2.0',
    isDefault: platformDetector.getCurrentPlatform() !== 'mp-weixin'
}
```

### 2. 小程序端加载语义

- 小程序端不再把“远程 URL 已记录”视为“已缓存”。
- `isCached` 现在只表示真实持久缓存；`汇文明朝` 在小程序端是否可用以 `isLoaded` 为准。
- `ensureFontAvailable()` 会按 `woff2 -> woff -> ttf` 顺序调用 `uni.loadFontFace`。
- 任一候选源超时或失败后只会触发重试/切换候选源，不会再把失败状态写入 `loadedFonts`。

### 3. 启动预注册

- `App.vue` 仍会在 `onLaunch` 预加载 `汇文明朝`。
- 这里的语义改为“预注册字体”，不是“离线缓存到本地”。
- 小程序重启后仍会重新注册字体，但不会因为旧状态脏数据而误判“已经加载”。

## 云端资源要求

请在当前 `fonts/` 云存储目录同时放置以下三个文件：

- `Huiwen-mincho-compressed.woff2`
- `Huiwen-mincho-compressed.woff`
- `Huiwen-mincho-compressed.ttf`

同时确认字体资源响应头满足：

- `Access-Control-Allow-Origin: *`
- `Content-Type` 与文件格式匹配（`font/woff2`、`font/woff`、`font/ttf` 或等价值）

## 页面与分享卡片行为

- 诗歌正文页：默认字体预注册完成后自动切换为 `汇文明朝`。
- 字体选择器：状态文案改为“已加载 / 待加载”，失败后允许再次点击重试。
- 分享卡片：绘制前会先等待字体可用；若全部候选源失败，仅本次导出回退 `sans-serif`。

## 验证建议

1. 冷启动小程序，进入诗歌详情页，确认正文稍后自动切换到 `汇文明朝`。
2. 手动让首个 `woff2` 源失败，确认仍会继续尝试 `woff` 或 `ttf`。
3. 打开字体选择器，确认 `汇文明朝` 状态显示为“待加载 / 已加载”。
4. 立即生成分享卡片，确认排版使用目标字体，失败时只影响当前导出。
