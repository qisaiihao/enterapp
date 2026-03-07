# 内容审核测试页面使用指南

## 访问测试页面

在小程序开发工具中，访问路径：
```
pages/test-content-moderation
```

或者在代码中跳转：
```javascript
uni.navigateTo({
  url: '/pages/test-content-moderation'
});
```

## 测试功能

### 1. 文本审核测试

**测试步骤**：
1. 在文本框中输入要审核的内容
2. 选择场景（资料/评论/论坛/社交日志）
3. 点击"开始审核文本"按钮
4. 查看审核结果

**测试用例**：
- **正常文本**：点击"正常文本"按钮，自动填充正常内容
- **空文本**：点击"空文本"按钮，测试空白验证
- **超长文本**：点击"超长文本"按钮，测试长度限制（>2500字符）

**预期结果**：
- ✅ 正常文本应该审核通过
- ❌ 空文本应该被拒绝（"内容不能为空"）
- ❌ 超长文本应该被拒绝（"内容长度超过限制"）

### 2. 图片审核测试

**测试步骤**：
1. 输入图片 URL（必须是 http/https 开头）
2. 选择场景
3. 点击"开始审核图片"按钮
4. 查看审核结果和 Trace ID

**测试图片 URL 示例**：
```
https://example.com/test-image.jpg
```

**预期结果**：
- ✅ 正常图片应该审核通过
- ❌ 无效 URL 应该被拒绝
- ❌ 不支持的格式应该被拒绝

### 3. 批量审核测试

**测试步骤**：
1. 输入文本内容（可选）
2. 输入图片 URL 1（可选）
3. 输入图片 URL 2（可选）
4. 点击"开始批量审核"按钮
5. 查看审核结果

**预期结果**：
- ✅ 所有内容通过才返回通过
- ❌ 任何一项不通过则返回失败，并标注失败类型（text/image）

## 场景说明

| 场景值 | 说明 | 适用场景 |
|--------|------|----------|
| 资料 | 个人资料 | 昵称、个性签名、简介等 |
| 评论 | 评论内容 | 评论、回复等（默认） |
| 论坛 | 论坛帖子 | 帖子、文章等 |
| 社交日志 | 社交动态 | 动态、日记等 |

## 查看日志

页面底部的"测试日志"区域会实时显示：
- 操作时间
- 操作内容
- 审核结果

日志最多保留 20 条记录。

## 常见问题

### Q: 提示"请先登录"？
A: 需要先登录小程序，确保有有效的 openid。

### Q: 提示"系统配置错误"？
A: 检查云函数的环境变量是否正确配置（WECHAT_APPID 和 WECHAT_SECRET）。

### Q: 提示"系统繁忙，请稍后再试"？
A: 可能是：
1. 微信 API 服务器繁忙
2. access_token 获取失败
3. 网络问题

### Q: 审核一直转圈？
A: 检查：
1. 云函数是否已部署
2. 数据库集合是否已创建
3. 网络连接是否正常

### Q: 图片审核失败？
A: 确认：
1. 图片 URL 是否可访问
2. 图片格式是否支持（jpg、jpeg、png、bmp、gif）
3. 图片 URL 必须是 http/https 开头

## 调试技巧

### 1. 查看云函数日志
在微信云开发控制台：
- 云开发 → 云函数 → contentCheck → 日志

### 2. 查看数据库记录
在微信云开发控制台：
- 云开发 → 数据库 → moderation_logs

### 3. 查看控制台输出
在小程序开发工具的控制台查看详细日志。

## 部署前检查

使用测试页面前，请确保：

- [x] 云函数 `contentCheck` 已部署
- [x] 环境变量已配置（WECHAT_APPID、WECHAT_SECRET）
- [x] 数据库集合已创建（moderation_logs、access_tokens、moderation_cache）
- [x] 用户已登录（有效的 openid）

## 下一步

测试通过后，可以在实际页面中集成审核功能：

```javascript
import { checkText } from '@/utils/contentModeration.js';

// 在发布前审核
async handlePublish() {
  const result = await checkText(this.content, {
    scene: 2,
    title: this.title
  });
  
  if (result.passed) {
    // 审核通过，继续发布
    await this.publishPost();
  } else {
    // 审核未通过，提示用户
    uni.showToast({
      title: result.message,
      icon: 'none'
    });
  }
}
```

## 技术支持

如遇问题，请参考：
- `functions/contentCheck/README.md` - 完整使用文档
- `functions/contentCheck/DEPLOYMENT_CHECKLIST.md` - 部署检查清单
- 微信官方文档：https://developers.weixin.qq.com/miniprogram/dev/api-backend/open-api/sec-check/security.msgSecCheck.html
