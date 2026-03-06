# 小程序 index 页面布局修复

## 问题描述
小程序端 index 页面完全空白，连顶部的标签页（广场、关注、讨论）都不显示。

## 根本原因
模板中使用了 `totalHeaderHeight` 变量来设置 `paddingTop`，但该变量：
1. 没有在 `data` 中定义
2. 没有在 `computed` 中计算
3. 导致 `paddingTop: undefinedpx`，使整个布局错乱

## 修复内容

### 1. 移除未定义的变量
- 移除 `data` 中的 `totalHeaderHeight: 0`（这是临时添加的，不是正确的解决方案）
- 移除模板中的 `@tabs-ready="onTabsReady"` 事件（该方法不存在）

### 2. 添加 computed 属性计算样式
```javascript
computed: {
    // ... 其他 computed 属性
    
    // 计算 square-mode-container 的样式
    squareContainerStyle() {
        // #ifdef MP-WEIXIN
        // 小程序端：top-bar(状态栏高度 + 100rpx) + tabs(88rpx)
        const topBarHeight = (this.safeAreaTop * 2) + 100;
        const tabsHeight = 88;
        const totalHeight = topBarHeight + tabsHeight;
        return { paddingTop: totalHeight + 'rpx' };
        // #endif
        
        // #ifndef MP-WEIXIN
        // APP 和 H5 端：使用原来的固定值（已在 .container 中设置）
        return {};
        // #endif
    }
}
```

### 3. 更新模板绑定
```vue
<!-- 修改前 -->
<view class="square-mode-container" :style="{ paddingTop: totalHeaderHeight + 'px' }">

<!-- 修改后 -->
<view class="square-mode-container" :style="squareContainerStyle">
```

### 4. 添加小程序端的 container 样式
```css
.container {
    /* #ifdef APP-PLUS */
    padding-top: 276rpx;
    /* #endif */
    /* #ifdef H5 */
    padding-top: 200rpx;
    /* #endif */
    /* #ifdef MP-WEIXIN */
    padding-top: 0;  /* 小程序端不使用固定 padding */
    /* #endif */
    padding-bottom: 100rpx;
    /* ... */
}
```

## 布局说明

### APP-PLUS 和 H5 端
- `.container` 有固定的 `padding-top`（APP: 276rpx, H5: 200rpx）
- `.square-mode-container` 不需要额外的 `padding-top`

### MP-WEIXIN 端
- `.container` 的 `padding-top: 0`
- `.square-mode-container` 动态计算 `padding-top`：
  - top-bar 高度 = 状态栏高度 + 100rpx
  - tabs 高度 = 88rpx
  - 总高度 = top-bar + tabs

## 为什么使用 rpx 单位

小程序端使用 `rpx` 单位而不是 `px`：
- `rpx` 是响应式单位，会根据屏幕宽度自动缩放
- `safeAreaTop` 是 `px` 单位，需要乘以 2 转换为 `rpx`（iPhone 6 基准：1px = 2rpx）
- 确保在不同屏幕尺寸的设备上都能正确显示

## 测试步骤

1. 在 HBuilderX 中重新编译小程序
2. 在微信开发者工具中查看效果
3. 检查以下内容是否正常显示：
   - 顶部 top-bar（写诗、搜索、消息图标）
   - 标签页（广场、关注、讨论）
   - 帖子列表内容
4. 测试不同设备尺寸的适配效果

## 相关文件
- `pages/index/index.vue` - 主要修复文件
- `components/page-tabs/page-tabs.vue` - 标签页组件
- `components/top-bar/top-bar.vue` - 顶部栏组件

## 注意事项
- 确保 `safeAreaTop` 在 `debugSafeArea()` 方法中正确获取
- 小程序端的布局计算依赖 `safeAreaTop` 值
- 如果仍有问题，检查 Console 中 `safeAreaTop` 的值是否正确
