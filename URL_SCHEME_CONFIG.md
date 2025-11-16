# URL Scheme 配置说明

## ✅ 已修复的配置

### 1. **Android 配置**
- ✅ 添加了 `INTERNET` 权限（必需，用于网络请求）
- ✅ 保留了 `schemes: "poementer"` 配置
- ✅ 添加了 `abiFilters`（优化包体积）

### 2. **iOS 配置**
- ✅ 添加了 `urltypes` 配置（标准的 iOS URL Scheme 配置）
- ✅ 保留了 `urlschemewhitelist` 配置

## 📋 完整配置清单

### Android 必需权限
```json
"permissions": [
    "<uses-permission android:name=\"android.permission.INTERNET\"/>",  // 🔴 必需！
    "<uses-permission android:name=\"android.permission.ACCESS_NETWORK_STATE\"/>",
    "<uses-permission android:name=\"android.permission.ACCESS_WIFI_STATE\"/>",
    // ... 其他权限
]
```

### iOS URL Types
```json
"urltypes": [
    {
        "urlschemes": ["poementer"],
        "id": "com.poementer.app",
        "urlidentifier": "com.poementer.app"
    }
]
```

## 🔧 打包注意事项

### 1. **自定义基座 vs 正式包**
- **自定义基座**：包含所有权限和配置，用于开发调试
- **正式包**：需要重新打包才能应用 manifest.json 的修改

### 2. **重新打包步骤**
1. 修改 `manifest.json` 后
2. HBuilderX → 发行 → 原生App-云打包
3. 选择 Android/iOS 平台
4. 等待打包完成
5. 下载并安装新的 APK/IPA

### 3. **版本号管理**
每次打包建议更新版本号：
```json
"versionName": "1.0.2",  // 显示版本
"versionCode": 105       // 内部版本号（递增）
```

## 🐛 常见问题

### Q1: 为什么自定义基座可以，正式包不行？
**A:** 自定义基座包含完整的开发配置，但正式包需要重新打包才能应用 manifest.json 的修改。

### Q2: URL Scheme 不生效？
**A:** 检查：
1. ✅ `schemes` 配置是否正确
2. ✅ iOS 的 `urltypes` 是否配置
3. ✅ Android 的 `INTERNET` 权限是否添加
4. ✅ 是否重新打包了正式包

### Q3: 如何测试 URL Scheme？
**方法 1 - 浏览器测试**
```
在浏览器地址栏输入：poementer://test
```

**方法 2 - adb 测试（Android）**
```bash
adb shell am start -W -a android.intent.action.VIEW -d "poementer://github-callback?type=test&data=test"
```

**方法 3 - 实际 GitHub 登录测试**
1. 点击 GitHub 登录
2. 授权后观察是否能正确唤起 App
3. 查看 App 日志

## 📱 App.vue 配置检查

确保 `App.vue` 中有以下代码：

```javascript
// onLaunch
onLaunch: function (options) {
    // #ifdef APP-PLUS
    const args = plus.runtime.arguments;
    if (args && args.includes('github-callback')) {
        this.handleUrlScheme({ path: args });
    }
    // #endif
},

// onShow
onShow: function (options) {
    // #ifdef APP-PLUS
    const args = plus.runtime.arguments;
    if (args && args.includes('github-callback')) {
        this.handleUrlScheme({ path: args });
    }
    // #endif
},

// newintent 事件（重要！）
// #ifdef APP-PLUS
plus.globalEvent.addEventListener('newintent', (e) => {
    const args = plus.runtime.arguments;
    if (args && args.includes('github-callback')) {
        this.handleUrlScheme({ path: args });
    }
});
// #endif
```

## ✅ 验证清单

打包前检查：
- [ ] manifest.json 中 Android 有 `INTERNET` 权限
- [ ] manifest.json 中 Android 有 `schemes: "poementer"`
- [ ] manifest.json 中 iOS 有 `urltypes` 配置
- [ ] App.vue 中有 `onLaunch`、`onShow`、`newintent` 处理
- [ ] 版本号已更新

打包后检查：
- [ ] 安装新的 APK/IPA
- [ ] 测试浏览器输入 `poementer://test` 能否唤起 App
- [ ] 测试 GitHub 登录完整流程
- [ ] 查看控制台日志是否正常

## 🎯 下一步

1. **重新打包 App**（必须！）
2. **安装新包**
3. **测试 GitHub 登录**
4. **查看日志**

如果还有问题，请提供：
- 打包后的 App 版本号
- 测试时的控制台日志
- GitHub 回调时的 URL
