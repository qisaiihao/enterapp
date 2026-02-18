# 快速开始指南

## 立即使用腾讯云 SMS

### 1. 设置环境变量（必需）

在 uniCloud 控制台设置以下环境变量：

```
TENCENT_SECRET_ID=你的SecretId
TENCENT_SECRET_KEY=你的SecretKey
```

**在哪里设置？**
1. 打开 [uniCloud 控制台](https://unicloud.dcloud.net.cn/)
2. 选择你的服务空间
3. 进入"云函数" > "sendSmsCode"
4. 点击"云函数配置"
5. 找到"环境变量"部分
6. 添加上述两个变量

### 2. 确认配置文件

打开 `config.json`，确认以下配置正确：

```json
{
  "provider": "tencentcloud",
  "tencentcloud": {
    "sdkAppId": "1401056037",
    "signName": "江门市新会区回车键网络",
    "templateId": "2601313"
  }
}
```

### 3. 安装依赖并部署

```bash
# 进入云函数目录
cd uniCloud-aliyun/cloudfunctions/sendSmsCode

# 安装依赖
npm install

# 在 HBuilderX 中右键云函数，选择"上传部署"
```

### 4. 测试

发送测试请求：

```javascript
uniCloud.callFunction({
  name: 'sendSmsCode',
  data: {
    phone: '13800138000',
    scene: 'binding'
  }
}).then(res => {
  console.log('发送结果:', res);
});
```

## 切换回 uniCloud

如果需要切换回 uniCloud 短信服务：

1. 修改 `config.json`：
```json
{
  "provider": "unicloud"
}
```

2. 重新部署云函数

## 测试模式

开发时可以启用测试模式，避免实际发送短信：

```json
{
  "testMode": true
}
```

测试模式下使用固定验证码：`123456`

## 需要帮助？

查看完整文档：[README.md](./README.md)
