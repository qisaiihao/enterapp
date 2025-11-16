# H5 端 GitHub 登录使用说明

## 📋 概述

现在云函数已支持 **App** 和 **H5** 双平台，使用同一套代码，通过 `platform` 参数区分。

## 🎯 H5 端登录流程

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

## 💻 前端代码示例

### 在登录页面调用（login.vue）

```javascript
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
                    platform: platform  // 告诉云函数当前平台
                }
            });

            if (res.result && res.result.success) {
                const authUrl = res.result.authUrl;
                console.log('获取到授权URL:', authUrl);
                
                // H5 端直接在当前窗口跳转
                // #ifdef H5
                window.location.href = authUrl;
                // #endif

                // App 端使用 plus.runtime.openURL
                // #ifdef APP-PLUS
                plus.runtime.openURL(authUrl);
                // #endif
            } else {
                uni.showToast({ 
                    title: '获取授权地址失败', 
                    icon: 'none' 
                });
            }
        } catch (e) {
            console.error('GitHub登录失败:', e);
            uni.showToast({ 
                title: '请求失败，请重试', 
                icon: 'none' 
            });
        }
    }
}
```

## 📁 文件结构

```
pages/
├── auth/
│   └── callback.vue          # H5 回调页面（已创建）
├── login/
│   └── login.vue             # 登录页面（需要添加上述代码）
└── register/
    └── register.vue          # 注册页面
```

## 🔧 云函数配置

### 环境变量

确保在腾讯云开发控制台配置以下环境变量：

- `GITHUB_CLIENT_ID`: GitHub OAuth App 的 Client ID
- `GITHUB_CLIENT_SECRET`: GitHub OAuth App 的 Client Secret
- `GITHUB_REDIRECT_URI`: GitHub OAuth 回调地址（云函数的 HTTP 触发地址）
- `FRONTEND_URL`: H5 前端地址（例如：`https://your-domain.com`）

### 重要提示

`FRONTEND_URL` 必须是你的 H5 应用的完整域名，例如：
- 开发环境：`http://localhost:8080`
- 生产环境：`https://cloud1-5gb0pbyl400845f5-1378788263.ap-shanghai.app.tcloudbase.com`

## ✅ 回调页面功能

`pages/auth/callback.vue` 已创建，支持：

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

## 🚀 测试步骤

### H5 端测试

1. 在浏览器中打开你的 H5 应用
2. 点击"使用 GitHub 登录"
3. 在 GitHub 授权页面点击"Authorize"
4. 自动返回到你的应用并完成登录

### App 端测试

1. 打包并安装 App
2. 点击"使用 GitHub 登录"
3. 在系统浏览器中完成授权
4. 点击"打开应用"返回 App

## 🎨 优势

- ✅ **统一云函数**：一套代码支持双平台
- ✅ **H5 体验流畅**：全程在浏览器内完成
- ✅ **App 体验原生**：使用 URL Scheme 唤起
- ✅ **易于维护**：平台差异通过参数区分

## 📝 注意事项

1. **H5 端不需要配置 URL Scheme**
2. **确保 FRONTEND_URL 环境变量正确配置**
3. **回调页面已在 pages.json 中注册**
4. **云函数超时时间已调整为 60 秒**
