# CORS 快速配置指南

## 快速步骤

### 步骤 1：找到 CORS 配置入口

有两种方式进入 CORS 配置：

#### 方式 A：云开发控制台（推荐）
1. 访问：https://console.cloud.tencent.com/tcb
2. 选择环境：`cloud1-5gb0pbyl400845f5`
3. 左侧菜单：云存储
4. 顶部标签：设置 或 安全配置
5. 找到：跨域访问CORS 或 CORS配置

#### 方式 B：对象存储 COS 控制台
1. 访问：https://console.cloud.tencent.com/cos
2. 存储桶列表
3. 找到：`cloud1-5gb0pbyl400845f5-xxx`
4. 点击进入存储桶
5. 左侧菜单：安全管理 > 跨域访问CORS设置

### 步骤 2：添加 CORS 规则

点击"添加规则"或"新增规则"，填写：

| 配置项 | 值 |
|--------|-----|
| 来源 Origin | `*` |
| 操作 Methods | `GET, HEAD` |
| Allow-Headers | `*` |
| Expose-Headers | 留空 |
| Max-Age | `3600` |

### 步骤 3：保存配置

点击"保存"或"确定"，等待 1-5 分钟生效。

### 步骤 4：验证配置

运行测试页面：`pages-debug/test-domain-config/test-domain-config.vue`

点击"3. 测试 CORS 配置"，查看是否显示：
```
✅ CORS 配置已启用
允许的来源: *
```

## 常见界面说明

### 如果看到"自定义安全规则"

这是存储桶的访问权限配置，不是 CORS 配置。你需要：
1. 返回上一级或查找其他标签页
2. 寻找"跨域访问"、"CORS"、"安全配置"等字样
3. 或者切换到"对象存储 COS 控制台"

### 如果看到 JSON 编辑器

直接粘贴以下配置：
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

### 如果看到表单界面

按照步骤 2 的表格填写即可。

## 配置后的验证

### 方法 1：使用测试页面（推荐）
1. 打开小程序测试页面
2. 点击"🚀 一键全部测试"
3. 查看"测试 CORS 配置"的结果

### 方法 2：浏览器验证
1. 打开浏览器开发者工具（F12）
2. 访问：https://636c-cloud1-5gb0pbyl400845f5-1378788263.tcb.qcloud.la/fonts/Huiwen-mincho-compressed.woff2
3. 查看 Network 标签中的响应头
4. 确认存在：`Access-Control-Allow-Origin: *`

### 方法 3：curl 命令验证
```bash
curl -I https://636c-cloud1-5gb0pbyl400845f5-1378788263.tcb.qcloud.la/fonts/Huiwen-mincho-compressed.woff2
```

查看输出中是否包含：
```
Access-Control-Allow-Origin: *
```

## 故障排查

### 问题 1：找不到 CORS 配置入口
**解决**：
- 尝试方式 B（对象存储 COS 控制台）
- 搜索页面中的"CORS"关键词
- 查看所有标签页和侧边栏菜单

### 问题 2：配置后仍然失败
**解决**：
1. 等待 5 分钟后重试
2. 清除小程序缓存：开发者工具 > 清缓存 > 全部清除
3. 重启微信开发者工具
4. 检查配置是否保存成功（刷新页面查看）

### 问题 3：配置被重置
**解决**：
- 检查是否有其他管理员修改了配置
- 确认点击了"保存"按钮
- 尝试使用 CLI 工具配置（见主文档）

### 问题 4：只有部分设备失败
**解决**：
- 可能是 CDN 缓存问题
- 等待更长时间（最多 24 小时）
- 或者联系腾讯云技术支持

## 安全建议

### 开发环境
使用宽松配置便于调试：
```json
{
  "AllowedOrigins": ["*"],
  "AllowedMethods": ["GET", "HEAD"],
  "AllowedHeaders": ["*"]
}
```

### 生产环境
使用严格配置提高安全性：
```json
{
  "AllowedOrigins": ["https://servicewechat.com"],
  "AllowedMethods": ["GET", "HEAD"],
  "AllowedHeaders": ["Range", "Content-Type"],
  "ExposeHeaders": ["Content-Length"],
  "MaxAgeSeconds": 86400
}
```

## 相关链接

- [完整 CORS 配置指南](./cors-config-guide.md)
- [腾讯云 CORS 官方文档](https://cloud.tencent.com/document/product/436/13318)
- [微信小程序字体加载文档](https://developers.weixin.qq.com/miniprogram/dev/api/ui/font/wx.loadFontFace.html)
