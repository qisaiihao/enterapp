# GitHub OAuth 授权流程说明

## 问题背景

之前的 GitHub 授权流程在最后一步遇到了问题：云函数成功获取用户信息后，重定向到了一个 HTML 页面，但浏览器无法将数据传回 uni-app，导致用户看到 404 错误或空白页。

## 解决方案：URL Scheme

使用 **URL Scheme** 机制，允许浏览器通过特殊的 URL 唤起 App 并传递数据。

---

## 完整流程

### 1. 用户点击 GitHub 登录按钮

- **位置**: uni-app 登录页面
- **操作**: 调用云函数获取 GitHub 授权 URL
- **跳转**: 使用 `plus.runtime.openURL()` 在系统浏览器中打开 GitHub 授权页面

### 2. 用户在 GitHub 授权

- **位置**: GitHub 授权页面（系统浏览器）
- **操作**: 用户同意授权
- **回调**: GitHub 重定向到云函数回调地址

### 3. 云函数处理回调

- **位置**: `functions/github-auth/index.js`
- **操作**:
  1. 用 `code` 换取 `access_token`
  2. 获取用户信息（用户名、头像、邮箱等）
  3. 检查用户是否已在数据库中注册
  4. 生成包含用户数据的 URL Scheme 地址
  5. 返回一个自动跳转的 HTML 页面

### 4. 浏览器尝试打开 URL Scheme

- **URL 格式**: `poementer://github-callback?type=register&data=...`
  - `poementer://`: 在 `manifest.json` 中配置的 URL Scheme
  - `github-callback`: 自定义路径，用于识别是 GitHub 回调
  - `type`: `register`（新用户）或 `login`（已注册用户）
  - `data`: JSON 编码的用户数据

### 5. 操作系统唤起 App

- **触发**: 系统识别到 `poementer://` 协议
- **操作**: 唤起 uni-app（如果在后台则切换到前台）
- **事件**: 
  - App 未启动或已关闭：触发 `onLaunch`
  - App 在后台运行：触发 `onShow` 和 `newintent`（Android）

### 6. App 处理回调数据

- **位置**: `App.vue` 的 `handleUrlScheme` 方法
- **操作**:
  - 解析 URL 参数
  - 根据 `type` 执行不同逻辑：
    - **新用户** (`type=register`):
      - 保存 GitHub 数据到本地存储
      - 显示 "欢迎！请完成注册" 提示
      - 跳转到注册页面
    - **已注册用户** (`type=login`):
      - 保存用户信息到全局状态和本地存储
      - 显示 "登录成功！" 提示
      - 跳转到诗歌广场页面

---

## 关键配置

### 1. manifest.json

```json
{
  "app-plus": {
    "distribute": {
      "android": {
        "schemes": "poementer"
      },
      "ios": {
        "urlschemewhitelist": "poementer"
      }
    }
  }
}
```

### 2. 云函数重定向逻辑

```javascript
// 新用户
const appScheme = `poementer://github-callback?type=register&data=${encodedData}`;

// 已注册用户
const appScheme = `poementer://github-callback?type=login&data=${encodedData}`;

// 返回自动跳转页面
return {
  statusCode: 200,
  headers: {
    'Content-Type': 'text/html; charset=utf-8'
  },
  body: generateRedirectPage(appScheme, h5Fallback, message)
};
```

### 3. App.vue 监听逻辑

```javascript
// onLaunch: App 首次启动
onLaunch: function (options) {
  this.handleUrlScheme(options);
  // ...
}

// onShow: App 从后台唤醒
onShow: function(options) {
  if (options && options.path) {
    this.handleUrlScheme(options);
  }
  
  // 监听 Android newintent 事件
  plus.globalEvent.addEventListener('newintent', (e) => {
    const args = plus.runtime.arguments;
    if (args) {
      this.handleUrlScheme({ path: args });
    }
  });
}

// handleUrlScheme: 解析和处理 URL Scheme
handleUrlScheme(options) {
  if (options && options.path && options.path.includes('github-callback')) {
    // 解析参数
    // 根据 type 执行相应操作
    // 保存数据并跳转页面
  }
}
```

---

## 数据流转

### 新用户注册流程

```
GitHub → 云函数 → URL Scheme → App.vue → 注册页面
                    ↓
              GitHub 数据
              - openid
              - githubUsername
              - githubAvatar
              - githubEmail
              - accessToken
```

### 已注册用户登录流程

```
GitHub → 云函数 → URL Scheme → App.vue → 诗歌广场
                    ↓
              登录数据
              - user (完整用户信息)
              - accessToken
              - isNewUser: false
```

---

## 测试步骤

### 1. 测试新用户注册

1. 清除 App 的本地存储和用户数据
2. 点击 "使用 GitHub 登录" 按钮
3. 在浏览器中完成 GitHub 授权
4. 观察是否自动返回 App
5. 检查是否跳转到注册页面
6. 检查注册页面是否自动填充了 GitHub 信息

### 2. 测试已注册用户登录

1. 使用已注册的 GitHub 账号
2. 点击 "使用 GitHub 登录" 按钮
3. 在浏览器中完成 GitHub 授权
4. 观察是否自动返回 App
5. 检查是否显示 "登录成功！" 提示
6. 检查是否跳转到诗歌广场页面
7. 检查用户信息是否正确显示

### 3. 测试 App 在后台的情况

1. 打开 App 后按 Home 键（App 进入后台）
2. 在浏览器中完成 GitHub 授权
3. 观察 App 是否被唤起并正确处理回调

---

## 调试技巧

### 1. 查看控制台日志

关键日志标识：
- `🔗 [URL Scheme]`: URL Scheme 相关日志
- `📝 [GitHub 授权]`: GitHub 授权处理日志
- `✅`: 成功操作
- `❌`: 错误信息
- `⚠️`: 警告信息

### 2. 检查本地存储

```javascript
// 查看保存的 GitHub 临时数据（新用户）
uni.getStorageSync('github_temp_data')

// 查看保存的用户信息（已登录用户）
uni.getStorageSync('userInfo')

// 查看保存的 access token
uni.getStorageSync('github_access_token')
```

### 3. 常见问题

**问题 1**: App 没有被唤起
- **原因**: URL Scheme 配置错误或未重新编译 App
- **解决**: 检查 `manifest.json` 配置，重新编译并安装 App

**问题 2**: 数据解析失败
- **原因**: URL 参数编码问题
- **解决**: 检查云函数中的 `encodeURIComponent` 和 App 中的 `decodeURIComponent`

**问题 3**: 跳转到错误的页面
- **原因**: `type` 参数判断错误
- **解决**: 检查云函数中的 `isNewUser` 逻辑和 URL 生成逻辑

---

## 优势

1. **无缝体验**: 用户授权后自动返回 App，无需手动操作
2. **数据安全**: 敏感数据通过 URL Scheme 直接传递给 App，不经过第三方
3. **跨平台**: iOS 和 Android 都支持 URL Scheme
4. **可靠性**: 即使 App 在后台，也能正确唤起并处理回调

---

## 后续优化建议

1. **Universal Links (iOS)**: 提供更好的用户体验，无需弹出确认对话框
2. **App Links (Android)**: Android 6.0+ 的官方深度链接方案
3. **错误处理**: 添加更详细的错误提示和重试机制
4. **安全性**: 添加 state 参数验证，防止 CSRF 攻击
