# 腾讯云短信迁移完成

## ✅ 已完成的工作

### 1. 后端云函数（腾讯云）
已创建以下腾讯云函数：

- `functions/sendSmsCode/` - 发送短信验证码
- `functions/verifySmsCode/` - 验证短信验证码

两个函数都支持通过配置文件切换短信服务商（uniCloud 或腾讯云）。

### 2. 前端代码更新
已将以下页面的短信相关调用从 `uniCloud.callFunction` 改为 `wx.cloud.callFunction`：

#### 修改手机号页面 (`pages-user/profile-edit/profile-edit.vue`)
- ✅ `sendEditPhoneSmsCode()` - 发送验证码
- ✅ `handleEditPhoneConfirm()` - 验证验证码

#### 登录页面 (`pages/login/login.vue`)
- ✅ `sendBindSmsCode()` - 发送验证码
- ✅ `handleBindPhone()` - 验证验证码

#### 注册页面 (`pages/register/register.vue`)
- ✅ `sendBindSmsCodeForRegister()` - 发送验证码
- ✅ `handleBindPhoneForRegister()` - 验证验证码

### 3. 配置文件
- ✅ `functions/sendSmsCode/config.js` - 已配置腾讯云短信参数
  - SmsSdkAppId: 1401056037
  - SignName: 江门市新会区回车键网络
  - TemplateId: 2601313
  - provider: 'tencentcloud'

## 📋 接下来需要做的事情

### 1. 在腾讯云开发控制台设置环境变量
打开腾讯云开发控制台，为云函数设置以下环境变量：

```
TENCENT_SECRET_ID=你的腾讯云SecretId
TENCENT_SECRET_KEY=你的腾讯云SecretKey
```

**获取方式：**
1. 登录腾讯云控制台
2. 访问 [访问管理 - API密钥管理](https://console.cloud.tencent.com/cam/capi)
3. 创建或查看现有的 API 密钥

### 2. 创建数据库集合
在腾讯云开发控制台手动创建以下数据库集合：

#### `sms_codes` 集合
用于存储短信验证码记录

**字段：**
- `phone` (string) - 手机号
- `code` (string) - 验证码
- `scene` (string) - 使用场景（register/binding/updatePhone）
- `expireTime` (number) - 过期时间戳
- `verified` (boolean) - 是否已验证
- `createTime` (number) - 创建时间戳

**索引：**
- `phone` + `scene` + `expireTime` (组合索引)

#### `sms_logs` 集合
用于记录短信发送日志

**字段：**
- `phone` (string) - 手机号
- `scene` (string) - 使用场景
- `success` (boolean) - 是否成功
- `provider` (string) - 服务商
- `requestId` (string) - 请求ID
- `errorMessage` (string) - 错误信息（如果失败）
- `createTime` (number) - 创建时间戳

**索引：**
- `phone` + `createTime` (组合索引)

### 3. 安装云函数依赖
进入云函数目录并安装依赖：

```bash
cd functions/sendSmsCode
npm install
```

### 4. 部署云函数
在 HBuilderX 或命令行中部署云函数：

**方式1：HBuilderX**
- 右键 `functions/sendSmsCode` 文件夹
- 选择"上传部署"

**方式2：命令行**
```bash
tcb fn deploy sendSmsCode
tcb fn deploy verifySmsCode
```

### 5. 测试短信功能
部署完成后，在以下场景测试短信发送：

1. **注册页面** - 绑定手机号
2. **登录页面** - 登录后绑定手机号
3. **个人资料页面** - 修改手机号

## 🔍 验证方式

### 查看云函数日志
在腾讯云开发控制台查看云函数执行日志，确认：
- 短信发送请求是否成功
- 验证码是否正确存储到数据库
- 验证码验证是否正常工作

### 检查数据库
查看 `sms_codes` 和 `sms_logs` 集合，确认：
- 验证码记录是否正确创建
- 过期时间是否正确设置
- 日志是否正常记录

## 📝 配置说明

### 切换短信服务商
如果需要切换回 uniCloud 或其他服务商，修改 `functions/sendSmsCode/config.js`：

```javascript
module.exports = {
  // 改为 'wechat' 使用 uniCloud
  provider: 'tencentcloud',
  // ...
};
```

### 测试模式
开发测试时可以启用测试模式（使用固定验证码 123456）：

```javascript
module.exports = {
  testMode: true,  // 改为 true
  // ...
};
```

**注意：生产环境必须设置为 `false`**

## 🔒 安全建议

1. **环境变量** - 不要将 SecretId 和 SecretKey 硬编码在代码中
2. **速率限制** - 已配置发送频率限制，防止恶意刷短信
3. **验证码过期** - 验证码默认5分钟过期
4. **IP限制** - 已配置每个IP每日发送次数限制

## 📚 相关文档

- [腾讯云短信 API 文档](https://cloud.tencent.com/document/product/382/55981)
- [functions/sendSmsCode/README.md](functions/sendSmsCode/README.md) - 云函数详细说明
- [functions/DATABASE_SETUP.md](functions/DATABASE_SETUP.md) - 数据库设置指南
- [functions/README_SMS_SETUP.md](functions/README_SMS_SETUP.md) - 快速设置指南

## ❓ 常见问题

### Q: 短信发送失败怎么办？
A: 检查以下几点：
1. 环境变量是否正确设置
2. 腾讯云账户余额是否充足
3. 短信签名和模板是否已审核通过
4. 查看云函数日志获取详细错误信息

### Q: 验证码验证失败？
A: 检查：
1. 验证码是否过期（默认5分钟）
2. 手机号和场景是否匹配
3. 数据库集合是否正确创建

### Q: 如何查看发送记录？
A: 查看 `sms_logs` 数据库集合，包含所有发送记录和状态

## ✨ 完成！

现在你的应用已经成功迁移到腾讯云短信服务。按照上述步骤完成配置和部署后，即可正常使用短信功能。
