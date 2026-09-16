# 管理帖子类型筛选

管理 → 管理帖子新增“全部、普通帖子、原创诗歌、非原创诗歌、讨论”筛选。默认全部，切换类型从第一页重新加载；下拉刷新保留当前选择。更改帖子类型或删除后重新加载当前筛选，避免列表残留与分页偏移。

`listAdminPosts` 将 `postType` 传给 `adminManager.getAllPosts`。服务端先筛选再分页，额外读取一条判断 `hasMore`，页面丢弃切换前尚未完成的旧请求。请求失败可点击错误提示重试，失败不推进页码。

类型使用现有布尔字段，不依赖数据库是否存有 `postType`：

| 类型 | 条件 |
| --- | --- |
| 讨论 | isDiscussion 为 true |
| 原创诗歌 | 非讨论，isPoem 与 isOriginal 均为 true |
| 非原创诗歌 | 非讨论，isPoem 为 true，isOriginal 不为 true |
| 普通帖子 | isDiscussion 与 isPoem 均不为 true |

“不为 true”兼容 false、null 和缺失字段。讨论优先，分类与列表徽标保持一致。保留管理员权限校验；不传 `postType` 的旧客户端仍查询全部。

上线需要部署 `functions/adminManager` 并更新前端；仅更新前端时旧云函数会忽略新筛选参数。查询涉及 `isDiscussion`、`isPoem`、`isOriginal` 与 `createTime`，若云环境提示缺少索引，应按提示创建相应组合索引。

验证命令：`npm run test:admin-post-types`、`npm run check:quality`、`npm run build:app`、`npm run build:mp-weixin`。测试覆盖分页前筛选、旧字段、权限、API/页面传参、刷新、改类型、删除、请求乱序及失败重试。真机需确认五种筛选和长列表加载。
