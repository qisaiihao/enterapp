# Requirements Document

## Introduction

本文档定义了微信内容审核组件的需求规格。该组件用于在用户发布内容（文本、图片）时，调用微信官方内容安全检测接口进行审核，确保用户生成内容符合平台规范，防止违规内容的发布。该组件仅在微信小程序端使用，通过云函数调用微信内容安全API。

## Glossary

- **ContentModerationService**: 内容审核服务，封装微信内容安全检测API的调用逻辑
- **TextModeration**: 文本内容审核功能，检测文本是否包含敏感信息
- **ImageModeration**: 图片内容审核功能，检测图片是否包含敏感内容
- **CloudFunction**: 云函数，运行在服务器端的函数，用于调用微信API
- **MiniProgram**: 微信小程序客户端
- **AccessToken**: 微信API调用凭证
- **OpenID**: 用户在小程序中的唯一标识
- **RiskyContent**: 包含敏感信息的内容，审核结果为不通过
- **ModerationResult**: 审核结果对象，包含审核状态、标签、置信度等信息

## Requirements

### Requirement 1

**User Story:** 作为开发者，我希望能够审核用户提交的文本内容，以便在发布前拦截违规文字。

#### Acceptance Criteria

1. WHEN 开发者调用文本审核接口并传入文本内容 THEN THE ContentModerationService SHALL 通过云函数调用微信 msgSecCheck API 并返回审核结果
2. WHEN 文本内容长度超过2500字 THEN THE ContentModerationService SHALL 拒绝审核请求并返回错误提示
3. WHEN 文本内容为空字符串或仅包含空白字符 THEN THE ContentModerationService SHALL 拒绝审核请求并返回错误提示
4. WHEN 微信API返回敏感内容标识（suggest为risky） THEN THE ContentModerationService SHALL 返回包含违规标签和详细信息的结果对象
5. WHEN 微信API返回内容安全（suggest为pass） THEN THE ContentModerationService SHALL 返回审核通过的结果对象

### Requirement 2

**User Story:** 作为开发者，我希望能够审核用户上传的图片内容，以便在发布前拦截违规图片。

#### Acceptance Criteria

1. WHEN 开发者调用图片审核接口并传入图片URL THEN THE ContentModerationService SHALL 通过云函数调用微信 mediaCheckAsync API 并返回审核结果
2. WHEN 图片URL为空或格式不正确 THEN THE ContentModerationService SHALL 拒绝审核请求并返回错误提示
3. WHEN 图片格式不在支持列表中（jpg, jpeg, png, bmp, gif） THEN THE ContentModerationService SHALL 拒绝审核请求并返回错误提示
4. WHEN 微信API返回trace_id THEN THE ContentModerationService SHALL 保存trace_id用于后续异步结果查询
5. WHEN 图片审核为异步模式 THEN THE ContentModerationService SHALL 提供轮询或回调机制获取最终审核结果

### Requirement 3

**User Story:** 作为开发者，我希望审核服务能够自动处理access_token和openid，以便简化调用流程。

#### Acceptance Criteria

1. WHEN 云函数被调用 THEN THE CloudFunction SHALL 自动获取有效的access_token并传递给微信API
2. WHEN access_token过期或无效 THEN THE CloudFunction SHALL 自动刷新access_token并重试请求
3. WHEN 小程序端调用审核服务 THEN THE ContentModerationService SHALL 自动从当前用户上下文获取openid
4. WHEN openid不存在或用户未在近两小时访问小程序 THEN THE ContentModerationService SHALL 返回错误提示要求用户重新登录
5. WHEN 云函数调用微信API THEN THE CloudFunction SHALL 使用UTF-8编码处理所有文本参数

### Requirement 4

**User Story:** 作为开发者，我希望审核服务能够处理各种错误情况，以便提供友好的错误提示和重试机制。

#### Acceptance Criteria

1. WHEN 微信API返回系统繁忙错误（errcode: -1） THEN THE ContentModerationService SHALL 自动重试最多3次
2. WHEN 微信API返回频率限制错误（errcode: 44991或45009） THEN THE ContentModerationService SHALL 返回明确的频率限制错误信息
3. WHEN 网络请求超时 THEN THE ContentModerationService SHALL 返回超时错误并建议用户重试
4. WHEN 微信API返回未知错误码 THEN THE ContentModerationService SHALL 记录完整错误信息并返回通用错误提示
5. WHEN 审核服务发生错误 THEN THE ContentModerationService SHALL 记录错误日志包含时间戳、错误码、请求参数（脱敏）

### Requirement 5

**User Story:** 作为开发者，我希望能够在不同场景下使用审核服务，以便根据内容类型选择合适的审核策略。

#### Acceptance Criteria

1. WHEN 开发者调用审核接口 THEN THE ContentModerationService SHALL 支持指定场景参数（1-资料、2-评论、3-论坛、4-社交日志）
2. WHEN 场景参数未指定 THEN THE ContentModerationService SHALL 使用默认场景值（2-评论）
3. WHEN 场景参数不在有效范围内 THEN THE ContentModerationService SHALL 返回参数错误提示
4. WHEN 审核资料类内容（scene=1） THEN THE ContentModerationService SHALL 支持传入个性签名参数
5. WHEN 审核任意类型内容 THEN THE ContentModerationService SHALL 支持传入标题和昵称参数以提高审核准确性

### Requirement 6

**User Story:** 作为开发者，我希望审核服务返回简洁的审核结果，以便快速判断内容是否可以发布。

#### Acceptance Criteria

1. WHEN 审核完成 THEN THE ContentModerationService SHALL 返回布尔值或简单状态对象指示内容是否通过审核
2. WHEN 内容审核通过（suggest为pass） THEN THE ContentModerationService SHALL 返回通过状态
3. WHEN 内容审核不通过（suggest为risky或review） THEN THE ContentModerationService SHALL 返回不通过状态
4. WHEN 审核不通过 THEN THE CloudFunction SHALL 将完整的审核详情（标签、关键词、置信度）记录到数据库
5. WHEN 审核不通过 THEN THE MiniProgram SHALL 仅显示通用的审核失败提示信息

### Requirement 7

**User Story:** 作为开发者，我希望审核服务具有良好的性能，以便不影响用户发布内容的体验。

#### Acceptance Criteria

1. WHEN 文本审核请求发起 THEN THE ContentModerationService SHALL 在3秒内返回结果或超时错误
2. WHEN 图片审核请求发起 THEN THE ContentModerationService SHALL 在5秒内返回trace_id或超时错误
3. WHEN 多个审核请求并发 THEN THE ContentModerationService SHALL 支持并发处理而不相互阻塞
4. WHEN 审核服务被频繁调用 THEN THE ContentModerationService SHALL 实现本地缓存机制避免重复审核相同内容
5. WHEN 缓存的审核结果存在 THEN THE ContentModerationService SHALL 在5分钟内直接返回缓存结果

### Requirement 8

**User Story:** 作为开发者，我希望能够方便地集成审核服务到现有页面，以便快速实现内容审核功能。

#### Acceptance Criteria

1. WHEN 开发者在页面中导入审核服务 THEN THE ContentModerationService SHALL 提供简洁的API接口
2. WHEN 开发者调用审核方法 THEN THE ContentModerationService SHALL 返回Promise对象支持async/await语法
3. WHEN 审核正在进行 THEN THE ContentModerationService SHALL 提供加载状态标识供UI显示
4. WHEN 审核完成 THEN THE ContentModerationService SHALL 触发回调函数并传递审核结果
5. WHEN 开发者需要批量审核 THEN THE ContentModerationService SHALL 提供批量审核方法处理多个内容项
