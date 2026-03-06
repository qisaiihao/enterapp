# 云端字体加载方案

## 概述

本项目使用云端字体加载方案，规避小程序包大小限制，同时保证用户体验。

## 方案特点

### 1. 平台差异化处理

- **小程序**: 从云端下载字体到本地缓存
- **App**: 使用打包在应用内的本地字体文件
- **H5**: 使用打包在项目中的本地字体文件

### 2. 渐进式加载

- **首次启动**: 使用微信默认字体显示内容
- **后台下载**: 自动从云端下载汇文明朝字体
- **下载完成**: 自动切换到汇文明朝字体
- **后续启动**: 直接使用已缓存的字体，无需再次下载

### 3. 优势

- ✅ 不占用小程序包大小
- ✅ 按需下载，节省流量
- ✅ 永久缓存，一次下载终身使用
- ✅ 降级方案，下载失败时使用系统字体
- ✅ 跨平台支持

## 技术实现

### 字体配置 (utils/fontManager.js)

```javascript
const FONT_CONFIG = {
    '汇文明朝': {
        displayName: '汇文明朝',
        filename: 'Huiwen-mincho.otf',
        cloudPath: 'cloud://cloud1-5gb0pbyl400845f5.636c-cloud1-5gb0pbyl400845f5-1378788263/fonts/Huiwen-mincho.otf',
        size: 15400,
        version: '1.0.0',
        // 小程序从云端下载，App/H5 使用本地文件
        isDefault: platformDetector.getCurrentPlatform() !== 'mp-weixin'
    }
};
```

### 预加载逻辑 (App.vue)

```javascript
// 小程序环境：启动时自动下载字体
// #ifdef MP-WEIXIN
fontManager.ensureFontAvailable('汇文明朝', (progress) => {
    console.log(`字体下载进度: ${progress}%`);
}).then(() => {
    console.log('字体加载完成');
    // 触发全局事件通知页面刷新
    uni.$emit('font-loaded', { fontFamily: '汇文明朝' });
}).catch(err => {
    console.warn('字体加载失败，使用系统默认字体');
});
// #endif
```

### 全局字体应用 (App.vue)

```css
/* 全局应用汇文明朝字体 */
page {
  font-family: '汇文明朝', -apple-system, BlinkMacSystemFont, 
               'Segoe UI', 'PingFang SC', 'Hiragino Sans GB', 
               'Microsoft YaHei', sans-serif;
}
```

## 使用方法

### 1. 在页面中使用

字体会自动应用到所有文本，无需额外配置：

```vue
<template>
    <view>
        <text>这段文字会自动使用汇文明朝字体</text>
    </view>
</template>
```

### 2. 在 Canvas 中使用

```javascript
// 确保字体已加载
await fontManager.ensureFontAvailable('汇文明朝');

// 使用字体绘制
const ctx = uni.createCanvasContext('myCanvas');
ctx.font = '32px 汇文明朝';
ctx.fillText('春江潮水连海平', 0, 0);
ctx.draw();
```

### 3. 监听字体加载完成

```javascript
// 在页面的 onLoad 或 mounted 中监听
uni.$on('font-loaded', (data) => {
    console.log('字体加载完成:', data.fontFamily);
    // 可以在这里刷新页面或重新渲染
    this.$forceUpdate();
});

// 记得在页面卸载时移除监听
onUnload() {
    uni.$off('font-loaded');
}
```

## 缓存管理

### 查看缓存状态

```javascript
const stats = fontManager.getCacheStats();
console.log('缓存统计:', stats);
// {
//   totalFonts: 6,
//   cachedFonts: 1,
//   loadedFonts: 1,
//   cacheSize: 15400,
//   cacheSizeFormatted: '15.04 KB'
// }
```

### 检查字体是否已缓存

```javascript
const isCached = await fontManager.isFontCached('汇文明朝');
console.log('字体已缓存:', isCached);
```

### 清除字体缓存

```javascript
// 清除单个字体
await fontManager.deleteFontCache('汇文明朝');

// 清除所有字体缓存
await fontManager.clearAllCache();
```

## 存储位置

### 小程序
- 路径: `wx.env.USER_DATA_PATH/fonts/`
- 特点: 永久存储，不会被清理

### App
- 路径: `_doc/fonts/`
- 特点: 应用私有目录，卸载时清除

### H5
- 存储: IndexedDB
- 特点: 浏览器本地存储，清除缓存时会被删除

## 性能优化

### 1. 预加载策略

- 在 App 启动时立即开始下载
- 不阻塞页面渲染
- 后台静默下载

### 2. 缓存策略

- 首次下载后永久缓存
- 版本控制，支持字体更新
- 自动清理过期缓存

### 3. 降级方案

- 下载失败时使用系统字体
- 不影响应用正常使用
- 下次启动自动重试

## 测试页面

访问 `pages/test-font-loading.vue` 可以测试字体加载功能：

- 查看字体加载状态
- 查看下载进度
- 对比默认字体和自定义字体
- 手动清除缓存测试

## 注意事项

1. **首次启动体验**: 用户首次启动小程序时，会短暂看到系统默认字体，这是正常现象
2. **网络依赖**: 首次下载需要网络连接，建议在 WiFi 环境下使用
3. **存储空间**: 字体文件约 15KB，对用户存储空间影响极小
4. **版本更新**: 如需更新字体，修改 `version` 字段即可触发重新下载

## 添加新字体

在 `fontManager.js` 的 `FONT_CONFIG` 中添加配置：

```javascript
'新字体名称': {
    displayName: '新字体名称',
    filename: 'new-font.ttf',
    cloudPath: 'cloud://your-env.../fonts/new-font.ttf',
    size: 2000000, // 字节
    version: '1.0.0',
    isDefault: platformDetector.getCurrentPlatform() !== 'mp-weixin'
}
```

然后在需要的地方使用：

```javascript
await fontManager.ensureFontAvailable('新字体名称');
```

## 故障排查

### 字体下载失败

1. 检查云存储文件是否存在
2. 检查云存储权限配置
3. 查看控制台错误日志
4. 确认网络连接正常

### 字体未生效

1. 确认字体已下载完成
2. 检查 CSS 中的 font-family 设置
3. 尝试强制刷新页面
4. 查看 fontManager.loadedFonts 是否包含该字体

### 缓存问题

1. 手动清除缓存重新下载
2. 检查存储空间是否充足
3. 确认小程序版本是否最新

## 相关文件

- `utils/fontManager.js` - 字体管理核心逻辑
- `App.vue` - 全局字体预加载
- `uni.scss` - 全局字体变量
- `pages/test-font-loading.vue` - 字体加载测试页面
