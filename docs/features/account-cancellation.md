# 应用内注销账号（2026-10-14）

设置页提供“注销账号”入口。确认注销后，永久删除账号资料、本人发布的内容及关联数据，包括公开帖子和匿名帖子，不再以“已注销用户”替换作者后保留本人内容。用于安全审计和网安备案的 `login_logs` 为明确例外，账号注销后仍保留，仅供授权管理员在腾讯云后台查询。隐私政策及 `PRIVACY_POLICY_VERSION` 同步更新为 `2026-10-14`。

## 入口与身份验证

1. 登录后的设置页“账号”分组展示红色“注销账号”入口，并说明不可恢复。
2. 第一层 `AppDialog` 列出删除范围，点击“继续注销”后调用云端 `dryRun` 预检；等待期间禁止重复提交。
3. 已设置密码的账号必须输入正确密码。密码输入框使用密文显示，密码错误时保留弹窗，允许重新输入。
4. 无密码账号只有在云端确认当前微信与该账号仍有效关联时才能进入第二次危险确认。App/H5 等没有可信微信身份的无密码调用返回 `IDENTITY_REQUIRED`，提示通过绑定手机号设置密码，或使用微信登录后再注销。客户端传入的 `openid` 和本地登录状态不能代替所有权验证。
5. 注销成功后清理本机个人数据及登录状态，等待匿名身份重新初始化，再 `reLaunch` 登录页，清空旧页面历史。

`cancelAccount` 使用 `cloud.getWXContext().OPENID` 验证微信身份。有效的 `wechatOpenId` 绑定优先于旧 `_openid`；已换绑或 `wechatLoginDisabled` 为 `true` 的旧微信身份不能注销原账号。微信调用的目标账号与当前绑定不符时返回 `IDENTITY_MISMATCH`；账号标识存在多个用户记录时返回 `AMBIGUOUS_ACCOUNT`。

有密码账号的正式删除调用始终校验 `event.password`，缺失和错误分别返回 `PASSWORD_REQUIRED`、`PASSWORD_MISMATCH`。`event.dryRun === true` 仅返回 `hasAccount`、`requiresPassword` 等预检结果，不删除记录、文件或调整计数。

## 云端删除范围

| 数据 | 删除与清理行为 |
| --- | --- |
| 账号资料和登录关联 | 删除 `users`、本人 `user_identities`、`wechat_binding_grants`、仍归属本账号的 `wechat_bindings`，以及 `web_reader_sessions.owner` 对应的网站登录会话。关联查询兼容 `_openid`、用户文档 `_id`、迁移后的 `user_id`。 |
| 发布内容和草稿 | 永久删除 `posts`、`comments`、`drafts` 中本人的记录；帖子和评论同时匹配 `_openid` 和 `realAuthorOpenid`，覆盖旧版、V2 和匿名内容。 |
| 内容的附属数据 | 删除被删帖子的评论及回复、点赞、收藏、作品集条目、浏览记录、通知、举报和内容复核记录。删除评论时递归清理回复，并删除对应点赞、消息和复核记录。 |
| 收藏、作品集和关系 | 删除本人 `favorites`、`favorite_folders`、`portfolio_items`、`portfolio_folders`，以及收发双向的 `follows`、`blocks`。被删内容在他人收藏或作品集中的条目一并清理。 |
| 消息 | 删除本人收发的 `messages`，以及按 `postId`、`commentId`、`reportId`、`reviewId`、`feedbackId`、`replyId` 关联到被删内容的通知，清除通知中的内容和身份副本。 |
| 反馈与举报 | 删除本人 `feedback` 及该反馈的全部 `feedbackReplies`，包括管理员回复；删除本人在其他反馈中的回复，并同步父反馈的最后回复及回复数量。删除本人提交的 `post_reports` 及针对被删帖子的举报，清除证据图片和帖子快照。 |
| 内容复核 | 删除本人提交的 `moderation_review`，覆盖待处理、通过、拒绝等状态及其中的预备写入数据；删除关联被删帖子、评论或回复的复核记录。 |
| 用户行为和审核记录 | 删除 `search_logs`、`api_rate_limits`、`view_events`、`view_log`、`weekly_issue_views`、`moderation_logs` 中可关联到本人的记录；不包括 `login_logs`。 |
| 安全审计与备案登录日志 | `login_logs` 注销后仍保留，不删除、改写或匿名化已有日志。集合维持 `ADMINONLY`，仅授权管理员可在腾讯云后台查询，普通客户端不可访问。本功能不设自动清理期限。 |
| 手机验证数据 | 删除绑定手机号及兼容 `+86` 格式的 `sms_codes`、对应手机号的发送配额记录，以及按脱敏手机号关联的 `sms_logs`。 |
| 拼贴识别 | 清理可关联的 `collage_ocr_cache` 及源图、`collage_ocr_usage` 用户配额；同时处理以 owner 哈希写入文档 ID 的每日配额。owner 来源包括账号微信标识与当前调用可信的 CloudBase 身份。 |
| 云文件 | 从被删的资料和内容记录收集上传文件，包括头像、签名、帖子和评论图片、草稿图片、反馈附件、举报证据、收藏与作品集封面、`images` 和拼贴识别源图。 |

## 引用、快照和公共记录

- 被删除帖子在其他帖子中保存的 `quotedPostId`、`quotedPostTitle`、`quotedPostAuthor`、`quotedPostAuthorId`、`parentPostId` 等直接引用字段一并清除。
- 引用讨论中已明确复制的原诗句同步清理，包括 `sentenceGroups[].sentences`、`discussionSentences[].sentences`、`highlightLines`、`highlightSentence`；由原帖标题自动生成的讨论标题改为“讨论”。保留其他用户自行编写的正文和 `group.comment`，并同步净化周刊中该讨论的派生快照。
- 周刊 `weekly_issues.featuredPostIds`、`featuredSnapshots`、`rankingSnapshot`，专题 `weekly_topics.selectedPostIds`、`selectedSnapshots` 中移除被删帖子；快照 ID 兼容 `postId`、`_id`、`id`。指向这些帖子图片的刊物封面和首页条目也会清理。
- 公共活动、公告、拼贴素材、周刊等记录中的 `createdBy`、`updatedBy`，他人举报或复核中的管理员处理身份，以及用户发帖限制中的管理员身份字段，清除对注销账号的引用。反馈中的 `processedBy`、`deletedBy` 同样清理。
- 从 `adminConfig.admin.adminPoemIds` 移除本人的 Poem ID，避免以后重新注册相同 Poem ID 时继承旧管理员权限。
- 公共诗人库 `poets` 保留公共诗人资料，只清除本账号的 `creatorOpenid`。公共字体、静态素材、拼贴背景和公共诗人头像目录不作为个人上传文件删除。

## 重试和数据一致性

- 按页读取并逐条删除，不使用固定的 1000 条查询上限。删除过程中持续读取第一页，避免记录移除后使用偏移分页造成漏删。
- 云文件每批最多 50 个，检查每个文件的删除结果。请求返回但单个文件失败仍视为失败；已经不存在的文件按幂等成功处理。文件删除成功后才删除记录，保留失败后的重试线索。
- 点赞记录移除与帖子点赞数、评论点赞数调整放在同一事务内，计数最低为 0；帖子点赞跨越成长档位时更新作者 `growthCounts`。评论数、收藏夹和作品集条目数也随删除更新，重试不会再次扣减已经删除的记录。
- 只有全部清理步骤成功后才删除主用户记录及其微信绑定。部分步骤失败返回 `CANCEL_INCOMPLETE` 和 `failed`，保留身份及密码供本人继续清理；这不表示已经删除的数据可以恢复。
- 尚未创建的可选功能集合按无数据处理；权限、网络、数据库和存储错误会报告失败，不伪装为注销成功。

## 本机清理

成功后清除用户信息、账号 openid、GitHub 登录令牌及临时登录资料、创作和编辑草稿、预览内容、讨论与拼贴草稿、管理员周刊草稿、背景缓存和会话标识，以及本人拼贴工作区和可定位的本地素材文件、个人成长统计显示偏好。统一缓存管理器和持久化缓存同时清理。

设置页在退出旧发布页面前标记其丢弃工作草稿，并取消待执行的草稿保存计时器，避免注销后页面卸载又把草稿写回本机。独立网站页面保存在其自身域名下的浏览器令牌不会由 App 删除；云端相应 `web_reader_sessions` 已撤销，因此旧令牌不能继续使用。

## 覆盖边界与验收

云文件删除依据可关联的数据库记录。历史上上传失败、旧版删帖或换头像后已经失去引用的孤儿文件，若没有保存上传者映射，无法从文件名中的时间戳可靠判断归属，本功能不能承诺已经清除这些历史孤儿文件。旧版上传路径也没有统一的账号归属索引，历史上借用同一云图片的情况不能仅凭目录准确区分所有者；本次按关联记录清理，并保护已知公共素材目录。其他设备的本地副本，以及他人手动保存的文件，不属于本机清理范围。

OCR 清理读取可信云函数调用上下文中的 `TCB_UUID`，兼容 JSON `environment` 与旧版 `environ`，不使用客户端自报 UID。旧版其他设备的匿名 OCR 缓存若未记录账号映射，无法仅凭本账号确定其归属，需单独排查这些历史资源。

本次没有改动字体资源、App 字体注册时机或 Canvas 字体名称。注销的真机全流程尚未验收；上线前应验证密码键盘、微信无密码确认、App/H5 密码验证、失败重试、清空旧页面和草稿、重新注册相同 Poem ID 等场景。

## 部署与验证

- 重新部署 `functions/cancelAccount`，包括 `package.json` 和 `_lib/posts`。`cloudbaserc.json` 配置为 `Nodejs18.15`、超时 60 秒、内存 256MB；客户端该调用超时为 70 秒。
- 先部署云端删除逻辑，再发布设置页和隐私政策更新。代码修改和本地构建不代表云函数已经部署或客户端已经发布。
- `scripts/test-cancel-account.cjs` 纳入 `npm run check:quality`，覆盖身份与密码验证、预检无副作用、删除矩阵、匿名内容、引用与周刊快照、云文件结果、失败后保留主账号、分页及幂等重试，以及前端确认和本机清理流程。
- 发布前运行 `npm run check:quality`、`npm run build:app`；涉及微信端的本次设置页流程应同时运行 `npm run build:mp-weixin`。测试和构建结果以本次执行记录为准，自动测试不能代替真机验证。

### 本次本地结果（2026-10-13）

- `npm run test:cancel-account` 通过，包含 1105 条帖子与图片的分页清理、可信运行时 OCR 归属、文件删除异常、权限与密码、反馈和引用副本、重试计数及设置页流程。
- `npm run build:app`、`npm run build:mp-weixin`（含包体检查）、`npm run build:h5` 通过。
- `npm run check:quality` 未整体通过：现有 `scripts/test-app-update.cjs` 固定断言版本 `1.7.2`，当前 `manifest.json` 为 `1.7.5`，该项失败。本次未改动版本设置或放宽该断言；其余质量检查项目分别执行并通过。
- 未部署云函数、未发布客户端，未执行真实账号删除，尚未进行真机验收。
