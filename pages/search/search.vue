<template>
    <!-- pages/search/search.wxml -->
    <view class="container">
        <!-- 搜索框 -->
        <view class="search-header">
            <view class="search-input-container">
                <view class="search-icon">🔍</view>
                <input
                    class="search-input"
                    placeholder="搜索帖子..."
                    :value="searchKeyword"
                    @input="onSearchInput"
                    @confirm="onSearchConfirm"
                    :focus="true"
                    confirm-type="search"
                />
                <view v-if="searchKeyword" class="clear-btn" @tap="clearSearch">×</view>
            </view>
            <view class="cancel-btn" @tap="goBack">取消</view>
        </view>

        <!-- 搜索结果 -->
        <view v-if="searchKeyword && !isSearching && searchResults.length > 0" class="search-results">
            <view class="results-header">
                <text class="results-count">找到 {{ searchResults.length }} 个结果</text>
            </view>

            <view class="post-list">
                <view class="post-item-wrapper" v-for="(item, index) in searchResults" :key="index">
                    <!-- 作者信息 -->

                    <view class="author-info-outside">
                        <image
                            v-if="item.authorAvatar"
                            class="author-avatar"
                            :src="item.authorAvatar"
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
        </view>

        <!-- 空状态 -->
        <view v-if="searchKeyword && !isSearching && searchResults.length === 0" class="empty-state">
            <view class="empty-icon">🔍</view>
            <view class="empty-text">没有找到相关帖子</view>
            <view class="empty-subtext">试试其他关键词吧</view>
        </view>

        <!-- 搜索建议 -->
        <view v-if="!searchKeyword && !isSearching && searchHistory.length > 0" class="search-suggestions">
            <view class="suggestions-header">
                <text class="suggestions-title">搜索历史</text>
                <text class="clear-history" @tap="clearHistory">清空</text>
            </view>
            <view class="suggestions-list">
                <view class="suggestion-item" @tap="selectHistoryKeyword" :data-keyword="item" v-for="(item, index) in searchHistory" :key="index">
                    <text class="suggestion-text">{{ item }}</text>
                </view>
            </view>
        </view>

        <!-- 热门搜索 -->
        <view v-if="!searchKeyword && !isSearching && searchHistory.length === 0" class="hot-searches">
            <view class="hot-header">
                <text class="hot-title">热门搜索</text>
            </view>
            <view class="hot-list">
                <view class="hot-item" @tap="selectHotKeyword" :data-keyword="item" v-for="(item, index) in hotSearches" :key="index">
                    <text class="hot-text">{{ item }}</text>
                </view>
            </view>
        </view>

        <!-- 加载状态 -->
        <view v-if="isSearching" class="loading-state">
            <view class="loading-text">搜索中...</view>
        </view>
    </view>
</template>

<script>
import skeleton from '@/components/skeleton/skeleton';
// pages/search/search.js
// 修复：移除全局数据库实例，改为在方法中动态获取
export default {
    components: {
        skeleton
    },
    data() {
        return {
            searchKeyword: '',
            searchResults: [],
            isSearching: false,
            searchHistory: [],
            hotSearches: ['诗歌', '原创', '生活', '感悟', '旅行', '美食', '摄影', '读书'],

            // 防抖定时器
            searchTimer: null,

            img: ''
        };
    },
    onLoad: function (options) {
        // 加载搜索历史
        this.loadSearchHistory();
    },
    methods: {
        // 兼容性云函数调用方法
        callCloudFunction(name, data = {}) {
            console.log(`🔍 [搜索页] 调用云函数: ${name}`, data);
            
            return new Promise((resolve, reject) => {
                // 使用新的平台检测工具
                const { getCurrentPlatform, getCloudFunctionMethod } = require('../../utils/platformDetector.js');
                
                const platform = getCurrentPlatform();
                const method = getCloudFunctionMethod();
                
                console.log(`🔍 [搜索页] 运行环境检测 - 平台: ${platform}, 方法: ${method}`);
                
                if (method === 'tcb') {
                    // 使用TCB调用云函数（H5和App环境）
                    if (this.$tcb && this.$tcb.callFunction) {
                        console.log(`🔍 [搜索页] TCB环境调用云函数: ${name}`);
                        this.$tcb.callFunction({
                            name: name,
                            data: data
                        }).then(resolve).catch(reject);
                    } else {
                        console.error(`❌ [搜索页] TCB实例不可用`);
                        reject(new Error('TCB实例不可用'));
                    }
                } else if (method === 'wx-cloud') {
                    // 使用微信云开发调用云函数（小程序环境）
                    if (wx.cloud && wx.cloud.callFunction) {
                        console.log(`🔍 [搜索页] 小程序环境调用云函数: ${name}`);
                        wx.cloud.callFunction({
                            name: name,
                            data: data,
                            success: (res) => {
                                console.log(`✅ [搜索页] 云函数调用成功: ${name}`, res);
                                resolve(res);
                            },
                            fail: (err) => {
                                console.error(`❌ [搜索页] 云函数调用失败: ${name}`, err);
                                reject(err);
                            }
                        });
                    } else {
                        console.error(`❌ [搜索页] 微信云开发不可用`);
                        reject(new Error('微信云开发不可用'));
                    }
                } else {
                    console.error(`❌ [搜索页] 不支持的云函数调用方式: ${method}`);
                    reject(new Error(`不支持的云函数调用方式: ${method}`));
                }
            });
        },
        // 搜索输入处理
        onSearchInput: function (e) {
            const keyword = e.detail.value;
            this.setData({
                searchKeyword: keyword
            });

            // 清除之前的定时器
            if (this.searchTimer) {
                clearTimeout(this.searchTimer);
            }

            // 如果输入为空，立即清空结果
            if (!keyword.trim()) {
                this.setData({
                    searchResults: [],
                    isSearching: false
                });
                return;
            }

            // 设置防抖定时器，500ms后自动搜索
            const timer = setTimeout(() => {
                this.performSearch(keyword);
            }, 500);
            this.setData({
                searchTimer: timer
            });
        },

        // 搜索确认处理
        onSearchConfirm: function (e) {
            const keyword = e.detail.value.trim();
            if (keyword) {
                // 清除防抖定时器
                if (this.searchTimer) {
                    clearTimeout(this.searchTimer);
                    this.setData({
                        searchTimer: null
                    });
                }
                this.setData({
                    searchKeyword: keyword
                });
                this.performSearch(keyword);
            }
        },

        // 清空搜索
        clearSearch: function () {
            // 清除防抖定时器
            if (this.searchTimer) {
                clearTimeout(this.searchTimer);
            }
            this.setData({
                searchKeyword: '',
                searchResults: [],
                isSearching: false,
                searchTimer: null
            });
        },

        // 执行搜索
        performSearch: function (keyword) {
            const searchKeyword = keyword || this.searchKeyword;
            console.log('执行搜索，关键词:', searchKeyword, '传入参数:', keyword, '当前数据:', this.searchKeyword);
            if (!searchKeyword.trim()) {
                return;
            }

            // 立即清空之前的结果，确保界面立即更新
            this.setData({
                searchResults: [],
                isSearching: true,
                searchKeyword: searchKeyword
            });

            // 保存搜索历史
            this.saveSearchHistory(searchKeyword);

            // 调用云函数搜索
            this.callCloudFunction('searchPosts', {
                    keyword: searchKeyword,
                    limit: 20
                }).then((res) => {
                    console.log('搜索结果:', res);
                    if (res.result && res.result.success) {
                        let posts = res.result.posts || [];

                        // 处理图片数据
                        posts = posts.map((post) => {
                            if (!post.imageUrls || post.imageUrls.length === 0) {
                                post.imageUrls = post.imageUrl ? [post.imageUrl] : [];
                            }

                            // 设置图片容器样式
                            if (post.imageUrls.length > 0) {
                                post.imageStyle = `height: 0; padding-bottom: 75%;`;
                            }
                            return post;
                        });
                        console.log('设置搜索结果:', posts.length, '条结果，关键词:', searchKeyword);
                        this.setData({
                            searchResults: posts
                        });
                    } else {
                        uni.showToast({
                            title: '搜索失败',
                            icon: 'none'
                        });
                    }
                }).catch((err) => {
                    console.error('搜索失败:', err);
                    uni.showToast({
                        title: '网络错误',
                        icon: 'none'
                    });
                }).finally(() => {
                    this.setData({
                        isSearching: false
                    });
                });
        },

        // 选择历史关键词
        selectHistoryKeyword: function (e) {
            const keyword = e.currentTarget.dataset.keyword;
            this.setData(
                {
                    searchKeyword: keyword
                },
                () => {
                    this.performSearch(keyword);
                }
            );
        },

        // 选择热门关键词
        selectHotKeyword: function (e) {
            const keyword = e.currentTarget.dataset.keyword;
            this.setData(
                {
                    searchKeyword: keyword
                },
                () => {
                    this.performSearch(keyword);
                }
            );
        },

        // 清空搜索历史
        clearHistory: function () {
            uni.showModal({
                title: '确认清空',
                content: '确定要清空搜索历史吗？',
                success: (res) => {
                    if (res.confirm) {
                        uni.removeStorageSync('searchHistory');
                        this.setData({
                            searchHistory: []
                        });
                    }
                }
            });
        },

        // 加载搜索历史
        loadSearchHistory: function () {
            try {
                const history = uni.getStorageSync('searchHistory') || [];
                this.setData({
                    searchHistory: history.slice(0, 10) // 最多显示10条历史记录
                });
            } catch (e) {
                console.log('CatchClause', e);
                console.log('CatchClause', e);
                console.error('加载搜索历史失败:', e);
            }
        },

        // 保存搜索历史
        saveSearchHistory: function (keyword) {
            try {
                let history = uni.getStorageSync('searchHistory') || [];

                // 移除重复项
                history = history.filter((item) => item !== keyword);

                // 添加到开头
                history.unshift(keyword);

                // 限制历史记录数量
                history = history.slice(0, 20);
                uni.setStorageSync('searchHistory', history);
                this.setData({
                    searchHistory: history.slice(0, 10)
                });
            } catch (e) {
                console.log('CatchClause', e);
                console.log('CatchClause', e);
                console.error('保存搜索历史失败:', e);
            }
        },

        // 返回上一页
        goBack: function () {
            uni.navigateBack();
        },

        // 帖子点击处理
        onPostTap: function (e) {
            const postId = e.currentTarget.dataset.postid;
            uni.navigateTo({
                url: `/pages/post-detail/post-detail?id=${postId}`
            });
        },

        // 标签点击处理
        onTagClick: function (e) {
            const tag = e.currentTarget.dataset.tag;
            uni.navigateTo({
                url: `/pages/tag-filter/tag-filter?tag=${encodeURIComponent(tag)}`
            });
        },

        // 评论点击处理
        onCommentClick: function (e) {
            const postId = e.currentTarget.dataset.postid;
            uni.navigateTo({
                url: `/pages/post-detail/post-detail?id=${postId}`
            });
        },

        // 图片预览处理
        handlePreview: function (e) {
            const current = e.currentTarget.dataset.src || e.currentTarget.dataset.imageUrl;
            const urls = e.currentTarget.dataset.originalImageUrls;
            if (current && urls && urls.length > 0) {
                uni.previewImage({
                    current,
                    urls
                });
            }
        },

        // 头像错误处理
        onAvatarError: function (e) {
            console.error('头像加载失败', e.detail);
        },

        // 图片错误处理
        onImageError: function (e) {
            console.error('图片加载失败', e.detail);
        },

        // 跳转到用户主页
        navigateToUserProfile: function (e) {
            const userId = e.currentTarget.dataset.userId;
            uni.navigateTo({
                url: `/pages/user-profile/user-profile?userId=${userId}`
            });
        }
    }
};
</script>
<style>
/* pages/search/search.wxss */
.container {
    padding: 20rpx;
    background-color: #f7f8fa;
    min-height: 100vh;
}

/* 搜索头部 */
.search-header {
    display: flex;
    align-items: center;
    margin-bottom: 30rpx;
    gap: 20rpx;
}

.search-input-container {
    flex: 1;
    display: flex;
    align-items: center;
    background-color: #fff;
    border-radius: 16rpx;
    padding: 20rpx 30rpx;
    box-shadow: 0 4rpx 12rpx rgba(0, 0, 0, 0.05);
    border: 1rpx solid rgba(0, 0, 0, 0.05);
}

.search-icon {
    font-size: 32rpx;
    margin-right: 20rpx;
    color: #999;
}

.search-input {
    flex: 1;
    font-size: 28rpx;
    color: #333;
}

.clear-btn {
    font-size: 40rpx;
    color: #999;
    margin-left: 20rpx;
    padding: 10rpx;
}

.cancel-btn {
    font-size: 28rpx;
    color: #9ed7ee;
    padding: 20rpx;
}

/* 搜索结果 */
.search-results {
    margin-bottom: 20rpx;
}

.results-header {
    margin-bottom: 20rpx;
}

.results-count {
    font-size: 24rpx;
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
    background-color: #f0f0f0;
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

/* 空状态 */
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

/* 搜索建议 */
.search-suggestions {
    background-color: #fff;
    border-radius: 16rpx;
    padding: 30rpx;
    box-shadow: 0 4rpx 12rpx rgba(0, 0, 0, 0.05);
}

.suggestions-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 20rpx;
}

.suggestions-title {
    font-size: 28rpx;
    color: #333;
    font-weight: 500;
}

.clear-history {
    font-size: 24rpx;
    color: #999;
}

.suggestions-list {
    display: flex;
    flex-wrap: wrap;
    gap: 15rpx;
}

.suggestion-item {
    background-color: #f5f5f5;
    border-radius: 20rpx;
    padding: 12rpx 20rpx;
    transition: all 0.2s ease;
}

.suggestion-item:active {
    background-color: #e8e8e8;
    transform: scale(0.95);
}

.suggestion-text {
    font-size: 26rpx;
    color: #333;
}

/* 热门搜索 */
.hot-searches {
    background-color: #fff;
    border-radius: 16rpx;
    padding: 30rpx;
    box-shadow: 0 4rpx 12rpx rgba(0, 0, 0, 0.05);
}

.hot-header {
    margin-bottom: 20rpx;
}

.hot-title {
    font-size: 28rpx;
    color: #333;
    font-weight: 500;
}

.hot-list {
    display: flex;
    flex-wrap: wrap;
    gap: 15rpx;
}

.hot-item {
    background-color: #f0f8ff;
    border-radius: 20rpx;
    padding: 12rpx 20rpx;
    transition: all 0.2s ease;
}

.hot-item:active {
    background-color: #e0f0ff;
    transform: scale(0.95);
}

.hot-text {
    font-size: 26rpx;
    color: #9ed7ee;
}

/* 加载状态 */
.loading-state {
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
