# 作品集添加问题排查（2026-09-12）

结论：新旧表混用已修复，并于 2026-09-12 18:42–18:45 部署上线。线上已有按需补建，仍不能将本次“诗歌无法加入”反馈直接归因于缺少默认作品集。

## 本次修复

- `registerUser`、`createUser` 统一向 `portfolio_folders` 初始化作品集，完善已有账号时也会检查；已有作品集直接复用。
- 注册、列表补建和 `ensureDefaultPortfolio` 使用同一补建逻辑，以固定 ID 插入防止并发重复创建，保留失败后打开列表重试的能力。共享源为 `functions/_lib/ensure-default-portfolio.js`，四个使用方各自携带同内容 `_lib` 副本，供独立部署。
- 注册及列表新建默认集沿用当前页面的默认公开行为；已有作品集内容、可见性和显式补建接口的私有设置保留。
- 旧接口 `createPortfolio`、`getPortfolios` 改用当前表，数量按 `portfolio_items.folderId` 统计。
- `bindWechatOpenid` 改为迁移当前作品集及诗歌关联的 `_openid`，保留作品集 ID，避免绑定后列表有作品集却读不到诗歌。
- 新增 `npm run test:portfolio` 并接入 `check:quality`，覆盖两种注册入口、App/微信身份、添加读取、已有数据保留、失败补建、并发补建、旧接口及超过一批的绑定迁移。

验证：`npm run check:quality` 全部通过（含作品集回归）；上线后 7 个函数均为 `Active`，代码及 `_lib` 文件哈希与本地一致，运行时参数校验通过。`getPortfolios` 线上只读查询成功；完整添加流程尚未真机复测。

已通过 `tcb fn deploy <函数名> --force` 部署上述 7 个云函数及各自 `_lib`，目标环境为 `cloud1-5gb0pbyl400845f5`。使用 `--config-file`、`--envId`、`--dir` 显式指定配置和代码，保留各函数原有运行时、超时、内存及环境变量。部署前完整代码备份、配置和验证记录保存在 `unpackage/portfolio-deployment/2026-09-12/`（Git 忽略）。

线上旧表已不存在，无需迁移旧表数据；历史缺失默认集的用户可在打开列表时补建。本次未执行批量回填，验证未写入业务数据。下列其他反馈路径仍待处理。

## 修复前已核实

- 线上 `getPortfolioFolders`、`addToPortfolio`、`getPortfolioItems` 与当前本地代码一致；前两个函数于 2026-09-04 更新。
- 按 `createTime`、`createdAt` 各取最近 30 条用户记录，去重后 60 人：41 人有当前作品集，19 人没有。这是样本，不代表所有用户；没有作品集也可能是尚未访问相关页面。
- 注册函数 `registerUser`、`createUser` 向旧表 `portfolios` 创建默认作品集，而该线上表已不存在；失败会被捕获，注册仍成功。当前功能实际使用 `portfolio_folders`。
- 打开作品集列表时，`getPortfolioFolders` 会为没有作品集的人创建“我的作品集”。已用隔离模拟验证：新用户在 App、微信正常身份场景下都能补建并添加诗歌。

## 可能对应的反馈症状

| 症状 | 已发现的逻辑 | 位置 |
| --- | --- | --- |
| 显示“还没有作品集”，持续刷新 | 加载异常被当成空列表显示，每秒自动重试，用户看不到真实错误 | `components/portfolio-selector/portfolio-selector.vue:240` |
| 添加失败，再次添加提示“已经添加过了” | 先写诗歌关联，再更新数量；第二步失败没有回滚，第一步实际已成功。已模拟复现 | `functions/addToPortfolio/index.js:60` |
| 换登录方式后作品集不一致 | 微信端作品集按微信 OPENID 处理，忽略账号登录返回的业务 openid；两者不同时指向不同作品集。已模拟复现 | `functions/getPortfolioFolders/index.js:69`、`functions/addToPortfolio/index.js:28` |
| 某首诗没有添加按钮 | 入口只对“自己的原创诗歌”显示；作者判断仅比较 `_openid`，匿名帖公共标识也会导致判断失败 | `pages/post-detail/post-detail.vue:153`、`:862`、`:2831` |
| 在批量添加列表里找不到较早的诗 | 只取最近 50 条动态，再筛选原创诗歌，没有继续分页 | `pages-content/portfolio-detail/portfolio-detail.vue:507` |

线上核查只读，验证使用本地模拟。日志接口未取得可用于对应本次反馈的记录；仍需反馈用户的平台、登录方式及具体提示，才能确定其遇到的是哪一条路径。
