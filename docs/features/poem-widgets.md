# 桌面诗歌小组件

在 App 的「设置 → 桌面小组件」选择尺寸、内容来源和色卡，再在系统主屏幕添加 poementer 的「桌面诗歌」。同一设备上，每种尺寸共享各自的设置和当前诗歌。

| 平台 | 纯诗句 | 带应用图标、作者、标题及换诗按钮 |
| --- | --- | --- |
| Android | 1×4 | 2×4，点「换一首」直接更新 |
| iOS 15 起 | 主屏幕小号方形 | 主屏幕中号横卡，使用内置汇文明朝字体与循环换诗图标；iOS 17 起点换诗图标直接更新，iOS 15–16 通过 App 打开后更换 |

颜色可以跟随诗歌的背景和文字色，也可以选用 App 色卡或输入 3 位、6 位 HEX 色值。系统的主屏幕着色模式可能重新着色 iOS 小组件。

默认来源是原创诗随机。自动换诗按北京时间跨日触发，实际刷新时间由系统调度。当天手动换过的诗会保留到下一次手动切换或下一天。长诗优先展示高亮诗句，无高亮时截取正文。

iOS 中号横卡的诗句靠左置于上方，署名靠左置于下方，两处边距相同。七言诗保留原有换行，优先在一行内显示能容纳的分句。宽度不足时在分句之间换行，高度不足时省略后续完整诗句。

- **当日新诗**随机取当天发布的公开诗歌。当天暂无候选时显示空状态并重试。
- **原创诗随机**和**非原创诗随机**分别从对应的公开诗歌中抽取。
- **高赞诗随机**从有赞且点赞数排名前 100 的公开诗歌中抽取。

大卡有两首以上候选时显示切换按钮。最近成功加载的随机来源可以继续显示和手动切换最多 48 小时，当日新诗缓存当天有效。

点击小卡或大卡的诗句区域会打开当前显示的诗歌详情。首次启动需先同意用户协议和隐私政策，账号资料待完善时在保存后进入详情。「换一首」仍由大卡按钮触发。

## 云端

部署 `functions/getPoemWidgetFeed`。CloudBase 网关的公开只读路由为 `GET /poem-widget/feed?source=original`，关联 `getPoemWidgetFeed`，使用现有上海环境的网关域名。请求参数还支持 `today`、`repost`、`popular`。接口只返回公开诗歌的 ID、诗句、标题、作者显示名和色值。部署前可以运行 `npm run test:poem-widget` 检查分类、跨日、审核和可见范围过滤。

[CloudBase HTTP 网关配置](https://docs.cloudbase.net/service/access-cloud-function)

## Android 整包

从项目根目录在 HBuilderX 云打原生安装包或自定义调试基座。原生接收器、布局和后台任务依赖包含在 `uni_modules/poem-widget`。安装新整包后，从系统桌面的小组件列表分别添加 1×4 和 2×4。

## iOS 整包

1. 在 Apple Developer 账号创建 App Group `group.com.poementer.app.widgets`，将它分配给现有主 App `com.poementer.app` 和扩展 `com.poementer.app.PoemWidget`。生成对应的主 App 和扩展描述文件。
2. 在有 Xcode 15 或更高版本与有效签名证书的 Mac 上，将扩展描述文件安装到 Xcode。然后从仓库根目录运行 `bash native/ios/PoemWidget/build-and-stage.sh /path/to/PoemWidget.mobileprovision`。脚本从 `manifest.json` 同步版本号，签名并放置原生扩展、扩展描述文件和 App Group 配置。
3. 在 HBuilderX 使用带同一个 App Group 的主 App 描述文件打 iOS 整包。安装后在主屏幕添加小号或中号的桌面诗歌。

[Apple App Groups 配置](https://developer.apple.com/documentation/xcode/configuring-app-groups) · [DCloud 扩展打包配置](https://uniapp.dcloud.net.cn/plugin/uts-plugin.html#ios-extension)

## 真机验收

在两端添加两种尺寸，选不同来源并保存，分别试原色卡和自定义色卡。确认大卡可在候选间切换、小卡只显示诗句。退出 App 后检查次日自动更新，并测试断网和当日无新诗时的显示。切换设备桌面着色模式后检查文字可读性。

用新整包分别在 App 完全退出和退到后台时点击两种尺寸的诗句区域，核对详情标题。用大卡换诗后再点击诗句，确认详情和换后的诗歌一致。iOS 15–16 还需确认换诗图标打开 App 后触发更换。
