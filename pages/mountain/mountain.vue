<template>
    <view>
        <!-- mountain.wxml -->
        <view class="container">
            <!-- 双图层清晰背景 -->
            <view class="background-wrapper">
                <image
                    :class="'bg-image ' + (item.visible ? 'visible' : '')"
                    :src="item.url"
                    mode="aspectFill"
                    @load="onBackgroundImageLoad"
                    :data-layer-index="index"
                    v-for="(item, index) in bgLayers"
                    :key="index"
                ></image>
            </view>
            <!-- 双图层模糊背景 -->
            <view class="blur-background-wrapper">
                <image
                    :class="'bg-image blur-image ' + (item.visible ? 'visible' : '')"
                    :src="item.url"
                    mode="aspectFill"
                    @load="onBackgroundImageLoad"
                    :data-layer-index="index"
                    v-for="(item, index) in bgLayers"
                    :key="index"
                ></image>
            </view>

            <!-- 骨架屏：当 isLoading 为 true 时显示 -->
            <view v-if="isLoading">
                <skeleton />
            </view>

            <!-- 真实内容：当 isLoading 为 false 时显示 -->
            <view v-else>
                <!-- 山模式 -->
                <view v-if="postList.length > 0" class="poem-mode-container" @touchstart="touchStart" @touchend="touchEnd">
                    <!-- 
        核心改动：
        不再使用 postList[currentPostIndex]，而是使用独立的 currentPost 对象。
        这样切换时，小程序只会更新 image 和 text 的内容，而不会重新渲染整个 view 结构。
      -->
                    <view :class="'single-post-content ' + (isTransitioning ? 'is-transitioning' : '')" @tap.stop.prevent="onSinglePostTap" :data-postid="currentPost._id">
                        <!-- 作者信息 -->
                        <view class="single-author-info">
                            <image v-if="currentPost.authorAvatar" class="single-author-avatar" :src="currentPost.authorAvatar" mode="aspectFill" />
                            <text class="single-author-name">{{ currentPost.authorName }}</text>
                        </view>

                        <!-- 标题 -->
                        <view class="single-post-title" v-if="currentPost.title">{{ currentPost.title }}</view>
                        <!-- 诗歌作者信息 -->
                        <view v-if="currentPost.isPoem && currentPost.author" class="single-poem-author">{{ currentPost.author }}</view>

                        <!-- 内容 -->
                        <view class="single-post-content-text" v-if="currentPost.content" style="white-space: pre-wrap">{{ currentPost.content }}</view>
                    </view>

                    <view v-if="postList.length === 0 && !isLoading" class="empty-state">
                        <view class="empty-icon">⛰️</view>
                        <view class="empty-text">还没有山诗哦～</view>
                        <view class="empty-subtext">快去广场发现好诗吧！</view>
                    </view>
                </view>

                <!-- 调试按钮 (仅在开发环境显示) -->
                <view v-if="false" class="debug-button" @tap="testImageUrls">
                    <view>🐛</view>
                </view>
            </view>
        </view>

    </view>
</template>

<script>
import skeleton from '@/components/skeleton/skeleton';
import folderSelector from '@/components/folder-selector/folder-selector';
// mountain.js - 非原创诗歌页面
// 修复：移除全局数据库实例，改为在方法中动态获取
const PAGE_SIZE = 5;
const postGalleryMixin = require('../../mixins/postGallery.js');
export default {
    components: {
        skeleton,
        folderSelector
    },
    mixins: [postGalleryMixin],
    data() {
        return {
            isLoading: true,

            // 默认显示骨架屏
            postList: [],

            currentPostIndex: 0,
            touchStartX: 0,
            touchEndX: 0,
            touchStartY: 0,
            touchEndY: 0,
            hasMore: true,
            page: 0,
            backgroundImage: '',

            // 这个变量可以废弃了，或者只用来做逻辑判断
            isTransitioning: false,

            preloadedImages: {},
            hasFirstLoad_var: false,

            // 新增：标记是否首次加载

            // --- 新增数据 ---
            currentPost: null,

            // 专门存放当前帖子的数据
            bgLayers: [
                // 管理背景图层的数组
                {
                    url: '',
                    visible: false
                },
                {
                    url: '',
                    visible: false
                }
            ],

            // 当前激活的图层索引 (0 或 1)
            activeLayerIndex: 0,

            // 图集展示相关状态
            swiperHeights: {},
            imageClampHeights: {},

            selected: 0,
            url: '',
            visible: false
        };
    },
    onLoad: function () {
        console.log('Mountain 页面 onLoad');
        const app = getApp();
        // 检查预加载数据
        if (app.globalData.preloadedMountainData && app.globalData.preloadedMountainData.length > 0) {
            // 【情况A】预加载成功：直接渲染，不显示骨架屏
            console.log('Mountain: 使用预加载数据');
            this.setData({
                postList: app.globalData.preloadedMountainData,
                isLoading: false,
                // 关键：直接关闭骨架屏
                page: 1,
                hasFirstLoad_var: true // 标记已首次加载
            });
            // 使用我们之前写的 updatePostDisplay 来统一更新界面
            this.updatePostDisplay(0);
            app.globalData.preloadedMountainData = null; // 用完即焚
        } else {
            // 【情况B】无预加载：显示骨架屏，并异步请求数据
            console.log('Mountain: 无预加载数据，开始请求');
            this.getMountainData();
        }
    },
    onShow: function () {
        // TabBar 状态更新，使用兼容性处理
        const { updateTabBarStatus } = require('../../utils/tabBarCompatibility.js');
        updateTabBarStatus(this, 2);

        // 检查是否需要刷新（发布帖子后）
        try {
            const shouldRefresh = uni.getStorageSync('shouldRefreshMountain');
            if (shouldRefresh) {
                console.log('【mountain】检测到发布标记，刷新数据');
                uni.removeStorageSync('shouldRefreshMountain');
                this.refreshMountainData();
                return; // 刷新后直接返回，不执行后续逻辑
            }
        } catch (e) {
            console.log('CatchClause', e);
            console.log('CatchClause', e);
            console.error('检查刷新标记失败:', e);
        }

        // 首次进入时刷新数据，之后保持之前的内容
        if (!this._hasFirstLoad) {
            console.log('【mountain】首次进入，刷新数据');
            this.refreshMountainData();
        } else {
            console.log('【mountain】再次进入，保持之前内容');
        }
    },
    methods: {
        // 新增：刷新mountain数据的方法
        refreshMountainData: function () {
            console.log('【mountain】开始刷新mountain数据');
            this.setData({
                postList: [],
                currentPostIndex: 0,
                page: 0,
                hasMore: true,
                bgLayers: [
                    {
                        url: '',
                        visible: false
                    },
                    {
                        url: '',
                        visible: false
                    }
                ],
                activeLayerIndex: 0
            });
            this.getMountainData();
        },

        getMountainData: function () {
            // 使用TCB调用云函数
            if (this.$tcb && this.$tcb.callFunction) {
                this.$tcb.callFunction({
                    name: 'getPostList',
                    data: {
                        isPoem: true,
                        isOriginal: false
                    }
                    // 只获取非原创诗歌
                }).then((res) => {
                    console.log('Mountain数据获取成功:', res);
                    const posts = res.result.posts || [];
                    this.setData({
                        postList: posts,
                        isLoading: false,
                        // 关键：数据返回，关闭骨架屏
                        hasFirstLoad_var: true // 标记首次加载完成
                    });
                    // 设置当前帖子
                    if (this.postList.length > 0) {
                        this.setData({
                            currentPost: this.postList[0]
                        });
                        this.updatePostDisplay();
                    }
                }).catch((err) => {
                    console.error('Mountain数据获取失败:', err);
                    this.setData({
                        isLoading: false
                    }); // 关键：请求失败也要关闭骨架屏
                });
            }
        },

        getPostList: function (cb) {
            if (this.isLoading) {
                return;
            }
            this.setData({
                isLoading: true
            });
            const skip = this.page * PAGE_SIZE;
            console.log('开始获取山诗歌列表，skip:', skip, 'page:', this.page);
            // 使用TCB调用云函数
            if (this.$tcb && this.$tcb.callFunction) {
                this.$tcb.callFunction({
                    name: 'getPostList',
                    data: {
                        skip: skip,
                        limit: PAGE_SIZE,
                        isPoem: true,
                        isOriginal: false
                    }
                    // 只获取非原创诗歌
                }).then((res) => {
                    console.log('获取山诗歌列表结果:', res);
                    if (res.result && res.result.success) {
                        const posts = res.result.posts || [];
                        console.log('获取到山诗歌数量:', posts.length);

                        // 调试：检查返回的诗歌数据
                        posts.forEach((post, index) => {
                            console.log(`山诗歌${index + 1}:`, {
                                title: post.title,
                                isPoem: post.isPoem,
                                isOriginal: post.isOriginal,
                                content: post.content ? post.content.substring(0, 50) + '...' : '无内容'
                            });
                        });
                        posts.forEach((post) => {
                            if (!post.imageUrls || post.imageUrls.length === 0) {
                                post.imageUrls = post.imageUrl ? [post.imageUrl] : [];
                            }
                        });
                        const newPostList = this.page === 0 ? posts : this.postList.concat(posts);
                        console.log('山postList:', newPostList);
                        this.setData({
                            postList: newPostList,
                            page: this.page + 1,
                            hasMore: posts.length === PAGE_SIZE
                        });

                        // 首次加载或刷新后，初始化显示
                        if (this.page === 1 && newPostList.length > 0) {
                            console.log('第一个山诗歌帖子数据:', {
                                title: newPostList[0].title,
                                imageUrls: newPostList[0].imageUrls,
                                poemBgImage: newPostList[0].poemBgImage,
                                hasBgImage: !!newPostList[0].poemBgImage
                            });
                            this.updatePostDisplay(0); // 使用新函数来统一更新显示

                            // 预加载后续几张图片，例如第2、3张
                            if (newPostList.length > 1) {
                                this.loadImageForIndex(1);
                            }
                            if (newPostList.length > 2) {
                                this.loadImageForIndex(2);
                            }
                        } else {
                            console.log('未获取到山诗歌帖子数据');
                        }
                    } else {
                        uni.showToast({
                            title: '加载失败',
                            icon: 'none'
                        });
                    }
                }).catch((err) => {
                    console.error('获取山诗歌列表失败:', err);
                    uni.showToast({
                        title: '网络错误',
                        icon: 'none'
                    });
                }).finally(() => {
                    this.setData({
                        isLoading: false
                    });
                    if (typeof cb === 'function') {
                        cb();
                    }
                });
            }
        },

        touchStart: function (e) {
            this.setData({
                touchStartX: e.touches[0].clientX,
                touchStartY: e.touches[0].clientY
            });
        },

        touchEnd: function (e) {
            const touchEndX = e.changedTouches[0].clientX;
            const touchEndY = e.changedTouches[0].clientY;
            const diffX = this.touchStartX - touchEndX;
            const diffY = this.touchStartY - touchEndY;

            // 计算滑动距离和角度
            const distance = Math.sqrt(diffX * diffX + diffY * diffY);
            // 修复角度计算：使用绝对值确保角度正确
            const angle = Math.abs((Math.atan2(Math.abs(diffY), Math.abs(diffX)) * 180) / Math.PI);

            // 只有当水平滑动距离足够大，且滑动角度接近水平（小于45度）时才翻页
            if (distance > 80 && Math.abs(diffX) > 50 && angle < 45) {
                if (diffX > 0) {
                    this.nextPost();
                } else {
                    this.prevPost();
                }
            }
        },

        nextPost: function () {
            if (this.currentPostIndex < this.postList.length - 1) {
                this.setData({
                    isTransitioning: true
                });
                this.updatePostDisplay(this.currentPostIndex + 1); // 调用新函数

                setTimeout(() => {
                    this.setData({
                        isTransitioning: false
                    });
                }, 500); // 动画时长与CSS中的 transition 一致
            } else {
                if (this.hasMore && !this.isLoading) {
                    this.loadMorePosts(() => {
                        if (this.postList.length > this.currentPostIndex + 1) {
                            this.updatePostDisplay(this.currentPostIndex + 1);
                        }
                    });
                }
            }
        },

        prevPost: function () {
            if (this.currentPostIndex > 0) {
                this.setData({
                    isTransitioning: true
                });
                this.updatePostDisplay(this.currentPostIndex - 1); // 调用新函数

                setTimeout(() => {
                    this.setData({
                        isTransitioning: false
                    });
                }, 500);
            }
        },

        onSinglePostTap: function (e) {
            const postId = e.currentTarget.dataset.postid;
            uni.navigateTo({
                url: `/pages/post-detail/post-detail?id=${postId}`
            });
        },

        onImageError: function (e) {
            console.error('山图片加载失败', e.detail);
        },

        // 加载更多帖子（不显示骨架屏）
        loadMorePosts: function (cb) {
            if (this.isLoading) {
                return;
            }
            // 注意：这里不设置 isLoading: true，避免触发骨架屏

            const skip = this.page * PAGE_SIZE;
            console.log('开始加载更多山诗歌，skip:', skip, 'page:', this.page);
            // 使用TCB调用云函数
            if (this.$tcb && this.$tcb.callFunction) {
                this.$tcb.callFunction({
                    name: 'getPostList',
                    data: {
                        skip: skip,
                        limit: PAGE_SIZE,
                        isPoem: true,
                        isOriginal: false
                    }
                }).then((res) => {
                    console.log('加载更多山诗歌结果:', res);
                    if (res.result && res.result.success) {
                        const posts = res.result.posts || [];
                        console.log('获取到更多山诗歌数量:', posts.length);
                        posts.forEach((post) => {
                            if (!post.imageUrls || post.imageUrls.length === 0) {
                                post.imageUrls = post.imageUrl ? [post.imageUrl] : [];
                            }
                        });
                        const newPostList = this.postList.concat(posts);
                        this.setData({
                            postList: newPostList,
                            page: this.page + 1,
                            hasMore: posts.length === PAGE_SIZE
                        });

                        // 预加载新加载的图片
                        const startIndex = this.postList.length - posts.length;
                        posts.forEach((post, index) => {
                            this.loadImageForIndex(startIndex + index);
                        });
                    }
                }).catch((err) => {
                    console.error('加载更多山诗歌失败:', err);
                }).finally(() => {
                    // 注意：这里不设置 isLoading: false，因为之前没有设置为 true
                    if (typeof cb === 'function') {
                        cb();
                    }
                });
            }
        },

        // 预加载下一首的背景图
        preloadNextBackgroundImage: function (currentIndex) {
            const nextIndex = currentIndex + 1;
            if (nextIndex >= this.postList.length) {
                // 如果下一首不存在，检查是否需要加载更多
                if (this.hasMore && !this.isLoading) {
                    this.loadMorePosts(() => {
                        // 加载完成后再次尝试预加载
                        if (nextIndex < this.postList.length) {
                            this.loadImageForIndex(nextIndex);
                        }
                    });
                }
                return;
            }
            this.loadImageForIndex(nextIndex);
        },

        // --- 核心新函数 ---
        // 统一更新帖子内容和背景的函数
        updatePostDisplay: function (index) {
            if (index < 0 || index >= this.postList.length) {
                return;
            }
            const post = this.postList[index];
            if (!post) {
                return;
            }

            // 1. 立即更新卡片内容（文字先切换）
            this.setData({
                currentPost: post,
                currentPostIndex: index
            });

            // 2. 延迟切换背景图，让文字先显示
            const imageUrl = post.poemBgImage || (post.imageUrls && post.imageUrls[0]) || '';

            // 优先使用预加载好的本地缓存路径
            let finalImageUrl = this.preloadedImages[imageUrl];

            // 如果本地缓存没有，检查全局预加载缓存
            if (!finalImageUrl) {
                const app = getApp();
                if (app.globalData.preloadedImages && app.globalData.preloadedImages[imageUrl]) {
                    finalImageUrl = app.globalData.preloadedImages[imageUrl];
                    // 同步到本地缓存
                    this.setData({
                        [`preloadedImages.${imageUrl}`]: finalImageUrl
                    });
                } else {
                    finalImageUrl = imageUrl;
                }
            }

            // 检查是否是首次显示（双图层都为空）
            const isFirstDisplay = this.bgLayers[0].url === '' && this.bgLayers[1].url === '';
            if (isFirstDisplay) {
                // 首次显示：直接设置第一个图层，不进行切换动画
                console.log('首次显示背景图，直接设置第一个图层');
                this.setData({
                    'bgLayers[0].url': finalImageUrl,
                    'bgLayers[0].visible': true,
                    'bgLayers[1].visible': false,
                    activeLayerIndex: 0
                });

                // 首次显示时立即预加载第二张图片，确保切换时不会卡顿
                console.log('首次显示完成，立即预加载第二张图片');
                this.preloadNextBackgroundImage(index);
            } else {
                // 后续切换：延迟切换背景图，让文字先显示
                setTimeout(() => {
                    this.switchBackgroundImage(finalImageUrl);
                }, 100); // 100ms延迟，让文字先切换

                // 预加载下一张
                this.preloadNextBackgroundImage(index);
            }
        },

        // 双图层切换函数
        switchBackgroundImage: function (newImageUrl) {
            if (!newImageUrl) {
                return;
            }

            // 优先使用预加载的本地路径
            const preloadedUrl = this.preloadedImages[newImageUrl];
            const finalImageUrl = preloadedUrl || newImageUrl;
            console.log('切换背景图:', {
                originalUrl: newImageUrl,
                preloadedUrl: preloadedUrl,
                finalUrl: finalImageUrl,
                hasPreloaded: !!preloadedUrl
            });
            const currentActiveIndex = this.activeLayerIndex;
            const nextActiveIndex = (currentActiveIndex + 1) % 2; // 0 -> 1, 1 -> 0

            // 设置待切换的图层索引，等待图片加载完成
            this.pendingLayerIndex = nextActiveIndex;
            this.pendingCurrentIndex = currentActiveIndex;

            // 先设置下一层的图片URL，但不显示
            this.setData({
                [`bgLayers[${nextActiveIndex}].url`]: finalImageUrl,
                [`bgLayers[${nextActiveIndex}].visible`]: false // 确保先隐藏
            });
        },

        // 背景图片加载完成事件
        onBackgroundImageLoad: function (e) {
            const layerIndex = e.currentTarget.dataset.layerIndex;
            console.log(`图层${layerIndex}图片加载完成`);

            // 检查是否是待切换的图层
            if (this.pendingLayerIndex === layerIndex) {
                console.log('待切换图层图片加载完成，开始切换透明度');

                // 执行透明度切换
                this.setData({
                    [`bgLayers[${this.pendingCurrentIndex}].visible`]: false,
                    // 当前层淡出
                    [`bgLayers[${this.pendingLayerIndex}].visible`]: true,
                    // 下一层淡入
                    activeLayerIndex: this.pendingLayerIndex
                });

                // 清除待切换状态
                this.pendingLayerIndex = null;
                this.pendingCurrentIndex = null;
            }
        },

        // 为指定索引加载图片
        loadImageForIndex: function (index, callback) {
            const post = this.postList[index];
            if (!post) {
                return;
            }
            const imageUrl = post.poemBgImage || (post.imageUrls && post.imageUrls[0]) || '';
            if (!imageUrl) {
                return;
            }

            // 检查全局预加载缓存
            const app = getApp();
            if (app.globalData.preloadedImages && app.globalData.preloadedImages[imageUrl]) {
                console.log('使用全局预加载缓存:', imageUrl);
                this.setData({
                    [`preloadedImages.${imageUrl}`]: app.globalData.preloadedImages[imageUrl]
                });
                if (typeof callback === 'function') {
                    callback(app.globalData.preloadedImages[imageUrl]);
                }
                return;
            }

            // 检查本地预加载缓存
            if (this.preloadedImages[imageUrl]) {
                return;
            }
            console.log('开始预加载山图片:', imageUrl);

            // H5环境特殊处理
            const isH5 = typeof window !== 'undefined';
            if (isH5 && (imageUrl.includes('tcb.qcloud.la') || imageUrl.includes('cloudbase'))) {
                console.log('🔍 [H5] 山页面检测到腾讯云存储URL，直接使用:', imageUrl);
                // H5环境下直接使用原URL，避免CORS问题
                this.setData({
                    [`preloadedImages.${imageUrl}`]: imageUrl
                });
                if (typeof callback === 'function') {
                    callback(imageUrl);
                }
                return;
            }

            // 使用微信图片API预加载
            uni.downloadFile({
                url: imageUrl,
                success: (res) => {
                    if (res.statusCode === 200) {
                        console.log('山图片预加载成功:', imageUrl);
                        this.setData({
                            [`preloadedImages.${imageUrl}`]: res.tempFilePath
                        });
                        // 如果有回调函数，则执行
                        if (typeof callback === 'function') {
                            callback(res.tempFilePath);
                        }
                    }
                },
                fail: (err) => {
                    console.error('山图片预加载失败:', imageUrl, err);
                    // H5环境下失败时，直接使用原URL
                    if (isH5) {
                        console.log('🔍 [H5] 山页面预加载失败，使用原URL:', imageUrl);
                        this.setData({
                            [`preloadedImages.${imageUrl}`]: imageUrl
                        });
                        if (typeof callback === 'function') {
                            callback(imageUrl);
                        }
                    }
                }
            });
        },

        testImageUrls() {
            console.log('占位：函数 testImageUrls 未声明');
        }
    }
};
</script>
<style>
/* mountain.wxss */
page {
    background: transparent;
    padding: 0;
}

.container {
    /* 移除 background-image, background-size 等都删掉 */
    position: relative;
    overflow: hidden;
    min-height: 100vh;
}

/* 山模式容器 */
.poem-mode-container {
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    z-index: 1;
    overflow: hidden;
}

/* 新增：背景图的容器和样式 */
.background-wrapper,
.blur-background-wrapper {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    z-index: -2; /* 确保在最底层 */
}

.bg-image {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    opacity: 0; /* 默认隐藏 */
    transition: opacity 0.5s ease-in-out; /* 关键：平滑的透明度过渡 */
}

.bg-image.visible {
    opacity: 1; /* 显示 */
}

/* 新增：模糊背景的容器和样式 */
.blur-background-wrapper {
    z-index: -1;
    filter: blur(30px) brightness(0.7);
    transform: scale(1.1);
}

/* 收藏按钮 */
.favorite-btn {
    position: absolute;
    top: 60rpx;
    right: 60rpx;
    width: 80rpx;
    height: 80rpx;
    background: rgba(255, 255, 255, 0.9);
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 4rpx 12rpx rgba(0, 0, 0, 0.15);
    z-index: 999;
    transition: all 0.3s ease;
}

.favorite-btn:active {
    transform: scale(0.95);
}

.favorite-icon {
    font-size: 36rpx;
}

/* 单帖内容区域 */
.single-post-content {
    width: calc(100% - 40rpx);
    height: calc(100% - 80rpx);
    display: flex;
    flex-direction: column;
    padding: 40rpx 20rpx;
    box-sizing: border-box;
    background: rgba(255, 255, 255, 0.8); /* 统一使用白色背景，与路页面一致 */
    margin: 40rpx 20rpx;
    border-radius: 24rpx;
    box-shadow: 0 8rpx 32rpx rgba(0, 0, 0, 0.15);
    position: relative;
    transition: transform 0.3s ease-in-out;
    transform: translateX(0);
}

/* 切换动画状态 */
.single-post-content.is-transitioning {
    /* 可以尝试只改变透明度，而不是位移 */
    opacity: 0.95;
    transform: scale(0.99);
}

/* 山诗歌特殊样式 */
.mountain-poem {
    background: rgba(232, 224, 208, 0.95); /* 山主题：大地色系 */
    border: 2rpx solid #8b7355;
}

/* 山标识 */
.mountain-badge {
    position: absolute;
    top: 20rpx;
    right: 20rpx;
    background: #8b7355;
    color: white;
    padding: 8rpx 16rpx;
    border-radius: 20rpx;
    font-size: 24rpx;
    font-weight: bold;
    box-shadow: 0 2rpx 8rpx rgba(139, 115, 85, 0.3);
    z-index: 10;
}

/* 作者信息 */
.single-author-info {
    display: flex;
    align-items: center;
    margin-bottom: 15rpx;
    padding-bottom: 10rpx;
    border-bottom: 1rpx solid rgba(139, 115, 85, 0.3);
}

.single-author-avatar {
    width: 80rpx;
    height: 80rpx;
    border-radius: 50%;
    margin-right: 20rpx;
    background-color: #f5f5f5;
    border: 4rpx solid white;
    box-shadow: 0 4rpx 12rpx rgba(0, 0, 0, 0.1);
}

.single-author-name {
    font-size: 32rpx;
    color: #000;
    font-weight: 600;
    text-shadow: 0 1rpx 2rpx rgba(255, 255, 255, 0.8);
}

/* 标题 */
.single-post-title {
    font-size: 36rpx;
    font-weight: bold;
    color: #000;
    margin-bottom: 10rpx;
    line-height: 1.4;
    text-align: center;
    text-shadow: 0 1rpx 2rpx rgba(255, 255, 255, 0.8);
}

/* 诗歌作者样式 */
.single-poem-author {
    font-size: 32rpx;
    color: #000;
    text-align: center;
    margin: 5rpx 0 15rpx 0;
    text-shadow: 0 1rpx 2rpx rgba(255, 255, 255, 0.8);
    letter-spacing: 2rpx;
}

/* 内容文字 */
.single-post-content-text {
    font-size: 32rpx;
    color: #000;
    line-height: 1.8;
    margin-top: 20rpx;
    padding: 30rpx 40rpx;
    background: transparent;
    border-radius: 0;
    max-height: 62vh;
    overflow-y: auto;
    font-family: -apple-system-font, 'PingFang SC', 'Helvetica Neue', Arial, sans-serif;
    letter-spacing: 1rpx;
    text-shadow: 0 1rpx 2rpx rgba(255, 255, 255, 0.8);
}

/* 骨架屏容器 */
.skeleton-container {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(255, 255, 255, 0.95); /* 统一使用白色背景 */
    z-index: 999;
}

/* 空状态 */
.empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 100rpx 40rpx;
    text-align: center;
}

.empty-icon {
    font-size: 80rpx;
    margin-bottom: 20rpx;
    opacity: 0.7;
}

.empty-text {
    font-size: 32rpx;
    color: #666;
    margin-bottom: 10rpx;
}

.empty-subtext {
    font-size: 28rpx;
    color: #999;
}

/* 悬浮发布按钮 */
.add-button {
    position: fixed;
    bottom: 120rpx;
    right: 30rpx;
    width: 100rpx;
    height: 100rpx;
    background-color: #8b7355;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    font-size: 48rpx;
    box-shadow: 0 4rpx 16rpx rgba(139, 115, 85, 0.3);
    z-index: 1000;
}

</style>
