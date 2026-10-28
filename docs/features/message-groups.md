# 通知分类合并

2026-10-28：通知页的“点赞”和“收藏”合并为“点赞”，“反馈”和“举报”合并为“反馈”。最终标签为：全部、点赞、评论、关注、反馈、复核。

## 分组规则

| 页面标签 | 查询类型 | 包含消息 |
| --- | --- | --- |
| 点赞 | `like_all` | `like`、`favorite` |
| 反馈 | `feedback_report_all` | `feedback`、`feedback_reply`、`feedback_detail_requested`、`feedback_processed`、`post_report_new`、`post_report_handled`、`post_report_dismissed` |

`getMessages` 在服务端按合并类型过滤后，统一按创建时间倒序分页，避免分别拉取各类型再拼接导致乱序或漏项。每条通知保留原消息类型，因此收藏、反馈、举报的动作文字和详情跳转仍对应实际事件。

新查询类型使用独立缓存键，避免命中旧的单类型列表。旧版客户端的 `like`、`favorite`、`feedback_all`、`post_report_all` 查询保持兼容。未读总数继续统计当前用户的全部未读消息，展示后的已读处理仍使用具体消息 ID。

## 验证与部署

- `npm run test:messages`：分组、倒序分页、用户隔离、未读总数、旧查询兼容、页面请求和缓存。
- `npm run test:feedback`、`npm run test:post-reports`、`npm run test:unread-badge`：原通知内容、跳转和未读逻辑。
- 更新客户端之前，需要部署 `functions/getMessages`。无需迁移或重写已有消息。

真机复核：在“点赞”同时看到点赞和收藏通知，在“反馈”同时看到反馈和举报通知；加载下一页、点击详情，并确认已读状态正常。

本次验证：分组、反馈、举报、未读测试，编码/语法检查及 `npm run build:app` 均通过，尚未真机验收。已在 `cloud1-5gb0pbyl400845f5` 使用 `tcb fn code update getMessages --config-file cloudbaserc.feedback.json` 更新代码，并重新下载核对 SHA256 与本地一致。此命令只更新函数代码；备份保存在 Git 忽略目录 `unpackage/message-groups-deployment/2026-10-28/before/`。客户端需更新后显示合并分类。
