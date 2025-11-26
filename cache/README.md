# 统一缓存系统

## 目录结构

```
cache/
├── core/                    # 核心引擎
│   ├── manager.js           # CacheManager - 内存 LRU + 持久化
│   ├── file-url.js          # 文件 URL 缓存 (cloud:// → https)
│   ├── key-builder.js       # 缓存键构建工具
│   └── hydrate.js           # URL hydrate 批量转换工具
├── stores/                  # 业务缓存存储
│   ├── avatar.js            # 头像缓存 (TTL 24h, 持久化)
│   ├── signature.js         # 签名缓存 (TTL 24h, 持久化)
│   ├── follow.js            # 关注状态缓存 (TTL 1h, 持久化)
│   ├── like-status.js       # 点赞状态缓存 (TTL 10min, 持久化)
│   ├── search.js            # 搜索结果缓存 (TTL 5min)
│   ├── search-history.js    # 搜索历史缓存 (持久化)
│   ├── blocked-users.js     # 屏蔽用户缓存 (TTL 5min)
│   ├── refresh-flags.js     # 刷新标记缓存 (内存)
│   └── index.js             # stores 统一导出
├── events.js                # 事件桥 - 监听全局事件并触发缓存失效
├── index.js                 # 统一入口
└── README.md                # 本文档
```

## 使用方式

### 基础用法

```js
import cache from '@/cache';

// 1. 使用核心管理器
const ns = cache.manager.namespace('myData', { persistent: true });
ns.set('key', value, { ttlMs: 60000 });
const data = ns.get('key');

// 2. 文件 URL 缓存
const url = await cache.fileUrl.getTempUrl('cloud://...');

// 3. 业务缓存
const avatar = await cache.stores.avatarCache.getUserAvatar(userId);
const likeStatus = cache.stores.likeStatusCache.getLikeStatus(postId);

// 4. 工具函数
await cache.hydrateTempUrls(posts);
cache.buildCacheKey({ page: 0, pageSize: 10 });

// 5. 调试
cache.setDebug(true);
console.log(cache.getStats());
```

### 便捷访问

```js
import cache from '@/cache';

// 直接访问常用缓存（向后兼容）
cache.avatarCache.getUserAvatar(userId);
cache.followCache.getFollowStatus(currentUserId, targetUserId);
cache.signatureCache.getUserSignature(userId);
cache.searchCache.get(keyword);
```

## 命名空间一览

### 业务缓存 (cache/stores/)

| 命名空间 | 用途 | TTL | 持久化 |
|----------|------|-----|--------|
| `avatars` | 头像/昵称 | 6h | ✅ |
| `signatures` | 用户签名 | 6h | ✅ |
| `follow:<userId>` | 关注状态 | 1h | ✅ |
| `like:status` | 帖子点赞 | 10min | ✅ |
| `comment:like:status` | 评论点赞 | 10min | ✅ |
| `search` | 搜索结果 | 5min | ❌ |
| `search:history` | 搜索历史 | ∞ | ✅ |
| `blockedUsers` | 屏蔽用户 | 5min | ❌ |
| `refresh:flags` | 刷新标记 | - | ❌ |
| `fileUrls` | cloud:// URL | 55min | ❌ |

### API 缓存 (api-cache/)

| 命名空间 | 用途 | TTL | SWR |
|----------|------|-----|-----|
| `posts:list` | 帖子列表 | 90s | 45s |
| `posts:discover` | 发现页 | 90s | 45s |
| `following:posts` | 关注动态 | 60s | 30s |
| `discussion:posts` | 讨论帖 | 120s | 60s |
| `poems:following` | 诗歌 | 75s | 30s |
| `messages` | 消息列表 | 90s | 45s |
| `me:info` | 我的资料 | 30min | 5min |
| `profiles:user` | 他人资料 | 5min | 2min |
| `userPosts:<id>` | 他人帖子 | 2min | 1min |
| `userFavorites:<id>` | 他人收藏 | 2min | 1min |
| `tags` | 标签列表 | 30min | 5min |
| `myLikes` | 我的点赞 | 2min | 30s |
| `portfolio` | 作品集 | 5min | 1min |
| `unread` | 未读数 | 30s | 30s |

## 事件驱动失效

缓存系统监听以下全局事件并自动失效相关缓存：

- `POST_CREATED` - 新帖发布 → 失效帖子列表缓存
- `AVATAR_UPDATED` - 头像更新 → 失效用户资料和帖子列表缓存
- `LIKE_CHANGED` - 点赞变更 → 更新点赞状态缓存
- `COMMENT_COUNT_CHANGED` - 评论数变更 → 更新列表缓存
- `UNREAD_CHANGED` - 未读消息数变化 → 更新未读缓存
- `POST_VISIBILITY_CHANGED` - 帖子可见性变化 → 更新列表缓存

## 初始化

在 `main.js` 中初始化事件桥：

```js
import { setupCacheEventBridges } from '@/cache';
setupCacheEventBridges();
```

## 向后兼容

旧的导入路径仍然可用，但已标记为 deprecated：

```js
// ❌ 旧方式（已废弃，但仍可用）
import cacheManager from '@/_utils/cache-manager';
import fileUrlCache from '@/_utils/file-url-cache';
import avatarCache from '@/utils/avatarCache';

// ✅ 新方式（推荐）
import cache from '@/cache';
const { manager, fileUrl, avatarCache } = cache;
```

## 调试

```js
import cache from '@/cache';

// 开启调试模式
cache.setDebug(true);

// 查看统计信息
console.log(cache.getStats());

// 清除所有缓存
cache.clearAll();
```
