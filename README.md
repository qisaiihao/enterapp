# 回车键 - 诗歌创作与分享平台

<div align="center">

![回车键](https://img.shields.io/badge/回车键-诗歌平台-blue)
![uni-app](https://img.shields.io/badge/uni--app-Vue2-green)
![CloudBase](https://img.shields.io/badge/CloudBase-腾讯云-orange)
![多平台](https://img.shields.io/badge/多平台-小程序%20H5%20App-purple)

一个优雅的诗歌创作、分享与交流平台，支持多端运行

[功能特性](#-功能特性) • [技术栈](#-技术栈) • [快速开始](#-快速开始) • [项目结构](#-项目结构) • [部署指南](#-部署指南)

</div>

## 📖 项目简介

**回车键**是一个专注于诗歌创作与分享的社交平台，为用户提供优雅的创作环境和丰富的互动功能。项目采用uni-app框架开发，支持微信小程序、H5和App多端运行，后端基于腾讯云开发构建。

### 🌟 核心特色

- **诗意界面**：简洁优雅的UI设计，营造沉浸式创作氛围
- **多端同步**：一次开发，多端运行，数据实时同步
- **智能推荐**：基于用户喜好的个性化内容推荐
- **作品集管理**：支持创建个人作品集，分类管理创作内容
- **社区互动**：点赞、评论、关注等完整的社交功能

## ✨ 功能特性

### 🎨 创作功能
- **诗歌创作**：支持富文本编辑，自定义背景色和文字颜色
- **拼贴诗**：创新的拼贴诗歌创作模式
- **草稿保存**：自动保存草稿，支持离线编辑
- **图片上传**：支持多图片上传，自动压缩优化

### 📱 社交互动
- **广场浏览**：发现页展示精选内容
- **个性化推荐**：基于用户行为的智能推荐
- **点赞评论**：完整的互动体系
- **关注系统**：关注感兴趣的作者
- **消息通知**：实时消息推送

### 📚 内容管理
- **作品集**：创建个人作品集，分类管理
- **收藏夹**：收藏喜欢的作品
- **标签系统**：为作品添加标签，便于分类
- **搜索功能**：全文搜索，快速找到内容

### 👤 用户系统
- **多端登录**：支持微信登录和账号密码登录
- **个人资料**：自定义头像、昵称、签名
- **隐私设置**：支持匿名发布
- **数据统计**：查看个人创作和互动数据

## 🛠 技术栈

### 前端技术
- **框架**：uni-app (Vue 2)
- **UI组件**：自定义组件 + 原生组件
- **状态管理**：Vuex + 本地存储
- **样式**：SCSS + 响应式设计

### 后端技术
- **云服务**：腾讯云开发 (CloudBase)
- **云函数**：Node.js + wx-server-sdk
- **数据库**：云数据库 (MongoDB)
- **存储**：云存储 (文件上传)

### 开发工具
- **IDE**：HBuilderX
- **版本控制**：Git
- **部署**：CloudBase CLI

## 🚀 快速开始

### 环境要求
- Node.js >= 14.0.0
- HBuilderX >= 3.0.0
- 微信开发者工具 (小程序开发)

### 安装步骤

1. **克隆项目**
```bash
git clone https://github.com/your-username/回车键_uni.git
cd 回车键_uni
```

2. **安装依赖**
```bash
npm install
```

3. **配置云开发环境**
   - 在腾讯云开发控制台创建环境
   - 修改 `cloudbaserc.json` 中的环境ID
   - 配置数据库权限

4. **部署云函数**
```bash
# 安装 CloudBase CLI
npm install -g @cloudbase/cli

# 登录腾讯云
cloudbase login

# 部署云函数
cloudbase functions:deploy
```

5. **运行项目**
   - 使用 HBuilderX 打开项目
   - 选择运行平台（H5/小程序/App）
   - 点击运行

### 开发模式

```bash
# H5开发
npm run dev:h5

# 小程序开发
npm run dev:mp-weixin

# App开发
npm run dev:app-plus
```

## 📁 项目结构

```
回车键_uni/
├── pages/                  # 页面文件
│   ├── index/             # 广场首页
│   ├── poem-square/       # 诗歌广场
│   ├── mountain/          # 山（发现页）
│   ├── profile/           # 个人中心
│   ├── post-detail/       # 帖子详情
│   ├── add/               # 发布页面
│   └── ...
├── components/            # 组件库
│   ├── custom-tabbar/     # 自定义标签栏
│   ├── folder-selector/  # 文件夹选择器
│   ├── portfolio-selector/ # 作品集选择器
│   └── ...
├── functions/             # 云函数
│   ├── login/            # 登录
│   ├── getPostList/      # 获取帖子列表
│   ├── vote/             # 点赞
│   ├── addComment/       # 添加评论
│   └── ...
├── utils/                # 工具函数
│   ├── likeService.js    # 点赞服务
│   ├── cloudCall.js      # 云函数调用
│   └── ...
├── static/               # 静态资源
├── api-cache/            # API缓存
├── App.vue               # 应用入口
├── main.js               # 主文件
├── pages.json            # 页面配置
├── manifest.json         # 应用配置
└── cloudbaserc.json      # 云开发配置
```

## 🔧 配置说明

### 云开发配置

在 `cloudbaserc.json` 中配置你的云开发环境：

```json
{
  "envId": "your-env-id",
  "framework": {
    "name": "uni-app",
    "plugins": {
      "uni-app": {
        "version": "2.0.0"
      }
    }
  }
}
```

### 数据库集合

项目使用以下主要集合：
- `users` - 用户信息
- `posts` - 帖子内容
- `comments` - 评论数据
- `votes_log` - 点赞记录
- `messages` - 消息通知
- `portfolios` - 作品集
- `favorites` - 收藏记录

## 📱 多端适配

### 微信小程序
- 支持微信登录
- 使用微信云开发
- 适配小程序UI规范

### H5端
- 使用CloudBase SDK
- 支持浏览器访问
- 响应式设计

### App端
- 支持原生功能
- 相机拍照
- 文件上传

## 🚀 部署指南

### 云函数部署

```bash
# 部署所有云函数
cloudbase functions:deploy

# 部署单个云函数
cloudbase functions:deploy login

# 查看部署状态
cloudbase functions:list
```

### 前端部署

#### H5部署
```bash
# 构建H5版本
npm run build:h5

# 部署到服务器
# 将 dist/build/h5 目录上传到服务器
```

#### 小程序发布
1. 使用微信开发者工具打开项目
2. 点击"上传"按钮
3. 在微信公众平台提交审核

#### App发布
1. 使用HBuilderX云打包
2. 生成安装包
3. 上传到应用商店

## 🤝 贡献指南

我们欢迎所有形式的贡献！

### 如何贡献

1. Fork 本仓库
2. 创建你的特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交你的修改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 打开一个 Pull Request

### 开发规范

- 遵循 Vue.js 官方风格指南
- 使用 ESLint 进行代码检查
- 编写清晰的提交信息
- 添加必要的注释和文档

## 📄 许可证

本项目采用 MIT 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情

## 🙏 致谢

感谢以下开源项目和服务：
- [uni-app](https://uniapp.dcloud.io/) - 跨平台开发框架
- [腾讯云开发](https://cloud.tencent.com/product/tcb) - 云服务支持
- [Vue.js](https://vuejs.org/) - 前端框架

## 📞 联系我们

- 项目地址：[GitHub](https://github.com/your-username/回车键_uni)
- 问题反馈：[Issues](https://github.com/your-username/回车键_uni/issues)
- 邮箱：your-email@example.com

---

<div align="center">

**让诗歌在指尖流淌，让创意在云端绽放** ✨

Made with ❤️ by 回车键团队

</div>