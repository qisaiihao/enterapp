# 项目逻辑检查记录（2026-09-12）

范围：当前本地代码及隔离模拟；未核验云端部署、数据库权限和唯一索引。

| 编号 | 严重程度 | 问题及影响 | 主要位置 | 状态 |
| --- | --- | --- | --- | --- |
| 1 | 严重 | 信任客户端 openid，可冒用身份修改账号或调用管理接口 | `functions/updateUserProfile`、`functions/adminManager` | 待修复 |
| 2 | 严重 | 微信绑定不验证目标账号凭证，公开 Poem ID 可用于绑定并登录他人账号 | `functions/bindWechatToAccount`、`functions/loginWithWechat` | 待修复 |
| 3 | 高危 | 管理员按可修改的 Poem ID 识别，存在提权风险；线上唯一索引未核验 | `functions/updateUserProfile`、`functions/checkAdmin/_lib/admin-auth.js` | 待修复 |
| 4 | 高危 | 手机号绑定不核验短信凭据，手机号登录只凭号码返回成功 | `functions/updateUser`、`functions/loginWithPhone` | 待修复 |
| 5 | 高危 | 密码明文保存，部分登录响应和日志包含密码 | `functions/registerUser`、`functions/loginWithWechat`、`functions/loginWithCredentials` | 待修复 |
| 6 | 高危 | 匿名帖接口返回 realAuthorOpenid，可关联真实作者 | `functions/getPostDetail`、`functions/getPostList` | 待修复 |
| 7 | 逻辑错误 | 并发点赞重复迁移成长等级，计数可能为负；3→5 赞可错误得到种子 -1、叶子 2 | `functions/vote` | 已修复，待部署 |
| 8 | 逻辑错误 | 匿名帖点赞通知、成长统计归到公共账号 123456，而非真实作者 | `functions/vote` | 已修复，待部署 |
| 9 | 逻辑错误 | 隐藏帖在分页后过滤，返回不足一页导致前端提前停止加载 | `functions/getUserProfile` | 已修复，待部署 |

检查时已有质量检查、全量语法检查及弹窗、活动、热榜、草稿回归测试通过；上述关键问题另用内存数据库模拟复现。

本次按用户要求只修复 7、8、9；1—6 保留记录。历史错误统计和已发出的错误通知不自动回写。

修复说明：点赞记录、票数、成长统计通过事务一起提交，重试后只发一次通知；匿名帖按真实作者归属，缺失作者时不创建残缺账号；隐藏帖在分页前过滤，本人仍可查看自己的隐藏帖。事务按文档 ID 写入，兼容旧点赞记录，参考 [CloudBase 事务约束](https://docs.cloudbase.net/database/transaction)。

验证：`npm run test:vote-profile` 覆盖并发升降级、同一用户切换点赞、回滚、匿名归属及完整分页，并已加入 `npm run check:quality`。两项回归测试均能识别修复前的错误。上线需部署 `vote`、`getUserProfile`，部署后再做实际点赞和主页翻页验证。
