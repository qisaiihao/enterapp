# 回车键 · POEMENTER 网站

已合并旧官网海报页面与新阅读网站，统一构建为一个 `dist/`。手机／平板竖屏首次访问进入旧官网，电脑进入阅读版；两边可切换并记住选择。保留网页版 App 与 APK 下载入口，移除了 More 及附属小工具。完整入口规则、部署范围与宝塔配置见 [统一官网部署说明](DEPLOYMENT.md)。

参考同目录《网站设计.pdf》实现的独立 Vue 3 阅读网站。PC 保留文字侧边导航、大面积留白、细线分隔、左侧全文和右侧彩色卡片；手机使用双列卡片、独立全文页和月历。

## 本地打开

**最简单的方式：双击当前文件夹中的「启动网站.cmd」。** 它会自动打开浏览器；若服务尚未运行，会启动服务。请保留新打开的运行窗口。不要直接双击 `index.html` 或 `dist/index.html`，这两种方式现在会显示打开指引。

需要 Node.js 22.12+（本次使用 24.10）。在当前目录执行：

```powershell
npm ci
npm run dev
```

打开 **http://127.0.0.1:5173/**。若开发服务已经在运行，直接打开即可。

默认连接现有腾讯云环境 `cloud1-5gb0pbyl400845f5`，可以直接读取 App 公开诗歌，无需自行填写密钥。页脚可以切换明确标注的「示例书架」，并通过「体验示例账号」检查个人页面；示例诗歌是页面演示文本，不是 App 用户作品。云端失败时显示错误与重试，不自动替换成示例数据。

### 已实现

- 首页：实时日期、公开诗歌入口、卡片选读、当日阅读。
- 页脚：从最新 36 篇可读公开诗歌的已保存高光行中随机抽取一句，左侧显示对应作者，右侧显示 POEMENTER 回车键；匿名作品署名“匿名诗人”。兼容旧版单句高光，刷新或切换数据模式时重新抽取。没有高光或加载失败则不显示句子与作者，不将正文当成高光。普通页面切换时保持当前句子，手机端同样显示。
- 所有人的诗：原创／转载筛选，诗名／正文／作者搜索，分页加载，卡片选中状态。
- 阅读：原始换行与段落、组诗分节、云端配图、字号切换并记忆、上一首／下一首、方向键、随机选读、复制直达链接。
- 我的诗歌：Poem ID／密码登录后，读取本人公开发布的作品，包含本人匿名发布的作品。
- 我的诗歌顶部统计：默认进入诗歌阅读区，鼠标向上滚动或手指下滑可查看年度贡献图、切换年份及手机月历，点击日期筛选作品。按北京时间聚合整年原创发布记录，统计不依赖当前已加载的分页。原 Days 独立页面已合并到 My poems。
- 个人信息：昵称、Poem ID、简介、地区、头像、手写签名、关注和被关注数量。
- Me 页作品集／收藏夹：同步 App 文件夹的封面、名称与条目数，分页展开诗歌卡片并阅读全文，支持空列表、加载错误与重试。
- 登录：7 天网站会话、浏览器身份绑定、刷新恢复、退出撤销会话、登录尝试限流；不保存密码。
- 状态：加载、空书架、无搜索结果、服务失败、无效直达链接、登录失效、重试。
- 手机阅读：阻止背景滚动、关闭后保留已加载卡片和位置、键盘焦点返回。

这里不提供发布、编辑、删除、点赞、关注或草稿编辑操作；用户在 App 继续创作与交流。PDF 中的虚构数字、重复卡片、签名占位和编辑按钮已替换为实际逻辑或省去。

## 云端状态（2026-09-16）

本次已新增并部署：

| 资源 | 用途 |
| --- | --- |
| 云函数 `webReader` | 网站统一接口：公开列表、全文、登录、个人信息、本人作品和创作统计 |
| 集合 `web_reader_sessions` | 仅存储随机令牌的 SHA-256 摘要、所属账号、浏览器身份、到期时间 |
| 集合 `web_reader_limits` | 原子事务记录登录尝试次数 |

两个新集合均设置为 `ADMINONLY`，并建立 `expiresAt` 索引；过期记录在后续登录时分批清理，到期检查本身不依赖清理是否完成。

`posts`、`users`、`follows`、`blocks`、`portfolio_folders`、`portfolio_items`、`favorite_folders`、`favorites` 仅被读取。没有修改外层 uni-app 的源码、现有云函数、数据库权限、字体管理器或 App 资源。网站的汇文明朝是独立复制的字体文件；App 已验收的加载流程未改变。

前端尚未发布到正式域名，也没有覆盖 `poementer.com` 的现有站点。

### 数据约定

- 公开书架读取 `posts.isPoem === true`，排除 `isHidden`、`isDeleted`、`isPrivate` 和 `isActivityPost` 为 `true` 的记录。
- 本人作品同时匹配 `_openid` 和 `realAuthorOpenid`；本人身份只来自服务器验证的网站会话，不接受客户端传入的 `openid`。
- 匿名作品不返回真实作者 ID、原始作者信息或用户文档。匿名展示名统一为「匿名诗人」。
- 作品集和收藏夹接口 `folders`／`folderPoems` 必须登录，只读取会话所属账号的 `portfolio_folders`／`portfolio_items`、`favorite_folders`／`favorites`。条目数包含 App 中的全部收录记录；展开仅显示仍可公开阅读且未被屏蔽的诗歌。分页使用收录记录的游标，跳过不可见内容也能继续翻页；读取不会创建默认文件夹或清理原始记录。
- 支持 `seriesPoems`／`seriesBlocks` 和 `subtitle`／`subTitle` 的历史字段。
- 卡片优先展示 `highlightLines` 中有效的高光句并保留顺序与换行，其次使用旧字段 `highlightSentence`，均为空时展示正文摘要；阅读页仍显示完整正文。
- 卡片使用 App 保存的 `backgroundColor`、`textColor`，文字对比度处理与 App 浅色模式一致。缺失背景色的旧作品从 App 默认四色中按 ID 固定选取；App 本身对此类作品随机选色，因此未保存颜色的旧作品可能显示不同的默认色。
- 卡片和全文末尾显示发布者签名图片：优先使用作品的 `authorSignature`，旧作品缺失时从发布者资料的 `signatureUrl` 补齐；匿名作品不返回或显示签名。云文件地址分批转换，图片按原比例显示，不重新去底、染色或裁剪；没有签名或加载失败时自动省去签名位置。
- 首页、书架和个人作品集／收藏夹的诗歌卡片不显示顶部序号、作者姓名和箭头，保留标题、摘录、组诗标记及签名图片。整张卡片仍可点击阅读，辅助阅读标签保留作品标题和作者，选中状态通过边框显示。
- 原创统计只计公开原创诗歌，一条发布记录计一次，一篇组诗计一次。隐藏内容和草稿不计入。
- 日期以北京时间（UTC+8）计算；缺失日期显示「日期未记录」。
- 搜索在服务器执行，对输入转义后做字面匹配，最长 80 字；每页最多 36 首。
- 所有文本通过 Vue 文本插值渲染，不把用户诗歌当作 HTML 执行。

## 验证

```powershell
npm run check:quality
npm run test:browser
node scripts/live-check.mjs
```

`test:browser` 需要当前网站已在 `127.0.0.1:5173` 运行，会自动查找 Chrome／Edge；其他路径可通过 `PUPPETEER_EXECUTABLE_PATH` 指定。它在独立的无头浏览器中使用示例数据，不改动你的浏览器会话。`live-check` 使用真实云端读取和一个不存在的探测账号验证错误登录。

本次验证结果：

- 17 项单元／接口模拟测试通过，包括高光摘要、文件夹归属、收藏内容可见性、越权拒绝、匿名信息隔离、隐藏作品、会话绑定、退出撤销、限流、日期和分页校验。
- 桌面及手机浏览器流程通过，覆盖 1440px、390px、360px；未发现页面横向溢出或浏览器脚本异常。
- 真实云端列表、全文、原创／转载筛选、搜索及分页连通；初次检查返回 1,666 篇公开诗歌（数量会随 App 内容改变）。
- 真实云端未登录个人接口返回 `AUTH_REQUIRED`，错误密码返回 `INVALID_CREDENTIALS`。
- 生产构建通过，依赖审计已修复发现的开发工具问题。
- **尚未用你的真实账号完成成功登录、个人资料、贡献图及作品集／收藏夹的端到端验收。** 没有提供测试账号；这些成功路径已在模拟接口和示例页面测试。
- 手机验证为 Chrome 尺寸模拟，尚未完成手机实机验收。

截图保存在 [artifacts](./artifacts/)，包括 PC 首页、书架、创作记录、个人页及手机页面。

## 配置与部署

可将 `.env.example` 复制为 `.env.local` 修改公开的环境 ID、地域、函数名和默认数据模式。`VITE_` 变量会进入浏览器，禁止放腾讯云 SecretId／SecretKey。

```powershell
# 输出可独立部署的 dist/
npm run build

# 在本机检查生产产物
npm run preview
```

`preview` 地址为 `http://127.0.0.1:4173/`；旧官网地址为 `/classic/`。阅读版使用 hash 路由，直达链接形式为 `/#/poems?id=...`，静态服务器无需路径重写。正式部署时，把目标域名加入腾讯云开发安全来源，使用 HTTPS，并按 [统一官网部署说明](DEPLOYMENT.md) 将 `dist/` 的内容部署到网站根目录。

云函数维护（已完成，无需为了看页面重新执行）：

```powershell
# 读取当前环境配置
node scripts/cloud-admin.cjs inspect
# 初始化网站专用集合及权限，幂等
node scripts/cloud-admin.cjs setup
# 只部署网站自己的函数
tcb fn deploy webReader -e cloud1-5gb0pbyl400845f5 --force
```

管理脚本复用当前机器已登录的 CloudBase CLI，仅在本机进程中读取凭据。CLI 安装位置不同，可设置 `CLOUDBASE_GLOBAL_ROOT`；环境不同，可设置 `CLOUDBASE_ENV_ID` 并同步修改 `cloudbaserc.json`。不需要导出密钥到项目。

官方文档：[Web SDK 初始化与安全来源](https://docs.cloudbase.net/api-reference/webv2/initialization)、[匿名连接](https://docs.cloudbase.net/authentication-v2/method/anonymous)、[数据库集合权限](https://cloud.tencent.com/document/product/876/34819)。

## 文件组织

```text
src/App.vue                       页面、导航与请求状态
src/style.css                     PC／手机样式
src/components/PoemReader.vue      全文、组诗、字号和分享链接
src/components/PoemCard.vue        彩色卡片
src/components/ActivityCalendar.vue 年度热图与手机月历
src/components/LoginDialog.vue    登录弹窗
src/lib/api.js                    CloudBase 与显式示例模式
src/lib/poems.js                  数据整理、日期及创作统计
cloudfunctions/webReader/         独立的只读服务与网站会话
tests/                           数据约定与接口边界测试
scripts/                         浏览器检查、云端连通检查、管理脚本
```
