# 回车键项目性能优化指南

## 📋 概述

本文档整合了回车键项目的性能优化策略、缓存系统设计和用户体验改进建议，为项目的持续优化提供全面指导。

---

## 🚀 前端性能优化

### 1. 图片加载优化

#### 1.1 智能图片懒加载
```javascript
// utils/imageLazyLoader.js
class ImageLazyLoader {
    constructor() {
        this.observer = null;
        this.loadedImages = new Set();
        this.initIntersectionObserver();
    }

    initIntersectionObserver() {
        if (typeof IntersectionObserver !== 'undefined') {
            this.observer = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        this.loadImage(entry.target);
                    }
                });
            }, {
                rootMargin: '50px 0px', // 提前50px开始加载
                threshold: 0.1
            });
        }
    }

    observeImage(imgElement, src) {
        if (this.observer) {
            imgElement.dataset.src = src;
            this.observer.observe(imgElement);
        } else {
            imgElement.src = src;
        }
    }
}
```

#### 1.2 优化图片预加载策略
```javascript
// 改进 imageOptimizer.js
class ImageOptimizer {
    constructor() {
        this.cache = new Map();
        this.preloadQueue = [];
        this.maxConcurrent = 3;
        this.currentLoading = 0;
    }

    async preloadImages(urls, priority = 'normal') {
        const urlsToPreload = urls.slice(0, 10);

        for (const url of urlsToPreload) {
            if (this.cache.has(url)) continue;

            while (this.currentLoading >= this.maxConcurrent) {
                await new Promise(resolve => setTimeout(resolve, 100));
            }

            this.currentLoading++;
            this.loadImageWithRetry(url, 3).finally(() => {
                this.currentLoading--;
            });
        }
    }
}
```

### 2. 数据缓存优化

#### 2.1 多级缓存策略
```javascript
// AdvancedDataCache.js
class AdvancedDataCache {
    constructor() {
        this.memoryCache = new Map();
        this.storageCache = new Map();
        this.cacheStats = new Map();
        this.maxMemorySize = 50;
    }

    set(key, data, options = {}) {
        const { expiry = 300000, priority = 'normal', persist = true } = options;

        const cacheItem = {
            data,
            timestamp: Date.now(),
            expiry,
            priority,
            accessCount: 0,
            lastAccess: Date.now()
        };

        this.memoryCache.set(key, cacheItem);
        this.cacheStats.set(key, { hits: 0, misses: 0 });

        if (persist) {
            try {
                uni.setStorageSync(key, cacheItem);
            } catch (e) {
                console.warn('持久化缓存失败:', e);
            }
        }

        this.cleanup();
    }

    get(key) {
        let item = this.memoryCache.get(key);

        if (!item) {
            try {
                item = uni.getStorageSync(key);
                if (item) {
                    this.memoryCache.set(key, item);
                }
            } catch (e) {
                console.warn('读取持久化缓存失败:', e);
            }
        }

        if (!item) {
            this.recordMiss(key);
            return null;
        }

        if (Date.now() - item.timestamp > item.expiry) {
            this.remove(key);
            this.recordMiss(key);
            return null;
        }

        item.accessCount++;
        item.lastAccess = Date.now();
        this.recordHit(key);

        return item.data;
    }
}
```

### 3. 页面渲染优化

#### 3.1 组件复用和状态保持
```javascript
export default {
    data() {
        return {
            componentPool: new Map(),
            preRenderCount: 3
        };
    },

    methods: {
        switchToPost(index) {
            const postComponent = this.getOrCreatePostComponent(index);
            this.updatePostContent(postComponent, this.postList[index]);
        },

        getOrCreatePostComponent(index) {
            if (this.componentPool.has(index)) {
                return this.componentPool.get(index);
            }

            const component = this.createPostComponent();
            this.componentPool.set(index, component);
            return component;
        },

        preRenderNext() {
            const nextIndex = this.currentPostIndex + 1;
            if (nextIndex < this.postList.length) {
                this.preloadPostContent(nextIndex);
            }
        }
    }
};
```

---

## 🎯 统一缓存系统设计

### 1. CacheManager架构

#### 1.1 核心API设计
```typescript
type CacheOptions = { ttlMs?: number; swrMs?: number };
type Namespace = {
  get: (key: string) => Promise<any> | any;
  set: (key: string, val: any, opts?: CacheOptions) => Promise<void> | void;
  delete: (key: string) => Promise<void> | void;
  clear: () => Promise<void> | void;
  getOrFetch: <T>(key: string, loader: () => Promise<T>, opts?: CacheOptions) => Promise<T>;
};
```

#### 1.2 命名空间管理
```javascript
// 主要缓存命名空间
const cacheNamespaces = {
    // 列表/分页缓存（TTL 90s + SWR 45s）
    'posts:home': '广场首页分页',
    'posts:discover': '发现页推荐',
    'posts:tag:<tag>': '标签筛选分页',

    // 资料/详情缓存
    'me:info': '我的资料（TTL 30min + SWR 5min）',
    'me:posts': '我的帖子（仅事件失效）',
    'me:favorites': '我的收藏（仅事件失效）',
    'profiles:user': '他人资料（仅事件失效）',
    'userPosts:<userId>': '他人主页帖子（仅事件失效）',

    // 基础数据缓存
    'tags': '标签列表（TTL 30min + SWR 5min）',
    'unread': '未读数（TTL 60s + SWR 60s）',

    // 媒体缓存
    'fileUrls': 'cloud:// → https 临时URL映射（TTL 55min）',
    'avatars': '用户头像/昵称/个签（TTL 24h）',
    'follow:<currentUserId>': '关注状态（TTL 1h）'
};
```

### 2. 事件驱动的缓存一致性

#### 2.1 全局事件系统
```javascript
// utils/events.js
const EVENTS = {
    POST_CREATED: 'post-created',
    AVATAR_UPDATED: 'avatar-updated',
    FAVORITE_CHANGED: 'favorite-changed'
};

// 事件触发器
export function emitPostCreated(postData) {
    uni.$emit(EVENTS.POST_CREATED, postData);
}

export function emitAvatarUpdated(userId, avatarData) {
    uni.$emit(EVENTS.AVATAR_UPDATED, { userId, avatarData });
}

export function emitFavoriteChanged(data) {
    uni.$emit(EVENTS.FAVORITE_CHANGED, data);
}
```

#### 2.2 缓存失效策略
```javascript
// api-cache/events.js
export function setupCacheEventBridges() {
    // 发帖事件
    uni.$on('post-created', () => {
        cacheManager.namespace('posts:home').clear();
        cacheManager.namespace('posts:discover').clear();
    });

    // 头像更新事件
    uni.$on('avatar-updated', ({ userId }) => {
        cacheManager.namespace('profiles:user').clear();
        cacheManager.namespace(`userPosts:${userId}`).clear();
    });

    // 收藏变更事件
    uni.$on('favorite-changed', () => {
        // 根据需要实现相关缓存失效
    });
}
```

### 3. SWR（Stale-While-Revalidate）策略

#### 3.1 SWR实现
```javascript
class CacheManager {
    async getOrFetch(key, loader, { ttlMs, swrMs } = {}) {
        const cached = this.get(key);

        if (cached) {
            // 如果还在SWR窗口内，异步刷新
            if (this.isStale(key) && swrMs) {
                this.backgroundRefresh(key, loader);
            }
            return cached;
        }

        // 缓存未命中，直接加载
        return this.loadAndCache(key, loader, { ttlMs });
    }

    async backgroundRefresh(key, loader) {
        try {
            const fresh = await loader();
            this.set(key, fresh, { ttlMs: this.getOriginalTtl(key) });
        } catch (error) {
            console.warn('后台刷新失败:', error);
        }
    }
}
```

---

## ⚡ 后端性能优化

### 1. 云函数优化

#### 1.1 数据预聚合
```javascript
// 使用聚合管道优化查询
const result = await db.collection('posts').aggregate()
    .match({ isOriginal: true })
    .addFields({
        hotScore: {
            $add: [
                { $multiply: ['$votes', 2] },
                { $multiply: ['$commentCount', 5] }
            ]
        },
        timeWeight: {
            $divide: [
                { $subtract: [new Date(), '$createTime'] },
                86400000
            ]
        }
    })
    .sort({ hotScore: -1, createTime: -1 })
    .lookup({
        from: 'users',
        localField: '_openid',
        foreignField: '_openid',
        as: 'author'
    })
    .end();
```

#### 1.2 批量临时URL获取
```javascript
async function batchGetTempUrls(fileIds) {
    const batchSize = 20;
    const batches = [];

    for (let i = 0; i < fileIds.length; i += batchSize) {
        batches.push(fileIds.slice(i, i + batchSize));
    }

    const results = await Promise.all(
        batches.map(batch =>
            cloud.getTempFileURL({ fileList: batch })
        )
    );

    return results.flatMap(result => result.fileList);
}
```

### 2. 数据库优化

#### 2.1 索引配置
```javascript
const indexes = {
    posts: [
        { isOriginal: 1, createTime: -1 },
        { _openid: 1, createTime: -1 },
        { votes: -1, createTime: -1 },
        { tags: 1, createTime: -1 }
    ],
    users: [
        { _openid: 1 },
        { poemId: 1 }
    ],
    comments: [
        { postId: 1, createTime: -1 },
        { _openid: 1, createTime: -1 }
    ]
};
```

---

## 🎨 用户体验优化

### 1. 交互体验优化

#### 1.1 页面切换动画
```css
.page-transition {
    transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.page-enter-active {
    transform: translateX(0);
}

.page-leave-active {
    transform: translateX(-100%);
}
```

#### 1.2 手势操作优化
```javascript
export default {
    data() {
        return {
            touchStartX: 0,
            touchStartY: 0,
            touchStartTime: 0,
            swipeThreshold: 50,
            swipeTimeThreshold: 300
        };
    },

    methods: {
        touchStart(e) {
            this.touchStartX = e.touches[0].clientX;
            this.touchStartY = e.touches[0].clientY;
            this.touchStartTime = Date.now();
        },

        touchEnd(e) {
            const deltaX = e.changedTouches[0].clientX - this.touchStartX;
            const deltaY = e.changedTouches[0].clientY - this.touchStartY;
            const deltaTime = Date.now() - this.touchStartTime;

            if (Math.abs(deltaX) > Math.abs(deltaY) &&
                Math.abs(deltaX) > this.swipeThreshold &&
                deltaTime < this.swipeTimeThreshold) {

                if (deltaX > 0) {
                    this.swipeRight();
                } else {
                    this.swipeLeft();
                }
            }
        }
    }
};
```

### 2. 加载状态优化

#### 2.1 智能加载管理
```javascript
class LoadingManager {
    constructor() {
        this.loadingStates = new Map();
        this.timeouts = new Map();
    }

    showLoading(key, message = '加载中...', timeout = 10000) {
        if (this.loadingStates.has(key)) return;

        this.loadingStates.set(key, true);

        const timeoutId = setTimeout(() => {
            uni.showLoading({
                title: message,
                mask: true
            });
        }, 300);

        this.timeouts.set(key, timeoutId);

        setTimeout(() => {
            this.hideLoading(key);
        }, timeout);
    }

    hideLoading(key) {
        if (!this.loadingStates.has(key)) return;

        const timeoutId = this.timeouts.get(key);
        if (timeoutId) {
            clearTimeout(timeoutId);
            this.timeouts.delete(key);
        }

        uni.hideLoading();
        this.loadingStates.delete(key);
    }
}
```

---

## 📊 性能监控

### 1. 性能指标收集
```javascript
class PerformanceMonitor {
    constructor() {
        this.metrics = new Map();
    }

    startTiming(key) {
        this.metrics.set(key, {
            startTime: Date.now(),
            endTime: null,
            duration: null
        });
    }

    endTiming(key) {
        const metric = this.metrics.get(key);
        if (metric) {
            metric.endTime = Date.now();
            metric.duration = metric.endTime - metric.startTime;
        }
    }

    reportMetrics() {
        const report = Array.from(this.metrics.entries()).map(([key, metric]) => ({
            key,
            duration: metric.duration,
            timestamp: Date.now()
        }));

        this.sendReport(report);
    }
}
```

### 2. 错误监控
```javascript
class ErrorMonitor {
    constructor() {
        this.errors = [];
        this.maxErrors = 100;
    }

    captureError(error, context = {}) {
        const errorInfo = {
            message: error.message,
            stack: error.stack,
            context,
            timestamp: Date.now(),
            userAgent: navigator.userAgent,
            url: window.location.href
        };

        this.errors.push(errorInfo);

        if (this.errors.length > this.maxErrors) {
            this.errors.shift();
        }

        this.sendError(errorInfo);
    }
}
```

---

## 🎯 实施优先级

### 高优先级（立即实施）
1. **统一缓存系统** - 已实现，持续优化
2. **图片懒加载** - 显著减少初始加载时间
3. **SWR策略** - 提升用户体验
4. **事件驱动失效** - 保证数据一致性

### 中优先级（近期实施）
1. **云函数查询优化** - 减少服务器响应时间
2. **批量操作优化** - 提升数据处理效率
3. **性能监控实现** - 持续优化基础
4. **错误处理完善** - 提升应用稳定性

### 低优先级（长期规划）
1. **高级缓存策略** - 进一步优化性能
2. **智能预加载** - 预测用户行为
3. **个性化推荐优化** - 提升内容质量
4. **多平台深度优化** - 平台特定优化

---

## 📈 预期效果

实施以上优化措施后，预期可以获得：

### 性能提升
- **页面加载时间减少 40-60%**
- **图片加载速度提升 50%**
- **云函数响应时间减少 30%**
- **内存使用优化 25%**

### 用户体验提升
- **页面切换更流畅**
- **加载状态更友好**
- **数据一致性更好**
- **交互响应更及时**

---

*本文档整合了项目中的性能优化策略和最佳实践，为项目的持续优化提供指导。*