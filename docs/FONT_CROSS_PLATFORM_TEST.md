# 字体跨平台兼容性测试

## 测试目标
验证汇文明朝字体在小程序、App、H5 三个平台上都能正常显示。

## 平台差异

### 小程序
- **字体来源**: 云端下载
- **注册方式**: `uni.loadFontFace({ family: '汇文明朝', source: 'wxfile://...' })`
- **CSS 使用**: `font-family: '汇文明朝'`
- **首次启动**: 使用系统默认字体 → 下载完成后切换到汇文明朝

### App
- **字体来源**: 本地打包 `/static/fonts/Huiwen-mincho.otf`
- **注册方式**: `@font-face { font-family: 'Huiwen-mincho'; src: url(...) }`
- **CSS 使用**: `font-family: '汇文明朝', 'Huiwen-mincho'`（两个名称都支持）
- **启动体验**: 立即显示汇文明朝字体

### H5
- **字体来源**: 本地打包 `/static/fonts/Huiwen-mincho.otf`
- **注册方式**: `@font-face { font-family: 'Huiwen-mincho'; src: url(...) }`
- **CSS 使用**: `font-family: 'Huiwen-mincho', '汇文明朝'`（两个名称都支持）
- **启动体验**: 立即显示汇文明朝字体

## 测试步骤

### 1. 小程序测试

```bash
# 编译小程序
npm run dev:mp-weixin

# 在微信开发者工具中打开
```

**测试点：**
- [ ] 首次启动时，诗歌内容使用系统默认字体
- [ ] 控制台显示字体下载进度
- [ ] 下载完成后，诗歌内容自动切换到汇文明朝
- [ ] 再次启动时，直接使用汇文明朝字体（无需下载）
- [ ] 访问 `pages/test-font-loading` 查看字体状态

**验证页面：**
- poem-square（诗歌广场）
- post-detail（帖子详情）
- preview（预览页面）
- portfolio-detail（作品集详情）

### 2. App 测试

```bash
# 编译 App
npm run dev:app-plus

# 在 HBuilderX 中运行到手机/模拟器
```

**测试点：**
- [ ] 启动时立即显示汇文明朝字体
- [ ] 无需等待下载
- [ ] 所有诗歌内容都使用汇文明朝字体

**验证页面：**
- poem-square（诗歌广场）
- post-detail（帖子详情）
- preview（预览页面）
- portfolio-detail（作品集详情）

### 3. H5 测试

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

**验证页面：**
- poem-square（诗歌广场）
- post-detail（帖子详情）
- preview（预览页面）
- portfolio-detail（作品集详情）

## 字体显示特征

### 汇文明朝字体特征
- 明朝体风格，笔画优雅
- 横细竖粗，有明显的笔锋
- 字形端正，适合诗歌排版

### 系统默认字体特征
- 黑体风格，笔画均匀
- 无明显笔锋
- 字形较为现代

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
   ls -la static/fonts/Huiwen-mincho.otf
   ```

2. **检查编译输出**
   - 确认字体文件被正确打包到 `unpackage/dist/` 目录

3. **检查浏览器控制台**（H5）
   - 查看是否有字体加载错误
   - 检查 Network 面板中字体文件的加载状态

4. **检查 CSS**
   - 确认 `@font-face` 规则存在
   - 确认 `font-family` 属性正确设置

## 性能对比

| 平台 | 首次启动 | 字体加载时间 | 包大小影响 |
|------|---------|------------|-----------|
| 小程序 | 系统字体 | ~1-2秒 | 0 KB |
| App | 汇文明朝 | 0秒（已打包） | +15 KB |
| H5 | 汇文明朝 | ~100ms | +15 KB |

## 预期结果

### 小程序
- ✅ 首次启动使用系统字体，1-2秒后切换到汇文明朝
- ✅ 后续启动直接使用汇文明朝
- ✅ 不占用小程序包大小

### App
- ✅ 启动即显示汇文明朝字体
- ✅ 无需等待下载
- ✅ 包大小增加约 15KB（可接受）

### H5
- ✅ 启动即显示汇文明朝字体
- ✅ 字体文件缓存在浏览器中
- ✅ 后续访问无需重新下载

## 回退方案

如果字体加载失败，所有平台都会自动回退到系统字体：

```css
font-family: '汇文明朝', -apple-system, BlinkMacSystemFont, 
             'Segoe UI', 'PingFang SC', 'Hiragino Sans GB', 
             'Microsoft YaHei', sans-serif;
```

这确保了即使字体加载失败，应用仍然可以正常使用。

## 总结

- **小程序**: 云端下载，首次启动有短暂延迟，但不占用包大小
- **App/H5**: 本地打包，启动即可使用，包大小增加可忽略
- **兼容性**: 所有平台都有完善的降级方案，不会影响正常使用
- **用户体验**: 小程序首次启动有1-2秒的字体切换，后续启动体验一致
