## 项目架构总览

本项目基于 uni-app 构建，前端以 Vue2 为主（包含 Vue3 兼容代码），后端使用腾讯云 CloudBase/微信云开发的云函数体系。页面通过 `pages.json` 管理，前端直接通过 `@cloudbase/js-sdk` 调用云函数，云函数使用 `wx-server-sdk` 访问数据库与存储。

### 技术栈
- **前端**: uni-app（Vue2 主体，含 Vue3 分支初始化逻辑）、原生 tabBar
- **云端**: 腾讯云 CloudBase（TCB）、微信云开发（`wx-server-sdk`）
- **依赖**: `@cloudbase/js-sdk`、`wx-server-sdk`

### 启动与全局状态
- 全局入口在 `main.js`：
  - 初始化 TCB：`tcb.init({ env, auth: { persistence: 'local' } })`，并挂载到 `Vue.prototype.$tcb`
  - 拦截 `uniCloud.callFunction` 与 `tcb.callFunction`，在调用时自动注入 `openid`，并在未登录时阻断除 `login` 以外的云函数
- `App.vue`：应用启动时执行匿名认证→调用 `login`→读取/创建用户→写入 `globalData` 与本地缓存，形成登录态（`openid`、`userInfo`）

### 路由与导航
- `pages.json` 定义页面与 tabBar：
  - 主要页签：`pages/index/index`（广场）、`pages/poem/poem`（路）、`pages/mountain/mountain`（山）、`pages/profile/profile`（湖）
  - 其余功能页：登录/注册、详情、搜索、收藏、消息、反馈、图片管理等

### 页面层（示例：广场页 `pages/index/index.vue`）
- 职责：
  - 列表加载/分页（首屏骨架屏、滚动预加载、底部加载提示）
  - 点赞（本地乐观更新 + 云端校正）与消息角标
  - 发现页切换（左右滑动）与图片预载/占位防抖
- 数据来源：通过 `this.$tcb.callFunction({ name: 'getPostList', data: { skip, limit } })` 获取帖子列表，并在前端补全 `imageUrls`、`originalImageUrls`、计算 `likeIcon` 等展示字段；利用 `utils/` 内部缓存与优化工具（`dataCache`、`imageOptimizer`、`likeIcon`、`avatarCache`、`followCache`、`platformDetector`）

### 云函数层（Node，位于 `functions/`）
- 配置：`cloudbaserc.json` 列出全部函数、内存与超时配置，统一部署到 `envId`
- 示例：`functions/getPostList/index.js`
  - 鉴权：从 `cloud.getWXContext()` 或入参中解析 `openid`，缺失则返回 `NO_OPENID`
  - 查询：`posts` 聚合查询，可选 `isPoem`、`isOriginal`、`tag` 筛选；关联 `users`（作者信息）、`comments`（评论数）、`votes_log`（当前用户是否点赞）
  - 媒体：批量将 `cloud://` fileID 通过 `cloud.getTempFileURL` 转为临时直链（头像/帖子图片/诗歌背景）
  - 返回：`{ success: true, posts }`，字段包含 `authorName`、`authorAvatar`、`commentCount`、`isVoted` 等
- 其余典型函数：登录/用户（`login`、`getUserProfile`、`updateUserProfile`、`createUser`）、内容（`getPostDetail`、`searchPosts`、`vote`、`addComment`）、消息（`getMessages`、`getUnreadMessageCount`、`markMessagesAsRead`）、推荐（`getRecommendationFeed`、`getHotFeed`、`getPersonalizedFeed`）等

### 数据与权限
- 主要集合：`users`、`posts`、`comments`、`votes_log`、`messages` 等
- 身份：默认匿名认证；前端调用云函数时透传 `openid`；后端以 `getWXContext()` 兜底
- 媒体：云存储 fileID 统一在服务端转换临时 URL 后返回，提高前端直链显示性能

### 运行与部署
- 本地：使用 HBuilderX 打开根目录，安装依赖后可运行到 H5/小程序/App
- 云端：依据 `cloudbaserc.json` 部署函数；数据库集合与权限请按对应函数说明创建和配置

### 关键路径速览
- 入口初始化：`main.js` → 挂载 `$tcb`、拦截云函数调用，透传 `openid`
- 登录流程：`App.vue` → 匿名认证 → `login` → 写入 `globalData`/缓存
- 列表加载：`pages/index/index.vue` → `getPostList` → 前端展示优化与缓存
- 点赞流程：前端乐观更新 → 云函数 `vote` → 缓存/列表同步

### 点赞实现与一致性
#### 实现概览
- 前端：`pages/index/index.vue` 的 `onVote`
  - 防重入：使用 `votingInProgress[postId]` 阻挡重复点击
  - 乐观更新：即时切换 `isVoted`、`votes`，并计算 `likeIcon`
  - 失败回滚：云函数失败/网络异常时回滚到原状态
  - 成功后：以服务端返回 `votes`/`isLiked` 校正，并写入 `dataCache`
- 服务端：`functions/vote/index.js`
  - 通过 `votes_log` 是否存在来判定点赞/取消，分别对 `posts.votes` 做 `_.inc(±1)`
  - 点赞时写入一条 `messages` 通知（自赞不通知）
  - 最终读取 `posts` 最新 `votes` 返回 `{ success, votes, isLiked }`

#### 一致性现状
- 列表、搜索、推荐与详情云函数统一以 `votes_log` 计算 `isVoted`，以 `posts.votes` 返回票数，口径一致。
- 前端设置了本地节流与失败回滚，降低单端多击带来的 UI 偏差。

#### 潜在问题（并发/幂等）
- 跨端/多请求并发：同一用户对同一帖子并发触发点赞/取消，当前服务端逻辑采用“先查后改”的两步操作，缺少事务与唯一性约束，可能出现：
  - 并发双“点赞”各自未读到对方插入的 `votes_log`，导致重复插入与累计 `votes`。
  - 并发“点赞/取消”交错，产生脏写，`votes` 与 `votes_log` 不一致。
- 唯一键缺失：`votes_log` 未声明复合唯一索引（`_openid, postId, type`），难以依赖数据库层防重复。

#### 改进建议（服务端为主）
1) 增加复合唯一索引（推荐）
   - 对 `votes_log(_openid, postId, type)` 建立唯一索引，数据库层去重。
2) 使用事务包裹“查/增删/计数更新”（强一致）
   - `const tx = await db.startTransaction()`；在事务内：
     - 读取 `votes_log` 是否存在；
     - 依据存在与否执行 `add/remove`；
     - 同时对 `posts.votes` 执行 `_.inc(±1)`；
     - 提交事务，异常回滚重试。
3) 基于幂等键的“插入若不存在/删除若存在”（次优，弱一致）
   - 尝试以“组合ID”方式写入 `votes_log`（如 `${openid}_${postId}_post`）避免重复；
   - 更新 `posts.votes` 前重新读一次 `votes_log` 确认最终态。
4) 客户端补充防抖/限速
   - 已有 `votingInProgress`；可在多端登录场景下增加最小操作间隔（如 500ms）。

#### 验收要点
- 并发压测下：`votes` 与 `votes_log` 一致；`isVoted` 与实际日志一致；重复请求不导致票数偏移。
- 列表与详情刷新后口径一致；切页返回后点赞状态不闪烁。

### 用户标识统一规范（迁移后）
- 唯一主标识：只使用 `openid`（含系统字段 `_openid`）。
- 前端持久化：`globalData.openid` 与本地 `userOpenId`；`userInfo._openid = openid` 一并缓存。
- 登录覆盖：匿名认证仅用于启动期；登录成功后用真实 `openid` 覆盖全局与缓存。
- 云端判定：所有 `isVoted`/权限判断仅以 `_openid`。

### 点赞状态保持策略（前端）
- 等待登录完成：首屏 `onLoad` 调用 `waitForLoginThenInit()`，待 `globalData._loginProcessCompleted && openid` 后再拉取帖子（已实现）。
- 统一判定口径：服务端 `getPostList/getPostDetail/...` 均基于 `votes_log` 按 `_openid+postId+type` 计算 `isVoted`（已统一）。
- 登录持久化：登录成功时将 `openid` 与 `userInfo._openid` 写入本地并恢复全局，登录页支持自动跳转（已实现）。
- 乐观更新与校正：前端先本地切换，再以云函数返回的 `votes/isLiked` 校正并同步缓存（已存在）。


