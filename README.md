# 回车键 (poementer) - 诗歌创作与分享平台

<div align="center">

![回车键](https://img.shields.io/badge/回车键-诗歌平台-blue)
![uni-app](https://img.shields.io/badge/uni--app-Vue3-green)
![CloudBase](https://img.shields.io/badge/CloudBase-腾讯云-orange)
![多平台](https://img.shields.io/badge/多平台-小程序%20H5%20App-Harmony-purple)

一个优雅的诗歌创作、分享与交流平台，支持微信小程序 / H5 / App / 鸿蒙多端运行

[功能特性](#-功能特性) • [技术架构](#-技术架构) • [快速开始](#-快速开始) • [项目结构](#-项目结构) • [部署指南](#-部署指南)

</div>

## 📖 项目简介

**回车键**是一个专注于诗歌创作与分享的社交平台，为用户提供优雅的创作环境和丰富的互动内容。项目基于 uni-app（Vue 3）开发，后端使用腾讯云开发（CloudBase：云函数 + 云数据库 + 云存储），内置可离线加载的「汇文明朝」衬线字体，营造沉浸式阅读与创作氛围。

### 🌟 核心特色

- **诗意界面**：全自定义导航与卡片式诗卡设计，亮色/暗色主题自适应，内置衬线字体
- **多端同步**：一次开发多端运行（微信小程序 / H5 / App / HarmonyOS）
- **周刊与活动**：诗歌周刊（特辑 / 热榜 / 主题征稿）、线上活动（投稿 / 排行榜）、活动公告轮播
- **管理后台**：内置 `pages-admin` 管理分包（内容管理、诗人管理、周刊管理、活动管理、反馈处理等）
- **高性能缓存**：统一缓存系统（LRU + TTL + SWR + 事件驱动失效 + 云端临时 URL 批量转换）
- **自定义 TabBar**：跨端自定义底部导航，支持未读/活动红点

## ✨ 功能特性

### 🎨 创作功能
- **诗歌创作**：发布单篇/组诗，自定义背景色、文字颜色，支持发布后编辑
- **拼贴诗**：图片上传、裁剪与拼贴诗歌合成（`pages-collage` 分包）
- **组诗合成**：将多首单篇诗歌合成为组诗作品
- **草稿箱**：本地草稿自动保存与恢复
- **匿名发布**：单篇匿名开关与整包匿名策略

### 📚 周刊与活动
- **诗歌周刊**：当期封面 + 精选特辑（支持管理员手动配置精选期刊与排序）、本周热榜、主题征稿与主题精选
- **周刊管理**：后台维护期刊（标题 / 封面图 3:4 / 周期 / 首页轮播 / 精选诗歌勾选 / 热榜生成 / 发布 / 隐藏）
- **线上活动**：活动创建与编辑、活动帖子聚合页、公告轮播图（16:7 裁剪）
- **发布即排序**：周刊按发布时间倒序自动置顶，无需手动权重

### 📱 社交互动
- **广场与发现**：广场（动态讨论）/ 原创（路）/ 读诗（山）三页 + 诗人头像筛选栏
- **点赞评论**：完整的点赞（分级图标、乐观更新、跨页状态同步）与评论（含图片、回复）体系
- **关注系统**：关注作者、关注动态流、粉丝列表
- **消息中心**：点赞 / 评论 / 关注 / 系统消息
- **长按复制**：详情页正文等文字支持长按选择复制

### 👤 用户系统
- **多种登录**：微信登录、账号密码、手机号验证码、GitHub OAuth
- **个人主页**：背景图、成长统计、签名图、作品与作品集展示
- **作品集管理**：个人作品集 / 文件夹分类 / 收藏夹
- **诗人主页**：汇总诗人在平台内的历史精选与作品

### 🛠 管理后台（pages-admin）
- 帖子 / 诗人 / 用户管理、批量字段替换、密码找回
- 周刊管理（期刊 + 主题 + 精选配置）
- 活动管理（活动 + 公告 + 帖子聚合）
- 反馈处理与内容审核

## 🏗 技术架构

```
┌──────────────────────────────────────────────────────┐
│           前端层（uni-app · Vue 3 + Vite）             │
│  微信小程序 | H5 | App | HarmonyOS + 自定义 TabBar     │
│  统一缓存系统（LRU + TTL + SWR） · api-cache 接口层    │
│  字体管理(汇文明朝) · 主题系统 · 事件驱动缓存失效       │
└──────────────────────────────────────────────────────┘
                        ↕ 云端调用
┌──────────────────────────────────────────────────────┐
│          云开发层（Tencent CloudBase）                 │
│  云函数 90+（Node.js + wx-server-sdk）                │
│   用户/登录 · 内容/列表/搜索 · 点赞/评论/关注/消息     │
│   周刊/活动/管理后台(adminManager) · 拼贴 · 上传       │
│  云数据库（users/posts/comments/weekly_*/activities…）│
│  云存储（头像/诗图/封面/公告图/拼贴素材/字体包）        │
└──────────────────────────────────────────────────────┘
```

### 前端技术栈
- **框架**：uni-app 3.x（Vue 3.4 + Vite 5），`vue2tovue3.md` / `vue3 dcloud文档.md` 记录了迁移说明
- **状态管理**：全局 `globalData` + 本地存储 + 少量 Pinia/Vuex 兼容依赖
- **样式**：rpx 响应式 + CSS 变量主题系统（`utils/theme.js`），条件编译适配多端
- **缓存系统**：`cache/`（核心管理器）+ `api-cache/`（业务接口缓存层）
- **字体系统**：`fontManager` 提供跨端加载入口；App 的汇文明朝由独立 `appFontLoader` 加载包内字体并按页面注册，模块拆分已通过用户真机验证。修改前阅读[字体模块约定](docs/app-font-contract.md)，平台差异见[字体系统指南](docs/features/FONT_SYSTEM.md)
- **运行时**：`utils/runtime-bootstrap.js` 统一初始化 TCB / wx.cloud，注入 openid 与全局事件

### 后端技术栈
- **云函数**：Node.js + `wx-server-sdk`，90+ 函数按业务拆分；`adminManager` 承担大部分后台管理聚合
- **调用封装**：`utils/cloudCall.js` + `api-cache/*` 提供统一鉴权、错误提示与缓存策略
- **文件**：上传兼容层 `utils/upload-compat.js`，cloud:// 临时 URL 统一由 `file-url` 缓存转换
- **AI 推荐**：推荐相关云函数与流水线当前已停用（见 `docs/features/AI_RECOMMENDATION_DISABLED.md`）

## 🚀 快速开始

### 环境要求
- Node.js >= 16
- HBuilderX 或微信开发者工具（小程序预览）
- 腾讯云开发环境（微信小程序云开发环境亦可）

### 安装与运行

```bash
npm install

# H5 开发
npm run dev:h5

# 微信小程序（产物在 dist/dev/mp-weixin，用微信开发者工具打开）
npm run dev:mp-weixin

# App 开发
npm run dev:app
```

或用 HBuilderX 直接打开项目 → 运行到对应平台。

### 云函数部署（tcb CLI）

```bash
# 安装并登录 CloudBase CLI
npm install -g @cloudbase/cli
tcb login

# 按 cloudbaserc.json 部署全部/单个云函数
tcb fn deploy adminManager --force -e <envId>
tcb fn deploy getWeeklyContent --force -e <envId>

# 或按 cloudbaserc.json 的 framework 插件一次部署
tcb framework deploy
```

> 小程序端若使用微信云开发，可直接在微信开发者工具中右键「云函数目录 → 上传并部署」。

### 环境配置
- 小程序 appid 与云环境 ID 见 `manifest.json` / `project.config.json`
- `cloudbaserc.json` 中 `envId` 为 CLI 部署目标环境，`functions` 与 `framework.plugins.functions` 列出全部云函数（含内存、超时、运行时配置）
- 管理员通过「诗歌 ID（poemId）」授权（`adminManager` + `checkAdmin`）

## 📁 项目结构

```
回车键_uni/
├── pages/                  # 主包页面（4 个主 Tab + 基础页）
│   ├── index/              # 广场（动态/讨论流）
│   ├── poem-square/        # 原创（路）
│   ├── mountain/           # 读诗（山，诗人筛选）
│   ├── profile/            # 我（湖，个人主页）
│   ├── post-detail/        # 诗歌/帖子详情（含评论、分享卡片）
│   ├── add/ · font-manager/# 发布入口残留页、字体管理
│   ├── login/register/auth # 登录/注册/OAuth 回调
│   └── splash/             # 开屏
│
├── pages-user/             # 分包：用户相关
│   └── user-profile · poet-profile · profile-edit ·
│       following · fans · blocked-users · my-likes
│
├── pages-content/          # 分包：内容与社区
│   ├── weekly-home/        # 周刊首页（当期大图 + 往期精选 + 热榜 + 主题）
│   ├── weekly-selection*   # 特辑列表/详情（诗卡堆叠浏览）
│   ├── weekly-ranking/     # 本周热榜（诗广场同款卡片）
│   ├── weekly-topic-*      # 主题投稿/主题详情
│   ├── activity-list/      # 全部活动（公告轮播 + 分类 + 活动卡片）
│   ├── activity-detail/    # 活动详情
│   └── favorite-* / portfolio* / draft-box
│
├── pages-tools/            # 分包：搜索/消息/反馈/图片管理/创建讨论
├── pages-collage/          # 分包：拼贴诗（主页/广场/上传/合成）
├── pages-publish/          # 分包：发布（add / preview / series-compose）
├── pages-admin/            # 分包：管理后台（管理员 poemId 鉴权）
│   ├── weekly-management/  # 周刊管理（期刊/主题/精选设置，含裁剪页）
│   ├── activity-management · activity-editor · activity-notice-management
│   ├── admin-posts · admin-list · poet-management · feedback-list
│   └── password-recovery · notice-cropper
├── pages-debug/            # 分包：仅测试用调试页
│
├── components/             # 44 个业务组件
│   ├── poem/PoemCard.vue   # 诗卡（广场/读诗/热榜通用）
│   ├── weekly/*            # 周刊详情视图/操作栏/分享卡组件
│   ├── activity/*          # 活动分类栏/公告轮播/活动卡片
│   ├── top-bar/ · custom-tab-bar/ · skeleton/ · mp-html …
│
├── cache/                  # 统一缓存系统
│   ├── core/               # manager(LRU+TTL+SWR) · file-url · hydrate
│   └── stores/             # 头像/签名/关注/点赞状态/徽标等
├── api-cache/              # 接口层（含 weekly/activities/admin-weekly 等）
├── _utils/ · mixins/       # 兼容入口 / 混入
├── utils/                  # runtime-bootstrap · theme · fontManager ·
│                           # cloudCall · uploader · likeService · poemDisplay …
│
├── functions/              # 云函数 90+（见 cloudbaserc.json 完整清单）
│   ├── adminManager/       # 后台聚合（周刊/活动/公告/帖子/诗人管理）
│   ├── getWeeklyContent/   # 周刊内容聚合（首页/特辑/主题/热榜）
│   ├── getRecentActivities/# 活动列表
│   ├── vote · addComment · follow · getMessages · searchPosts …
│
├── uni_modules/            # uni-app 官方扩展（表单、日期、上传、升级弹窗等）
├── static/fonts|images/    # 内置字体与静态资源
├── docs/                   # 架构/部署/功能/编码规范等文档
│
├── pages.json              # 页面/分包/预加载/TabBar 配置
├── manifest.json           # 应用配置（App 打包、权限、scheme: poementer）
├── cloudbaserc.json        # 云函数清单与部署配置
├── envList.js · index.html · vite.config.js · transform.js
└── package.json            # npm scripts（dev/build 各平台 + 质量检查）
```

## 📊 主要数据集合

| 集合 | 用途 |
| --- | --- |
| `users` | 用户资料、poemId、背景图、成长统计 |
| `posts` | 帖子/诗歌（含标题、内容、背景色、作者快照） |
| `comments` / `votes_log` | 评论（支持图片/回复）/ 点赞记录 |
| `messages` | 站内消息（点赞/评论/关注/系统） |
| `follows` / `favorites` / `portfolios` | 关注 / 收藏夹 / 作品集 |
| `activities` / `activity_notices` | 活动 / 活动公告（轮播图） |
| `weekly_issues` / `weekly_topics` | 周刊期刊 / 周刊主题 |
| `weekly_configs` | 周刊全局配置（精选期刊 ID 有序列表） |
| `weekly_issue_views` | 周刊期刊浏览计数 |
| `adminConfig` | 管理员 poemId 配置 |
| `feedback` / `view_log` 等 | 反馈 / 浏览记录 |

## 🔧 常用开发约定

- 业务接口统一封装在 `api-cache/*`，内部走 `utils/cloudCall.js`（云函数调用 + 缓存 + 兜底错误提示）
- 列表接口普遍采用 **缓存命名空间 + SWR**：先返回缓存，后台静默更新（`cache/core/manager.js` 的 `getOrFetch`）
- cloud:// 文件 ID 显示前用 `fileUrlCache.getTempUrl(s)` 转临时链接；云端批量返回的列表用 `hydrateTempUrls`
- 点赞状态跨页同步：`utils/likeStatusSync.js` + 全局 `like-changed` 事件 + 乐观更新（`togglePostLike`）
- 页面结构：`template → script → style`，样式统一使用 CSS 变量主题（`--app-*`），支持暗色模式
- 多端差异使用条件编译 `#ifdef MP-WEIXIN / H5 / APP-PLUS / APP-HARMONY`
- 运行质量检查：`npm run check:quality`（编码 + 语法扫描）

## 📚 文档索引

- [系统架构](./docs/ARCHITECTURE.md)（旧版见 `docs/ARCHITECTURE.legacy.md`）
- [数据库设计](./docs/deployment/database-schema-improved.md)
- [缓存系统](./cache/README.md)
- [字体系统](./docs/features/FONT_SYSTEM.md) 与 `小程序字体配置说明.md`
- [GitHub 登录接入](./docs/features/GITHUB_AUTH_GUIDE.md)
- [管理后台部署与使用](./docs/deployment/admin-deployment-checklist.md) / [管理功能指南](./docs/features/admin-feature-guide.md)
- [AI 推荐停用说明](./docs/features/AI_RECOMMENDATION_DISABLED.md)
- [代码风格](./docs/general-code-style-guide.md) / [活动模块风格](./docs/activity-code-style-guide.md)
- [乱码与编码规范](./docs/encoding-and-mojibake-guide.md)
- [无损失回归检查清单](./docs/no-loss-regression-checklist.md)

## 🗺 路线图

### 已完成
- ✅ 基础用户系统（微信/密码/验证码/GitHub 登录、资料、背景图）
- ✅ 创作发布（单篇/组诗/拼贴、草稿、匿名、图片上传与裁剪）
- ✅ 诗歌周刊（当期/往期精选/热榜/主题 + 后台管理 + 封面 3:4 上传 + 精选期刊配置）
- ✅ 线上活动与公告轮播、活动聚合页
- ✅ 管理后台（帖子/诗人/周刊/活动/公告/反馈）
- ✅ 社交互动（点赞分级图标、评论图片、关注、消息）
- ✅ 统一缓存与 SWR 接口层、多端适配、内置字体

### 进行中 / 计划中
- 🚧 内容审核流程完善
- 📋 商城 / 出版模块（活动 Tab 中已有占位入口）
- 📋 更多字体与主题、国际化

---

<div align="center">

**让诗歌在指尖流淌，让创意在云端绽放**

</div>
