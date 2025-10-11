## 可复用与去重复改造方案

目标：收敛分散的通用逻辑，统一口径、减少重复代码、提升可维护性与跨端一致性。

### 1) 统一云函数调用入口（utils/cloudCall.js）
- 导出：`cloudCall(name, data, { pageTag, retry })`
  - 自动注入 openid（调用 `auth.getOpenId()`）
  - 平台检测整合（替代页面内的 callCloudFunction 与 platformDetector 直接引用）
  - 统一错误处理（NO_OPENID、网络错误）、可配置重试与埋点
  - 日志前缀：使用传入的 `pageTag` 形成统一日志
- 替换位置（示例）：
  - pages/index/index.vue、pages/poem/poem.vue、pages/tag-filter/tag-filter.vue、pages/my-likes/my-likes.vue、pages/favorite-content/favorite-content.vue 等

### 2) 统一鉴权与登录等待（utils/auth.js）
- 导出：
  - `getOpenId()`：优先 globalData，其次本地缓存（userOpenId/openid），必要时触发匿名/正式登录；回填 globalData
  - `waitLoginCompleted({ timeout=5000 })`：带超时的登录完成等待
  - `setLoginState(userInfo, openid)`：合并 _openid、写缓存与标志位
  - `restoreFromCache()`：应用启动/登录页进入时恢复登录
- 使用点：main.js、App.vue、登录页与所有首屏数据加载页面

### 3) 统一图片预览（utils/imagePreview.js 或 mixins/imagePreview.js）
- 导出：`previewImage({ current, urls, fallbackToast=true })`
- 特性：dataset 解析防空、统一错误 toast、可加入埋点
- 替换位置：
  - pages/my-likes/my-likes.vue:275
  - pages/profile/profile.vue:1009
  - pages/index/index.vue:623
  - pages/favorite-content/favorite-content.vue:480
  - pages/post-detail/post-detail.vue:681

### 4) 统一时间格式化（扩展 utils/time.js）
- 新增：`formatRelativeTime(date)`, `formatDate(date, pattern)`, `formatTimeAgo(date)`（保留）
- 替换位置：
  - pages/profile/profile.vue:820
  - pages/my-likes/my-likes.vue:373
  - pages/fans/fans.vue:266
  - pages/feedback-admin/feedback-admin.vue:305

### 5) 帖子数据归一化（utils/postNormalizer.js）
- 导出：`normalizePostList(posts, { withTime=true })`
  - 处理 imageUrls/originalImageUrls 数组化
  - 默认头像/昵称、占位样式（imageStyle）
  - 时间字段格式化（依赖 utils/time.js）
- 替换位置：
  - pages/index/index.vue:897-909
  - pages/tag-filter/tag-filter.vue:262-267
  - pages/search/search.vue:330-335
  - pages/my-likes/my-likes.vue:222-236

### 6) 多图高度与裁剪（mixins/postGallery.js）
- 提供：
  - `onImageLoad(e)`：缓存尺寸、计算 swiperHeights/单图钳制
  - 内部封装 selectorQuery 与 setData 更新键名
- 替换位置：
  - pages/index/index.vue（现有 onImageLoad 与钳制逻辑）
  - pages/my-likes/my-likes.vue:315-348
  - pages/profile/profile.vue 等涉及多图场景

### 7) 分页与刷新（mixins/pagination.js）
- 提供：`initPagination(loader)`, `loadNext()`, `refresh()`
  - 内部管理 page/hasMore/isLoading/isLoadingMore 状态
  - onPullDownRefresh/onReachBottom 统一对接
- 替换位置：
  - pages/tag-filter/tag-filter.vue:133-179
  - pages/my-likes/my-likes.vue:204-214
  - pages/favorite-content/favorite-content.vue:273-286

### 8) 点赞服务（utils/likeService.js）
- 导出：`togglePostLike(postId)`
  - 页面内做乐观更新时，委托服务返回服务端权威 votes/isLiked
  - 同步 dataCache（如有），统一回滚/提示
- 使用点：列表与详情页的点赞入口

### 9) 目录结构建议
```
utils/
  auth.js           // 统一 openid 恢复/等待/设置
  cloudCall.js      // 统一云函数调用入口
  imagePreview.js   // 统一图片预览
  postNormalizer.js // 帖子归一化
  likeService.js    // 点赞服务
  time.js           // 扩展时间工具
mixins/
  pagination.js     // 分页
  postGallery.js    // 多图高度/裁剪
```

### 10) 迁移顺序（建议）
1. 落地 utils/auth.js 与 utils/cloudCall.js（不改业务行为，仅替换调用）
2. 收敛首屏数据加载：用 `auth.waitLoginCompleted()`，用 `cloudCall`
3. 替换预览与时间格式化（imagePreview/time）
4. 引入 postNormalizer，统一列表处理
5. 上线 pagination 与 postGallery mixin，逐页替换
6. 收尾：likeService 接管点赞；统一日志与常量

### 11) 风险与回滚
- 每步替换保持小粒度 PR，功能对齐原逻辑；失败可单页回滚
- 先从影响面小的页面试点（如 tag-filter），验证后推广

### 12) 衡量收益
- 重复代码减少（预计相关页面 20%+），跨端行为更一致；
- 登录态与云函数调用问题集中到工具层修复；
- 后续调试仅开关工具层日志即可全局观测。

### 最新进展（2025-10-08）
- `mixins/pagination.js` 已实现并接入 `pages/tag-filter/tag-filter.vue`、`pages/my-likes/my-likes.vue`、`pages/favorite-content/favorite-content.vue`，统一处理 `initPagination`、`loadNext`、`refresh`、触底与下拉刷新逻辑。
- 新增 `utils/likeService.js`，在 `pages/index/index.vue` 与 `pages/post-detail/post-detail.vue` 上线 `togglePostLike`，统一云函数调用、回滚与缓存同步。

### 最新进展（2025-10-09）
- `utils/imagePreview.js` 已在首页、收藏、详情、用户主页等所有目标页面落地，页面不再直接调用 `uni.previewImage`。
- `utils/postNormalizer.js` 整合帖子字段处理，在首页、点赞、收藏、标签、搜索等列表统一使用。
- 新增 `utils/cloudCall.js`，统一云函数调用/错误处理，并在页面、组件与工具层替换原有 `callCloudFunction` 分支逻辑。
- `mixins/postGallery.js` 建立图片高度与裁剪共用逻辑，首页、点赞、收藏、个人主页、详情、诗歌/山诗等页面已接入，移除重复的 `onImageLoad` 代码。


