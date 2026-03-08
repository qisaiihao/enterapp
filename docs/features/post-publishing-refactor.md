# 发帖功能重构文档

## 概述

将发帖功能从 `contentCheck` 云函数中分离,实现审核与创建的职责分离,并支持平台差异化处理。

**重构时间**: 2026-03-07  
**重构原因**: 
1. 原 `contentCheck` 云函数职责不清(审核+创建)
2. 需要支持小程序内容审核
3. APP/H5 不需要审核,直接发布

---

## 架构变更

### 重构前
```
预览页面 → contentCheck 云函数 → 创建帖子
```
- 所有平台都调用 `contentCheck`
- 审核服务已禁用,实际直接创建帖子

### 重构后
```
小程序(新版): 预览页面 → contentCheck(审核) → createPost(创建)
APP/H5(新版): 预览页面 → createPost(创建)
旧版(兼容):   预览页面 → contentCheck(直接创建)
```

---

## 云函数说明

### 1. createPost 云函数

**位置**: `functions/createPost/index.js`

**功能**: 创建新帖子

**参数**:
```javascript
{
  title: string,           // 标题
  content: string,         // 内容
  fileIDs: array,          // 压缩图片URL
  originalFileIDs: array,  // 原图URL
  publishMode: string,     // 发布模式: 'normal' | 'poem' | 'discussion'
  isOriginal: boolean,     // 是否原创
  isDiscussion: boolean,   // 是否讨论
  isSeries: boolean,       // 是否组诗
  seriesBlocks: array,     // 组诗段落
  author: string,          // 作者
  tags: array,             // 标签
  backgroundColor: string, // 背景色
  textColor: string,       // 文字颜色
  highlightLines: array,   // 高光行
  sentenceGroups: array,   // 讨论句子组
  discussionSentences: array, // 讨论句子
  isAnonymous: boolean,    // 是否匿名
  anonymousAuthorName: string, // 匿名作者名
  realAuthorOpenid: string, // 真实作者openid
  openid: string           // 用户openid(可选,匿名时使用固定值)
}
```

**返回**:
```javascript
{
  code: 0,              // 0=成功, -1=失败
  msg: string,          // 消息
  postId: string        // 帖子ID(成功时)
}
```

---

### 2. contentCheck 云函数

**位置**: `functions/contentcheck/index.js`

**功能**: 内容审核(支持三种模式)

#### 模式 1: 新版审核(仅审核)

**调用条件**: 有 `type` 参数

**参数**:
```javascript
{
  type: 'text' | 'image' | 'batch', // 审核类型
  content: string,      // 文本内容
  imageUrl: string,     // 单张图片URL(type=image)
  images: array,        // 多张图片URL(type=batch)
  scene: number,        // 场景值: 1=资料, 2=评论, 3=论坛, 4=社交日志
  title: string,        // 标题(可选)
  nickname: string      // 昵称(可选)
}
```

**返回**:
```javascript
{
  success: boolean,     // 是否成功
  passed: boolean,      // 是否通过审核
  message: string,      // 消息
  errorCode: string     // 错误码(可选)
}
```

#### 模式 2: 旧版兼容(跳过审核,直接创建)

**调用条件**: 没有 `type` 参数,但有 `publishMode` 或 `fileIDs`

**参数**: 与 `createPost` 相同

**返回**:
```javascript
{
  code: 0,              // 0=成功, -1=失败
  msg: string,          // 消息
  postId: string,       // 帖子ID(成功时)
  success: boolean,     // 是否成功
  passed: boolean       // 审核是否通过(始终为true)
}
```

**说明**: 
- 旧版 APP 的审核服务已禁用
- 直接创建帖子,不进行审核
- 完全兼容旧版行为

---

## 前端调用

### 预览页面 (pages/preview/preview.vue)

#### 小程序环境
```javascript
// #ifdef MP-WEIXIN
const needAudit = true;
// #endif

// 先审核
cloudCall('contentCheck', {
  type: 'batch',
  content: '...',
  images: [...],
  scene: 3
})
.then((auditRes) => {
  if (!auditRes.result.passed) {
    throw new Error('内容审核未通过');
  }
  
  // 审核通过后创建
  return cloudCall('createPost', { ... });
})
```

#### APP/H5 环境
```javascript
// #ifndef MP-WEIXIN
const needAudit = false;
// #endif

// 直接创建,不审核
cloudCall('createPost', { ... })
```

---

## 平台行为对比

| 平台 | 版本 | 是否审核 | 调用流程 | 说明 |
|------|------|---------|---------|------|
| 小程序 | 新版 | ✅ 是 | contentCheck → createPost | 符合微信规范 |
| 小程序 | 旧版 | ❌ 否 | contentCheck(直接创建) | 兼容旧版 |
| APP | 新版 | ❌ 否 | createPost | 直接发布 |
| APP | 旧版 | ❌ 否 | contentCheck(直接创建) | 兼容旧版 |
| H5 | 新版 | ❌ 否 | createPost | 直接发布 |
| H5 | 旧版 | ❌ 否 | contentCheck(直接创建) | 兼容旧版 |

---

## 版本检测逻辑

### contentCheck 云函数
```javascript
// 检测是否为旧版调用
const isLegacyMode = !event.type && (event.publishMode || event.fileIDs);

if (isLegacyMode) {
  // 旧版模式: 跳过审核,直接创建帖子
  return await handleLegacyMode(event, openid);
}

// 新版模式: 仅审核
// ...
```

### 预览页面
```javascript
// 使用条件编译区分平台
// #ifdef MP-WEIXIN
const needAudit = true;
// #endif

// #ifndef MP-WEIXIN
const needAudit = false;
// #endif
```

---

## 部署步骤

### 1. 安装依赖并部署云函数

#### createPost 云函数
```bash
cd functions/createPost
npm install
# 在腾讯云控制台部署，或使用命令行工具
```

#### contentCheck 云函数
```bash
cd functions/contentCheck
npm install
# 在腾讯云控制台部署，或使用命令行工具
```

**重要**: 必须先安装依赖再部署，否则会报 `Cannot find module 'wx-server-sdk'` 错误。

### 2. 配置环境变量

在腾讯云控制台为 `contentCheck` 云函数配置环境变量:
- `WECHAT_APPID`: 微信小程序 AppID
- `WECHAT_SECRET`: 微信小程序 Secret

### 2. 配置环境变量

在腾讯云控制台为 `contentCheck` 云函数配置环境变量:
- `WECHAT_APPID`: 微信小程序 AppID
- `WECHAT_SECRET`: 微信小程序 Secret

### 3. 测试旧版兼容性
- 使用旧版 APP 测试发帖功能
- 确认能正常创建帖子
- 确认返回格式正确

### 4. 发布新版前端
- 编译小程序版本
- 编译 APP 版本
- 编译 H5 版本

### 5. 验证功能
- 小程序: 测试审核流程
- APP: 测试直接发布
- H5: 测试直接发布

---

## 优势

✅ **职责分离** - 审核和创建逻辑分离,代码更清晰  
✅ **平台差异化** - 小程序审核,APP/H5 直接发布  
✅ **向后兼容** - 旧版 APP 继续正常工作  
✅ **平滑升级** - 可以逐步迁移用户  
✅ **易于维护** - 三种模式分离,便于调试和扩展  

---

## 注意事项

### 1. 环境变量配置
contentCheck 云函数需要配置:
- `WECHAT_APPID`: 微信小程序 AppID
- `WECHAT_SECRET`: 微信小程序 Secret

### 2. 审核场景值
- 1: 资料(个人资料、签名等)
- 2: 评论
- 3: 论坛(发帖)
- 4: 社交日志

### 3. 匿名发帖
- 匿名帖子使用固定 openid: `123456`
- 真实作者 openid 保存在 `realAuthorOpenid` 字段

### 4. 旧版兼容
- 旧版 APP 不会进行审核
- 直接创建帖子,和之前行为一致
- 无需强制用户更新

---

## 相关文件

### 云函数
- `functions/createPost/index.js` - 创建帖子云函数
- `functions/contentcheck/index.js` - 内容审核云函数

### 前端
- `pages/preview/preview.vue` - 预览页面(发布逻辑)
- `pages/add/add.vue` - 编辑页面

### 文档
- `functions/contentCheck/README_重新启用内容审核.md` - 审核服务说明
- `docs/post-publishing-refactor.md` - 本文档

---

## 故障排查

### 问题 1: Cannot find module 'wx-server-sdk'
**错误信息**: 
```
Error: Cannot find module 'wx-server-sdk'
errCode: -504002 functions execute fail
```

**原因**: 云函数依赖未安装

**解决**: 
1. 进入云函数目录: `cd functions/createPost`
2. 安装依赖: `npm install`
3. 重新部署云函数

### 问题 2: 旧版 APP 发帖失败
**原因**: contentCheck 云函数未正确识别旧版模式  
**解决**: 检查是否有 `publishMode` 或 `fileIDs` 参数

### 问题 3: 小程序审核失败
**原因**: 环境变量未配置或审核服务未开通  
**解决**: 
1. 检查 `WECHAT_APPID` 和 `WECHAT_SECRET`
2. 确认微信内容安全服务已开通

### 问题 4: APP 发帖被审核
**原因**: 条件编译未生效  
**解决**: 检查 `#ifdef MP-WEIXIN` 条件编译是否正确

---

## 更新日志

### 2026-03-07
- 创建 `createPost` 云函数
- 重构 `contentCheck` 云函数,支持三种模式
- 修改预览页面,支持平台差异化
- 添加旧版兼容逻辑
- 完成文档编写
