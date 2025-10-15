# Plan A：user_id 主键引入与双通道兼容迁移方案

版本：v1.0（待确认）

适用场景：
- 云函数与线上小程序共用同一套（必须完全兼容历史依赖 openid 的调用）。
- 当前仓库的 uni App 与 uni 小程序前端可以自由改造（尚未上线），建议两端保持一致的登录与调用方式。

基线原则：
- 加字段不删字段；读写双通道；零停机；可灰度、可回滚。
- 旧小程序继续使用 openid 无需改动；新前端（App/uni 小程序）统一以 user_id 为主。

---

## 1. 目标与边界

### 1.1 目标
- 引入平台自有主键 `user_id`，统一作为所有业务的唯一身份标识。
- 云函数在不破坏历史协议的前提下：
  - 入参兼容（支持 `userId`/`poemid`/`openid` 任意一种），
  - 返回兼容（保留 `openid/uid` 字段，新增 `user_id`），
  - 读写兼容（优先 `user_id`，回退 `_openid`；写入双落）。
- App 与本仓库内的 uni 小程序前端统一改造为使用 `user_id/poemid` 登录与调用。

### 1.2 非目标
- 当期不移除 `_openid` 字段依赖（迁移完成后再评估去除）。
- 当期不引入开放平台 `unionid` 方案（避免额外认证成本）。

### 1.3 约束
- 线上仍有旧小程序前端使用 `openid` 调用同一套云函数，必须保证完全兼容。
- 本仓库内的 uni 小程序与 App 可同步修改为新模型以减少后续重构成本。

---

## 2. 名词与数据模型

- 主键：`user_id`（字符串，UUID/雪花，稳定唯一）。
- 登录名：`poemid`（字符串，唯一、可读；是否允许改名可后评估）。
- 身份映射：`user_identities` 文档集合，字段：
  - `user_id`: string（指向 users.user_id）
  - `provider`: string（如 `weapp`/`app_local`）
  - `appid`: string（微信小程序 appid；非 weapp 可为空）
  - `subject_id`: string（对于 weapp 即 openid）
  - `createdAt`: number（时间戳）

查询/写入规范：
- 服务端统一解析请求身份得到 `user_id`，内部查询与写入只认 `user_id`。
- 兼容期写入时双落：同时写 `user_id` 与 `_openid`（如果拿得到）。
- 兼容期查询时双查：优先 `user_id`，找不到再回退 `_openid`（针对历史数据）。

---

## 3. 数据库结构与索引

建议在云开发控制台创建/修改以下集合与索引（先建索引再改函数，避免扫描）：

### 3.1 users（已有集合，新增字段）
- 新增字段：`user_id`（唯一索引）、`poemid`（唯一索引，可为空）。
- 保留字段：`_openid`（兼容旧前端）。

索引：
- 唯一索引：`user_id`
- 唯一索引：`poemid`
-（可选）普通索引：`_openid`

### 3.2 user_identities（新集合）
- 字段：`user_id`、`provider`、`appid?`、`subject_id`、`createdAt`。
- 唯一索引：`(provider, appid, subject_id)`
- 普通索引：`user_id`

### 3.3 posts / comments / votes_log（已有集合，新增字段）
- posts：新增 `authorId`（= user_id）；建立索引 `authorId`、`createTime`。
- comments：新增 `authorId` 或 `user_id`；建立对应索引。
- votes_log：新增 `user_id`；唯一索引 `(user_id, postId, type)`，同时保留旧查询需要的 `_openid` 索引。

---

## 4. 兼容策略

### 4.1 入参兼容（云函数）
- 接受三种身份输入形式：
  1) `userId`（新：即 user_id）
  2) `poemid`（新：后端查 users → user_id）
  3) `openid/uid`（旧：来自 `wxContext.OPENID` 或 `event.openid` → 到 identities 查 user_id）

### 4.2 返回兼容（云函数）
- 保留历史返回中的 `openid/uid` 字段。
- 新增 `user_id` 字段（新前端使用）。

### 4.3 读写兼容（云函数）
- 查询优先：`user_id` → 回退 `_openid`（仅针对历史未回填数据）。
- 写入双落：新写入的文档同时包含 `user_id` 与 `_openid`（如能获取），保证新旧前端都能看到数据。

---

## 5. 阶段与时间线

建议排期：
- P0 准备与评审（0.5 天）
- P1 库结构与索引上线（0.5–1 天）
- P2 核心云函数双通道改造（1–2 天）
- P3 回填脚本执行与数据校验（0.5–1 天）
- P4 前端改造与灰度（0.5–1 天）
- P5 验证观测、问题处理（1–2 天）
- P6 收尾与文档（0.5 天）

---

## 6. 逐步实施（操作 | 意义 | 交付物）

### 步骤 1：准备与开关
- 操作：定义迁移阶段开关 `MIGRATION_PHASE=dual`；统一日志前缀 `[IDMIG]`。
- 意义：可灰度发布与快速回滚；便于日志检索。
- 交付物：开关常量、日志规范说明。

### 步骤 2：数据库结构与索引
- 操作：按第 3 节创建/更新集合与索引。
- 意义：为 user_id 查询与唯一约束提供结构保障，避免全表扫描。
- 交付物：索引创建清单与截图/记录。

### 步骤 3：一次性回填（迁移脚本）
- 操作：新增 `functions/migrate_user_id`：
  - 为 `users` 缺失 `user_id` 的记录补发 `user_id`。
  - 写入 `user_identities`：`{provider:'weapp', appid:'<小程序appid>', subject_id:_openid, user_id}`。
  - 为 `posts/comments/votes_log` 按 `_openid→user_id` 回填 `authorId/user_id`。
  - 幂等：用唯一索引/条件 upsert 防止重复。
- 意义：让历史数据在新字段下可见，避免“新写可见、旧写不可见”的割裂。
- 交付物：`functions/migrate_user_id/index.js`，以及回填前后计数对比报告。

### 步骤 4：云函数双通道改造（先高频）
公共库：`functions/_lib/identity.js`
- `resolveUserId({ userId, poemid, openid, appid })`：按优先级解析到 user_id。
- `dualWriteUserRef({ user_id, openid })`：写入文档时同时附带 `user_id` 与 `_openid`（如有）。

改造清单（最小集）：
1) `functions/login/index.js`
   - 接口：
     - A：`{ poemid, password }` → 校验 → 返回 `{ user_id, poemid, openid? }`；若在小程序端且 openid 未绑定则写 identities。
     - B：`{}`（小程序首登）→ 解析 `wxContext.OPENID/APPID` → 若无映射则发放 `user_id` 并写 users + identities。
     - C：`{ appRegister: true, poemid? }`（App 注册）→ 发放 `user_id` 创建 users。
   - 兼容：保留 `openid/uid` 字段；新增 `user_id`。

2) `functions/getUserProfile/index.js`
   - 入参：`{ userId? (user_id), poemid?, openid? }`（兼容旧的 `userId=_openid`）。
   - 解析：调用 `resolveUserId` 获取目标用户与当前调用者的 `user_id`。
   - 查询：
     - 用户：`users.where({ user_id })`；找不到再按 `_openid` 回退一次（历史数据）。
     - 帖子：`posts.where({ authorId:user_id })`；回退 `_openid` 聚合（历史数据）。
     - 点赞：`votes_log.where({ user_id, postId: _.in(ids) })`；回退 `_openid`（历史数据）。
   - 返回：保留 `_openid`，新增 `user_id`。

3) 高频写函数（至少以下两类先改）：
   - `functions/vote/index.js`：写 `votes_log` 时调用 `dualWriteUserRef`；查询优先 `user_id`。
   - `functions/updateUserProfile/index.js`：更新用户资料时按 `user_id` 定位用户，必要时回退 `_openid`；写回双落。

- 意义：不中断旧小程序；新前端统一走 `user_id`，业务语义清晰。
- 交付物：
  - `functions/_lib/identity.js`
  - 改造后的 `login`、`getUserProfile`、`vote`、`updateUserProfile`（首批）
  - 变更说明与回归用例清单

### 步骤 5：前端改造（本仓库内的 App 与 uni 小程序）
- `utils/auth.js`：新增 `getUserId()/cacheUserId()`；扩展 `setLoginState(userInfo, openid, userId)`。
- `utils/cloudCall.js`：默认不再自动注入 openid（或调用点显式 `{ injectOpenId:false }`）。
- `api-cache/user-profile.js`：把 `injectOpenId: true` 改为 `false`，并传递主键 `userId`。
- 登录流程：以 poemid+密码为主，后端返回 `user_id` 并缓存；如需微信绑定，在小程序端用 poemid+密码完成绑定（云函数写 identities）。
- 意义：新端统一用 user_id，避免再次大改。
- 交付物：上述三个文件的最小变更。

### 步骤 6：验证、观测与发布
- 观测：
  - 云函数错误率、时延；`[IDMIG]` 日志中的 `NO_USER_ID/NO_OPENID` 次数。
  - 迁移后 24/48 小时核对“user_id 缺失计数”→ 收敛到 0。
- 抽样：同账号在 App 与小程序端点赞/发帖是否互见（绑定后）。
- 交付物：日志查询语句、观测面板、试运行报告。

### 步骤 7：回滚与收尾
- 回滚：保留旧逻辑不删除；必要时将 `MIGRATION_PHASE` 切回 `legacy`（仅走旧路径）。
- 收尾：等小程序前端迁完后，逐步移除 `_openid` 回退与双写；清理冗余索引。
- 交付物：回滚说明、后续清理任务清单。

---

## 7. 接口契约（示例）

### 7.1 login（保持兼容，新增 user_id）
请求：
```
// A：poemid + 密码
{ poemid, password }

// B：小程序首登（无需入参，云端解析 OPENID/APPID）
{}

// C：App 注册
{ appRegister: true, poemid? }
```
返回（示例）：
```
{
  success: true,
  user_id: "u_xxx",      // 新增
  poemid: "poem_xxx",    // 如有
  openid: "wx_openid_x", // 兼容保留
  uid: "wx_openid_x"     // 兼容保留
}
```

### 7.2 getUserProfile（入参/返回兼容）
请求：
```
{ userId? (user_id), poemid?, openid? (旧) }
```
返回（要点）：
```
{
  success: true,
  userInfo: {
    user_id: "u_xxx",     // 新增
    _openid: "wx_openid", // 兼容保留
    nickName, avatarUrl, bio, signatureUrl
  },
  posts: [ ... isVoted ... ]
}
```

---

## 8. 示例改动（方向性示例）

前端（本仓库）：
- `api-cache/user-profile.js`
```js
cloudCall('getUserProfile', { userId, skip: 0, limit: 1 }, { pageTag: 'user-profile:info', context, injectOpenId: false });
cloudCall('getUserProfile', { userId, skip: page * pageSize, limit: pageSize }, { pageTag: 'user-profile:posts', context, injectOpenId: false });
```

云函数公共库：`functions/_lib/identity.js`（伪代码）
```js
async function resolveUserId({ userId, poemid, openid, appid }) {
  if (userId) return userId;
  if (poemid) { /* users.where({ poemid }) → user_id */ }
  if (openid)  { /* user_identities.where({ provider:'weapp', appid, subject_id: openid }) → user_id */ }
  return null;
}
function dualWriteUserRef(doc, { user_id, openid }) {
  if (user_id) doc.user_id = user_id;
  if (openid)  doc._openid = openid; // 兼容保留
  return doc;
}
module.exports = { resolveUserId, dualWriteUserRef };
```

---

## 9. 风险与缓解

- 历史数据未完全回填 → 增量对账任务与报警；查询优先 user_id 回退 `_openid`。
- 唯一约束冲突（poemid/identities）→ 先建索引，再“先查后写/幂等 upsert”。
- 性能回退（新索引未生效）→ 先建索引后发布函数；灰度观察。
- 缓存与本地态（App）不一致 → 以服务端 user_id 为准，谨慎使用本地缓存写通。

---

## 10. 成功判定

- 旧小程序无任何改动仍可正常工作（依赖 openid 的路径不报错）。
- App 与本仓库 uni 小程序使用 poemid 登录得到 `user_id`，业务读写以 `user_id` 为准。
- 同一账号绑定后，跨端数据互见；关键云函数错误率不升。
- 迁移后 48 小时“user_id 缺失计数”归零。

---

## 11. 交付物清单

- 文档：本文件 `docs/PlanA-UserId-Migration.md`。
- 云函数：
  - 新增：`functions/_lib/identity.js`、`functions/migrate_user_id/index.js`（一次性运维脚本）。
  - 改造：`functions/login/index.js`、`functions/getUserProfile/index.js`、`functions/vote/index.js`、`functions/updateUserProfile/index.js`（首批）。
- 前端（本仓库）：
  - `utils/auth.js`（新增 userId 支持）、`utils/cloudCall.js`（默认关闭 openid 注入或调用点显式关闭）、`api-cache/user-profile.js`（改 injectOpenId 为 false）。

---

## 12. 发布顺序（建议）

1) 只上库结构与索引（不改代码）。
2) 上云函数公共库与改造后的 `login`、`getUserProfile`（双通道，兼容旧小程序）。
3) 上一次性回填函数并执行，对账校验。
4) 改造本仓库前端（App + uni 小程序）并灰度发布。
5) 观测日志与指标，修复长尾问题。
6) 待旧小程序迁完后再进入去除 `_openid` 依赖的下一阶段（另立方案）。

