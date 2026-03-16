# bindWechatOpenid 云函数

## 功能说明

将用户的旧 openid 批量更新为新的微信 openid，用于账号绑定微信场景。

## 使用场景

当用户在小程序中使用 Poem ID + 密码登录时，如果检测到当前微信的 openid 与账号中存储的 openid 不同，可以调用此云函数将账号绑定到当前微信。

## 参数

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| oldOpenid | string | 是 | 旧的 openid（账号中存储的） |
| poemId | string | 是 | 用户的 Poem ID（用于验证身份） |

## 返回值

```javascript
{
  success: true,
  message: '绑定成功',
  updateResults: {
    users: 1,          // 更新的用户记录数
    posts: 10,         // 更新的帖子记录数
    comments: 5,       // 更新的评论记录数
    favorites: 3,      // 更新的收藏记录数
    messages: 8,       // 更新的消息记录数
    images: 2,         // 更新的图片记录数
    votes_log: 15,     // 更新的点赞记录数
    follows: 6,        // 更新的关注关系数
    portfolios: 2,     // 更新的作品集数
    blocks: 1          // 更新的屏蔽关系数
  }
}
```

## 更新的数据库集合

1. **users** - 用户信息表
2. **posts** - 帖子表
3. **comments** - 评论表
4. **favorites** - 收藏表
5. **messages** - 消息表（发送者和接收者）
6. **images** - 图片表
7. **votes_log** - 点赞记录表
8. **follows** - 关注关系表（关注者和被关注者）
9. **portfolios** - 作品集表
10. **blocks** - 屏蔽关系表（屏蔽者和被屏蔽者）

## 安全机制

1. **身份验证**：验证 poemId 对应的用户的 openid 是否为 oldOpenid
2. **自动获取新 openid**：通过 wxContext.OPENID 获取当前微信的 openid
3. **批量更新**：使用分页查询（每次最多 1000 条），避免超时
4. **并发处理**：使用 Promise.all 并发更新，提高效率

## 性能考虑

- 超时时间：60 秒
- 批量大小：每次最多处理 1000 条记录
- 如果用户数据量特别大，可能需要多次调用或增加超时时间

## 错误处理

如果绑定失败，会返回错误信息：

```javascript
{
  success: false,
  message: '错误信息'
}
```

常见错误：
- `参数错误：缺少 openid` - 缺少必填参数
- `用户验证失败` - poemId 或 oldOpenid 不匹配
- `绑定失败` - 数据库更新失败

## 调用示例

```javascript
const result = await cloudCall('bindWechatOpenid', {
  oldOpenid: 'old_openid_xxx',
  poemId: 'user_poem_id'
});

if (result.result.success) {
  console.log('绑定成功，更新统计:', result.result.updateResults);
} else {
  console.error('绑定失败:', result.result.message);
}
```

## 注意事项

1. **不可逆操作**：绑定完成后，旧的 openid 将被完全替换，无法恢复
2. **数据一致性**：确保所有相关数据都已更新，避免数据不一致
3. **仅小程序**：此功能仅在小程序环境下使用
4. **测试建议**：在生产环境使用前，建议在测试环境充分测试

## 部署步骤

1. 安装依赖：
   ```bash
   cd functions/bindWechatOpenid
   npm install
   ```

2. 上传云函数：
   - 在 HBuilderX 中右键 `functions/bindWechatOpenid` 文件夹
   - 选择"上传部署"

3. 测试功能：
   - 创建测试账号
   - 使用 Poem ID 登录
   - 验证绑定功能是否正常
