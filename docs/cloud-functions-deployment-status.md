# 云函数部署状态清单

## uniCloud 云函数（阿里云）

### 1. sendSmsCode - ✅ 已完成
- **路径**: `uniCloud-aliyun/cloudfunctions/sendSmsCode/`
- **功能**: 发送短信验证码
- **支持场景**: register, login, bindPhone
- **特性**:
  - 验证码有效期5分钟
  - 60秒发送间隔限制
  - 模板ID动态配置
- **状态**: 已创建，待部署

### 2. verifySmsCode - ✅ 已完成
- **路径**: `uniCloud-aliyun/cloudfunctions/verifySmsCode/`
- **功能**: 验证短信验证码
- **特性**:
  - 验证码使用后可重复使用（用于注册/绑定流程）
  - 过期时间检查
  - 场景验证
- **状态**: 已创建，待部署

### 3. getPhoneNumberByToken - ✅ 已完成
- **路径**: `uniCloud-aliyun/cloudfunctions/getPhoneNumberByToken/`
- **功能**: 一键登录获取手机号
- **特性**:
  - 腾讯云开发HTTP调用
  - 安全密钥验证
  - 错误处理
- **状态**: 已创建，待部署

## 腾讯云开发云函数

### 1. loginWithCredentials - ✅ 已完成（增强）
- **路径**: `functions/loginWithCredentials/`
- **功能**: 账号密码登录
- **新增特性**:
  - 登录后检查手机号绑定状态
  - 返回isPhoneVerified字段
  - 触发绑定提示
- **状态**: 已增强，需重新部署

### 2. updateUser - ✅ 已完成（增强）
- **路径**: `functions/updateUser/`
- **功能**: 更新用户信息
- **新增特性**:
  - 手机号绑定支持
  - HTTP接口（用于uniCloud调用）
  - 重复手机号检查
  - 安全密钥验证
- **状态**: 已增强，需重新部署

### 3. loginWithPhone - ✅ 已完成（新建）
- **路径**: `functions/loginWithPhone/`
- **功能**: 手机号登录
- **特性**:
  - 纯手机号登录
  - OpenID同步更新
  - 手机号验证状态检查
- **状态**: 已创建，待部署

## 前端页面更新

### 1. pages/register/register.vue - ✅ 已完成（重大修改）
- **平台检测**: APP端 vs 其他端
- **注册流程**:
  - APP端: 优先一键登录，其次短信验证码
  - 其他端: 直接使用短信验证码
- **状态**: 已更新

### 2. pages/login/login.vue - ✅ 已完成（简化+增强）
- **登录方式**: 仅账号密码
- **后登录处理**: 手机号绑定提示
- **绑定方式**:
  - APP端: 优先一键登录
  - 其他端: 短信验证码
- **状态**: 已更新

## 部署步骤

### uniCloud 函数部署
```bash
# 在HBuilderX中或使用cli工具
# 1. 部署sendSmsCode
# 2. 部署verifySmsCode
# 3. 部署getPhoneNumberByToken

# 注意：部署前请确保已安装uni-cloud-sms扩展库
```

### 扩展库配置
**重要**：部署前需要在uniCloud控制台安装扩展库：
1. 登录 [uniCloud控制台](https://unicloud.dcloud.net.cn/)
2. 选择对应的服务空间
3. 进入"扩展库" -> "安装扩展库"
4. 搜索并安装 `uni-cloud-sms` 扩展库
5. 等待安装完成后重新部署云函数

**注意**：`uni-cloud-sms` 是uniCloud扩展库，不是npm包，需要在云函数的package.json中添加extensions配置：
```json
{
  "extensions": {
    "uni-cloud-sms": {}
  }
}
```

### 腾讯云函数部署
```bash
# 1. 部署loginWithCredentials（更新版本）
# 2. 部署updateUser（更新版本）
# 3. 部署loginWithPhone（新函数）
```

## 配置要求

### 环境变量配置
- `TENCENT_CLOUD_HTTP_KEY`: HTTP请求安全密钥
- 短信模板ID配置
- 数据库集合权限设置

### 数据库集合
- `sms_codes`: 验证码存储
- `users`: 用户信息（包含phoneNumber, isPhoneVerified字段）

## 测试建议

1. **单元测试**: 每个云函数独立测试
2. **集成测试**: 跨云通信测试
3. **端到端测试**: 完整注册/登录/绑定流程
4. **平台测试**: APP端、H5端、小程序端分别测试

## 注意事项

- 确保所有云函数的错误处理完善
- 验证跨云HTTP通信的安全性
- 检查短信发送频率限制
- 确认手机号格式验证逻辑
- 测试一键登录在不同平台的兼容性