# 需求文档

## 简介

本文档描述将现有短信发送功能从 uniCloud SMS API 迁移到腾讯云 SMS API 的需求。迁移将保留原有的 uniCloud 实现，通过配置支持在 uniCloud 和腾讯云两个短信服务商之间切换。系统通过云函数直接调用相应的 SDK 实现短信发送功能，保持与前端的接口兼容性。当前支持手机号绑定和手机号修改两个场景，并预留手机号找回密码场景的接口。

## 术语表

- **SMS_Service**: 短信服务系统，负责发送和验证短信验证码，支持多个服务商
- **SMS_Provider**: 短信服务商（uniCloud 或 Tencent_Cloud）
- **Verification_Code**: 6 位数字验证码，用于用户身份验证
- **Cloud_Function**: 运行在云端的 Node.js 函数
- **Tencent_Cloud_SDK**: 腾讯云官方提供的 Node.js SDK（tencentcloud-sdk-nodejs-sms）
- **UniCloud_SMS_API**: uniCloud 提供的短信发送 API（uniCloud.sendSms）
- **SMS_Codes_Collection**: uniCloud 数据库中存储验证码的集合
- **Scene**: 验证码使用场景（binding、updatePhone，预留 resetPassword）
- **Rate_Limiter**: 频率限制器，防止短信滥用
- **Configuration**: 包含服务商选择和各服务商所需配置的配置信息

## 需求

### 需求 1：短信服务商抽象和切换

**用户故事：** 作为开发者，我希望系统支持多个短信服务商，以便根据需要灵活切换。

#### 验收标准

1. THE SMS_Service SHALL 支持 uniCloud 和 Tencent_Cloud 两个短信服务商
2. THE SMS_Service SHALL 通过配置参数选择当前使用的 SMS_Provider
3. WHEN 配置为 uniCloud 时，THE SMS_Service SHALL 使用 UniCloud_SMS_API 发送短信
4. WHEN 配置为 Tencent_Cloud 时，THE SMS_Service SHALL 使用 Tencent_Cloud_SDK 发送短信
5. THE SMS_Service SHALL 为不同服务商提供统一的内部接口
6. WHEN 切换服务商时，THE SMS_Service SHALL 无需修改业务逻辑代码
7. WHEN 配置的服务商不存在时，THE SMS_Service SHALL 返回明确的错误信息

### 需求 2：腾讯云 SMS SDK 集成

**用户故事：** 作为开发者，我希望集成腾讯云 SMS SDK，以便使用腾讯云的短信服务发送验证码。

#### 验收标准

1. THE SMS_Service SHALL 使用 tencentcloud-sdk-nodejs-sms 包调用腾讯云 API
2. WHEN 初始化腾讯云 SDK 时，THE SMS_Service SHALL 从配置中读取 SecretId 和 SecretKey
3. THE SMS_Service SHALL 配置 SmsSdkAppId、SignName 和 TemplateId 参数
4. WHEN 腾讯云 SDK 初始化失败时，THE SMS_Service SHALL 记录错误并返回明确的错误信息
5. THE SMS_Service SHALL 保留原有的 uniCloud 短信发送实现代码

### 需求 3：发送短信验证码

**用户故事：** 作为用户，我希望能够接收短信验证码，以便完成身份验证。

#### 验收标准

1. WHEN 调用 sendSmsCode 云函数时，THE SMS_Service SHALL 生成 6 位数字验证码
2. WHEN 发送验证码时，THE SMS_Service SHALL 根据配置的 SMS_Provider 选择相应的发送方法
3. WHEN 使用 uniCloud 时，THE SMS_Service SHALL 调用 uniCloud.sendSms() 发送短信
4. WHEN 使用腾讯云时，THE SMS_Service SHALL 使用 Tencent_Cloud_SDK 的 SendSms 接口发送短信
5. THE SMS_Service SHALL 支持国内手机号（+86 格式）
6. WHEN 验证码生成后，THE SMS_Service SHALL 将验证码存储到 SMS_Codes_Collection 中
7. THE SMS_Service SHALL 设置验证码有效期为 5 分钟
8. WHEN 短信发送成功时，THE SMS_Service SHALL 返回成功状态给前端
9. WHEN 短信服务商 API 返回错误时，THE SMS_Service SHALL 解析错误码并返回友好的错误信息

### 需求 4：验证短信验证码

**用户故事：** 作为系统，我需要验证用户输入的验证码，以确保用户身份的真实性。

#### 验收标准

1. WHEN 调用 verifySmsCode 云函数时，THE SMS_Service SHALL 从 SMS_Codes_Collection 中查询验证码
2. WHEN 验证码存在且未过期时，THE SMS_Service SHALL 比对用户输入与存储的验证码
3. WHEN 验证码匹配时，THE SMS_Service SHALL 返回验证成功并标记验证码为已使用
4. WHEN 验证码不匹配或已过期时，THE SMS_Service SHALL 返回验证失败
5. WHEN 验证码已被使用时，THE SMS_Service SHALL 拒绝再次验证并返回错误

### 需求 5：支持多场景验证码

**用户故事：** 作为系统，我需要支持不同场景的验证码发送，以便在不同业务流程中使用。

#### 验收标准

1. THE SMS_Service SHALL 支持 binding 场景的验证码发送（手机号绑定）
2. THE SMS_Service SHALL 支持 updatePhone 场景的验证码发送（手机号修改）
3. THE SMS_Service SHALL 预留 resetPassword 场景的接口（手机号找回密码）
4. WHEN 存储验证码时，THE SMS_Service SHALL 记录验证码的使用场景
5. WHEN 验证验证码时，THE SMS_Service SHALL 检查场景是否匹配
6. WHEN 调用未实现的场景时，THE SMS_Service SHALL 返回明确的提示信息

### 需求 6：频率限制和安全检查

**用户故事：** 作为系统管理员，我需要防止短信滥用，以控制成本并保护系统安全。

#### 验收标准

1. WHEN 同一手机号在 60 秒内重复请求时，THE Rate_Limiter SHALL 拒绝发送并返回错误
2. WHEN 同一手机号在 24 小时内请求超过 10 次时，THE Rate_Limiter SHALL 拒绝发送并返回错误
3. WHEN 同一 IP 地址在 1 小时内请求超过 20 次时，THE Rate_Limiter SHALL 拒绝发送并返回错误
4. THE SMS_Service SHALL 验证手机号格式的有效性
5. WHEN 手机号格式无效时，THE SMS_Service SHALL 拒绝发送并返回错误

### 需求 7：配置管理

**用户故事：** 作为开发者，我需要安全地管理腾讯云 API 凭证，以保护敏感信息。

#### 验收标准

1. THE Configuration SHALL 存储在云函数的环境变量或独立配置文件中
2. THE Configuration SHALL 包含 SMS_Provider 选择参数（uniCloud 或 tencentCloud）
3. WHEN 使用 uniCloud 时，THE Configuration SHALL 包含 uniCloud 所需的 TemplateId
4. WHEN 使用腾讯云时，THE Configuration SHALL 包含 SecretId、SecretKey、SmsSdkAppId、SignName 和 TemplateId
5. THE SMS_Service SHALL 在启动时验证所有必需的配置项是否存在
6. WHEN 配置项缺失时，THE SMS_Service SHALL 记录错误并拒绝服务
7. THE Configuration SHALL 不在代码中硬编码敏感信息

### 需求 8：错误处理和日志记录

**用户故事：** 作为开发者，我需要详细的错误信息和日志，以便快速定位和解决问题。

#### 验收标准

1. WHEN 短信服务商 API 返回错误时，THE SMS_Service SHALL 记录完整的错误信息（错误码、错误消息、请求 ID）
2. WHEN 发送短信时，THE SMS_Service SHALL 记录手机号（脱敏）、场景、使用的服务商和时间戳
3. WHEN 验证失败时，THE SMS_Service SHALL 记录失败原因
4. THE SMS_Service SHALL 将所有日志输出到云函数日志系统
5. WHEN 发生异常时，THE SMS_Service SHALL 捕获异常并返回统一格式的错误响应

### 需求 9：接口兼容性

**用户故事：** 作为前端开发者，我希望迁移后的接口保持兼容，以避免修改前端代码。

#### 验收标准

1. THE Cloud_Function SHALL 保持 sendSmsCode 函数名称不变
2. THE Cloud_Function SHALL 保持 verifySmsCode 函数名称不变
3. WHEN 前端调用 sendSmsCode 时，THE Cloud_Function SHALL 接受相同的参数格式（phone、scene）
4. WHEN 前端调用 verifySmsCode 时，THE Cloud_Function SHALL 接受相同的参数格式（phone、code、scene）
5. THE Cloud_Function SHALL 返回与原有接口相同的响应格式（code、message、data）
6. WHEN 切换服务商后，THE SMS_Service SHALL 无需修改前端代码即可正常工作

### 需求 10：数据库操作

**用户故事：** 作为系统，我需要在数据库中管理验证码，以支持验证和审计功能。

#### 验收标准

1. THE SMS_Service SHALL 在 SMS_Codes_Collection 中创建验证码记录
2. WHEN 创建记录时，THE SMS_Service SHALL 存储手机号、验证码、场景、创建时间和过期时间
3. WHEN 验证成功时，THE SMS_Service SHALL 更新记录状态为已使用
4. THE SMS_Service SHALL 定期清理过期的验证码记录
5. WHEN 查询验证码时，THE SMS_Service SHALL 使用手机号、场景和状态作为查询条件

### 需求 11：测试和验证

**用户故事：** 作为开发者，我需要验证迁移后的功能正确性，以确保系统稳定运行。

#### 验收标准

1. THE SMS_Service SHALL 提供测试模式，在测试环境中不实际发送短信
2. WHEN 在测试模式下时，THE SMS_Service SHALL 生成固定的验证码（如 123456）
3. THE SMS_Service SHALL 支持通过配置切换测试模式和生产模式
4. WHEN 实现完成后，THE SMS_Service SHALL 通过所有现有的集成测试
5. THE SMS_Service SHALL 在生产环境部署前完成端到端测试
6. THE SMS_Service SHALL 验证两个服务商的切换功能正常工作
