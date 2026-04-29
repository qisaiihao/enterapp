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

        <!-- 搜索过滤 -->
        <view v-if="searchKeyword && !isSearching" class="search-filters">
            <view class="filter-item" :class="{ active: currentFilter === 'all' }" @tap="setFilter" data-filter="all">
                <text class="filter-text">全部</text>
            </view>
            <view class="filter-item" :class="{ active: currentFilter === 'recent' }" @tap="setFilter" data-filter="recent">
                <text class="filter-text">最近</text>
            </view>
            <view class="filter-item" :class="{ active: currentFilter === 'popular' }" @tap="setFilter" data-filter="popular">
                <text class="filter-text">热门</text>
            </view>
            <view class="filter-item" :class="{ active: currentFilter === 'poetry' }" @tap="setFilter" data-filter="poetry">
                <text class="filter-text">诗歌</text>
            </view>
        </view>

        <!-- 搜索结果 -->
        <view v-if="searchKeyword && !isSearching && searchResults.length > 0" class="search-results">
            <view class="results-header">
                <text class="results-count">找到 {{ searchResults.length }} 个结果</text>
                <view class="sort-options">
                    <text class="sort-item" :class="{ active: currentSort === 'relevance' }" @tap="setSort" data-sort="relevance">相关度</text>
                    <text class="sort-item" :class="{ active: currentSort === 'time' }" @tap="setSort" data-sort="time">时间</text>
                </view>
            </view>

            <view class="post-list">
                <view class="post-item-wrapper" v-for="(item, index) in searchResults" :key="index">
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
                        <view class="post-title" v-html="item.highlightedTitle || item.title"></view>

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

                        <view class="post-content" v-if="item.content" style="white-space: pre-wrap" v-html="item.highlightedContent || item.content"></view>

                        <!-- 标签显示 -->
                        <view v-if="item.tags && item.tags.length > 0" class="post-tags">
                            <text class="post-tag" @tap.stop.prevent="onTagClick" :data-tag="tag" v-for="(tag, index1) in (item.highlightedTags || item.tags)" :key="index1" v-html="'#' + tag"></text>
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

            <!-- 加载更多 -->
            <view v-if="hasMore && searchResults.length > 0" class="load-more" @tap="loadMore">
                <text v-if="!isLoadingMore" class="load-more-text">加载更多</text>
                <text v-else class="load-more-text">加载中...</text>
            </view>
        </view>

        <!-- 空状态 -->
        <view v-if="searchKeyword && !isSearching && searchResults.length === 0" class="empty-state">
            <view class="empty-icon">🔍</view>
            <view class="empty-text">没有找到相关帖子</view>
            <view class="empty-subtext">试试其他关键词吧</view>
        </view>

        <!-- 搜索建议 -->
        <view v-if="searchKeyword && !isSearching && searchSuggestions.length > 0" class="search-suggestions">
            <view class="suggestions-header">
                <text class="suggestions-title">搜索建议</text>
            </view>
            <view class="suggestions-list">
                <view class="suggestion-item" @tap="selectSuggestion" :data-keyword="item" v-for="(item, index) in searchSuggestions" :key="index">
                    <text class="suggestion-text">{{ item }}</text>
                </view>
            </view>
        </view>

        <!-- 搜索历史 -->
        <view v-if="!searchKeyword && !isSearching && searchHistory.length > 0" class="search-history">
            <view class="history-header">
                <text class="history-title">搜索历史</text>
                <text class="clear-history" @tap="clearHistory">清空</text>
            </view>
            <view class="history-list">
                <view class="history-item" @tap="selectHistoryKeyword" :data-keyword="item" v-for="(item, index) in searchHistory" :key="index">
                    <text class="history-text">{{ item }}</text>
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

    </view>
</template>

<script>
import skeleton from '@/components/skeleton/skeleton';
import { previewImage } from '../../utils/imagePreview.js';
import { normalizePostList } from '../../utils/postNormalizer.js';
import { searchCache } from '../../utils/searchCache.js';
import SearchHighlighter from '../../utils/searchHighlighter.js';
import searchHistoryCache from '../../cache/stores/search-history.js';
import {
    getSearchSuggestions as getSearchSuggestionsApi,
    searchPosts,
    recordSearchStats as recordSearchStatsApi,
    getHotSearches as getHotSearchesApi
} from '../../api-cache/search.js';
// pages/search/search.js
// ????????????????????????????????????

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
            searchSuggestions: [],
            hotSearches: ['诗歌', '原创', '生活', '感悟', '旅行', '美食', '摄影', '读书'],

            // 过滤和排序
            currentFilter: 'all',
            currentSort: 'relevance',

            // 分页
            currentPage: 1,
            hasMore: true,
            isLoadingMore: false,

            // 防抖定时器
            searchTimer: null,
            suggestionTimer: null,

            img: ''
        };
    },
    onLoad: function (options) {
        // 加载搜索历史
        this.loadSearchHistory();
        // 获取热门搜索词
        this.getHotSearches();
    },
    methods: {
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
            if (this.suggestionTimer) {
                clearTimeout(this.suggestionTimer);
            }

            // 如果输入为空，立即清空结果和建议
            if (!keyword.trim()) {
                this.setData({
                    searchResults: [],
                    searchSuggestions: [],
                    isSearching: false
                });
                return;
            }

            // 设置搜索建议定时器，300ms后获取建议
            const suggestionTimer = setTimeout(() => {
                this.getSearchSuggestions(keyword);
            }, 300);
            this.setData({
                suggestionTimer: suggestionTimer
            });

            // 设置防抖定时器，800ms后自动搜索
            const timer = setTimeout(() => {
                this.performSearch(keyword);
            }, 800);
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

        // 获取搜索建议
        getSearchSuggestions: function (keyword) {
            if (!keyword.trim()) {
                return;
            }

            getSearchSuggestionsApi(keyword, 8, {
                context: this
            }).then((result) => {
                    this.setData({
                        searchSuggestions: result.suggestions || []
                    });
            }).catch((err) => {
                console.error('获取搜索建议失败:', err && err.message ? err.message : err, err && err.result ? err.result : '');
            });
        },

        // 选择搜索建议
        selectSuggestion: function (e) {
            const keyword = e.currentTarget.dataset.keyword;
            this.setData({
                searchKeyword: keyword,
                searchSuggestions: []
            });
            this.performSearch(keyword);
        },

        // 清空搜索
        clearSearch: function () {
            // 清除防抖定时器
            if (this.searchTimer) {
                clearTimeout(this.searchTimer);
            }
            if (this.suggestionTimer) {
                clearTimeout(this.suggestionTimer);
            }
            this.setData({
                searchKeyword: '',
                searchResults: [],
                searchSuggestions: [],
                isSearching: false,
                searchTimer: null,
                suggestionTimer: null
            });
        },

        // 执行搜索
        performSearch: function (keyword, isLoadMore = false) {
            const searchKeyword = keyword || this.searchKeyword;
            console.log('执行搜索，关键词:', searchKeyword, '传入参数:', keyword, '当前数据:', this.searchKeyword);
            
            // 如果没有搜索关键词且没有过滤条件，则不执行搜索
            if (!searchKeyword.trim() && this.currentFilter === 'all') {
                // 清空结果但不显示错误
                this.setData({
                    searchResults: [],
                    searchSuggestions: [],
                    isSearching: false
                });
                return;
            }

            // 如果不是加载更多，重置分页状态
            if (!isLoadMore) {
                this.setData({
                    currentPage: 1,
                    hasMore: true,
                    isLoadingMore: false
                });
            }

            // 检查缓存
            const cacheKey = searchCache.get(searchKeyword, this.currentFilter, this.currentSort, this.currentPage);
            if (cacheKey && !isLoadMore) {
                console.log('使用缓存结果');
                this.setData({
                    searchResults: cacheKey.posts || [],
                    searchSuggestions: [],
                    isSearching: false,
                    searchKeyword: searchKeyword,
                    hasMore: cacheKey.hasMore || false
                });
                return;
            }

            // 立即清空之前的结果和建议，确保界面立即更新
            if (!isLoadMore) {
                this.setData({
                    searchResults: [],
                    searchSuggestions: [],
                    isSearching: true,
                    searchKeyword: searchKeyword
                });
            } else {
                this.setData({
                    isLoadingMore: true
                });
            }

            // 保存搜索历史
            if (!isLoadMore) {
                this.saveSearchHistory(searchKeyword);
                // 记录搜索统计
                this.recordSearchStats(searchKeyword);
            }

            // 调用云函数搜索
            searchPosts(searchKeyword, {
                    limit: 20,
                    filter: this.currentFilter,
                    sort: this.currentSort,
                    page: this.currentPage
                }, {
                    context: this
                }).then((result) => {
                        const posts = normalizePostList(result.posts || []);
                        console.log('设置搜索结果:', posts.length, '条结果，关键词:', searchKeyword);
                        
                        // 添加搜索高亮
                        const keywords = SearchHighlighter.extractKeywords(searchKeyword);
                        const highlightedPosts = posts.map(post => ({
                            ...post,
                            highlightedTitle: SearchHighlighter.highlightTitle(post.title, keywords),
                            highlightedContent: SearchHighlighter.highlightText(post.content, keywords),
                            highlightedTags: SearchHighlighter.highlightTags(post.tags, keywords)
                        }));
                        
                        let newResults = [];
                        if (isLoadMore) {
                            newResults = [...this.searchResults, ...highlightedPosts];
                        } else {
                            newResults = highlightedPosts;
                        }
                        
                        this.setData({
                            searchResults: newResults,
                            hasMore: posts.length >= 20
                        });

                        // 缓存结果
                        searchCache.set(searchKeyword, this.currentFilter, this.currentSort, this.currentPage, {
                            posts: newResults,
                            hasMore: posts.length >= 20
                        });
                }).catch((err) => {
                    console.error('搜索失败:', err);
                    uni.showToast({
                        title: err.message || '搜索失败',
                        icon: 'none'
                    });
                }).finally(() => {
                    this.setData({
                        isSearching: false,
                        isLoadingMore: false
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
                        searchHistoryCache.clearSearchHistory();
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
                const history = searchHistoryCache.getDisplayHistory();
                this.setData({
                    searchHistory: history
                });
            } catch (e) {
                console.error('加载搜索历史失败:', e);
            }
        },

        // 保存搜索历史
        saveSearchHistory: function (keyword) {
            try {
                searchHistoryCache.addSearchHistory(keyword);
                this.setData({
                    searchHistory: searchHistoryCache.getDisplayHistory()
                });
            } catch (e) {
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
                url: `/pages-tools/tag-filter/tag-filter?tag=${encodeURIComponent(tag)}`
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
        handlePreview: function (event) {
            return previewImage(event, { fallbackToast: false });
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
                url: `/pages-user/user-profile/user-profile?userId=${userId}`
            });
        },

        // 设置过滤条件
        setFilter: function (e) {
            const filter = e.currentTarget.dataset.filter;
            this.setData({
                currentFilter: filter
            });
            this.performSearch();
        },

        // 设置排序方式
        setSort: function (e) {
            const sort = e.currentTarget.dataset.sort;
            this.setData({
                currentSort: sort
            });
            this.sortResults();
        },

        // 排序搜索结果
        sortResults: function () {
            let sortedResults = [...this.searchResults];
            
            if (this.currentSort === 'relevance') {
                // 按相关性分数排序
                sortedResults.sort((a, b) => {
                    const scoreA = a.relevanceScore || 0;
                    const scoreB = b.relevanceScore || 0;
                    if (scoreB !== scoreA) {
                        return scoreB - scoreA;
                    }
                    return new Date(b.createTime) - new Date(a.createTime);
                });
            } else if (this.currentSort === 'time') {
                // 按时间排序
                sortedResults.sort((a, b) => new Date(b.createTime) - new Date(a.createTime));
            }
            
            this.setData({
                searchResults: sortedResults
            });
        },

        // 加载更多搜索结果
        loadMore: function () {
            if (this.isLoadingMore || !this.hasMore) {
                return;
            }

            this.setData({
                currentPage: this.currentPage + 1
            });

            this.performSearch(null, true);
        },

        // 页面滚动到底部时触发
        onReachBottom: function () {
            if (this.searchKeyword && this.hasMore && !this.isLoadingMore) {
                this.loadMore();
            }
        },

        // 记录搜索统计
        recordSearchStats: function (keyword) {
            if (!keyword.trim()) {
                return;
            }

            recordSearchStatsApi(keyword, {
                context: this
            }).then(() => {
                console.log('搜索统计记录成功');
            }).catch((err) => {
                console.error('搜索统计记录失败:', err);
            });
        },

        // 获取热门搜索词
        getHotSearches: function () {
            getHotSearchesApi(10, {
                context: this
            }).then((result) => {
                    const hotSearches = (result.hotSearches || []).map(item => item.keyword);
                    this.setData({
                        hotSearches: hotSearches.length > 0 ? hotSearches : this.hotSearches
                    });
            }).catch((err) => {
                console.error('获取热门搜索词失败:', err && err.message ? err.message : err, err && err.result ? err.result : '');
            });
        }
    }
};
</script>
<style>
/* pages/search/search.wxss */
.container {
    padding: 20rpx;
    background-color: var(--app-page-bg, #f7f8fa);
    min-height: 100vh;
    color: var(--app-primary-text, #333);
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
    background-color: var(--app-surface-bg, #fff);
    border-radius: 16rpx;
    padding: 20rpx 30rpx;
    box-shadow: var(--app-surface-shadow, 0 4rpx 12rpx rgba(0, 0, 0, 0.05));
    border: var(--app-surface-border-line, 1rpx solid rgba(0, 0, 0, 0.05));
}

.search-icon {
    font-size: 32rpx;
    margin-right: 20rpx;
    color: var(--app-muted-text, #999);
}

.search-input {
    flex: 1;
    font-size: 28rpx;
    color: var(--app-primary-text, #333);
}

.clear-btn {
    font-size: 40rpx;
    color: var(--app-muted-text, #999);
    margin-left: 20rpx;
    padding: 10rpx;
}

.cancel-btn {
    font-size: 28rpx;
    color: #9ed7ee;
    padding: 20rpx;
}

/* 搜索过滤 */
.search-filters {
    display: flex;
    gap: 15rpx;
    margin-bottom: 20rpx;
    padding: 0 10rpx;
}

.filter-item {
    background-color: var(--app-subtle-surface-bg, #f5f5f5);
    border-radius: 20rpx;
    padding: 12rpx 20rpx;
    transition: all 0.2s ease;
}

.filter-item.active {
    background-color: #9ed7ee;
    color: #fff;
}

.filter-text {
    font-size: 26rpx;
    color: var(--app-secondary-text, #333);
}

.filter-item.active .filter-text {
    color: #fff;
}

/* 搜索结果 */
.search-results {
    margin-bottom: 20rpx;
}

.results-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 20rpx;
}

.results-count {
    font-size: 24rpx;
    color: var(--app-muted-text, #999);
}

.sort-options {
    display: flex;
    gap: 20rpx;
}

.sort-item {
    font-size: 24rpx;
    color: var(--app-muted-text, #999);
    padding: 8rpx 16rpx;
    border-radius: 12rpx;
    transition: all 0.2s ease;
}

.sort-item.active {
    background-color: #9ed7ee;
    color: #fff;
}

/* 文章列表样式 */
.post-list {
    margin-bottom: 20rpx;
}

.post-item-wrapper {
    background-color: var(--app-post-wrapper-bg, var(--app-surface-bg, #fff));
    border-radius: 16rpx;
    margin-bottom: 20rpx;
    box-shadow: var(--app-post-wrapper-shadow, 0 4rpx 12rpx rgba(0, 0, 0, 0.05));
    border: var(--app-post-wrapper-border, none);
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
    color: var(--app-post-author-color, #333);
    font-weight: 500;
}

/* 帖子内容 */
.post-item {
    padding: 0 20rpx 20rpx 20rpx;
}

.post-title {
    font-size: 32rpx;
    font-weight: bold;
    color: var(--app-post-title-color, #333);
    margin-bottom: 15rpx;
    line-height: 1.4;
}

.post-content {
    font-size: 28rpx;
    color: var(--app-post-content-color, #666);
    line-height: 1.6;
    margin-bottom: 15rpx;
}

/* 图片容器 */
.image-container-wrapper {
    position: relative;
    width: 100%;
    margin-bottom: 15rpx;
    background-color: var(--app-subtle-surface-bg, #f0f0f0);
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
    border-top: var(--app-surface-border-line, 1rpx solid #f0f0f0);
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
    color: var(--app-post-action-color, #999);
}

/* 空状态 */
.empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 400rpx;
    background-color: var(--app-surface-bg, #fff);
    border-radius: 16rpx;
    margin: 30rpx;
    box-shadow: var(--app-surface-shadow, 0 4rpx 12rpx rgba(0, 0, 0, 0.05));
    border: var(--app-surface-border-line, none);
}

.empty-icon {
    font-size: 80rpx;
    margin-bottom: 20rpx;
}

.empty-text {
    font-size: 32rpx;
    color: var(--app-primary-text, #333);
    margin-bottom: 10rpx;
}

.empty-subtext {
    font-size: 28rpx;
    color: var(--app-muted-text, #999);
}

/* 搜索建议 */
.search-suggestions {
    background-color: var(--app-surface-bg, #fff);
    border-radius: 16rpx;
    padding: 30rpx;
    box-shadow: var(--app-surface-shadow, 0 4rpx 12rpx rgba(0, 0, 0, 0.05));
    border: var(--app-surface-border-line, none);
    margin-bottom: 20rpx;
}

.suggestions-header {
    margin-bottom: 20rpx;
}

.suggestions-title {
    font-size: 28rpx;
    color: var(--app-primary-text, #333);
    font-weight: 500;
}

.suggestions-list {
    display: flex;
    flex-wrap: wrap;
    gap: 15rpx;
}

.suggestion-item {
    background-color: var(--app-subtle-surface-bg, #f0f8ff);
    border-radius: 20rpx;
    padding: 12rpx 20rpx;
    transition: all 0.2s ease;
}

.suggestion-item:active {
    background-color: var(--app-subtle-surface-bg, #e0f0ff);
    transform: scale(0.95);
}

.suggestion-text {
    font-size: 26rpx;
    color: #9ed7ee;
}

/* 搜索历史 */
.search-history {
    background-color: var(--app-surface-bg, #fff);
    border-radius: 16rpx;
    padding: 30rpx;
    box-shadow: var(--app-surface-shadow, 0 4rpx 12rpx rgba(0, 0, 0, 0.05));
    border: var(--app-surface-border-line, none);
    margin-bottom: 20rpx;
}

.history-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 20rpx;
}

.history-title {
    font-size: 28rpx;
    color: var(--app-primary-text, #333);
    font-weight: 500;
}

.clear-history {
    font-size: 24rpx;
    color: var(--app-muted-text, #999);
}

.history-list {
    display: flex;
    flex-wrap: wrap;
    gap: 15rpx;
}

.history-item {
    background-color: var(--app-subtle-surface-bg, #f5f5f5);
    border-radius: 20rpx;
    padding: 12rpx 20rpx;
    transition: all 0.2s ease;
}

.history-item:active {
    background-color: var(--app-subtle-surface-bg, #e8e8e8);
    transform: scale(0.95);
}

.history-text {
    font-size: 26rpx;
    color: var(--app-secondary-text, #333);
}

/* 热门搜索 */
.hot-searches {
    background-color: var(--app-surface-bg, #fff);
    border-radius: 16rpx;
    padding: 30rpx;
    box-shadow: var(--app-surface-shadow, 0 4rpx 12rpx rgba(0, 0, 0, 0.05));
    border: var(--app-surface-border-line, none);
}

.hot-header {
    margin-bottom: 20rpx;
}

.hot-title {
    font-size: 28rpx;
    color: var(--app-primary-text, #333);
    font-weight: 500;
}

.hot-list {
    display: flex;
    flex-wrap: wrap;
    gap: 15rpx;
}

.hot-item {
    background-color: var(--app-subtle-surface-bg, #f0f8ff);
    border-radius: 20rpx;
    padding: 12rpx 20rpx;
    transition: all 0.2s ease;
}

.hot-item:active {
    background-color: var(--app-subtle-surface-bg, #e0f0ff);
    transform: scale(0.95);
}

.hot-text {
    font-size: 26rpx;
    color: #9ed7ee;
}

/* 搜索高亮 */
.search-highlight {
    background-color: #ffeb3b;
    color: #333;
    padding: 2rpx 4rpx;
    border-radius: 4rpx;
    font-weight: bold;
}

/* 加载更多 */
.load-more {
    display: flex;
    justify-content: center;
    align-items: center;
    padding: 30rpx;
    margin: 20rpx 0;
    background-color: var(--app-surface-bg, #fff);
    border-radius: 16rpx;
    box-shadow: var(--app-surface-shadow, 0 4rpx 12rpx rgba(0, 0, 0, 0.05));
    border: var(--app-surface-border-line, none);
    transition: all 0.2s ease;
}

.load-more:active {
    background-color: var(--app-subtle-surface-bg, #f5f5f5);
    transform: scale(0.98);
}

.load-more-text {
    font-size: 28rpx;
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
    color: var(--app-muted-text, #999);
}
</style>
