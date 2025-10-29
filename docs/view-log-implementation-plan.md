# 浏览日志采集与聚合实施方案（分步骤）

本文给出一套可落地、可灰度的浏览日志（view）采集与低成本聚合方案，适配微信云开发/uni-app（wx-server-sdk），目标是：稳定采集、低成本存储、线上查询快、指标可回放、演进可控。

## 1. 目标与范围

- 稳定采集：前端批量上报，服务端幂等写入，弱网/异常可恢复。
- 低成本：事件层 TTL，聚合层存 Top-K 与滚动指标，避免大数组膨胀。
- 快速查询：线上只查聚合层（user_interests、post_statistics），避免扫原始事件。
- 可回放：事件层保留 30–90 天，支持纠错重算与报表。
- 平滑演进：与现网并行、镜像写、灰度切流、可回滚。

## 2. 整体架构与数据流

```
Client(前端队列) --> 云函数 recordEventBatch --> view_events(事件层, TTL)
                                             └─(定时Job)─> user_post_day / post_day(日分桶计数层)
                                                              └─(定时Job)─> user_interests(用户兴趣)
                                                                              post_statistics(内容统计)
                                             └─(可选Job)─> user_recent_views(近期浏览缓存, 限长)
```

说明：
- 事件层只追加写，保留短期，用于回放与容错。
- 日分桶层体量小、更新快，作为聚合输入与验证对账的“事实中间层”。
- 线上查询统一走聚合层，延迟以分钟/小时计。

## 3. 数据模型与索引

### 3.1 view_events（原始事件，TTL 30–90 天）

示例字段：
```javascript
{
  _id: "ev_${openid}_${postId}_${sessionId}_${yyyymmddHHmm}", // 幂等去重(分钟粒度，可按需调整)
  _openid: "user_openid_123",
  postId: "post_id_abc",
  ts: ISODate(),                 // 事件时间
  sessionId: "sess_...",        // 前端生成
  duration: 12,                  // 可选(秒)，填0/缺省亦可
  fromPage: "index",            // 可选
  device: "iOS/Android/Web"     // 可选
}
```

索引建议：
- `( _openid, ts desc )`：用户画像回放/抽样核查。
- `( postId, ts desc )`：内容明细回放。
- `TTL(ts)`：到期自动清理；如产品侧暂不支持 TTL，则用定时清理 Job 兜底。

### 3.2 user_post_day（日分桶：用户-内容-日 粒度）

```javascript
{
  _id: "upd_${openid}_${postId}_${yyyymmdd}", // 唯一键
  _openid: "user_openid_123",
  postId: "post_id_abc",
  day: "20250115",
  views: 3,
  viewUsers: 1,                  // 固定为1，表示该用户当天看过，用于派生去重
  duration: 45,                  // 汇总时长
  firstAt: ISODate(),
  lastAt: ISODate()
}
```

索引：
- `_id` 唯一；`(postId, day)`；`(_openid, day)`。

用途：
- 后续计算 `post_day.uniqueViewers = sum(viewUsers)`；
- 生成用户兴趣与“活跃天数”等指标。

### 3.3 post_day（内容-日 粒度）

```javascript
{
  _id: "pd_${postId}_${yyyymmdd}",
  postId: "post_id_abc",
  day: "20250115",
  views: 125,                    // 总浏览次数
  uniqueViewers: 86,             // 从 user_post_day 聚合
  duration: 3800,
  firstAt: ISODate(),
  lastAt: ISODate()
}
```

索引：
- `_id` 唯一；`(postId, day)`；`(day)`（可选）。

### 3.4 user_interests（用户兴趣聚合，线上读取主源）

```javascript
{
  _id: "ui_${openid}",
  _openid: "user_openid_123",
  interestedAuthors: [ { authorId, weight, viewCount, lastInteractAt } ], // Top-K, K<=50
  interestedTags:    [ { tag,      weight, viewCount, lastInteractAt } ], // Top-K, K<=100
  totalViews30d: 150,
  totalDuration30d: 6750,
  activeDays30d: 12,
  lastUpdatedAt: ISODate(),
  nextUpdateAt: ISODate() // 用于调度（可选）
}
```

索引：
- `_openid` 唯一；`(nextUpdateAt)`（可选）。

### 3.5 post_statistics（内容聚合，线上榜单/排序主源）

```javascript
{
  _id: "ps_${postId}",
  postId: "post_id_abc",
  viewCount30d: 1250,
  uniqueViewers30d: 856,
  avgDuration30d: 38.5,
  totalDuration30d: 48125,
  dailyViews: [ { date: "2025-01-15", views: 45, uniqueViewers: 32 } ], // 仅保留近30天
  lastViewAt: ISODate(),
  lastUpdatedAt: ISODate(),
  nextUpdateAt: ISODate()
}
```

索引：
- `postId` 唯一；常用排序索引如 `(viewCount30d desc, lastViewAt desc)`。

### 3.6 user_recent_views（可选：近期浏览缓存，限长）

```javascript
{
  _id: "urv_${openid}",
  _openid: "user_openid_123",
  items: [ { postId, viewedAt } ], // 固定长度 N<=200
  updatedAt: ISODate()
}
```

维护策略：通过 Job 或写入路径裁剪为最近 N 条；避免大数组膨胀。

## 4. 前端埋点与可靠上报

- 本地队列：进入详情页/曝光即入队；定时(如10s)与 `onHide` 触发 flush；失败指数退避并落盘缓存。
- 批量上报：云函数 `recordEventBatch`，单次最多 50–100 条。
- 字段最小化：仅 postId/ts/sessionId/可选 duration，其他信息服务器侧查表补齐（如作者/标签）。

示例（伪代码，uni-app）：
```javascript
let q = []
function enqueueView(postId, duration=0) {
  q.push({ postId, ts: Date.now(), sessionId: getSessionId(), duration })
}
async function flush() {
  if (!q.length) return
  const batch = q.splice(0, 50)
  try {
    await uniCloud.callFunction({ name: 'recordEventBatch', data: { events: batch } })
  } catch (e) {
    // 回退：重新塞回并延迟重试
    q = batch.concat(q)
    setTimeout(flush, 5000)
  }
}
setInterval(flush, 10000)
uni.onHide(flush)
```

## 5. 云函数与定时任务（骨架）

### 5.1 recordEventBatch（事件写入，幂等去重）

关键点：
- 生成幂等 `_id = ev_${openid}_${postId}_${sessionId}_${minute}`；
- 使用 `doc(id).set()` 写入；若重复可选择忽略或用 `update` 做 `$max(duration)`；
- 批量写分批次进行（每批 20–50 条）。

伪代码（wx-server-sdk）：
```javascript
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID || event.openid
  const events = (event.events || []).slice(0, 100)
  const now = new Date()

  const tasks = []
  for (const e of events) {
    const ts = new Date(e.ts || Date.now())
    const minute = formatMinute(ts) // yyyymmddHHmm
    const id = `ev_${openid}_${e.postId}_${e.sessionId || 's'}_${minute}`
    const doc = {
      _id: id, _openid: openid, postId: e.postId, ts,
      sessionId: e.sessionId || '', duration: e.duration || 0
    }
    tasks.push(db.collection('view_events').doc(id).set({ data: doc }).catch(async err => {
      // 已存在则尽量更新时长上限
      try {
        await db.collection('view_events').doc(id).update({
          data: { duration: db.command.max(e.duration || 0) }
        })
      } catch (_) { /* 忽略 */ }
    }))
  }
  // 分批并发
  while (tasks.length) await Promise.all(tasks.splice(0, 20))
  return { success: true, count: events.length }
}
```

### 5.2 aggregateUserPostDay（从事件层滚动汇总到日分桶）

策略：
- 以“滑动时间窗”拉取 `view_events`（例如近 65 分钟），避免长事务；
- 内存分组 `key = openid+postId+day` 并累计计数/时长/首末时间；
- 对 `user_post_day` 以 `_id` 原子 `$inc/$min/$max` upsert（先 `update`，0 行则 `set`）。

伪代码：
```javascript
const _ = db.command
// 省略分页拉取与断点续跑(lastProcessedTs)存储
await db.collection('user_post_day').doc(key).update({
  data: {
    views: _.inc(deltaViews),
    duration: _.inc(deltaDuration),
    firstAt: _.min(firstAt),
    lastAt: _.max(lastAt),
    _openid: openid, postId, day
  }
}).then(res => {
  if (!res.stats.updated) {
    return db.collection('user_post_day').doc(key).set({ data: {
      _id: key, _openid: openid, postId, day,
      views: deltaViews, viewUsers: 1,
      duration: deltaDuration, firstAt, lastAt
    }})
  }
})
```

同时可归并到 `post_day`：按 `(postId, day)` 聚合 `views/duration`；`uniqueViewers` 可由 `user_post_day` 同日汇总获得。

### 5.3 buildUserInterests（生成用户兴趣 Top-K）

输入：近 30 天 `user_post_day` 与内容的标签/作者映射；
输出：`user_interests` 的作者/标签 Top-K 与权重（时间衰减）。

权重示例：`w = views * 1.0 + duration/30`，并乘以时间衰减 `decay = 0.9^(daysAgo/3)`；
仅保留 Top 50 作者与 Top 100 标签。

### 5.4 buildPostStatistics（生成内容聚合与日序列）

从 `post_day` 汇总 30 天窗口：`viewCount30d/uniqueViewers30d/avgDuration30d/dailyViews`；
写入 `post_statistics`，并维护排序索引（如 viewCount30d）。

### 5.5 trimUserRecentViews（可选：维护近期浏览缓存）

来源：事件层或日分桶层；把用户最近 N=200 条浏览写入 `user_recent_views.items`；
裁剪：定时任务或写入后裁剪，确保文档不超过 N。

## 6. 查询改造（线上路径）

- 推荐/个性化：只读 `user_interests`，直接拿 Top 标签/作者召回与排序。
- 热榜/趋势：只读 `post_statistics`，按 30d 视图/近 24h 提升幅等排序。
- 最近浏览：读 `user_recent_views`（若开启），或退化为按 `view_events` 近时序查前 50 条。

## 7. 保留、TTL 与归档

- `view_events.ts`：TTL 30–90 天（控制台建 TTL 索引）；若无 TTL 支持，定时 Job 删除过期。
- `user_post_day/post_day`：保留 90–180 天（成本与报表需要权衡）。
- `user_interests/post_statistics`：长期保留，仅存滚动窗口指标与 Top-K。

## 8. 发布与迁移计划（可灰度回滚）

1) 创建集合与索引：`view_events/user_post_day/post_day/user_interests/post_statistics/user_recent_views`。
2) 上线 `recordEventBatch`，前端灰度 10% 流量上报（同时保留旧写入链路作为镜像以对账）。
3) 上线 `aggregateUserPostDay`，分钟级/5 分钟级触发；观察延迟与写放大。
4) 上线 `buildUserInterests` 与 `buildPostStatistics`，小时级或日级触发。
5) 读路径灰度：推荐/榜单接口切到聚合层（先读双写比对，后只读新源）。
6) 清理：确认一致性后，逐步下线旧的“按事件实时查询”路径；设置事件 TTL。
7) 回滚预案：保留旧查询实现与特征开关，必要时一键回切。

## 9. 监控与告警

- 事件吞吐：每分钟写入量、失败率、平均延迟。
- 聚合滞后：各 Job 的水位(lastProcessedTs)与滞后时长。
- 文档大小：采样 `user_recent_views` 与聚合文档尺寸；接近 16MB 告警并触发裁剪。
- 成本指标：集合存储量、日写入次数、聚合函数耗时/失败率。

## 10. 限流与保护

- 客户端：队列上限（如 500 条），超限丢弃最早；离线积压上限（时间或条数）。
- 服务端：同一 openid QPS 限制；批写每批 20–50；单次函数超时保护。
- 幂等：统一 `_id` 规则与“update-or-set”写法，避免重复写放大。

## 11. 校验与测试

- 端到端回归：对比“旧实现 vs 新实现”的推荐/榜单一致性与时效性；
- 对账：`sum(user_post_day.views)` ≈ `事件数`（在窗口内），“uniqueViewers” 与用户集合基数一致；
- 压测：批写 1k/5k/10k 事件吞吐下，聚合滞后与错误率。

## 12. 附：索引与清理示例

TTL 示例（若控制台支持 TTL 索引）：
```javascript
// view_events.ts TTL = 30天
{ name: 'ttl_ts', fields: { ts: 1 }, expireAfterSeconds: 30 * 24 * 60 * 60 }
```

定时清理兜底（无 TTL 时）：
```javascript
const expire = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
await db.collection('view_events').where({ ts: db.command.lt(expire) }).remove()
```

---

实施优先级建议：
1) 事件写入与TTL -> 2) 日分桶聚合 -> 3) 用户兴趣/内容统计 -> 4) 读路径切换 -> 5) 最近浏览缓存（可选）。

