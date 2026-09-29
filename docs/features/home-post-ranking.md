# 首页默认筛选与排序

2026-09-29：首页默认展示全部帖子，仍保留用户手动保存的“只看普通帖子”偏好。后台预加载与页面使用相同默认值。

首页全部列表通过 `getPostList` 的 `homeRanking: true` 启用加权时间排序：普通帖（`isPoem`、`isDiscussion` 均不为 true）在发布时间上增加 24 小时，诗歌与讨论不加成。例如，12 小时前的普通帖排在刚发布的诗歌之前，48 小时前的普通帖仍排在刚发布的诗歌之后。兼容缺失类型字段的历史帖子及 schema v2 的 `publishMode`。

排序在数据库分页前执行，按加权时间、原发布时间、帖子 ID 降序排列，替代首页原有随机混排。仅用于首页全部列表；显式类型/标签筛选和其他页面沿用原有排序。隐藏帖、活动公告、屏蔽规则保持现有语义。

缓存键包含排序模式，首页读缓存、后台预热、强刷及失效操作使用同一键，避免读到旧版随机混排缓存。

上线需要同时更新客户端和部署 `functions/getPostList` 云函数。验证：`node scripts/test-home-post-ranking.cjs`、`npm run test:splash`、`npm run check:quality`、`npm run build:app`。
