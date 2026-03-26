# 字体系统完整指南

## 概述

本文档整合了回车键项目的字体系统实现、使用策略和跨平台测试指南。

## 设计原则

**只在诗歌内容区域使用汇文明朝字体，其他地方使用系统默认字体**

这样做的好处：
1. 突出诗歌内容的特殊性和艺术感
2. 保持界面其他部分的现代感和可读性
3. 减少字体加载对性能的影响
4. 符合用户对不同内容区域的视觉预期

---

## 已完成的工作

### 1. 字体使用策略
- **诗歌内容**: 使用汇文明朝字体（明朝体，优雅有笔锋）
- **其他界面**: 使用系统默认字体（黑体，现代简洁）

### 2. 平台差异化处理

#### 小程序
- 从云端下载字体: `cloud://cloud1-5gb0pbyl400845f5.636c-cloud1-5gb0pbyl400845f5-1378788263/fonts/Huiwen-mincho-compressed.woff2`
- 首次启动: 使用系统字体 → 1-2秒后切换到汇文明朝
- 后续启动: 直接使用已缓存的汇文明朝字体
- 包大小: 0 KB（不占用小程序包）

#### App
- 本地打包: `/static/fonts/Huiwen-mincho-compressed.woff2`
- 启动即可使用汇文明朝字体
- 包大小: +15 KB

#### H5
- 本地打包: `/static/fonts/Huiwen-mincho-compressed.woff2`
- 启动即可使用汇文明朝字体
- 包大小: +15 KB

### 3. 修改的文件

#### 核心配置
- `utils/fontManager.js` - 字体管理器，配置汇文明朝从云端下载
- `App.vue` - 全局字体声明（仅声明，不全局应用）
- `uni.scss` - 移除全局字体变量

#### 页面样式清理
- `pages/poem-square/poem-square.vue` - 只在诗歌内容使用汇文明朝
- `pages/mountain/mountain.vue` - 只在诗歌内容使用汇文明朝
- `pages/post-detail/post-detail.vue` - 只在诗歌内容使用汇文明朝
- `pages/preview/preview.vue` - 只在诗歌内容使用汇文明朝
- `pages-content/portfolio-detail/portfolio-detail.vue` - 只在诗歌内容使用汇文明朝
- `pages-content/other-portfolio/other-portfolio.vue` - 只在诗歌内容使用汇文明朝
- `components/ShareModal.vue` - 分享卡片使用汇文明朝

---

## 字体应用范围

### 使用汇文明朝的地方

1. **诗歌内容** (`.post-content`)
   - poem-square（诗歌广场）
   - mountain（山）
   - post-detail（帖子详情）
   - preview（预览页面）
   - portfolio-detail（作品集详情）
   - other-portfolio（他人作品集）

2. **组诗副标题** (`.series-subtitle`)
   - 所有显示组诗的页面

3. **分享卡片生成**
   - Canvas 绘制的分享图片
   - ShareModal 组件

### 使用系统默认字体的地方

1. **导航栏和标题栏**
   - top-bar（顶部栏）
   - 页面标题
   - 返回按钮

2. **按钮和交互元素**
   - 点赞按钮
   - 评论按钮
   - 分享按钮
   - 收藏按钮

3. **表单和输入框**
   - 登录/注册表单
   - 评论输入框
   - 搜索框

4. **列表和卡片元数据**
   - 作者名称
   - 发布时间
   - 点赞数
   - 评论数

5. **提示和说明文字**
   - Toast 提示
   - Modal 对话框
   - 空状态提示
   - 加载提示

---

## 技术实现

### 1. 全局字体声明（App.vue）

```css
/* 只声明字体，不全局应用 */
/* #ifndef MP-WEIXIN */
@font-face {
  font-family: 'Huiwen-mincho';
  src: url('/static/fonts/Huiwen-mincho-compressed.woff2') format('woff2');
  font-weight: normal;
  font-style: normal;
  font-display: swap;
}
/* #endif */
```

### 2. 诗歌内容样式

```css
/* 只在诗歌内容区域应用汇文明朝 */
.post-content {
  font-family: '汇文明朝', -apple-system, BlinkMacSystemFont, 
               'Segoe UI', 'PingFang SC', 'Hiragino Sans GB', 
               'Microsoft YaHei', sans-serif;
  font-style: normal;
  font-weight: 500;
  font-size: 28rpx;
  line-height: 38rpx;
}

.series-subtitle {
  font-family: '汇文明朝', -apple-system, BlinkMacSystemFont, 
               'Segoe UI', 'PingFang SC', 'Hiragino Sans GB', 
               'Microsoft YaHei', sans-serif;
  font-size: 24rpx;
  font-weight: 600;
}
```

### 3. 系统默认字体（其他地方）

```css
/* 不指定 font-family，使用系统默认 */
.button {
  /* 自动使用系统默认字体 */
}

/* 或者显式指定系统字体栈 */
.title {
  font-family: -apple-system, BlinkMacSystemFont, 
               'Segoe UI', 'PingFang SC', 'Hiragino Sans GB', 
               'Microsoft YaHei', sans-serif;
}
```

---

## 字体预加载策略

### 小程序环境

```javascript
// App.vue onLaunch
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

### App/H5 环境

不需要预加载，字体文件已打包在应用中，通过 `@font-face` 自动加载。

---

## 跨平台测试

### 测试目标
验证汇文明朝字体在小程序、App、H5 三个平台上都能正常显示。

### 平台差异

| 平台 | 字体来源 | 注册方式 | CSS使用 | 启动体验 |
|------|---------|---------|---------|---------|
| 小程序 | 远程源（`woff2`） | `uni.loadFontFace` | `font-family: '汇文明朝'` | 首次使用系统字体→注册完成后切换 |
| App | 本地源（`woff2`） | `@font-face` + `uni.loadFontFace` | `font-family: '汇文明朝', 'Huiwen-mincho'` | 启动即注册 |
| H5 | 本地打包 | `@font-face` | `font-family: 'Huiwen-mincho', '汇文明朝'` | 立即显示汇文明朝 |

### 测试步骤

#### 1. 小程序测试

```bash
# 编译小程序
npm run dev:mp-weixin

# 在微信开发者工具中打开
```

**测试点：**
- [ ] 首次启动时，诗歌内容使用系统默认字体
- [ ] 控制台显示字体下载进度
- [ ] 下载完成后，诗歌内容自动切换到汇文明朝
- [ ] 仅请求 `woff2` 字体资源
- [ ] 再次点击字体选择器时，不会因为旧状态误判“已加载”
- [ ] 分享卡片导出前会等待字体注册完成，失败时仅本次回退系统字体
- [ ] 访问 `pages/test-font-loading` 查看字体状态

**验证页面：**
- poem-square（诗歌广场）
- post-detail（帖子详情）
- preview（预览页面）
- portfolio-detail（作品集详情）

#### 2. App 测试

```bash
# 编译 App
npm run dev:app-plus

# 在 HBuilderX 中运行到手机/模拟器
```

**测试点：**
- [ ] 启动时立即显示汇文明朝字体
- [ ] 无需等待下载
- [ ] 所有诗歌内容都使用汇文明朝字体

#### 3. H5 测试

```bash
# 编译 H5
npm run dev:h5

# 在浏览器中打开 http://localhost:8080
```

**测试点：**
- [ ] 启动时立即显示汇文明朝字体
- [ ] 无需等待下载
- [ ] 所有诗歌内容都使用汇文明朝字体
- [ ] 浏览器开发者工具 Network 面板显示字体文件已加载

---

## 字体显示特征

### 汇文明朝字体特征
- 明朝体风格，笔画优雅
- 横细竖粗，有明显的笔锋
- 字形端正，适合诗歌排版

### 系统默认字体特征
- 黑体风格，笔画均匀
- 无明显笔锋
- 字形较为现代

---

## 故障排查

### 小程序字体未生效

1. **检查下载状态**
   ```javascript
   // 在控制台执行
   const isCached = await fontManager.isFontCached('汇文明朝');
   console.log('字体已缓存:', isCached);
   ```

2. **检查字体加载**
   ```javascript
   // 在控制台执行
   console.log('已加载字体:', fontManager.loadedFonts);
   ```

3. **手动触发下载**
   - 访问 `pages/test-font-loading`
   - 点击"重新加载字体"按钮

4. **清除缓存重试**
   - 访问 `pages/test-font-loading`
   - 点击"清除缓存"按钮
   - 重启小程序

### App/H5 字体未生效

1. **检查字体文件是否存在**
   ```bash
   ls -la static/fonts/Huiwen-mincho-compressed.woff2
   ```

2. **检查编译输出**
   - 确认字体文件被正确打包到 `unpackage/dist/` 目录

3. **检查浏览器控制台**（H5）
   - 查看是否有字体加载错误
   - 检查 Network 面板中字体文件的加载状态

4. **检查 CSS**
   - 确认 `@font-face` 规则存在
   - 确认 `font-family` 属性正确设置

---

## 性能对比

| 平台 | 首次启动 | 字体加载时间 | 包大小影响 | 后续启动 |
|------|---------|------------|-----------|---------|
| 小程序 | 系统字体 | ~1-2秒 | 0 KB | 汇文明朝 |
| App | 汇文明朝 | 0秒（已打包） | +15 KB | 汇文明朝 |
| H5 | 汇文明朝 | ~100ms | +15 KB | 汇文明朝 |

---

## 维护指南

### 添加新的诗歌展示页面

1. 不要在页面中重复声明 `@font-face`（App.vue 已全局声明）
2. 只在诗歌内容区域使用汇文明朝：

```css
.post-content {
  font-family: '汇文明朝', -apple-system, BlinkMacSystemFont, 
               'Segoe UI', 'PingFang SC', 'Hiragino Sans GB', 
               'Microsoft YaHei', sans-serif;
}
```

3. 其他元素不指定 font-family，或使用系统字体栈

### 修改字体

如果需要更换字体：

1. 更新 `fontManager.js` 中的字体配置
2. 更新 App.vue 中的 `@font-face` 声明
3. 更新云存储中的字体文件
4. 清除小程序缓存重新测试

---

## 降级方案

所有平台都有完善的降级方案：

```css
font-family: '汇文明朝',           /* 优先使用汇文明朝 */
             -apple-system,        /* iOS 系统字体 */
             BlinkMacSystemFont,   /* macOS 系统字体 */
             'Segoe UI',           /* Windows 系统字体 */
             'PingFang SC',        /* 中文黑体 */
             'Hiragino Sans GB',   /* 中文黑体 */
             'Microsoft YaHei',    /* 微软雅黑 */
             sans-serif;           /* 通用无衬线字体 */
```

如果汇文明朝加载失败，会自动使用系统字体，不影响正常使用。

---

## 优势总结

1. **包大小优化**: 小程序不占用包大小
2. **用户体验**: 诗歌内容更有艺术感
3. **性能优化**: 按需加载，不影响首屏
4. **降级保护**: 加载失败时自动使用系统字体
5. **跨平台兼容**: 三端统一体验
6. **维护简单**: 字体配置集中管理

---

*最后更新: 2026-03-07*
