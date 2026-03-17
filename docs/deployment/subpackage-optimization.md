# 分包优化记录

## 优化时间
2026-03-16

## 优化目标
减少主包体积，提升首屏加载速度

## 优化内容

### 1. 新建分包

#### pages-publish (发布相关)
将发布相关的大体积页面移到独立分包：
- `pages-publish/add/add.vue` (133 KB) - 发布页面
- `pages-publish/preview/preview.vue` (62 KB) - 预览页面
- `pages-publish/series-compose/series-compose.vue` (7 KB) - 组诗合成

#### pages-debug (调试测试)
将开发测试页面移到独立分包：
- `pages-debug/test-direct-download/test-direct-download.vue` - 字体加载测试
- `pages-debug/test-domain-config/test-domain-config.vue` - 域名配置测试
- `pages-debug/test-cloud-storage/test-cloud-storage.vue` - 云存储测试

### 2. 主包优化效果

**优化前：**
- 主包页面：26 个文件，805.65 KB

**优化后：**
- 主包页面：14 个文件，577.69 KB
- 减少：12 个文件，约 228 KB

**新增分包：**
- pages-publish：9 个文件，202.55 KB
- pages-debug：3 个文件，25.43 KB

### 3. 预加载配置

为提升用户体验，添加了分包预加载规则：

```json
{
  "pages/poem-square/poem-square": {
    "network": "all",
    "packages": ["pages-tools", "pages-content", "pages-publish"]
  },
  "pages/mountain/mountain": {
    "network": "all",
    "packages": ["pages-publish"]
  }
}
```

- 从诗歌广场和山页面进入时，预加载发布分包
- 用户点击发布按钮时可以立即打开，无需等待

### 4. 路径更新

更新了所有跳转到移动页面的路径：

**发布页面：**
- `components/top-bar/top-bar.vue`
- `pages-content/draft-box/draft-box.vue`
- `pages/profile/profile.vue`
- `pages-admin/activity-posts/activity-posts.vue`

**预览页面：**
- `pages-publish/add/add.vue`

**组诗合成：**
- `pages/profile/profile.vue`

## 预期收益

1. **首屏加载速度提升**：主包减少 28%，首次启动更快
2. **按需加载**：发布功能仅在需要时加载，节省流量
3. **开发体验优化**：测试页面独立分包，不影响生产环境体积

## 注意事项

1. 所有跳转到 `pages/add`、`pages/preview`、`pages/series-compose` 的路径已更新为分包路径
2. 预加载配置确保用户体验不受影响
3. 测试页面仅在开发环境使用，生产环境可考虑移除 pages-debug 分包

## 后续优化建议

1. 考虑将大体积组件也按需加载（如发布页的各种 Modal 组件）
2. 分析 components 目录，将特定场景组件移到对应分包
3. 监控分包大小，避免单个分包超过 2MB 限制
