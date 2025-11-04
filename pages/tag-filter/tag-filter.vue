<template>
    <!-- pages/tag-filter/tag-filter.wxml -->
    <view class="container">
        <!-- 骨架屏 -->
        <view v-if="isLoading">
            <skeleton />
        </view>

        <!-- 内容区域 -->
        <view v-else>
            <!-- 空状态 -->
            <view v-if="postList.length === 0 && !isLoading" class="empty-state">
                <view class="empty-icon">🏷️</view>
                <view class="empty-text">还没有 #{{ tag }} 标签的文章</view>
                <view class="empty-subtext">快去发布相关内容吧！</view>
            </view>

            <!-- 文章列表 -->
            <view v-if="postList.length > 0" class="post-list">
                <view class="post-item-wrapper" v-for="(item, index) in postList" :key="index">
                    <!-- 作者信息 -->

                    <view class="author-info-outside">
                        <image
                            class="author-avatar"
                            :src="item.authorAvatar || '/static/images/avatar.png'"
                            mode="aspectFill"
                            @error="onAvatarError"
                            @tap.stop.prevent="navigateToUserProfile"
                            :data-user-id="item._openid"
                        ></image>
                        <text class="author-name">{{ item.authorName }}</text>
                    </view>

                    <!-- 帖子内容 -->

                    <view class="post-item" @tap="onPostTap" :data-postid="item._id">
                        <view class="post-title">{{ item.title }}</view>

                        <!-- 图片显示 -->
                        <view
                            v-if="item.imageUrls && item.imageUrls.length > 0"
                            class="image-container-wrapper"
                            :style="item.imageStyle"
                            @tap.stop.prevent="handlePreview"
                            :data-src="item.imageUrls[0]"
                            :data-original-image-urls="item.originalImageUrls || item.imageUrls"
                        >
                            <!-- 单张图片 -->
                            <block v-if="item.imageUrls.length === 1">
                                <image
                                    class="post-image"
                                    :src="item.imageUrls[0]"
                                    mode="aspectFill"
                                    :lazy-load="true"
                                    @error="onImageError"
                                    @tap.stop.prevent="handlePreview"
                                    :data-src="item.imageUrls[0]"
                                    :data-original-image-urls="item.originalImageUrls || item.imageUrls"
                                />
                            </block>

                            <!-- 多张图片 -->
                            <block v-else-if="item.imageUrls.length > 1">
                                <swiper class="image-swiper" :indicator-dots="true" :circular="true">
                                    <block v-for="(img, index1) in item.imageUrls" :key="index1">
                                        <swiper-item>
                                            <image
                                                class="post-image"
                                                :src="img"
                                                mode="aspectFill"
                                                :lazy-load="true"
                                                @error="onImageError"
                                                @tap.stop.prevent="handlePreview"
                                                :data-src="img"
                                                :data-original-image-urls="item.originalImageUrls || item.imageUrls"
                                            />
                                        </swiper-item>
                                    </block>
                                </swiper>
                            </block>
                        </view>

                        <view class="post-content" v-if="item.content" style="white-space: pre-wrap">{{ item.content }}</view>

                        <!-- 标签显示 -->
                        <view v-if="item.tags && item.tags.length > 0" class="post-tags">
                            <text class="post-tag" @tap.stop.prevent="onTagClick" :data-tag="item" v-for="(item, index1) in item.tags" :key="index1">#{{ item }}</text>
                        </view>
                    </view>

                    <!-- 互动区域 -->

                    <view class="vote-section">
                        <view class="actions-left">
                            <!-- 左侧留空，保持布局平衡 -->
                        </view>
                        <view class="actions-right">
                            <view class="action-item" @tap.stop.prevent="onCommentClick" :data-postid="item._id">
                                <text class="action-emoji">💬</text>
                                <text class="action-text">{{ item.commentCount || 0 }}</text>
                            </view>
                            <view class="action-item">
                                <text class="action-text">{{ item.votes || 0 }}</text>
                            </view>
                        </view>
                    </view>
                </view>
            </view>


            <view v-if="!hasMore && postList.length > 0" class="loading-more">
                <text class="loading-text">没有更多了</text>
            </view>
        </view>
    </view>
</template>

<script>
import skeleton from '@/components/skeleton/skeleton';
// pages/tag-filter/tag-filter.js
// 修复：移除全局数据库实例，改为在方法中动态获取
const PAGE_SIZE = 10;
const { previewImage } = require('../../utils/imagePreview.js');
const { normalizePostList } = require('../../utils/postNormalizer.js');
const { cloudCall } = require('../../utils/cloudCall.js');
import { getTagPosts } from '@/api-cache/tag-posts.js';
import { hydrateTempUrls, warmTempUrlsFromPosts } from '@/_utils/hydrate-temp-urls';
const paginationMixin = require('../../mixins/pagination.js');
export default {
    components: {
        skeleton
    },
    mixins: [paginationMixin],
    data() {
        return {
            tag: '',
            postList: [],
            img: ''
        };
    },
    onLoad: function (options) {
        const tag = decodeURIComponent(options.tag || '');
        if (!tag) {
            uni.showToast({
                title: '标签参数错误',
                icon: 'none'
            });
            uni.navigateBack();
            return;
        }
        this.setData({
            tag: tag
        });
        uni.setNavigationBarTitle({
            title: `#${tag}`
        });
        this.initPagination(this.loadTagPosts.bind(this), { pageSize: PAGE_SIZE });
    },
    methods: {
        // 统一云函数调用方法
        callCloudFunction(name, data = {}, extraOptions = {}) {
            return cloudCall(name, data, Object.assign({ pageTag: 'tag-filter', context: this }, extraOptions));
        },
        async loadTagPosts({ page, isRefresh }) {
            try {
                // 走缓存封装（TTL+SWR）
                const raw = await getTagPosts({ tag: this.tag, page, pageSize: PAGE_SIZE, context: this });
                // 规范化 + 映射并预热临时URL
                let posts = normalizePostList(raw || []);
                posts = await hydrateTempUrls(posts);
                warmTempUrlsFromPosts(posts);

                // 处理分页数据，避免重复
                let newPostList;
                if (page === 0 || isRefresh) {
                    newPostList = posts;
                } else {
                    const existingIds = new Set(this.postList.map(p => p._id));
                    const uniqueNewList = posts.filter(p => p && p._id && !existingIds.has(p._id));
                    newPostList = this.postList.concat(uniqueNewList);
                }
                this.setData({
                    postList: newPostList
                });

                return {
                    list: posts,
                    hasMore: (posts && posts.length === PAGE_SIZE)
                };
            } catch (error) {
                console.error('获取标签文章失败:', error);
                if (!error || !error.__toastShown) {
                    uni.showToast({
                        title: '网络错误',
                        icon: 'none'
                    });
                }
                throw error;
            }
        },

        // 跳转到帖子详情
        onPostTap: function (e) {
            const postId = e.currentTarget.dataset.postid;
            uni.navigateTo({
                url: `/pages/post-detail/post-detail?id=${postId}`
            });
        },

        // 跳转到用户主页
        navigateToUserProfile: function (e) {
            const userId = e.currentTarget.dataset.userId;
            if (userId) {
                const app = getApp();
                const currentUserOpenid = app.globalData.openid;
                if (userId === currentUserOpenid) {
                    uni.switchTab({
                        url: '/pages/profile/profile'
                    });
                } else {
                    uni.navigateTo({
                        url: `/pages/user-profile/user-profile?userId=${userId}`
                    });
                }
            }
        },

        // 图片预览
        handlePreview: function (event) {
            return previewImage(event, { fallbackToast: false });
        },

        onImageError: function (e) {
            console.error('图片加载失败', e.detail);
        },

        onAvatarError: function (e) {
            console.error('头像加载失败', e.detail);
        },

        // 标签点击处理
        onTagClick: function (e) {
            const tag = e.currentTarget.dataset.tag;
            console.log('点击标签:', tag);

            // 跳转到标签筛选页面
            uni.navigateTo({
                url: `/pages/tag-filter/tag-filter?tag=${encodeURIComponent(tag)}`,
                success: () => {
                    console.log('跳转到标签筛选页面成功');
                },
                fail: (err) => {
                    console.error('跳转到标签筛选页面失败:', err);
                    uni.showToast({
                        title: '跳转失败',
                        icon: 'none'
                    });
                }
            });
        },

        // 评论点击处理
        onCommentClick: function (e) {
            const postId = e.currentTarget.dataset.postid;
            console.log('点击评论，跳转到详情页:', postId);
            uni.navigateTo({
                url: `/pages/post-detail/post-detail?id=${postId}`,
                success: () => {
                    console.log('跳转到详情页成功');
                },
                fail: (err) => {
                    console.error('跳转到详情页失败:', err);
                    uni.showToast({
                        title: '跳转失败',
                        icon: 'none'
                    });
                }
            });
        }
    }
};
</script>
<style>
/* pages/tag-filter/tag-filter.wxss */
.container {
    padding: 20rpx;
    background-color: #f7f8fa;
    min-height: 100vh;
}

/* 空状态样式 */
.empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 400rpx;
    background-color: #fff;
    border-radius: 16rpx;
    margin: 30rpx;
    box-shadow: 0 4rpx 12rpx rgba(0, 0, 0, 0.05);
}

.empty-icon {
    font-size: 80rpx;
    margin-bottom: 20rpx;
}

.empty-text {
    font-size: 32rpx;
    color: #333;
    margin-bottom: 10rpx;
}

.empty-subtext {
    font-size: 28rpx;
    color: #999;
}

/* 文章列表样式 */
.post-list {
    margin-bottom: 20rpx;
}

.post-item-wrapper {
    background-color: #fff;
    border-radius: 16rpx;
    margin-bottom: 20rpx;
    box-shadow: 0 4rpx 12rpx rgba(0, 0, 0, 0.05);
    overflow: hidden;
}

/* 作者信息 */
.author-info-outside {
    display: flex;
    align-items: center;
    padding: 20rpx 20rpx 0 20rpx;
    margin-bottom: 15rpx;
}

.author-avatar {
    width: 60rpx;
    height: 60rpx;
    border-radius: 50%;
    margin-right: 15rpx;
}

.author-name {
    font-size: 28rpx;
    color: #333;
    font-weight: 500;
}

/* 帖子内容 */
.post-item {
    padding: 0 20rpx 20rpx 20rpx;
}

.post-title {
    font-size: 32rpx;
    font-weight: bold;
    color: #333;
    margin-bottom: 15rpx;
    line-height: 1.4;
}

.post-content {
    font-size: 28rpx;
    color: #666;
    line-height: 1.6;
    margin-bottom: 15rpx;
}

/* 图片容器 */
.image-container-wrapper {
    position: relative;
    width: 100%;
    margin-bottom: 15rpx;
    background-color: #f0f0f0; /* 占位时的背景色，很重要 */
    overflow: hidden;
    border-radius: 12rpx;
}

.image-container-wrapper .post-image,
.image-container-wrapper .image-swiper {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
}

.post-image {
    width: 100%;
    height: 100%;
    display: block;
    object-fit: cover;
}

.image-swiper {
    width: 100%;
    height: 100%;
}

/* 标签样式 */
.post-tags {
    margin: 20rpx 0 10rpx 0;
    line-height: 1.5;
}

.post-tag {
    color: #24375f;
    font-size: 26rpx;
    margin-right: 10rpx;
    transition: all 0.2s ease;
    cursor: pointer;
}

.post-tag:active {
    color: #1a2a4a;
    opacity: 0.8;
}

/* 互动区域 */
.vote-section {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 15rpx 20rpx 20rpx 20rpx;
    border-top: 1rpx solid #f0f0f0;
}

.actions-left {
    flex: 1;
}

.actions-right {
    display: flex;
    gap: 30rpx;
}

.action-item {
    display: flex;
    align-items: center;
    gap: 8rpx;
}

.action-emoji {
    font-size: 24rpx;
}

.action-text {
    font-size: 24rpx;
    color: #999;
}

/* 加载更多 */
.loading-more {
    display: flex;
    justify-content: center;
    align-items: center;
    padding: 40rpx;
}

.loading-text {
    font-size: 28rpx;
    color: #999;
}
</style>
