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
                <post-item
                    v-for="(item, index) in postList"
                    :key="item._id || index"
                    :item="item"
                    :index="index"
                    :show-vote-section="true"
                    list-type="tag"
                    @avatar-error="onAvatarError"
                    @navigate-to-user="handleNavigateToUser"
                    @preview-image="handlePreviewImage"
                    @image-error="onImageError"
                    @tag-click="handleTagClick"
                    @vote="handleVote"
                    @comment-click="handleCommentClick"
                />
            </view>


            <view v-if="!hasMore && postList.length > 0" class="loading-more">
                <text class="loading-text">没有更多了</text>
            </view>
        </view>
    </view>
</template>

<script>
import skeleton from '@/components/skeleton/skeleton';
import PostItem from '@/components/PostItem.vue';
// pages/tag-filter/tag-filter.js
// 修复：移除全局数据库实例，改为在方法中动态获取
const PAGE_SIZE = 10;
const { previewImage } = require('../../utils/imagePreview.js');
const likeIcon = require('../../utils/likeIcon');
const { togglePostLike } = require('../../utils/likeService.js');
const likeSync = require('../../utils/likeStatusSync.js');
const { normalizePostList } = require('../../utils/postNormalizer.js');
const { cloudCall } = require('../../utils/cloudCall.js');
import { getTagPosts } from '@/api-cache/tag-posts.js';
import { hydrateTempUrls, warmTempUrlsFromPosts } from '@/_utils/hydrate-temp-urls';
const paginationMixin = require('../../mixins/pagination.js');
export default {
    components: {
        skeleton,
        PostItem
    },
    mixins: [paginationMixin],
    data() {
        return {
            tag: '',
            postList: [],
            img: '',
            votingInProgress: {}
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

                // 优先使用本地缓存中的点赞状态，添加 likeIcon
                const getLatestLikeStatus = likeSync.getLatestLikeStatus;
                posts = posts.map((post) => {
                    const cachedStatus = getLatestLikeStatus(post._id);
                    const finalVotes = cachedStatus ? cachedStatus.votes : (post.votes || 0);
                    const finalIsVoted = cachedStatus ? cachedStatus.isVoted : (post.isVoted || false);
                    return {
                        ...post,
                        votes: finalVotes,
                        isVoted: finalIsVoted,
                        likeIcon: likeIcon.getLikeIcon(finalVotes, finalIsVoted)
                    };
                });

                // 将云函数返回的点赞状态更新到缓存
                try {
                    const updateLikeStatus = likeSync.updateLikeStatus;
                    raw.forEach((post) => {
                        if (post._id && (post.isVoted !== undefined || post.votes !== undefined)) {
                            updateLikeStatus(post._id, post.votes || 0, post.isVoted || false);
                        }
                    });
                } catch (e) {
                    console.warn('标签页更新点赞状态到缓存失败:', e);
                }

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
                        url: `/pages-user/user-profile/user-profile?userId=${userId}`
                    });
                }
            }
        },

        onImageError: function (e) {
            console.error('图片加载失败', e.detail);
        },

        onAvatarError: function (e) {
            console.error('头像加载失败', e.detail);
        },

        // ========== PostItem 组件事件适配方法 ==========

        // 处理用户头像点击
        handleNavigateToUser: function (data) {
            const userId = data.userId;
            if (userId) {
                const app = getApp();
                const currentUserOpenid = app.globalData.openid;
                if (userId === currentUserOpenid) {
                    uni.switchTab({
                        url: '/pages/profile/profile'
                    });
                } else {
                    uni.navigateTo({
                        url: `/pages-user/user-profile/user-profile?userId=${userId}`
                    });
                }
            }
        },

        // 处理图片预览
        handlePreviewImage: function (data) {
            previewImage(data.src, data.urls);
        },

        // 处理标签点击
        handleTagClick: function (data) {
            const tag = data.tag;
            if (tag) {
                uni.navigateTo({
                    url: `/pages-tools/tag-filter/tag-filter?tag=${encodeURIComponent(tag)}`
                });
            }
        },

        // 处理评论点击
        handleCommentClick: function (data) {
            uni.navigateTo({
                url: `/pages/post-detail/post-detail?id=${data.postId}`
            });
        },

        // 处理点赞
        handleVote: function (data) {
            const postId = data.postId;
            const index = data.index;

            if (this.votingInProgress[postId]) {
                return;
            }
            this.votingInProgress[postId] = true;

            const list = this.postList;
            const targetIndex = list.findIndex((p) => p._id === postId);
            if (targetIndex < 0) {
                this.votingInProgress[postId] = false;
                return;
            }

            const originalItem = list[targetIndex];
            const originalVotes = Number(originalItem.votes) || 0;
            const originalIsVoted = !!originalItem.isVoted;

            // 乐观更新
            const optimisticVotes = originalIsVoted ? Math.max(0, originalVotes - 1) : originalVotes + 1;
            const optimisticList = list.slice();
            optimisticList[targetIndex] = {
                ...originalItem,
                votes: optimisticVotes,
                isVoted: !originalIsVoted,
                likeIcon: likeIcon.getLikeIcon(optimisticVotes, !originalIsVoted)
            };
            this.setData({ postList: optimisticList });

            togglePostLike(postId, {
                pageTag: 'tag-filter',
                context: this,
                currentVotes: originalVotes,
                currentIsLiked: originalIsVoted,
                requireAuth: true
            }).then((result) => {
                if (result.success) {
                    const currentList = this.postList;
                    const currentIndex = currentList.findIndex((p) => p._id === postId);
                    if (currentIndex > -1) {
                        const newList = currentList.slice();
                        newList[currentIndex] = {
                            ...currentList[currentIndex],
                            votes: result.votes,
                            isVoted: result.isLiked,
                            likeIcon: result.likeIcon
                        };
                        this.setData({ postList: newList });
                    }
                } else {
                    // 回滚
                    const currentList = this.postList;
                    const currentIndex = currentList.findIndex((p) => p._id === postId);
                    if (currentIndex > -1) {
                        const newList = currentList.slice();
                        newList[currentIndex] = {
                            ...currentList[currentIndex],
                            votes: originalVotes,
                            isVoted: originalIsVoted,
                            likeIcon: likeIcon.getLikeIcon(originalVotes, originalIsVoted)
                        };
                        this.setData({ postList: newList });
                    }
                }
            }).catch(() => {
                // 回滚
                const currentList = this.postList;
                const currentIndex = currentList.findIndex((p) => p._id === postId);
                if (currentIndex > -1) {
                    const newList = currentList.slice();
                    newList[currentIndex] = {
                        ...currentList[currentIndex],
                        votes: originalVotes,
                        isVoted: originalIsVoted,
                        likeIcon: likeIcon.getLikeIcon(originalVotes, originalIsVoted)
                    };
                    this.setData({ postList: newList });
                }
            }).finally(() => {
                this.votingInProgress[postId] = false;
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
