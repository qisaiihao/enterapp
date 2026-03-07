# GitHub OAuth 登录完整指南

## 概述

本文档整合了回车键项目的 GitHub OAuth 登录配置、授权流程、H5端实现和 URL Scheme 配置的完整指南。

---

## 一、GitHub OAuth 配置

### 1.1 创建 GitHub OAuth App

1. 登录 GitHub 账号
2. 进入 Settings → Developer settings → OAuth Apps
3. 点击 "New OAuth App"
4. 填写应用信息：

```
Application name: PoemEnter
Homepage URL: https://你的域名.com 或 http://localhost:3000（本地开发）
Authorization callback URL: https://你的云开发环境域名.com/api/auth/github/callback
```

### 1.2 获取 Client ID 和 Client Secret

创建成功后，你会得到：
- Client ID: 显示在页面上
- Client Secret: 点击 "Generate a new client secret" 生成（只显示一次）

### 1.3 腾讯云开发环境配置

在腾讯云开发控制台：

1. 进入云开发控制台
2. 选择你的环境
3. 进入 "云函数" → "函数配置"
4. 添加以下环境变量：

```
GITHUB_CLIENT_ID=你的GitHub Client ID
GITHUB_CLIENT_SECRET=你的GitHub Client Secret
GITHUB_REDIRECT_URI=https://你的云开发环境域名.com/api/auth/github/callback
FRONTEND_URL=H5前端地址（例如：https://your-domain.com）
```

### 1.4 本地开发环境变量

如果使用本地开发，在项目根目录创建 `.env` 文件：

```
GITHUB_CLIENT_ID=你的GitHub Client ID
GITHUB_CLIENT_SECRET=你的GitHub Client Secret
GITHUB_REDIRECT_URI=http://localhost:3000/api/auth/github/callback
FRONTEND_URL=http://localhost:8080
```

---

## 二、授权流程说明

### 2.1 完整流程

```
用户点击 GitHub 登录按钮
    ↓
调用云函数获取授权URL
    ↓
跳转到 GitHub 授权页面
    ↓
用户在 GitHub 授权
    ↓
GitHub 重定向到云函数回调地址
    ↓
云函数处理回调
    ↓
根据平台返回不同响应
    ├─ App: 生成 URL Scheme 唤起应用
    └─ H5: 重定向到前端回调页面
```

### 2.2 云函数处理逻辑

云函数 `github-auth` 的主要步骤：

1. 用 `code` 换取 `access_token`
2. 获取用户信息（用户名、头像、邮箱等）
3. 检查用户是否已在数据库中注册
4. 根据平台生成不同的响应：
   - **App**: 生成 URL Scheme 地址
   - **H5**: 重定向到前端回调页面

---

## 三、App 端实现（URL Scheme）

### 3.1 URL Scheme 配置

#### manifest.json 配置

```json
{
  "app-plus": {
    "distribute": {
      "android": {
        "schemes": "poementer",
        "permissions": [
          "<uses-permission android:name=\"android.permission.INTERNET\"/>"
        ]
      },
      "ios": {
        "urlschemewhitelist": "poementer",
        "urltypes": [
          {
            "urlschemes": ["poementer"],
            "id": "com.poementer.app",
            "urlidentifier": "com.poementer.app"
          }
        ]
      }
    }
  }
}
```

### 3.2 URL Scheme 格式

```
poementer://github-callback?type=register&data=...
```

参数说明：
- `poementer://`: 在 `manifest.json` 中配置的 URL Scheme
- `github-callback`: 自定义路径，用于识别是 GitHub 回调
- `type`: `register`（新用户）或 `login`（已注册用户）
- `data`: JSON 编码的用户数据

### 3.3 App.vue 监听逻辑

```javascript
export default {
  onLaunch: function (options) {
    // #ifdef APP-PLUS
    const args = plus.runtime.arguments;
    if (args && args.includes('github-callback')) {
      this.handleUrlScheme({ path: args });
    }
    // #endif
  },

  onShow: function(options) {
    // #ifdef APP-PLUS
    const args = plus.runtime.arguments;
    if (args && args.includes('github-callback')) {
      this.handleUrlScheme({ path: args });
    }
    
    // 监听 Android newintent 事件
    plus.globalEvent.addEventListener('newintent', (e) => {
      const args = plus.runtime.arguments;
      if (args) {
        this.handleUrlScheme({ path: args });
      }
    });
    // #endif
  },

  methods: {
    handleUrlScheme(options) {
      if (options && options.path && options.path.includes('github-callback')) {
        // 解析参数
        const url = options.path;
        const params = this.parseUrlParams(url);
        
        if (params.type === 'register') {
          // 新用户注册流程
          const data = JSON.parse(decodeURIComponent(params.data));
          uni.setStorageSync('github_temp_data', data);
          uni.showToast({ title: '欢迎！请完成注册', icon: 'none' });
          uni.navigateTo({ url: '/pages/register/register' });
        } else if (params.type === 'login') {
          // 已注册用户登录流程
          const data = JSON.parse(decodeURIComponent(params.data));
          uni.setStorageSync('userInfo', data.user);
          uni.setStorageSync('github_access_token', data.accessToken);
          uni.showToast({ title: '登录成功！', icon: 'success' });
          uni.switchTab({ url: '/pages/poem-square/poem-square' });
        }
      }
    }
  }
}
```

---

## 四、H5 端实现

### 4.1 H5 登录流程

```
用户点击登录
    ↓
调用云函数获取授权URL（platform: 'h5'）
    ↓
跳转到 GitHub 授权页面
    ↓
用户授权成功
    ↓
GitHub 重定向到云函数
    ↓
云函数处理后重定向到 H5 回调页面
    ↓
回调页面处理数据并跳转
```

### 4.2 前端代码示例

```javascript
// pages/login/login.vue
methods: {
    async onGithubLogin() {
        try {
            // 根据平台设置 platform 参数
            // #ifdef H5
            const platform = 'h5';
            // #endif
            
            // #ifdef APP-PLUS
            const platform = 'app';
            // #endif

            // 调用云函数获取授权 URL
            const res = await this.$tcb.callFunction({
                name: 'github-auth',
                data: {
                    action: 'getAuthUrl',
                    platform: platform
                }
            });

            if (res.result && res.result.success) {
                const authUrl = res.result.authUrl;
                
                // H5 端直接在当前窗口跳转
                // #ifdef H5
                window.location.href = authUrl;
                // #endif

                // App 端使用 plus.runtime.openURL
                // #ifdef APP-PLUS
                plus.runtime.openURL(authUrl);
                // #endif
            }
        } catch (e) {
            console.error('GitHub登录失败:', e);
            uni.showToast({ title: '请求失败，请重试', icon: 'none' });
        }
    }
}
```

### 4.3 回调页面功能

`pages/auth/callback.vue` 支持：

1. **新用户注册** (`type=register`)
   - 保存 GitHub 数据到本地存储
   - 跳转到注册页面

2. **已注册用户登录** (`type=login`)
   - 保存用户信息和 token
   - 更新全局状态
   - 跳转到诗歌广场

3. **错误处理** (`type=error`)
   - 显示错误弹窗
   - 返回登录页面

---

## 五、测试指南

### 5.1 App 端测试

1. 打包并安装 App
2. 点击"使用 GitHub 登录"
3. 在系统浏览器中完成授权
4. 点击"打开应用"返回 App
5. 验证登录状态和用户信息

### 5.2 H5 端测试

1. 在浏览器中打开你的 H5 应用
2. 点击"使用 GitHub 登录"
3. 在 GitHub 授权页面点击"Authorize"
4. 自动返回到你的应用并完成登录

### 5.3 测试清单

- [ ] 新用户注册流程正常
- [ ] 已注册用户登录流程正常
- [ ] App 在后台时能正确唤起
- [ ] H5 端全程在浏览器内完成
- [ ] 错误处理正常（网络错误、授权失败等）
- [ ] 用户信息正确保存和显示

---

## 六、故障排查

### 6.1 App 端问题

**问题 1**: App 没有被唤起
- **原因**: URL Scheme 配置错误或未重新编译 App
- **解决**: 检查 `manifest.json` 配置，重新编译并安装 App

**问题 2**: 数据解析失败
- **原因**: URL 参数编码问题
- **解决**: 检查云函数中的 `encodeURIComponent` 和 App 中的 `decodeURIComponent`

**问题 3**: 跳转到错误的页面
- **原因**: `type` 参数判断错误
- **解决**: 检查云函数中的 `isNewUser` 逻辑和 URL 生成逻辑

### 6.2 H5 端问题

**问题 1**: 回调地址配置错误
- **解决**: 在 GitHub OAuth App 设置中修改回调地址

**问题 2**: FRONTEND_URL 未配置
- **解决**: 确保云函数环境变量中配置了正确的 FRONTEND_URL

---

## 七、数据库字段说明

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

---

## 八、安全建议

1. 定期更换 Client Secret
2. 使用 HTTPS 传输
3. 不要在代码中硬编码敏感信息
4. 监控异常登录行为
5. 及时更新依赖包版本

---

## 九、优势总结

- **统一云函数**: 一套代码支持双平台
- **H5 体验流畅**: 全程在浏览器内完成
- **App 体验原生**: 使用 URL Scheme 唤起
- **易于维护**: 平台差异通过参数区分
- **无缝体验**: 用户授权后自动返回 App，无需手动操作
- **数据安全**: 敏感数据通过 URL Scheme 直接传递给 App，不经过第三方
- **跨平台**: iOS 和 Android 都支持 URL Scheme

---

*最后更新: 2026-03-07*
