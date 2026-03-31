<template>
    <!-- pages/my-likes/my-likes.wxml -->
    <view class="container">
        <!-- 顶部导航栏 -->
        <view class="header">
            <view class="header-left" @tap="goBack">
                <image class="back-icon-image" src="/static/images/left_exit.png" mode="aspectFit"></image>
            </view>
            <text class="header-title">我的点赞</text>
        </view>


        <!-- 主内容始终渲染 -->
        <view>
            <view v-if="likedPosts.length > 0" class="post-list">
                <view class="post-item" @tap="navigateToPost" :data-id="item._id" v-for="(item, index) in likedPosts" :key="index">
                    <!-- Author Info -->

                    <view class="author-info">
                        <image class="author-avatar" :src="resolvePostAvatar(item)" mode="aspectFill" @error="onAvatarError"></image>
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
import { previewImage } from '../../utils/imagePreview.js';
import { normalizePostList } from '../../utils/postNormalizer.js';
import { cloudCall } from '../../utils/cloudCall.js';
import postGalleryMixin from '../../mixins/postGallery.js';
import paginationMixin from '../../mixins/pagination.js';
import { resolvePostAuthorAvatar } from '../../utils/defaultAvatar.js';
const PAGE_SIZE = 5;

export default {
    mixins: [paginationMixin, postGalleryMixin],
    data() {
        return {
            likedPosts: [],
            swiperHeights: {},

            // 每个帖子的swiper高度，跟随第一张图片
            // 新增：单图瘦高图钳制高度
            imageClampHeights: {},

            imgindex: 0,
            img: ''
        };
    },
    onLoad: function (options) {
        this.initPagination(this.loadLikedPosts, { pageSize: PAGE_SIZE });
    },
    methods: {
        resolvePostAvatar(post) {
            return resolvePostAuthorAvatar(post);
        },
        // 统一云函数调用
        callCloudFunction(name, data = {}, extraOptions = {}) {
            return cloudCall(name, data, Object.assign({ pageTag: 'my-likes', context: this, requireAuth: true }, extraOptions));
        },
        async loadLikedPosts({ page, isRefresh }) {
            const skip = page * PAGE_SIZE;
            console.log('【my-likes】请求分页参数', {
                page,
                PAGE_SIZE,
                skip,
                limit: PAGE_SIZE
            });
            if (isRefresh) {
                this.setData({
                    swiperHeights: {},
                    imageClampHeights: {}
                });
            }

            try {
                const res = await this.callCloudFunction('getMyLikedPosts', {
                    skip,
                    limit: PAGE_SIZE
                });

                if (!res.result || res.result.success !== true) {
                    const message = (res.result && res.result.message) || '数据加载失败';
                    uni.showToast({
                        title: message,
                        icon: 'none'
                    });
                    const error = new Error(message);
                    error.__toastShown = true;
                    throw error;
                }

                const posts = normalizePostList(res.result.posts || []);
                console.log('【my-likes】本次返回帖子数量:', posts.length);
                // 处理分页数据，避免重复
                const newLikedPosts = page === 0 || isRefresh ? posts : (() => {
                    const existingIds = new Set(this.likedPosts.map(p => p._id));
                    const uniqueNewList = posts.filter(p => p && p._id && !existingIds.has(p._id));
                    return this.likedPosts.concat(uniqueNewList);
                })();
                console.log('【my-likes】更新后 likedPosts 长度:', newLikedPosts.length, 'hasMore:', posts.length === PAGE_SIZE, 'page:', page + 1);
                this.setData({
                    likedPosts: newLikedPosts
                });

                return {
                    list: posts,
                    hasMore: posts.length === PAGE_SIZE
                };
            } catch (err) {
                console.error('Failed to fetch liked posts', err);
                if (!err || !err.__toastShown) {
                    uni.showToast({
                        title: '网络错误',
                        icon: 'none'
                    });
                }
                throw err;
            }
        },

        navigateToPost: function (e) {
            const postId = e.currentTarget.dataset.id;
            uni.navigateTo({
                url: `/pages/post-detail/post-detail?id=${postId}`
            });
        },

        // 预览图片（与首页、我的帖子页统一）
        handlePreview: function (event) {
            const previewResult = previewImage(event);
            if (previewResult === false) {
                console.warn('【my-likes】图片预览失败，缺少必要数据');
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

        onAvatarError: function (e) {
            console.error('头像加载失败', e);
            // 可以在这里设置默认头像
        },

        // 返回上一页
        goBack: function () {
            const pages = getCurrentPages();
            if (pages.length > 1) {
                uni.navigateBack({
                    delta: 1,
                    fail: () => {
                        uni.switchTab({
                            url: '/pages/index/index'
                        });
                    }
                });
            } else {
                uni.switchTab({
                    url: '/pages/index/index'
                });
            }
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
    display: flex;
    align-items: center;
    justify-content: center;
    position: relative;
    padding: 20rpx 30rpx;
    background: #fff;
    border-bottom: 1rpx solid #e9ecef;
    margin-bottom: 20rpx;
}

.header-left {
    position: absolute;
    left: 30rpx;
    width: 60rpx;
    height: 60rpx;
    display: flex;
    align-items: center;
    justify-content: center;
}

.back-icon-image {
    width: 22rpx;
    height: 38rpx;
}

.header-title {
    font-size: 36rpx;
    font-weight: 600;
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
