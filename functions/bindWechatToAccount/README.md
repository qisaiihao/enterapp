# bindWechatToAccount 云函数

## 功能说明

将当前微信 openid 绑定到用户账号，实现跨端数据共享。

## 特点

- ✅ 不修改原有 `_openid`，保持数据完整性
- ✅ 只添加 `wechatOpenId` 字段，轻量快速
- ✅ 支持跨端登录（H5、小程序、App）
- ✅ 自动检测重复绑定

## 参数

```javascript
{
  poemId: string,      // 用户的 Poem ID（必填）
  forceRebind: boolean // 是否强制重新绑定（可选，默认 false）
}
```

## 返回值

### 成功
```javascript
{
  success: true,
  message: '绑定成功',
  isRebind: false  // 是否为重新绑定
}
```

### 失败
```javascript
{
  success: false,
  message: '错误信息',
  code: 'ERROR_CODE',  // 可选
  boundAccount: {      // 仅当 code 为 WECHAT_ALREADY_BOUND 时返回
    poemId: 'xxx',
    nickName: 'xxx'
  }
}
```

## 错误码

- `WECHAT_ALREADY_BOUND`: 该微信已绑定到其他账号（返回已绑定的账号信息）

## 使用示例

### 前端调用（首次绑定）
```javascript
const result = await cloudCall('bindWechatToAccount', {
  poemId: 'user123',
  forceRebind: false
});

if (result.result.success) {
  console.log('绑定成功');
} else if (result.result.code === 'WECHAT_ALREADY_BOUND') {
  // 微信已绑定到其他账号，显示确认弹窗
  console.log('已绑定账号:', result.result.boundAccount);
  // 用户确认后，再次调用并设置 forceRebind: true
} else {
  console.error('绑定失败:', result.result.message);
}
```

### 前端调用（强制重新绑定）
```javascript
const result = await cloudCall('bindWechatToAccount', {
  poemId: 'user123',
  forceRebind: true  // 强制重新绑定
});

if (result.result.success) {
  console.log('重新绑定成功');
} else {
  console.error('重新绑定失败:', result.result.message);
}
```

### 云开发控制台测试
```javascript
const result = await cloud.callFunction({
  name: 'bindWechatToAccount',
  data: {
    poemId: 'test_user'
  }
});
console.log(result);
```

## 安全机制

1. 自动获取当前微信 openid（通过 wxContext）
2. 验证用户身份（poemId 必须存在）
3. 检查微信是否已绑定到其他账号
4. 如果已绑定且 forceRebind=false，返回已绑定账号信息
5. 如果已绑定且 forceRebind=true，先解绑旧账号再绑定新账号
6. 只更新 `wechatOpenId` 字段

## 绑定流程

### 首次绑定流程
1. 用户使用 Poem ID 登录
2. 前端调用 `bindWechatToAccount`，设置 `forceRebind: false`
3. 云函数检查微信是否已绑定
4. 如果未绑定，直接绑定成功
5. 如果已绑定，返回 `WECHAT_ALREADY_BOUND` 错误和已绑定账号信息

### 强制重新绑定流程
1. 前端收到 `WECHAT_ALREADY_BOUND` 错误
2. 显示确认弹窗，告知用户已绑定的账号信息
3. 用户确认后，前端再次调用 `bindWechatToAccount`，设置 `forceRebind: true`
4. 云函数先解绑旧账号（移除 wechatOpenId）
5. 然后绑定到新账号
6. 返回绑定成功

## 数据库变更

### 首次绑定：更新 users 集合
```javascript
{
  _id: "xxx",
  _openid: "original_openid",      // 不修改
  wechatOpenId: "wechat_openid",   // 新增或更新
  poemId: "user123",
  updatedAt: new Date()            // 更新时间
}
```

### 强制重新绑定：更新两条记录

#### 1. 解绑旧账号
```javascript
{
  _id: "old_user_id",
  _openid: "old_openid",
  wechatOpenId: null,              // 移除绑定
  poemId: "old_user",
  updatedAt: new Date()
}
```

#### 2. 绑定新账号
```javascript
{
  _id: "new_user_id",
  _openid: "new_openid",
  wechatOpenId: "wechat_openid",   // 绑定到新账号
  poemId: "new_user",
  updatedAt: new Date()
}
```

## 配置

### config.json
```json
{
  "permissions": {
    "openapi": []
  },
  "triggers": [],
  "timeout": 20
}
```

### package.json
```json
{
  "name": "bindWechatToAccount",
  "version": "1.0.0",
  "dependencies": {
    "wx-server-sdk": "~2.6.3"
  }
}
```

## 部署

### 1. 安装依赖
```bash
cd functions/bindWechatToAccount
npm install
```

### 2. 上传云函数
在 HBuilderX 中：
1. 右键 `functions/bindWechatToAccount` 文件夹
2. 选择"上传部署"
3. 选择"云端安装依赖（不上传 node_modules）"

### 3. 验证部署
在云开发控制台 -> 云函数 -> bindWechatToAccount，检查是否部署成功。

## 日志

### 关键日志标记
- `🔍` - 调试信息
- `✅` - 成功操作
- `⚠️` - 警告信息
- `🔄` - 重新绑定操作
- `❌` - 错误信息

### 示例日志

#### 首次绑定成功
```
🔍 [bindWechatToAccount] 开始绑定微信到账号
🔍 [bindWechatToAccount] 参数: { poemId: 'user123', wechatOpenId: 'wx_xxx', forceRebind: false }
✅ [bindWechatToAccount] 绑定成功
```

#### 检测到已绑定其他账号
```
🔍 [bindWechatToAccount] 开始绑定微信到账号
🔍 [bindWechatToAccount] 参数: { poemId: 'user123', wechatOpenId: 'wx_xxx', forceRebind: false }
⚠️ [bindWechatToAccount] 该微信已绑定到其他账号，需要用户确认
```

#### 强制重新绑定成功
```
🔍 [bindWechatToAccount] 开始绑定微信到账号
🔍 [bindWechatToAccount] 参数: { poemId: 'user123', wechatOpenId: 'wx_xxx', forceRebind: true }
🔄 [bindWechatToAccount] 强制重新绑定，解绑旧账号: old_user
✅ [bindWechatToAccount] 已解绑旧账号
✅ [bindWechatToAccount] 绑定成功
```

## 相关文档

- [功能详细文档](../../docs/features/wechat-binding-v2.md)
- [快速参考指南](../../docs/features/wechat-binding-quick-reference.md)
- [部署清单](../../docs/deployment/wechat-binding-v2-deployment.md)

## 版本历史

- v1.0.0 (2024-xx-xx): 初始版本
