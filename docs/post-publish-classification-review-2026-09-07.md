# 帖子发布与错分区排查记录

排查日期：2026-09-07。

用户现象：选择原创诗歌，偶尔发布后进入非原创诗歌或普通帖子，App 端更常见。

范围：本地源码、Git 历史、本地 App 构建产物；执行了真实页面方法与云函数的隔离测试，云数据库使用 mock。未连接生产数据库、未验证用户手机安装包、未修改业务代码或部署。

## 结论

发现一个与 App 正式版本高度相关、可在本地复现的字段丢失原因：旧版预览页用 `...addPage.$vm` 构造发布参数。项目实际安装的 Vue 3 在 production 模式下，页面实例属性可直接读取，但对象展开不会复制这些业务数据。

Git 提交 ed61ec7 的预览页和本地 `unpackage/dist/build/app-plus/app-service.js` 都保留该问题。本地 App 构建 manifest 标记版本 1.6.3。用该构建里的真实 `publishFromAddPage` 方法配合 Vue production 实例验证，`publishMode`、`isOriginal`、`isPoem` 均未进入发布对象。

当前源码在提交 f9fa9c3（Git 日期 2026-07-13）中已经显式补齐分类字段。同样的测试中，当前源码能正确传递原创诗歌分类。但是当前源码仍使用实例展开，标签、配色等字段仍会丢失。

本地构建存在问题，不等于已经证明用户手机运行同一构建。确认线上根因仍需异常帖子记录、发帖时客户端构建标识和云函数入参日志。

## 主发布链路

1. `components/ModeSelectorModal.vue:8`：原创选项发出 `{ mode: 'poem', isOriginal: true }`。
2. `pages-publish/add/add.vue:1456`：`onModeSelect` 同步写入编辑页状态；setData 实现同步赋值，不是把分类写入延迟到 nextTick。
3. `pages-publish/add/add.vue:2122`：`goToPreview` 生成普通预览对象。分类保存在 `previewPost.editData`，同时通过 EventChannel 和 `preview_post` 本地缓存传递。
4. `pages-publish/preview/preview.vue:477`：预览页接收数据；没有接收到时尝试本地缓存。界面主要依据 `post.editData.publishMode` 展示。
5. `pages-publish/preview/preview.vue:1475`：点击发布后，重新获取页面栈倒数第二页的 `$vm`，构造另一份 `publishData`。这里没有直接使用预览快照作为发布源，也没有校验前一页的路由或快照一致性。
6. `pages-publish/preview/preview.vue:1793`：非原创诗歌查重；有图片先上传，无图片直接进入提交。
7. `pages-publish/preview/preview.vue:2107`：编辑已有帖子走 `updatePostContent`；普通新帖走 `contentAudit`；已有单篇合成组诗另有 `createSeriesFromSingles` 分支。
8. `api-cache/publish.js:29`：`contentAudit` 调用云函数 `contentCheck`。它并非只审核，当前发布请求直接在其中创建帖子；源码中的实际内容审核目前处于跳过状态。
9. `functions/contentCheck/index.js:234`：归一化分类；`:565` 构造数据库对象；`:707` 调用 `posts.add`。分类字段在同一次创建操作中写入，后续更新的是颜色、高光等字段。
10. 发布成功后发送创建/更新事件、设置各页面刷新标志、清理草稿和预览缓存。

App/H5 通过 CloudBase JS SDK 调用，微信小程序通过 wx.cloud 调用。当前调用封装主要处理身份与协议，没有发现其主动删除分类字段的逻辑。

## 分区依据

| 区域 | 主要查询条件 |
| --- | --- |
| 原创诗歌 | `isPoem === true` 且 `isOriginal === true` |
| 非原创／山诗 | `isPoem === true` 且 `isOriginal != true` |
| 普通帖子 | `isPoem != true` 且 `isDiscussion != true` |
| 讨论 | `isDiscussion === true` |

依据：`api-cache/poems.js`、`pages/index/index.vue:404`、`functions/getPostList/index.js:232`、`functions/getDiscussionPosts/index.js:58`。

`!= true` 会接纳缺失、null 等异常值。因此关键字段一旦缺失，不会被隔离为异常数据，而会进入其他区域。这里的分区由字段查询决定，没有发现按诗歌正文内容自动改分区的逻辑。

## 已复现的问题

### 1. 旧 App 发布对象丢失分类字段

旧写法为 `const publishData = { ...addData, title: ..., content: ..., isSeries: ... }`，其中 addData 是 Vue 页面实例，旧版没有显式列出 publishMode 和 isOriginal。

隔离测试使用本项目 Vue production 实例：

| 取值方式／代码版本 | publishMode | isOriginal |
| --- | --- | --- |
| 直接读取页面实例 | poem | true |
| 对页面实例做对象展开 | 缺失 | 缺失 |
| Git ed61ec7 的真实发布方法 | 缺失 | 缺失 |
| 本地 App 1.6.3 构建的真实发布方法 | 缺失 | 缺失 |
| 当前源码的真实发布方法 | poem | true |

这解释了为什么编辑界面可以显示原创，构造出的请求却不是原创。两个字段同时丢失时会落到普通帖子；如果诗歌标志或组诗标志仍被保留，但原创标志丢失，则会落到非原创。后一个触发条件已验证服务端行为，具体异常帖是否符合仍需日志确认。

### 2. 服务端将缺失值转换成其他合法分类

`functions/contentCheck/index.js:132` 的布尔归一化只接受 true 和字符串 'true'。`:237` 在没有诗歌信息时回落 normal；`:240` 将缺失原创标志处理成 false。

实际执行云函数源码、mock 数据库捕获写入对象，得到：

| 请求 | 写入结果 | 返回 |
| --- | --- | --- |
| poem、isPoem=true、isOriginal=true | 原创诗歌 | 成功 |
| poem、isPoem=true，缺 isOriginal | 非原创诗歌 | 成功 |
| 只有 isOriginal=true，缺 mode/isPoem | 普通帖子 | 成功 |
| poem、isOriginal=1 | 非原创诗歌 | 成功 |
| 正确原创字段 + 合法官方 activityId | 普通官方活动帖 | 成功 |

官方活动帖强制普通分类是明确业务分支；普通参与活动使用 joinActivityId，不应混为同一原因。当前编辑器也会锁定官方活动发布模式，因此不是普通原创发布的首要嫌疑。

### 3. 当前源码仍会丢标签、配色等数据

`pages-publish/preview/preview.vue:1641` 仍展开 Vue 实例。分类虽已显式补齐，selectedTags、selectedBackgroundColor 等未显式拷贝。

测试中，页面实例拥有标签和背景色，但 executePublish 收到的对应字段均为 undefined；后续会使用空标签、空背景等默认值。高光行等依赖同一展开的字段也应一起检查。

### 4. 预览与提交数据源不一致

预览读取快照，发布读取前一页实例。隔离测试设定快照是原创、实例是非原创时，实际提交非原创；快照是原创、实例缺少模式时，实际提交普通帖。

这证明缺少一致性保护；尚未在真实手机上复现普通编辑页为何发生状态不一致，不能把测试注入的不一致当作已确认的真实生命周期故障。

一个确定的受影响入口是已有单篇合成组诗：`pages-publish/series-compose/series-compose.vue:406` 构造完整组诗预览快照，但它自己的 data 只有 allSingles、selectedIds 等，不具有编辑页的 content、publishMode、isOriginal。预览提交仍读取上一页实例，按这个真实 data 结构测试会提示“请输入正文内容”，没有进入组诗提交。这是独立的发布入口缺陷。

## 其他改进点

- 草稿恢复：`add.vue:919` 将缺 publishMode 的旧草稿默认为 normal，缺 isOriginal 默认为 false；成功恢复草稿后不再应用来源页面默认模式。属于可疑触发条件，不能证明用户明确重新选择原创后仍会被草稿覆盖。
- 布尔协议不统一：前端使用 `!!value`，创建云函数接受 true/'true'，编辑云函数使用严格 true。当前选择组件传递真实布尔值，因此字符串／数字问题属于兼容风险，不是已确认的常规入口原因。
- 旧入口残留：`createPost` 使用另一套默认值，`publishPost` 封装调用本地没有实现的 submitPost；普通发布按钮实际走预览再 contentCheck。应明确入口，避免修错函数。
- 预览发布没有显式提交中锁，云函数创建没有请求级幂等键。重复点击或重试可能重复发帖，这是独立问题。
- 发布返回只有 postId 等成功信息，不回传实际分类，也没有与选择快照核对。
- 生产环境通过 `utils/logger.js` 静默 log/warn；现有前端分类日志不足以支持线上定位。云函数已有接收参数和写入对象日志，但缺客户端版本与统一发布请求标识。

## 建议处理顺序

1. 核对实际发帖 App 的资源版本、构建标识与部署时间。当前源码和本地旧构建都标记 1.6.3，仅看展示版本不足以证明使用了新代码。
2. 用一个显式字段列表生成普通发布快照；编辑页、草稿、组诗入口共用；预览显示和提交消费同一份数据，移除对 Vue 实例展开和前一页位置的依赖。
3. 为当前发布协议增加明确类型校验；缺失或冲突分类拒绝创建并保留草稿，不静默降为普通或非原创。旧客户端要有明确兼容路径；若分类信息完全没有送到服务端，服务端不能可靠猜回原创。
4. 返回并核对实际保存的分类；日志记录 requestId、入口、平台、资源版本、分类字段与 postId，不记录正文作为常规诊断数据。
5. 对正式构建做回归：原创单篇纯文字／图片、原创组诗、非原创、切换模式、草稿恢复、编辑旧帖、已有单篇组诗入口、App 后台返回。不能仅用开发模式测试。
6. 最后处理历史错分记录。先确认异常帖子及用户原意，再逐条修正；不能把无作者的非原创或某类排版的普通帖批量猜成原创。

## 定位真实异常帖所需证据

按异常 postId 对照发帖时间附近的 contentCheck 日志：原始 event、最终 postData、数据库现值，以及是否调用过 updatePostContent。

- event 已缺分类：优先核对旧 App 与前端发布对象。
- event 正确但写入值不正确：检查实际部署的云函数版本与活动分支。
- 初始写入正确、现值错误：检查后续编辑请求。
- 数据库始终正确：检查实际列表请求条件、返回项和本地缓存。

对于目前用户反馈，旧 App 实例展开缺字段是证据最强的候选原因；当前客户端是否仍中招，以及非原创那部分异常的具体入口，尚需上述记录闭环。
