# 内容审核集成说明

## 任务19 - 发布帖子流程集成 ✅

### 实现位置
- **文件**: `pages/preview/preview.vue`
- **方法**: `executePublish()`, `moderateContent()`

### 实现内容

1. **导入审核工具**
   ```javascript
   import { checkContentSafe, checkTextSafe, checkImageSafe } from '@/utils/contentModeration.js';
   ```

2. **修改发布流程**
   - 在 `executePublish()` 方法开头添加内容审核
   - 审核未通过时显示友好提示并阻止发布
   - 审核通过后继续原有发布流程

3. **新增审核方法 `moderateContent()`**
   - 支持所有发布模式：普通、诗歌、讨论、组诗
   - 自动提取文本内容（包括标题、正文、引用等）
   - 自动提取图片URL
   - 使用 `checkContentSafe()` 批量审核
   - 显示"审核中..."加载提示
   - 仅在小程序端执行审核（H5/App端自动跳过）

### 审核场景
- **场景值**: 3（论坛）
- **审核内容**: 
  - 标题
  - 正文内容（根据模式不同自动合并）
  - 所有图片

---

## 任务20 - 评论发布流程集成 ✅

### 实现位置
- **文件**: `pages/post-detail/post-detail.vue`
- **方法**: `onSubmitComment()`, `moderateCommentContent()`

### 实现内容

1. **导入审核工具**
   ```javascript
   import { checkContentSafe, checkTextSafe } from '@/utils/contentModeration.js';
   ```

2. **修改评论提交流程**
   - 在 `onSubmitComment()` 方法中添加内容审核
   - 审核未通过时显示提示并阻止提交
   - 审核通过后继续原有提交流程

3. **新增审核方法 `moderateCommentContent()`**
   - 审核评论文本和图片
   - 使用 `checkContentSafe()` 批量审核
   - 显示"审核中..."加载提示
   - 仅在小程序端执行审核

### 审核场景
- **场景值**: 2（评论）
- **审核内容**: 
  - 评论文本
  - 评论图片

---

## 任务21 & 22 - 个人资料编辑集成 ✅

### 实现位置
- **文件**: `pages-user/profile-edit/profile-edit.vue`
- **方法**: `onSaveChanges()`, `moderateProfileContent()`

### 实现内容

1. **导入审核工具**
   ```javascript
   const { checkContentSafe, checkImageSafe, checkTextSafe } = require('../../utils/contentModeration.js');
   ```

2. **修改保存流程**
   - 在 `onSaveChanges()` 方法开头添加内容审核
   - 审核未通过时显示提示并阻止保存
   - 审核通过后继续原有保存流程

3. **新增审核方法 `moderateProfileContent()`**
   - 审核昵称、poemId、个性描述
   - 审核头像和签名图片
   - 使用 `checkContentSafe()` 批量审核
   - 显示"审核中..."加载提示
   - 仅在小程序端执行审核

### 审核场景
- **场景值**: 1（资料）
- **审核内容**: 
  - 昵称
  - POEM ID
  - 个性描述
  - 头像图片
  - 签名图片

---

## 任务23 - 诗人资料上传集成 ✅

### 实现位置
- **文件**: `pages-user/poet-profile/poet-profile.vue`
- **方法**: `chooseAndUploadAvatar()`, `saveBio()`, `moderatePoetAvatar()`, `moderatePoetBio()`

### 实现内容

1. **导入审核工具**
   ```javascript
   const { checkImageSafe, checkTextSafe } = require('../../utils/contentModeration.js');
   ```

2. **修改头像上传流程**
   - 在 `chooseAndUploadAvatar()` 方法中添加图片审核
   - 审核未通过时显示提示并阻止上传

3. **修改简介保存流程**
   - 在 `saveBio()` 方法中添加文本审核
   - 审核未通过时显示提示并阻止保存

4. **新增审核方法**
   - `moderatePoetAvatar()` - 审核诗人头像
   - `moderatePoetBio()` - 审核诗人简介
   - 使用 `checkImageSafe()` 和 `checkTextSafe()` 审核
   - 显示"审核中..."加载提示
   - 仅在小程序端执行审核

### 审核场景
- **场景值**: 1（资料）
- **审核内容**: 
  - 诗人头像
  - 诗人简介

---

## 错误处理
- 审核失败时返回通过（避免阻塞功能）
- 显示友好的错误提示

---

## 测试要点

### 小程序端测试
1. **发布帖子**
   - 发布正常内容 → 应该通过审核并成功发布
   - 发布敏感内容 → 应该显示"内容审核未通过"提示
   - 测试所有模式（普通、诗歌、讨论、组诗）

2. **发布评论**
   - 发布正常评论 → 应该通过审核
   - 发布敏感评论 → 应该被拦截

3. **编辑个人资料**
   - 保存正常资料 → 应该通过审核
   - 保存敏感内容 → 应该被拦截
   - 上传正常头像 → 应该通过审核
   - 上传敏感图片 → 应该被拦截

4. **编辑诗人资料**
   - 上传正常头像 → 应该通过审核
   - 上传敏感图片 → 应该被拦截
   - 保存正常简介 → 应该通过审核
   - 保存敏感简介 → 应该被拦截

### H5/App端测试
- 所有操作应该跳过审核，直接成功

---

## 日志输出示例
```
🔍 [Preview] 开始内容审核
🔍 [Preview] 审核内容: { textLength: xxx, imageCount: xxx, publishMode: 'xxx' }
🔍 [Preview] 审核结果: { passed: true/false, message: 'xxx' }

🔍 [PostDetail] 开始审核评论
🔍 [PostDetail] 评论审核结果: { passed: true/false, message: 'xxx' }

🔍 [ProfileEdit] 开始审核个人资料
🔍 [ProfileEdit] 审核内容: { textLength: xxx, imageCount: xxx }
🔍 [ProfileEdit] 审核结果: { passed: true/false, message: 'xxx' }

🔍 [PoetProfile] 开始审核诗人头像
🔍 [PoetProfile] 头像审核结果: { passed: true/false, message: 'xxx' }

🔍 [PoetProfile] 开始审核诗人简介
🔍 [PoetProfile] 简介审核结果: { passed: true/false, message: 'xxx' }
```

---

## 完成状态
- ✅ 任务19 - 发布帖子流程
- ✅ 任务20 - 评论发布流程
- ✅ 任务21 - 头像上传流程
- ✅ 任务22 - 个人资料更新流程
- ✅ 任务23 - 诗人资料上传流程

所有集成任务已完成！
