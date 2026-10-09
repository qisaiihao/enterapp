# 首启隐私政策确认（2026-10-09）

首次启动必须先阅读并同意《隐私政策》才能进入应用；弹窗复用居中确认框 `AppDialog` 的外观（无描边、32rpx 圆角、胶囊按钮、明暗主题），底部操作说明与 `docs/app-overlay-contract.md` 一致。

## 涉及文件

- `pages/privacy/privacy.vue`：隐私政策正文页，设置页入口 `/pages/privacy/privacy`。
- `components/PrivacyConsentDialog.vue`：居中弹窗，使用 `AppDialog` 的 `defer-answer`，确认后发出 `agree`，取消后发出 `decline`；正文内可点击《隐私政策》打开政策页，不填写内容、不默认勾选。
- `utils/privacyConsent.js`：政策版本、同意记录读写、政策页路径和同意事件 `privacyConsentAccepted` 的唯一来源；`runAfterPrivacyConsent()` 已同意时立即执行，否则等事件。
- `pages/splash/splash.vue`：首启拦截、同意后放行和不同意时的平台处理。
- `App.vue`：启动引导门禁，同意前不登录、不检查更新、不处理 GitHub 深链回调。
- `utils/runtime-bootstrap.js`：`ensureRuntimeOpenid()` 在同意前直接返回 `null`，兜底拦截漏网云调用。
- `utils/runtime-preload.js`：未读/活动徽标初始化和登录后预热延后到同意事件。

## 同意记录与版本更新

- 存储键 `privacyConsentVersion`，值必须等于 `PRIVACY_POLICY_VERSION` 才算已同意，避免旧版本记录沿用。
- 同意一次即写入版本号，同一次启动内不再弹出，后续启动读到相同版本也不会再弹；只有政策版本更新、用户清除应用数据或系统存储读写异常时才会重新出现。
- 存储写入/读取异常时，本次会话内存仍视为已同意，避免当场重复弹窗和 `ensureRuntimeOpenid` 误拦登录；下次启动是否再弹取决于系统存储是否恢复。
- 政策正文有实质更新时，同步修改 `utils/privacyConsent.js` 的 `PRIVACY_POLICY_VERSION` 与政策页首部的更新/生效日期，老用户会再次看到弹窗。
- 只新增存储键、不改版本号时，升级用户不会重复确认；未同意用户每次启动都会看到弹窗。

## 开屏流程

- `onLoad` 先检查同意状态：已同意时同步启动原有开屏放行计时和数据预加载，行为与修改前一致。
- 未同意时展示弹窗，打字动画照常进行，但不开屏放行计时、不发起首屏预加载，也不进入广场；确认前不会因原有 6 秒上限被放行。
- 点击“同意并继续”后写入版本并启动预加载和放行计时；最短展示时长只补足剩余部分，不因弹窗等待额外重复计时。
- 不同意时：App 退出应用，微信小程序调用 `wx.exitMiniProgram`；无法退出的环境提示后重新展示弹窗，不进入应用。
- 弹窗随页面通过 `<app-overlay-host />` 之前的显式引入注册，物理返回键与“不同意”等价。

## 启动引导门禁

- `acceptPrivacyConsent()` 首次写入版本时发出 `privacyConsentAccepted` 事件；`runAfterPrivacyConsent()` 供各处挂载需要同意后才执行的逻辑。
- `App.vue` 的 `onLaunch` 不再直接调用 `loginAndCheckUser()` 和 `checkAndUpdate()`：未同意时注册事件，同意后调用 `startConsentedStartup()`；已同意时行为与修改前一致。
- APP 端 GitHub 回调（启动参数和 `newintent`）同样经 `runAfterPrivacyConsent()` 延后处理，避免深链绕过弹窗写入用户会话。
- 未读/活动徽标初始化、登录后 `getMyInfo` 预热延后到同意事件；文件地址解析和缓存事件桥仍是本地初始化，不受影响。
- `ensureRuntimeOpenid()` 未同意时返回 `null`，H5/App 的 `uniCloud`/`tcb.callFunction` 包装器随后以 `NO_OPENID` 拒绝请求，作为漏网调用的兜底；登录页和开屏预加载只在同意后运行，不受影响。

## 尚未覆盖

- `main.js` 模块加载时的 `ensureTcbReady()` 仍会初始化 CloudBase SDK 并发起匿名登录；不包含 openid 或用户资料，但严格解读仍应先于同意前初始化，后续可与 SDK 初始化时机一起评估。
- 微信小程序分享卡片可直达广场/详情页，不经过开屏；对应场景应由微信官方隐私保护指引（`wx.getPrivacySetting` / `wx.onNeedPrivacyAuthorization`）兜底，尚未接入。
- 设置页内的账号注销流程已于 2026-10-10 接入，见 [应用内注销账号](account-cancellation.md)；隐私政策更新到 2026-10-10 版本，`PRIVACY_POLICY_VERSION` 同步升级，老用户会重新确认一次。

## 验证

- `scripts/test-splash-startup.cjs` 的 `testPrivacyConsent` 覆盖：已同意直接进入、首次启动弹窗阻塞（打字继续、6 秒不放行、不预加载）、同意后写入版本并进入、无法退出时提示并重新展示、弹窗组件事件和政策链接。
- 同文件的 `testAppPrivacyGate` 覆盖：未同意不启动引导、同意事件放行、重复同意不重复启动、已同意直接启动；`testRuntimeOpenidPrivacyGate` 覆盖 openid 门禁和已有 openid 复用。
- 尚未进行真机验证；需要检查 Android/iOS 物理返回键、App 退出行为、微信退出行为、同意前后进入广场的时序和真机弹窗观感。
