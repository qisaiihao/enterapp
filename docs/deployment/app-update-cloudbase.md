# App 腾讯云更新与版本管理

更新日期：2026-11-11。本文接替 [2026-09 的 uniCloud 更新迁移记录](app-update-migration.md)，旧文保留作为历史验收记录。

## 迁移边界

- 新客户端版本预设为 `1.7.9` / Android `versionCode 179`。更新检查只调用现有 CloudBase 的 `checkAppUpdate`，没有 uniCloud 客户端回退。
- 旧客户端继续调用原来的 uniCloud 三个入口：`checkAppUpdate`、`uni-upgrade-center/checkVersion`、`checkWgtUpdate`。它们通过公共模块优先读取腾讯云已发布版本；超时、异常或腾讯云暂无适用更新时，保留原 uniCloud 版本记录回退。
- 一键取号和其余 uniCloud 连接保留。未删除旧函数、旧版本表或旧下载文件，也未设置自动停用时间。
- 已使用统一更新协议 2 的旧客户端，可以通过兼容 WGT 切换到腾讯云更新；本地保存的正式 `1.7.0`、`1.7.8` 包已核对含此协议。仍使用旧插件协议、无法确认原生版本的客户端，继续通过正式签名 APK 迁移。App 资源编译通过不等于包已发布或用户已升级。

```text
新 App ──CloudBase SDK──> 腾讯云 checkAppUpdate ──> app_update_releases
旧 App ──原 uniCloud 接口──> 腾讯云 HTTP 更新接口 ──> 同一版本表
                       └─ 异常 / 暂无适用更新 ──> 原 uniCloud 版本表
安装包下载 ──> CloudBase 云存储的 HTTPS CDN 地址
```

## 日常发布

双击项目根目录的 `App版本管理.cmd`，或运行 `npm run app:versions`。工具是本机 Windows 桌面窗口，复用 `tcb login` 的管理员登录态，不需要把密钥放入项目或 App。

1. 在 HBuilderX 打正式 APK，保持包名 `com.poementer.app`、原签名证书以及递增的 Android `versionCode`。
2. 点击「新建版本」→「选择安装包并上传」。工具自动读取版本、校验 AppID、包名、签名、SHA-256，并完整下载 CDN 文件核对。
3. 填写更新标题和说明。首次腾讯云迁移 APK 勾选「作为旧版 App 迁移整包」。旧插件协议会强制提示迁移整包；现有统一更新客户端是否强制，由「强制更新」开关决定。
4. 点击「保存草稿」。上传和草稿不会触发用户更新。
5. 完成真机验收后点击「发布选中版本」。新文件写保护约需 3 分钟生效，工具会阻止提前发布。点击发布后才进入更新接口的有效版本列表。可用底部设备版本预览，检查不同版本会收到哪个更新。
6. 需要停止推送时点击「下线选中版本」。下线保留文件及记录，不会降级已安装用户；已拿到下载地址的用户仍可下载。

预览仅计算腾讯云有效发布记录。旧接口还可能因腾讯云无适用版本而回退到 uniCloud 的历史记录，应同时保留旧环境验收。

发布后的记录不能直接编辑；需先下线，或创建更高版本。多窗口操作采用修订号检查，过期编辑会被拒绝。

历史 APK 可上传归档，但不允许作为腾讯云新版本发布。识别新后端使用编译资源中的更新模块标记；此检查不能代替真机测试。

### WGT 与 iOS

- WGT 必须填写最低兼容原生版本，最高原生版本可选。切换更新云函数本身是前端逻辑变更，可通过 WGT 下发；修改原生插件、权限或依赖运行基座的新能力时应发 APK。
- `1.7.8` 原生包安装 `1.7.9` WGT 后，原生版本仍为 `1.7.8`，资源版本变为 `1.7.9`，重启后更新检查只走腾讯云。首次验证可将原生兼容范围限制为 `1.7.8` 至 `1.7.8`；更老原生包应分别验证后再扩大范围。
- 已核对的 `1.7.0`、`1.7.8` 包编译器版本均为 HBuilderX `5.07`。正式 WGT 应使用与目标基座匹配的编译器，或完成跨版本兼容测试；npm 构建成功不能证明旧基座运行兼容。见 [DCloud 版本说明](https://uniapp.dcloud.net.cn/tutorial/version.html)。
- 当前选择规则为整包优先。若同时发布适用的 `1.7.9` APK 和 WGT，`1.7.8` 用户会收到 APK；仅发布兼容 WGT 时才会收到 WGT。需要“较新旧版用 WGT、更早旧版用 APK”的同时分流时，须先调整并验证选包规则，不能仅靠迁移整包复选框实现。
- 新客户端可以下载兼容 WGT；旧插件接口只接收明确标记的迁移整包。`checkWgtUpdate` 不会把 APK 当作 WGT 安装。
- 静默安装仅对 WGT 生效，不能与强制更新同时选择。
- iOS 整包使用 App Store 的长期 HTTPS 链接；它不使用 APK，也不勾选 Android 迁移入口。iOS 实际上架和升级流程尚未真机验收。

## 存储与权限

使用现有环境 `cloud1-5gb0pbyl400845f5`（上海）。CloudBase 云存储自带 CDN 分发，下载不经过云函数转发：[官方云存储说明](https://docs.cloudbase.net/storage/introduce)。当前下载域名为：

`https://636c-cloud1-5gb0pbyl400845f5-1378788263.tcb.qcloud.la`

对象路径为 `app-updates/{appid}/{类型}/{版本}/{sha256}.apk` 或 `.wgt`。不同内容使用不同路径，避免覆盖旧文件及 CDN 缓存冲突。采用长期 HTTPS 地址，不保存临时签名 URL。存储和 CDN 流量仍按现有 CloudBase 套餐计费。

版本集合 `app_update_releases` 为 `ADMINONLY`；对外云函数仅提供更新查询。发布、下线及上传只通过本机管理员工具执行。

现有存储桶兼容业务上传权限；每个安装包对象在上传前追加客户端写入保护。三个可指定路径的业务上传函数 `upload`、`uploadAvatar`、`uploadCollagePoetry` 也拒绝写入 `app-updates` 路径。服务端管理员 SDK 可操作该目录，故云端管理凭据仍应只留在本机登录态中。

权限规则有传播延迟，工具在上传后保留发布等待时间；当前使用逐对象规则，不更改其他业务目录的权限。发布很多历史版本后若达到规则长度上限，上传会停止，应先迁移安装包到独立存储桶；不要删除已发布包的保护来继续上传。规则语法与生效延迟见 [CloudBase 安全规则](https://docs.cloudbase.net/storage/security-rules)。

## 本次部署记录

- 已创建腾讯云版本集合及索引，部署 `checkAppUpdate`，HTTP 路径 `/app-update/check` 已可用。
- 已上传 uniCloud 公共模块 `app-update`，HBuilderX 已更新其依赖云函数；重新下载模块并与本地文件比对一致。
- 已迁入 `1.7.0 / 170`、`1.7.8 / 178` 两个历史正式 APK，分别完整下载核对 SHA-256，保存为未发布草稿，原 Aliyun 文件保留。
- `1.7.9 / 179` WGT 已于 **2026-11-11 22:16:46（北京时间）** 发布；未发布此次迁移的 APK。
- 本次发布为 **Android WGT，原生兼容范围 `1.7.0`～`1.7.8`，普通更新提示，非强制、非静默**。更高版本不会被降级；资源已到 `1.7.9` 的用户不会重复收到此包。
- 原 uniCloud 函数、版本数据、下载文件和一键取号继续保留。实际手机安装、数据保留、首次重启及一键取号回归仍需真机验收，不能据此关闭 uniCloud。

### 1.7.9 WGT 发布核验

- 使用用户于 2026-11-11 22:10:18 打包的 `unpackage/release/__UNI__E0A1A41.wgt`，大小 `10,120,887` 字节，SHA-256 为 `8e872735e37a513d49f1b8a23f4c6b69741c5a3a01d9190acdfbf60d6081cf97`。
- AppID、资源版本 `1.7.9 / 179`、腾讯云更新代码、ZIP 完整性及文件名唯一性检查通过。编译器为 `5.07`，与本地 `1.7.0`、`1.7.1`、`1.7.5`、`1.7.8` 正式包相同；这些包的原生权限声明一致，内置汇文明朝文件 SHA-256 一致。
- 上传后及发布前均完整下载 CDN 文件校验 SHA-256。存储对象写保护已设置，等待生效后才发布。
- 唯一有效腾讯云发布记录为 `__UNI__E0A1A41-android-wgt-1.7.9`，修订号 `2`。两个历史 APK 仍为未发布草稿，不会抢先下发整包。
- 使用旧 APK 内的云空间配置，通过 uniCloud SDK 实际请求线上 `checkAppUpdate`：`1.7.0`～`1.7.8` 九个版本全部返回 `101 / wgt / 1.7.9` 和本次腾讯云下载地址。
- 腾讯云 HTTP 与云函数调用核验通过；另验证了原生 `1.7.0`、资源 `1.7.8` 的跨版本情况，以及资源已为 `1.7.9`、更高版本不再下发更新。发布前 45 组原生/资源版本组合均通过选包验证，46 项更新回归测试通过。
- 发布记录、下载信息和线上响应留存在 `unpackage/app-update-migration/releases/`。这属于服务端及包文件核验，不代表已经完成所有旧机型的实际安装验收。

## 运维与备份

工具依赖本机 Node.js、Python（含 Tk）、HBuilderX 及 CloudBase CLI。HBuilderX 路径、AppID、签名指纹、环境和下载域名见 `scripts/app-versions/config.json`；该文件无密钥。登录失效时先运行 `tcb login`，然后刷新版本列表。

- 腾讯云部署：`node scripts/deploy-app-update.cjs`（会备份旧函数、部署并核对 HTTP/SDK）。
- 同步共享策略：`node scripts/sync-app-update.cjs`；`--check` 仅检查副本一致性。
- 业务上传目录保护：`node scripts/protect-app-packages.cjs`；基于线上备份追加最小路径检查，保留线上其他逻辑。
- uniCloud 公共模块上传：HBuilderX 的 `cli cloud functions --upload common --prj enterkey_uni --provider aliyun --name app-update --force`。上传会更新依赖函数。
- 本机备份：`unpackage/app-update-migration/`，包括 `history/` 版本操作前记录、`storage-rules/` 规则修改前快照、`storage-protection/` 上传函数备份、`deploy/` 腾讯云部署记录及 `unicloud-before-20261111/` 旧 uniCloud 源码。此目录被 Git 忽略，需自行保留。

如需临时停用旧接口的腾讯云桥接，把 `uniCloud-aliyun/cloudfunctions/common/app-update/cloudbase.json` 的 `enabled` 改为 `false`，重新上传公共模块即可恢复旧版查 uniCloud 记录。新 App 仍只用腾讯云，应通过版本下线或修复腾讯云服务处理故障。

新旧入口都保留版本请求日志，可辅助观察迁移情况；日志不是完整安装覆盖率统计，长期未启动用户不会产生请求。停用 uniCloud 必须另行核实旧版本存量及一键取号的后续方案。

## 验证

执行 `npm run test:app-update` 覆盖客户端升级、旧协议桥接和回退、版本管理发布校验、并发修订冲突及保留目录；`python scripts/app-versions/test_gui.py` 检查窗口布局与表单映射。

本次 `npm run check:quality`、`npm run build:app`、`npm run build:mp-weixin` 均已通过。线上已验证受保护路径明确返回 `STORAGE_EXCEED_AUTHORITY`、普通测试文件可上传、匿名 SDK 可检查更新。未改字体加载路径、注册时机或绘制名称。原生桌面截图工具超时，管理窗口尚未完成人工视觉验收。

可手动执行 `node scripts/test-app-update-storage-live.cjs` 进行线上匿名写权限及 SDK 验证。它仅操作随机命名测试文件，等待规则传播后验证，结束时清理测试文件和对应临时规则；不会上传或发布正式版本。
