# 短信服务快速配置指南

## 架构说明

本项目支持两套云函数系统：

1. **uniCloud 云函数**（`uniCloud-aliyun/cloudfunctions/`）
   - 用于 uni-app 应用
   - 调用 uniCloud SMS API

2. **腾讯云云函数**（`functions/`）- 微信云开发
   - 用于微信小程序
   - 可调用腾讯云 SMS API（推荐）或微信云开发短信

## 快速开始

### 方案一：使用腾讯云 SMS（推荐）

#### 1. 配置腾讯云云函数

```bash
# 进入云函数目录
cd functions/sendSmsCode

# 安装依赖
npm install
```

#### 2. 设置环境变量

在微信云开发控制台设置：
```
TENCENT_SECRET_ID=你的SecretId
TENCENT_SECRET_KEY=你的SecretKey
```

#### 3. 确认配置

打开 `functions/sendSmsCode/config.js`，确认：
```javascript
{
  provider: 'tencentcloud',  // 使用腾讯云
  testMode: false            // 生产模式
}
```

#### 4. 部署云函数

在微信开发者工具中：
- 右键 `sendSmsCode` 云函数
- 选择"上传并部署：云端安装依赖"
- 同样部署 `verifySmsCode` 云函数

#### 5. 配置前端

打开 `utils/sms-config.js`，设置：
```javascript
{
  provider: 'tencentcloud'  // 使用腾讯云云函数
}
```

### 方案二：使用 uniCloud

#### 1. 配置 uniCloud 云函数

```bash
# 进入云函数目录
cd uniCloud-aliyun/cloudfunctions/sendSmsCode

# 安装依赖
npm install
```

#### 2. 设置环境变量

在 uniCloud 控制台设置：
```
TENCENT_SECRET_ID=你的SecretId
TENCENT_SECRET_KEY=你的SecretKey
```

#### 3. 确认配置

打开 `uniCloud-aliyun/cloudfunctions/sendSmsCode/config.json`，确认：
```json
{
  "provider": "tencentcloud"
}
```

#### 4. 部署云函数

在 HBuilderX 中：
- 右键 `sendSmsCode` 云函数
- 选择"上传部署"

#### 5. 配置前端

打开 `utils/sms-config.js`，设置：
```javascript
{
  provider: 'unicloud'  // 使用 uniCloud 云函数
}
```

## 配置对照表

| 项目 | 腾讯云云函数 | uniCloud 云函数 |
|------|-------------|----------------|
| 云函数位置 | `functions/` | `uniCloud-aliyun/cloudfunctions/` |
| 配置文件 | `config.js` | `config.json` |
| 环境变量设置 | 微信云开发控制台 | uniCloud 控制台 |
| 部署工具 | 微信开发者工具 | HBuilderX |
| 前端配置 | `provider: 'tencentcloud'` | `provider: 'unicloud'` |

## 测试模式

开发时建议启用测试模式：

**腾讯云云函数**：
```javascript
// functions/sendSmsCode/config.js
{
  testMode: true
}
```

**uniCloud 云函数**：
```json
// uniCloud-aliyun/cloudfunctions/sendSmsCode/config.json
{
  "testMode": true
}
```

测试模式下使用固定验证码：`123456`

## 前端调用示例

```javascript
import { sendSmsCode, verifySmsCode } from '@/utils/sms-config';

// 发送验证码
async function handleSendCode() {
  try {
    const result = await sendSmsCode('13800138000', 'binding');
    
    if (result.result.success) {
      uni.showToast({ title: '验证码已发送' });
    } else {
      uni.showToast({ 
        title: result.result.message, 
        icon: 'none' 
      });
    }
  } catch (error) {
    console.error('发送失败:', error);
  }
}

// 验证验证码
async function handleVerifyCode(code) {
  try {
    const result = await verifySmsCode('13800138000', code, 'binding');
    
    if (result.result.success) {
      uni.showToast({ title: '验证成功' });
      // 继续后续操作
    } else {
      uni.showToast({ 
        title: result.result.message, 
        icon: 'none' 
      });
    }
  } catch (error) {
    console.error('验证失败:', error);
  }
}
```

## 切换服务商

### 从 uniCloud 切换到腾讯云

1. 部署腾讯云云函数（`functions/sendSmsCode`）
2. 修改 `utils/sms-config.js`：
   ```javascript
   provider: 'tencentcloud'
   ```
3. 重新编译前端代码

### 从腾讯云切换到 uniCloud

1. 部署 uniCloud 云函数（`uniCloud-aliyun/cloudfunctions/sendSmsCode`）
2. 修改 `utils/sms-config.js`：
   ```javascript
   provider: 'unicloud'
   ```
3. 重新编译前端代码

## 常见问题

### Q: 应该使用哪个方案？
A: 
- 如果主要后端在腾讯云（微信云开发），推荐使用**腾讯云云函数**
- 如果使用 uni-app 多端开发，推荐使用 **uniCloud 云函数**

### Q: 两个方案可以同时部署吗？
A: 可以！两套云函数可以同时部署，通过前端配置切换使用。

### Q: 如何确认当前使用的是哪个方案？
A: 查看 `utils/sms-config.js` 中的 `provider` 配置。

### Q: 环境变量在哪里设置？
A: 
- 腾讯云云函数：微信云开发控制台 > 云函数 > 函数配置 > 环境变量
- uniCloud 云函数：uniCloud 控制台 > 云函数 > 云函数配置 > 环境变量

## 推荐配置

由于你的主要后端在腾讯云，推荐使用：

✅ **腾讯云云函数 + 腾讯云 SMS API**

优势：
- 同一云平台，性能更好
- 无跨域问题
- 管理更方便
- 成本更低

## 下一步

1. 选择方案（推荐腾讯云云函数）
2. 按照快速开始步骤配置
3. 启用测试模式进行测试
4. 确认无误后切换到生产模式
5. 部署到生产环境

需要帮助？查看详细文档：
- 腾讯云云函数：`functions/sendSmsCode/README.md`
- uniCloud 云函数：`uniCloud-aliyun/cloudfunctions/sendSmsCode/README.md`
