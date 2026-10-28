# 内容审核开关与接入

## 当前状态

已接入腾讯云文本内容安全（TMS）和图片内容安全（IMS），并实现被拦截内容的管理员二次复核，复核与举报共用「举报与复核」管理页。2026-10-11 已部署九个相关云函数，复核集合统一为用户已创建的单数 `moderation_review`，禁止客户端直接读写，并建立 `status` + `createTime`（降序）及 `submitterOpenid` 索引。**客户端尚未发布，尚未完成 App／微信小程序真机验收**。`CONTENT_MODERATION_MODE` 未设置或不是精确的 `enforce` 时，新版仍直接放行，不调用腾讯云审核 API。

同日云端隔离联调确认：发帖、兼容发帖、讨论帖、评论、回复及编辑拦截保存了七条 `pending` 记录；相同评论重试去重，待复核内容未写入公开集合。九张图片按三张一批审核通过，第三批图片下载失败保持拦截且不入人工队列。联调记录、用户、帖子、评论和九张图片已清理，通知配置已恢复。自动审核与复核测试通过；全量 `check:quality` 被现有 App 版本配置 `1.7.5` 与测试预期 `1.7.2` 不一致阻断。

## 快速切换（完整复核链路部署并发布客户端之后）

在腾讯云 CloudBase 控制台，打开 `contentCheck` 云函数的环境变量：

| 环境变量 | 值 | 行为 |
| --- | --- | --- |
| `CONTENT_MODERATION_MODE` | `off`（或不设置） | 直接放行，不产生 TMS/IMS 调用 |
| `CONTENT_MODERATION_MODE` | `enforce` | 发帖、编辑、评论和拼贴图上传前调用 TMS/IMS；`Review`、`Block` 阻止公开写入并进入管理员复核，接口故障保持失败 |

修改环境变量后，按控制台提示保存并等配置生效，再用测试账号实际发一条文本和图片验证；无需改代码或重新打包 App。若套餐尚未购买/余额不足，保持 `off`。不要把密钥写入仓库或 `config.json`。

启用 `enforce` 还需为 `contentCheck` 云函数配置 `TENCENT_SECRET_ID`、`TENCENT_SECRET_KEY`；可选 `TENCENT_MODERATION_REGION`（默认 `ap-guangzhou`）、`TENCENT_TMS_BIZ_TYPE`、`TENCENT_IMS_BIZ_TYPE`。使用权限最小化的子账号密钥，确保已开通文本与图片内容安全，并检查计费/余额。正式启用前应安排管理员处理「拦截复核」队列，并确认消息通知可达。

## 首次部署顺序（以后由负责人执行）

使用单数 `moderation_review` 集合，已有集合无需改名或重建；禁止客户端直接读写，建立 `status` + `createTime`（降序）及 `submitterOpenid` 索引。保留现有 `post_reports` 和 `messages` 集合，并检查消息查询的 `toUserId` + `type` + `createTime`（降序）索引。

保持 `off`，先同步共享模块并部署 `contentCheck`，确认其 `off` 响应和依赖安装成功；然后部署 `createPost`、`createDiscussionPost`、`addComment`、`updatePostContent`、`uploadCollagePoetry` 五个写入口，再部署 `adminManager`、`getMessages` 和 `cancelAccount`。必须上传完整函数目录（含 `_lib`）并安装依赖。`contentCheck` 同时包含诗歌发布入口，六个入口都依赖共享复核模块；`cancelAccount` 负责注销时清除私人复核记录。

发布新版客户端，确认「举报与复核」入口、待复核预览和消息「复核」筛选；最后再切到 `enforce`。只更新 `contentCheck` 不会保护其余直接写入口；只更新写入口而未更新 `contentCheck` 则沿用旧版放行逻辑；遗漏 `adminManager` 会使队列无法处理。部署时须以实际 CloudBase 环境与已有函数配置为准，避免覆盖线上私有环境变量。详细流程见 [举报与拦截内容复核](../../docs/features/post-report.md)。

开发时运行 `npm run test:moderation` 和 `npm run check:quality`。共享门禁或复核模块修改后运行 `node scripts/sync-moderation-gate.cjs`，确保六个入口及 `adminManager` 的部署包副本一致。客户端变更后编译 App 和微信小程序。上线后以测试账号核查 Review／Block 的文本与图片、通过／拒绝、评论和编辑、原帖变更冲突、重复审批、非管理员直接访问；未完成真机验证时必须如实记录。

生产联调可临时在被测写入口设置服务器环境变量 `MODERATION_REVIEW_NOTIFY_ADMINS=false`，防止隔离测试数据向真实管理员发送消息；不能通过客户端参数设置。完成后恢复原值。默认仍通知管理员，入库和通知在同一事务中完成。

本地 `npm audit --omit=dev` 在云函数现有 `wx-server-sdk` 依赖链及腾讯 SDK 公共依赖中报告安全公告。首次上线前需按实际依赖版本处理并复测；不要直接运行可能降级 `wx-server-sdk` 的 `npm audit fix --force`。

## 边界

本开关只控制已接入的用户发布/编辑入口，并非全站所有可写字段的审核。用户资料、反馈和其它自由文本入口仍需单独评估。切换前检查实际线上入口与回归结果。控制台环境变量切换不是已经完成的线上启用证据，安全评估报告须按实际部署和测试结果填写。
