# `posts` 新写入字段精简方案

## 目标与范围

从新发布的帖子开始，按帖子类型只写需要的字段；旧帖子仍按现有格式读取，不做批量迁移或删除。精简重点是空数组、空字符串、`null` 和可从其他字段计算出的重复字段。

本方案不改变帖子展示、筛选、匿名归属、活动关系、诗歌卡片颜色或审核行为。数据库字段允许新旧记录并存，读取端在需要数组、布尔值或字符串时继续提供默认值。

## 当前情况

`functions/contentCheck/index.js` 目前为所有帖子构造同一套 `postData`。因此，一首普通原创诗歌也会带上讨论字段、组诗字段、活动字段和匿名字段；无值时仍写入 `[]`、`''` 或 `null`。例如 `sentenceGroups`、`discussionSentences`、`seriesBlocks`、活动时间及匿名作者字段均由通用对象初始化。

写入字段可在 [contentCheck 云函数](../../functions/contentCheck/index.js) 的 `postData` 定义附近查看。更新由 [updatePostContent 云函数](../../functions/updatePostContent/index.js) 的允许字段列表及相关规范化逻辑处理。

## 分级处理建议

### A. 新发布时可以省略无关模式字段

以下字段只在对应模式有数据时写入；其他模式不写空值：

| 字段 | 写入条件 | 旧数据读取兼容 |
| --- | --- | --- |
| `sentenceGroups`、`discussionSentences` | 仅讨论帖子 | 讨论显示继续优先读 `sentenceGroups`；必要时从旧 `discussionSentences` 转成规范结构 |
| `parentPostId`、`quotedPostId` | 帖子确实引用或回复其他帖子时 | 读取端将缺失值视为空字符串 |
| `seriesBlocks`、`seriesBlockCount` | 仅组诗 | 缺失分块按普通诗歌处理；组诗数量可按分块长度补算 |
| `seriesCoverImage`、`seriesCoverHighlight` | 仅当有实际消费者且有对应值时 | 当前仓库未找到读取方；旧字段可继续留在旧记录中 |
| `activityId`、`activityTitleSnapshot`、`activityPublishTime` | 官方活动帖子 | 缺失表示非官方活动帖子；时间仅对活动帖子读取 |
| `joinedActivityId`、`joinedActivityTitleSnapshot`、`joinedActivityAt` | 用户参加活动时 | 缺失表示未参加活动；更新逻辑按空值处理 |
| `anonymousAuthorName`、`realAuthorOpenid` | 仅匿名帖子 | 缺失表示普通帖子；匿名帖子仍写真实作者标识，供归属、屏蔽和点赞通知使用 |
| `highlightSentence`、`highlightLines` | 实际选择了高光时 | 旧数据继续读取两个字段；没有高光的新帖子可不写空字符串或空数组 |

删除旧字段之前，需要先确认详情页、列表、分享、周刊、搜索、个人主页及活动页都能处理字段缺失。不要通过全库回填或删除来配合这次精简。

### B. 有重复，但先保留，等读取端完成兼容后再停止新写入

| 字段组合 | 重复关系 | 为什么暂时保留 |
| --- | --- | --- |
| `authorName` / `authorNameSnapshot` | 新帖子通常写入相同显示名 | 多个列表、详情和聚合接口仍直接把 `authorNameSnapshot` 当作兜底或投影源。先让读取端按 `authorName || authorNameSnapshot` 统一取值，再考虑新写入不重复快照。 |
| `authorAvatar` / `authorAvatarSnapshot` | 新帖子通常写入相同头像 | 头像解析、个人页、推荐流等仍依赖 snapshot 兜底。先统一读取逻辑。 |
| `sentenceGroups` / `discussionSentences` | 发布时后者由前者映射，包含相同句组和评论 | `getDiscussionPosts` 仍单独投影 `discussionSentences`。先让它从规范字段生成兼容响应，再停止重复入库。 |
| `highlightSentence` / `highlightLines[0]` | 有高光时单句常等于数组首项 | 旧组件和内容流程仍使用单句字段。先确保读取端在缺少单句字段时从数组首项补出。 |
| `seriesBlockCount` / `seriesBlocks.length` | 数量可计算 | 部分页面和接口仍读取该字段。先在列表/推荐响应统一按数组长度补齐，再停止新写入该计数。 |
| `publishMode` 与类型布尔字段 | `publishMode` 可表达 normal、poem、discussion；布尔字段表达其中一部分 | 查询、索引筛选、管理、详情和编辑逻辑大量直接使用 `isPoem`、`isDiscussion`、`isSeries`。本轮保留两类字段，避免更改查询语义。 |

`author` 是诗歌署名，不等于账号显示名；不能因它与 `authorName` 都是字符串就合并。`isPoem`、`isOriginal`、`isSeries`、`isDiscussion` 和 `isAnonymous` 也建议继续写明确的布尔值，以保持查询和模式判断稳定。

### C. 普通原创诗歌应继续写入的核心字段

普通原创诗歌至少保留：

- 标识和基础内容：`_openid`、`title`、`content`、`createTime`
- 计数：`votes`、`commentCount`
- 类型：`publishMode`、`isPoem`、`isOriginal`、`isSeries`、`isDiscussion`、`isAnonymous`
- 作者：`author`、`authorName`、`authorAvatar`、`authorSignature`；在读写兼容阶段同时保留两个 snapshot 字段
- 卡片样式：`backgroundColor`、`textColor`
- 审核状态：`auditStatus`、`auditTime`
- 标签及实际图片：`tags`、图片 URL 字段只在有图片时写入
- 实际选择的高光字段

不要把颜色、正文、作者署名或图片相关信息当作可推导字段删除。当前诗歌卡片和详情会直接使用这些字段。

## 建议的实现顺序

1. **读取端先容忍缺失值。** 统一在 API 输出边界补默认值；聚合查询对 snapshot、讨论字段及组诗数量提供旧字段回退。默认值只用于返回对象，不要求写回数据库。
2. **让创建逻辑按模式组装字段。** 公共字段先建立；讨论、组诗、活动、匿名字段分别按实际模式追加。没有值的可选数组、空字符串和 `null` 不加入 `postData`。
3. **消除重复写入。** 读取兼容确认后，按上表 B 的顺序停止写重复快照、重复讨论结构和可计算的组诗数量。保留旧读取分支。
4. **同步更新编辑逻辑。** 编辑时不应因为某字段未传入就把旧帖子的有效值清空；只有用户明确清除该字段时才写空值或删除字段。`updatePostContent` 目前会重算并写入组诗数量，应与新建策略统一。
5. **保留旧帖子原样。** 不需要扫描、回填或删除历史字段。新旧文档由同一读取层归一化。

## 验收检查点

- 普通原创诗歌不再写讨论、组诗、活动、匿名专属字段或空高光字段。
- 讨论帖子的新记录可以正常显示句组；旧记录只有 `discussionSentences` 时仍能显示。
- 组诗新记录可以正常显示封面、高光和段落数；旧记录缺少计数字段时可以由分块数恢复。
- 官方活动帖子和用户参与活动的帖子仍能显示活动关系与标题。
- 匿名帖子仍匿名展示，真实作者归属、删除权限、屏蔽过滤和通知逻辑保持有效。
- 编辑普通字段不会清空旧帖中未提交的活动、图片或组诗数据。
- 新记录省略可选字段时，列表、详情、搜索、个人主页、推荐流、分享和周刊均不报错。

## 当前样例的说明

样例中的 `author: "沙漠的蓝你的海"` 是诗歌署名；`authorName: "匿名用户"` 是认证账号对应的显示名。`_openid` 以 `anonymous_` 开头表示账号使用匿名认证，不代表匿名发布。该样例 `isAnonymous: false`，所以其匿名专属字段属于无关字段；不要据此把普通账号认证状态改成帖子匿名状态。
