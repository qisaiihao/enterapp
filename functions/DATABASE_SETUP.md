# 数据库初始化指南

## 概述

短信服务需要两个数据库集合：
1. **sms_codes** - 存储验证码
2. **sms_logs** - 存储发送日志（用于频率限制）

## 创建步骤

### 1. 登录微信云开发控制台

访问：https://console.cloud.tencent.com/tcb

### 2. 选择你的环境

选择你的小程序对应的云开发环境

### 3. 进入数据库管理

点击左侧菜单"数据库" > "集合"

### 4. 创建集合

#### 集合 1：sms_codes（验证码存储）

点击"添加集合"，创建集合：

**集合名称**：`sms_codes`

**字段说明**：
```javascript
{
  _id: String,           // 自动生成
  phone: String,         // 手机号
  code: String,          // 验证码（6位数字）
  scene: String,         // 场景：binding / updatePhone / resetPassword
  used: Boolean,         // 是否已使用
  createdAt: Date,       // 创建时间
  expiredAt: Date,       // 过期时间（创建时间 + 5分钟）
  clientIP: String       // 客户端IP
}
```

**索引建议**（可选，提升查询性能）：
- 索引1：`phone` + `scene` + `used` + `expiredAt`（复合索引）
- 索引2：`createdAt`（用于定期清理过期数据）

#### 集合 2：sms_logs（发送日志）

点击"添加集合"，创建集合：

**集合名称**：`sms_logs`

**字段说明**：
```javascript
{
  _id: String,           // 自动生成
  phone: String,         // 脱敏手机号（138****1234）
  scene: String,         // 场景
  provider: String,      // 服务商：WechatCloud / TencentCloud
  success: Boolean,      // 是否成功
  message: String,       // 结果消息
  errorCode: String,     // 错误码（失败时）
  clientIP: String,      // 客户端IP
  createdAt: Date        // 创建时间
}
```

**索引建议**（可选，用于频率限制查询）：
- 索引1：`phone` + `createdAt`
- 索引2：`clientIP` + `createdAt`
- 索引3：`createdAt`

## 权限设置

### sms_codes 集合权限

建议设置为：**仅创建者及管理员可读写**

或者自定义权限：
```javascript
{
  "read": false,    // 前端不可读
  "write": false    // 前端不可写
}
```

> 所有操作都通过云函数进行，前端不直接访问

### sms_logs 集合权限

建议设置为：**仅管理员可读写**

```javascript
{
  "read": false,    // 前端不可读
  "write": false    // 前端不可写
}
```

## 验证数据库创建

### 方法1：通过控制台

1. 在数据库管理页面查看是否有 `sms_codes` 和 `sms_logs` 两个集合
2. 点击集合名称，查看字段结构

### 方法2：通过云函数测试

部署云函数后，发送一次测试短信：
1. 查看 `sms_codes` 集合是否有新记录
2. 查看 `sms_logs` 集合是否有日志记录

## 数据示例

### sms_codes 示例数据

```javascript
{
  "_id": "abc123",
  "phone": "13800138000",
  "code": "123456",
  "scene": "binding",
  "used": false,
  "createdAt": "2024-01-01T10:00:00.000Z",
  "expiredAt": "2024-01-01T10:05:00.000Z",
  "clientIP": "192.168.1.1"
}
```

### sms_logs 示例数据

```javascript
{
  "_id": "def456",
  "phone": "138****8000",
  "scene": "binding",
  "provider": "TencentCloud",
  "success": true,
  "message": "发送成功",
  "errorCode": "",
  "clientIP": "192.168.1.1",
  "createdAt": "2024-01-01T10:00:00.000Z"
}
```

## 数据清理（可选）

### 清理过期验证码

可以定期清理过期的验证码记录，节省存储空间。

**方法1：手动清理**

在数据库控制台执行查询：
```javascript
// 查询过期且已使用的验证码
{
  expiredAt: _.lt(new Date()),
  used: true
}
```
然后批量删除。

**方法2：创建定时任务**

创建一个云函数，定时清理过期数据：
```javascript
// functions/cleanExpiredSms/index.js
const cloud = require('wx-server-sdk');
cloud.init();
const db = cloud.database();

exports.main = async (event, context) => {
  const now = new Date();
  const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
  
  // 删除3天前的过期验证码
  await db.collection('sms_codes')
    .where({
      expiredAt: db.command.lt(threeDaysAgo)
    })
    .remove();
  
  // 删除30天前的日志
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  await db.collection('sms_logs')
    .where({
      createdAt: db.command.lt(thirtyDaysAgo)
    })
    .remove();
  
  return { success: true };
};
```

然后在云开发控制台设置定时触发器（如每天凌晨执行）。

## 常见问题

### Q: 集合会自动创建吗？
A: 不会。必须手动在控制台创建集合。

### Q: 如果不创建会怎样？
A: 云函数会报错，提示集合不存在。

### Q: 需要预先创建字段吗？
A: 不需要。微信云开发是 NoSQL 数据库，字段会在第一次写入时自动创建。

### Q: 索引必须创建吗？
A: 不是必须的，但建议创建。索引可以大幅提升查询性能，特别是在数据量大的时候。

### Q: 如何创建索引？
A: 在集合详情页 > 索引管理 > 添加索引，选择字段并设置为升序或降序。

### Q: 数据库在哪个地域？
A: 跟随你的云开发环境地域，通常是广州或上海。

## 下一步

数据库创建完成后：
1. ✅ 设置环境变量（TENCENT_SECRET_ID、TENCENT_SECRET_KEY）
2. ✅ 部署云函数（sendSmsCode、verifySmsCode）
3. ✅ 测试短信发送功能
4. ✅ 检查数据库是否有记录

需要帮助？查看：`functions/README_SMS_SETUP.md`
