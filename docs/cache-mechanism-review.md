# 缓存机制调研报告

## 全局概览
- **核心组件**：`_utils/cache-manager.js` 提供命名空间、LRU + TTL、可选 `uniStorage` 持久化、`getOrFetch` + SWR 与统计信息；`_utils/file-url-cache.js` 批量换取临时文件 URL，并复用 `cache-manager` 的 `fileUrls` 命名空间。
- **初始化**：`main.js` 中注入 `fileUrlCache` resolver、`setupCacheEventBridges()`、以及 `uni.$cacheStats/$cacheDebug` 调试入口；`utils/accountCacheReset.resetAllCachesOnAccountChange` 用于账号切换时的全量清理。
- **缓存分层**：命名空间缓存（业务数据）、工具级内存缓存（搜索、图片、点赞状态等）、以及局部 `uniStorage` 键（用户信息、草稿与刷新标记）。

## 命名空间缓存清单

| 命名空间/模块 | 缓存内容 | 持久化 | TTL / SWR | 主要调用方 | 失效机制现状 |
| --- | --- | --- | --- | --- | --- |
| `posts:home` | 首页帖子分页 | 是 | 90s / 45s | `api-cache/home-posts.getHomePosts` | `invalidateHomePosts`、事件 `post-created`、`post-visibility-changed`、首页下拉刷新 |
| `posts:discover` | 发现页推荐 | 是 | 90s / 45s | `api-cache/discover.getDiscoverFeed` | `clearDiscoverCache`、事件 `post-created`、`post-visibility-changed` |
| `posts:tag:<tag>` | 标签页帖子分页 | 是 | 90s / 45s | `api-cache/tag-posts.getTagPosts` | 仅手动 `invalidateTagPosts`（当前未被调用），事件 `post-visibility-changed` 对隐藏场景生效 |
| `profiles` (`me`) | 当前用户资料 | 是 | 30m / 5m | `api-cache/profile.getMyProfile` | `invalidateMyProfile`（个人页保存、账号重置） |
| `profiles:user` | 目标用户资料 | 是 | 无 TTL | `api-cache/user-profile.getUserInfo` | `invalidateUserInfo`（事件 `avatar-updated`、用户页手动刷新） |
| `userPosts:<uid>` | 用户帖子分页 | 是 | 无 TTL | `api-cache/user-profile.getUserPosts` | `invalidateUserPosts`（事件 `avatar-updated`、用户页操作），`post-created` 目前未覆盖 |
| `userFavorites:<uid>` | 用户收藏分页 | 是 | 无 TTL | `api-cache/user-profile.getUserFavorites` | 仅 `invalidateUserFavorites`（用户页调用），事件 `favorite-changed` 未接入 |
| `portfolio:user` | 作品集列表 | 是 | —— | `api-cache/user-profile.getUserPortfolios` | 命名空间存在但 `getUserPortfolios` 未写入缓存，`invalidateUserPortfolios` 无实际效果 |
| `me:info` | 我的资料（含头像 URL） | 是 | 30m / 5m | `api-cache/my.getMyInfo` | `invalidateMyInfo`、账号重置脚本 |
| `me:posts` | 我的帖子分页 | 是 | —— | `api-cache/my.getMyPosts` | API 直接调用云函数（缓存暂时关闭），`invalidateMyPosts` 仅清理命名空间 |
| `me:favorites` | 我的收藏分页 | 是 | 无 TTL | `api-cache/my.getMyFavorites` | `invalidateMyFavorites`（个人页）、无事件桥接 |
| `tags` | 全量标签 | 是 | 30m / 5m | `api-cache/tags.getAllTags` | 手动 `invalidateAllTags` 未被使用；依赖 TTL 自然过期 |
| `unread` | 未读消息数 | 否 | 60s / 60s | `api-cache/unread.getUnreadCount` | `invalidateUnread`（消息页）、事件 `unread-changed` |
| `fileUrls` | 云文件临时 URL | 否 | 由 `maxAge` 决定（默认 ≥55m） | `_utils/file-url-cache` | `fileUrlCache.invalidate()`（账号重置）、缺乏头像/图片修改时的细粒度失效 |
| `avatars` | 用户头像信息 | 是 | 24h | `utils/avatarCache` | `updateUserAvatar` 覆盖写入；`clearUserAvatar` 未被调用 |
| `follow:<uid>` | 关注状态 | 是 | 1h | `utils/followCache` | `toggleFollowStatus` 内部更新，`clearAllFollowCache`（账号重置） |
| `like:status` | 帖子点赞态 | 否 | 10m | `utils/likeStatusSync` / `utils/likeService` | `updateLikeStatus`、事件 `like-changed` |
| `comment:like:status` | 评论点赞态 | 是 | 10m | `utils/commentLikeStatusSync` | 事件 `comment-like-changed`（目前很少触发） |

## 非命名空间缓存
- **`utils/searchCache`**：基于 `Map` 的搜索结果缓存，最大 50 项，5 分钟过期；`pages/search` 独占使用。
- **`utils/imageLoader` / `utils/imageOptimizer`**：页面会话级图片缓存，命中后避免重复 `downloadFile`；无持久化。
- **`utils/avatarCache` / `utils/followCache`**：除命名空间外还维护内存态（并发去重集合）。
- **`App.vue` 与业务页面**：通过 `uniStorage` 缓存 `userInfo`、`userOpenId`、`preview_post`、各类 `shouldRefresh*` 标记及草稿数据，用于会话恢复。
- **`utils/auth`**：`cacheOpenId` 将 OpenID 双写到 `globalData` 与 `uniStorage`，供 `cloudCall` 注入。

## 事件刷新矩阵

| 事件 | 触发位置 | 当前刷新范围 | 观察到的缺口 |
| --- | --- | --- | --- |
| `post-created` | `pages/add`、`pages/preview` | 清空 `posts:home`、`posts:discover` | 未刷新作者 `userPosts`/`me:posts`、相关 `posts:tag:*` 与收藏缓存 |
| `avatar-updated` | `pages/profile-edit` | `profiles:user`、`userPosts` | 未同步 `avatars` 命名空间、`fileUrlCache` 旧头像 URL |
| `favorite-changed` | 收藏夹组件、个人主页 | 事件桥接逻辑被注释掉 | `userFavorites`、`me:favorites`、`posts:*` 列表不会自动刷新 |
| `like-changed` | `utils/likeService` | 更新 `like:status` 并批量修正帖子列表 | 行为合理；依赖调用方传入 `postId` |
| `comment-like-changed` | 预期评论模块 | 写入 `comment:like:status` & 本地存储 | 实际调用端尚未接入，事件几乎不触发 |
| `comment-count-changed` | 帖子详情评论操作 | 遍历 `posts:*`/`me:posts`/`userPosts:*` 更新评论数 | 无明显缺口 |
| `unread-changed` | 消息页、`invalidateUnread` | `unread` 命名空间实时更新 | 正常 |
| `post-visibility-changed` | 个人主页隐藏/恢复帖子 | 隐藏时清理 `posts:*` 命名空间记录；恢复仅刷新首页/发现 | 标签与用户页列表需额外刷新 |
| `resetAllCachesOnAccountChange` | `utils/accountCacheReset` | 清理所有命名空间、`fileUrlCache`、关注缓存，并预热 `me` 资料 | 依赖显式调用，适用于账号切换 |

## 存在的空白与风险
- **作品集未真正缓存**：`getUserPortfolios` 直接返回云函数结果，导致 `invalidateUserPortfolios` 无效。
- **我的帖子缓存缺席**：`getMyPosts` 暂停使用命名空间，个人主页依旧调用 `invalidateMyPosts`，易导致代码期望与实际不符。
- **收藏相关缓存不会自动失效**：`favorite-changed` 事件无处理逻辑，`userFavorites`、`me:favorites`、相关帖子列表可能长期陈旧。
- **TTL 为 0 的命名空间依赖人为清理**：`userPosts`、`userFavorites` 长期驻留在本地存储，若事件遗漏会拖慢数据更新。
- **文件 URL 缓存缺乏针对性失效**：头像/首图替换后未调用 `fileUrlCache.invalidate`，可能继续使用过期 URL。
- **评论点赞事件链未闭环**：`comment-like-changed` 几乎不发射，`comment:like:status` 命名空间难以命中。
- **标签缓存没有主动刷新入口**：新增/重命名标签需依靠 30 分钟 TTL，自运营视角可考虑提供后台触发。

## 优化建议
- **补齐事件桥接**：在 `api-cache/events.js` 中恢复 `favorite-changed` 监听，至少清理 `userFavorites`、`me:favorites` 并针对 `postId` 更新相关列表；`post-created` 可在传入 `userId` 时附带 `invalidateUserPosts(userId)`。
- **完善文件 URL 失效**：头像/封面更新后，向事件负载传递旧 `fileID` 并调用 `fileUrlCache.invalidate(oldId)` 与 `avatarCache.clearUserAvatar(userId)`，防止临时 URL 继续使用。
- **启用作品集缓存**：让 `getUserPortfolios` 使用 `nsPortfolio.getOrFetch`，并在作品集增删改时调用 `invalidateUserPortfolios`。
- **明确我的列表策略**：若仍需要缓存 `getMyPosts`，可恢复 `getOrFetch` 并设定短 TTL（例如 60s + SWR）；若不再缓存，应移除命名空间与相关失效调用，避免误解。
- **为零 TTL 命名空间增加兜底过期**：可设定保守 TTL（例如 5 分钟），即便事件缺失也能自动回源。
- **扩展标签与收藏的刷新入口**：在后台或运营操作完成后触发 `invalidateAllTags`/`invalidateUserFavorites`，或提供统一的事件枚举。
- **补发评论点赞事件**：在评论点赞/取消逻辑中调用 `emitCommentLikeChanged`，充分利用已有同步实现。
- **完善文档与监控**：在 `docs/` 中更新缓存使用指引，并考虑对 `cacheManager.getStats()` 输出建立基础日志采样。

## 调试与运维提示
- 运行时可通过 `uni.$cacheStats()` 查看各命名空间统计，`uni.$cacheDebug(true)` 开启命中日志，或在 `uniStorage` 写入 `CACHE_DEBUG=1` 后重启。
- 账号切换后调用 `utils/accountCacheReset.resetAllCachesOnAccountChange()`，可一键清理命名空间与临时 URL 缓存并重新预热个人资料。
- 建议在页面级调试面板中暴露 `setupCacheEventBridges` 状态，避免事件桥接被多次注册或遗漏。

