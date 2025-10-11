约定的全局事件（仅文档，便于接入各页面触发缓存失效）

- avatar-updated
  - 参数：{ userId }
  - 处理：invalidateUserInfo(userId); fileUrlCache.invalidate(oldFileId)

- post-created
  - 参数：{ userId }
  - 处理：invalidateUserPosts(userId); 可选刷新首页第一页缓存

- favorite-changed
  - 参数：{ userId, postId, favored }
  - 处理：invalidateUserPosts(userId)（或仅失效含该 post 的页键）

触发示例：
  uni.$emit('avatar-updated', { userId })
  uni.$emit('post-created', { userId })
  uni.$emit('favorite-changed', { userId, postId, favored: true })

监听示例（用户主页页内，可选）：
  onLoad 中：
    uni.$on('avatar-updated', (e) => { if (e.userId === this.targetUserId) { invalidateUserInfo(e.userId); this.loadUserProfile(); } })
    uni.$on('post-created', (e) => { if (e.userId === this.targetUserId) { invalidateUserPosts(e.userId); this.refresh(); } })
    uni.$on('favorite-changed', (e) => { if (e.userId === this.targetUserId) { invalidateUserPosts(e.userId); this.refresh(); } })

