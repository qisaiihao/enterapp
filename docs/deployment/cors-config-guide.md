# 云存储 CORS 配置指南

## 问题现象

小程序中使用 `wx.loadFontFace` 加载云存储字体时报错：
```
loadFontFace:fail A network error occurred.
```

但是使用 `wx.downloadFile` 可以成功下载同一个文件。

## 原因分析

`wx.loadFontFace` 需要字体资源设置正确的 CORS（跨域资源共享）配置，而 `wx.downloadFile` 不需要。

根据微信小程序文档：
- 字体链接访问需满足浏览器同源策略
- 字体文件资源需设置 CORS 的 `Access-Control-Allow-Origin` 为小程序域名：`servicewechat.com` 或者 `*`

## 解决方案

### 方案一：腾讯云控制台配置（推荐）

#### 1. 登录腾讯云控制台

访问：https://console.cloud.tencent.com/tcb

#### 2. 进入云存储设置

1. 选择你的云开发环境（如：`cloud1-5gb0pbyl400845f5`）
2. 点击左侧菜单 "云存储"
3. 点击顶部的 "设置" 或 "安全配置" 标签页

#### 3. 找到 CORS 配置区域

在设置页面中，找到 "跨域访问CORS" 或 "CORS配置" 部分。

#### 4. 添加 CORS 规则

点击"添加规则"或"新增规则"，填写以下配置：

**配置项说明：**
- **来源 Origin**：`*` 或 `https://servicewechat.com`
- **操作 Methods**：`GET, HEAD`
- **Allow-Headers**：`*`
- **Expose-Headers**：留空或 `*`
- **超时 Max-Age**：`3600`

**JSON 格式（如果支持）：**
```json
{
  "AllowedOrigins": ["*"],
  "AllowedMethods": ["GET", "HEAD"],
  "AllowedHeaders": ["*"],
  "ExposeHeaders": [],
  "MaxAgeSeconds": 3600
}
```

#### 5. 保存并等待生效

- 点击"保存"或"确定"
- 配置可能需要 1-5 分钟生效
- 建议清除小程序缓存后重新测试

### 方案二：通过云开发控制台配置

如果在腾讯云控制台找不到 CORS 配置，可以尝试：

1. 访问：https://console.cloud.tencent.com/tcb/storage
2. 选择你的环境
3. 点击存储桶名称进入详情
4. 查找"安全配置" > "跨域访问CORS设置"

### 方案三：使用云开发 CLI（高级）

如果控制台无法配置，可以使用命令行工具：

```bash
# 安装云开发 CLI
npm install -g @cloudbase/cli

# 登录
tcb login

# 配置 CORS
tcb storage:cors:set --env your-env-id --config cors-config.json
```

`cors-config.json` 内容：
```json
[
  {
    "AllowedOrigins": ["*"],
    "AllowedMethods": ["GET", "HEAD"],
    "AllowedHeaders": ["*"],
    "ExposeHeaders": [],
    "MaxAgeSeconds": 3600
  }
]
```

## 注意事项

1. **CORS 配置生效时间**：配置后可能需要等待 1-5 分钟才能生效
2. **缓存问题**：如果配置后仍然失败，尝试：
   - 清除小程序缓存
   - 重新编译小程序
   - 重启微信开发者工具
3. **字体格式**：推荐使用 WOFF 或 TTF 格式，WOFF2 在低版本 iOS 上可能不兼容
4. **文件大小**：大文件（>5MB）加载时间较长，建议压缩字体文件
5. **安全性**：生产环境建议使用 `https://servicewechat.com` 而不是 `*`

## 配置位置参考

根据腾讯云界面的不同版本，CORS 配置可能在以下位置：

### 位置 1：云开发控制台
```
云开发控制台 > 云存储 > 设置 > 跨域访问CORS
```

### 位置 2：对象存储 COS 控制台
```
对象存储 > 存储桶列表 > 选择存储桶 > 安全管理 > 跨域访问CORS设置
```

### 位置 3：云存储详情页
```
云开发 > 云存储 > 点击存储桶名称 > 权限管理 > CORS配置
```

**提示**：如果在云开发控制台找不到 CORS 配置，可以尝试进入"对象存储 COS"控制台，找到对应的存储桶进行配置。

## 相关文档

- [微信小程序 wx.loadFontFace 文档](https://developers.weixin.qq.com/miniprogram/dev/api/ui/font/wx.loadFontFace.html)
- [腾讯云存储 CORS 配置](https://cloud.tencent.com/document/product/436/13318)
- [小程序字体使用指南](../小程序字体.md)

## 常见问题

### Q: 为什么 downloadFile 成功但 loadFontFace 失败？

A: `downloadFile` 不受 CORS 限制，但 `loadFontFace` 需要 CORS 配置，这是浏览器同源策略的要求。

### Q: 可以使用本地文件路径吗？

A: 可以，但需要先用 `downloadFile` 下载到本地文件系统（`wx.env.USER_DATA_PATH`），然后使用本地路径加载。但这会增加首次加载时间和本地存储占用。

### Q: 推荐使用云端字体还是本地字体？

A: 推荐使用云端字体（配置好 CORS），优点：
- 不占用本地存储
- 不需要下载等待
- 可以利用 CDN 加速
- 更新字体无需重新下载
