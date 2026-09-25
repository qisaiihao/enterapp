# 统一官网部署

现在只维护本项目即可。旧官网的海报图片、APK 已复制进项目，构建不依赖原来的 `C:\Users\qisaihao\www.poementer.com` 目录。本次没有修改原目录。

## 入口与分流

| 地址 | 行为 |
| --- | --- |
| `/` | 有手动选择时沿用选择；否则手机／平板竖屏进入旧官网，电脑与移动设备横屏进入阅读版 |
| `/classic/` | 直接打开海报官网，提供 APK、网页版 App 和「切换阅读版」 |
| `/?site=reader#/home` | 切换到阅读版并记住选择 |
| `/classic/?site=classic` | 切换到旧官网并记住选择 |
| `/#/poems?id=作品ID` | 直接打开诗歌，不被设备判断或网站偏好拦截 |
| `/app-release.apk` | 下载随网站部署的 Android 安装包 |

网站偏好保存在浏览器的 `poementer:site` 项中。手动参数生效后会从地址栏移除。清除该项即可恢复自动判断。浏览器禁止本地存储时仍可打开官网，选择不会持久保存。

只在访问根入口时判断，不监听旋转屏幕、窗口缩放而跳站。电脑窄窗口仍按电脑处理；iPad 的桌面风格 UA 结合触摸能力识别。设备识别依赖浏览器提供的信息，任何设备都能通过两个切换入口自行选择。

阅读版保持现有只读功能：阅读、搜索、登录查看个人公开作品；创作和交流通过 App。

## 部署范围

**本次合并的是两套官网前端和 APK，不是将所有后端服务搬到服务器。**

- 海报官网、新阅读网站、图片、字体和 APK：同一个 `dist/`，部署在同一台服务器、同一个域名下。
- 网页版 App：保留旧官网已有的云端体验地址 `https://cloud1-5gb0pbyl400845f5-1378788263.tcloudbaseapp.com/`。点击后会进入该地址；没有打包旧目录残留的 H5 编译文件。
- 阅读网站的诗歌与账号接口：继续使用现有 CloudBase `webReader` 云函数。
- 不包含 `more/`、`audio-viz/`、`linear-go/`、旧插件、`.claude` 或旧服务器配置。
- 保留原网站的百度域名验证文件。

## 构建与本地检查

```powershell
npm ci
npm run check:quality
npm run preview
```

预览地址：`http://127.0.0.1:4173/`。电脑直接打开阅读版；`http://127.0.0.1:4173/classic/` 可查看旧官网。

保持预览服务运行，另开终端：

```powershell
$env:WEB_URL = 'http://127.0.0.1:4173'
npm run test:entry
npm run test:browser
```

入口测试覆盖桌面／手机、窄电脑窗口、横竖屏、双向切换、选择记忆、诗歌直达、禁用存储、海报图片加载、APK 字节一致性与插件目录排除。浏览器测试使用示例账号；不提交真实用户数据。手机检查使用浏览器模拟，仍需真机验收。

## 宝塔 / Nginx

1. 构建完成后，将 **`dist/` 里面的全部文件** 上传到站点根目录。根目录直接包含 `index.html`、`classic/`、`assets/`、`classic-assets/` 和 `app-release.apk`。
2. 使用 [Nginx 路径配置](deploy/nginx.locations.conf) 替换现有同类 `location` 块，保留现有域名、HTTPS 证书和证书续期配置。阅读版使用 hash 路由，不需要 SPA 路径重写。
3. 移除旧官网中把 `/static/` 指向 `/web/static/` 的过时 alias，并停用小插件的路径配置。发布时使用新的构建目录；仅覆盖文件不会自动清掉服务器上旧的 More／插件目录。
4. 将正式域名加入 CloudBase Web 安全来源（如果已配置则无需重复）。`VITE_` 配置中不得放管理员密钥。
5. 检查电脑访问、手机竖屏访问、来回切换、直接分享诗歌、APK 下载和云端网页版 App。

本次仅生成本地部署产物，没有发布到正式服务器。

## 后续更新

- 新版 APK：替换 `public/app-release.apk` 后重新构建部署。当前文件原样来自旧官网根目录，未替换成 `static/images/` 里的另一个副本。
- 海报图片：更新 `public/classic-assets/`。
- 网页版 App 地址：修改 `classic/index.html` 中两个网页版入口。
- 设备分流和偏好：`src/lib/siteEntry.js`。
- 新网站页面：继续修改 `src/App.vue` 和相关组件。

更新后执行 `npm run check:quality`，统一输出仍然是一个 `dist/`。
