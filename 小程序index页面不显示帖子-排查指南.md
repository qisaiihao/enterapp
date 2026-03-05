# 小程序 index 页面不显示帖子 - 排查指南

## 问题描述
小程序端 index 页面云函数能正常返回数据，但前端不显示帖子。

## 排查步骤

### 1. 在小程序开发者工具 Console 中运行调试脚本

复制以下代码到 Console 中执行：

```javascript
const pages = getCurrentPages();
const currentPage = pages[pages.length - 1];
console.log('========== Index 页面数据调试 ==========');
console.log('postList:', currentPage.data.postList);
console.log('postList.length:', currentPage.data.postList?.length || 0);
console.log('isLoading:', currentPage.data.isLoading);
console.log('homeHasEverLoaded:', currentPage.data.homeHasEverLoaded);
console.log('homeFeedPosts:', currentPage.data.homeFeedPosts);
console.log('homeFeedHasEverLoaded:', currentPage.data.homeFeedHasEverLoaded);
console.log('========================================');
```

### 2. 检查关键状态

根据输出结果，检查以下几点：

#### 情况 A：postList 有数据但不显示
```
postList.length: 10
isLoading: false
homeHasEverLoaded: true
```

**可能原因：**
- FeedList 组件的条件渲染逻辑问题
- computed 属性 `homeFeedPosts` 没有正确返回数据

**解决方案：**
检查 `homeFeedPosts` computed 属性：
```javascript
homeFeedPosts() {
    return this.useRecommendFeed ? this.discoverPostList : this.postList;
}
```
确认 `useRecommendFeed` 为 false，这样才会返回 `postList`。

#### 情况 B：postList 为空
```
postList.length: 0
isLoading: false
homeHasEverLoaded: true
```

**可能原因：**
- 云函数返回数据但 setData 失败
- 数据处理过程中出错

**解决方案：**
1. 查看 Console 中的错误信息
2. 检查 `processPostList` 函数是否正常执行
3. 确认 `setData` 调用成功

#### 情况 C：一直显示加载状态
```
postList.length: 0
isLoading: true
homeHasEverLoaded: false
```

**可能原因：**
- 云函数调用失败
- Promise 没有 resolve 或 reject
- wx.cloud 未正确初始化

**解决方案：**
1. 检查 wx.cloud 初始化状态：
```javascript
console.log('wx.cloud 是否可用:', typeof wx !== 'undefined' && wx.cloud);
console.log('wx.cloud._isInitialized:', wx.cloud?._isInitialized);
```

2. 手动初始化 wx.cloud：
```javascript
wx.cloud.init({
    env: 'cloud1-5gb0pbyl400845f5',
    traceUser: true
});
```

### 3. 手动触发数据加载

如果页面卡住，可以在 Console 中手动触发：

```javascript
const pages = getCurrentPages();
const currentPage = pages[pages.length - 1];
currentPage.getIndexData();
```

### 4. 检查 FeedList 组件渲染条件

FeedList 组件的渲染逻辑：
```vue
<!-- 骨架屏 -->
<view v-if="(isLoading && posts.length === 0) || (posts.length === 0 && !hasEverLoaded)">
    <skeleton pageType="index" />
</view>

<!-- 空状态 -->
<view v-else-if="posts.length === 0 && hasEverLoaded && !isLoading" class="empty-state">
    ...
</view>

<!-- 帖子列表 -->
<view v-else :id="containerId">
    <post-item v-for="(item, index) in posts" :key="index" .../>
</view>
```

确保传递给 FeedList 的 props 正确：
- `posts`: 应该是 `homeFeedPosts`（computed 属性）
- `has-ever-loaded`: 应该是 `homeFeedHasEverLoaded`（computed 属性）
- `is-loading`: 应该是 `homeFeedIsLoading`（computed 属性）

### 5. 常见问题修复

#### 问题 1：useRecommendFeed 状态错误
```javascript
// 在 Console 中检查
const pages = getCurrentPages();
const currentPage = pages[pages.length - 1];
console.log('useRecommendFeed:', currentPage.data.useRecommendFeed);

// 如果为 true，手动设置为 false
currentPage.setData({ useRecommendFeed: false });
```

#### 问题 2：数据处理失败
查看 Console 中是否有以下错误：
- `processPostList` 相关错误
- `hydrateTempUrls` 相关错误
- `normalizePostList` 相关错误

#### 问题 3：小程序缓存问题
清除小程序缓存并重新编译：
1. 点击开发者工具的"清缓存" -> "清除数据缓存"
2. 点击"编译" -> "重新编译"

## 已添加的调试日志

代码中已添加详细的调试日志，查看 Console 输出：

### getIndexData 方法
```
🔍 [getIndexData] 开始加载首页数据
🔍 [getIndexData] 初始状态设置完成
🔍 [getIndexData] 云函数返回数据: X 条
🔍 [getIndexData] 开始处理帖子数据...
🔍 [getIndexData] 帖子数据处理完成: X 条
🔍 [getIndexData] setData 完成，当前状态:
   - postList.length: X
   - isLoading: false
   - homeHasEverLoaded: true
   - homeFeedPosts.length: X
   - homeFeedHasEverLoaded: true
```

### getPostList 方法
```
🔍 [首页] getPostList 开始调用
🔍 [首页] 当前状态: {...}
🔍 [首页] 请求参数: {...}
✅ [首页] 获取到帖子数量（缓存封装）: X
✅ [首页] 原始数据示例: {...}
✅ [首页] 处理后帖子数量: X
✅ [首页] 处理后数据示例: {...}
✅ [首页] 更新数据（缓存封装）: {...}
✅ [首页] setData 后验证:
   - this.postList.length: X
   - this.homeFeedPosts.length: X
   - this.isLoading: false
   - this.homeHasEverLoaded: true
```

## 下一步操作

1. 重新编译小程序
2. 打开小程序开发者工具的 Console
3. 观察上述调试日志输出
4. 根据日志信息定位问题
5. 如果仍然无法解决，将完整的 Console 日志截图发送给我

## 紧急修复方案

如果以上方法都无效，可以尝试以下紧急修复：

### 方案 1：强制刷新数据
在 `onShow` 生命周期中添加：
```javascript
onShow() {
    // 强制刷新数据
    if (this.homeHasEverLoaded && this.postList.length === 0) {
        console.log('检测到数据异常，强制刷新');
        this.getIndexData();
    }
}
```

### 方案 2：简化数据流
临时移除 computed 属性，直接使用 postList：
```vue
<feed-list
    :posts="postList"
    :is-loading="isLoading"
    :has-ever-loaded="homeHasEverLoaded"
    ...
/>
```

### 方案 3：检查小程序基础库版本
确保小程序基础库版本 >= 2.10.0，在 `project.config.json` 中设置：
```json
{
  "miniprogramRoot": "unpackage/dist/build/mp-weixin/",
  "setting": {
    "libVersion": "2.33.0"
  }
}
```
