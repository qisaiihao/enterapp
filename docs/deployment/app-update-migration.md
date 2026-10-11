# App 统一更新与旧版迁移发布说明

更新日期：2026-09-28。

## 当前状态

- 迁移版：`versionName = 1.7.0`，Android `versionCode = 170`。用户已确认没有发布过 `versionCode >= 170` 的安装包。
- 客户端已移除 `uni-upgrade-center-app`、`uts-progressNotification`、`uts-openSchema`，不再使用官方更新弹窗或双重检查。
- 原插件的本地备份位于 `unpackage/legacy-update-plugins/`，不参与编译；该目录被 Git 忽略。
- 新客户端只调用 `checkAppUpdate`，共享策略模块为 `common/app-update`，继续使用 `opendb-app-versions`。
- 通过 HBuilderX CLI 上传成功：`app-update` 公共模块、`checkAppUpdate` 云函数。
- 上传空间：阿里云 `poementer`，ID `mp-85244698-6ebe-485e-8f19-2d36212a6ad0`；上传后云端列表已确认存在新函数。
- 两个旧接口 `uni-upgrade-center`、`checkWgtUpdate` 已上传兼容代码。重新下载三个更新入口及公共模块，9 个代码和包配置文件与本地内容一致（JSON 按结构比较）。
- 用户已提供正式 APK 下载地址；下载、签名校验、包名与版本检查，以及安装包内更新入口检查均已完成，详见下方 APK 核验记录。
- 已下载备份两个线上旧函数及版本表 schema；`uni-upgrade-center/index.js` 与本地主入口 SHA-256 一致，管理端代码没有差异。
- 用户回传的 09:57 查询截图确认：`poementer-android-1.7.0` 整包已发布，`legacy_migration: true`、强制且非静默、正式 URL 正确；旧整包 `160` 已退出有效列表，WGT `1.6.7` 保留。
- 首次执行迁移新增时因 schema 缺少字段而失败。已补充并上传 `native_version_code`（int）、`legacy_migration`（bool）和 `max_uni_version`（string）三个可选字段，重新下载线上 schema 后核对一致；原权限、必填字段与其他字段定义保持不变，随后新增成功。
- 用户已确认旧版 App 会弹出升级提示，旧客户端至迁移接口的弹窗链路已验证。
- **尚未完成：** 真机覆盖安装及数据保留验收、新客户端和 WGT 的真实请求与安装验证。弹窗成功不等同于覆盖安装或 WGT 安装成功。
- 本地 `npm run build:app` 生成的是 App 编译资源，不是正式签名 APK。不能把编译通过等同于用户已经能升级。

## 代码入口

| 文件 | 职责 |
| --- | --- |
| [appUpdate.js](../../utils/appUpdate.js) | 获取原生和资源版本、一次检查、缓存、去重、下载、安装、静默 WGT |
| [updateVersion.js](../../utils/updateVersion.js) | 客户端严格分段版本比较 |
| [AppUpdateDialog.vue](../../components/AppUpdateDialog.vue) | 居中升级弹窗、下载进度、失败重试、重启 |
| [settings.vue](../../pages/settings/settings.vue) | 手动检查，绕过无更新缓存 |
| [checkAppUpdate](../../uniCloud-aliyun/cloudfunctions/checkAppUpdate/index.js) | 新协议入口 |
| [common/app-update](../../uniCloud-aliyun/cloudfunctions/common/app-update/index.js) | 云端版本选择和旧协议兼容，共享本地依赖，不额外调用其他云函数 |
| [旧 checkVersion](../../uniCloud-aliyun/cloudfunctions/uni-upgrade-center/checkVersion/index.js) | 向旧客户端下发明确标记的迁移整包 |
| [旧 checkWgtUpdate](../../uniCloud-aliyun/cloudfunctions/checkWgtUpdate/index.js) | 保留旧响应约定，不把 APK 冒充 WGT 下发 |

## 版本约定

所有用于更新判断的版本名称采用三段非负整数：`major.minor.patch`，例如 `1.7.0`、`1.7.10`。不接受 `170`、`1.7`、`1.7.0-beta` 或前导零。

| 名称 | 来源 / 示例 | 含义 |
| --- | --- | --- |
| `appVersion` | `plus.runtime.version`，例如 `1.7.0` | 原生安装包版本名称 |
| `wgtVersion` | `getProperty().version`，例如 `1.7.1` | 当前资源版本名称 |
| Android `versionCode` | manifest 中的 `170` | 必须保留的递增打包序号，不参与分段版本比较 |
| 发布记录 `version` | `1.7.1` | 目标包版本名称 |
| WGT `min_uni_version` | `1.7.0` | 最低兼容原生安装包版本，必填 |
| WGT `max_uni_version` | 可选，例如 `1.7.0` | 最高兼容原生安装包版本，包含边界 |

安装迁移整包后，原生与资源版本均为 `1.7.0`。随后发布 `1.7.1` WGT，资源版本变为 `1.7.1`，原生版本仍为 `1.7.0`。

APK 文件名不参与判断，可以命名为 `poementer-1.7.0.apk`。覆盖安装必须保持原包名 `com.poementer.app` 和原正式签名证书。

manifest 已显式声明 Android `REQUEST_INSTALL_PACKAGES`，用于后续 APK 更新请求；系统仍可能要求用户允许此应用安装未知来源应用。

## 新客户端协议与行为

请求：

```json
{
  "appid": "__UNI__E0A1A41",
  "platform": "android",
  "protocolVersion": 2,
  "appVersion": "1.7.0",
  "wgtVersion": "1.7.0"
}
```

响应码：

| code | 含义 |
| --- | --- |
| `0` | 检查成功，无更新，`hasUpdate: false` |
| `101` | WGT 更新，`type: wgt` |
| `102` | 整包更新，`type: native_app` |
| `-10` | 新资源要求更高原生版本，但暂无合适整包 |
| `-100` | 查询失败 |
| `-102` | 请求参数或协议无效 |
| `-422` | 有效发布记录配置错误 |

选择规则：

1. 按应用和稳定版标记分页读取，过滤目标平台。优先使用 `platform`，缺失时兼容 `uni_platform`。
2. 按分段版本大小选择，不按创建时间代替版本比较。
3. 整包优先，但版本必须高于本机原生版本，并且不低于当前资源版本，避免资源回退。
4. WGT 必须高于当前原生及资源版本，且本机原生版本位于其兼容范围内。
5. 最新 WGT 不兼容时，可以选择较旧但仍高于本地版本的兼容 WGT。
6. 同应用、同平台的已发布记录配置错误时返回错误，不能缓存成最新版。发布前请下线或修正历史整数版本记录。

客户端行为：

- 自动检查仅缓存成功的无更新结果 30 分钟；缓存按应用、平台、原生与资源版本隔离。
- 手动检查绕过缓存，并显示无更新或失败信息。
- 检查与下载安装分别去重；读取版本、云请求、下载和安装均设置等待上限。
- 普通更新可以稍后处理；下载时可在弹窗中取消，安装阶段不可关闭弹窗。
- 强制更新不可通过遮罩或系统返回关闭；下载或安装失败后可重试。系统安装本身仍需要用户操作。
- 更新提示在当前页面居中显示；开屏阶段检查到更新时，进入主页面后再显示，避免开屏跳转盖掉提示。下载只在点击“立即更新”后开始。
- `is_silently: true` 的非强制 WGT 自动后台安装，安装成功后立即请求一次应用重启，避免正在运行的页面继续使用旧 JS/CSS 与新资源混合。同进程重复检查不重复安装或重复请求重启。用户会看到一次自动重启。
- 手动确认安装的 WGT 同样在安装成功后立即重启；安装失败时留在更新界面供重试。整包安装仍交给系统安装器，不能把安装 API 回调当作完成覆盖安装。
- `is_mandatory: true` 优先于静默标记。整包永远不走静默安装分支。
- Android 使用 APK 安装流程；iOS 整包打开记录中的 HTTPS 商店链接。
- APK 安装 API 回调只代表已请求安装，不等同于已完成覆盖安装。
- 暂不实现旧插件的 Android 通知栏下载、多应用商店优先级列表和 Harmony 更新；现有项目的 App 更新入口仍限 `APP-PLUS`。

## 旧客户端如何迁移

旧客户端的 `appVersion` 可能是资源包的 `versionCode`，不能用它可靠判断原生版本，也不能把 `168` 机械转换为 `1.6.8`。

本次兼容逻辑采用明确的迁移整包：

- 记录必须同时满足 `type: native_app`、`legacy_migration: true`、`stable_publish: true`、应用及平台匹配。
- 迁移整包版本不得低于旧客户端资源版本，避免资源回退。
- 旧 `uni-upgrade-center` 的 `checkVersion` 返回旧插件认识的 `code: 102`、`type: native_app`、`platform: ["Android"]`、下载地址等字段。
- 该响应固定 `is_mandatory: true`、`is_silently: false`，避免旧插件静默分支的 Promise 悬空问题。
- 无可用迁移整包时不会凭猜测发 WGT。旧 `checkWgtUpdate` 有迁移包时返回 `-10 / needNativeUpdate`，它不能让仅支持 WGT 的调用方直接安装 APK。
- 旧客户端必须能执行原有的官方整包检查步骤。更早的、只调用 WGT 接口的历史客户端需要单独验证或使用外部下载安装引导，不能承诺同一适配覆盖所有未知历史版本。
- 新版安装后只调用新接口，不会再次进入旧迁移分支。
- 旧接口保留原名称；`uni-upgrade-center/index.js` 的后台管理操作及权限检查未删除。

**注意：** 旧客户端会缓存无更新结果，迁移发布后可能需要等缓存到期并重新启动，不能保证所有设备立即弹出更新。

## 发布步骤

### 本次发布的 APK 核验记录（2026-09-28）

- [正式 APK 下载地址](https://mp-85244698-6ebe-485e-8f19-2d36212a6ad0.cdn.bspapp.com/__UNI__E0A1A41__20260928092928_1790559130717_0.apk) 可直接下载，文件大小为 `31,227,954` 字节。
- 包名：`com.poementer.app`；Android 版本：`1.7.0 / 170`；内嵌资源版本：`1.7.0 / 170`；AppID：`__UNI__E0A1A41`。
- `apksigner verify --print-certs` 校验通过。与本地旧包 `unpackage/release/apk/17.apk`（`1.6.8 / 168`）的签名证书 SHA-256 相同：`99c62329cea4b47a4e7dc25ec9517ea81bc2234e7136ee423c32ff48849a84d9`。
- APK SHA-256：`BADDD9E28CB41B925AB0F525B63E2A140B009DA70C932EB224F15CB12E02FCD0`。
- 已包含 `REQUEST_INSTALL_PACKAGES`。内嵌 `app-service.js` 包含 `checkAppUpdate` 及自定义更新页，不包含旧 `checkWgtUpdate` 调用或旧插件弹窗路径。
- 以上是静态核验，只证明覆盖升级的必要条件，与所有历史签名是否一致、系统安装成功及数据保留仍需分别验证。
- 本地下载副本：`unpackage/app-update-release/poementer-1.7.0.apk`。
- 线上旧函数及 schema 的只读备份：`unpackage/app-update-release/cloud-backup-20260928/uniCloud-aliyun/`。该备份项目绑定同一线上空间，只供回滚取文件，**不要从备份项目执行上传或数据库初始化**。
- schema 修改前副本单独保存在 `unpackage/app-update-release/opendb-app-versions.before-migration.schema.json`；备份项目中的 schema 文件现用于下载复核，已是补齐字段后的版本。旧函数备份未修改。

已收到用户执行 [只读审计 JQL](../../uniCloud-aliyun/database/app-update-release-audit.jql) 的结果。CLI 已可上传和下载函数，但当前可用命令没有执行 JQL 或读取集合数据的入口，以下数据库步骤需在 HBuilderX 中运行。JQL 使用方式见 [DCloud 官方文档](https://doc.dcloud.net.cn/uniCloud/jql-runner.html)。

[1.7.0 迁移记录](app-update-release-1.7.0.json) 已同步为当前已发布配置（`stable_publish: true`，固定 ID）。无需重复导入。它是普通发布数据 JSON，不是 `db_init.json`，不要执行项目级数据库初始化。

### 本次审计结果与数据库操作

| 记录 ID | 类型 / 版本 | 处理 |
| --- | --- | --- |
| `6a11cc13286f7c4eeb439e85` | `native_app / 160` | 设 `stable_publish: false`，保留历史版本和下载地址。不能将该旧 APK 的版本直接改成 `1.7.0`。 |
| `6ab530721c90b6c3a0e8974a` | `wgt / 1.6.7`，最低原生 `1.5.0` | 保留。新 `1.7.0` 不会安装更低资源；切换后的旧接口只选择明确标记的迁移整包。兼容范围字段仅做格式审计，未重新验证旧 WGT 的实际原生兼容性。 |

按顺序分别打开以下文件，确认空间为阿里云 `poementer` 后按 F5；每个文件仅有一个数据库操作，避免 JQL 调试器只执行最后一条语句的问题：

1. [新增并发布 1.7.0](../../uniCloud-aliyun/database/app-update-migrate-01-publish.jql)：写入已核验的 APK 链接，`stable_publish: true`、`legacy_migration: true`、强制且非静默。固定 ID `poementer-android-1.7.0` 用于防止重复新增；遇到重复键先核对现有记录，不能换 ID 盲目重试。
2. [下线旧整包 160](../../uniCloud-aliyun/database/app-update-migrate-02-retire-160.jql)：只更新匹配确切 ID、应用、类型和旧版本的记录，首次预期 `updated: 1`。若第一步失败，先不要执行此步。
3. 重跑 [只读审计](../../uniCloud-aliyun/database/app-update-release-audit.jql)：有效记录应为 `1.7.0` 整包和 `1.6.7` WGT；旧 `160` 不应再出现在有效列表。保留并回传结果后再上传旧接口适配。

以上步骤已由用户执行，最终只读查询截图符合预期，脚本保留用于审计，无需再次运行。第一步与第二步不是事务，中间新检查器会因旧 `160` 返回配置错误，完成第二步后消除该冲突。

### 1. 准备正式 APK

在 HBuilderX 中对本次代码执行 Android 正式云打包，确认 `1.7.0 / 170`、原包名、原签名。不要把本次迁移版作为面向旧客户端的 WGT 发布。

使用旧版 App 实机覆盖安装，确认登录数据、主要页面、字体及新设置页检查更新正常。构建测试不能证明签名匹配或系统覆盖安装成功。

把正式 APK 上传到可直接下载的 HTTPS 地址。不能填 WGT 地址、临时过期地址或返回 HTML 的下载介绍页。

### 2. 审计现有数据

继续使用 `opendb-app-versions`。下线或修正同平台已发布的整数版本记录，确保新检查器看到的有效记录都遵循版本约定。历史 WGT 最低版本不能再按资源版本填写。

如果使用外部管理后台维护记录，保留 `legacy_migration` 自定义字段。本次已将所需字段定义同步到线上 [版本表 schema](../../uniCloud-aliyun/database/opendb-app-versions.schema.json)。CLI 上传已有 schema 默认可能跳过，必须查看“上传成功”日志，不能仅看退出码；本次使用 `--force` 更新，并下载比对验证。

### 3. 准备迁移记录

使用 [1.7.0 迁移记录模板](app-update-release-1.7.0.example.json)。模板的 URL 为空且 `stable_publish: false`，不能直接作为上线记录。

- 填入已验证的正式 APK URL。
- `native_version_code: 170` 是发布核对元数据，选择器不把它与版本名称混比。
- 如需创建时间，填入发布时的毫秒时间戳；不要复制旧记录 `_id`。
- 只保留明确经过验证的迁移目标，避免多个同版本、不同内容的稳定版记录。

### 4. 切换旧接口

新公共模块与新入口已经上传。正式发布迁移记录并确认查询结果后，已执行以下命令上传旧接口适配：

```powershell
& 'C:/Users/qisaihao/HBuilderX/cli.exe' cloud functions --upload cloudfunction --prj enterkey_uni --provider aliyun --name uni-upgrade-center --force
& 'C:/Users/qisaihao/HBuilderX/cli.exe' cloud functions --upload cloudfunction --prj enterkey_uni --provider aliyun --name checkWgtUpdate --force
```

上传 `uni-upgrade-center` 前保存云端当前版本作为回滚副本，并核对它的管理端行为与本地一致，避免覆盖其他云端定制。

本次上传日志均为“云函数上传完成”。部署后下载副本位于 `unpackage/app-update-release/cloud-verify-20260928/`，与修改前回滚备份分开保存。三个更新入口和共享模块已核对一致。

如需在 HBuilderX 运行云端检查，已准备各函数的 `.param.json`：`uni-upgrade-center` 模拟旧 `168 / 1.6.8`（预期 `102` 和 `1.7.0` APK）；`checkWgtUpdate` 模拟旧回退（预期 `-10`，没有 APK URL）；`checkAppUpdate` 模拟新 `1.7.0`（预期 `0` 无更新）。这些参数文件仅供调试，不会修改数据库；实际云端运行结果仍待验证。

不要在没有可用迁移 APK 时先切换这两个接口：兼容层不会继续盲发旧 WGT，提前切换会使旧客户端暂时没有可用更新。

### 5. 验证并观察

1. 旧版 `1.6.7 / 1.6.8`：缓存到期后检查更新，收到整包提示，拒绝或取消系统安装后能够重试。
2. 安装迁移 APK：签名匹配，覆盖安装后数据保留，原生和资源版本均为 `1.7.0`。
3. 新版只请求 `checkAppUpdate`，不再调用两个旧接口。
4. 发布测试 WGT `1.7.1`（最低原生 `1.7.0`），验证普通更新及静默更新的安装、重启和版本取值。
5. 模拟失败：网络断开、下载错误、安装失败，不误报最新版，不重复下载安装。
6. 核对两套接口的云端实际用量与计费用量；仍有旧客户端时仍可能触发旧函数低消。

### 6. 回滚与退役

- 停止迁移推送：将迁移记录 `stable_publish` 改为 `false`；需要恢复原更新策略时恢复保存的旧云函数版本。
- 停止某个有问题的 WGT 推送：下线该记录。已经安装的设备需要发布更高版本修复，不能依赖低版本包自动回退。
- 确认旧客户端迁移情况后再考虑停用旧入口；不要只按日期直接删除。
- 如仍保留现有发布后台，`uni-upgrade-center` 的管理操作可能仍有依赖，不能因客户端退役就直接删除整个函数。

## 验证记录

已通过：

- `node scripts/test-app-update.cjs`：31 项测试，覆盖版本比较、兼容范围、原生优先、防回退、旧协议迁移、分页、错误缓存、单次检查、静默安装、失败重试、超时、iOS 商店跳转。
- 2026-09-28 收到正式 APK 后重跑 31 项测试通过；使用正式下载链接进行本地选择器模拟：旧 `168 / 1.6.8` 返回强制整包 `102`，旧 WGT 接口返回 `-10`，新 `1.7.0 / 1.7.0` 返回无更新 `0`。模拟使用记录副本，不代表已经写入线上数据库或完成云端联调。
- `npm run check:quality`：完整质量检查。
- `npm run build:app`：App 构建，包含字体前置检查。
- `npm run build:mp-weixin`：小程序构建及主包大小检查。
- `git diff --check`。

App 构建仍有 CloudBase sourcemap 和动态 / 静态重复导入的提示，但构建成功。未更改字体路径、注册时机或 Canvas 名称。尚未完成本次迁移的真机验收。

## 2026-10-11 首启排版回归

整包升级后首次打开时，若后台还有更高版本的静默 WGT，旧实现会在页面运行期间安装新资源并等待用户下次手动重启。用户报告首次打开图标放大、排版错乱，重启后恢复。现在 WGT 安装成功后立即请求一次重启；手动确认安装 WGT 也采用相同时机。下载或安装失败不重启，整包仍交给系统安装器。

本次 `npm run check:quality`、`npm run build:app` 已通过。尚未用含此修复的正式安装包在真机验收覆盖安装后的首启画面；编译产物不能代替真机验收。
