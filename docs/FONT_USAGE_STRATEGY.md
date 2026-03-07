# 字体使用策略

## 设计原则

**只在诗歌内容区域使用汇文明朝字体，其他地方使用系统默认字体**

这样做的好处：
1. 突出诗歌内容的特殊性和艺术感
2. 保持界面其他部分的现代感和可读性
3. 减少字体加载对性能的影响
4. 符合用户对不同内容区域的视觉预期

## 字体应用范围

### ✅ 使用汇文明朝的地方

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

### ❌ 使用系统默认字体的地方

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

## 技术实现

### 1. 全局字体声明（App.vue）

```css
/* 只声明字体，不全局应用 */
/* #ifndef MP-WEIXIN */
@font-face {
  font-family: 'Huiwen-mincho';
  src: url('/static/fonts/Huiwen-mincho.otf') format('opentype');
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

## 平台差异处理

### 小程序
- 启动时从云端下载汇文明朝字体
- 使用 `uni.loadFontFace` 注册为 `'汇文明朝'`
- 下载前诗歌内容使用系统默认字体
- 下载后自动切换到汇文明朝

### App
- 字体文件打包在 `/static/fonts/Huiwen-mincho.otf`
- 通过 `@font-face` 注册为 `'Huiwen-mincho'`
- CSS 中使用 `'汇文明朝', 'Huiwen-mincho'` 作为 fallback
- 启动即可使用

### H5
- 字体文件打包在项目中
- 通过 `@font-face` 注册为 `'Huiwen-mincho'`
- CSS 中使用 `'汇文明朝', 'Huiwen-mincho'` 作为 fallback
- 启动即可使用

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

## 样式文件组织

```
styles/
  └── poem-content.scss    # 诗歌内容专用样式（可选）

pages/
  ├── poem-square/
  │   └── poem-square.vue  # 只在 .post-content 中使用汇文明朝
  ├── mountain/
  │   └── mountain.vue     # 只在 .post-content 中使用汇文明朝
  └── post-detail/
      └── post-detail.vue  # 只在 .post-content 中使用汇文明朝

App.vue                    # 全局声明 @font-face，不全局应用
```

## 用户体验

### 小程序首次启动

```
用户打开小程序
    ↓
页面立即显示（诗歌使用系统字体）
    ↓
后台下载汇文明朝字体（1-2秒）
    ↓
下载完成，诗歌内容自动切换到汇文明朝
    ↓
其他界面元素保持系统字体不变
```

### 小程序后续启动

```
用户打开小程序
    ↓
页面立即显示（诗歌直接使用汇文明朝）
    ↓
其他界面元素使用系统字体
```

### App/H5

```
用户打开应用
    ↓
页面立即显示（诗歌使用汇文明朝）
    ↓
其他界面元素使用系统字体
```

## 视觉对比

### 诗歌内容区域
```
春江潮水连海平，海上明月共潮生
滟滟随波千万里，何处春江无月明
```
**字体**: 汇文明朝（明朝体，笔画优雅，有笔锋）

### 界面其他部分
```
点赞  评论  分享
作者：李白  发布于 2小时前
```
**字体**: 系统默认（黑体，笔画均匀，现代感）

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

## 性能优化

1. **按需加载**: 只在需要显示诗歌的页面才加载字体
2. **缓存策略**: 小程序首次下载后永久缓存
3. **降级方案**: 字体加载失败时自动使用系统字体
4. **font-display**: 使用 `swap` 策略，避免文字闪烁

## 测试清单

- [ ] 小程序首次启动，诗歌内容先显示系统字体
- [ ] 小程序字体下载完成后，诗歌内容切换到汇文明朝
- [ ] 小程序后续启动，诗歌内容直接显示汇文明朝
- [ ] App 启动时，诗歌内容直接显示汇文明朝
- [ ] H5 启动时，诗歌内容直接显示汇文明朝
- [ ] 所有平台的按钮、标题、表单等使用系统默认字体
- [ ] 字体加载失败时，诗歌内容能正常显示（使用系统字体）
- [ ] 分享卡片生成时使用汇文明朝字体

## 相关文件

- `App.vue` - 全局字体声明
- `utils/fontManager.js` - 字体管理器
- `styles/poem-content.scss` - 诗歌内容样式（可选）
- `README_FONT_CLOUD.md` - 云端字体加载方案
- `FONT_CROSS_PLATFORM_TEST.md` - 跨平台测试指南
