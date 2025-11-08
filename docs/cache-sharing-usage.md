# 跨页面缓存共享使用说明

## 概述

项目已实现跨页面缓存共享机制，多个页面可以共享相同的帖子列表缓存，减少云函数调用，提升加载速度。

## 核心机制

### 1. 统一的命名空间
所有帖子列表相关的缓存都使用 `posts:list` 命名空间：
- `api-cache/home-posts.js` - 首页帖子列表
- `api-cache/post-list.js` - 通用帖子列表（mountain、poem-square、road 等页面）
- `api-cache/tag-posts.js` - 标签筛选帖子列表

### 2. 统一的缓存键构建
所有页面使用相同的 `buildCacheKey` 函数（位于 `api-cache/cache-key-builder.js`）来生成缓存键。

缓存键格式：`page:{page}:size:{pageSize}:{filterKey}`

其中 `filterKey` 根据查询参数生成：
- 无筛选条件：`all`
- 有筛选条件：`poem:true:orig:true:exclAnon:true`（示例）

### 3. 缓存共享规则

**相同查询参数 = 相同的缓存键 = 共享缓存**

示例：
- `poem-square` 页面请求：`{ page: 0, pageSize: 10, isPoem: true, isOriginal: true, excludeAnonymous: true }`
  - 缓存键：`page:0:size:10:poem:true:orig:true:exclAnon:true`
  
- 首页请求相同条件：`{ page: 0, pageSize: 10, isPoem: true, isOriginal: true, excludeAnonymous: true }`
  - 缓存键：`page:0:size:10:poem:true:orig:true:exclAnon:true`
  - ✅ **直接复用 poem-square 的缓存，无需调用云函数！**

## 使用示例

### 示例 1：首页复用 poem-square 的缓存

```javascript
// poem-square.vue - 首次加载原创诗歌
const list = await getPostListWithCache({
  page: 0,
  pageSize: 10,
  isPoem: true,
  isOriginal: true,
  excludeAnonymous: true
});
// 缓存键: page:0:size:10:poem:true:orig:true:exclAnon:true
// 调用云函数，将结果存入缓存

// index.vue - 如果也需要相同的原创诗歌
const list = await getHomePosts({
  page: 0,
  pageSize: 10,
  isPoem: true,
  isOriginal: true,
  excludeAnonymous: true
});
// 相同的缓存键: page:0:size:10:poem:true:orig:true:exclAnon:true
// ✅ 直接使用缓存，无需调用云函数！
```

### 示例 2：mountain 页面复用首页的缓存

```javascript
// index.vue - 首次加载全部内容（无筛选）
const list = await getHomePosts({
  page: 0,
  pageSize: 10
});
// 缓存键: page:0:size:10:all
// 调用云函数，将结果存入缓存

// mountain.vue - 如果首页已加载过相同数据，并且云函数返回的数据符合条件
// 注意：mountain 页面有筛选条件，缓存键不同，无法直接复用
// 但如果首页也加载了相同的筛选条件，就可以复用
```

### 示例 3：标签页复用其他页面的缓存

```javascript
// tag-filter.vue - 加载某个标签的帖子
const list = await getTagPosts({
  tag: '诗歌',
  page: 0,
  pageSize: 10
});
// 缓存键: page:0:size:10:tag:诗歌

// 如果其他页面也加载了相同标签的数据，会直接复用缓存
```

## 缓存策略

- **TTL（Time To Live）**：90秒，缓存数据90秒后过期
- **SWR（Stale-While-Revalidate）**：45秒，过期后45秒内仍返回旧数据，后台刷新
- **持久化**：支持，页面刷新后仍可使用缓存
- **最大条目数**：256，超过后使用 LRU 淘汰

## 注意事项

1. **查询参数必须完全一致才能共享缓存**
   - `{ isPoem: true, isOriginal: true }` 和 `{ isPoem: true, isOriginal: true, excludeAnonymous: true }` 是不同的缓存键
   
2. **首页无筛选条件使用 `all` 作为过滤键**
   - 首页调用 `getHomePosts()` 不传筛选参数时，缓存键为 `page:0:size:10:all`
   - 这与其他页面的筛选查询（如 `poem:true:orig:true`）是不同的缓存键

3. **缓存失效机制**
   - 发帖成功后，会失效 `posts:home` 相关缓存
   - 下拉刷新时，会清除对应条件的缓存
   - 可以通过 `invalidateHomePosts()` 或 `invalidatePostList()` 手动清除缓存

4. **调试与监控**
   - 使用 `uni.$cacheStats()` 查看缓存统计
   - 使用 `uni.$cacheDebug(true)` 开启调试日志
   - 控制台会输出缓存命中/未命中的日志

## 最佳实践

1. **优先使用缓存接口**
   - 使用 `getHomePosts()` 而不是直接调用云函数
   - 使用 `getPostListWithCache()` 而不是直接调用云函数

2. **合理设置查询参数**
   - 如果需要复用其他页面的缓存，确保查询参数完全一致
   - 考虑在首页也支持筛选条件，以便复用其他页面的缓存

3. **适当使用强制刷新**
   - 下拉刷新时使用 `forceRefresh: true`
   - 发帖成功后清除相关缓存

4. **监控缓存命中率**
   - 定期查看 `uni.$cacheStats()` 的输出
   - 优化查询参数，提高缓存命中率

## 未来优化方向

1. **智能缓存预热**
   - 在用户进入页面前，预加载可能需要的缓存数据

2. **更细粒度的缓存失效**
   - 根据帖子类型、标签等条件，只失效相关的缓存

3. **缓存压缩与优化**
   - 对缓存数据进行压缩，减少存储空间
   - 优化缓存键的生成逻辑，减少重复

4. **跨设备缓存同步**
   - 支持多设备间的缓存同步（需要后端支持）


