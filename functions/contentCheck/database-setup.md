# 数据库集合设置说明

## 需要创建的集合

### 1. moderation_logs（审核日志）

用于存储所有审核请求的详细信息。

**集合名称**: `moderation_logs`

**索引配置**:
- `openid`: 普通索引（用于查询用户的审核历史）
- `createTime`: 普通索引（用于时间范围查询）

**权限配置**:
- 仅创建者可读写（使用 `_openid` 字段）

### 2. access_tokens（访问令牌缓存）

用于缓存微信 access_token。

**集合名称**: `access_tokens`

**索引配置**:
- `updateTime`: 普通索引（用于查询最新的 token）

**权限配置**:
- 仅云函数可读写

### 3. moderation_cache（审核结果缓存）

用于缓存审核结果（5分钟 TTL）。

**集合名称**: `moderation_cache`

**索引配置**:
- `fingerprint`: 唯一索引（用于快速查找缓存）
- `createTime`: TTL 索引，过期时间 300 秒（5分钟）

**权限配置**:
- 仅云函数可读写

## 创建步骤

### 方式一：通过云开发控制台手动创建

1. 登录微信云开发控制台
2. 进入数据库管理
3. 创建以上三个集合
4. 为每个集合添加相应的索引

### 方式二：通过云函数自动创建

可以创建一个初始化云函数来自动创建集合和索引。

```javascript
// functions/initContentCheckDB/index.js
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

exports.main = async (event, context) => {
  try {
    // 创建 moderation_logs 集合
    await db.createCollection('moderation_logs');
    console.log('✅ 创建 moderation_logs 集合成功');
    
    // 创建 access_tokens 集合
    await db.createCollection('access_tokens');
    console.log('✅ 创建 access_tokens 集合成功');
    
    // 创建 moderation_cache 集合
    await db.createCollection('moderation_cache');
    console.log('✅ 创建 moderation_cache 集合成功');
    
    return {
      success: true,
      message: '数据库集合创建成功'
    };
  } catch (error) {
    console.error('❌ 创建数据库集合失败:', error);
    return {
      success: false,
      message: error.message
    };
  }
};
```

**注意**: 索引需要在云开发控制台手动创建，因为云函数 API 不支持创建索引。

## 索引创建示例

### moderation_logs 索引

```json
{
  "openid": 1
}
```

```json
{
  "createTime": -1
}
```

### access_tokens 索引

```json
{
  "updateTime": -1
}
```

### moderation_cache 索引

```json
{
  "fingerprint": 1
}
```
（设置为唯一索引）

```json
{
  "createTime": 1
}
```
（设置为 TTL 索引，过期时间 300 秒）

## 数据示例

### moderation_logs 文档示例

```json
{
  "_id": "xxx",
  "_openid": "oABC123...",
  "openid": "oABC123...",
  "type": "text",
  "content": "这是一段测试文本...",
  "scene": 2,
  "result": {
    "suggest": "pass",
    "label": 100
  },
  "detail": [],
  "passed": true,
  "createTime": "2024-01-01T00:00:00.000Z"
}
```

### access_tokens 文档示例

```json
{
  "_id": "xxx",
  "token": "65_xxx...",
  "expiresAt": "2024-01-01T02:00:00.000Z",
  "updateTime": "2024-01-01T00:00:00.000Z"
}
```

### moderation_cache 文档示例

```json
{
  "_id": "xxx",
  "fingerprint": "abc123...",
  "result": {
    "success": true,
    "passed": true,
    "message": "审核通过"
  },
  "createTime": "2024-01-01T00:00:00.000Z"
}
```
