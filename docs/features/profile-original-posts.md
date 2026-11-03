# 个人主页原创帖子

个人主页的帖子列表只展示 `isOriginal === true` 的内容，适用于自己的主页和访问他人的主页。未标记原创的历史帖子不展示；重复点击帖子标签保持当前列表。

自己的主页首次加载、缓存快照、下拉刷新和分页均使用 `originalOnly: true`。他人主页由 `getUserProfile` 在数据库分页前筛选原创，帖子缓存使用独立的原创键，避免复用旧的全部帖子缓存。隐藏和匿名帖沿用原有可见性规则。

验证：`node scripts/test-profile-original-filter.cjs`、`node scripts/test-profile-pagination.cjs`、`node scripts/test-profile-loading.cjs`、`node scripts/test-user-profile-loading.cjs`。

发布需要更新客户端，并部署云函数 `getUserProfile`。
