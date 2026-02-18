# 设计文档

## 概述

本设计文档描述了支持多短信服务商的短信验证码系统架构。系统采用策略模式实现服务商抽象，支持在 uniCloud 和腾讯云之间灵活切换，同时保持与前端接口的完全兼容性。

### 设计目标

1. 保留现有 uniCloud 短信实现
2. 新增腾讯云 SMS 服务商支持
3. 通过配置实现服务商切换
4. 保持前端接口不变
5. 统一的错误处理和日志记录
6. 支持 binding 和 updatePhone 场景，预留 resetPassword 接口

## 架构

### 整体架构

系统采用三层架构：

```
┌─────────────────────────────────────────┐
│           前端应用层                      │
│  (调用 sendSmsCode / verifySmsCode)      │
└─────────────────┬───────────────────────┘
                  │
┌─────────────────▼───────────────────────┐
│         云函数接口层                      │
│  - sendSmsCode 云函数                    │
│  - verifySmsCode 云函数                  │
│  - 参数验证                              │
│  - 频率限制                              │
└─────────────────┬───────────────────────┘
                  │
┌─────────────────▼───────────────────────┐
│        短信服务抽象层                     │
│  - SmsProviderFactory                   │
│  - ISmsProvider 接口                    │
└─────────────────┬───────────────────────┘
                  │
        ┌─────────┴─────────┐
        │                   │
┌───────▼────────┐  ┌──────▼──────────┐
│ UniCloudSms    │  │ TencentCloudSms │
│ Provider       │  │ Provider        │
└───────┬────────┘  └──────┬──────────┘
        │                   │
        │         ┌─────────▼─────────┐
        │         │  Tencent Cloud    │
        │         │  SMS SDK          │
        │         └───────────────────┘
        │
┌───────▼────────────────────────────────┐
│      uniCloud 数据库                    │
│  - sms_codes 集合（验证码存储）          │
│  - sms_logs 集合（发送日志）             │
└────────────────────────────────────────┘
```

### 核心组件

1. **云函数接口层**：处理前端请求，执行参数验证和频率限制
2. **服务商抽象层**：定义统一接口，实现服务商切换逻辑
3. **服务商实现层**：具体的 uniCloud 和腾讯云实现
4. **数据持久层**：验证码和日志的存储

## 组件和接口

### 1. ISmsProvider 接口

所有短信服务商必须实现的统一接口：

```typescript
interface ISmsProvider {
  /**
   * 发送短信验证码
   * @param phone 手机号（+86 格式）
   * @param code 验证码
   * @param scene 场景（binding、updatePhone、resetPassword）
   * @returns 发送结果
   */
  sendVerificationCode(
    phone: string,
    code: string,
    scene: string
  ): Promise<SendResult>;

  /**
   * 获取服务商名称
   */
  getProviderName(): string;
}

interface SendResult {
  success: boolean;
  message: string;
  requestId?: string;
  errorCode?: string;
}
```

### 2. SmsProviderFactory 工厂类

负责根据配置创建相应的服务商实例：

```typescript
class SmsProviderFactory {
  /**
   * 创建短信服务商实例
   * @param config 配置对象
   * @returns 服务商实例
   */
  static createProvider(config: SmsConfig): ISmsProvider {
    const providerType = config.provider || 'unicloud';
    
    switch (providerType) {
      case 'unicloud':
        return new UniCloudSmsProvider(config.unicloud);
      case 'tencentcloud':
        return new TencentCloudSmsProvider(config.tencentcloud);
      default:
        throw new Error(`不支持的服务商: ${providerType}`);
    }
  }
}
```

### 3. UniCloudSmsProvider 实现

保留原有的 uniCloud 实现：

```typescript
class UniCloudSmsProvider implements ISmsProvider {
  private templateId: string;

  constructor(config: UniCloudConfig) {
    this.templateId = config.templateId;
  }

  async sendVerificationCode(
    phone: string,
    code: string,
    scene: string
  ): Promise<SendResult> {
    try {
      const result = await uniCloud.sendSms({
        smsKey: this.templateId,
        smsType: 'verification',
        phone: phone,
        data: {
          code: code,
          expireMinutes: 5
        }
      });

      return {
        success: true,
        message: '发送成功',
        requestId: result.requestId
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
        errorCode: error.code
      };
    }
  }

  getProviderName(): string {
    return 'uniCloud';
  }
}
```

### 4. TencentCloudSmsProvider 实现

新增的腾讯云实现：

```typescript
import * as tencentcloud from 'tencentcloud-sdk-nodejs-sms';

class TencentCloudSmsProvider implements ISmsProvider {
  private client: any;
  private sdkAppId: string;
  private signName: string;
  private templateId: string;

  constructor(config: TencentCloudConfig) {
    const SmsClient = tencentcloud.sms.v20210111.Client;
    
    this.client = new SmsClient({
      credential: {
        secretId: config.secretId,
        secretKey: config.secretKey
      },
      region: config.region || 'ap-guangzhou',
      profile: {
        httpProfile: {
          endpoint: 'sms.tencentcloudapi.com'
        }
      }
    });

    this.sdkAppId = config.sdkAppId;
    this.signName = config.signName;
    this.templateId = config.templateId;
  }

  async sendVerificationCode(
    phone: string,
    code: string,
    scene: string
  ): Promise<SendResult> {
    try {
      const params = {
        PhoneNumberSet: [phone],
        SmsSdkAppId: this.sdkAppId,
        SignName: this.signName,
        TemplateId: this.templateId,
        TemplateParamSet: [code, '5']
      };

      const response = await this.client.SendSms(params);
      const status = response.SendStatusSet[0];

      if (status.Code === 'Ok') {
        return {
          success: true,
          message: '发送成功',
          requestId: response.RequestId
        };
      } else {
        return {
          success: false,
          message: status.Message,
          errorCode: status.Code,
          requestId: response.RequestId
        };
      }
    } catch (error) {
      return {
        success: false,
        message: error.message,
        errorCode: error.code
      };
    }
  }

  getProviderName(): string {
    return 'TencentCloud';
  }
}
```

### 5. 云函数：sendSmsCode

发送短信验证码的云函数：

```typescript
export async function sendSmsCode(event) {
  const { phone, scene } = event;

  try {
    // 1. 参数验证
    if (!phone || !scene) {
      return errorResponse('缺少必需参数');
    }

    if (!validatePhone(phone)) {
      return errorResponse('手机号格式无效');
    }

    if (!['binding', 'updatePhone', 'resetPassword'].includes(scene)) {
      return errorResponse('不支持的场景');
    }

    // 2. 频率限制检查
    const rateLimitResult = await checkRateLimit(phone, event.clientIP);
    if (!rateLimitResult.allowed) {
      return errorResponse(rateLimitResult.message);
    }

    // 3. 生成验证码
    const code = generateVerificationCode();

    // 4. 获取短信服务商
    const config = await loadSmsConfig();
    const provider = SmsProviderFactory.createProvider(config);

    // 5. 发送短信
    const sendResult = await provider.sendVerificationCode(phone, code, scene);

    if (!sendResult.success) {
      await logSmsError(phone, scene, provider.getProviderName(), sendResult);
      return errorResponse(`发送失败: ${sendResult.message}`);
    }

    // 6. 存储验证码
    await saveSmsCode({
      phone,
      code,
      scene,
      expiresAt: Date.now() + 5 * 60 * 1000,
      used: false
    });

    // 7. 记录日志
    await logSmsSuccess(phone, scene, provider.getProviderName(), sendResult);

    return successResponse('发送成功');
  } catch (error) {
    console.error('sendSmsCode error:', error);
    return errorResponse('系统错误');
  }
}
```

### 6. 云函数：verifySmsCode

验证短信验证码的云函数：

```typescript
export async function verifySmsCode(event) {
  const { phone, code, scene } = event;

  try {
    // 1. 参数验证
    if (!phone || !code || !scene) {
      return errorResponse('缺少必需参数');
    }

    // 2. 查询验证码
    const db = uniCloud.database();
    const collection = db.collection('sms_codes');
    
    const result = await collection
      .where({
        phone,
        scene,
        used: false,
        expiresAt: db.command.gt(Date.now())
      })
      .orderBy('createdAt', 'desc')
      .limit(1)
      .get();

    if (result.data.length === 0) {
      return errorResponse('验证码不存在或已过期');
    }

    const smsCode = result.data[0];

    // 3. 验证码比对
    if (smsCode.code !== code) {
      return errorResponse('验证码错误');
    }

    // 4. 标记为已使用
    await collection.doc(smsCode._id).update({
      used: true,
      usedAt: Date.now()
    });

    return successResponse('验证成功', {
      phone,
      scene
    });
  } catch (error) {
    console.error('verifySmsCode error:', error);
    return errorResponse('系统错误');
  }
}
```

### 7. 辅助函数

```typescript
// 生成 6 位数字验证码
function generateVerificationCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// 验证手机号格式
function validatePhone(phone: string): boolean {
  return /^\+86\d{11}$/.test(phone) || /^1[3-9]\d{9}$/.test(phone);
}

// 频率限制检查
async function checkRateLimit(phone: string, ip: string): Promise<RateLimitResult> {
  const db = uniCloud.database();
  const now = Date.now();

  // 检查 60 秒内是否重复请求
  const recentCount = await db.collection('sms_logs')
    .where({
      phone,
      createdAt: db.command.gt(now - 60 * 1000)
    })
    .count();

  if (recentCount.total > 0) {
    return { allowed: false, message: '请求过于频繁，请稍后再试' };
  }

  // 检查 24 小时内请求次数
  const dailyCount = await db.collection('sms_logs')
    .where({
      phone,
      createdAt: db.command.gt(now - 24 * 60 * 60 * 1000)
    })
    .count();

  if (dailyCount.total >= 10) {
    return { allowed: false, message: '今日发送次数已达上限' };
  }

  // 检查 IP 1 小时内请求次数
  const ipCount = await db.collection('sms_logs')
    .where({
      ip,
      createdAt: db.command.gt(now - 60 * 60 * 1000)
    })
    .count();

  if (ipCount.total >= 20) {
    return { allowed: false, message: 'IP 请求过于频繁' };
  }

  return { allowed: true };
}

// 统一响应格式
function successResponse(message: string, data?: any) {
  return {
    code: 0,
    message,
    data
  };
}

function errorResponse(message: string, code: number = -1) {
  return {
    code,
    message
  };
}
```

## 数据模型

### sms_codes 集合

存储验证码信息：

```typescript
interface SmsCode {
  _id: string;
  phone: string;           // 手机号
  code: string;            // 验证码
  scene: string;           // 场景（binding、updatePhone、resetPassword）
  createdAt: number;       // 创建时间戳
  expiresAt: number;       // 过期时间戳
  used: boolean;           // 是否已使用
  usedAt?: number;         // 使用时间戳
}
```

索引：
- `phone + scene + used + expiresAt`（复合索引，用于查询）
- `createdAt`（用于定期清理过期数据）

### sms_logs 集合

存储发送日志：

```typescript
interface SmsLog {
  _id: string;
  phone: string;           // 手机号（脱敏：+86****1234）
  scene: string;           // 场景
  provider: string;        // 服务商（uniCloud / TencentCloud）
  success: boolean;        // 是否成功
  message: string;         // 结果消息
  requestId?: string;      // 请求 ID
  errorCode?: string;      // 错误码
  ip: string;              // 客户端 IP
  createdAt: number;       // 创建时间戳
}
```

索引：
- `phone + createdAt`（用于频率限制）
- `ip + createdAt`（用于 IP 频率限制）
- `createdAt`（用于日志清理）

## 配置文件

### config.json

```json
{
  "provider": "tencentcloud",
  "testMode": false,
  "unicloud": {
    "templateId": "37351"
  },
  "tencentcloud": {
    "secretId": "${TENCENT_SECRET_ID}",
    "secretKey": "${TENCENT_SECRET_KEY}",
    "sdkAppId": "${TENCENT_SMS_SDK_APP_ID}",
    "signName": "您的签名",
    "templateId": "您的模板ID",
    "region": "ap-guangzhou"
  }
}
```

配置说明：
- `provider`: 当前使用的服务商（unicloud / tencentcloud）
- `testMode`: 测试模式，为 true 时使用固定验证码 123456
- 敏感信息使用环境变量占位符，在部署时替换

## 正确性属性

属性是一种特征或行为，应该在系统的所有有效执行中保持为真——本质上是关于系统应该做什么的形式化陈述。属性是人类可读规范和机器可验证正确性保证之间的桥梁。

### 属性 1：服务商配置驱动选择

*对于任何*有效的配置对象，当配置中指定了服务商类型（uniCloud 或 tencentCloud）时，系统应该创建并使用对应类型的服务商实例。

**验证：需求 1.2, 3.2**

### 属性 2：验证码格式一致性

*对于任何*验证码生成请求，生成的验证码应该是恰好 6 位的数字字符串。

**验证：需求 3.1**

### 属性 3：手机号格式验证

*对于任何*输入的手机号字符串，只有符合国内手机号格式（+86 开头的 11 位数字或 1 开头的 11 位数字）的手机号应该被接受，其他格式应该被拒绝。

**验证：需求 3.5, 6.4, 6.5**

### 属性 4：验证码存储完整性

*对于任何*成功发送的验证码，数据库中应该存在一条包含手机号、验证码、场景、创建时间和过期时间的完整记录。

**验证：需求 3.6, 10.1, 10.2**

### 属性 5：验证码有效期设置

*对于任何*新创建的验证码记录，其过期时间应该等于创建时间加上 5 分钟（300000 毫秒）。

**验证：需求 3.7**

### 属性 6：成功响应格式统一

*对于任何*成功的操作，返回的响应对象应该包含 code 字段（值为 0）、message 字段和可选的 data 字段。

**验证：需求 3.8, 9.5**

### 属性 7：验证码查询条件完整性

*对于任何*验证码验证请求，系统应该使用手机号、场景、未使用状态（used=false）和未过期条件作为查询条件。

**验证：需求 4.1, 10.5**

### 属性 8：验证码匹配验证

*对于任何*存在且未过期的验证码，当用户输入的验证码与存储的验证码完全匹配时，验证应该成功；不匹配时应该失败。

**验证：需求 4.2**

### 属性 9：验证码使用后状态更新

*对于任何*验证成功的验证码，数据库中对应记录的 used 字段应该被更新为 true，且 usedAt 字段应该记录使用时间。

**验证：需求 4.3, 10.3**

### 属性 10：验证码单次使用限制

*对于任何*已被标记为已使用（used=true）的验证码，再次尝试验证时应该被拒绝并返回错误。

**验证：需求 4.5**

### 属性 11：场景隔离验证

*对于任何*验证码记录，只有当验证请求的场景与存储的场景完全匹配时，该验证码才能被用于验证。

**验证：需求 5.4, 5.5**

### 属性 12：60 秒频率限制

*对于任何*手机号，如果在过去 60 秒内已经有发送记录，新的发送请求应该被拒绝。

**验证：需求 6.1**

### 属性 13：24 小时发送次数限制

*对于任何*手机号，如果在过去 24 小时内已经发送了 10 次或更多验证码，新的发送请求应该被拒绝。

**验证：需求 6.2**

### 属性 14：IP 小时频率限制

*对于任何*IP 地址，如果在过去 1 小时内已经请求了 20 次或更多，新的请求应该被拒绝。

**验证：需求 6.3**

### 属性 15：日志记录完整性

*对于任何*短信发送操作（无论成功或失败），系统应该记录包含脱敏手机号、场景、服务商名称和时间戳的日志。

**验证：需求 8.2**

## 错误处理

### 错误类型

1. **参数错误**
   - 缺少必需参数
   - 手机号格式无效
   - 场景不支持

2. **频率限制错误**
   - 60 秒内重复请求
   - 24 小时内超过 10 次
   - IP 1 小时内超过 20 次

3. **服务商错误**
   - 配置的服务商不存在
   - 服务商 API 调用失败
   - SDK 初始化失败

4. **验证错误**
   - 验证码不存在
   - 验证码已过期
   - 验证码不匹配
   - 验证码已使用

5. **系统错误**
   - 数据库操作失败
   - 配置加载失败
   - 未知异常

### 错误响应格式

所有错误都应返回统一格式：

```typescript
{
  code: -1,        // 错误码（非 0）
  message: string  // 错误描述
}
```

### 错误日志

所有错误都应记录到日志系统，包含：
- 错误类型
- 错误消息
- 请求参数（脱敏）
- 时间戳
- 堆栈跟踪（系统错误）

## 测试策略

### 双重测试方法

系统采用单元测试和基于属性的测试相结合的方法：

1. **单元测试**：验证特定示例、边缘情况和错误条件
2. **基于属性的测试**：验证所有输入的通用属性

两者是互补的，共同提供全面的覆盖：
- 单元测试捕获具体的错误
- 基于属性的测试验证一般正确性

### 基于属性的测试配置

- 使用 fast-check 库进行基于属性的测试（JavaScript/TypeScript）
- 每个属性测试至少运行 100 次迭代
- 每个测试必须引用其设计文档属性
- 标签格式：**Feature: sms-migration-to-tencent-cloud, Property {number}: {property_text}**

### 测试覆盖范围

#### 单元测试

1. **服务商切换测试**
   - 测试 uniCloud 配置创建 UniCloudSmsProvider
   - 测试 tencentCloud 配置创建 TencentCloudSmsProvider
   - 测试无效服务商配置抛出错误

2. **场景支持测试**
   - 测试 binding 场景可以发送
   - 测试 updatePhone 场景可以发送
   - 测试无效场景被拒绝

3. **测试模式测试**
   - 测试测试模式下生成固定验证码 123456
   - 测试生产模式下生成随机验证码

4. **边缘情况测试**
   - 测试空手机号被拒绝
   - 测试空验证码被拒绝
   - 测试空场景被拒绝
   - 测试过期验证码验证失败
   - 测试已使用验证码验证失败
   - 测试配置缺失时启动失败

#### 基于属性的测试

1. **属性 1-15 的测试**
   - 为每个正确性属性编写一个基于属性的测试
   - 使用随机生成的输入验证属性
   - 每个测试运行至少 100 次迭代

2. **生成器策略**
   - 手机号生成器：生成有效和无效格式
   - 验证码生成器：生成 6 位数字
   - 场景生成器：生成有效和无效场景
   - 配置生成器：生成各种配置组合
   - 时间戳生成器：生成各种时间范围

### 集成测试

1. **端到端流程测试**
   - 发送验证码 → 验证验证码 → 成功
   - 发送验证码 → 错误验证码 → 失败
   - 发送验证码 → 过期 → 验证失败

2. **服务商切换测试**
   - 切换到 uniCloud → 发送成功
   - 切换到腾讯云 → 发送成功
   - 验证两个服务商的行为一致性

3. **频率限制测试**
   - 快速连续请求 → 被限制
   - 超过每日限制 → 被限制
   - IP 超过限制 → 被限制

### 测试环境

- 开发环境：使用测试模式，不实际发送短信
- 测试环境：使用测试模式或测试手机号
- 生产环境：使用真实配置和手机号

