# 调试步骤

## 问题描述
发布帖子时出现错误："无效的审核类型"

## 已添加的调试日志

### 1. utils/contentModeration.js
- 添加了详细的参数日志
- 会输出调用云函数的完整参数
- 会输出云函数的完整响应

### 2. functions/contentCheck/index.js  
- 添加了 event.type 的类型和值日志
- 添加了 event 所有键的日志

## 下一步操作

### 1. 重新部署云函数
```bash
# 在项目根目录执行
# 方法1: 使用腾讯云开发者工具部署
# 方法2: 使用命令行
tcb fn deploy contentCheck
```

### 2. 重新构建小程序
```bash
# 清除构建缓存
# 然后重新构建小程序
```

### 3. 测试并查看日志
1. 在小程序开发者工具中打开"调试器"
2. 切换到"Console"标签
3. 尝试发布一个帖子
4. 查看控制台输出的日志，特别关注：
   - `🔍 [ContentModeration] 调用云函数参数:` 这行会显示传递给云函数的参数
   - `🔍 [contentCheck] event.type 值:` 这行会显示云函数收到的 type 值
   - `🔍 [contentCheck] event 所有键:` 这行会显示云函数收到的所有参数键

### 4. 可能的问题和解决方案

#### 问题1: type 字段丢失
如果日志显示 event 中没有 type 字段，可能是 cloudCall 的问题。

#### 问题2: type 值不正确
如果 type 的值不是 'batch'，可能是参数传递过程中被修改了。

#### 问题3: 缓存问题
如果修改后的代码没有生效，可能需要：
- 清除小程序缓存
- 重新上传云函数
- 重启开发者工具

## 临时解决方案

如果问题持续存在，可以临时跳过内容审核：

在 `pages/preview/preview.vue` 的 `moderateContent` 方法开头添加：

```javascript
// 临时跳过审核
return {
  passed: true,
  message: '审核通过（临时跳过）'
};
```

这样可以先让发布功能正常工作，然后再慢慢调试审核功能。
