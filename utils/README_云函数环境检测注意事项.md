# 云函数环境检测注意事项

## 核心问题

**问题现象**：uni-app项目在安卓原生端云函数调用失败，显示"微信云开发不可用"

**根本原因**：环境检测逻辑错误，将安卓原生端误判为小程序环境

## 关键经验

### 1. 环境检测逻辑

❌ **错误做法**：
```javascript
const isH5 = typeof window !== 'undefined';
const isMiniProgram = typeof wx !== 'undefined';
```

✅ **正确做法**：
```javascript
// 使用严格的检测逻辑
if (typeof wx !== 'undefined' && wx.getSystemInfoSync && wx.getAccountInfoSync) {
    try {
        const systemInfo = wx.getSystemInfoSync();
        const accountInfo = wx.getAccountInfoSync();
        if (accountInfo.miniProgram && systemInfo.platform) {
            return 'mp-weixin'; // 真正的小程序环境
        }
    } catch (e) {
        // 不是小程序环境
    }
}
```

### 2. 云函数调用方式

| 环境 | 调用方式 | 检测条件 |
|------|----------|----------|
| H5 | TCB | `typeof window !== 'undefined'` |
| App | TCB | `typeof plus !== 'undefined'` 或 `typeof uni !== 'undefined'` |
| 小程序 | 微信云开发 | `wx.cloud && wx.cloud.callFunction` |

### 3. 常见陷阱

1. **wx对象存在但功能不完整**：安卓原生端可能有wx对象，但缺少`wx.cloud`
2. **getApp()访问时机**：确保在应用初始化完成后访问
3. **globalData同步问题**：`this.globalData`和`getApp().globalData`需要分别设置

## 修复步骤

### 1. 创建平台检测工具
```javascript
// utils/platformDetector.js
function getCurrentPlatform() {
    // 1. 检查H5
    if (typeof window !== 'undefined' && typeof document !== 'undefined') {
        return 'h5';
    }
    
    // 2. 检查小程序（严格检测）
    if (typeof wx !== 'undefined' && wx.getSystemInfoSync && wx.getAccountInfoSync) {
        try {
            const accountInfo = wx.getAccountInfoSync();
            if (accountInfo.miniProgram) return 'mp-weixin';
        } catch (e) {}
    }
    
    // 3. 检查App
    if (typeof plus !== 'undefined' || typeof uni !== 'undefined') {
        return 'app';
    }
    
    return 'unknown';
}
```

### 2. 更新所有云函数调用
- 页面中的`callCloudFunction`方法
- 工具类中的云函数调用
- 确保使用新的平台检测逻辑

### 3. 添加调试信息
```javascript
const { debugEnvironmentDetection } = require('./debugPlatform.js');
debugEnvironmentDetection(); // 输出详细环境信息
```

## 需要更新的文件

### 页面文件
- `pages/splash/splash.vue`
- `pages/profile-edit/profile-edit.vue`
- `pages/user-profile/user-profile.vue`
- `pages/post-detail/post-detail.vue`
- 其他使用云函数的页面

### 工具文件
- `utils/avatarCache.js`
- `utils/followCache.js`
- `utils/cloudFunction.js`

## 验证方法

### 控制台输出检查
```
✅ 应该看到：
🔍 [页面] 运行环境: app, 调用方式: tcb
🔍 [页面] 使用TCB调用云函数: xxx (环境: app)

❌ 不应该看到：
❌ [页面] 小程序环境微信云开发不可用
```

### 功能测试
1. 云函数调用成功
2. 头像缓存正常工作
3. 关注状态缓存正常工作
4. 登录状态正确识别

## 预防措施

1. **统一使用平台检测工具**：不要重复编写环境检测代码
2. **添加详细日志**：便于问题排查
3. **测试所有平台**：H5、App、小程序都要测试
4. **定期检查**：新增云函数调用时使用正确的检测逻辑

## 快速修复模板

```javascript
// 在需要云函数调用的地方使用
const { getCurrentPlatform, getCloudFunctionMethod } = require('./platformDetector.js');

const platform = getCurrentPlatform();
const method = getCloudFunctionMethod();

if (method === 'tcb') {
    // 使用TCB调用
    getApp().$tcb.callFunction({ name, data });
} else if (method === 'wx-cloud') {
    // 使用微信云开发调用
    wx.cloud.callFunction({ name, data });
}
```

---

**记住**：环境检测是uni-app跨平台开发的核心问题，必须严格区分不同平台的特征，避免误判。
