# 回车键 - 诗歌创作与分享平台

<div align="center">

![回车键](https://img.shields.io/badge/回车键-诗歌平台-blue)
![uni-app](https://img.shields.io/badge/uni--app-Vue2-green)
![CloudBase](https://img.shields.io/badge/CloudBase-腾讯云-orange)
![多平台](https://img.shields.io/badge/多平台-小程序%20H5%20App-purple)

一个优雅的诗歌创作、分享与交流平台，支持多端运行

[功能特性](#-功能特性) • [技术架构](#-技术架构) • [快速开始](#-快速开始) • [项目结构](#-项目结构)

</div>

## 📖 项目简介

**回车键**是一个专注于诗歌创作与分享的社交平台，为用户提供优雅的创作环境和丰富的互动功能。项目采用 uni-app 框架开发，支持微信小程序、H5 和 App 多端运行，后端基于腾讯云开发（CloudBase）构建，实现了完整的用户系统、内容管理、社交互动和智能推荐功能。

### 🌟 核心特色

- **诗意界面**：简洁优雅的 UI 设计，自定义字体支持，营造沉浸式创作氛围
- **多端同步**：一次开发，多端运行（微信小程序/H5/App），数据实时同步
- **智能推荐**：基于用户浏览行为和兴趣标签的个性化内容推荐算法
- **作品集管理**：支持创建个人作品集和文件夹，分类管理创作内容
- **高性能缓存**：统一缓存系统，支持 LRU 淘汰、TTL 过期、SWR 策略，大幅提升响应速度

## ✨ 功能特性

### 🎨 创作功能
- **诗歌创作**：支持富文本编辑，自定义背景色、文字颜色、字体样式
- **拼贴诗**：创新的拼贴诗歌创作模式，支持图片上传和合成
- **组诗合成**：将多首单篇诗歌合成为组诗作品
- **草稿保存**：自动保存草稿，支持离线编辑
- **图片上传**：支持多图片上传，自动压缩优化，云存储管理
- **字体管理**：内置多种字体，支持字体预加载和动态切换

### 📱 社交互动
- **广场浏览**：发现页展示精选内容，支持下拉刷新和上拉加载
- **个性化推荐**：基于用户浏览行为和兴趣标签的智能推荐算法
- **点赞评论**：完整的互动体系，支持帖子和评论的点赞
- **关注系统**：关注感兴趣的作者，查看关注动态
- **消息通知**：实时消息推送，支持点赞、评论、关注等多种通知类型
- **讨论区**：创建和参与讨论话题

### 📚 内容管理
- **作品集**：创建个人作品集，支持文件夹分类管理
- **收藏夹**：收藏喜欢的作品，支持自定义收藏夹
- **标签系统**：为作品添加标签，便于分类和搜索
- **搜索功能**：全文搜索，支持搜索历史和搜索建议
- **诗人主页**：展示诗人信息和作品列表
- **用户屏蔽**：支持屏蔽不感兴趣的用户

### 👤 用户系统
- **多端登录**：支持微信登录、GitHub OAuth 登录和手机号登录
- **个人资料**：自定义头像、昵称、签名、诗人信息
- **隐私设置**：支持匿名发布和帖子可见性控制
- **数据统计**：查看个人创作和互动数据
- **粉丝关注**：查看粉丝列表和关注列表

## 🏗 技术架构

### 整体架构

```
┌─────────────────────────────────────────────────────────┐
│                    前端层 (uni-app)                      │
│  ┌──────────┬──────────┬──────────┬──────────┐         │
│  │ 微信小程序 │   H5端   │  App端   │  组件库   │         │
│  └──────────┴──────────┴──────────┴──────────┘         │
│         │                                                │
│         ├─ Vue 2 框架 + 自定义 TabBar                    │
│         ├─ 统一缓存系统 (LRU + TTL + SWR)               │
│         ├─ 事件驱动缓存失效机制                          │
│         └─ 字体管理 + 图片优化                           │
└─────────────────────────────────────────────────────────┘
                          ↕
┌─────────────────────────────────────────────────────────┐
│              云开发层 (Tencent CloudBase)                │
│  ┌──────────────────────────────────────────┐           │
│  │         云函数 (Node.js)                  │           │
│  │  ┌────────┬────────┬────────┬────────┐  │           │
│  │  │ 用户系统 │ 内容管理 │ 社交互动 │ 推荐算法 │  │           │
│  │  └────────┴────────┴────────┴────────┘  │           │
│  └──────────────────────────────────────────┘           │
│                          ↕                               │
│  ┌──────────────────────────────────────────┐           │
│  │      云数据库 (MongoDB)                   │           │
│  │  users | posts | comments | votes_log    │           │
│  │  messages | portfolios | favorites       │           │
│  └──────────────────────────────────────────┘           │
│                          ↕                               │
│  ┌──────────────────────────────────────────┐           │
│  │         云存储 (文件上传)                  │           │
│  │  头像 | 帖子图片 | 诗歌背景 | 拼贴素材     │           │
│  └──────────────────────────────────────────┘           │
└─────────────────────────────────────────────────────────┘
```

### 前端技术栈
- **框架**：uni-app (Vue 2)，支持 Vue 3 兼容代码
- **UI 组件**：自定义组件 + 原生组件
- **状态管理**：全局 globalData + 本地存储
- **样式**：SCSS + 响应式设计
- **缓存系统**：统一缓存管理器 (LRU + TTL + SWR)
- **字体管理**：动态字体加载和预加载
- **图片优化**：自动压缩、懒加载、占位图

### 后端技术栈
- **云服务**：腾讯云开发 (CloudBase)
- **云函数**：Node.js + wx-server-sdk
- **数据库**：云数据库 (MongoDB)
- **存储**：云存储 (文件上传)
- **认证**：匿名认证 + 微信登录 + GitHub OAuth
- **推荐算法**：基于用户兴趣和浏览行为的协同过滤

### 核心特性

#### 1. 统一缓存系统
- **内存缓存**：LRU 淘汰策略，支持命名空间隔离
- **持久化**：可选 uniStorage 持久化，跨会话保持
- **TTL 过期**：灵活的过期时间配置
- **SWR 策略**：Stale-While-Revalidate，先返回旧数据，后台更新
- **事件驱动**：监听全局事件自动失效相关缓存
- **缓存共享**：跨页面缓存共享，减少重复请求

#### 2. 智能推荐算法
- **用户兴趣建模**：基于浏览行为和点赞记录
- **协同过滤**：基于相似用户的推荐
- **热门内容**：基于浏览量和互动数的热门排序
- **个性化推荐**：结合用户兴趣和内容标签

#### 3. 性能优化
- **首屏优化**：骨架屏 + 预加载 + 懒加载
- **图片优化**：自动压缩、WebP 支持、占位图
- **字体预加载**：应用启动时预加载常用字体
- **云函数拦截**：自动注入 openid，统一鉴权
- **批量请求**：批量获取用户信息和关注状态

#### 4. 数据一致性
- **点赞一致性**：乐观更新 + 服务端校正
- **缓存失效**：事件驱动的缓存失效机制
- **用户标识统一**：全局使用 openid 作为唯一标识

## 🚀 快速开始

### 环境要求
- Node.js >= 14.0.0
- HBuilderX >= 3.0.0
- 微信开发者工具 (小程序开发)
- 腾讯云账号 (云开发环境)

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

在 `main.js` 中配置你的云开发环境 ID：
```javascript
const tcbApp = tcb.init({
  env: 'your-env-id',  // 替换为你的环境 ID
  auth: { persistence: 'local' },
  timeout: 120000
});
```

在 `cloudbaserc.json` 中配置云函数部署环境：
```json
{
  "envId": "your-env-id",
  "functionRoot": "functions",
  "functions": []
}
```

4. **初始化数据库**

运行数据库初始化云函数：
```bash
# 部署初始化云函数
cloudbase functions:deploy initDatabase

# 调用初始化函数
cloudbase functions:invoke initDatabase
```

主要集合：
- `users` - 用户信息
- `posts` - 帖子内容
- `comments` - 评论数据
- `votes_log` - 点赞记录
- `messages` - 消息通知
- `portfolios` - 作品集
- `favorites` - 收藏记录
- `view_log` - 浏览记录（TTL 30天）
- `user_interests` - 用户兴趣聚合
- `post_statistics` - 帖子统计

5. **部署云函数**
```bash
# 安装 CloudBase CLI
npm install -g @cloudbase/cli

# 登录腾讯云
cloudbase login

# 部署所有云函数
cloudbase functions:deploy --all

# 或部署单个云函数
cloudbase functions:deploy login
```

6. **运行项目**
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

### 配置说明

#### 微信小程序配置
在 `manifest.json` 中配置小程序 appid：
```json
{
  "mp-weixin": {
    "appid": "your-appid"
  }
}
```

#### GitHub OAuth 配置（可选）
如需支持 GitHub 登录，参考 `docs/GITHUB_OAUTH_SETUP.md` 配置 OAuth 应用。

#### 短信验证码配置（可选）
如需支持手机号登录，参考 `functions/README_SMS_SETUP.md` 配置短信服务。

## 📁 项目结构

```
回车键_uni/
├── pages/                      # 主包页面
│   ├── splash/                 # 开屏页
│   ├── login/                  # 登录页
│   ├── register/               # 注册页
│   ├── index/                  # 广场首页
│   ├── poem-square/            # 诗歌广场（路）
│   ├── mountain/               # 发现页（山）
│   ├── profile/                # 个人中心（湖）
│   ├── post-detail/            # 帖子详情
│   ├── add/                    # 发布页面
│   ├── series-compose/         # 组诗合成
│   └── auth/                   # OAuth 回调
│
├── pages-user/                 # 用户相关分包
│   ├── user-profile/           # 用户主页
│   ├── poet-profile/           # 诗人主页
│   ├── profile-edit/           # 资料编辑
│   ├── following/              # 关注列表
│   ├── fans/                   # 粉丝列表
│   ├── blocked-users/          # 屏蔽用户
│   └── my-likes/               # 我的点赞
│
├── pages-content/              # 内容相关分包
│   ├── favorite-folders/       # 收藏夹
│   ├── favorite-content/       # 收藏内容
│   ├── portfolio/              # 作品集
│   ├── portfolio-detail/       # 作品集详情
│   ├── other-portfolio/        # 他人作品集
│   └── draft-box/              # 草稿箱
│
├── pages-tools/                # 工具相关分包
│   ├── search/                 # 搜索页
│   ├── messages/               # 消息中心
│   ├── tag-filter/             # 标签筛选
│   ├── feedback/               # 反馈页面
│   ├── feedback-admin/         # 反馈管理
│   ├── image-manager/          # 图片管理
│   └── create-discussion/      # 创建讨论
│
├── pages-collage/              # 拼贴诗相关分包
│   ├── collage-main/           # 拼贴诗主页
│   ├── collage-square/         # 拼贴诗广场
│   ├── collage-upload/         # 拼贴诗上传
│   └── collage-compose/        # 拼贴诗合成
│
├── components/                 # 组件库
│   ├── custom-tabbar/          # 自定义标签栏
│   ├── folder-selector/        # 文件夹选择器
│   ├── portfolio-selector/     # 作品集选择器
│   ├── skeleton/               # 骨架屏
│   ├── PostItem.vue            # 帖子卡片
│   ├── CommentList.vue         # 评论列表
│   └── ...
│
├── functions/                  # 云函数（80+ 个）
│   ├── login/                  # 登录
│   ├── createUser/             # 创建用户
│   ├── getUserProfile/         # 获取用户资料
│   ├── updateUserProfile/      # 更新用户资料
│   ├── getPostList/            # 获取帖子列表
│   ├── getPostDetail/          # 获取帖子详情
│   ├── searchPosts/            # 搜索帖子
│   ├── vote/                   # 点赞
│   ├── addComment/             # 添加评论
│   ├── follow/                 # 关注
│   ├── getMessages/            # 获取消息
│   ├── getRecommendationFeed/  # 推荐算法
│   ├── getHotFeed/             # 热门内容
│   ├── getPersonalizedFeed/    # 个性化推荐
│   ├── recordView/             # 记录浏览
│   ├── github-auth/            # GitHub OAuth
│   └── ...
│
├── cache/                      # 统一缓存系统
│   ├── core/                   # 核心引擎
│   │   ├── manager.js          # 缓存管理器 (LRU + TTL)
│   │   ├── file-url.js         # 文件 URL 缓存
│   │   ├── key-builder.js      # 缓存键构建
│   │   └── hydrate.js          # URL 批量转换
│   ├── stores/                 # 业务缓存
│   │   ├── avatar.js           # 头像缓存
│   │   ├── signature.js        # 签名缓存
│   │   ├── follow.js           # 关注状态缓存
│   │   ├── like-status.js      # 点赞状态缓存
│   │   ├── search.js           # 搜索结果缓存
│   │   └── ...
│   ├── events.js               # 事件驱动失效
│   └── index.js                # 统一入口
│
├── api-cache/                  # API 缓存层
│   ├── home-posts.js           # 首页帖子
│   ├── poems.js                # 诗歌列表
│   ├── discover.js             # 发现页
│   ├── following.js            # 关注动态
│   ├── messages.js             # 消息列表
│   ├── my.js                   # 我的资料
│   ├── profile.js              # 他人资料
│   └── ...
│
├── utils/                      # 工具函数
│   ├── fontManager.js          # 字体管理
│   ├── imageOptimizer.js       # 图片优化
│   ├── likeService.js          # 点赞服务
│   ├── cloudCall.js            # 云函数调用
│   ├── hotUpdate.js            # 热更新
│   └── ...
│
├── static/                     # 静态资源
│   ├── fonts/                  # 字体文件
│   ├── images/                 # 图片资源
│   └── ...
│
├── docs/                       # 文档
│   ├── ARCHITECTURE.md         # 架构文档
│   ├── database-schema-improved.md  # 数据库设计
│   ├── GITHUB_OAUTH_SETUP.md   # GitHub OAuth 配置
│   └── ...
│
├── App.vue                     # 应用入口
├── main.js                     # 主文件（TCB 初始化）
├── pages.json                  # 页面配置
├── manifest.json               # 应用配置
├── cloudbaserc.json            # 云开发配置
└── package.json                # 依赖配置
```

### 核心模块说明

#### 1. 页面层（pages/）
- **主包**：包含核心页面（广场、诗歌、发现、个人中心）
- **分包**：按功能模块拆分，支持按需加载
- **预加载**：配置 preloadRule 优化加载速度

#### 2. 云函数层（functions/）
- **用户系统**：登录、注册、资料管理、关注系统
- **内容管理**：帖子 CRUD、搜索、标签、作品集
- **社交互动**：点赞、评论、消息通知
- **推荐算法**：个性化推荐、热门内容、浏览记录

#### 3. 缓存系统（cache/）
- **核心引擎**：LRU 淘汰、TTL 过期、SWR 策略
- **业务缓存**：头像、签名、关注状态、点赞状态
- **事件驱动**：监听全局事件自动失效缓存

#### 4. API 缓存层（api-cache/）
- **列表缓存**：帖子列表、诗歌列表、关注动态
- **详情缓存**：帖子详情、用户资料
- **缓存共享**：跨页面缓存共享，减少重复请求

## 🔧 核心功能实现

### 1. 登录流程

```javascript
// App.vue - 应用启动时自动登录
async loginAndCheckUser() {
  // 1. 检查本地缓存
  const cachedUserInfo = uni.getStorageSync('userInfo');
  if (cachedUserInfo) {
    // 验证云端账户是否存在
    const verifyRes = await this.$tcb.callFunction({
      name: 'getUserProfile',
      data: { userId: cachedUserInfo._openid }
    });
    if (verifyRes.result.success) {
      // 使用云端最新数据
      this.globalData.userInfo = verifyRes.result.userInfo;
      return;
    }
  }
  
  // 2. 匿名认证
  await this.$tcb.auth().signInAnonymously();
  
  // 3. 调用 login 云函数获取 openid
  const loginRes = await this.$tcb.callFunction({ name: 'login' });
  const openid = loginRes.result.openid;
  
  // 4. 查询用户数据库
  const db = this.$tcb.database();
  const userRes = await db.collection('users').where({ _openid: openid }).get();
  
  if (userRes.data.length > 0) {
    // 用户已存在，登录成功
    this.globalData.userInfo = userRes.data[0];
  } else {
    // 新用户，跳转注册页
    this.globalData.userInfo = null;
  }
}
```

### 2. 点赞实现

```javascript
// 前端：乐观更新 + 服务端校正
async onVote(post) {
  // 防重入
  if (this.votingInProgress[post._id]) return;
  this.votingInProgress[post._id] = true;
  
  // 乐观更新
  const originalState = { isVoted: post.isVoted, votes: post.votes };
  post.isVoted = !post.isVoted;
  post.votes += post.isVoted ? 1 : -1;
  
  try {
    // 调用云函数
    const res = await this.$tcb.callFunction({
      name: 'vote',
      data: { postId: post._id, type: 'post' }
    });
    
    // 服务端校正
    if (res.result.success) {
      post.votes = res.result.votes;
      post.isVoted = res.result.isLiked;
    }
  } catch (error) {
    // 失败回滚
    post.isVoted = originalState.isVoted;
    post.votes = originalState.votes;
  } finally {
    this.votingInProgress[post._id] = false;
  }
}
```

```javascript
// 云函数：vote/index.js
exports.main = async (event, context) => {
  const { postId, type } = event;
  const openid = cloud.getWXContext().OPENID;
  
  const db = cloud.database();
  const _ = db.command;
  
  // 查询是否已点赞
  const voteLog = await db.collection('votes_log')
    .where({ _openid: openid, postId, type })
    .get();
  
  if (voteLog.data.length > 0) {
    // 取消点赞
    await db.collection('votes_log').doc(voteLog.data[0]._id).remove();
    await db.collection('posts').doc(postId).update({
      data: { votes: _.inc(-1) }
    });
  } else {
    // 点赞
    await db.collection('votes_log').add({
      data: { _openid: openid, postId, type, createTime: new Date() }
    });
    await db.collection('posts').doc(postId).update({
      data: { votes: _.inc(1) }
    });
  }
  
  // 返回最新状态
  const post = await db.collection('posts').doc(postId).get();
  return {
    success: true,
    votes: post.data[0].votes,
    isLiked: voteLog.data.length === 0
  };
};
```

### 3. 缓存系统

```javascript
// 使用统一缓存系统
import cache from '@/cache';

// 1. 获取头像（带缓存）
const avatar = await cache.stores.avatarCache.getUserAvatar(userId);

// 2. 获取帖子列表（SWR 策略）
const ns = cache.manager.namespace('posts:list', { persistent: true });
const posts = await ns.getOrFetch(
  cacheKey,
  () => fetchPostsFromServer(),
  {
    ttlMs: 90000,      // 90秒过期
    swrMs: 45000,      // 45秒内返回旧数据，后台更新
    onBackgroundUpdate: (newData) => {
      // 后台更新完成后的回调
      this.posts = newData;
    }
  }
);

// 3. 事件驱动失效
uni.$emit('POST_CREATED');  // 发布新帖后触发
// 缓存系统自动失效相关缓存
```

### 4. 推荐算法

```javascript
// 云函数：getRecommendationFeed/index.js
exports.main = async (event, context) => {
  const openid = cloud.getWXContext().OPENID;
  const db = cloud.database();
  
  // 1. 获取用户兴趣（从聚合表）
  const userInterests = await db.collection('user_interests')
    .where({ _openid: openid })
    .get();
  
  if (userInterests.data.length === 0) {
    // 新用户，返回热门内容
    return getHotFeed();
  }
  
  const interests = userInterests.data[0];
  const interestedAuthors = interests.interestedAuthors.map(a => a.authorId);
  const interestedTags = interests.interestedTags.map(t => t.tag);
  
  // 2. 基于兴趣推荐
  const _ = db.command;
  const posts = await db.collection('posts')
    .where(_.or([
      { _openid: _.in(interestedAuthors) },  // 感兴趣的作者
      { tags: _.in(interestedTags) }         // 感兴趣的标签
    ]))
    .orderBy('createTime', 'desc')
    .limit(20)
    .get();
  
  return { success: true, posts: posts.data };
};
```

### 5. 图片优化

```javascript
// utils/imageOptimizer.js
export function optimizeImage(url, options = {}) {
  const { width = 750, quality = 80, format = 'webp' } = options;
  
  // 云存储图片自动压缩
  if (url.includes('cloud://')) {
    return `${url}?imageMogr2/thumbnail/${width}x/quality/${quality}/format/${format}`;
  }
  
  return url;
}

// 使用示例
<image :src="optimizeImage(post.imageUrl, { width: 375, quality: 75 })" />
```

## � 多端适配

### 微信小程序
- **登录方式**：微信授权登录
- **云开发**：使用微信云开发 API
- **UI 适配**：遵循小程序设计规范
- **性能优化**：分包加载、预加载

### H5 端
- **登录方式**：GitHub OAuth、手机号登录
- **云开发**：使用 @cloudbase/js-sdk
- **响应式设计**：适配不同屏幕尺寸
- **PWA 支持**：支持添加到主屏幕

### App 端
- **登录方式**：GitHub OAuth、手机号登录
- **原生功能**：相机拍照、文件上传
- **热更新**：支持 wgt 资源包热更新
- **URL Scheme**：支持 poementer:// 协议唤起

### 平台差异处理

```javascript
// 条件编译
// #ifdef MP-WEIXIN
// 微信小程序特有代码
// #endif

// #ifdef H5
// H5 特有代码
// #endif

// #ifdef APP-PLUS
// App 特有代码
// #endif
```

## 🚀 部署指南

### 云函数部署

```bash
# 部署所有云函数
cloudbase functions:deploy --all

# 部署单个云函数
cloudbase functions:deploy login

# 查看部署状态
cloudbase functions:list

# 查看云函数日志
cloudbase functions:log login
```

### 前端部署

#### H5 部署
```bash
# 构建 H5 版本
npm run build:h5

# 部署到腾讯云静态托管
cloudbase hosting:deploy dist/build/h5 -e your-env-id

# 或部署到其他服务器
# 将 dist/build/h5 目录上传到服务器
```

#### 小程序发布
1. 使用微信开发者工具打开项目
2. 点击"上传"按钮，填写版本号和备注
3. 在微信公众平台提交审核
4. 审核通过后发布

#### App 发布
1. 使用 HBuilderX 云打包
2. 选择打包平台（Android/iOS）
3. 配置签名证书
4. 生成安装包
5. 上传到应用商店

### 数据库索引优化

```javascript
// view_log 集合索引
db.collection('view_log').createIndex({
  name: 'idx_user_type_time',
  keys: { _openid: 1, type: 1, createTime: -1 }
});

db.collection('view_log').createIndex({
  name: 'idx_user_post_unique',
  keys: { _openid: 1, postId: 1 },
  unique: true
});

db.collection('view_log').createIndex({
  name: 'idx_ttl',
  keys: { createTime: 1 },
  expireAfterSeconds: 2592000  // 30天
});

// votes_log 集合索引
db.collection('votes_log').createIndex({
  name: 'idx_vote_unique',
  keys: { _openid: 1, postId: 1, type: 1 },
  unique: true
});
```

## 📊 性能指标

### 缓存命中率
- 头像缓存：~95%
- 帖子列表缓存：~80%
- 用户资料缓存：~90%

### 响应时间
- 首屏加载：< 2s
- 列表加载：< 500ms（缓存命中）
- 详情加载：< 300ms（缓存命中）

### 存储优化
- 浏览记录 TTL：30天自动清理
- 缓存空间：约 155MB（30天数据）
- 相比永久存储节省：~80%

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
- 云函数需要添加错误处理和日志

### 代码风格

```javascript
// 云函数示例
exports.main = async (event, context) => {
  try {
    const { postId } = event;
    const openid = cloud.getWXContext().OPENID;
    
    // 参数验证
    if (!postId) {
      return { success: false, error: 'MISSING_PARAM' };
    }
    
    // 业务逻辑
    const result = await doSomething(postId, openid);
    
    return { success: true, data: result };
  } catch (error) {
    console.error('Error:', error);
    return { success: false, error: error.message };
  }
};
```

## 📚 文档

- [架构文档](./ARCHITECTURE.md) - 系统架构设计
- [数据库设计](./docs/database-schema-improved.md) - 数据库结构
- [缓存系统](./cache/README.md) - 缓存系统说明
- [GitHub OAuth](./docs/GITHUB_OAUTH_SETUP.md) - OAuth 配置
- [性能优化](./PERFORMANCE_OPTIMIZATION.md) - 性能优化指南

## 🐛 问题排查

### 常见问题

1. **云函数调用失败：NO_OPENID**
   - 检查是否已登录
   - 确认 main.js 中的 TCB 初始化代码
   - 查看 App.vue 中的登录流程

2. **图片无法显示**
   - 检查云存储权限配置
   - 确认 fileUrlCache 是否正常工作
   - 查看 getTempFileURL 调用是否成功

3. **缓存不生效**
   - 检查缓存配置（TTL、持久化）
   - 查看缓存统计：`uni.$cacheStats()`
   - 开启调试模式：`uni.$cacheDebug(true)`

4. **热更新失败**
   - 检查 manifest.json 中的 versionCode
   - 确认云存储中的 wgt 包路径
   - 查看热更新日志

### 调试工具

```javascript
// 查看缓存统计
uni.$cacheStats();

// 开启缓存调试
uni.$cacheDebug(true);

// 查看全局数据
console.log(getApp().globalData);

// 清除所有缓存
import cache from '@/cache';
cache.clearAll();
```

## 📄 许可证

本项目采用 MIT 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情

## 🙏 致谢

感谢以下开源项目和服务：
- [uni-app](https://uniapp.dcloud.io/) - 跨平台开发框架
- [腾讯云开发](https://cloud.tencent.com/product/tcb) - 云服务支持
- [Vue.js](https://vuejs.org/) - 前端框架
- [wx-server-sdk](https://developers.weixin.qq.com/miniprogram/dev/wxcloud/guide/) - 微信云开发 SDK

## 📞 联系我们

- 项目地址：[GitHub](https://github.com/your-username/回车键_uni)
- 问题反馈：[Issues](https://github.com/your-username/回车键_uni/issues)
- 文档索引：[DOCUMENTATION.md](./DOCUMENTATION.md)

## 🗺 路线图

### 已完成
- ✅ 基础用户系统（登录、注册、资料管理）
- ✅ 内容发布和管理（帖子、评论、点赞）
- ✅ 社交功能（关注、消息、通知）
- ✅ 作品集和收藏系统
- ✅ 统一缓存系统
- ✅ 智能推荐算法
- ✅ 多端适配（小程序、H5、App）
- ✅ GitHub OAuth 登录
- ✅ 热更新支持

### 进行中
- 🚧 短信验证码登录优化
- 🚧 拼贴诗功能完善
- 🚧 性能监控和分析

### 计划中
- 📋 AI 辅助创作
- 📋 语音朗读功能
- 📋 诗歌比赛和活动
- 📋 更多字体和主题
- 📋 国际化支持

---

<div align="center">

**让诗歌在指尖流淌，让创意在云端绽放** ✨

Made with ❤️ by 回车键团队

</div>