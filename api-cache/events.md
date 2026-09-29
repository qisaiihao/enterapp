约定的全局事件（仅文档，便于接入各页面触发缓存失效）

- avatar-updated
  - 参数：{ userId }
  - 处理：invalidateUserInfo(userId); fileUrlCache.invalidate(oldFileId)

- post-created
  - 参数：{ userId }
  - 处理：invalidateUserPosts(userId); 可选刷新首页第一页缓存

- favorite-changed
  - 参数：{ userId, kind?, postId?, favoriteId?, folderId?, favored? }
  - 统一通过 emitFavoriteChanged 发出；发出前先失效收藏缓存。移除单条记录时 favored 省略，同帖仍可能位于其他夹。
  - 页面仅负责刷新显示，不重复失效。新写入口使用 api-cache/favorite-actions.js。

触发示例：
  uni.$emit('avatar-updated', { userId })
  uni.$emit('post-created', { userId })
  emitFavoriteChanged({ userId, postId, favored: true }) // 从 utils/events.js 导入；优先由 favorite-actions 触发

监听示例（用户主页页内，可选）：
  onLoad 中：
    uni.$on('avatar-updated', (e) => { if (e.userId === this.targetUserId) { invalidateUserInfo(e.userId); this.loadUserProfile(); } })
    uni.$on('post-created', (e) => { if (e.userId === this.targetUserId) { invalidateUserPosts(e.userId); this.refresh(); } })
    收藏列表使用 mixins/favoriteRefresh.js，账号匹配后刷新显示；失效已经由 emitFavoriteChanged 完成，不再调用 invalidateUserPosts。
