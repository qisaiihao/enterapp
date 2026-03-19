<div class="cover-page">
  <div class="cover-kicker">回车键 Poementer 软件</div>
  <h1>Vue2 -&gt; Vue3 迁移改造计划</h1>
  <p class="cover-subtitle">PDF 交付版 / 本轮仅交付迁移分析与实施计划，不改动应用运行时代码</p>
  <div class="cover-meta">
    <div><span>文档版本</span><strong>V1.0</strong></div>
    <div><span>编制日期</span><strong>2026-03-19</strong></div>
    <div><span>适用范围</span><strong>uni-app 现有多端项目（微信小程序 / H5 / App）</strong></div>
    <div><span>交付形式</span><strong>Markdown / HTML / PDF</strong></div>
  </div>
  <div class="cover-note">
    <p>说明：本文件用于指导后续 Vue2 到 Vue3 的实际迁移实施。</p>
    <p>本轮范围仅限分析、排期、风险与验收方案，不包含代码迁移补丁。</p>
  </div>
</div>

<!--PAGE_BREAK-->

## 1. 编制说明与交付边界

### 1.1 编制目的

本报告用于回答“当前仓库从 Vue2 迁移到 Vue3，哪些地方必须改、为什么改、先改哪里、如何验证”的问题，并形成一份可直接归档、可供后续实施使用的正式计划文档。

### 1.2 本轮交付范围

| 项目 | 本轮结论 |
| --- | --- |
| 交付目标 | 仅交付《Vue3 迁移改造计划》Markdown / HTML / PDF |
| 代码迁移 | 本轮不实施 |
| 业务功能改造 | 本轮不实施 |
| HarmonyOS 适配 | 不纳入本轮范围 |
| 前端架构方向 | 继续保留 Options API，不在本轮强制改 Composition API |
| 状态管理改造 | 不在本轮引入 Pinia / Vuex 重构 |
| 后端云函数 / 数据库 | 原则上不改，仅在联调暴露契约问题时再处理 |

### 1.3 交付物清单

| 交付物 | 路径 | 说明 |
| --- | --- | --- |
| 源文档 | `docs/deliverables/回车键Poementer软件-Vue3迁移改造计划.md` | 迁移分析与计划正文 |
| 中间文件 | `docs/deliverables/回车键Poementer软件-Vue3迁移改造计划.html` | 浏览与打印检查版 |
| 正式交付件 | `docs/deliverables/回车键Poementer软件-Vue3迁移改造计划.pdf` | 归档与发送版 |
| 导出脚本 | `scripts/export-vue3-migration-pdf.mjs` | 独立的 Markdown -> HTML -> PDF 导出链路 |

### 1.4 基线说明

1. 本报告基于 2026-03-19 对当前工作区进行静态扫描所得结论编写。
2. 统计时排除了 `node_modules`、`unpackage`、`.git` 与 `docs/deliverables` 目录中的生成产物。
3. 本轮执行严格限定在文档与导出脚本范围，不触碰 `App.vue`、`main.js`、`utils/runtime-*` 等业务运行时代码。

<!--PAGE_BREAK-->

## 2. 执行摘要

### 2.1 总体判断

当前项目具备迁移到 Vue3 的条件，但不能通过“仅修改 `manifest.json` 为 `vueVersion: "3"`”完成升级。核心原因不是页面数量多，而是启动链路、全局能力挂载、Vue2 响应式遗留写法和页面事件清理仍与 Vue2 运行机制强耦合。

### 2.2 一句话结论

- 真正的主风险在启动入口与页面响应式细节，不在云函数和数据库。
- 运行时切换前，必须先补齐 `main.js` 中 Vue3 分支的启动职责，收口 `App.vue` 的重复初始化。
- `this.$set`、`beforeDestroy`、`.sync` 这类 Vue2 语法遗留量不大，但属于必须处理项。
- `setData` 使用量很高，但由于 `uni_modules/zp-mixins` 已存在 Vue3 分支，本轮迁移可以先保留该方案，不必同步重写为 Composition API。
- `getApp().globalData` 依赖面较大，短期建议“收口”而不是“替换”。
- 迁移应采用分阶段推进：先切运行时，再清语法，再稳热点页面，最后做回归和清理。

### 2.3 迁移目标定义

本项目本轮 Vue3 迁移的成功标准不是“代码更现代”，而是以下四项同时成立：

1. 微信小程序、H5、App 三端均能正常启动。
2. 登录、首页、详情、发帖、个人中心、活动链路全部可回归。
3. Vue2 专属 API 已被清理到不会阻断 Vue3 运行。
4. 文档、测试清单和验收标准完整，便于后续实施与复盘。

<!--PAGE_BREAK-->

## 3. 仓库扫描方法与基线数据

### 3.1 关键扫描结论

| 维度 | 扫描结果 | 说明 |
| --- | --- | --- |
| `manifest.json` | `vueVersion: "2"` | 当前仍未切换到 Vue3 运行时 |
| 主入口 | `main.js` 同时含 `#ifndef VUE3` 与 `#ifdef VUE3` 分支 | 已存在 Vue3 启动骨架，但职责不等价 |
| `.vue` 文件数 | 120 | 为前端改造面提供量级判断 |
| `pages.json` 页面登记数 | 51 | 含 1 个 `uni-upgrade-center-app` 页面入口 |
| `setData(` 命中 | 592 处 / 42 个文件 | 迁移最大体量热点 |
| `this.$set` 命中 | 36 处 / 9 个文件 | Vue3 必改项 |
| `globalData` 命中 | 280 处 / 26 个文件 | 全局状态耦合明显 |
| `uni.$on` 命中 | 50 处 / 11 个文件 | 需要核对注册与解绑配对 |
| `uni.$off` 命中 | 22 处 / 9 个文件 | 存在解绑粒度不统一风险 |
| 自有 `beforeDestroy` | 2 处 | 位于 `components/FeedList.vue`、`components/top-bar/top-bar.vue` |
| 自有 `.sync` | 1 处 | 位于 `pages-user/user-profile/user-profile.vue` |
| 自有 `await uni.*` Promise 写法 | 未发现明显依赖 | Promise 化不是本项目首要风险 |

### 3.2 迁移含义解读

- Vue3 迁移不是“页面数量大导致困难”，而是“少数基础机制对运行时绑定很深”。
- 统计上最需要关注的是 `setData`、`globalData`、事件总线和入口初始化，而不是云函数目录。
- 自有代码中的 Vue2 生命周期和 `.sync` 规模有限，适合在第二阶段集中清理。

### 3.3 关键文件观察

| 文件 | 当前观察 | 迁移含义 |
| --- | --- | --- |
| `manifest.json` | 仍声明 Vue2 | 不切换则不会进入 Vue3 运行时 |
| `main.js` | Vue2 分支承担了完整启动职责，Vue3 分支偏骨架 | 需先做到功能等价 |
| `App.vue` | 重复做云初始化与全局挂载 | 需与 `main.js` 重新分责 |
| `uni_modules/zp-mixins/index.js` | 已有 `#ifdef VUE3` 分支 | `setData` 可先保留，不必本轮整体重构 |
| `uni_modules/zp-mixins/methods/setData.js` | 已实现 Vue3 兼容思路 | 说明迁移重点不在全面移除 `setData` |

<!--PAGE_BREAK-->

## 4. 热点分布与高风险模块

### 4.1 `setData` 热点页面

| 排名 | 文件 | 命中次数 | 迁移关注点 |
| --- | --- | ---: | --- |
| 1 | `pages/post-detail/post-detail.vue` | 61 | 评论区、回复区、点赞状态、局部刷新 |
| 2 | `pages/index/index.vue` | 56 | 首页列表、下拉刷新、点赞同步、红点联动 |
| 3 | `pages/profile/profile.vue` | 52 | 个人中心首页、关注数据、消息同步 |
| 4 | `pages-publish/add/add.vue` | 45 | 发帖表单、预览前状态、系列内容同步 |
| 5 | `pages-user/user-profile/user-profile.vue` | 39 | 时间轴、收藏页签、折叠状态 |
| 6 | `pages/poem-square/poem-square.vue` | 31 | 列表刷新与点赞回流 |
| 7 | `pages-tools/search/search.vue` | 26 | 搜索列表更新与结果切换 |
| 8 | `pages-user/profile-edit/profile-edit.vue` | 25 | 个人资料编辑回写 |
| 9 | `pages-content/portfolio-detail/portfolio-detail.vue` | 24 | 作品集详情与互动态同步 |
| 10 | `pages-user/poet-profile/poet-profile.vue` | 17 | 他人主页列表与关注态 |

### 4.2 `this.$set` 热点文件

| 文件 | 命中次数 | 建议处理 |
| --- | ---: | --- |
| `pages/post-detail/post-detail.vue` | 13 | 改为对象属性直接赋值 / 数组整体替换 |
| `pages-content/draft-box/draft-box.vue` | 5 | 草稿项更新改为新数组回写 |
| `pages-content/other-portfolio/other-portfolio.vue` | 3 | 列表局部状态字典直接赋值 |
| `pages-content/activity-detail/activity-detail.vue` | 3 | 活动帖子局部态直接赋值 |
| `pages-admin/activity-posts/activity-posts.vue` | 3 | 管理页状态字典改写 |
| `pages/font-manager/font-manager.vue` | 2 | 下载 loading 状态直接赋值 |
| `uni_modules/mp-html/**` | 6 | 三方模块版本核验，不在首轮自改 |
| `uni_modules/uni-table/**` | 1 | 三方模块版本核验，不在首轮自改 |

### 4.3 `globalData` 依赖最重文件

| 文件 | 命中次数 | 主要用途 |
| --- | ---: | --- |
| `pages/login/login.vue` | 43 | 登录态、openid、重定向信息 |
| `pages/splash/splash.vue` | 41 | 启动引导与自动登录状态 |
| `App.vue` | 41 | 全局会话、启动状态、登录编排 |
| `pages/profile/profile.vue` | 27 | 用户资料与关系链数据 |
| `main.js` | 21 | openid、预热与 badge 初始化 |
| `utils/auth.js` | 14 | 鉴权和登录辅助 |
| `utils/authHelper.js` | 11 | 登录帮助逻辑 |

### 4.4 高风险回归优先级

| 优先级 | 文件 / 模块 | 原因 |
| --- | --- | --- |
| P1 | `pages/index/index.vue` | 首屏、列表、点赞事件、TabBar 联动集中 |
| P1 | `pages/post-detail/post-detail.vue` | `setData` 和 `$set` 双高发，评论态复杂 |
| P1 | `pages/profile/profile.vue` | 用户态、红点、关系链联动多 |
| P1 | `pages/login/login.vue` | `globalData` 依赖最重，直接影响启动成功率 |
| P1 | `pages-publish/add/add.vue` | 发布链路状态量大，易出现局部失活 |
| P1 | `pages-user/user-profile/user-profile.vue` | `.sync`、时间轴、Tab 切换和列表加载都在此处汇合 |
| P2 | `pages/poem-square/poem-square.vue`、`pages/mountain/mountain.vue` | 列表刷新和事件总线密集 |
| P2 | `pages-content/activity-detail/activity-detail.vue`、`pages-content/other-portfolio/other-portfolio.vue`、`pages-content/draft-box/draft-box.vue` | 互动态和局部替换逻辑明显 |
| P3 | `components/FeedList.vue`、`components/top-bar/top-bar.vue`、`custom-tab-bar/index.vue` | 首屏共用组件，需优先联调 |

<!--PAGE_BREAK-->

## 5. 必须调整项详析

### 5.1 启动入口与初始化职责

当前 `main.js` 的 `#ifndef VUE3` 分支不仅负责创建应用，还承载了以下职责：

- 云开发初始化与 `$tcb` 注入；
- 小程序 `wx.cloud` 包装与 `uni.$tcb` 挂载；
- `openid` 兜底和 `$requireOpenid`；
- `fileUrlCache` resolver 注册；
- 缓存桥接 `setupCacheEventBridges()`；
- 未读红点、活动红点初始化；
- 登录完成后的资料预热。

而 `#ifdef VUE3` 分支目前只覆盖了其中一部分能力。结论是：切 Vue3 前，必须先把启动职责抽成单一 bootstrap 模块，再由 Vue3 入口复用，否则只会得到“能编译但功能不完整”的状态。

### 5.2 Vue2 全局 API 替换

根据 uni-app Vue3 配置方式，入口应切换到 `createSSRApp(App)`；根据 Vue 3 迁移指南，全局 API 不再围绕 `Vue` 构造函数展开，而是围绕应用实例展开。

因此必须处理：

| Vue2 写法 | Vue3 对应方向 | 本项目含义 |
| --- | --- | --- |
| `new Vue({...})` | `createSSRApp(App)` | 入口改造必做 |
| `Vue.prototype.xxx` | `app.config.globalProperties.xxx` | `$tcb`、`$requireOpenid` 等必须迁移 |
| `Vue.use(...)` | `app.use(...)` | 插件挂载方式统一调整 |
| `Vue.mixin(...)` | `app.mixin(...)` | 全局 mixin 挂载方式调整 |

### 5.3 Vue2 响应式遗留写法

Vue 3 已移除 `$set` / `$delete` 这类依赖旧响应式系统的 API。本项目自有代码中仍有 36 处 `this.$set`，必须处理；否则进入 Vue3 后会直接报错或行为异常。

推荐改法如下：

```js
// 旧写法
this.$set(this.votingInProgress, postId, true)

// Vue3 迁移写法
this.votingInProgress[postId] = true
```

```js
// 旧写法
this.$set(this.draftList, index, nextDraft)

// Vue3 迁移写法
const next = this.draftList.slice()
next[index] = nextDraft
this.draftList = next
```

### 5.4 生命周期与双向绑定

自有代码里的 `beforeDestroy` 需要改为 `beforeUnmount`；若后续发现 `destroyed`，对应改为 `unmounted`。当前自有 `.sync` 命中 1 处：`pages-user/user-profile/user-profile.vue` 中的 `:collapsedMonths.sync="collapsedMonths"`，应改为：

```html
<TimelineView v-model:collapsed-months="collapsedMonths" />
```

并保持子组件继续发出 `update:collapsed-months` 事件。

### 5.5 全局状态与事件总线

- `getApp().globalData` 目前分布 280 处，短期不建议强行替换成新状态库。
- 更稳妥的做法是新增一个轻量 helper，将会话信息、登录状态、openid、未读标记的读写统一收口。
- `uni.$on` / `uni.$off` 必须统一成“按 handler 注册、按同一个 handler 解绑”，避免页面卸载时误清空其他监听器或留下重复监听。

### 5.6 三方模块处理原则

`uni_modules/zp-mixins` 已显式包含 Vue3 条件分支，说明 `setData` 过渡方案可继续使用；但 `mp-html`、`uni-table`、`uni-forms` 等三方模块中仍能检索到 Vue2 生命周期痕迹，因此建议策略为：

1. 第一轮先不私自修改三方源码；
2. 先完成自有代码迁移与三端冒烟；
3. 仅在实机验证确认三方兼容问题后，再决定升级版本或局部补丁。

<!--PAGE_BREAK-->

## 6. 分阶段实施计划

### 6.1 阶段划分总表

| 阶段 | 目标 | 主要产出 | 退出条件 |
| --- | --- | --- | --- |
| 阶段 0 | 建立迁移基线 | 冻结范围、扫描结果、计划文档 | 变更边界清晰 |
| 阶段 1 | 切换运行时 | `manifest.json`、`main.js`、bootstrap 模块 | Vue3 可启动且功能等价 |
| 阶段 2 | 清理 Vue2 语法 | `$set`、生命周期、`.sync`、全局 API 替换 | 不再依赖 Vue2 专属 API |
| 阶段 3 | 稳定热点页面 | P1 / P2 页面逐页回归 | 主链路可用 |
| 阶段 4 | 收口全局状态与事件 | helper、事件解绑规范、冗余清理 | 启动与事件行为稳定 |
| 阶段 5 | 全量回归与清理 | 删除过时分支、补测试记录 | 可合并、可发布、可归档 |

### 6.2 阶段 1：先切运行时，不碰业务逻辑

1. 将 `manifest.json` 的 `vueVersion` 从 `2` 切换到 `3`。
2. 保留 `createSSRApp` 入口，补齐当前 Vue2 路径已有能力，做到功能等价后再删旧分支。
3. 将云开发初始化、`$tcb` 注入、`openid` 兜底、缓存桥接、badge 初始化、预热逻辑抽到单一 bootstrap 模块。
4. `App.vue` 只保留应用生命周期、登录编排、URL Scheme 处理和全局样式，不再承担 `Vue.prototype` 级职责。

### 6.3 阶段 2：清理 Vue2 语法遗留

1. 全量替换自有代码里的 `Vue.prototype`、`Vue.use`、`new Vue`。
2. 全量替换 `this.$set`；按对象、数组、字典三类场景分别改写。
3. 生命周期统一改名：`beforeDestroy -> beforeUnmount`，`destroyed -> unmounted`。
4. `.sync` 迁移到参数化 `v-model`。
5. 复核 watcher：凡是依赖数组 / 对象内部变更的，明确补 `deep: true`。

### 6.4 阶段 3：逐页稳态化

推荐顺序：

1. 登录与自动登录链路：`pages/login/login.vue`、`pages/splash/splash.vue`。
2. 首屏与列表链路：`pages/index/index.vue`、`pages/poem-square/poem-square.vue`、`pages/mountain/mountain.vue`。
3. 详情与互动链路：`pages/post-detail/post-detail.vue`、`pages-content/portfolio-detail/portfolio-detail.vue`。
4. 用户链路：`pages/profile/profile.vue`、`pages-user/user-profile/user-profile.vue`、`pages-user/poet-profile/poet-profile.vue`。
5. 发布链路：`pages-publish/add/add.vue`、`pages-publish/preview/preview.vue`、`pages-content/draft-box/draft-box.vue`。
6. 活动链路：`pages-content/activity-list/activity-list.vue`、`pages-content/activity-detail/activity-detail.vue`、`pages-admin/activity-posts/activity-posts.vue`。

### 6.5 阶段 4：清理冗余与死代码

- 删除 `main.js` 中只为 Vue2 存在的兼容分支。
- 删除重复初始化和无效注释。
- 将临时兜底逻辑沉淀为稳定 helper，避免迁移后留下“兼容层债务”。

### 6.6 阶段 5：交付与归档

- 输出迁移记录、问题清单、回归结果。
- 对最终版本执行一次完整导出和归档，保证后续接手者能复盘“为什么这样迁”。

<!--PAGE_BREAK-->

## 7. 详细改造清单

### 7.1 入口与全局能力

| 改造项 | 当前位置 | 预期动作 | 风险等级 |
| --- | --- | --- | --- |
| 运行时切换 | `manifest.json` | 改为 Vue3 | 高 |
| 应用创建方式 | `main.js` | 统一到 `createSSRApp` | 高 |
| `$tcb` 注入 | `main.js`、`App.vue` | 收口到 bootstrap + `app.config.globalProperties` | 高 |
| `fileUrlCache` resolver | `main.js` | 保留但重挂到 Vue3 路径 | 中 |
| badge 初始化 | `main.js` | 抽到统一启动流程 | 中 |
| 登录预热 | `main.js` | 保留并改到 Vue3 路径 | 中 |

### 7.2 页面与组件语法

| 改造项 | 影响面 | 处理原则 |
| --- | --- | --- |
| `this.$set` | 9 个文件 / 36 处 | 全量替换，禁止残留 |
| `beforeDestroy` | 2 个自有组件 | 直接改名为 `beforeUnmount` |
| `.sync` | 1 个页面 | 迁移为 `v-model:*` |
| watcher 深度监听 | 若干页面 | 按数据结构补 `deep: true` |
| `setData` | 42 个文件 / 592 处 | 首轮继续沿用 `zp-mixins`，不做大重写 |

### 7.3 状态与事件

| 改造项 | 当前问题 | 建议策略 |
| --- | --- | --- |
| `globalData` | 裸读裸写过多 | 增加统一 helper 收口 |
| `uni.$on` / `uni.$off` | 注册与解绑粒度不一致 | 明确 handler 常量并在卸载时一一解绑 |
| 点赞 / 评论 / 未读事件 | 多页联动 | 先保证不重复触发，再考虑重构 |
| 自定义缓存桥接 | 依赖启动顺序 | 迁移时必须保留初始化时机 |

### 7.4 明确不在本轮做的事

1. 不将 Options API 全量改写成 Composition API。
2. 不上 Pinia / Vuex 全量状态迁移。
3. 不做 HarmonyOS 运行适配。
4. 不因 Vue3 迁移顺手重构页面视觉或业务流程。
5. 不主动修改后端云函数和数据库结构。

<!--PAGE_BREAK-->

## 8. 风险识别与回归策略

### 8.1 主要风险矩阵

| 风险 | 触发场景 | 影响 | 应对策略 |
| --- | --- | --- | --- |
| 启动成功但能力缺失 | 只改 `vueVersion`，未补全 Vue3 入口 | 页面可打开但登录 / 云调用异常 | 先做 bootstrap 功能等价 |
| 响应式失效 | `this.$set` 未清理 | 点赞、评论、草稿局部状态不刷新 | 全量替换并逐点验证 |
| 事件重复触发 | `uni.$on` 重复注册或解绑不精确 | 点赞数、未读红点重复更新 | 统一按 handler 注册解绑 |
| 页面卸载泄漏 | 生命周期未改或清理遗漏 | 返回页面后事件叠加 | 统一检查 `onUnload` / `beforeUnmount` |
| 三方模块兼容性 | `mp-html`、`uni-table` 等版本差异 | 某些组件在 Vue3 下异常 | 先冒烟验证，再决定升级 |
| 启动链路变慢 | bootstrap 抽取后顺序不当 | 首屏白屏或登录延迟 | 关键链路串行，预热与 badge 延后 |

### 8.2 不建议的迁移方式

- 一次性把 `setData`、`globalData`、页面结构和状态管理全部重写。
- 在没有跑通三端启动前，就同步做 Composition API 重构。
- 不做扫描、不列优先级，直接从页面数量最多的目录开工。

### 8.3 推荐的回归节奏

1. 每完成一个阶段，都先做微信小程序冒烟，因为云能力和登录链路最敏感。
2. 首屏和详情页通过后，再回归发帖与个人中心。
3. 活动、收藏夹、消息中心等第二梯队功能放在主链路稳定之后处理。
4. 三端回归顺序建议为：微信小程序 -> H5 -> App。

<!--PAGE_BREAK-->

## 9. 测试矩阵与验收标准

### 9.1 启动与编译验收

| 检查项 | 验收标准 |
| --- | --- |
| 微信小程序启动 | 无 `$tcb` 未定义、登录态丢失、云调用初始化失败 |
| H5 启动 | 页面可访问，登录和跳转正常 |
| App 启动 | URL Scheme、热更新、字体预载不因迁移失效 |
| 编译过程 | 无 Vue2 专属 API 导致的硬错误 |

### 9.2 核心业务回归

| 业务链路 | 必测内容 |
| --- | --- |
| 登录 / 自动登录 | 微信登录、GitHub 回调、回跳逻辑 |
| 首页 | 列表加载、下拉刷新、点赞、评论数同步 |
| 帖子详情 | 评论区、回复区、点赞、收藏、删除 / 新增评论回流 |
| 发帖链路 | 新建、预览、发布、返回编辑、草稿箱 |
| 个人中心 | 我的主页、他人主页、关注 / 拉黑、作品集 |
| 活动链路 | 活动列表、活动详情、活动帖子聚合 |
| 消息链路 | 未读红点、活动红点、顶部栏、TabBar 切换 |

### 9.3 响应式专项验证

| 类型 | 重点验证点 |
| --- | --- |
| 原 `$set` 位置 | 评论点赞、草稿局部替换、字典状态切换、字体下载 loading |
| `setData` 重度页面 | 深层路径赋值、数组索引替换、重复赋值后的视图同步 |
| watcher | 深层对象 / 数组变化是否还能触发业务逻辑 |
| `.sync` 替换 | 时间轴折叠状态是否双向同步 |

### 9.4 事件与清理专项

需逐一验证以下事件不会重复触发或泄漏：

- `like-changed`
- `comment-count-changed`
- `comment-like-changed`
- `avatar-updated`
- `post-created`
- `favorite-changed`
- `unread-changed`

### 9.5 最终验收标准

1. 三端启动通过。
2. 六条核心业务链路全部回归通过。
3. 自有代码不再残留 `this.$set`、`beforeDestroy`、`.sync`。
4. 所有高风险页面均完成至少一次人工回归记录。
5. 最终文档、变更说明和测试结果可归档。

<!--PAGE_BREAK-->

## 10. 实施建议与资源安排

### 10.1 推荐实施顺序

| 周期 | 建议投入 | 主要工作 |
| --- | --- | --- |
| 第 1 周 | 1 人主改 + 1 人回归支持 | 启动入口梳理、bootstrap 抽取、`manifest.json` 切换 |
| 第 2 周 | 1 人主改 + 1 人页面联调 | 清理 `$set`、生命周期、`.sync`，完成 P1 页面联调 |
| 第 3 周 | 1 人主改 + 1 人测试 | P2 页面稳态化、事件清理、三端回归 |
| 第 4 周 | 机动 | 清理冗余、补问题清单、完成发布前验收 |

### 10.2 建议的里程碑门禁

1. 不允许在阶段 1 未跑通三端启动前展开大规模页面重构。
2. 不允许在 P1 页面未通过回归前删除 Vue2 兼容分支。
3. 不允许在事件总线清理未完成前判定“迁移完成”。
4. 不允许把文档计划与实际代码改造脱节，阶段完成后要同步补记录。

### 10.3 成本与收益判断

- 成本主要集中在前端页面层和启动链路，不在云函数。
- 收益主要体现在：后续依赖升级空间更大、Vue2 历史包袱更少、三端统一维护成本下降。
- 若按本报告的“分阶段 + 优先级”方式执行，迁移风险可控；若改成“全量重写”，风险会显著上升。

<!--PAGE_BREAK-->

## 11. 参考依据

### 11.1 外部参考

| 来源 | 链接 | 用途 |
| --- | --- | --- |
| 华为开发者话题页 | `https://developer.huawei.com/consumer/cn/forum/topic/0213198526159516042?fid=0109140870620153026` | 作为迁移背景参考链接 |
| uni-app Vue3 应用配置 | `https://uniapp.dcloud.io/tutorial/vue3-api.html` | 确认 `createSSRApp` 入口方式 |
| uni-app API 概述 | `https://uniapp.dcloud.io/api/` | 核对 Vue2 / Vue3 Promise 化差异 |
| Vue 3 迁移指南总览 | `https://v3-migration.vuejs.org/zh/breaking-changes/` | 核对 breaking changes 清单 |
| Vue 3 `v-model` 迁移 | `https://v3-migration.vuejs.org/zh/breaking-changes/v-model.html` | `.sync` 与 `v-model:*` 替换依据 |

### 11.2 本仓库内部依据

- `manifest.json`
- `main.js`
- `App.vue`
- `pages.json`
- `pages/post-detail/post-detail.vue`
- `pages/index/index.vue`
- `pages/profile/profile.vue`
- `pages-publish/add/add.vue`
- `pages-user/user-profile/user-profile.vue`
- `uni_modules/zp-mixins/index.js`
- `uni_modules/zp-mixins/methods/setData.js`

### 11.3 说明

本报告结论以仓库静态扫描结果为主，外部资料主要用于校对迁移方向与 breaking changes，不替代项目自身代码事实。

<!--PAGE_BREAK-->

## 12. 附录：后续实施时的核对清单

### 12.1 开工前核对

- 已冻结“本轮不做”的改造范围。
- 已确认 `manifest.json`、`main.js`、`App.vue` 为第一批改造对象。
- 已列出 P1 / P2 / P3 页面优先级。
- 已准备三端测试环境。

### 12.2 每阶段完成后核对

- 启动是否仍稳定。
- 登录链路是否仍可用。
- 事件监听是否存在重复。
- 页面局部响应式是否恢复正常。
- 文档与问题单是否同步更新。

### 12.3 最终交付核对

- 迁移代码已和本计划逐项对齐。
- 测试矩阵全部留痕。
- 删除了无效的 Vue2 兼容代码。
- 最终版本具备可归档的 Markdown / HTML / PDF 文档。

### 12.4 本文档结论

本项目的 Vue3 迁移属于“前端运行时与响应式机制升级项目”，不是“后端重构项目”，也不是“全站重写项目”。只要坚持“先入口、后语法、再页面、最后清理”的路径，迁移可以在不改业务模型的前提下稳步完成。
