# GitHub OAuth 登录配置指南

## 1. GitHub 端配置

### 创建 GitHub OAuth App

1. 登录 GitHub 账号
2. 进入 Settings → Developer settings → OAuth Apps
3. 点击 "New OAuth App"
4. 填写应用信息：

```
Application name: PoemEnter
Homepage URL: https://你的域名.com 或 http://localhost:3000（本地开发）
Authorization callback URL: https://你的云开发环境域名.com/api/auth/github/callback
```

### 获取 Client ID 和 Client Secret

创建成功后，你会得到：
- Client ID: 显示在页面上
- Client Secret: 点击 "Generate a new client secret" 生成（只显示一次）

## 2. 腾讯云开发环境配置

### 设置环境变量

在腾讯云开发控制台：

1. 进入云开发控制台
2. 选择你的环境
3. 进入 "云函数" → "函数配置"
4. 添加以下环境变量：

```
GITHUB_CLIENT_ID=你的GitHub Client ID
GITHUB_CLIENT_SECRET=你的GitHub Client Secret
GITHUB_REDIRECT_URI=https://你的云开发环境域名.com/api/auth/github/callback
```

### 本地开发环境变量

如果使用本地开发，在项目根目录创建 `.env` 文件：

```
GITHUB_CLIENT_ID=你的GitHub Client ID
GITHUB_CLIENT_SECRET=你的GitHub Client Secret
GITHUB_REDIRECT_URI=http://localhost:3000/api/auth/github/callback
```

## 3. 部署云函数

```bash
# 安装依赖
cd functions/github-auth
npm install

# 部署云函数
tcb fn deploy github-auth
```

## 4. 回调地址说明

### 生产环境
回调地址应该是你的实际域名：
```
https://你的域名.com/pages/login/login
```

### 开发环境
本地开发时的回调地址：
```
http://localhost:3000/pages/login/login
```

### 云开发环境
使用云开发提供的域名：
```
https://你的云开发环境域名.com/pages/login/login
```

## 5. 测试流程

1. 访问登录页面
2. 点击 "使用 GitHub 登录" 按钮
3. 会跳转到 GitHub 授权页面
4. 授权后会自动跳转回你的应用
5. 新用户会自动注册，老用户直接登录
6. 所有 GitHub 登录用户都需要绑定手机号

## 6. 常见问题

### Q: 回调地址配置错误怎么办？
A: 在 GitHub OAuth App 设置中可以修改回调地址

### Q: 本地开发和生产环境如何切换？
A: 使用不同的环境变量，或者在代码中根据环境判断

### Q: 用户信息安全吗？
A: 是的，我们使用 HTTPS 传输，敏感信息存储在环境变量中

### Q: 为什么 GitHub 登录后还要绑定手机号？
A: 为了账户安全和符合国内应用的管理要求

## 7. 数据库字段说明

GitHub 登录用户会在 `users` 集合中创建以下字段：

```javascript
{
  openid: "github_用户GitHubID",  // 主键
  poemId: "生成的PoemID",         // 基于GitHub用户名
  nickName: "GitHub用户名",       // GitHub显示名称
  avatarUrl: "GitHub头像URL",     // GitHub头像
  githubUsername: "GitHub登录名", // GitHub登录名
  githubAvatar: "GitHub头像URL",  // GitHub头像备份
  githubEmail: "GitHub邮箱",      // GitHub主邮箱
  phoneNumber: "",                // 需要后续绑定
  isPhoneVerified: false,         // 手机号验证状态
  createdAt: Date,                // 创建时间
  lastLoginAt: Date               // 最后登录时间
}
```

## 8. 安全建议

1. 定期更换 Client Secret
2. 使用 HTTPS 传输
3. 不要在代码中硬编码敏感信息
4. 监控异常登录行为
5. 及时更新依赖包版本