# contentCheck 云函数

## 功能

内容审核云函数,支持文本和图片审核。

## 使用方式

详见: `docs/post-publishing-refactor.md`

## 环境变量

需要配置以下环境变量:
- `WECHAT_APPID`: 微信小程序 AppID
- `WECHAT_SECRET`: 微信小程序 Secret

## 文件说明

- `index.js` - 主函数
- `tokenManager.js` - access_token 管理
- `wechatAPIClient.js` - 微信 API 调用
- `validator.js` - 参数验证
- `moderationLogger.js` - 审核日志
- `cacheManager.js` - 审核结果缓存
