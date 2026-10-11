# 回车键项目文档索引

本文件是仓库文档的**唯一总入口**，按“现行文档”与“归档文档”分区。新增文档请放入对应目录，过期文档移入 `docs/archive/` 而不是直接删除。

---

## 🎯 核心文档（必读）

| 文档 | 说明 |
| --- | --- |
| [README.md](../README.md) | 项目总览：功能、技术栈、快速开始、项目结构 |
| [ARCHITECTURE.md](./ARCHITECTURE.md) | 维护版架构：分层边界、核心时序、缓存语义、质量门禁 |
| [AGENTS.md](../AGENTS.md) | 协作约束：诗歌卡片字体等强制约定与验收要求 |
| [项目开发约束](./app-font-contract.md) | App 诗歌卡片字体模块约定（改字体/生命周期/绘制前必读） |
| [app-overlay-contract.md](./app-overlay-contract.md) | 共用确认框与操作菜单约定 |
| [signature-background-contract.md](./signature-background-contract.md) | 签名上传与去纸底约定 |

---

## 📐 规范与流程

- [general-code-style-guide.md](./general-code-style-guide.md) - 全局码风指南（无损重构版）
- [activity-code-style-guide.md](./activity-code-style-guide.md) - 活动链路码风补充
- [encoding-and-mojibake-guide.md](./encoding-and-mojibake-guide.md) - 编码与乱码处理规范
- [refactor-commit-checklist.md](./refactor-commit-checklist.md) - 重构提交清单
- [no-loss-regression-checklist.md](./no-loss-regression-checklist.md) - 无损回归清单
- [layered-examples.md](./layered-examples.md) - 分层实现示例（页面 / API / 云函数）

---

## 🧩 功能文档（docs/features）

用户与账号：
- [account-password-login.md](./features/account-password-login.md) - 账号密码登录
- [account-cancellation.md](./features/account-cancellation.md) - 应用内注销账号
- [wechat-binding-login-2026-09-30.md](./features/wechat-binding-login-2026-09-30.md) - 微信绑定与登录梳理
- [微信绑定功能完整指南.md](./features/微信绑定功能完整指南.md) - 微信绑定完整指南
- [GITHUB_AUTH_GUIDE.md](./features/GITHUB_AUTH_GUIDE.md) - GitHub OAuth 登录完整指南
- [未登录访问优化.md](./features/未登录访问优化.md) - 未登录访问优化
- [privacy-consent.md](./features/privacy-consent.md) - 首启隐私政策确认

内容与发布：
- [post-publishing-refactor.md](./features/post-publishing-refactor.md) - 发帖功能重构
- [posts-field-slimming-plan.md](./features/posts-field-slimming-plan.md) - posts 新写入字段精简方案
- [post-report.md](./features/post-report.md) - 帖子举报与受理
- [anonymous-post-chain.md](./features/anonymous-post-chain.md) - 匿名帖子发布与显示链路
- [activity-text-submission-cards.md](./features/activity-text-submission-cards.md) - 活动纯文字投稿卡片
- [post-image-links-2026-09-29.md](./features/post-image-links-2026-09-29.md) - 帖子图片链接统一解析
- [posts-schema-v2-plan.md](./plans/posts-schema-v2-plan.md) - posts 字段精简与统一访问方案（整包更新）

周刊与首页：
- [WEEKLY_RANKING.md](./features/WEEKLY_RANKING.md) - 本周热榜
- [home-post-ranking.md](./features/home-post-ranking.md) - 首页默认筛选与排序

互动与体验：
- [favorite-consistency-2026-09-29.md](./features/favorite-consistency-2026-09-29.md) - 收藏一致性
- [avatar-cache-update-2026-09-29.md](./features/avatar-cache-update-2026-09-29.md) - 上传头像后即时刷新
- [feedback-conversation.md](./features/feedback-conversation.md) - 反馈沟通与办结
- [neutral-controls-2026-09-29.md](./features/neutral-controls-2026-09-29.md) - 黑白灰交互控件
- [splash-startup-2026-09-29.md](./features/splash-startup-2026-09-29.md) - 开屏与首屏预加载优化

字体与包体：
- [FONT_SYSTEM.md](./features/FONT_SYSTEM.md) - 字体系统指南
- [mp-weixin-font-config.md](./features/mp-weixin-font-config.md) - 小程序汇文明朝字体配置说明
- [MP_PACKAGE_SIZE.md](./features/MP_PACKAGE_SIZE.md) - 微信小程序包体积

管理后台：
- [admin-feature-guide.md](./features/admin-feature-guide.md) - 管理功能使用指南
- [admin-post-type-filter.md](./features/admin-post-type-filter.md) - 管理帖子类型筛选

更新与成本：
- [cloud-call-savings.md](./features/cloud-call-savings.md) - CloudBase 调用次数优化
- [app-update-simplification-plan.md](./features/app-update-simplification-plan.md) - App 整包更新与热更新梳理

拼贴诗：
- [collage-studio.md](./collage-studio.md) - 拼贴诗工作台：使用、部署与验收
- [collage-paper-effect.md](./collage-paper-effect.md) - 撕纸边缘实现与来源
- [拼贴诗制作工具可行性评估.md](./拼贴诗制作工具可行性评估.md) - 可行性评估

---

## 🗺 方案与决策（docs/plans）

- [统一缓存与一致性改造计划.md](./plans/统一缓存与一致性改造计划.md) - 缓存系统设计与实施计划
- [posts-schema-v2-plan.md](./plans/posts-schema-v2-plan.md) - posts 字段精简与统一访问方案
- [AI_RECOMMENDATION_DISABLED.md](./plans/AI_RECOMMENDATION_DISABLED.md) - AI 推荐算法停用说明

---

## 🚀 部署与运维（docs/deployment）

- [admin-deployment-checklist.md](./deployment/admin-deployment-checklist.md) - 管理功能部署清单
- [app-update-migration.md](./deployment/app-update-migration.md) - App 统一更新与旧版迁移发布说明
- [posts-v2-rollout.md](./deployment/posts-v2-rollout.md) - posts V2 双向兼容部署说明
- [database-schema-improved.md](./deployment/database-schema-improved.md) - 改进后的数据库结构设计
- [cors-config-guide.md](./deployment/cors-config-guide.md) - 云存储 CORS 配置指南
- [cors-quick-setup.md](./deployment/cors-quick-setup.md) - CORS 快速配置指南
- [subpackage-optimization.md](./deployment/subpackage-optimization.md) - 分包优化记录

---

## 🔒 合规与参考（docs/compliance、docs/reference）

- [compliance/poementer-security-assessment-draft.md](./compliance/poementer-security-assessment-draft.md) - 互联网信息服务安全自评估工作底稿
- [reference/wechat-content-moderation-api.md](./reference/wechat-content-moderation-api.md) - 微信文本/图片内容安全检测接口参考

---

## 📦 交付物（docs/deliverables）

软著与正式交付材料，作为归档保留，不再随代码演进维护：

- Vue3 迁移改造计划（md / html / pdf）
- 操作手册（md / html / pdf）
- 设计开发说明书（md / html / pdf）
- 源程序清单 / 页码清单 / 登记提交表
- [optimization-and-wechat-login-2026-09-29.md](./deliverables/optimization-and-wechat-login-2026-09-29.md)
- [project-logic-optimization-2026-09-28.md](./deliverables/project-logic-optimization-2026-09-28.md)

---

## 🗄 归档（docs/archive）

以下文档已过期或已完成使命，仅作追溯，**不再维护**：

- [项目开发总结.md](./archive/项目开发总结.md) - 早期开发问题与经验（Vue2 时代）
- [PERFORMANCE_OPTIMIZATION.md](./archive/PERFORMANCE_OPTIMIZATION.md) - 早期性能优化设想
- [code-review-2026-09-12.md](./archive/code-review-2026-09-12.md) - 项目逻辑检查记录
- [portfolio-investigation-2026-09-12.md](./archive/portfolio-investigation-2026-09-12.md) - 作品集问题排查
- [post-publish-classification-review-2026-09-07.md](./archive/post-publish-classification-review-2026-09-07.md) - 发布与错分区排查
- [登录方式适配检查报告.md](./archive/登录方式适配检查报告.md) - 登录方式适配检查
- [vue2tovue3.md](./archive/vue2tovue3.md) / [vue3-dcloud-migration-reference.md](./archive/vue3-dcloud-migration-reference.md) - Vue3 迁移参考
- [mp-font-loading-notes.md](./archive/mp-font-loading-notes.md) - 小程序字体加载研究笔记
- [TENCENT_SMS_MIGRATION_COMPLETE.md](./archive/TENCENT_SMS_MIGRATION_COMPLETE.md) - 腾讯云短信迁移完成记录

---

## 🛠 工程与模块文档（代码目录内）

- [cache/README.md](../cache/README.md) - 统一缓存系统
- [functions/README.md](../functions/README.md) - 云函数开发指南
- [functions/DATABASE_SETUP.md](../functions/DATABASE_SETUP.md) - 数据库初始化
- [api-cache/events.md](../api-cache/events.md) - 缓存事件系统
- [utils/shareHelper.example.md](../utils/shareHelper.example.md) - 分享助手示例
- [回车键新网站/README.md](../回车键新网站/README.md) / [DEPLOYMENT.md](../回车键新网站/DEPLOYMENT.md) - 官网独立项目

---

## 📝 维护约定

- 新增能力：在 `docs/features/` 建文档，并在此索引登记。
- 方案/决策：放入 `docs/plans/`。
- 部署步骤：放入 `docs/deployment/`。
- 过期内容：移入 `docs/archive/`，不直接删除，便于追溯。
- 模块强约定（字体、弹层、签名等）：放在 `docs/*-contract.md`，并在 `AGENTS.md` 中引用。

---

*最后更新: 2026-10-11*
