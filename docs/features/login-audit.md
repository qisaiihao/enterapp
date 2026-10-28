# 用户登录日志

登录日志保存在腾讯云开发数据库的 `login_logs` 集合，直接在云开发控制台查看，无新增管理页面和客户端查询接口。

## 记录时机

服务器完成账号认证、取得真实 `users` 记录后，必须成功写入一条日志才返回登录成功。覆盖：

| 入口 | loginMethod |
| --- | --- |
| `loginWithCredentials`，包括旧版本 Poem ID 密码请求 | `password` |
| `loginWithPhone` | `sms` |
| `loginWithWechat`，含首次创建微信账号 | `wechat` |
| `registerUser`，注册后自动登录 | `register` |
| `github-auth`，已注册账号 OAuth 回调 | `github` |
| 独立网站 `webReader` 的 `login` 操作 | `password` |

`login` 云函数仅初始化云端身份，匿名身份初始化、启动时恢复本地登录态、浏览页面、绑定微信和登录验证失败均不会生成账号登录日志。既有登录日志不会补造。

日志写入失败返回 `LOGIN_AUDIT_UNAVAILABLE`，不返回用户登录信息。短信验证码在认证成功时已经消费，需重新获取后重试；注册账号已保存时会明确提示用账号密码重试登录。云函数输出固定的 `[login-audit] LOGIN_AUDIT_UNAVAILABLE`，可据此配置云端告警；不输出数据库原始异常。

## 数据字段

| 字段 | 含义 |
| --- | --- |
| `schemaVersion` | 当前为 `1` |
| `userId` | 认证成功的 `users._id`，不能由客户端指定 |
| `userOpenid` | 账号的内容归属标识 `_openid`，微信绑定账号可能不同于当前调用微信身份 |
| `poemId` | 登录时的 Poem ID 快照，便于控制台搜索 |
| `loginTime` | 服务器产生的数据库日期；按控制台显示时区查看，必要时换算为北京时间 |
| `loginMethod` | 服务器确定的登录方式 |
| `clientInfo.platform` | `app`、`app-harmony`、`mp-weixin`、`h5` 或 `unknown` |
| `clientInfo.os` / `osVersion` | 操作系统及版本 |
| `clientInfo.deviceModel` / `deviceBrand` | 设备型号及品牌，环境不提供时为空 |
| `clientInfo.appVersion` / `appVersionCode` / `sdkVersion` | 应用和运行时版本 |
| `clientInfo.userAgent` | 浏览器或 WebView 用户代理，最多 512 字符 |
| `clientInfoSource` | `client_reported`；端和设备信息属于客户端自报，不当作可信身份或网络证据 |
| `cloudSource` | 云平台提供的请求来源，未提供时为空 |
| `network.clientIp` | 云平台提供并经 IPv4/IPv6 格式验证的 IP；未提供时为 `null` |
| `network.sourcePort` | 同一可信来源提供的客户端源端口，范围 1–65535；未提供时为 `null` |
| `network.ipSource` / `portSource` | 对应网络字段的来源，缺失为 `unavailable` |
| `requestId` | 云函数请求 ID，云平台未提供时为空 |

仅写入上述白名单，不保存密码、密码哈希、验证码、OAuth token、手机号、MAC、设备唯一标识、完整客户端请求、请求头或完整运行时上下文。

IP 来自 `getWXContext()`、云函数的第二个 `context` 参数及运行时环境中的 `WX_CLIENTIP`、`WX_CLIENTIPV6`、`TCB_SOURCE_IP`，支持 CloudBase 新旧运行时上下文格式。不会接受客户端传来的 IP、端口、`context` 或 `x-forwarded-for` 请求头。端口仅在可信来源实际提供 `CLIENTPORT` / `WX_CLIENTPORT` / `TCB_SOURCE_PORT` 时记录；现有 SDK 的公开上下文字段没有承诺提供源端口，无法取得时保留 `null`，不会用服务端 HTTPS 443 代替。

SDK 依据：[微信云开发 getWXContext 类型定义](https://github.com/wechat-miniprogram/wx-server-sdk/blob/master/index.d.ts)、[CloudBase 服务端客户端 IP 接口](https://docs.cloudbase.net/api-reference/server/node-sdk/auth)、[CloudBase 上下文解析源码](https://github.com/TencentCloudBase/node-sdk/blob/master/src/cloudbase.ts)。

旧客户端仍能登录，但尚未发送端信息的客户端显示 `platform: unknown`；GitHub 现有 OAuth 流程没有可信的原客户端元数据，也保留 `unknown`。发布新客户端后，App、小程序、主 H5 和独立网站的端信息开始完整上报。

## 云开发部署与查询

1. 在环境 `cloud1-5gb0pbyl400845f5` 创建 `login_logs` 集合，权限设为「仅管理员可读写」（`ADMINONLY`），禁止客户端直接读取或写入。
2. 建议索引：`loginTime` 降序、`userId` + `loginTime` 降序、`poemId` + `loginTime` 降序、`clientInfo.platform` + `loginTime` 降序。索引按实际查询需要建立，不覆盖既有数据。
3. 执行 `npm run sync:login-audit`，部署上表中的六个云函数。共享模块必须随每个函数一起打包为 `_lib/login-audit.js`，不可只上传 `index.js`。保持线上运行时、依赖、触发器及私有环境变量。
4. 从现有客户端成功登录一次，在云开发控制台打开 `login_logs`，按 `loginTime` 降序查看，并按 `poemId` / `userId` 搜索。新客户端发布后，再检查端、设备及版本字段。
5. 云开发控制台可按日期区间筛选和导出所需日志；集合保持服务端写入、控制台管理查询，不开放普通用户查询 API。

本实现不定时清理登录日志。账号注销后仍保留 `login_logs`，用于安全审计和网安备案；注销流程不删除、改写或匿名化既有登录日志。该集合继续保持「仅管理员可读写」（`ADMINONLY`），仅供授权管理员在腾讯云后台查询，普通客户端不可访问。保留时间、备份与导出安排另行配置，本功能不设自动清理期限；不能把已经登录的本地会话恢复计作一次新认证。

## 验证

`npm run test:login-audit` 检查共享模块副本、真实登录入口、认证失败不记日志、日志故障不放行、账号和时间不可伪造、字段白名单、IP/端口校验及旧客户端兼容。`npm run test:login` 包含客户端信息采集和既有登录回归。独立网站运行 `npm run check:quality` 验证网站登录与日志。

云端部署状态、隔离联调和客户端发布状态以交付记录为准；本地测试和构建不能代替真机登录验收。

## 2026-10-13 交付记录

- 已在上述腾讯云环境创建 `login_logs`，设置 `ADMINONLY` 并建立四个建议索引；六个云函数的最新审计模块已增量部署并下载源包复核。其余源文件、依赖、运行时、超时、内存、环境变量和触发器均保持部署前的值。
- 独立网站本地与线上此前存在 posts 包装差异。本次以已备份的线上代码为基线加入日志；没有顺带上线该包装。数据库写入已分别适配 `wx-server-sdk` 的 `{ data: row }` 和 GitHub 所用 `@cloudbase/node-sdk` 的直接 `row` 格式。
- 云端隔离验证通过：旧客户端格式的密码登录恰好一条日志、错误密码无日志、真实网页登录能取得平台与可信 IP、普通客户端直接读写返回 `DATABASE_PERMISSION_DENIED`、CloudBase Node SDK 直接写入分支生成正确的顶层字段；测试账号和测试日志已清理。本次真实网页请求的源端口未提供，保存 `null`。
- `npm run test:login`（含全部审计和 GitHub 回调用例）、编码和语法检查、独立网站 26 项测试及构建、主 H5 / 微信小程序 / App 构建均通过。全量 `check:quality` 曾停在既有 `test-app-update`：工作区 `manifest.versionName` 为 `1.7.5`，测试固定期望 `1.7.2`；没有为本任务改变版本或放宽断言。后续其余检查已单独通过，账号注销测试在工作区现有修改完成后也已通过。
- 客户端和网站静态资源尚未发布，真机登录验证未完成；发布新版后才会完整取得端、系统与应用版本字段。未发送这些字段的旧客户端仍正常记录账号、服务器时间和平台能够提供的网络字段。

线上源码备份及部署哈希见 `outputs/login-audit-20261013/cloud-before`、`deployment-state.json`；隔离验证结果见 `live-verification.json`。回滚只需从对应源码备份恢复这六个函数的 `index.js`，审计模块可保留为未使用文件；不要删除已有的真实登录日志或将集合权限开放给客户端。

## 2026-10-14 注销后保留规则

用户确认注销后仍保留备案登录日志。本地 `cancelAccount` 已将 `login_logs` 排除出注销清理，注销成功提示、设置页说明、隐私政策及相关文档同步明确该保留范围；隐私政策版本为 `2026-10-14`。日志中的账号快照、时间、客户端信息、IP 和源端口不因注销而删除、改写或匿名化。

已只读检查并备份线上 `cancelAccount`：现行入口及其自有辅助模块只清理明确列出的业务集合，不访问 `login_logs`，因此线上本已保留登录日志，本次无需更新云函数。线上与工作区的其它注销逻辑存在差异，未将这些其它改动顺带部署。证据见 `outputs/login-audit-retention-20261014/retention-evidence.json`。

注销回归覆盖完整日志逐字段保留、成功与重复注销、拒绝请求、部分失败重试，以及日志集合权限故障或缺失时仍不访问该集合；注销、登录审计、隐私门禁回归、编码和语法检查、App 与微信小程序构建均通过。客户端说明和新政策仍需发布，真机验收未完成；新政策发布后，持有旧同意版本的用户会重新确认。
