# TabBar 兼容性处理说明

## 问题描述
在某些平台（如H5、App等）中，`getTabBar()` API 不被支持，会出现 "当前平台不支持getTabBar()" 的错误提示。

## 解决方案
我们创建了一个通用的兼容性处理工具 `utils/tabBarCompatibility.js`，提供了多种备选方案来更新TabBar状态。

## 使用方法

### 1. 基本使用
```javascript
// 在页面的 onShow 方法中
const { updateTabBarStatus } = require('../../utils/tabBarCompatibility.js');
updateTabBarStatus(this, 0); // 0 表示选中第一个tab
```

### 2. 检查支持状态
```javascript
const { isTabBarSupported } = require('../../utils/tabBarCompatibility.js');
if (isTabBarSupported()) {
    console.log('当前平台支持getTabBar');
} else {
    console.log('当前平台不支持getTabBar，将使用备选方案');
}
```

### 3. 获取当前TabBar状态
```javascript
const { getCurrentTabBarStatus } = require('../../utils/tabBarCompatibility.js');
const currentTab = getCurrentTabBarStatus(this);
console.log('当前选中的tab:', currentTab);
```

## 兼容性策略

工具会按以下顺序尝试更新TabBar状态：

1. **原生getTabBar API** - 优先使用平台原生API
2. **自定义tabBar组件** - 使用 `$refs.customTabBar`
3. **事件通信** - 使用 `uni.$emit` 发送事件
4. **存储机制** - 使用 `uni.setStorageSync` 保存状态

## 已修复的页面

- ✅ `pages/index/index.vue` - 首页 (selected: 0)
- ✅ `pages/poem/poem.vue` - 诗歌页 (selected: 1)  
- ✅ `pages/mountain/mountain.vue` - 山峰页 (selected: 2)
- ✅ `pages/profile/profile.vue` - 个人页 (selected: 3)

## 注意事项

1. 确保自定义tabBar组件有 `setData` 方法
2. 如果使用事件通信，需要在tabBar组件中监听 `updateTabBar` 事件
3. 存储机制作为最后的备选方案，不会影响用户体验

## 错误处理

所有方法都包含完整的错误处理，不会因为某个方法失败而影响页面正常功能。失败时会输出相应的日志信息，便于调试。
