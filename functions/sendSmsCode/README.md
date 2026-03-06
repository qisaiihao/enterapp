# 腾讯云云函数 - 短信服务部署文档

## 概述

本短信服务支持两种服务商：
- **微信云开发短信**：使用微信云开发的短信服务
- **腾讯云 SMS**：使用腾讯云短信服务（推荐）

## 配置说明

### 1. 环境变量配置（使用腾讯云 SMS 时必需）

在微信云开发控制台设置环境变量：

1. 打开 [微信云开发控制台](https://console.cloud.tencent.com/tcb)
2. 选择你的环境
3. 进入"云函数" > "sendSmsCode"
4. 点击"函数配置"
5. 找到"环境变量"部分
6. 添加以下变量：

```
TENCENT_SECRET_ID=你的腾讯云SecretId
TENCENT_SECRET_KEY=你的腾讯云SecretKey
```

### 2. 配置文件说明

配置文件：`functions/sendSmsCode/config.js`

```javascript
module.exports = {
  // 服务商选择：'wechat' 或 'tencentcloud'
  provider: 'tencentcloud',
  
  // 测试模式：true 时使用固定验证码 123456
  testMode: false,
  
  // 微信云开发配置
  wechat: {
    appid: '__UNI__your_appid',
    templateId: 'uni_sms_test'
  },
  
  // 腾讯云 SMS 配置
  tencentcloud: {
    secretId: process.env.TENCENT_SECRET_ID,
    secretKey: process.env.TENCENT_SECRET_KEY,
    sdkAppId: '1401056037',
    signName: '江门市新会区回车键网络',
    templateId: '2601313',
    region: 'ap-guangzhou'
  }
};
```

### 3. 腾讯云 SMS 配置信息

当前已配置：
- **SmsSdkAppId**: 1401056037
- **SignName**: 江门市新会区回车键网络
- **TemplateId**: 2601313
- **Region**: ap-guangzhou

## 部署步骤

### 1. 安装依赖

```bash
cd functions/sendSmsCode
npm install
```

### 2. 设置环境变量

在微信云开发控制台设置：
- `TENCENT_SECRET_ID`
- `TENCENT_SECRET_KEY`

### 3. 上传云函数

方式一：使用微信开发者工具
1. 打开微信开发者工具
2. 右键 `sendSmsCode` 云函数
3. 选择"上传并部署：云端安装依赖"

方式二：使用命令行
```bash
tcb fn deploy sendSmsCode
```

### 4. 验证部署

1. 在云开发控制台查看云函数日志
2. 测试发送短信功能
3. 检查是否有错误信息

## 服务商切换

### 使用腾讯云 SMS（推荐）

修改 `config.js`：
```javascript
{
  provider: 'tencentcloud'
}
```

优点：
- 直接调用腾讯云 API，无跨域问题
- 性能更好
- 更稳定

### 使用微信云开发短信

修改 `config.js`：
```javascript
{
  provider: 'wechat'
}
```

## 测试模式

开发时可以启用测试模式：

```javascript
{
  testMode: true
}
```

测试模式下：
- 不会实际发送短信
- 使用固定验证码 `123456`
- 适合开发和测试环境

## 数据库集合

### sms_codes（验证码存储）

```javascript
{
  phone: String,      // 手机号
  code: String,       // 验证码
  scene: String,      // 场景（binding、updatePhone、resetPassword）
  used: Boolean,      // 是否已使用
  createdAt: Date,    // 创建时间
  expiredAt: Date,    // 过期时间
  clientIP: String    // 客户端 IP
}
```

### sms_logs（发送日志）

```javascript
{
  phone: String,      // 脱敏手机号
  scene: String,      // 场景
  provider: String,   // 服务商（WechatCloud / TencentCloud）
  success: Boolean,   // 是否成功
  message: String,    // 结果消息
  errorCode: String,  // 错误码
  clientIP: String,   // 客户端 IP
  createdAt: Date     // 创建时间
}
```

## 频率限制规则

- 同一手机号 60 秒内只能发送 1 次
- 同一手机号 24 小时内最多发送 10 次
- 同一 IP 1 小时内最多请求 50 次

## 支持的场景

- `binding`: 手机号绑定
- `updatePhone`: 手机号修改
- `resetPassword`: 找回密码

## 错误码说明

| 错误码 | 说明 |
|--------|------|
| SUCCESS | 成功 |
| MISSING_PHONE | 缺少手机号 |
| INVALID_PHONE | 手机号格式不正确 |
| INVALID_SCENE | 不支持的场景 |
| SEND_LIMIT_EXCEEDED | 超过频率限制 |
| PROVIDER_INIT_FAILED | 服务商初始化失败 |
| SEND_FAILED | 发送失败 |
| SYSTEM_ERROR | 系统错误 |

## 前端调用示例

使用封装的工具函数：

```javascript
import { sendSmsCode, verifySmsCode } from '@/utils/sms-config';

// 发送验证码
const result = await sendSmsCode('13800138000', 'binding');
if (result.result.success) {
  console.log('发送成功');
}

// 验证验证码
const verifyResult = await verifySmsCode('13800138000', '123456', 'binding');
if (verifyResult.result.success) {
  console.log('验证成功');
}
```

## 常见问题

### Q: 如何测试短信功能？
A: 设置 `testMode: true`，使用固定验证码 123456 进行测试。

### Q: 腾讯云 API 认证失败？
A: 检查环境变量 `TENCENT_SECRET_ID` 和 `TENCENT_SECRET_KEY` 是否正确设置。

### Q: 短信发送失败？
A: 检查：
1. 签名和模板是否审核通过
2. SmsSdkAppId 是否正确
3. 模板 ID 和签名是否属于同一个应用
4. 是否有足够的短信余额

### Q: 如何查看详细日志？
A: 在微信云开发控制台 > 云函数 > 日志 中查看。

### Q: 如何切换服务商？
A: 修改 `config.js` 中的 `provider` 字段，然后重新部署云函数。

## 参考文档

- [腾讯云 SMS API 文档](https://cloud.tencent.com/document/product/382/55981)
- [微信云开发文档](https://developers.weixin.qq.com/miniprogram/dev/wxcloud/basis/getting-started.html)
- [腾讯云 SMS 快速入门](https://cloud.tencent.com/document/product/382/37745)
