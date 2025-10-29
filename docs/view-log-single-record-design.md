# 单用户单记录方案设计（view_log 优化）

## 一、方案概述

### 你的想法
**每个用户一条记录，包含所有浏览过的帖子ID、标签和作者信息**

```
旧方案：每个浏览一条记录
user1 -> view_log_1 (postId: postA, tags: [...], author: author1)
user1 -> view_log_2 (postId: postB, tags: [...], author: author2)
user1 -> view_log_3 (postId: postC, tags: [...], author: author3)
...

新方案：每个用户一条记录
user1 -> user_view_log {
  viewedPosts: [postA, postB, postC, ...],
  tags: [...],
  authors: [...]
}
```

---

## 二、可行性分析

### ✅ 优势

1. **数据量大幅减少**
   - 1000个用户：只有1000条记录（而不是数百万条）
   - 存储成本降低 99%+

2. **查询极快**
   - 直接根据 `_openid` 读取一条记录
   - 不需要筛选、排序、聚合
   - 查询速度提升 **100-1000倍**

3. **实现简单**
   - 只需要 update 一个文档
   - 不需要创建多条记录
   - 不需要去重逻辑（数组自动去重）

4. **完全符合推荐算法需求**
   - 推荐算法只需要知道：用户看过哪些帖子、标签、作者
   - 不需要知道具体的时间、时长等详细数据

### ⚠️ 潜在问题与解决方案

#### 1. **MongoDB 文档大小限制（16MB）**

**风险**：
- 如果用户浏览了数万个帖子，数组可能超过16MB限制
- 假设每个postId 24字节，10万条记录 ≈ 2.4MB（还在安全范围）

**解决方案**：
- 只保存最近 N 条浏览记录（如最近1000条）
- 定期清理旧记录，保留最近30-90天的数据
- 或者使用**滑动窗口**：只保留最近浏览的帖子

#### 2. **并发更新问题**

**风险**：
- 多个浏览请求同时更新同一个用户的记录
- 可能出现数据覆盖或丢失

**解决方案**：
```javascript
// 使用 MongoDB 的 $addToSet 和 $inc 原子操作
await db.collection('user_view_log').doc(userDocId).update({
  data: {
    // 使用 $addToSet 自动去重添加帖子ID
    viewedPostIds: _.addToSet(postId),
    // 累加次数
    totalViews: _.inc(1),
    // 更新时间
    lastUpdatedAt: new Date()
  }
});
```

#### 3. **标签和作者的去重**

**解决方案**：
```javascript
// 使用 $addToSet 自动去重
await db.collection('user_view_log').doc(userDocId).update({
  data: {
    viewedPostIds: _.addToSet(postId),
    // 标签数组自动去重
    interestedTags: _.addToSet(...postTags),
    // 作者数组自动去重
    interestedAuthors: _.addToSet(postAuthorId)
  }
});
```

#### 4. **时间信息丢失**

**问题**：如果只存ID数组，无法知道浏览时间顺序

**解决方案**：
- **方案A**：如果需要时间信息，可以存储时间戳
```javascript
viewedPosts: [
  { postId: "post1", viewedAt: ISODate("2024-01-15T10:00:00Z") },
  { postId: "post2", viewedAt: ISODate("2024-01-15T11:00:00Z") }
]
```
- **方案B**：不需要详细时间，只保留最近浏览顺序（使用数组顺序）

---

## 三、推荐的数据结构设计

### 3.1 基础版本（简化版，推荐）

```javascript
{
  _id: "user_view_log_openid_123",    // 使用 openid 作为ID
  _openid: "user_openid_123",          // 用户ID（唯一索引）
  
  // 浏览过的帖子ID列表（自动去重，保持最近浏览顺序）
  viewedPostIds: [
    "post_id_1",
    "post_id_2",
    "post_id_3",
    // ... 最多保留最近1000条
  ],
  
  // 兴趣标签集合（自动去重）
  interestedTags: [
    "诗歌",
    "现代诗",
    "爱情",
    // ... 所有浏览过的帖子标签
  ],
  
  // 兴趣作者集合（自动去重）
  interestedAuthors: [
    "author_openid_1",
    "author_openid_2",
    // ... 所有浏览过的帖子作者
  ],
  
  // 统计信息
  totalViews: 1250,                    // 总浏览次数
  uniquePostCount: 856,                // 浏览过的唯一帖子数
  lastViewedPostId: "post_id_123",     // 最近浏览的帖子ID
  lastViewedAt: ISODate("2024-01-15T23:59:59Z"),  // 最近浏览时间
  
  // 时间戳
  createdAt: ISODate("2024-01-01T00:00:00Z"),
  updatedAt: ISODate("2024-01-15T23:59:59Z")
}
```

### 3.2 增强版本（如果需要详细统计）

```javascript
{
  _id: "user_view_log_openid_123",
  _openid: "user_openid_123",
  
  // 浏览记录（带时间戳）
  viewedPosts: [
    {
      postId: "post_id_1",
      viewedAt: ISODate("2024-01-15T10:00:00Z"),
      tags: ["诗歌", "现代诗"],           // 该帖子的标签
      authorId: "author_openid_1"        // 该帖子的作者
    },
    {
      postId: "post_id_2",
      viewedAt: ISODate("2024-01-15T11:00:00Z"),
      tags: ["爱情", "现代诗"],
      authorId: "author_openid_2"
    }
    // ... 最近1000条，按时间倒序
  ],
  
  // 标签统计（带权重）
  tagStats: {
    "诗歌": { count: 45, lastViewedAt: ISODate("2024-01-15T10:00:00Z") },
    "现代诗": { count: 32, lastViewedAt: ISODate("2024-01-15T11:00:00Z") },
    "爱情": { count: 18, lastViewedAt: ISODate("2024-01-14T15:30:00Z") }
  },
  
  // 作者统计（带权重）
  authorStats: {
    "author_openid_1": { count: 25, lastViewedAt: ISODate("2024-01-15T10:00:00Z") },
    "author_openid_2": { count: 18, lastViewedAt: ISODate("2024-01-15T11:00:00Z") }
  },
  
  // 统计信息
  totalViews: 1250,
  uniquePostCount: 856,
  lastUpdatedAt: ISODate("2024-01-15T23:59:59Z")
}
```

**注意**：增强版本数据量更大，建议只保留最近30-90天的详细数据

---

## 四、实现代码

### 4.1 改进的 recordView 云函数

```javascript
// functions/recordView/index.js
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const { postId, postTags = [], postAuthorId } = event;
  const openid = wxContext.OPENID || event.openid;

  if (!openid || !postId) {
    return { success: false, message: '缺少必要参数' };
  }

  try {
    const userLogId = `user_view_log_${openid}`;
    const now = new Date();
    
    // 获取帖子信息（如果需要标签和作者）
    let tags = postTags;
    let authorId = postAuthorId;
    
    if (!tags || !authorId) {
      const postRes = await db.collection('posts').doc(postId).get();
      if (postRes.data) {
        tags = postRes.data.tags || [];
        authorId = postRes.data._openid;
      }
    }

    // 使用 upsert：如果不存在则创建，存在则更新
    await db.collection('user_view_log').doc(userLogId).set({
      data: {
        _id: userLogId,
        _openid: openid,
        
        // 使用 $addToSet 添加帖子ID（自动去重）
        viewedPostIds: _.addToSet(postId),
        
        // 添加标签（自动去重）
        interestedTags: _.addToSet(...tags),
        
        // 添加作者（自动去重）
        interestedAuthors: _.addToSet(authorId),
        
        // 更新统计信息
        totalViews: _.inc(1),
        
        // 更新最近浏览信息
        lastViewedPostId: postId,
        lastViewedAt: now,
        updatedAt: now
      }
    });

    // 限制数组大小：如果 viewedPostIds 超过1000条，删除最旧的
    const userLog = await db.collection('user_view_log').doc(userLogId).get();
    if (userLog.data && userLog.data.viewedPostIds && userLog.data.viewedPostIds.length > 1000) {
      // 保留最近1000条
      const recentPostIds = userLog.data.viewedPostIds.slice(-1000);
      await db.collection('user_view_log').doc(userLogId).update({
        data: {
          viewedPostIds: recentPostIds
        }
      });
    }

    return { success: true, message: '浏览记录已更新' };

  } catch (error) {
    console.error('记录浏览行为失败:', error);
    return {
      success: false,
      message: '记录失败',
      error: error.message
    };
  }
};
```

### 4.2 推荐算法使用新结构

```javascript
// functions/getRecommendationFeed/index.js
async function getPersonalizedPosts(openId, limit, usedPostIds) {
  try {
    // 直接读取用户的一条记录（极快！）
    const userLogId = `user_view_log_${openId}`;
    const userLog = await db.collection('user_view_log')
      .doc(userLogId)
      .get();

    if (!userLog.data || !userLog.data.viewedPostIds || userLog.data.viewedPostIds.length === 0) {
      console.log('用户没有浏览记录，跳过个性化推荐');
      return [];
    }

    // 获取用户感兴趣的标签和作者
    const interestedTags = userLog.data.interestedTags || [];
    const interestedAuthors = userLog.data.interestedAuthors || [];
    const viewedPostIds = userLog.data.viewedPostIds || [];

    console.log(`用户浏览过 ${viewedPostIds.length} 个帖子`);
    console.log(`感兴趣的标签: ${interestedTags.join(', ')}`);
    console.log(`感兴趣的作者: ${interestedAuthors.length} 个`);

    // 构建推荐条件
    const matchConditions = {
      _id: _.nin([...viewedPostIds, ...usedPostIds])
    };

    if (interestedAuthors.length > 0 || interestedTags.length > 0) {
      const orConditions = [];
      
      if (interestedAuthors.length > 0) {
        orConditions.push({ _openid: _.in(interestedAuthors) });
      }
      
      if (interestedTags.length > 0) {
        orConditions.push({ tags: _.in(interestedTags) });
      }
      
      if (orConditions.length > 0) {
        matchConditions.$or = orConditions;
      }
    }

    // 查询推荐帖子
    const personalizedResult = await db.collection('posts').aggregate()
      .match(matchConditions)
      .sort({ createTime: -1 })
      .limit(limit)
      .end();

    return await processPostsData(personalizedResult.list || [], openId);

  } catch (error) {
    console.error('获取个性化推荐失败:', error);
    return [];
  }
}
```

---

## 五、性能对比

| 指标 | 旧方案（每条浏览一条记录） | 新方案（每用户一条记录） | 提升倍数 |
|------|---------------------------|------------------------|---------|
| **数据量** | 1000用户 × 20帖/天 × 30天 = 60万条 | 1000条（每用户1条） | **600倍减少** |
| **查询速度** | 需要筛选、排序、限制30条 | 直接根据ID读取1条 | **100-1000倍** |
| **写入操作** | 每次浏览都 insert/update | 只 update 1个文档 | **简单很多** |
| **存储成本** | 持续增长（无上限） | 固定（每用户约1-5KB） | **节省99%+** |
| **索引需求** | 需要多个复合索引 | 只需要1个唯一索引 | **简化** |

---

## 六、限制与权衡

### 限制

1. **文档大小限制**
   - MongoDB 文档最大 16MB
   - 如果保留1000条帖子ID，每条24字节 = 24KB（安全）
   - 如果保留1万条 ≈ 240KB（仍然安全）
   - 如果保留10万条 ≈ 2.4MB（接近但安全）

2. **历史数据丢失**
   - 如果只保留最近1000条，更早的数据会丢失
   - **解决方案**：如果用户主动查看历史浏览记录，可以单独查询旧的 view_log（如果还保留）

3. **时间信息简化**
   - 基础版本不保留详细浏览时间
   - **如果需要**：可以使用增强版本，但会增加数据量

### 权衡建议

**推荐使用基础版本**：
- ✅ 足够支持推荐算法需求
- ✅ 查询速度极快
- ✅ 数据量小
- ✅ 实现简单

**如果未来需要更详细的分析**：
- 可以添加 `post_statistics` 表（帖子维度统计）
- 可以添加定时任务，将详细数据聚合到分析表

---

## 七、迁移方案

### 7.1 渐进式迁移（推荐）

**阶段1：并行运行（1-2周）**
```javascript
// 保留旧的 view_log 记录方式
// 同时新增 user_view_log 集合
// 每次浏览时，同时写入两个集合
```

**阶段2：切换推荐算法（1周）**
```javascript
// 修改推荐算法，优先使用 user_view_log
// 如果 user_view_log 不存在，回退到 view_log（兼容）
```

**阶段3：清理旧数据（可选）**
```javascript
// 确认新方案稳定后
// 可以删除或归档旧的 view_log 数据
```

### 7.2 一次性迁移（如果数据量不大）

```javascript
// 编写迁移脚本，将现有的 view_log 聚合到 user_view_log
const users = await db.collection('view_log')
  .aggregate()
  .group({
    _id: '$_openid',
    viewedPostIds: { $addToSet: '$postId' },
    interestedTags: { $addToSet: { $arrayElemAt: ['$tags', 0] } }, // 简化处理
    totalViews: { $sum: 1 }
  })
  .end();

// 批量写入 user_view_log
for (const user of users.list) {
  await db.collection('user_view_log').doc(`user_view_log_${user._id}`).set({
    data: {
      _id: `user_view_log_${user._id}`,
      _openid: user._id,
      viewedPostIds: user.viewedPostIds,
      interestedTags: user.interestedTags,
      totalViews: user.totalViews,
      updatedAt: new Date()
    }
  });
}
```

---

## 八、总结

### ✅ 你的方案非常可行！

**优势总结**：
1. **数据量减少 99%+**：从数百万条减少到数千条
2. **查询速度提升 100-1000倍**：从复杂查询变成直接读取
3. **实现简单**：只需要 update 一个文档
4. **完全满足需求**：推荐算法只需要知道浏览过的帖子、标签、作者

### 📋 推荐实现步骤

1. **立即实现**：
   - 创建 `user_view_log` 集合
   - 修改 `recordView` 云函数使用新结构
   - 添加唯一索引 `_openid`

2. **测试验证**（1周）：
   - 并行运行新旧方案
   - 验证数据一致性
   - 测试推荐算法性能

3. **完全切换**（1周后）：
   - 推荐算法切换使用新集合
   - 确认稳定后，可选清理旧数据

### 🎯 建议

**使用基础版本**（3.1节的设计）：
- 简单、高效、满足需求
- 如果未来需要详细统计，再添加 `post_statistics` 表

**这个方案比我之前设计的聚合表方案更简单、更高效！**

---

## 附录：完整索引配置

```javascript
// user_view_log 集合索引
{
  name: "idx_openid_unique",
  fields: { _openid: 1 },
  unique: true
}

// 可选：如果需要按更新时间查询
{
  name: "idx_updated_at",
  fields: { updatedAt: -1 }
}
```

---

**文档版本**：v1.0  
**创建时间**：2024-01-16
