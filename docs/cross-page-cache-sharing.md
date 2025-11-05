# 跨页面数据缓存复用方案

## 问题背景

在应用中，不同页面可能需要相同的查询条件获取数据，但各自使用独立的缓存命名空间，导致无法复用已获取的数据。例如：

- `poem-square` 页面：获取原创诗歌（`isPoem: true, isOriginal: true`）
- `index` 页面：获取全部帖子（无筛选条件）
- 如果 `index` 页面也需要展示原创诗歌，就需要重新调用云函数，无法复用 `poem-square` 已获取的数据

## 行业内的常见解决方案

### 1. **统一缓存键策略**（推荐，已实现）

**核心思想**：根据查询参数构建统一的缓存键，相同的查询条件共享相同的缓存。

**优势**：
- ✅ 实现简单，无需引入额外库
- ✅ 自动实现跨页面数据复用
- ✅ 减少网络请求和云函数调用
- ✅ 提升用户体验（快速加载）

**实现方式**：
```javascript
// 统一的缓存键构建函数
function buildCacheKey(params) {
  const { page, pageSize, isPoem, isOriginal, isDiscussion, tag, excludeAnonymous } = params;
  const parts = [];
  
  if (typeof isPoem === 'boolean') parts.push(`poem:${isPoem}`);
  if (typeof isOriginal === 'boolean') parts.push(`orig:${isOriginal}`);
  // ... 其他筛选条件
  
  const filterKey = parts.length > 0 ? parts.join(':') : 'all';
  return `page:${page}:size:${pageSize}:${filterKey}`;
}

// 所有页面使用同一个命名空间
const ns = cacheManager.namespace('posts:list', { persistent: true, maxItems: 256 });
```

**示例**：
- `poem-square` 请求：`page:0:size:10:poem:true:orig:true:exclAnon:true`
- `index` 请求相同条件：直接复用缓存，无需调用云函数

### 2. **全局状态管理**（适用于复杂场景）

**适用场景**：需要跨页面共享状态、实时更新、复杂的数据依赖关系

**方案**：
- Vuex / Pinia（Vue 生态）
- Redux / Zustand（React 生态）
- MobX / Valtio（响应式状态管理）

**示例**：
```javascript
// store/posts.js
export const usePostsStore = defineStore('posts', {
  state: () => ({
    postsByQuery: new Map(), // 以查询条件为键
  }),
  
  actions: {
    async fetchPosts(query) {
      const key = JSON.stringify(query);
      if (this.postsByQuery.has(key)) {
        return this.postsByQuery.get(key);
      }
      const posts = await api.getPosts(query);
      this.postsByQuery.set(key, posts);
      return posts;
    }
  }
});
```

### 3. **数据层抽象**（大型应用推荐）

**核心思想**：将数据获取逻辑抽象为独立的数据层，多个页面共享数据层实例。

**架构**：
```
┌─────────────┐
│  页面层     │ (index.vue, poem-square.vue)
└──────┬──────┘
       │
┌──────▼──────┐
│  数据层     │ (PostsDataService)
└──────┬──────┘
       │
┌──────▼──────┐
│  缓存层     │ (统一缓存管理器)
└──────┬──────┘
       │
┌──────▼──────┐
│  网络层     │ (云函数调用)
└─────────────┘
```

**示例**：
```javascript
// services/postsService.js
class PostsService {
  constructor() {
    this.cache = new Map();
  }
  
  async getPosts(query) {
    const key = this.buildKey(query);
    if (this.cache.has(key)) {
      return this.cache.get(key);
    }
    const posts = await this.fetchFromCloud(query);
    this.cache.set(key, posts);
    return posts;
  }
}

// 全局单例
export const postsService = new PostsService();
```

### 4. **事件驱动的缓存失效**

**核心思想**：当数据更新时，统一失效相关缓存，确保数据一致性。

**实现**：
```javascript
// 发帖成功后，清除相关缓存
uni.$emit('post-created', { postId, isPoem, isOriginal });

// 监听事件，清除相关缓存
uni.$on('post-created', (data) => {
  invalidatePostList({ isPoem: data.isPoem, isOriginal: data.isOriginal });
  invalidateHomePosts({ isPoem: data.isPoem, isOriginal: data.isOriginal });
});
```

## 本项目采用的方案

### 当前实现

1. **统一缓存命名空间**：`posts:list`
   - `api-cache/post-list.js`：通用帖子列表缓存（被 `mountain`、`poem-square`、`road` 等页面使用）
   - `api-cache/home-posts.js`：首页帖子列表（复用 `posts:list` 命名空间）

2. **统一缓存键构建**：
   - 根据查询参数（`isPoem`, `isOriginal`, `isDiscussion`, `tag`, `excludeAnonymous`）构建缓存键
   - 相同的查询条件自动复用缓存
   - 所有页面使用相同的 `buildCacheKey` 函数逻辑

3. **缓存策略**：
   - TTL: 90秒
   - SWR: 45秒（后台刷新）
   - 持久化：支持页面刷新后仍可使用缓存

4. **共享缓存的页面**：
   - `index` 页面：使用 `getHomePosts()`
   - `mountain` 页面：使用 `getPostListWithCache({ isPoem: true, isOriginal: false })`
   - `poem-square` 页面：使用 `getPostListWithCache({ isPoem: true, isOriginal: true })`
   - `road` 页面：使用 `getPostListWithCache()` 等

### 使用示例

```javascript
// mountain.vue - 获取非原创诗歌
const list = await getPostListWithCache({
  page: 0,
  pageSize: 10,
  isPoem: true,
  isOriginal: false,
  excludeAnonymous: true
});
// 缓存键: page:0:size:10:poem:true:orig:false:exclAnon:true

// index.vue（如果也需要相同的非原创诗歌）
const list = await getHomePosts({
  page: 0,
  pageSize: 10,
  isPoem: true,
  isOriginal: false,
  excludeAnonymous: true
});
// 相同的缓存键，直接复用 mountain 的缓存！

// poem-square.vue - 获取原创诗歌
const list = await getPostListWithCache({
  page: 0,
  pageSize: 10,
  isPoem: true,
  isOriginal: true,
  excludeAnonymous: true
});
// 缓存键: page:0:size:10:poem:true:orig:true:exclAnon:true

// index.vue（如果也需要原创诗歌）
const list = await getHomePosts({
  page: 0,
  pageSize: 10,
  isPoem: true,
  isOriginal: true,
  excludeAnonymous: true
});
// 相同的缓存键，直接复用 poem-square 的缓存！
```

### 效果

- ✅ `poem-square` 获取原创诗歌后，`index` 页面如果也需要相同数据，直接使用缓存
- ✅ 减少云函数调用次数
- ✅ 提升页面加载速度
- ✅ 减少服务器压力

## 最佳实践总结

1. **优先使用统一缓存键策略**：简单、高效、无需额外依赖
2. **合理设计缓存键**：包含所有影响结果的查询参数
3. **统一缓存命名空间**：相同数据类型的查询使用同一命名空间
4. **支持缓存失效**：数据更新时及时清除相关缓存
5. **考虑缓存粒度**：平衡缓存命中率和内存使用

## 注意事项

1. **缓存键必须包含所有筛选条件**：确保不同查询条件不会复用错误的缓存
2. **首页随机性考虑**：首页如果要求每次随机，第一页可以不使用缓存
3. **缓存过期策略**：合理设置 TTL 和 SWR，平衡数据新鲜度和性能
4. **内存管理**：设置合理的 `maxItems`，避免内存溢出

## 参考

- [Stale-While-Revalidate 策略](https://web.dev/stale-while-revalidate/)
- [React Query 缓存策略](https://tanstack.com/query/latest)
- [Vuex 状态管理](https://vuex.vuejs.org/)
- [Apollo Client 缓存](https://www.apollographql.com/docs/react/caching/cache-configuration/)

