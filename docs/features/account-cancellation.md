# 应用内注销账号（2026-10-10）

设置页提供“注销账号”入口，注销后删除账号与隐私数据、匿名化保留公开内容。隐私政策同步更新到 2026-10-10 版本，`PRIVACY_POLICY_VERSION` 已升级，老用户会重新确认一次。

## 入口与流程

- 设置页“账号”分组仅在登录后展示；“注销账号”为红色危险操作，说明文字写明不可恢复。
- 第一步 `AppDialog` 说明后果（删除哪些数据、哪些内容匿名化保留），确认“继续注销”。
- 第二步通过云端预检 `dryRun` 判断账号是否设置密码：
  - 有密码：弹出密码输入框（`AppDialog` 的 `editable` + 新增 `password` 属性，密文显示），输入正确才注销；密码错误保留弹窗可重试。
  - 无密码（微信/GitHub 等）：再弹一次危险确认，确认后注销。
- 成功后清理本地缓存与登录态、重置匿名 openid，提示“账号已注销”并跳转登录页。
- 失败保留弹窗，可重试；注销接口幂等，重试不会重复处理。

## 云端函数 `cancelAccount`

- 身份：优先信任 `cloud.getWXContext().OPENID`；客户端上报的 `event.openid` 必须在微信端与当前微信绑定一致，否则返回 `IDENTITY_MISMATCH`。账号有密码时必须校验 `event.password`（`PASSWORD_REQUIRED` / `PASSWORD_MISMATCH`）。
- `event.dryRun === true` 只返回 `{ hasAccount, requiresPassword }`，不做任何改动。
- 删除（账号与隐私数据）：`users`、`user_identities`、`wechat_bindings`、`wechat_binding_grants`、`drafts`、`favorites`、`favorite_folders`、`portfolio_items`、`portfolio_folders`、`follows`、`blocks`、`messages`（收发双向）、`votes_log`、`search_logs`、`api_rate_limits`、`view_events`、`view_log`、`weekly_issue_views`、`images` 及云存储文件、`collage_ocr_cache`/`collage_ocr_usage`（`wx:`/`tcb:` 两种 owner 候选）及云存储文件、`sms_codes`/`sms_logs`（按手机号及其脱敏串）。
- 匿名化保留：`posts` 作者信息替换为“已注销用户”，`_openid` 换成 `deleted_user`（匿名帖保持 `123456` 并清除 `realAuthorOpenid`）；`comments` 增加 `authorDeleted` 标记并清除归属；其他用户引用该账号帖子时保存的 `quotedPostAuthor` 快照一并替换；`feedback`/`feedbackReplies`、`moderation_logs` 保留记录但身份匿名化；`poets.creatorOpenid` 清除。
- 计数回退：删除的 `votes_log` 会按帖子/评论分别递减 `posts.votes`、`comments.likes`；其他用户成长值不做回退（原删除帖子逻辑也不回退）。
- 部分步骤失败返回 `CANCEL_INCOMPLETE` 与 `failed` 列表，客户端可重试；每步幂等。
- 帖子更新经 `functions/_shared/posts` 代理（兼容 V1/V2），`cancelAccount` 已加入 `consumers.json`（46 个部署包），需与 `npm run sync:posts` 的 `_lib/posts` 一起部署。
- `getComments` 的非匿名分支新增 `authorDeleted` 判断，已注销评论显示“已注销用户”而不是回退成“匿名用户”。

## 部署

- 新增云函数需在 CloudBase 控制台部署 `functions/cancelAccount`（含 `_lib/posts`、`package.json`）；`cloudbaserc.json` 已登记，超时 20s、内存 256MB。
- 建议先部署 `cancelAccount`，再发布包含设置页入口的客户端。

## 尚未覆盖

- 未做短信验证码验证（无密码账号只做二次确认）；如需更强保护可复用 `sendSmsCode`/`verifySmsCode` 场景。
- 别人的评论里 `replyToAuthorName`、weekly 快照中的历史昵称/头像属于发布时快照，未回溯清理。
- 未迁移 `weekly_issues`/`activities` 的 `createdBy` 等管理员字段（普通用户不涉及）。
- 真机全流程（密码键盘、注销后进入登录页、重新注册同 Poem ID）尚未验收。

## 验证

- `scripts/test-cancel-account.cjs`（纳入 `check:quality`）：预检不改数据、密码必填/错误/成功、微信身份不匹配拒绝、删除矩阵、帖子/评论匿名化与计数回退、引用快照、云文件删除、幂等重试、无身份拒绝，以及设置页两步/密码重试/无密码确认的前端状态流转。
- `npm run test:posts` 验证 46 个包的 `_lib/posts` 同步。
