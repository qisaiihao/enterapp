# 首启协议确认

自定义首启弹窗以 `AppDialog` 分节展示《用户协议》和《隐私政策》全文。滑到两份文件末尾或弹窗打开满 10 秒后，“同意并继续”即可点击。“不同意”始终可选。设置页也提供两份文件的查阅入口。

## 涉及文件

- `pages/privacy/privacy.vue`：两份文件共用的阅读页。`/pages/privacy/privacy` 展示《隐私政策》，`?document=agreement` 展示 `pages/privacy/user-agreement.js` 中的《用户协议》。
- `components/LegalDocument.vue`：弹窗和设置页共用的协议正文。
- `components/PrivacyConsentDialog.vue`：全文按用户协议、隐私政策的顺序排列，两个操作按钮固定在滚动区下方。`AppDialog` 的 `require-scroll-to-confirm` 管理确认按钮状态，`defer-answer` 在退出动画后提交选择。
- 文末留出 8 像素空白。滚动区接近底部时启用“同意并继续”；若触底事件漏发，文末空白进入可视区时也可启用按钮。仍由用户点击按钮提交同意。
- 首启弹窗通过 `scroll-confirm-timeout-seconds` 从每次打开时计时 10 秒。到时即可手动同意，文末解锁或关闭弹窗时清除计时。
- `utils/privacyConsent.js`：管理两份文件的版本、同意记录、阅读页入口和 `privacyConsentAccepted` 事件。`runAfterPrivacyConsent()` 已同意时立即执行，否则等待同意事件。
- `pages/splash/splash.vue`：首启拦截、同意后放行和不同意时的平台处理。
- `App.vue`：启动引导门禁，同意前不登录、不检查更新、不处理 GitHub 深链回调。
- `utils/runtime-bootstrap.js`：`ensureRuntimeOpenid()` 在同意前直接返回 `null`，兜底拦截漏网云调用。
- `utils/runtime-preload.js`：未读/活动徽标初始化和登录后预热延后到同意事件。

## 同意记录与版本更新

- 存储键 `privacyConsentVersion` 记录 `PRIVACY_CONSENT_VERSION`，由 `PRIVACY_POLICY_VERSION` 和 `USER_AGREEMENT_VERSION` 组成。旧记录只有隐私政策版本号，升级后须确认一次两份文件。
- 同意时写入组合版本。同一启动会话内或下次启动读到相同版本时直接放行。
- 存储写入/读取异常时，本次会话内存仍视为已同意，避免当场重复弹窗和 `ensureRuntimeOpenid` 误拦登录；下次启动是否再弹取决于系统存储是否恢复。
- 政策正文有实质更新时，同步修改 `utils/privacyConsent.js` 的 `PRIVACY_POLICY_VERSION` 与政策页首部的更新/生效日期，老用户会再次看到弹窗。
- 用户协议有实质更新时，同步修改正文和 `USER_AGREEMENT_VERSION`。

## 开屏流程

- `onLoad` 先检查同意状态：已同意时同步启动原有开屏放行计时和数据预加载，行为与修改前一致。
- 未同意时展示弹窗，打字动画照常进行，但不开屏放行计时、不发起首屏预加载，也不进入广场；确认前不会因原有 6 秒上限被放行。
- 点击“同意并继续”后写入版本并启动预加载和放行计时；最短展示时长只补足剩余部分，不因弹窗等待额外重复计时。
- 不同意时，Android 退出应用，微信小程序调用 `wx.exitMiniProgram`。iOS、H5 或小程序退出失败时提示并再次显示弹窗。
- 弹窗随页面通过 `<app-overlay-host />` 之前的显式引入注册，物理返回键与“不同意”等价。

## 启动引导门禁

- `acceptPrivacyConsent()` 首次写入版本时发出 `privacyConsentAccepted` 事件；`runAfterPrivacyConsent()` 供各处挂载需要同意后才执行的逻辑。
- `App.vue` 的 `onLaunch` 不再直接调用 `loginAndCheckUser()` 和 `checkAndUpdate()`：未同意时注册事件，同意后调用 `startConsentedStartup()`；已同意时行为与修改前一致。
- H5 未确认当前版本时，直接打开原创、详情等业务页会先进入开屏的协议确认流程，同意后进入原创页。两份文件的阅读页可直接访问，未同意时从阅读页返回至开屏。已有当前版本确认记录的直链保留原目标页。
- APP 端 GitHub 回调（启动参数和 `newintent`）同样经 `runAfterPrivacyConsent()` 延后处理，避免深链绕过弹窗写入用户会话。
- 未读/活动徽标初始化、登录后 `getMyInfo` 预热延后到同意事件；文件地址解析和缓存事件桥仍是本地初始化，不受影响。
- `ensureRuntimeOpenid()` 未同意时返回 `null`，H5/App 的 `uniCloud`/`tcb.callFunction` 包装器随后以 `NO_OPENID` 拒绝请求，作为漏网调用的兜底；登录页和开屏预加载只在同意后运行，不受影响。

## 设备标识符与隐私合规（2026-11-23）

- `utils/system-info.js` 的 `getDeviceInfoCompat()` 与 `getLegacySystemInfo()` 在用户同意隐私政策前不再调用 `uni.getDeviceInfo()` / `uni.getSystemInfoSync()`，避免 uni-app 运行时提前读取设备标识（HarmonyOS 上为 OAID，审核报告常表述为 IMEI）；同意后行为与修改前一致。
- 同意前的平台判断只依赖 `getAppBaseInfo` / `getWindowInfo` / 系统设置等不涉及设备标识的接口；`mp-weixin` 字体缓存清理等启动逻辑在非小程序环境本就提前返回，不受影响。
- `pages-admin/activity-notice-management/notice-cropper.vue` 与 `pages-collage/collage-studio/collage-studio.vue` 的 `uni.getSystemInfoSync()` 改为 `getWindowInfoCompat()`，只读取窗口尺寸，不触碰设备标识。
- 隐私政策新增“设备标识符”收集说明及 DCloud uni-app 运行框架条目；`PRIVACY_POLICY_VERSION` 升级到 `2026-11-23`，老用户会重新确认一次。

## Android 打包与华为应用市场

- 普通 Android 包默认使用开屏页的自定义 `AppDialog`。`androidPrivacy.json` 的 `prompt` 为 `none`，以本地记录的协议版本判断是否需要确认。自定义弹窗同意时调用 `plus.runtime.agreePrivacy()`，拒绝退出时调用 `plus.runtime.disagreePrivacy()`。
- 华为专属包使用 `prompt: template`。DCloud 原生提示框在应用启动前展示。原生同意后，`hasAcceptedPrivacyConsent()` 将同意状态同步到本地版本记录，开屏页直接放行。 [DCloud Android 隐私提示框文档](https://uniapp.dcloud.net.cn/tutorial/app-privacy-android.html)
- 华为原生模板及二次确认框都保存在 `androidPrivacy.json`。两处协议链接使用 `hrefLoader: system` 打开 CloudBase H5 阅读页。 [隐私政策](https://cloud1-5gb0pbyl400845f5-1378788263.tcloudbaseapp.com/#/pages/privacy/privacy)
- 更新协议时，让 `androidPrivacy.json` 的 `version` 与 `utils/privacyConsent.js` 的 `PRIVACY_CONSENT_VERSION` 一致。

1. 打普通包时执行 `npm run app:privacy:default`，然后在 HBuilderX 云打包 Android。
2. 打华为专属包时执行 `npm run app:privacy:huawei`，然后在 HBuilderX 使用原包名和签名证书云打包 Android。打包结束后执行 `npm run app:privacy:default`，恢复普通包配置。
3. `npm run check:android-privacy` 会报告当前模式。弹窗模式随 Android 整包发行，切换后需重新云打包安装。

## 尚未覆盖

- `main.js` 模块加载时的 `ensureTcbReady()` 仍会初始化 CloudBase SDK 并发起匿名登录；不包含 openid 或用户资料，但严格解读仍应先于同意前初始化，后续可与 SDK 初始化时机一起评估。
- 微信小程序分享卡片可直达广场/详情页，不经过开屏；对应场景应由微信官方隐私保护指引（`wx.getPrivacySetting` / `wx.onNeedPrivacyAuthorization`）兜底，尚未接入。
- 设置页内的账号注销流程已于 2026-10-10 接入，2026-10-13 改为删除账号、发布内容及关联数据，2026-10-14 明确保留安全审计与备案登录日志，见 [应用内注销账号](account-cancellation.md)；隐私政策更新到 2026-10-14 版本，`PRIVACY_POLICY_VERSION` 同步升级，老用户会重新确认一次。

## 验证

- `scripts/test-splash-startup.cjs` 的 `testPrivacyConsent` 覆盖普通 Android 包的首次启动、旧版同意记录、同意和拒绝的原生状态同步，以及华为包原生同意后直接进入。
- `scripts/test-dialog-motion.cjs` 覆盖文末可见性检测、10 秒解锁、手动确认、等待期间可拒绝，以及重开弹窗时重新计时。
- 同文件的 `testAppPrivacyGate` 覆盖：未同意不启动引导、同意事件放行、重复同意不重复启动、已同意直接启动；`testRuntimeOpenidPrivacyGate` 覆盖 openid 门禁和已有 openid 复用。
- 同文件的 `testH5DirectEntryPrivacyGate` 覆盖：未同意时业务直链转入开屏、开屏与政策页不重定向、已同意时保留目标页面、确认后启动登录。
- H5 浏览器以两种手机尺寸验证了明暗主题、触摸滑动、文末解锁、拒绝后重置和设置页查阅。
- 尚未进行真机验证；需要检查 Android/iOS 物理返回键、App 退出行为、微信退出行为、同意前后进入广场的时序和真机弹窗观感。
