# 重新启用腾讯云内容审核服务

## 当前状态
内容审核服务已暂时禁用，因为腾讯云内容审核服务未续费。

## 重新启用步骤

### 1. 续费腾讯云内容审核服务
- 登录腾讯云控制台
- 进入内容安全（CMS）服务
- 续费或购买内容审核服务

### 2. 配置环境变量
在云函数环境中设置以下环境变量：
- `TENCENT_SECRET_ID`: 腾讯云SecretId
- `TENCENT_SECRET_KEY`: 腾讯云SecretKey

### 3. 恢复云函数配置
在 `cloudbaserc.json` 中取消注释以下配置：
```json
{
  "name": "contentCheck",
  "root": "./functions/contentCheck",
  "timeout": 5,
  "memory": 128
}
```

### 4. 恢复前端代码
在 `pages/add/add.vue` 的 `submitWithContentCheck` 方法中：
1. 注释掉直接发布的代码
2. 取消注释原来的内容审核逻辑

### 5. 恢复云函数代码
在 `functions/contentCheck/index.js` 中：
1. 注释掉提前返回的代码
2. 取消注释原来的审核逻辑

## 注意事项
- 确保腾讯云内容审核服务已正常续费
- 检查环境变量配置是否正确
- 测试审核功能是否正常工作
- 建议先在测试环境验证功能正常后再部署到生产环境

## 相关文件
- `pages/add/add.vue` - 前端发布逻辑
- `functions/contentCheck/index.js` - 内容审核云函数
- `cloudbaserc.json` - 云函数配置
- `functions/contentCheck/cloudbaserc-backup.json` - 配置备份
