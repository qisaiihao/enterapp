# 云函数环境检测修复说明

## 问题描述

在uni-app项目中，从小程序迁移到H5和安卓原生端时，云函数调用出现环境识别错误：
- H5环境下云函数正常工作
- 安卓原生端被错误识别为小程序环境，导致云函数调用失败
- 下载的云函数可以正常使用，但上传的云函数无法使用

## 问题原因

原始的环境检测逻辑过于简单：
```javascript
const isH5 = typeof window !== 'undefined';
const isMiniProgram = typeof wx !== 'undefined';
```

在安卓原生端，`typeof wx !== 'undefined'` 可能返回 `true`，导致系统误判为小程序环境，从而使用微信云开发而不是腾讯云开发SDK。

## 解决方案

### 1. 创建了完善的平台检测工具 (`utils/platformDetector.js`)

```javascript
const { getCurrentPlatform, getCloudFunctionMethod, logPlatformInfo } = require('./platformDetector.js');
```

**主要功能：**
- 准确识别H5、App、小程序环境
- 区分安卓和iOS平台
- 检测云函数调用方式（TCB或微信云开发）
- 提供详细的调试信息

### 2. 更新了云函数调用工具 (`utils/cloudFunction.js`)

**改进点：**
- 使用新的平台检测逻辑
- 支持H5、App、小程序三种环境
- 更准确的云函数调用方式选择
- 详细的调试日志输出

### 3. 环境检测逻辑

```javascript
function getCurrentPlatform() {
    // 1. 检查H5环境
    if (typeof window !== 'undefined' && typeof document !== 'undefined') {
        return 'h5';
    }
    
    // 2. 检查小程序环境（严格检测）
    if (typeof wx !== 'undefined' && wx.getSystemInfoSync && wx.getAccountInfoSync) {
        try {
            const systemInfo = wx.getSystemInfoSync();
            const accountInfo = wx.getAccountInfoSync();
            if (accountInfo.miniProgram && systemInfo.platform) {
                return 'mp-weixin';
            }
        } catch (e) {
            // 不是小程序环境
        }
    }
    
    // 3. 检查App环境（包括安卓原生端）
    if (typeof plus !== 'undefined' || typeof uni !== 'undefined') {
        return 'app';
    }
    
    return 'unknown';
}
```

## 使用方法

### 1. 基本使用

```javascript
// 在页面或组件中
const { callCloudFunction } = require('../../utils/cloudFunction.js');

// 调用云函数
callCloudFunction('getUserInfo', { userId: '123' })
    .then(res => {
        console.log('云函数调用成功:', res);
    })
    .catch(err => {
        console.error('云函数调用失败:', err);
    });
```

### 2. 在Vue组件中使用

```javascript
// 在Vue组件中
const { callCloudFunctionInVue } = require('../../utils/cloudFunction.js');

// 调用云函数
this.callCloudFunctionInVue('getUserInfo', { userId: '123' })
    .then(res => {
        console.log('云函数调用成功:', res);
    })
    .catch(err => {
        console.error('云函数调用失败:', err);
    });
```

### 3. 调试平台信息

```javascript
const { logPlatformInfo } = require('../../utils/platformDetector.js');

// 打印详细的平台信息
logPlatformInfo();
```

## 环境支持

| 平台 | 云函数调用方式 | 状态 |
|------|----------------|------|
| H5 | TCB | ✅ 支持 |
| 安卓原生端 | TCB | ✅ 支持 |
| iOS原生端 | TCB | ✅ 支持 |
| 微信小程序 | 微信云开发 | ✅ 支持 |

## 调试信息

修复后的工具会输出详细的调试信息：

```
🔍 [CloudFunction] 调用云函数: getUserInfo { userId: '123' }
🔍 [CloudFunction] 运行环境: app, 调用方式: tcb
🔍 [PlatformDetector] 平台信息: {
  平台: 'app',
  是否H5: false,
  是否App: true,
  是否小程序: false,
  是否安卓: true,
  是否iOS: false,
  是否微信: false,
  支持云函数: true,
  云函数调用方式: 'tcb'
}
🔍 [CloudFunction] 使用TCB调用云函数: getUserInfo (环境: app)
```

## 注意事项

1. **确保TCB实例正确初始化**：在 `main.js` 中正确配置TCB实例
2. **环境ID配置**：确保使用正确的腾讯云开发环境ID
3. **权限配置**：确保云函数有正确的调用权限
4. **网络环境**：确保设备能够访问腾讯云开发服务

## 测试建议

1. 在H5环境下测试云函数调用
2. 在安卓原生端测试云函数调用
3. 在iOS原生端测试云函数调用
4. 检查控制台输出的调试信息
5. 验证云函数返回的数据格式

## 故障排除

如果仍然出现问题，请检查：

1. **TCB实例是否正确初始化**
2. **环境ID是否正确**
3. **云函数权限配置**
4. **网络连接状态**
5. **控制台错误信息**

通过查看详细的调试日志，可以快速定位问题所在。
