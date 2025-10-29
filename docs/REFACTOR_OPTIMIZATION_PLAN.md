# 回车键｜工程重构与优化计划（含优先级与落地细节）

> 目标：降低重复与复杂度、提升安全与一致性、优化性能与可维护性；以最小风险分阶段落地。

---

## P0｜立刻处理（安全与一致性）

- 秘钥与敏感信息治理
  - 现状与风险：
    - 本地 `.env` 中存在云厂商密钥；虽然 `.gitignore` 已忽略，但有泄露风险（成员误上传、日志/截图外泄等）。
  - 行动项：
    - 立即轮换密钥；将凭据迁移至云控制台的“函数环境变量”或 CI/CD 密钥库（GitHub Actions/私有 CI）。
    - 前端与云函数代码中不得直接读取密钥；统一使用云端默认凭据（匿名认证 + 云托管环境权限）。
    - 仓库层面保留 `.env.example`（无敏感值），整理 README 中的本地运行流程。
  - 验收：仓库内不再包含任何真实密钥；CI/CD 与云端环境变量可独立完成部署；随机安全自查通过。

- 移除敏感字段输出（用户隐私）
  - 现状与风险：
    - getMyProfileData 返回体中包含 `password` 字段；任何接口都不应向客户端返回敏感字段。
  - 行动项：
    - 在聚合 `project` 与最终 `userInfo` 整理处移除 `password`、手机号、邮箱等潜在敏感项；使用白名单导出。
    - 如需服务端校验，全部在服务端内部完成，绝不透传到前端。
  - 验收：扫描所有云函数响应体，确保不包含敏感字段；前端代码不依赖相关字段。

- 统一 cloud:// 临时 URL 解析（服务端复用 → 前端治理）
  - 现状与痛点：
    - 多个云函数重复 `cloud.getTempFileURL` 逻辑，字段覆盖不一致（头像/首图/多图/背景图），维护成本高，易遗漏。
  - 行动项（两步走）：
    1) 服务端收敛：新增 `functions/_lib/media.js`，提供：
       - `collectFileIds(list, fieldPaths)`：从对象列表按路径收集唯一 fileID；
       - `batchResolveCloudUrls(cloud, fileIDs)`：批量换取临时 URL；
       - `applyUrlMap(list, fieldPaths, urlMap)`：将临时 URL 回填到对象指定字段。
       - 在 `getPostList` / `getFollowingPosts` / `getMyProfileData` / `getUserFavorites` 等函数中统一调用。
    2) 前端治理（中期）：尽量只返回 fileID，交由 `_utils/file-url-cache.js` 统一转换与缓存，减少云函数负担（已具备批处理能力与缓存）。
  - 验收：
    - 各 API 图片/头像字段转换口径一致；
    - 内部转换逻辑集中在一处维护；
    - 前端渲染图片稳定且无闪烁；调用量观测下降。

- 统一 openid 注入与鉴权（避免多路径不一致）
  - 现状：`main.js` 对 `uniCloud` / `tcb` 进行了 openid 注入补丁；`utils/cloudCall.js` 也封装了注入与错误处理，存在双路径并行。
  - 行动项：
    - 统一入口：页面与工具层仅使用 `utils/cloudCall.js` 调用云函数；
    - 短期保留 `main.js` 的补丁作为兜底，观察一段时间后去除补丁；
    - 统一 NO_OPENID 行为：toast 提示 + 统一错误码（`NO_OPENID`）。
  - 验收：全站云函数调用路径一致，`cloudCall` 的日志与重试策略可全局观测，NO_OPENID 行为一致。

- 数据库唯一索引与查询索引（并发与性能）
  - 现状风险：点赞/关注/收藏等存在并发重复的可能；列表查询高频但未完全索引化。
  - 行动项：
    - 唯一索引：
      - `votes_log(_openid, postId, type)`【唯一】；
      - `follows(followerId, followedId)`【唯一】；
      - `favorites(_openid, postId, folderId)`【唯一】；
      - 其他关联表（如存在 portfolios_map）建立复合唯一。
    - 查询索引：
      - `posts.createTime: -1`，`posts._openid: 1, createTime: -1`；
      - `favorites._openid: 1, createTime: -1`；
      - `messages._openid: 1, isRead: 1, createTime: -1`；
      - `follows.followerId: 1`，`votes_log.postId: 1`。
    - 建索引方式：CloudBase 控制台或 tcb cli（建议控制台创建并记录在 `docs/DB_INDEXES.md`）。
  - 验收：高并发压测不出现重复记录；核心列表 explain 均命中对应索引。

- 并发幂等与小事务（关键写路径）
  - 现状与风险：以“先查后改”的两步写方式，在并发下可能导致重复点赞/计数偏移。
  - 行动项：
    - 结合唯一索引，增加事务包裹：查 → 增删日志 → `posts.votes` `_.inc(±1)` → 提交；
    - 失败回滚并重试 1 次（乐观重试策略）。
  - 验收：并发点赞/取消交错不产生计数漂移；日志与票数一致。

---

## P1｜高优先级（结构复用与后端可靠性）

- 首页列表组件化（减少重复）
  - 现状：`pages/index/index.vue` 内 `home/discover/discussion/following` 四套列表模板高度重复（作者区、图片展示、交互区、标签）。
  - 行动项：
    - 抽象 `PostCard`（展示）与 `FeedList`（分页/骨架/空态/加载）；
    - 页面只负责 tab 切换与数据源；
    - 引入 `utils/postNormalizer.js` 统一 `imageUrls/originalImageUrls`、作者信息占位、时间格式。
  - 验收：样式/字段调整仅改一处；文件体积显著下降；四页签表现一致。

- 顶部栏统一（减少重复实现）
  - 现状：`components/top-bar` 与 `components/page-tabs` 都内置顶部栏、未读角标、安全区处理。
  - 行动项：
    - 抽取 `HeaderBar` 组件（左/右入口、未读角标、安全区、胶囊位）；
    - page-tabs 专注页签切换；top-bar 复用 HeaderBar；未读订阅逻辑集中。
  - 验收：顶部栏行为/样式一致，跨页面切换稳定；未读数同步一致。

- 云函数响应协议与参数校验
  - 现状：不同函数返回字段不一致、日志风格不统一、参数缺少校验。
  - 行动项：
    - 响应协议统一：`{ success, data, error:{code,message}, message, pagination }`；
    - 参数校验：为高频接口加轻量校验（手写/简版 yup），统一错误码（`VALIDATION_ERROR/NOT_FOUND/DB_ERROR`）。
    - 日志规范：统一前缀 `[fnName]`，减少冗余 emoji，增加 requestId；支持 DEBUG 环境变量控制详细日志。
  - 验收：跨函数响应结构一致；SLA 问题排查可通过 requestId 端云对齐。

---

## P2｜中优先级（工程化与性能）

- 配置与多环境
  - 现状：`main.js` 硬编码 envId；
  - 行动项：
    - 支持从 `process.env.TCB_ENV_ID` / 配置文件读取；
    - 小程序端由 `envList.js` 或构建脚本注入；
    - 保留默认值但打印 WARNING，便于开发定位。
  - 验收：不同环境切换无需改代码；构建日志打印当前 envId。

- ESLint + Prettier + EditorConfig + 提交钩子
  - 行动项：
    - 增加基础规则（no-unused-vars/eqeqeq/no-implicit-globals 等）；
    - 配置 `lint`, `format`, `lint:fix` 脚本；引入 `husky` + `lint-staged`；
    - 统一 import 顺序与缩进，降低 diff 噪音。
  - 验收：PR 前自动通过 lint；新代码风格一致。

- 可观测性（关联追踪）
  - 行动项：
    - 在 `cloudCall` 注入 `requestId`（时间+随机），云函数日志带上该 ID；
    - 统一 error 上报与等级。
  - 验收：端-云-日志可一键串联，故障定位时间降低。

- 缓存与失效策略完善
  - 行动项：
    - `file-url-cache` 对头像/首图进行 `warm` 预热；
    - `cache-manager` 增加统一失效：发帖/删帖/头像更新触发相关 namespace 失效（`api-cache/events.js` 已有桥接，补齐覆盖）。
  - 验收：跨页面数据一致；选定事件后缓存命中下降且及时刷新。

---

## P3｜低优先级（体验与文档）

- 单元测试与低风险集成测试
  - 范围：`utils/cloudCall`、`_utils/file-url-cache`、`_utils/cache-manager`、`utils/postNormalizer`、时间格式化；
  - 工具：轻量 mock；避免引入重框架，优先命令式断言。

- 性能细节
  - 统一骨架屏策略和阈值；图片懒加载阈值与占位统一；
  - 多图裁剪与高度计算逻辑用 `mixins/postGallery.js`（复用/收口）。

- 文档与协作
  - 增补 `CONTRIBUTING.md` 与部署/运行指南；记录索引与 DB 权限；
  - 更新 `ARCHITECTURE.md` 的点赞一致性章节，标注“唯一索引+事务已上线”。

---

## 落地节奏（建议）

- 第1周（P0）：
  - 敏感信息治理、响应白名单化；
  - 建唯一索引与核心查询索引；
  - 抽出 `functions/_lib/media.js` 并改造 `getPostList`/`getFollowingPosts`/`getMyProfileData`；
  - cloudCall 统一入口接管 2–3 个高频页面。

- 第2周（P1）：
  - 首页 `PostCard/FeedList` 组件化；
  - 顶部栏统一为 `HeaderBar`；
  - 高频云函数增加参数校验与统一响应。

- 第3周（P2）：
  - 配置多环境化（去硬编码）；
  - ESLint/Prettier/Husky；
  - requestId 关联追踪，缓存预热与失效完善。

- 第4周（P3）：
  - utils 层单测；
  - 文档收尾与体验优化。

---

## 细化改造示例

- 服务端媒体 URL 复用工具（示意）

```js
// functions/_lib/media.js
function getByPath(obj, path) {
  const segs = Array.isArray(path) ? path : String(path).split('.')
  return segs.reduce((o, k) => (o && o[k] != null ? o[k] : null), obj)
}
function setByPath(obj, path, val) {
  const segs = Array.isArray(path) ? path : String(path).split('.')
  let cur = obj
  for (let i = 0; i < segs.length - 1; i++) {
    const k = segs[i]
    if (cur[k] == null || typeof cur[k] !== 'object') cur[k] = {}
    cur = cur[k]
  }
  cur[segs[segs.length - 1]] = val
}
function collectFileIds(list, fieldPaths) {
  const set = new Set()
  list.forEach((it) => {
    fieldPaths.forEach((p) => {
      const v = getByPath(it, p)
      const arr = Array.isArray(v) ? v : v ? [v] : []
      arr.forEach((x) => { if (typeof x === 'string' && x.startsWith('cloud://')) set.add(x) })
    })
  })
  return Array.from(set)
}
async function batchResolveCloudUrls(cloud, fileIDs) {
  if (!fileIDs.length) return new Map()
  const { fileList } = await cloud.getTempFileURL({ fileList: fileIDs })
  const map = new Map()
  fileList.forEach((f) => { if (f.status === 0) map.set(f.fileID, f.tempFileURL) })
  return map
}
function applyUrlMap(list, fieldPaths, urlMap) {
  list.forEach((it) => {
    fieldPaths.forEach((p) => {
      const v = getByPath(it, p)
      const arr = Array.isArray(v) ? v : v ? [v] : []
      const next = arr.map((x) => urlMap.get(x) || x)
      if (Array.isArray(v)) setByPath(it, p, next)
      else if (v) setByPath(it, p, next[0])
    })
  })
  return list
}
module.exports = { collectFileIds, batchResolveCloudUrls, applyUrlMap }
```

- cloudCall 统一使用（示意）

```js
// 页面/工具中
import { cloudCall } from '@/utils/cloudCall.js'
const res = await cloudCall('getPostList', { skip: 0, limit: 10 }, { pageTag: 'home', injectOpenId: true })
if (res && res.result && res.result.success) {
  const posts = res.result.posts || []
}
```

- 建索引建议（示意）

```
posts:           createTime(-1), _openid(1)+createTime(-1), tags(1)+createTime(-1)
votes_log:       unique(_openid, postId, type), postId(1)
favorites:       unique(_openid, postId, folderId), _openid(1)+createTime(-1)
follows:         unique(followerId, followedId), followerId(1)
messages:        _openid(1)+isRead(1)+createTime(-1)
```

---

## 验收要点（抽样）

- 安全：无敏感字段返回、无密钥在仓库；
- 一致性：图片/头像 URL 转换口径统一；NO_OPENID 行为一致；
- 性能：核心列表查询命中索引；重复 URL 转换调用量下降；
- 结构：首页四列表合并为组件；顶部栏统一；
- 工程：lint 通过、提交钩子生效；多环境无硬编码；
- 可观测性：requestId 串联端-云日志，问题可追踪；
- 测试与文档：utils 层单测覆盖核心路径；索引与权限文档齐全。

---

## 备注

- 结合现有文档（ARCHITECTURE.md、REFACTOR_REUSE_PLAN.md）与已实现工具（file-url-cache、cache-manager、postNormalizer、pagination/postGallery 等），本计划以“先收敛复用、再移交前端治理”为主线，优先改造高频路径与共性逻辑，确保小步快跑、可灰度回滚。

