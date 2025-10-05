<template>
    <!-- pages/my-likes/my-likes.wxml -->
    <view class="container">
        <view class="header">
            <text class="header-title">我的点赞</text>
        </view>

        <!-- 骨架屏/加载中 -->
        <view v-if="isLoading && likedPosts.length === 0" class="loading-indicator">
            <text>加载中...</text>
        </view>

        <!-- 主内容始终渲染 -->
        <view v-else>
            <view v-if="likedPosts.length > 0" class="post-list">
                <view class="post-item" @tap="navigateToPost" :data-id="item._id" v-for="(item, index) in likedPosts" :key="index">
                    <!-- Author Info -->

                    <view class="author-info">
                        <image class="author-avatar" :src="item.authorAvatar || '/static/images/icons/avatar.png'" mode="aspectFill" @error="onAvatarError"></image>
                        <text class="author-name">{{ item.authorName }}</text>
                    </view>

                    <view class="post-title">{{ item.title }}</view>

                    <view class="post-content-preview">{{ item.content }}</view>

                    <!-- 图片显示逻辑（迁移自详情页/首页，支持单图瘦高图钳制和多图swiper高度） -->

                    <view v-if="item.imageUrl || (item.imageUrls && item.imageUrls.length > 0)" class="image-container" :id="'image-container-' + index">
                        <!-- 单张图片 -->
                        <block v-if="item.imageUrls && item.imageUrls.length === 1">
                            <image
                                :id="'single-image-' + item._id"
                                :src="item.imageUrls[0]"
                                :mode="imageClampHeights[item._id] ? 'aspectFill' : 'widthFix'"
                                :style="
                                    'width: 100%; height: ' +
                                    (imageClampHeights[item._id] ? imageClampHeights[item._id] + 'px' : 'auto') +
                                    '; object-fit: ' +
                                    (imageClampHeights[item._id] ? 'cover' : 'contain') +
                                    '; background-color: #f0f0f0;'
                                "
                                @load="onImageLoad"
                                :data-postid="item._id"
                                data-type="single"
                                @error="onImageError"
                                @tap.stop.prevent="handlePreview"
                                :data-src="item.imageUrls[0]"
                                :data-original-image-urls="item.originalImageUrls || item.imageUrls"
                                :lazy-load="true"
                            />
                        </block>
                        <!-- 多张图片 -->
                        <block v-else-if="item.imageUrls && item.imageUrls.length > 1">
                            <swiper
                                :id="'swiper-' + item._id"
                                class="image-swiper"
                                :indicator-dots="true"
                                :circular="true"
                                :style="'width: 100%; height: ' + (swiperHeights[index] ? swiperHeights[index] + 'px' : '220px') + ';'"
                            >
                                <block v-for="(img, imgindex) in item.imageUrls" :key="imgindex">
                                    <swiper-item>
                                        <image
                                            :src="img"
                                            mode="aspectFill"
                                            @load="onImageLoad"
                                            :data-postid="item._id"
                                            :data-postindex="index"
                                            :data-imgindex="imgindex"
                                            data-type="multi"
                                            @error="onImageError"
                                            @tap.stop.prevent="handlePreview"
                                            :data-src="img"
                                            :data-original-image-urls="item.originalImageUrls || item.imageUrls"
                                            :lazy-load="true"
                                            style="width: 100%; height: 100%; object-fit: cover; background-color: #f0f0f0"
                                        />
                                    </swiper-item>
                                </block>
                            </swiper>
                        </block>
                    </view>

                    <!-- Post Meta -->

                    <view class="post-meta">
                        <text class="post-time">{{ item.formattedCreateTime }}</text>
                    </view>
                </view>
                <!-- 加载更多提示 -->
                <view v-if="isLoading && likedPosts.length > 0" class="loading-indicator">
                    <text>加载中...</text>
                </view>
            </view>
            <view v-else class="empty-tip">
                <view class="empty-icon">👍</view>
                <view class="empty-text">你还没有点赞任何帖子哦～</view>
                <view class="empty-subtext">去首页发现精彩内容吧！</view>
            </view>
        </view>
    </view>
</template>

<script>
const app = getApp();
const PAGE_SIZE = 5;
export default {
    data() {
        return {
            likedPosts: [],
            isLoading: false,
            page: 0,
            hasMore: true,
            PAGE_SIZE: PAGE_SIZE,
            swiperHeights: {},

            // 每个帖子的swiper高度，跟随第一张图片
            // 新增：单图瘦高图钳制高度
            imageClampHeights: {},

            imgindex: 0,
            img: ''
        };
    },
    onLoad: function (options) {
        this.fetchLikedPosts();
    },
    onPullDownRefresh: function () {
        console.log('【my-likes】下拉刷新触发，重置分页');
        this.setData({
            likedPosts: [],
            page: 0,
            hasMore: true
        });
        this.fetchLikedPosts(() => {
            uni.stopPullDownRefresh();
            console.log('【my-likes】下拉刷新结束');
        });
    },
    onReachBottom: function () {
        console.log('【my-likes】触底加载触发', 'hasMore:', this.hasMore, 'isLoading:', this.isLoading, '当前页:', this.page);
        if (!this.hasMore || this.isLoading) {
            return;
        }
        this.fetchLikedPosts();
    },
    methods: {
        // 兼容性云函数调用方法
        callCloudFunction(name, data = {}) {
            console.log(`🔍 [页面] 调用云函数: ${name}`, data);
            
            return new Promise((resolve, reject) => {
                // 检查运行环境
                const isH5 = typeof window !== 'undefined';
                const isMiniProgram = typeof wx !== 'undefined';
                
                console.log(`🔍 [页面] 运行环境检测 - H5: ${isH5}, 小程序: ${isMiniProgram}`);
                
                if (isH5) {
                    // H5环境使用TCB
                    if (this.$tcb && this.$tcb.callFunction) {
                        console.log(`🔍 [页面] H5环境使用TCB调用云函数: ${name}`);
                        this.$tcb.callFunction({
                            name: name,
                            data: data
                        }).then(resolve).catch(reject);
                    } else {
                        console.error(`❌ [页面] H5环境TCB不可用`);
                        reject(new Error('TCB实例不可用'));
                    }
                } else if (isMiniProgram) {
                    // 小程序环境使用微信云开发
                    if (wx.cloud && wx.cloud.callFunction) {
                        console.log(`🔍 [页面] 小程序环境使用微信云开发调用云函数: ${name}`);
                        wx.cloud.callFunction({
                            name: name,
                            data: data,
                            success: (res) => {
                                console.log(`✅ [页面] 云函数调用成功: ${name}`, res);
                                resolve(res);
                            },
                            fail: (err) => {
                                console.error(`❌ [页面] 云函数调用失败: ${name}`, err);
                                reject(err);
                            }
                        });
                    } else {
                        console.error(`❌ [页面] 小程序环境微信云开发不可用`);
                        reject(new Error('微信云开发不可用'));
                    }
                } else {
                    console.error(`❌ [页面] 未知运行环境`);
                    reject(new Error('未知运行环境'));
                }
            });
        },
        fetchLikedPosts: function (cb) {
            if (this.isLoading) {
                return;
            }
            const { page, PAGE_SIZE } = this;
            console.log('【my-likes】请求分页参数', {
                page,
                PAGE_SIZE,
                skip: page * PAGE_SIZE,
                limit: PAGE_SIZE
            });
            this.setData({
                isLoading: true
            });
            this.callCloudFunction('getMyLikedPosts', {
                    skip: page * PAGE_SIZE,
                    limit: PAGE_SIZE
                }).then((res) => {
                    if (res.result && res.result.success) {
                        const posts = res.result.posts || [];
                        console.log('【my-likes】本次返回帖子数量:', posts.length);
                        const processPost = (post) => {
                            post.formattedCreateTime = this.formatTime(post.createTime);
                            if (post.imageUrl && !post.imageUrls) {
                                post.imageUrls = [post.imageUrl];
                            }
                            if (post.originalImageUrl && !post.originalImageUrls) {
                                post.originalImageUrls = [post.originalImageUrl];
                            }
                            if (!post.authorName) {
                                post.authorName = '匿名用户';
                            }
                            if (!post.authorAvatar) {
                                post.authorAvatar = '';
                            }
                            return post;
                        };
                        const newLikedPosts = page === 0 ? posts.map(processPost) : this.likedPosts.concat(posts.map(processPost));
                        console.log('【my-likes】更新后 likedPosts 长度:', newLikedPosts.length, 'hasMore:', posts.length === PAGE_SIZE, 'page:', page + 1);
                        this.setData({
                            likedPosts: newLikedPosts,
                            page: page + 1,
                            hasMore: posts.length === PAGE_SIZE
                        });
                    } else {
                        uni.showToast({
                            title: res.result.message || '数据加载失败',
                            icon: 'none'
                        });
                    }
                }).catch((err) => {
                    console.error('Failed to fetch liked posts', err);
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
        },

        navigateToPost: function (e) {
            const postId = e.currentTarget.dataset.id;
            uni.navigateTo({
                url: `/pages/post-detail/post-detail?id=${postId}`
            });
        },

        // 预览图片（与首页、我的帖子页统一）
        handlePreview: function (event) {
            const currentUrl = event.currentTarget.dataset.src;
            const originalUrls = event.currentTarget.dataset.originalImageUrls;
            if (currentUrl) {
                uni.previewImage({
                    current: currentUrl,
                    urls: originalUrls || [currentUrl]
                });
            } else {
                uni.showToast({
                    title: '图片加载失败',
                    icon: 'none'
                });
            }
        },

        // 图片加载错误处理（与首页、我的帖子页统一）
        onImageError: function (e) {
            console.error('图片加载失败', e);
            const { src } = e.detail;
            console.error('失败的图片URL:', src);
            // 获取当前图片的上下文信息
            const { postindex, imgindex } = e.currentTarget.dataset;
            if (postindex !== undefined && imgindex !== undefined) {
                const post = this.likedPosts[postindex];
                console.error('图片加载失败的上下文:', {
                    postId: post ? post._id : 'unknown',
                    postTitle: post ? post.title : 'unknown',
                    imageIndex: imgindex,
                    imageUrl: src
                });
            }
            // 不显示toast，避免频繁弹窗，但记录错误
            console.error('图片加载失败详情:', {
                error: e.detail,
                src: src,
                dataset: e.currentTarget.dataset
            });
        },

        // 图片加载成功时，动态设置swiper高度（与首页、我的帖子页统一）
        onImageLoad: function (e) {
            const { postid, postindex = 0, imgindex = 0, type } = e.currentTarget.dataset;
            const { width: originalWidth, height: originalHeight } = e.detail;
            if (!originalWidth || !originalHeight) {
                return;
            }

            // 多图 Swiper 逻辑
            if (type === 'multi' && imgindex === 0) {
                const query = uni.createSelectorQuery().in(this);
                query
                    .select(`#swiper-${postid}`)
                    .boundingClientRect((rect) => {
                        if (rect && rect.width) {
                            const containerWidth = rect.width;
                            const actualRatio = originalWidth / originalHeight;
                            const maxRatio = 1.7777777777777777;
                            const minRatio = 0.5625;
                            let targetRatio = actualRatio;
                            if (actualRatio > maxRatio) targetRatio = maxRatio;
                            else if (actualRatio < minRatio) {
                                targetRatio = minRatio;
                            }
                            const displayHeight = containerWidth / targetRatio;
                            if (this.swiperHeights[postindex] !== displayHeight) {
                                this.setData({
                                    [`swiperHeights[${postindex}]`]: displayHeight
                                });
                            }
                        }
                    })
                    .exec();
            }
            // 单图
            if (type === 'single') {
                const actualRatio = originalWidth / originalHeight;
                const minRatio = 0.5625;
                if (actualRatio < minRatio) {
                    const query = uni.createSelectorQuery().in(this);
                    query
                        .select(`#single-image-${postid}`)
                        .boundingClientRect((rect) => {
                            if (rect && rect.width) {
                                const containerWidth = rect.width;
                                const displayHeight = containerWidth / minRatio;
                                if (this.imageClampHeights[postid] !== displayHeight) {
                                    this.setData({
                                        [`imageClampHeights.${postid}`]: displayHeight
                                    });
                                }
                            }
                        })
                        .exec();
                }
            }
        },

        formatTime: function (dateString) {
            if (!dateString) {
                return '';
            }
            const date = new Date(dateString);
            const now = new Date();
            const diff = now.getTime() - date.getTime();
            const minutes = Math.floor(diff / 60000);
            if (minutes < 1) {
                return '刚刚';
            }
            if (minutes < 60) {
                return `${minutes}分钟前`;
            }
            const hours = Math.floor(diff / 3600000);
            if (hours < 24) {
                return `${hours}小时前`;
            }
            const days = Math.floor(diff / 86400000);
            if (days < 7) {
                return `${days}天前`;
            }
            return date.toLocaleDateString();
        },

        onAvatarError: function (e) {
            console.error('头像加载失败', e);
            // 可以在这里设置默认头像
        }
    }
};
</script>
<style>
/* pages/my-likes/my-likes.wxss */
.container {
    padding: 20rpx;
    background-color: #f7f8fa;
    min-height: 100vh;
}

.header {
    padding: 20rpx 0;
    margin-bottom: 20rpx;
}

.header-title {
    font-size: 36rpx;
    font-weight: bold;
    color: #333;
}

.loading-indicator {
    display: flex;
    justify-content: center;
    align-items: center;
    height: 400rpx;
    background-color: #fff;
    border-radius: 16rpx;
    margin: 30rpx;
    box-shadow: 0 4rpx 12rpx rgba(0, 0, 0, 0.05);
}

.loading-indicator text {
    font-size: 28rpx;
    color: #999;
}

.post-list {
    margin-bottom: 20rpx;
}

.post-item {
    width: 100%;
    padding: 30rpx;
    margin-bottom: 20rpx;
    background-color: #ffffff;
    border-radius: 16rpx;
    box-shadow: 0 4rpx 12rpx rgba(0, 0, 0, 0.05);
    box-sizing: border-box;
    transition: transform 0.2s ease;
}

.post-item:active {
    transform: scale(0.98);
}

.author-info {
    display: flex;
    align-items: center;
    margin-bottom: 15rpx;
}

.author-avatar {
    width: 60rpx;
    height: 60rpx;
    border-radius: 50%;
    margin-right: 15rpx;
    background-color: #f5f5f5;
}

.author-name {
    font-size: 28rpx;
    color: #333;
    font-weight: 500;
}

.post-title {
    font-size: 32rpx;
    font-weight: bold;
    color: #333333;
    margin-bottom: 10rpx;
    line-height: 1.4;
    word-break: break-word;
    overflow: hidden;
    text-overflow: ellipsis;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
}

.post-content-preview {
    font-size: 26rpx;
    color: #666666;
    line-height: 1.5;
    margin-bottom: 15rpx;
    word-break: break-word;
    overflow: hidden;
    text-overflow: ellipsis;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
}

.image-container {
    position: relative;
    width: 100%;
    margin: 15rpx 0;
}

.post-image {
    width: 100%;
    height: auto;
    display: block;
    transition: transform 0.3s ease;
}

.post-image:active {
    transform: scale(1.05);
}

.image-count-indicator {
    position: absolute;
    top: 15rpx;
    right: 15rpx;
    background-color: rgba(0, 0, 0, 0.6);
    color: white;
    padding: 6rpx 12rpx;
    border-radius: 16rpx;
    font-size: 22rpx;
    z-index: 10;
    backdrop-filter: blur(10rpx);
}

.image-count-text {
    font-size: 22rpx;
    color: white;
}

.post-meta {
    margin-top: 15rpx;
}

.post-time {
    font-size: 24rpx;
    color: #999;
    opacity: 0.8;
}

.empty-tip {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 100rpx 40rpx;
    text-align: center;
}

.empty-icon {
    font-size: 120rpx;
    margin-bottom: 30rpx;
    opacity: 0.6;
}

.empty-text {
    font-size: 32rpx;
    color: #666;
    margin-bottom: 15rpx;
}

.empty-subtext {
    font-size: 28rpx;
    color: #999;
}

/* 多图轮播白色背景 */
.swiper-bg-white {
    background: #fff !important;
}
</style>
