# 反馈沟通与办结

## 入口与行为

- 用户：意见反馈 → 我的反馈 → 反馈详情，可查看本人历史反馈、处理状态、往来文字和图片，并补充信息。
- 管理员：管理 → 反馈建议 → 查看与回复，可继续处理、要求用户补充细节，或填写结果后回复并办结。
- 已删除 `pages-tools/feedback-admin/feedback-admin.vue` 及路由；个人主页保留的跳转统一转向 `pages-admin/feedback-list/feedback-list.vue`。
- 信箱新增“反馈”分类。新提交和用户补充通知配置中的管理员；管理员回复、要求补充、办结通知提交者。点击通知进入相同详情页。
- 信箱在进入页面时强制刷新，保留现有未读机制；详情通过重新进入、下拉刷新获取最新记录，无后台实时推送。
- 回复按最新在前分页展示。每次发送必须有 1–500 字文字，可附最多 3 张图片。

## 状态

| 值 | 显示 | 转换 |
| --- | --- | --- |
| pending | 待处理 | 新提交 |
| processing | 处理中 | 管理员回复并继续处理，或用户补充 |
| waiting_user | 待补充 | 管理员要求补充细节 |
| closed | 已办结 | 管理员填写结果后办结，不能继续回复 |

旧记录无 `status` 时，通过 `isProcessed` 映射为待处理或已办结，无需批量迁移。旧客户端 `markAsProcessed` 接口保留兼容；仍发原有解决通知，新客户端从通知跳转详情。没有反馈 ID 的旧解决通知保留弹窗。

## 数据与一致性

- `feedback` 保存原始内容、用户、状态，以及 `replyCount`、`lastReply`、`lastReplyRole`、`updatedAt` 摘要。
- 新集合 `feedbackReplies` 保存 `feedbackId`、`sequence`、发送者和角色、文字、图片、发送时间及当时状态。
- 使用当前项目统一身份传递方式（微信上下文优先，App 使用既有 openid 传参）。归属与管理员权限在云函数核验，发送者名称、接收者不采信客户端传值。
- 回复、反馈状态和信箱通知在一个事务中提交。请求标识按反馈和发送者隔离；重试返回原结果，复用同一标识篡改内容会拒绝。
- 清空信箱不影响反馈历史。管理员删除改为逻辑删除，列表与详情均不再暴露，后续回复拒绝；关联回复和图片保留，避免删除与并发回复留下断裂引用。

## 云端部署

上线前先在项目当前云环境创建 `feedbackReplies` 集合。安全规则设为客户端不可读写（仅云函数访问）：

```json
{ "read": false, "write": false }
```

配置以下非唯一复合索引（已有的同等索引可复用）：

| 集合 | 字段顺序 |
| --- | --- |
| feedback | userOpenid 升序、createTime 降序 |
| feedbackReplies | feedbackId 升序、sequence 降序 |
| messages | toUserId 升序、type 升序、createTime 降序 |

`feedback` 的 `createTime` 排序沿用现有索引；列表查询同时排除 `deleted: true`。确认现有 `feedback` 集合也不允许客户端绕过云函数读取其他用户内容。

随后部署 `functions/feedbackManager` 和 `functions/getMessages`，并编译更新前端。反馈事务建议云函数超时设为 15 秒，给管理员名单读取及多条通知留出时间。部署配置见 `cloudbaserc.feedback.json`，仅包含这两个函数。

```powershell
tcb fn deploy feedbackManager --config-file cloudbaserc.feedback.json --force
tcb fn deploy getMessages --config-file cloudbaserc.feedback.json --force
```

## 验证

- `npm run test:feedback`：旧办结通知、归属权限、双向回复、状态流转、图片参数、分页、通知接收者与未读、重复请求、事务失败回滚、并发回复/办结、逻辑删除；前端发送失败保留输入与上传结果，重试复用请求标识。
- `npm run check:quality`、`npm run build:app`、`npm run build:mp-weixin`。
- 真机验收需使用一个普通账号和一个管理员账号，走完提交 → 要求补充 → 补充图片 → 回复并办结，分别确认信箱通知、详情跳转、历史和状态；本地模拟不能替代此项。
- 额外弹层测试 `node scripts/test-app-overlays.cjs` 当前在既有 `pages-tools/web-link/web-link.vue` 缺少 `app-overlay-host` 处失败，该页不在本次修改范围；两个新增反馈页均含挂载点。
