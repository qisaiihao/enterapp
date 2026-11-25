# 通知分类合并

2026-10-28：通知页的“点赞”和“收藏”合并为“点赞”，“反馈”和“举报”合并为“反馈”。最终标签为：全部、点赞、评论、关注、反馈、复核。

## 分组规则

| 页面标签 | 查询类型 | 包含消息 |
| --- | --- | --- |
| 点赞 | `like_all` | `like`、`favorite` |
| 反馈 | `feedback_report_all` | `feedback`、`feedback_reply`、`feedback_detail_requested`、`feedback_processed`、`post_report_new`、`post_report_handled`、`post_report_dismissed` |

`getMessages` 在服务端按合并类型过滤后，统一按创建时间倒序分页，避免分别拉取各类型再拼接导致乱序或漏项。每条通知保留原消息类型，因此收藏、反馈、举报的动作文字和详情跳转仍对应实际事件。

新查询类型使用独立缓存键，避免命中旧的单类型列表。旧版客户端的 `like`、`favorite`、`feedback_all`、`post_report_all` 查询保持兼容。未读总数继续统计当前用户的全部未读消息，展示后的已读处理仍使用具体消息 ID。

## 进入即全部已读

2026-11-23：行为改为打开消息页就把当前用户的全部消息标记为已读，返回后顶部消息图标的小红点消失，不再只处理当前分页里可见的消息。

- 客户端先在本地把已加载消息标为已读并清零红点，再后台调用 `markMessagesAsRead` 的 `markAll: true` 模式。云端成功后再次确认，失败则回读服务器未读数恢复红点。列表可以同时加载，已读状态变化保留消息内容缓存。
- 云端的 `markMessagesAsRead` 在 `markAll` 模式下按 `toUserId + isRead: false` 批量更新，循环执行直到没有未读记录（单次 update 有条数上限），只影响当前用户。
- 红点清零必须即时跨实例同步：`unread-badge` 的 `setUnreadCount` 每次都通过 `uni.$emit` 广播（不再只在本地计数变化时广播），页面使用 `acknowledgeAllRead()` 清零并携带 `cleared` 标记，让分包/其他页面实例在短时间内不因旧缓存或在途请求把红点重新点亮；`api-cache/unread` 同步写入 0，页面退出前后读取到的都是已读状态。
- 列表接口返回的 `unreadCount` 只用于页面展示，不再通过 watcher 反向驱动全局红点，避免缓存中的旧未读数把红点“自动点亮”；单条已读按全局未读数递减（最小为 0），不再用页面本地计数推算。
- 云端 `markMessagesAsRead` 以 `isRead != true` 作为未读条件，兼容 `isRead` 缺失的历史消息；客户端 `markAll` 失败会重试一次，仍失败才回读服务器未读数恢复红点。
- 客户端更新后需要部署 `functions/markMessagesAsRead`；若只更新客户端而未部署，`markAll` 会失败，红点会在下一次轮询时重新出现。

## 首屏加载

2026-11-25：未读数更新为新的非零值时，客户端预取“全部”首页。点击顶部栏消息图标也会开始预取，页面打开时复用同一请求。已登录用户按账号和分类缓存首页，可立即显示五分钟内的快照。快照超过 15 秒时在后台刷新，手动下拉直接请求，网络失败时保留已显示的消息。删除或清空会使当前账号的首页缓存失效。

消息文字先显示，云端头像先用默认头像占位，批量转换完成后再更新。此次改动只需更新客户端。

## 验证与部署

- `npm run test:messages`：分组、倒序分页、用户隔离、未读总数、全部已读、旧查询兼容、页面请求和缓存。
- `npm run test:feedback`、`npm run test:post-reports`、`npm run test:unread-badge`：原通知内容、跳转和未读逻辑。
- 更新客户端之前，需要部署 `functions/getMessages`。无需迁移或重写已有消息。

真机复核：在“点赞”同时看到点赞和收藏通知，在“反馈”同时看到反馈和举报通知；加载下一页、点击详情，并确认已读状态正常。

本次验证：分组、反馈、举报、未读测试，编码/语法检查及 `npm run build:app` 均通过，尚未真机验收。已在 `cloud1-5gb0pbyl400845f5` 使用 `tcb fn code update getMessages --config-file cloudbaserc.feedback.json` 更新代码，并重新下载核对 SHA256 与本地一致。此命令只更新函数代码；备份保存在 Git 忽略目录 `unpackage/message-groups-deployment/2026-10-28/before/`。客户端需更新后显示合并分类。
