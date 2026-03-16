# 小程序分享功能使用指南

## 快速开始

在任何页面中添加分享功能，只需导入并使用分享方法：

### 方法一：直接使用（推荐）

```javascript
import { getShareAppMessageConfig, getShareTimelineConfig } from '@/utils/shareHelper.js';

export default {
  // 其他配置...
  
  // 分享到好友/群聊
  onShareAppMessage(res) {
    return getShareAppMessageConfig({
      title: 'poementer',
      path: '/pages/poem-square/poem-square'
    });
  },
  
  // 分享到朋友圈
  onShareTimeline() {
    return getShareTimelineConfig({
      title: 'poementer'
    });
  }
}
```

### 方法二：使用 Mixin

```javascript
import { sharePageMixin } from '@/utils/shareHelper.js';

export default {
  mixins: [sharePageMixin()],
  // 或自定义配置
  // mixins: [sharePageMixin({ title: '自定义标题', path: '/pages/xxx/xxx' })],
  
  // 其他配置...
}
```

## API 说明

### getShareAppMessageConfig(options)

获取分享到好友/群聊的配置

参数：
- `title` (string, 可选): 分享标题，默认为 'poementer'
- `path` (string, 可选): 分享路径，默认为当前页面路径
- `imageUrl` (string, 可选): 分享图片URL

### getShareTimelineConfig(options)

获取分享到朋友圈的配置

参数：
- `title` (string, 可选): 分享标题，默认为 'poementer'
- `query` (string, 可选): 自定义参数
- `imageUrl` (string, 可选): 分享图片URL

### sharePageMixin(options)

返回一个包含分享方法的 mixin 对象

参数：与上述方法相同

## 示例

### 分享当前页面

```javascript
onShareAppMessage(res) {
  return getShareAppMessageConfig({
    title: 'poementer'
    // path 不传，自动使用当前页面路径
  });
}
```

### 分享指定页面

```javascript
onShareAppMessage(res) {
  return getShareAppMessageConfig({
    title: '查看这首诗',
    path: '/pages/post-detail/post-detail?id=123'
  });
}
```

### 带自定义图片

```javascript
onShareAppMessage(res) {
  return getShareAppMessageConfig({
    title: 'poementer',
    path: '/pages/poem-square/poem-square',
    imageUrl: 'https://example.com/share-image.jpg'
  });
}
```

## 已应用页面

- ✅ pages/splash/splash.vue (开屏页)
- ✅ pages/index/index.vue (首页/广场)
- ✅ pages/poem-square/poem-square.vue (诗歌广场)
- ✅ pages/mountain/mountain.vue (山/收藏)
- ✅ pages/profile/profile.vue (个人主页)
- ✅ pages/post-detail/post-detail.vue (帖子详情，动态分享帖子内容)
