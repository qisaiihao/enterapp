# 小程序 index 页面调试步骤

## 已添加的调试功能

### 1. 顶部红色调试条
在页面最顶部会显示一个红色背景的调试信息条，显示：
- `safeAreaTop`: 安全区域高度
- `postList.length`: 帖子列表长度
- `isLoading`: 是否正在加载
- `homeHasEverLoaded`: 是否曾经加载过数据

### 2. 蓝色测试文本
在页面中间会显示一个蓝色背景的测试文本："测试文本：如果你能看到这个，说明布局基本正常"

### 3. Console 日志
在微信开发者工具的 Console 中会输出详细的日志：

#### onLoad 阶段
```
🚀 [onLoad] 页面开始加载
📏 [debugSafeArea] 开始获取安全区域高度
📏 [debugSafeArea] systemInfo: {...}
📏 [debugSafeArea] statusBarHeight: XX
📏 [debugSafeArea] 设置 safeAreaTop: XX
📏 [debugSafeArea] setData 完成，当前 this.safeAreaTop: XX
🚀 [onLoad] displayMode 设置为 square
🚀 [onLoad] 页面加载完成
```

#### computed 计算阶段
```
🎨 [squareContainerStyle] 开始计算样式
🎨 [squareContainerStyle] safeAreaTop: XX
🎨 [MP-WEIXIN] topBarHeight: XX rpx
🎨 [MP-WEIXIN] tabsHeight: 88 rpx
🎨 [MP-WEIXIN] totalHeight: XX rpx
🎨 [MP-WEIXIN] 返回样式: { paddingTop: 'XXrpx' }
```

#### 数据加载阶段
```
🔍 [getIndexData] 开始加载首页数据
🔍 [getIndexData] 初始状态设置完成
🔍 [getIndexData] 云函数返回数据: X 条
🔍 [getIndexData] 开始处理帖子数据...
🔍 [getIndexData] 帖子数据处理完成: X 条
🔍 [getIndexData] setData 完成，当前状态: {...}
```

## 调试步骤

### 步骤 1：重新编译
1. 在 HBuilderX 中点击：运行 -> 运行到小程序模拟器 -> 微信开发者工具
2. 等待编译完成

### 步骤 2：查看页面显示
打开微信开发者工具，观察页面：

#### 情况 A：能看到红色调试条和蓝色测试文本
说明页面基本渲染正常，问题可能在于：
- page-tabs 组件没有显示
- 内容区域被遮挡或定位错误

**解决方案：**
1. 查看 Console 日志，确认 `safeAreaTop` 的值
2. 查看 `squareContainerStyle` 计算的 `paddingTop` 值
3. 检查是否合理（通常应该在 200-300rpx 之间）

#### 情况 B：完全空白，什么都看不到
说明页面渲染出现严重问题，可能原因：
- 条件编译没有生效
- 样式问题导致所有内容不可见
- JavaScript 错误导致页面崩溃

**解决方案：**
1. 查看 Console 是否有错误信息
2. 检查 Network 面板，确认资源是否加载成功
3. 查看 Wxml 面板，确认 DOM 结构是否正确

#### 情况 C：能看到调试信息，但看不到 page-tabs
说明 page-tabs 组件有问题，可能原因：
- 组件没有正确注册
- 组件内部样式问题
- z-index 层级问题

**解决方案：**
1. 检查 page-tabs 组件是否正确导入
2. 查看 top-bar 组件的 z-index（应该是 1000）
3. 查看 tabs-container 的 z-index（应该是 1050）

### 步骤 3：在 Console 中运行诊断脚本

复制以下代码到 Console 中执行：

```javascript
const pages = getCurrentPages();
const currentPage = pages[pages.length - 1];
console.log('========== 完整诊断信息 ==========');
console.log('1. 基本状态:');
console.log('   - safeAreaTop:', currentPage.data.safeAreaTop);
console.log('   - postList.length:', currentPage.data.postList?.length || 0);
console.log('   - isLoading:', currentPage.data.isLoading);
console.log('   - homeHasEverLoaded:', currentPage.data.homeHasEverLoaded);

console.log('\n2. computed 属性:');
console.log('   - squareContainerStyle:', currentPage.squareContainerStyle);
console.log('   - homeFeedPosts.length:', currentPage.homeFeedPosts?.length || 0);
console.log('   - homeFeedHasEverLoaded:', currentPage.homeFeedHasEverLoaded);

console.log('\n3. 组件引用:');
console.log('   - $refs.pageTabs:', currentPage.$refs.pageTabs);
console.log('   - $refs.customTabBar:', currentPage.$refs.customTabBar);

console.log('\n4. 样式计算:');
const safeAreaTop = currentPage.data.safeAreaTop;
const topBarHeight = (safeAreaTop * 2) + 100;
const tabsHeight = 88;
const totalHeight = topBarHeight + tabsHeight;
console.log('   - 计算的 paddingTop:', totalHeight + 'rpx');

console.log('================================');
```

### 步骤 4：手动触发数据加载

如果数据没有加载，在 Console 中执行：

```javascript
const pages = getCurrentPages();
const currentPage = pages[pages.length - 1];
currentPage.getIndexData();
```

### 步骤 5：检查 DOM 结构

在微信开发者工具的 Wxml 面板中，检查：
1. `.page-wrapper` 是否存在
2. `.container` 是否存在
3. `page-tabs` 组件是否渲染
4. `.square-mode-container` 是否存在
5. `swiper` 和 `feed-list` 是否存在

## 常见问题排查

### 问题 1：safeAreaTop 为 0
**症状：** 调试条显示 `safeAreaTop=0px`

**原因：** `uni.getSystemInfoSync()` 没有返回 `statusBarHeight`

**解决方案：**
```javascript
// 在 Console 中执行
const systemInfo = uni.getSystemInfoSync();
console.log('systemInfo:', systemInfo);
console.log('statusBarHeight:', systemInfo.statusBarHeight);

// 如果 statusBarHeight 存在但没有设置，手动设置
const pages = getCurrentPages();
const currentPage = pages[pages.length - 1];
currentPage.setData({ safeAreaTop: systemInfo.statusBarHeight });
```

### 问题 2：postList 有数据但不显示
**症状：** 调试条显示 `postList=10`，但页面空白

**原因：** FeedList 组件的条件渲染逻辑问题

**解决方案：**
```javascript
// 在 Console 中检查
const pages = getCurrentPages();
const currentPage = pages[pages.length - 1];
console.log('homeFeedPosts:', currentPage.homeFeedPosts);
console.log('homeFeedHasEverLoaded:', currentPage.homeFeedHasEverLoaded);
console.log('homeFeedIsLoading:', currentPage.homeFeedIsLoading);
```

### 问题 3：条件编译没有生效
**症状：** 看不到红色调试条和蓝色测试文本

**原因：** 条件编译可能没有正确处理

**解决方案：**
1. 检查 `manifest.json` 中的 `mp-weixin` 配置
2. 清除缓存重新编译
3. 检查编译后的代码（`unpackage/dist/build/mp-weixin/pages/index/index.wxml`）

## 预期结果

正常情况下，你应该看到：
1. 顶部红色调试条，显示正确的数据
2. 蓝色测试文本
3. page-tabs 组件（广场、关注、讨论标签）
4. 帖子列表或骨架屏/空状态

## 下一步

根据调试结果，将 Console 的完整日志和页面截图发送给我，我会根据具体情况提供进一步的解决方案。
