# 改进后的数据库结构设计

## 一、总体架构

```
浏览事件流：
用户浏览帖子 
  ↓
view_log（明细表 - 热数据，30天TTL）
  ↓
定时任务聚合（每天凌晨）
  ↓
user_interests（用户兴趣聚合表 - 长期数据）
post_statistics（帖子统计表 - 长期数据）
```

## 二、集合详细设计

### 2.1 view_log（浏览明细表 - 改进版）

**用途**：记录用户每次浏览行为，用于实时分析和短期统计

**字段结构**：
```javascript
{
  _id: "view_log_id_xxxxx",           // 系统自动生成
  _openid: "user_openid_123",          // 用户ID（索引字段）
  postId: "post_id_abc123",            // 帖子ID（索引字段）
  type: "view",                        // 类型：固定为"view"（索引字段）
  
  // 浏览行为数据
  viewDuration: 45,                    // 浏览时长（秒）
  firstViewTime: ISODate("2024-01-15T10:30:00Z"),  // 首次查看时间
  lastViewTime: ISODate("2024-01-15T10:31:30Z"),  // 最后查看时间（用于更新）
  viewCount: 3,                        // 浏览次数（同一帖子多次查看累计）
  
  // 元数据
  createTime: ISODate("2024-01-15T10:30:00Z"),    // 创建时间（TTL索引字段）
  updateTime: ISODate("2024-01-15T10:31:30Z")    // 更新时间
}
```

**索引设计**：
```javascript
// 1. 复合索引 - 用于推荐算法查询用户浏览记录
{
  name: "idx_user_type_time",
  fields: { _openid: 1, type: 1, createTime: -1 }
}

// 2. 唯一索引 - 确保同一用户对同一帖子只有一条记录（改进去重）
{
  name: "idx_user_post_unique",
  fields: { _openid: 1, postId: 1 },
  unique: true  // 唯一约束
}

// 3. 复合索引 - 用于帖子统计分析
{
  name: "idx_post_time",
  fields: { postId: 1, createTime: -1 }
}

// 4. TTL索引 - 自动删除30天前的数据
{
  name: "idx_ttl",
  fields: { createTime: 1 },
  expireAfterSeconds: 2592000  // 30天 = 30 * 24 * 60 * 60
}
```

**使用场景**：
- ✅ 记录每次浏览行为
- ✅ 实时查询最近30天的浏览记录
- ✅ 用于短期的用户行为分析

---

### 2.2 user_interests（用户兴趣聚合表 - 新增）

**用途**：存储用户长期兴趣画像，推荐算法直接读取此表，不需要查询原始记录

**字段结构**：
```javascript
{
  _id: "user_interests_openid_123",    // 使用 openid 作为ID，便于快速查找
  _openid: "user_openid_123",          // 用户ID（唯一索引）
  
  // 兴趣作者列表（来自用户浏览/点赞过的帖子作者）
  interestedAuthors: [
    {
      authorId: "author_openid_1",     // 作者ID
      weight: 0.85,                     // 权重（0-1），基于互动次数和时长
      firstInteractTime: ISODate(),    // 首次互动时间
      lastInteractTime: ISODate(),     // 最近互动时间
      viewCount: 15,                   // 浏览该作者帖子的次数
      avgViewDuration: 42.5             // 平均浏览时长（秒）
    },
    {
      authorId: "author_openid_2",
      weight: 0.62,
      // ... 同上
    }
  ],
  
  // 兴趣标签列表（来自用户浏览/点赞过的帖子标签）
  interestedTags: [
    {
      tag: "诗歌",                      // 标签名称
      weight: 0.90,                     // 权重
      viewCount: 25,                    // 浏览该标签帖子的次数
      avgViewDuration: 55.2,
      firstInteractTime: ISODate(),
      lastInteractTime: ISODate()
    },
    {
      tag: "现代诗",
      weight: 0.75,
      // ... 同上
    }
  ],
  
  // 统计信息
  totalViews: 150,                      // 总浏览次数（最近30天）
  totalViewDuration: 6750,             // 总浏览时长（秒）
  avgViewDuration: 45.0,               // 平均浏览时长（秒）
  activeDays: 12,                       // 活跃天数（最近30天）
  
  // 时间戳
  firstCreatedAt: ISODate("2024-01-01T00:00:00Z"),  // 首次创建时间
  lastUpdatedAt: ISODate("2024-01-15T23:59:59Z"),  // 最后更新时间
  nextUpdateAt: ISODate("2024-01-16T02:00:00Z")    // 下次更新计划时间（用于定时任务）
}
```

**索引设计**：
```javascript
// 1. 唯一索引 - 每个用户只有一条兴趣记录
{
  name: "idx_openid_unique",
  fields: { _openid: 1 },
  unique: true
}

// 2. 复合索引 - 用于查找高活跃用户
{
  name: "idx_activity",
  fields: { totalViews: -1, lastUpdatedAt: -1 }
}

// 3. 索引 - 用于定时任务查询需要更新的用户
{
  name: "idx_update_time",
  fields: { nextUpdateAt: 1 }
}
```

**更新策略**：
- **触发时机**：每天凌晨 2:00 定时任务
- **更新逻辑**：
  1. 查询最近30天的 `view_log` 数据
  2. 聚合统计用户的作者和标签偏好
  3. 计算权重（基于互动次数、时长、时间衰减）
  4. 更新 `user_interests` 表

**使用场景**：
- ✅ 推荐算法快速获取用户兴趣（不需要查询原始记录）
- ✅ 用户画像分析
- ✅ 个性化内容推荐

---

### 2.3 post_statistics（帖子统计表 - 新增）

**用途**：存储帖子的浏览统计数据，用于热门度计算和内容分析

**字段结构**：
```javascript
{
  _id: "post_stats_post_id_abc123",    // 使用 postId 作为ID
  postId: "post_id_abc123",            // 帖子ID（唯一索引）
  
  // 浏览统计数据（最近30天）
  viewCount: 1250,                      // 浏览次数
  uniqueViewers: 856,                   // 独立访客数
  avgViewDuration: 38.5,                // 平均浏览时长（秒）
  totalViewDuration: 48125,             // 总浏览时长（秒）
  
  // 时间分布
  dailyViews: [
    {
      date: "2024-01-15",               // 日期
      views: 45,                        // 当日浏览量
      uniqueViewers: 32                 // 当日独立访客
    }
    // ... 最近30天的每日数据
  ],
  
  // 用户质量指标
  completionRate: 0.68,                 // 完成率（浏览时长 > 10秒的比例）
  bounceRate: 0.15,                     // 跳出率（浏览时长 < 5秒的比例）
  
  // 时间戳
  firstViewAt: ISODate("2024-01-01T10:00:00Z"),    // 首次被浏览时间
  lastViewAt: ISODate("2024-01-15T23:59:59Z"),     // 最近被浏览时间
  lastUpdatedAt: ISODate("2024-01-16T02:00:00Z"),  // 统计更新时间
  nextUpdateAt: ISODate("2024-01-17T02:00:00Z")    // 下次更新计划时间
}
```

**索引设计**：
```javascript
// 1. 唯一索引 - 每个帖子只有一条统计记录
{
  name: "idx_postid_unique",
  fields: { postId: 1 },
  unique: true
}

// 2. 复合索引 - 用于热门内容排序
{
  name: "idx_hot_content",
  fields: { viewCount: -1, avgViewDuration: -1, lastViewAt: -1 }
}

// 3. 索引 - 用于定时任务
{
  name: "idx_update_time",
  fields: { nextUpdateAt: 1 }
}
```

**使用场景**：
- ✅ 热门内容排序
- ✅ 内容质量分析
- ✅ 作者数据统计

---

### 2.4 其他相关集合（保持现状或小改）

#### 2.4.1 votes_log（点赞记录表）
```javascript
// 保持现有结构，但建议添加唯一索引
{
  _id: "vote_log_id_xxx",
  _openid: "user_openid_123",
  postId: "post_id_abc123",
  type: "post",  // "post" 或 "comment"
  createTime: ISODate()
}

// 建议添加唯一索引
{
  name: "idx_vote_unique",
  fields: { _openid: 1, postId: 1, type: 1 },
  unique: true
}
```

#### 2.4.2 posts（帖子表）
```javascript
// 保持现有结构，可添加统计字段缓存（可选优化）
{
  _id: "post_id_abc123",
  // ... 现有字段
  
  // 可选：添加统计字段缓存（减少join查询）
  cachedViewCount: 1250,              // 浏览数缓存（每日更新）
  cachedAvgViewDuration: 38.5         // 平均浏览时长缓存
}
```

---

## 三、数据流转流程

### 3.1 用户浏览记录流程

```javascript
// 1. 用户浏览帖子
用户进入帖子详情页
  ↓
前端：记录 viewStartTime = Date.now()
  ↓
用户离开/隐藏页面
  ↓
前端：计算 viewDuration
  ↓
调用 recordView 云函数（带去重逻辑）

// 2. 写入 view_log（改进版）
recordView 云函数：
  - 使用 upsert 操作（基于唯一索引）
  - 如果已存在：更新 viewDuration（取较大值）、viewCount++、lastViewTime
  - 如果不存在：创建新记录
  
// 3. 定时任务聚合（每天凌晨2点）
定时任务执行：
  - 查询最近30天的 view_log 数据
  - 按用户聚合 → 更新 user_interests
  - 按帖子聚合 → 更新 post_statistics
```

### 3.2 推荐算法数据获取流程（改进后）

```javascript
// 旧方式（慢）：
getRecommendationFeed:
  - 查询 view_log（30条记录，可能很慢）
  - 实时计算用户兴趣
  - 推荐帖子

// 新方式（快）：
getRecommendationFeed:
  - 直接查询 user_interests（1条记录，毫秒级）
  - 获取用户兴趣标签和作者列表
  - 基于兴趣推荐帖子（不需要实时计算）
```

---

## 四、数据库索引总览

### 4.1 view_log 集合索引

| 索引名称 | 字段 | 类型 | 用途 |
|---------|------|------|------|
| idx_user_type_time | (_openid, type, createTime) | 复合索引 | 推荐算法查询用户浏览记录 |
| idx_user_post_unique | (_openid, postId) | 唯一索引 | 去重，确保每个用户每帖一条记录 |
| idx_post_time | (postId, createTime) | 复合索引 | 帖子统计分析 |
| idx_ttl | (createTime) | TTL索引 | 30天自动删除旧数据 |

### 4.2 user_interests 集合索引

| 索引名称 | 字段 | 类型 | 用途 |
|---------|------|------|------|
| idx_openid_unique | (_openid) | 唯一索引 | 快速查找用户兴趣 |
| idx_activity | (totalViews, lastUpdatedAt) | 复合索引 | 查找高活跃用户 |
| idx_update_time | (nextUpdateAt) | 普通索引 | 定时任务查询 |

### 4.3 post_statistics 集合索引

| 索引名称 | 字段 | 类型 | 用途 |
|---------|------|------|------|
| idx_postid_unique | (postId) | 唯一索引 | 快速查找帖子统计 |
| idx_hot_content | (viewCount, avgViewDuration, lastViewAt) | 复合索引 | 热门内容排序 |
| idx_update_time | (nextUpdateAt) | 普通索引 | 定时任务查询 |

### 4.4 votes_log 集合索引（建议添加）

| 索引名称 | 字段 | 类型 | 用途 |
|---------|------|------|------|
| idx_vote_unique | (_openid, postId, type) | 唯一索引 | 防止重复点赞 |
| idx_user_vote_time | (_openid, type, createTime) | 复合索引 | 用户点赞记录查询 |

---

## 五、数据量估算

### 5.1 数据量估算（假设场景）

**场景**：1000个活跃用户，每人每天浏览20个帖子

**view_log（明细表）**：
- 每天新增：1000 × 20 = 20,000 条
- 30天总量：600,000 条（TTL自动清理30天前的数据）
- **存储优化**：通过TTL索引，永久存储量控制在60万条

**user_interests（聚合表）**：
- 用户数：1000 条（每个用户一条记录）
- 每条记录大小：约 2-5KB（取决于兴趣数量）
- 总大小：约 2-5MB

**post_statistics（统计表）**：
- 帖子数：假设10,000个活跃帖子
- 每条记录大小：约 1-3KB
- 总大小：约 10-30MB

**总存储量估算**：
- view_log：约 120MB（30天数据）
- user_interests：约 5MB
- post_statistics：约 30MB
- **总计**：约 155MB（相比永久存储所有明细，节省约80%存储）

### 5.2 性能提升估算

**查询性能对比**：

| 场景 | 旧方式 | 新方式 | 提升倍数 |
|------|--------|--------|---------|
| 推荐算法获取用户兴趣 | 查询30条view_log，实时计算 | 直接读取1条user_interests | **10-100倍** |
| 帖子统计分析 | 聚合查询view_log | 直接读取post_statistics | **50-200倍** |
| 存储成本 | 永久增长 | TTL自动清理 | **节省80%** |

---

## 六、迁移方案（如需要）

### 6.1 渐进式迁移（推荐）

**阶段1：添加新集合和索引（不影响现有功能）**
```javascript
1. 创建 user_interests 集合
2. 创建 post_statistics 集合
3. 添加 view_log 的索引（包括唯一索引和TTL）
4. 系统正常运行，新老方式并存
```

**阶段2：编写定时任务**
```javascript
1. 编写聚合定时任务
2. 每天凌晨聚合前一天的数据
3. 验证数据准确性
```

**阶段3：优化推荐算法**
```javascript
1. 修改 getRecommendationFeed 使用 user_interests
2. A/B测试对比性能
3. 逐步切换所有推荐接口
```

**阶段4：清理旧数据（可选）**
```javascript
1. TTL索引自动清理30天前的view_log
2. 或手动清理历史数据（保留统计摘要）
```

### 6.2 数据回填（如需历史数据）

```javascript
// 如果已有历史view_log数据，可以回填聚合表
1. 编写回填脚本
2. 按用户聚合历史view_log → user_interests
3. 按帖子聚合历史view_log → post_statistics
4. 验证数据完整性
```

---

## 七、总结

### 7.1 改进后的优势

✅ **查询性能**：推荐算法查询速度提升 10-100倍
✅ **存储优化**：通过TTL和数据聚合，存储成本降低 80%
✅ **可扩展性**：支持更大规模用户（10万+用户）
✅ **数据完整性**：唯一索引确保数据一致性
✅ **自动化**：TTL和定时任务自动维护数据

### 7.2 关键设计原则

1. **数据分层**：明细数据（热数据，短期）+ 聚合数据（冷数据，长期）
2. **读写分离**：写操作写入明细表，读操作读取聚合表
3. **异步处理**：定时任务异步聚合，不影响用户体验
4. **自动维护**：TTL索引自动清理旧数据

---

## 附录：云开发控制台操作指南

### 创建索引（view_log）

```javascript
// 1. 复合索引：(_openid, type, createTime)
{
  "name": "idx_user_type_time",
  "keys": {
    "_openid": 1,
    "type": 1,
    "createTime": -1
  }
}

// 2. 唯一索引：(_openid, postId)
{
  "name": "idx_user_post_unique",
  "keys": {
    "_openid": 1,
    "postId": 1
  },
  "unique": true
}

// 3. TTL索引：createTime（30天过期）
{
  "name": "idx_ttl",
  "keys": {
    "createTime": 1
  },
  "expireAfterSeconds": 2592000
}
```

### 创建集合（user_interests）

```javascript
// 在云开发控制台创建新集合：user_interests

// 添加索引
{
  "name": "idx_openid_unique",
  "keys": { "_openid": 1 },
  "unique": true
}
```

---

**文档版本**：v1.0  
**最后更新**：2024-01-16
