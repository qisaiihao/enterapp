# 个人主页帖子显示

设置页的“显示非原创诗歌”开关默认关闭，未设置过的账号同样按关闭处理；已明确开启的账号保留开启状态。开启时，自己和他人查看个人主页都能看到非原创诗歌、原创帖和历史未标记原创的帖子；关闭时，仅隐藏 `isOriginal === false` 且标记为诗歌或诗集的帖子。普通帖子与历史未标记原创的帖子继续展示。

自己主页由 `getMyProfileData` 在数据库分页前读取该设置并过滤。他人主页由 `getUserProfile` 在数据库分页前应用同一规则。隐藏、匿名帖和活动帖沿用原有可见性规则。自己主页返回设置页时强制刷新；他人主页的分页缓存使用独立版本键，避免复用旧的原创列表缓存。

`getMyPosts` 的 `originalOnly: true` 参数仍可供明确需要原创筛选的调用方使用，个人主页请求传 `false`。

验证：`node scripts/test-profile-original-filter.cjs`、`node scripts/test-profile-pagination.cjs`、`node scripts/test-profile-loading.cjs`、`node scripts/test-user-profile-loading.cjs`。

发布需要更新客户端，并部署云函数 `getMyProfileData`、`getUserProfile` 和 `updateUserProfile`。
