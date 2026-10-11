# 内容审核开关与接入

## 当前状态

本地代码已接入腾讯云文本内容安全（TMS）和图片内容安全（IMS）。**未部署任何云函数**。生产环境仍运行原有直接放行版本。`CONTENT_MODERATION_MODE` 未设置或不是精确的 `enforce` 时，新版也直接放行，而且不调用腾讯云审核 API。

## 快速切换（首次部署全部六个函数之后）

在腾讯云 CloudBase 控制台，打开 `contentCheck` 云函数的环境变量：

| 环境变量 | 值 | 行为 |
| --- | --- | --- |
| `CONTENT_MODERATION_MODE` | `off`（或不设置） | 直接放行，不产生 TMS/IMS 调用 |
| `CONTENT_MODERATION_MODE` | `enforce` | 发帖、编辑、评论和拼贴图上传前调用 TMS/IMS；`Review`、`Block` 或接口故障均阻止写入 |

修改环境变量后，按控制台提示保存并等配置生效，再用测试账号实际发一条文本和图片验证；无需改代码或重新打包 App。若套餐尚未购买/余额不足，保持 `off`。不要把密钥写入仓库或 `config.json`。

启用 `enforce` 还需为 `contentCheck` 云函数配置 `TENCENT_SECRET_ID`、`TENCENT_SECRET_KEY`；可选 `TENCENT_MODERATION_REGION`（默认 `ap-guangzhou`）、`TENCENT_TMS_BIZ_TYPE`、`TENCENT_IMS_BIZ_TYPE`。使用权限最小化的子账号密钥，确保已开通文本与图片内容安全，并检查计费/余额。`Review` 目前只返回待人工复核提示，没有人工复核队列；正式启用前应制定人工处理办法。

## 首次部署顺序（以后由负责人执行）

先部署 `contentCheck`，确认其 `off` 响应和依赖安装成功；然后部署 `createPost`、`createDiscussionPost`、`addComment`、`updatePostContent`、`uploadCollagePoetry` 五个写入口。全部部署后再考虑切到 `enforce`。只更新 `contentCheck` 不会保护其余直接写入口；只更新写入口而未更新 `contentCheck` 则沿用旧版放行逻辑。部署时须以实际 CloudBase 环境与已有函数配置为准，避免覆盖线上私有环境变量。

开发时运行 `npm run test:moderation` 和 `npm run check:quality`。共享写入口门禁修改后运行 `node scripts/sync-moderation-gate.cjs`，确保五份部署包副本一致。

本地 `npm audit --omit=dev` 在云函数现有 `wx-server-sdk` 依赖链及腾讯 SDK 公共依赖中报告安全公告。首次上线前需按实际依赖版本处理并复测；不要直接运行可能降级 `wx-server-sdk` 的 `npm audit fix --force`。

## 边界

本开关只控制已接入的用户发布/编辑入口，并非全站所有可写字段的审核。用户资料、反馈和其它自由文本入口仍需单独评估。切换前检查实际线上入口与回归结果。控制台环境变量切换不是已经完成的线上启用证据，安全评估报告须按实际部署和测试结果填写。
