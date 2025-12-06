# 项目优化建议

> 生成时间：2025-12-06

## 1. 首页组件拆分（最高优先级）

`pages/index/index.vue` 有 **2264 行**，建议拆分：

| 当前问题 | 建议方案 |
|---------|---------|
| 首页、关注页、讨论页逻辑混杂 | 每个 Tab 页提取为独立组件 `<HomeTab>`, `<FollowingTab>`, `<DiscussionTab>` |
| 相似的数据加载逻辑重复3次 | 提取 `usePostList` composable 或 mixin 统一处理 |
| swiper 切换逻辑复杂 | 抽取 `useSwiperTabs` hook |

**示例结构：**
```
pages/index/
├── index.vue          # 只保留 swiper 容器和 tab 控制
├── components/
│   ├── HomeTab.vue
│   ├── FollowingTab.vue
│   └── DiscussionTab.vue
└── composables/
    └── usePostList.js  # 统一的列表加载逻辑
```

---

## 2. 动态 require 改为顶部 import ✅ 已完成

**问题**：多处在方法内部动态引入模块，增加运行时开销

**解决方案**：统一移到文件顶部

**已修复的文件（2025-12-06）**：
- `pages/index/index.vue` - 18处 require → import
- `pages/post-detail/post-detail.vue` - 29处 require → import  
- `pages/profile/profile.vue` - 10处 require → import
- `pages/add/add.vue` - 11处 require → import
- `pages/preview/preview.vue` - 7处 require → import
- `pages/poem-square/poem-square.vue` - 8处 require → import
- `pages/mountain/mountain.vue` - 6处 require → import
- `pages/splash/splash.vue` - 3处 require → import
- `pages/register/register.vue` - 2处 require → import
- `pages/login/login.vue` - 1处 require → import

**总计**：约 95 处动态 require 全部转换为顶部静态 import

---

## 3. 减少重复的数据处理逻辑 ✅ 已完成

**问题**：每个列表加载都重复执行相同处理逻辑（标准化、点赞图标、URL转换、预热）

**解决方案**：创建统一的处理函数 `utils/postProcessor.js`

```javascript
// 使用方式
import { processPostList } from '@/utils/postProcessor.js';

// 基本用法
const posts = await processPostList(postsRaw);

// 使用缓存的点赞状态（关注页等场景）
const posts = await processPostList(postsRaw, { useCachedLikeStatus: true });
```

**已替换的位置（2025-12-06）**：
- `pages/index/index.vue`:
  - `getIndexData` 的 SWR 回调和主流程（2处）
  - `getPostList` 的处理逻辑（1处）
  - `loadRecommendationPosts` 的处理逻辑（1处）
  - `loadDiscussionPosts` 的 SWR 回调和主流程（2处）
  - `loadFollowingPosts` 的 SWR 回调和主流程（2处）

**优化效果**：
- 减少约 **150 行**重复代码
- 统一的处理逻辑，易于维护和扩展
- 支持可选的缓存点赞状态功能

---

## 4. 批量 setData 优化 ✅ 已完成

**问题**：多处连续调用 `setData`

**解决方案**：合并为单次调用，减少渲染次数

**已修复的位置（2025-12-06）**：
- `pages/index/index.vue`:
  - `onSwiperChange` - 3次→1次
  - `onTabChange` - 4次→1次  
  - `onVote` - 2次→1次
- `pages/post-detail/post-detail.vue`:
  - `onVote` - 2次→1次
- `pages/poem-square/poem-square.vue`:
  - `onVote` - 2次→1次
- `pages/mountain/mountain.vue`:
  - `onVote` - 2次→1次

**优化效果**：减少约 10+ 次不必要的渲染，提升页面切换和点赞响应速度

---

## 5. 缓存管理器优化

**问题**：LRU 淘汰使用全排序，复杂度 O(n log n)

**建议**：使用双向链表实现真正的 O(1) LRU，或改用最小堆

---

## 6. 虚拟列表优化

当前 `FeedList` 渲染全量列表

**建议**：当列表超过 20 条时，使用虚拟列表只渲染可视区域

---

## 7. 图片懒加载增强

1. **预加载下一屏图片**：滚动到某条时预加载后续 3-5 条
2. **渐进式加载**：先显示模糊缩略图，再加载清晰图
3. **失败重试机制**：图片加载失败后自动重试 2-3 次

---

## 8. 点赞状态同步优化

**问题**：每次同步遍历所有列表的所有帖子

**建议**：
1. 使用 `Map` 索引替代数组遍历
2. 只同步当前可见页面的列表
3. 使用 `requestAnimationFrame` 批量更新 UI

---

## 9. 错误边界处理

**问题**：大量 `try-catch` 但只是 `console.error`

**建议**：
1. 添加全局错误上报（接入 Sentry 或自建）
2. 关键操作失败时显示用户友好提示
3. 网络错误提供重试按钮

---

## 10. 云函数调用优化

**建议合并请求**：
- 首次加载时，将首页、关注页、讨论页的第一页数据合并为一个云函数调用
- 减少冷启动次数和网络往返

**建议添加请求防抖**：
- 快速滑动时，取消未完成的过期请求
- 使用 `AbortController` 或请求 ID 机制

---

## 优先级排序

| 优先级 | 优化项 | 预期收益 | 状态 |
|--------|--------|----------|------|
| 🔴 P0 | 首页组件拆分 | 可维护性大幅提升 | 待处理 |
| 🔴 P0 | 动态 require 改顶部 import | 首屏加载加速 | ✅ 已完成 |
| 🟡 P1 | 批量 setData | 渲染性能提升 | ✅ 已完成 |
| 🟡 P1 | 重复数据处理抽取 | 代码简洁，减少 bug | ✅ 已完成 |
| 🟢 P2 | 虚拟列表 | 长列表性能提升 | 待处理 |
| 🟢 P2 | 点赞同步优化 | 减少卡顿 | 待处理 |
