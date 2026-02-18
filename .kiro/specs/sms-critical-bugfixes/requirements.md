# 需求文档：短信服务关键Bug修复

## 介绍

本文档描述短信验证码服务中发现的5个关键bug的修复需求。这些bug影响系统的数据一致性、可靠性和可维护性，需要立即修复以确保服务正常运行。

## 术语表

- **SMS_Service**: 短信验证码服务系统
- **WeChat_Version**: 微信云开发版本的短信服务实现（位于 `functions/` 目录）
- **UniCloud_Version**: UniCloud阿里云版本的短信服务实现（位于 `uniCloud-aliyun/` 目录）
- **Verification_Code_Record**: 验证码记录，存储在 `sms_codes` 集合中
- **SMS_Log_Record**: 短信发送日志记录，存储在 `sms_logs` 集合中
- **Timestamp**: 时间戳，可以是 Date 对象或数字类型
- **Client_IP**: 客户端IP地址

## 需求

### 需求 1: 修复时间戳类型不一致导致的查询失效

**用户故事:** 作为系统管理员，我希望验证码过期检查能够正常工作，以便用户只能使用有效期内的验证码。

#### 验收标准

1. WHEN 保存验证码记录时，THE SMS_Service SHALL 使用统一的时间戳类型存储 `createdAt` 和 `expiredAt` 字段
2. WHEN 查询验证码记录时，THE SMS_Service SHALL 使用与存储时相同的时间戳类型进行比较
3. WHEN 执行时间范围查询时，THE SMS_Service SHALL 确保查询条件与数据库中存储的时间格式匹配
4. THE WeChat_Version SHALL 使用 Date 对象类型存储所有时间字段
5. THE UniCloud_Version SHALL 使用数字类型（毫秒时间戳）存储所有时间字段

### 需求 2: 修复IP字段名不一致导致的频率限制失效

**用户故事:** 作为系统管理员，我希望IP频率限制功能能够正常工作，以防止恶意用户通过同一IP大量发送短信。

#### 验收标准

1. WHEN 保存验证码记录时，THE SMS_Service SHALL 使用统一的IP字段名
2. WHEN 保存短信日志时，THE SMS_Service SHALL 使用统一的IP字段名
3. WHEN 查询IP发送频率时，THE SMS_Service SHALL 使用与存储时相同的IP字段名
4. THE WeChat_Version SHALL 使用 `clientIP` 作为IP字段名
5. THE UniCloud_Version SHALL 使用 `ip` 作为IP字段名

### 需求 3: 添加环境变量验证以提供清晰的错误信息

**用户故事:** 作为开发人员，我希望在环境变量未配置时能够收到清晰的错误提示，以便快速定位配置问题。

#### 验收标准

1. WHEN 加载腾讯云配置时，THE SMS_Service SHALL 验证 `TENCENT_SECRET_ID` 环境变量是否存在
2. WHEN 加载腾讯云配置时，THE SMS_Service SHALL 验证 `TENCENT_SECRET_KEY` 环境变量是否存在
3. IF 必需的环境变量未设置，THEN THE SMS_Service SHALL 抛出包含缺失变量名称的清晰错误信息
4. WHEN 创建腾讯云服务商实例时，THE SMS_Service SHALL 在初始化阶段验证配置完整性
5. THE SMS_Service SHALL 在错误信息中提供配置环境变量的指导

### 需求 4: 修复验证码保存失败时的错误处理

**用户故事:** 作为用户，我希望只有在验证码成功保存到数据库后才收到短信，以确保我能够使用收到的验证码。

#### 验收标准

1. WHEN 短信发送成功但验证码保存失败时，THE SMS_Service SHALL 返回错误响应给用户
2. WHEN 验证码保存失败时，THE SMS_Service SHALL 记录详细的错误日志
3. WHEN 验证码保存失败时，THE SMS_Service SHALL 不记录短信发送成功日志
4. THE SMS_Service SHALL 在发送短信之前先保存验证码到数据库
5. IF 验证码保存失败，THEN THE SMS_Service SHALL 不发送短信

### 需求 5: 统一数据库字段命名规范

**用户故事:** 作为开发人员，我希望两个版本的代码使用一致的数据库字段命名，以便于维护和避免混淆。

#### 验收标准

1. THE SMS_Service SHALL 在所有代码中使用一致的时间字段名称
2. THE SMS_Service SHALL 在所有代码中使用一致的IP字段名称
3. THE SMS_Service SHALL 在文档中明确记录每个版本使用的字段命名规范
4. WHEN 开发人员查看代码时，THE SMS_Service SHALL 通过注释说明字段命名的版本差异
5. THE SMS_Service SHALL 确保同一版本内的所有文件使用相同的字段命名
