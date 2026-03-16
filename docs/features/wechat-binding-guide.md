# 微信账号绑定功能说明

## 功能概述

当用户在小程序中使用 Poem ID + 密码登录时，如果检测到当前微信的 openid 与账号中存储的 openid 不同，系统会弹出询问弹窗，让用户选择是否将账号绑定到当前微信。

## 实现原理

### 1. 登录流程

1. 用户在小程序中输入 Poem ID 和密码
2. 调用 `loginWithCredentials` 云函数验证身份
3. 登录成功后，前端获取当前微信的 openid
4. 比较当前 openid 与账号中的 openid
5. 如果不同，显示绑定微信弹窗

### 2. 绑定流程

用户点击"确认绑定"后：

1. 调用 `bindWechatOpenid` 云函数
2. 云函数批量更新以下数据库集合中的 openid：
   - `users` - 用户信息
   - `posts` - 帖子数据
   - `comments` - 评论数据
   - `favorites` - 收藏数据
   - `messages` - 消息数据（发送者和接收者）
   - `images` - 图片数据
   - `votes_log` - 点赞记录
   - `follows` - 关注关系（关注者和被关注者）
   - `portfolios` - 作品集数据
3. 更新完成后，返回更新统计
4. 前端更新本地缓存和全局数据
5. 跳转到主页

### 3. 跳过绑定

用户点击"跳过"后：

1. 使用原有的 openid 完成登录
2. 不更新数据库
3. 跳转到主页

## 云函数说明

### bindWechatOpenid

**路径**: `functions/bindWechatOpenid/index.js`

**参数**:
- `oldOpenid` (string): 旧的 openid
- `poemId` (string): 用户的 Poem ID（用于验证身份）

**返回值**:
```javascript
{
  success: true,
  message: '绑定成功',
  updateResults: {
    users: 1,
    posts: 10,
    comments: 5,
    favorites: 3,
    messages: 8,
    images: 2,
    votes_log: 15,
    follows: 6,
    portfolios: 2
  }
}
```

**安全机制**:
- 验证用户身份：确保 poemId 对应的用户的 openid 是 oldOpenid
- 自动获取新 openid：通过 wxContext.OPENID 获取当前微信的 openid
- 批量更新：使用分页查询和批量更新，避免超时

## 前端实现

### 弹窗样式

绑定微信弹窗的样式与其他弹窗（如绑定手机号）保持一致，使用相同的 CSS 类：
- `.bind-phone-modal` - 弹窗容器
- `.modal-mask` - 遮罩层
- `.modal-content` - 内容区域
- `.modal-header` - 标题栏
- `.modal-body` - 正文区域
- `.modal-footer` - 按钮区域

### 关键方法

- `handleLoginResult()` - 处理登录结果，检测 openid 变化
- `getWxContext()` - 获取微信上下文（小程序专用）
- `handleBindWechat()` - 处理绑定微信操作
- `skipBindWechat()` - 跳过绑定操作
- `closeBindWechatModal()` - 关闭弹窗

## 使用场景

### 场景 1：跨设备登录

用户 A 在自己的微信 A 中注册了账号，后来在朋友的手机（微信 B）上用账号密码登录。系统会询问是否绑定到微信 B。

### 场景 2：更换手机

用户更换了新手机，使用新的微信号登录旧账号。系统会询问是否绑定到新微信。

### 场景 3：账号共享（不推荐）

多个用户共享同一个账号，每次登录时可以选择是否绑定到当前微信。

## 注意事项

1. **数据一致性**: 绑定操作会批量更新所有相关数据，确保数据一致性
2. **不可逆**: 绑定操作完成后，旧的 openid 将被完全替换，无法恢复
3. **性能考虑**: 如果用户有大量数据，绑定操作可能需要较长时间
4. **超时设置**: 云函数超时时间设置为 60 秒，足够处理大部分情况
5. **仅小程序**: 此功能仅在小程序环境下生效，H5 和 App 不受影响

## 部署步骤

1. 上传云函数：
   ```bash
   # 在 HBuilderX 中右键 functions/bindWechatOpenid 文件夹
   # 选择"上传部署"
   ```

2. 安装依赖：
   ```bash
   cd functions/bindWechatOpenid
   npm install
   ```

3. 测试功能：
   - 在小程序中使用 Poem ID 登录
   - 检查是否弹出绑定微信弹窗
   - 点击"确认绑定"，验证数据是否正确更新

## 未来优化

1. **进度提示**: 显示绑定进度（已更新 X/Y 条数据）
2. **错误恢复**: 如果绑定失败，提供回滚机制
3. **批量优化**: 使用事务或更高效的批量更新方式
4. **日志记录**: 记录绑定操作日志，便于追踪和审计
