# 小程序TabBar测试指南

## 快速测试步骤

### 1. 编译小程序

```bash
# 在HBuilderX中：发行 -> 小程序-微信
# 或使用命令行
npm run build:mp-weixin
```

### 2. 验证编译输出

检查 `unpackage/dist/build/mp-weixin/custom-tab-bar/` 目录：

```
custom-tab-bar/
├── index.js      ✓ 应该存在
├── index.wxml    ✓ 应该存在
├── index.wxss    ✓ 应该存在
├── index.json    ✓ 应该存在
└── index.vue     ✓ 可以存在（不影响小程序）
```

### 3. 在微信开发者工具中打开

1. 打开微信开发者工具
2. 导入项目：选择 `unpackage/dist/build/mp-weixin` 目录
3. 填写AppID（使用测试号也可以）

### 4. 功能测试清单

#### 基础显示测试
- [ ] tabBar在页面底部正常显示
- [ ] 4个tab按钮都可见
- [ ] 图标正常显示
- [ ] 文字正常显示（广场、原创、读诗、我）

#### 样式测试
- [ ] 按钮是圆角矩形（24rpx圆角）
- [ ] 按钮有外阴影效果
- [ ] 背景色为白色
- [ ] 未选中文字为灰色（#999999）
- [ ] 选中文字为黑色（#000000）

#### 交互测试
- [ ] 点击tab可以切换页面
- [ ] 切换时有轻微震动反馈
- [ ] 当前页面的tab显示为选中状态（内阴影、轻微下沉）
- [ ] 点击其他tab时，选中状态正确切换

#### 高级功能测试
- [ ] 双击当前选中的tab，页面会刷新
- [ ] 双击间隔超过300ms不会触发刷新
- [ ] 双击其他tab不会触发刷新，而是正常切换

#### 页面切换测试
测试每个tab页面：

1. **广场页（index）**
   - [ ] 点击第1个tab进入
   - [ ] 第1个tab显示选中状态
   - [ ] 双击刷新，帖子列表重新加载

2. **原创页（poem-square）**
   - [ ] 点击第2个tab进入
   - [ ] 第2个tab显示选中状态
   - [ ] 双击刷新，诗歌列表重新加载

3. **读诗页（mountain）**
   - [ ] 点击第3个tab进入
   - [ ] 第3个tab显示选中状态
   - [ ] 双击刷新，内容重新加载

4. **我的页（profile）**
   - [ ] 点击第4个tab进入
   - [ ] 第4个tab显示选中状态
   - [ ] 双击刷新，个人信息重新加载

#### 响应式测试
在不同设备上测试：

- [ ] iPhone 6/7/8（375px）- 间距30rpx
- [ ] iPhone 6/7/8 Plus（414px）- 间距35rpx
- [ ] iPhone X/11/12（375px）- 间距30rpx
- [ ] iPhone 12 Pro Max（428px）- 间距40rpx
- [ ] 小屏设备（320px）- 间距15rpx

### 5. 常见问题检查

#### 问题：tabBar不显示
```bash
# 检查编译输出
ls -la unpackage/dist/build/mp-weixin/custom-tab-bar/

# 应该看到4个文件：index.js, index.wxml, index.wxss, index.json
```

#### 问题：选中状态不对
打开微信开发者工具的调试器，在Console中输入：
```javascript
// 检查当前页面的tabBar实例
const tabBar = this.getTabBar();
console.log('tabBar实例:', tabBar);
console.log('当前selected:', tabBar.data.selected);
```

#### 问题：图标不显示
检查图标文件是否存在：
```bash
ls -la unpackage/dist/build/mp-weixin/static/images/market*.png
ls -la unpackage/dist/build/mp-weixin/static/images/road*.png
ls -la unpackage/dist/build/mp-weixin/static/images/mountain*.png
ls -la unpackage/dist/build/mp-weixin/static/images/pools*.png
```

#### 问题：双击刷新不工作
在 `custom-tab-bar/index.js` 的 `switchTab` 方法中添加日志：
```javascript
switchTab(e) {
  console.log('点击tab:', e.currentTarget.dataset.index);
  console.log('当前时间:', Date.now());
  console.log('上次时间:', this.data.lastTapTime);
  console.log('时间差:', Date.now() - this.data.lastTapTime);
  // ...
}
```

### 6. 性能测试

- [ ] 切换tab时无明显卡顿
- [ ] 双击刷新响应及时
- [ ] 震动反馈不会延迟
- [ ] 动画过渡流畅

### 7. 兼容性测试

- [ ] 基础库 2.2.3+
- [ ] iOS系统
- [ ] Android系统
- [ ] 开发者工具

## 调试技巧

### 1. 查看tabBar数据
在任意tab页面的onShow中添加：
```javascript
onShow() {
  // #ifdef MP-WEIXIN
  const tabBar = this.getTabBar();
  console.log('TabBar数据:', tabBar.data);
  // #endif
}
```

### 2. 测试双击刷新
在 `custom-tab-bar/index.js` 中添加更多日志：
```javascript
refreshCurrentPage() {
  console.log('触发双击刷新');
  console.log('当前页面:', this.data.list[this.data.selected].pagePath);
  // ...
}
```

### 3. 检查页面实例
```javascript
const pages = getCurrentPages();
const currentPage = pages[pages.length - 1];
console.log('当前页面路由:', currentPage.route);
console.log('页面方法:', Object.keys(currentPage));
```

## 预期效果截图位置

建议截图保存以下状态：
1. 默认状态（第1个tab选中）
2. 第2个tab选中
3. 第3个tab选中
4. 第4个tab选中
5. 按压状态（阴影变化）

## 提交前检查

- [ ] 所有测试项通过
- [ ] 无console错误
- [ ] 无console警告
- [ ] 性能良好
- [ ] 在真机上测试通过

## 回滚方案

如果出现问题，可以快速回滚到使用原生tabBar：

1. 修改 `pages.json`：
```json
{
  "tabBar": {
    // #ifndef MP-WEIXIN
    "custom": true,
    // #endif
    // ...
  }
}
```

2. 重新编译即可使用微信原生tabBar
