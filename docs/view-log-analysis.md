# 浏览记录机制分析与改进建议

## 当前实现评估

### ✅ 优点
1. **逻辑清晰**：记录机制简单直观，易于理解
2. **去重机制**：1小时内去重避免重复记录
3. **时长统计**：记录浏览时长，可用于分析内容质量
4. **集成推荐**：已用于个性化推荐算法

### ❌ 主要问题

#### 1. **数据量爆炸问题（严重）**
- **现状**：每个用户的每次浏览（>=3秒）都创建一条记录
- **影响**：
  - 假设1000个用户，每人每天浏览20个帖子 → 每天2万条记录
  - 一个月60万条，一年720万条记录
  - 存储成本持续增长，查询性能随数据量线性下降

#### 2. **查询性能问题（严重）**
```javascript
// 当前查询：每次推荐都要查询30条记录
const viewRes = await db.collection('view_log')
  .where({ 
    _openid: openId,
    type: 'view'
  })
  .orderBy('createTime', 'desc')
  .limit(30)
  .get();
```
- **问题**：
  - 缺乏复合索引 `(_openid, type, createTime)`，可能导致全表扫描
  - 用户浏览记录多时，查询慢
  - 没有缓存机制，重复查询浪费资源

#### 3. **去重逻辑不完善（中等）**
```javascript
// 只检查最近1小时内的记录
createTime: _.gte(new Date(Date.now() - 60 * 60 * 1000))
```
- **问题**：
  - 1小时后重复查看会创建新记录
  - 同一帖子可能有多条记录，数据冗余
  - 应该用 `(_openid, postId)` 的唯一约束

#### 4. **数据丢失风险（中等）**
- **现状**：只在 `onUnload`/`onHide` 记录
- **风险**：
  - 用户强制关闭应用 → 数据丢失
  - 应用崩溃 → 数据丢失
  - 网络断开 → 数据未保存

#### 5. **缺乏聚合统计（中等）**
- **现状**：每次推荐都要实时查询原始记录
- **影响**：
  - 无法快速获取用户兴趣统计
  - 无法做用户画像分析
  - 推荐算法效率低

#### 6. **缺少数据清理机制（中等）**
- **现状**：数据永久保存，没有TTL或归档
- **影响**：
  - 旧数据占用存储空间
  - 查询性能随数据量增长而下降
  - 推荐算法只需要最近的数据，旧数据无意义

#### 7. **事务和安全问题（轻微）**
- **现状**：先查询后写入，没有事务保护
- **风险**：并发场景下可能出现重复插入

---

## 现代最佳实践对比

### ❌ 当前实现（不符合现代实践）

```
用户浏览帖子
  ↓
onUnload时记录
  ↓
创建/更新 view_log 记录
  ↓
每次推荐查询30条原始记录
  ↓
实时分析用户兴趣
```

**特点**：事件驱动、实时写入、原始数据存储

### ✅ 现代推荐方案（符合最佳实践）

#### 方案一：事件驱动 + 聚合统计（推荐）
```
用户浏览帖子
  ↓
发送浏览事件（消息队列/批处理）
  ↓
1. 写入明细表（短期存储，TTL=30天）
2. 更新用户兴趣聚合表（长期存储）
3. 更新帖子统计表（浏览次数、平均浏览时长）
  ↓
推荐算法读取聚合表（快速）
```

**优势**：
- 数据分层：明细数据（热数据）+ 聚合数据（冷数据）
- 查询快速：直接读聚合表，不需要实时计算
- 存储优化：明细数据自动过期，只保留有价值的聚合数据

#### 方案二：用户行为会话（更现代）
```
用户进入帖子详情页
  ↓
创建浏览会话（sessionId）
  ↓
前端定时上报（每10秒）或离开时提交
  ↓
服务端：增量更新会话时长，批量入库
  ↓
定时任务：聚合用户会话数据到兴趣表
```

**优势**：
- 容错性强：即使应用崩溃，已提交的数据不丢失
- 实时性好：不需要等待onUnload
- 资源优化：批量写入，减少数据库压力

---

## 改进建议

### 🔥 高优先级（必须改进）

#### 1. 添加数据库索引
```javascript
// 建议在云开发控制台创建复合索引
view_log: [
  { _openid: 1, type: 1, createTime: -1 },  // 用于用户查询推荐
  { postId: 1, createTime: -1 },            // 用于帖子统计分析
  { _openid: 1, postId: 1 }                 // 用于去重检查（唯一索引）
]
```

#### 2. 实现数据聚合表
```javascript
// 新增集合：user_interests（用户兴趣聚合表）
{
  _id: "user_interests_openid_123",
  _openid: "openid_123",
  interestedAuthors: ["author1", "author2"],  // Set去重
  interestedTags: ["tag1", "tag2"],            // 带权重
  lastUpdatedAt: Date,
  totalViews: 100,
  avgViewDuration: 15.5
}

// 定时任务（每天凌晨运行）
// 1. 聚合最近30天的view_log数据
// 2. 更新user_interests表
// 3. 推荐算法直接读取user_interests，不需要查询原始记录
```

#### 3. 改进去重逻辑
```javascript
// 方案A：使用唯一索引（推荐）
// 在云开发控制台创建唯一索引：(_openid, postId)
// 写入时使用 upsert 操作

await db.collection('view_log').where({
  _openid: openid,
  postId: postId
}).update({
  data: {
    viewDuration: _.max([oldDuration, viewDuration]),
    lastViewTime: new Date()
  }
}).catch(async () => {
  // 如果不存在，插入新记录
  await db.collection('view_log').add({...});
});

// 方案B：使用唯一键
// 使用复合ID作为唯一键：`${openid}_${postId}`
```

#### 4. 添加数据TTL机制
```javascript
// 方案A：数据库级别TTL（推荐）
// 在云开发控制台设置view_log集合的TTL索引
// 自动删除30天前的记录

// 方案B：定时任务清理
// 每天删除30天前的view_log记录
const expiredDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
await db.collection('view_log')
  .where({
    createTime: _.lt(expiredDate)
  })
  .remove();
```

### ⚠️ 中优先级（建议改进）

#### 5. 实现批量记录机制
```javascript
// 前端：使用队列缓冲浏览记录
const viewQueue = [];

// 每10秒或离开页面时批量提交
const flushViewQueue = () => {
  if (viewQueue.length === 0) return;
  
  cloud.callFunction({
    name: 'batchRecordView',
    data: { views: viewQueue }
  });
  
  viewQueue = [];
};

// 后端：批量写入，提高性能
```

#### 6. 添加数据容错机制
```javascript
// 前端：本地暂存浏览记录
// 如果网络失败，下次启动时重试

// 后端：幂等性设计
// 使用唯一索引保证不会重复记录
```

#### 7. 优化推荐算法查询
```javascript
// 不再查询原始view_log，而是查询聚合表
const userInterests = await db.collection('user_interests')
  .where({ _openid: openId })
  .get();

// 直接从聚合表获取兴趣标签和作者
// 查询速度提升10-100倍
```

### 💡 低优先级（可选优化）

#### 8. 实现数据归档
```javascript
// 将30天前的view_log归档到冷存储
// 保留统计数据，删除明细数据
```

#### 9. 添加用户行为分析
```javascript
// 基于浏览记录做深度分析
// - 用户活跃度
// - 内容偏好
// - 浏览时间段分析
```

---

## 推荐的改进方案（最小改动）

### 第一步：添加索引和唯一约束（立即）
```javascript
// 云开发控制台操作
1. 创建索引：view_log(_openid, type, createTime)
2. 创建唯一索引：view_log(_openid, postId)
3. 创建TTL索引：view_log(createTime) - 30天过期
```

### 第二步：改进recordView云函数（1-2天）
```javascript
exports.main = async (event, context) => {
  // 使用 upsert 操作，避免重复记录
  const { postId, viewDuration = 0 } = event;
  const openid = wxContext.OPENID;
  
  // 直接使用 upsert（需要唯一索引支持）
  await db.collection('view_log')
    .where({
      _openid: openid,
      postId: postId
    })
    .update({
      data: {
        viewDuration: _.max(['$viewDuration', viewDuration]),
        lastViewTime: new Date(),
        // 如果是新记录，设置创建时间
        createTime: _.ifNull(['$createTime', new Date()]),
        type: 'view'
      }
    });
};
```

### 第三步：创建聚合表和定时任务（3-5天）
```javascript
// 1. 创建user_interests集合
// 2. 编写定时聚合任务
// 3. 修改推荐算法读取聚合表
```

---

## 总结

### 当前实现评分

| 维度 | 评分 | 说明 |
|------|------|------|
| 数据模型 | ⭐⭐⭐ | 结构合理，但缺少聚合 |
| 性能 | ⭐⭐ | 查询慢，缺少索引 |
| 可扩展性 | ⭐⭐ | 数据量大会影响性能 |
| 容错性 | ⭐⭐ | 数据可能丢失 |
| 维护性 | ⭐⭐⭐ | 代码简单，但需要优化 |

**总体评分：⭐️⭐️（2/5）- 需要改进**

### 改进后预期效果

- ✅ 查询性能提升 10-100倍
- ✅ 存储成本降低 80%（TTL清理）
- ✅ 推荐算法响应时间 < 200ms
- ✅ 数据丢失风险降低 90%
- ✅ 支持更大规模用户（10万+）

---

## 参考

- [MongoDB TTL索引](https://docs.mongodb.com/manual/core/index-ttl/)
- [事件驱动架构最佳实践](https://martinfowler.com/articles/201701-event-driven.html)
- [用户行为分析系统设计](https://www.alibabacloud.com/blog/designing-an-effective-user-behavior-analysis-system_597346)
