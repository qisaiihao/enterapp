# 短信服务部署文档

## 概述

本短信服务支持多服务商架构，可以在 uniCloud 和腾讯云 SMS 之间灵活切换。

## 配置说明

### 1. 环境变量配置

在 uniCloud 控制台的云函数配置中，添加以下环境变量：

```
TENCENT_SECRET_ID=你的腾讯云SecretId
TENCENT_SECRET_KEY=你的腾讯云SecretKey
```

**重要提示**：
- 这些是敏感信息，不要提交到代码仓库
- 在 uniCloud 控制台 > 云函数详情 > 云函数配置 > 环境变量 中设置

### 2. 配置文件说明

配置文件位于：`uniCloud-aliyun/cloudfunctions/sendSmsCode/config.json`

```json
{
  "provider": "tencentcloud",  // 服务商：unicloud 或 tencentcloud
  "testMode": false,           // 测试模式：true 时使用固定验证码 123456
  "unicloud": {
    "templateId": "37351"      // uniCloud 模板 ID
  },
  "tencentcloud": {
    "secretId": "${TENCENT_SECRET_ID}",        // 从环境变量读取
    "secretKey": "${TENCENT_SECRET_KEY}",      // 从环境变量读取
    "sdkAppId": "1401056037",                  // 短信应用 ID
    "signName": "江门市新会区回车键网络",        // 短信签名
    "templateId": "2601313",                   // 模板 ID
    "region": "ap-guangzhou"                   // 地域
  }
}
```

### 3. 腾讯云 SMS 服务开通步骤

#### 步骤 1：开通短信服务
1. 登录 [腾讯云控制台](https://console.cloud.tencent.com/)
2. 进入"短信 SMS"服务
3. 开通服务

#### 步骤 2：创建短信应用
1. 在短信控制台创建应用
2. 记录 **SmsSdkAppId**（例如：1401056037）

#### 步骤 3：配置短信签名
1. 进入"国内短信 > 签名管理"
2. 添加签名（例如：江门市新会区回车键网络）
3. 等待审核通过（通常 2 小时到 2 个工作日）
4. 记录 **SignName**

#### 步骤 4：配置短信模板
1. 进入"国内短信 > 正文模板管理"
2. 创建模板，例如：
   ```
   {1}为您的登录验证码，请于{2}分钟内填写。如非本人操作，请忽略本短信。
   ```
3. 等待审核通过
4. 记录 **TemplateId**（例如：2601313）

#### 步骤 5：获取 API 密钥
1. 进入"访问管理 > 访问密钥 > API 密钥管理"
2. 创建密钥或使用现有密钥
3. 记录 **SecretId** 和 **SecretKey**

### 4. 部署步骤

#### 步骤 1：安装依赖
在云函数目录执行：
```bash
cd uniCloud-aliyun/cloudfunctions/sendSmsCode
npm install
```

#### 步骤 2：配置环境变量
在 uniCloud 控制台设置环境变量：
- `TENCENT_SECRET_ID`
- `TENCENT_SECRET_KEY`

#### 步骤 3：上传云函数
在 HBuilderX 中右键云函数，选择"上传部署"

#### 步骤 4：验证部署
1. 在 uniCloud 控制台查看云函数日志
2. 测试发送短信功能
3. 检查是否有错误信息

### 5. 服务商切换

#### 切换到腾讯云
修改 `config.json`：
```json
{
  "provider": "tencentcloud"
}
```

#### 切换到 uniCloud
修改 `config.json`：
```json
{
  "provider": "unicloud"
}
```

#### 启用测试模式
修改 `config.json`：
```json
{
  "testMode": true
}
```
测试模式下：
- 不会实际发送短信
- 使用固定验证码 123456
- 适合开发和测试环境

### 6. 数据库集合

系统使用两个数据库集合：

#### sms_codes（验证码存储）
```javascript
{
  phone: String,      // 手机号
  code: String,       // 验证码
  scene: String,      // 场景（binding、updatePhone、resetPassword）
  used: Boolean,      // 是否已使用
  createdAt: Number,  // 创建时间戳
  expiredAt: Number,  // 过期时间戳
  usedAt: Number,     // 使用时间戳
  ip: String          // 客户端 IP
}
```

#### sms_logs（发送日志）
```javascript
{
  phone: String,      // 脱敏手机号
  scene: String,      // 场景
  provider: String,   // 服务商（uniCloud / TencentCloud）
  success: Boolean,   // 是否成功
  message: String,    // 结果消息
  errorCode: String,  // 错误码
  requestId: String,  // 请求 ID
  ip: String,         // 客户端 IP
  createdAt: Number   // 创建时间戳
}
```

### 7. 频率限制规则

- 同一手机号 60 秒内只能发送 1 次
- 同一手机号 24 小时内最多发送 10 次
- 同一 IP 1 小时内最多请求 20 次

### 8. 支持的场景

- `binding`: 手机号绑定
- `updatePhone`: 手机号修改
- `resetPassword`: 找回密码（预留）

### 9. 错误码说明

| 错误码 | 说明 |
|--------|------|
| 0 | 成功 |
| 1001 | 缺少手机号 |
| 1002 | 缺少场景参数 |
| 1003 | 手机号格式不正确 |
| 1004 | 不支持的场景 |
| 2001 | 频率限制 / 验证码错误或已过期 |
| 2002 | 验证码已过期 |
| 3001 | 短信发送失败 |
| 5000 | 系统错误 |
| 5001 | 配置错误 |
| 5002 | 服务初始化失败 |

### 10. 常见问题

#### Q: 如何测试短信功能？
A: 设置 `testMode: true`，使用固定验证码 123456 进行测试。

#### Q: 腾讯云 API 认证失败？
A: 检查环境变量 `TENCENT_SECRET_ID` 和 `TENCENT_SECRET_KEY` 是否正确设置。

#### Q: 短信发送失败？
A: 检查：
1. 签名和模板是否审核通过
2. SmsSdkAppId 是否正确
3. 模板 ID 和签名是否属于同一个应用
4. 是否有足够的短信余额

#### Q: 如何查看详细日志？
A: 在 uniCloud 控制台 > 云函数 > 日志 中查看。

### 11. 参考文档

- [腾讯云 SMS API 文档](https://cloud.tencent.com/document/product/382/55981)
- [腾讯云 SMS 快速入门](https://cloud.tencent.com/document/product/382/37745)
- [签名审核标准](https://cloud.tencent.com/document/product/382/39022)
- [正文模板审核标准](https://cloud.tencent.com/document/product/382/39023)
