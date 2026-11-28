<template>
    <!-- pages/favorite-content/favorite-content.wxml -->
    <view class="container favorite-content-page" :class="{ 'favorite-content-page--wide': isWideLayout }" :data-app-theme="appThemeMode" :style="[appThemeVars, readFontVars]">

        <!-- 收藏内容列表 -->
        <view v-if="favorites.length > 0" id="favorite-list-container" class="favorites-container" :class="{ 'favorites-container--masonry': useTwoColumnFavorites, 'favorites-container--single-wide': isSingleWideFavorite }">
            <view v-if="useTwoColumnFavorites" class="app-masonry-columns favorite-masonry">
                <view class="app-masonry-column">
                    <view :class="'post-item-wrapper ' + (entry.item.isOriginal ? 'original-post' : '')" v-for="entry in leftColumnFavorites" :key="entry.item.favoriteId || entry.item._id || entry.index">
                        <view class="more-menu-btn-top-right" @tap.stop.prevent="showFavoriteActions(entry.item)">
                            <view class="more-menu-dots-small">
                                <view class="dot-small"></view>
                                <view class="dot-small"></view>
                                <view class="dot-small"></view>
                            </view>
                        </view>

                        <view class="author-info-outside">
                            <image
                                v-if="entry.item.postAuthorAvatar"
                                class="author-avatar"
                                :src="entry.item.postAuthorAvatar"
                                mode="aspectFill"
                                @error="onAvatarError"
                                @load="onAvatarLoad"
                                :data-postindex="entry.index"
                                @tap.stop.prevent="navigateToUserProfile"
                                :data-user-id="entry.item.postAuthorOpenid"
                            />
                            <text class="author-name">{{ entry.item.postAuthorName }}</text>
                        </view>

                        <navigator class="post-content-navigator" :url="'/pages/post-detail/post-detail?id=' + entry.item.postId" hover-class="navigator-hover">
                            <view class="post-item">
                                <view class="post-title">{{ entry.item.postTitle }}</view>
                                <view v-if="entry.item.postIsPoem && entry.item.postAuthor" class="poem-author">{{ entry.item.postAuthor }}</view>

                                <view
                                    v-if="entry.item.imageUrls && entry.item.imageUrls.length > 0"
                                    class="image-container-wrapper"
                                    :style="entry.item.imageStyle"
                                    @tap.stop.prevent="handlePreview"
                                    :data-src="entry.item.imageUrls[0]"
                                    :data-original-image-urls="entry.item.originalImageUrls || entry.item.imageUrls"
                                >
                                    <block v-if="entry.item.imageUrls.length === 1">
                                        <image
                                            :id="'single-image-' + entry.item.postId"
                                            class="post-image"
                                            :src="entry.item.imageUrls[0]"
                                            mode="aspectFill"
                                            :lazy-load="true"
                                            @error="onImageError"
                                            @load="onImageLoad"
                                            :data-postid="entry.item.postId"
                                            :data-postindex="entry.index"
                                            data-imgindex="0"
                                            data-type="single"
                                        />
                                    </block>

                                    <block v-else-if="entry.item.imageUrls.length > 1">
                                        <swiper
                                            :id="'swiper-' + entry.item.postId"
                                            class="image-swiper"
                                            :indicator-dots="true"
                                            :circular="true"
                                        >
                                            <block v-for="(img, imgindex) in entry.item.imageUrls" :key="imgindex">
                                                <swiper-item>
                                                    <image
                                                        class="post-image"
                                                        :src="img"
                                                        mode="aspectFill"
                                                        :lazy-load="true"
                                                        @error="onImageError"
                                                        @load="onImageLoad"
                                                        @tap.stop.prevent="handlePreview"
                                                        :data-src="img"
                                                        :data-original-image-urls="entry.item.originalImageUrls || entry.item.imageUrls"
                                                        :data-postid="entry.item.postId"
                                                        :data-postindex="entry.index"
                                                        :data-imgindex="imgindex"
                                                        data-type="multi"
                                                    />
                                                </swiper-item>
                                            </block>
                                        </swiper>
                                    </block>
                                </view>

                                <view class="post-content" v-if="entry.item.postContent" style="white-space: pre-wrap">{{ entry.item.postContent }}</view>

                                <view v-if="entry.item.postTags && entry.item.postTags.length > 0" class="post-tags">
                                    <text class="post-tag" @tap.stop.prevent="onTagClick" :data-tag="tag" v-for="(tag, index1) in entry.item.postTags" :key="index1">#{{ tag }}</text>
                                </view>
                            </view>
                        </navigator>

                        <view class="delete-section">
                            <view class="time-left">
                                <text class="favorite-time">收藏于 {{ entry.item.formattedFavoriteTime || entry.item.formattedCreateTime || '未知时间' }}</text>
                            </view>
                        </view>
                    </view>
                </view>

                <view class="app-masonry-column">
                    <view :class="'post-item-wrapper ' + (entry.item.isOriginal ? 'original-post' : '')" v-for="entry in rightColumnFavorites" :key="entry.item.favoriteId || entry.item._id || entry.index">
                        <view class="more-menu-btn-top-right" @tap.stop.prevent="showFavoriteActions(entry.item)">
                            <view class="more-menu-dots-small">
                                <view class="dot-small"></view>
                                <view class="dot-small"></view>
                                <view class="dot-small"></view>
                            </view>
                        </view>

                        <view class="author-info-outside">
                            <image
                                v-if="entry.item.postAuthorAvatar"
                                class="author-avatar"
                                :src="entry.item.postAuthorAvatar"
                                mode="aspectFill"
                                @error="onAvatarError"
                                @load="onAvatarLoad"
                                :data-postindex="entry.index"
                                @tap.stop.prevent="navigateToUserProfile"
                                :data-user-id="entry.item.postAuthorOpenid"
                            />
                            <text class="author-name">{{ entry.item.postAuthorName }}</text>
                        </view>

                        <navigator class="post-content-navigator" :url="'/pages/post-detail/post-detail?id=' + entry.item.postId" hover-class="navigator-hover">
                            <view class="post-item">
                                <view class="post-title">{{ entry.item.postTitle }}</view>
                                <view v-if="entry.item.postIsPoem && entry.item.postAuthor" class="poem-author">{{ entry.item.postAuthor }}</view>

                                <view
                                    v-if="entry.item.imageUrls && entry.item.imageUrls.length > 0"
                                    class="image-container-wrapper"
                                    :style="entry.item.imageStyle"
                                    @tap.stop.prevent="handlePreview"
                                    :data-src="entry.item.imageUrls[0]"
                                    :data-original-image-urls="entry.item.originalImageUrls || entry.item.imageUrls"
                                >
                                    <block v-if="entry.item.imageUrls.length === 1">
                                        <image
                                            :id="'single-image-' + entry.item.postId"
                                            class="post-image"
                                            :src="entry.item.imageUrls[0]"
                                            mode="aspectFill"
                                            :lazy-load="true"
                                            @error="onImageError"
                                            @load="onImageLoad"
                                            :data-postid="entry.item.postId"
                                            :data-postindex="entry.index"
                                            data-imgindex="0"
                                            data-type="single"
                                        />
                                    </block>

                                    <block v-else-if="entry.item.imageUrls.length > 1">
                                        <swiper
                                            :id="'swiper-' + entry.item.postId"
                                            class="image-swiper"
                                            :indicator-dots="true"
                                            :circular="true"
                                        >
                                            <block v-for="(img, imgindex) in entry.item.imageUrls" :key="imgindex">
                                                <swiper-item>
                                                    <image
                                                        class="post-image"
                                                        :src="img"
                                                        mode="aspectFill"
                                                        :lazy-load="true"
                                                        @error="onImageError"
                                                        @load="onImageLoad"
                                                        @tap.stop.prevent="handlePreview"
                                                        :data-src="img"
                                                        :data-original-image-urls="entry.item.originalImageUrls || entry.item.imageUrls"
                                                        :data-postid="entry.item.postId"
                                                        :data-postindex="entry.index"
                                                        :data-imgindex="imgindex"
                                                        data-type="multi"
                                                    />
                                                </swiper-item>
                                            </block>
                                        </swiper>
                                    </block>
                                </view>

                                <view class="post-content" v-if="entry.item.postContent" style="white-space: pre-wrap">{{ entry.item.postContent }}</view>

                                <view v-if="entry.item.postTags && entry.item.postTags.length > 0" class="post-tags">
                                    <text class="post-tag" @tap.stop.prevent="onTagClick" :data-tag="tag" v-for="(tag, index1) in entry.item.postTags" :key="index1">#{{ tag }}</text>
                                </view>
                            </view>
                        </navigator>

                        <view class="delete-section">
                            <view class="time-left">
                                <text class="favorite-time">收藏于 {{ entry.item.formattedFavoriteTime || entry.item.formattedCreateTime || '未知时间' }}</text>
                            </view>
                        </view>
                    </view>
                </view>
            </view>

            <block v-else>
                <view :class="'post-item-wrapper ' + (item.isOriginal ? 'original-post' : '')" v-for="(item, index) in favorites" :key="item.favoriteId || item._id">
                    <view class="more-menu-btn-top-right" @tap.stop.prevent="showFavoriteActions(item)">
                        <view class="more-menu-dots-small">
                            <view class="dot-small"></view>
                            <view class="dot-small"></view>
                            <view class="dot-small"></view>
                        </view>
                    </view>
                    <!-- 作者信息 -->

                    <view class="author-info-outside">
                        <image
                            v-if="item.postAuthorAvatar"
                            class="author-avatar"
                            :src="item.postAuthorAvatar"
                            mode="aspectFill"
                            @error="onAvatarError"
                            @load="onAvatarLoad"
                            :data-postindex="index"
                            @tap.stop.prevent="navigateToUserProfile"
                            :data-user-id="item.postAuthorOpenid"
                        />
                        <text class="author-name">{{ item.postAuthorName }}</text>
                    </view>

                    <!-- 可点击的内容区域 - 跳转到详情页 -->

                    <navigator class="post-content-navigator" :url="'/pages/post-detail/post-detail?id=' + item.postId" hover-class="navigator-hover">
                        <view class="post-item">
                            <view class="post-title">{{ item.postTitle }}</view>
                            <!-- 诗歌作者信息 -->
                            <view v-if="item.postIsPoem && item.postAuthor" class="poem-author">{{ item.postAuthor }}</view>

                            <!-- 图片显示逻辑 (已优化，使用 imageStyle 占位) -->
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
                                        :id="'single-image-' + item.postId"
                                        class="post-image"
                                        :src="item.imageUrls[0]"
                                        mode="aspectFill"
                                        :lazy-load="true"
                                        @error="onImageError"
                                        @load="onImageLoad"
                                        :data-postid="item.postId"
                                        :data-postindex="index"
                                        data-imgindex="0"
                                        data-type="single"
                                    />
                                </block>

                                <!-- 多张图片 -->
                                <block v-else-if="item.imageUrls.length > 1">
                                    <swiper
                                        :id="'swiper-' + item.postId"
                                        class="image-swiper"
                                        :indicator-dots="true"
                                        :circular="true"
                                    >
                                        <block v-for="(img, imgindex) in item.imageUrls" :key="imgindex">
                                            <swiper-item>
                                                <image
                                                    class="post-image"
                                                    :src="img"
                                                    mode="aspectFill"
                                                    :lazy-load="true"
                                                    @error="onImageError"
                                                    @load="onImageLoad"
                                                    @tap.stop.prevent="handlePreview"
                                                    :data-src="img"
                                                    :data-original-image-urls="item.originalImageUrls || item.imageUrls"
                                                    :data-postid="item.postId"
                                                    :data-postindex="index"
                                                    :data-imgindex="imgindex"
                                                    data-type="multi"
                                                />
                                            </swiper-item>
                                        </block>
                                    </swiper>
                                </block>
                            </view>

                            <view class="post-content" v-if="item.postContent" style="white-space: pre-wrap">{{ item.postContent }}</view>

                            <!-- 标签显示 -->
                            <view v-if="item.postTags && item.postTags.length > 0" class="post-tags">
                                <text class="post-tag" @tap.stop.prevent="onTagClick" :data-tag="item" v-for="(item, index1) in item.postTags" :key="index1">#{{ item }}</text>
                            </view>
                        </view>
                    </navigator>

                    <!-- 收藏时间 -->

                    <view class="delete-section">
                        <view class="time-left">
                            <text class="favorite-time">收藏于 {{ item.formattedFavoriteTime || item.formattedCreateTime || '未知时间' }}</text>
                        </view>
                    </view>
                </view>
            </block>
        </view>

        <!-- 空状态 -->
        <view v-else class="empty-container">
            <view class="empty-text">收藏夹是空的</view>
            <view class="empty-subtext">去发现一些好诗收藏起来吧</view>
            <button @tap="manualLoad" class="empty-refresh-btn">刷新</button>
        </view>


        <!-- 加载更多 / 没有更多 -->
        <view v-if="favorites.length > 0 && isLoadingMore" class="loading-more">
            <text>加载中...</text>
        </view>
        <view v-else-if="favorites.length > 0 && hasMore && !isLoading" class="no-more">
            <text class="load-more-action" @tap="onManualLoadMore">加载更多</text>
        </view>
        <view v-else-if="favorites.length > 0 && !hasMore && !isLoading" class="no-more">
            <text>没有更多了</text>
        </view>
    </view>
    <FavoriteActionMenu :target="favoriteActionTarget" @close="favoriteActionTarget = null"
        @removed="handleFavoriteRemoved" />
    <app-overlay-host />
</template>

<script>
// pages/favorite-content/favorite-content.js
import { formatRelativeTime } from '../../utils/time.js';
import { previewImage } from '../../utils/imagePreview.js';
import { getMyFavorites } from '../../api-cache/favorites.js';
import FavoriteActionMenu from '@/components/FavoriteActionMenu.vue';
import postGalleryMixin from '../../mixins/postGallery.js';
import favoriteRefresh from '@/mixins/favoriteRefresh.js';
import { captureFavoriteRead, staleFavoriteError } from '@/cache/favorites.js';
import paginationMixin from '../../mixins/pagination.js';
import { normalizePostList } from '../../utils/postNormalizer.js';

export default {
    components: { FavoriteActionMenu },
    mixins: [paginationMixin, postGalleryMixin, favoriteRefresh],
    data() {
        return {
            folderId: '',
            folderName: '',
            favorites: [],
            favoriteActionTarget: null,
            pageSize: 10,
            swiperHeights: {},

            // 每个帖子的swiper高度，跟随第一张图片
            // 单图瘦高图钳制高度
            imageClampHeights: {},
            viewportFillTimer: null,
            viewportAutoFillCount: 0,

            imgindex: 0,
            img: ''
        };
    },
    computed: {
        useTwoColumnFavorites() {
            return !!(this.appLayout && this.appLayout.feedColumns >= 2 && Array.isArray(this.favorites) && this.favorites.length > 1);
        },
        isSingleWideFavorite() {
            return !!(this.appLayout && this.appLayout.feedColumns >= 2 && Array.isArray(this.favorites) && this.favorites.length === 1);
        },
        viewportFillWatchKey() {
            const layout = this.appLayout || {};
            return `${layout.feedColumns || 1}:${layout.windowWidth || 0}:${layout.windowHeight || 0}`;
        },
        leftColumnFavorites() {
            const list = Array.isArray(this.favorites) ? this.favorites : [];
            const out = [];
            for (let i = 0; i < list.length; i += 2) {
                out.push({ item: list[i], index: i });
            }
            return out;
        },
        rightColumnFavorites() {
            const list = Array.isArray(this.favorites) ? this.favorites : [];
            const out = [];
            for (let i = 1; i < list.length; i += 2) {
                out.push({ item: list[i], index: i });
            }
            return out;
        }
    },
    watch: {
        favorites(newVal, oldVal) {
            const newLen = Array.isArray(newVal) ? newVal.length : 0;
            const oldLen = Array.isArray(oldVal) ? oldVal.length : 0;
            if (newLen === 0) {
                this.viewportAutoFillCount = 0;
                return;
            }
            if (newLen > oldLen && !this.isLoading && !this.isLoadingMore && this.hasMore) {
                this.scheduleViewportFillCheck({ resetCounter: oldLen === 0 });
            }
        },
        viewportFillWatchKey() {
            if (!this.isLoading && !this.isLoadingMore && this.hasMore && Array.isArray(this.favorites) && this.favorites.length > 0) {
                this.scheduleViewportFillCheck({ resetCounter: true });
            }
        }
    },
    beforeUnmount() {
        if (this.viewportFillTimer && typeof clearTimeout === 'function') {
            clearTimeout(this.viewportFillTimer);
            this.viewportFillTimer = null;
        }
    },
    onLoad: function (options) {
        const folderId = options.folderId;
        const folderName = options.folderName || '';
        if (!folderId) {
            uni.showToast({
                title: '参数错误：收藏夹ID为空',
                icon: 'none'
            });
            return;
        }

        // 解码文件夹名称
        let decodedFolderName = folderName;
        try {
            decodedFolderName = decodeURIComponent(folderName || '');
        } catch (e) {
            console.log('CatchClause', e);
            console.log('CatchClause', e);
            decodedFolderName = folderName;
        }

        // 重置所有状态，确保可以加载
        this.setData({
            folderId: folderId,
            folderName: decodedFolderName,
            favorites: []
        });

        // 设置标题并加载数据
        uni.setNavigationBarTitle({
            title: decodedFolderName || '收藏夹'
        });
        this.initPagination(this.loadFavorites, { pageSize: this.pageSize });
    },
    onShow: function () {
        // 不执行任何操作，避免干扰加载
    },
    methods: {
        onManualLoadMore() {
            if (typeof this.loadNext === 'function') {
                this.loadNext().catch(() => {});
            }
        },
        scheduleViewportFillCheck({ resetCounter = false } = {}) {
            if (resetCounter) {
                this.viewportAutoFillCount = 0;
            }
            if (this.viewportFillTimer && typeof clearTimeout === 'function') {
                clearTimeout(this.viewportFillTimer);
                this.viewportFillTimer = null;
            }
            if (!this.hasMore || this.isLoading || this.isLoadingMore) return;
            if (!Array.isArray(this.favorites) || this.favorites.length === 0) return;
            if ((this.viewportAutoFillCount || 0) >= 3) return;
            if (typeof this.$nextTick !== 'function' || typeof setTimeout !== 'function') return;

            this.$nextTick(() => {
                this.viewportFillTimer = setTimeout(() => {
                    this.viewportFillTimer = null;
                    this.checkViewportFill();
                }, 120);
            });
        },
        checkViewportFill() {
            if (!this.hasMore || this.isLoading || this.isLoadingMore) return;
            if (!Array.isArray(this.favorites) || this.favorites.length === 0) return;
            if ((this.viewportAutoFillCount || 0) >= 3) return;
            if (typeof this.loadNext !== 'function' || typeof uni === 'undefined' || typeof uni.createSelectorQuery !== 'function') return;

            try {
                const winH = (typeof window !== 'undefined' && Number(window.innerHeight) > 0)
                    ? window.innerHeight
                    : ((this.appLayout && Number(this.appLayout.windowHeight)) || 0);
                if (!winH) return;

                uni.createSelectorQuery()
                    .in(this)
                    .select('#favorite-list-container')
                    .boundingClientRect((rect) => {
                        if (!rect || !rect.height) return;
                        if (!this.hasMore || this.isLoading || this.isLoadingMore) return;
                        const rectBottom = Number.isFinite(rect.bottom) ? rect.bottom : ((rect.top || 0) + rect.height);
                        if (rectBottom <= winH + 120) {
                            this.viewportAutoFillCount = (this.viewportAutoFillCount || 0) + 1;
                            this.loadNext().catch(() => {});
                        }
                    })
                    .exec();
            } catch (_) {}
        },
        acceptFavoriteChange(event) {
            return event.kind !== 'folder-created' && event.kind !== 'folder-updated' && event.kind !== 'folder-reordered';
        },
        applyFavoriteChange(event) {
            if (event.kind === 'folder-deleted' && event.folderId === this.folderId) this.favorites = [];
            if (event.favoriteId && event.kind === 'removed') {
                this.favorites = this.favorites.filter(item => item.favoriteId !== event.favoriteId);
            }
        },
        refreshFavoritesAfterChange() { return this.refresh(); },
        async loadFavorites({ page, isRefresh }) {
            const current = captureFavoriteRead();
            if (isRefresh) {
                this.setData({
                    favorites: [],
                    swiperHeights: {},
                    imageClampHeights: {}
                });
            }

            try {
                const favorites = await getMyFavorites({
                    folderId: this.folderId,
                    page: page,
                    pageSize: this.pageSize,
                    contentType: 'all',
                    context: this
                });

                if (!current()) throw staleFavoriteError();
                console.log('获取收藏列表结果:', favorites);

                const newFavorites = favorites.map((favorite, index) => {
                    const item = { ...favorite };
                    if (!item.formattedCreateTime && item.createTime) {
                        item.formattedCreateTime = this.formatTime(item.createTime);
                    }
                    if (item.postCreateTime && !item.formattedPostCreateTime) {
                        item.formattedPostCreateTime = this.formatTime(item.postCreateTime);
                    }
                    if (item.favoriteTime && !item.formattedFavoriteTime) {
                        item.formattedFavoriteTime = this.formatTime(item.favoriteTime);
                    }
                    if (!item.postTitle && item.title) {
                        item.postTitle = item.title;
                    }
                    if (!item.postContent && item.content) {
                        item.postContent = item.content;
                    }
                    if (!item.postImageUrls && item.imageUrls) {
                        item.postImageUrls = item.imageUrls;
                    }
                    if (!item.postOriginalImageUrls && item.originalImageUrls) {
                        item.postOriginalImageUrls = item.originalImageUrls;
                    }
                    if (!item.postAuthorAvatar && item.authorAvatar) {
                        item.postAuthorAvatar = item.authorAvatar;
                    }
                    if (!item.postAuthorName && item.authorName) {
                        item.postAuthorName = item.authorName;
                    }
                    if (!item.imageStyle && item.imageUrls && item.imageUrls.length > 0) {
                        item.imageStyle = 'height: 0; padding-bottom: 75%;';
                    }

                    console.log(`【收藏夹】帖子${index}图片数据:`, {
                        postId: item._id,
                        postTitle: item.title || item.postTitle,
                        imageUrls: item.imageUrls,
                        originalImageUrls: item.originalImageUrls,
                        hasImageUrls: !!(item.imageUrls && item.imageUrls.length > 0)
                    });

                    return item;
                });

                // 处理分页数据，避免重复
                const allFavorites = page === 0 || isRefresh ? newFavorites : (() => {
                    const existingIds = new Set(this.favorites.map(p => p._id));
                    const uniqueNewList = newFavorites.filter(p => p && p._id && !existingIds.has(p._id));
                    return this.favorites.concat(uniqueNewList);
                })();

                this.setData({
                    favorites: allFavorites
                });

                return {
                    list: newFavorites,
                    hasMore: newFavorites.length === this.pageSize
                };
            } catch (error) {
                if (error.code === 'FAVORITE_STALE') throw error;
                console.error('加载收藏数据失败:', error);
                uni.showToast({
                    title: error.message || '加载收藏数据失败',
                    icon: 'none'
                });
                throw error;
            }
        },

        // 重新加载
        manualLoad: function () {
            if (!this.folderId) {
                uni.showToast({
                    title: '收藏夹ID为空',
                    icon: 'none'
                });
                return;
            }
            this.refresh();
        },

        // 点击收藏项跳转到详情页
        onFavoriteTap: function (e) {
            const postId = e.currentTarget.dataset.postId;
            uni.navigateTo({
                url: `/pages/post-detail/post-detail?id=${postId}`
            });
        },

        showFavoriteActions(item) {
            this.favoriteActionTarget = { favoriteId: item.favoriteId, postId: item.postId || item._id, folderId: item.folderId || this.folderId };
        },
        handleFavoriteRemoved({ favoriteId }) {
            this.favorites = this.favorites.filter(item => item.favoriteId !== favoriteId);
        },

        // 图片预览
        onImagePreview: function (event) {
            return previewImage(event, { fallbackToast: false });
        },

        // 预览图片（与点赞页面统一）
        handlePreview: function (event) {
            const result = previewImage(event, { fallbackToast: false });
            if (!result) {
                uni.showToast({
                    title: '图片加载失败',
                    icon: 'none'
                });
            }
            return result;
        },

        // 图片加载错误处理（与点赞页面统一）
        onImageError: function (e) {
            console.error('【收藏夹】图片加载失败', e);
            const { src } = e.detail;
            console.error('【收藏夹】失败的图片URL:', src);
            // 获取当前图片的上下文信息
            const { postindex, imgindex } = e.currentTarget.dataset;
            if (postindex !== undefined && imgindex !== undefined) {
                const favorite = this.favorites[postindex];
                console.error('【收藏夹】图片加载失败的上下文:', {
                    postId: favorite ? favorite._id : 'unknown',
                    postTitle: favorite ? favorite.title : 'unknown',
                    imageIndex: imgindex,
                    imageUrl: src,
                    allImageUrls: favorite ? favorite.imageUrls : 'unknown'
                });
            }
            // 不显示toast，避免频繁弹窗，但记录错误
            console.error('【收藏夹】图片加载失败详情:', {
                error: e.detail,
                src: src,
                dataset: e.currentTarget.dataset
            });
        },

        // 格式化时间
        formatTime: function (dateString) {
            return formatRelativeTime(dateString);
        },

        // 头像加载错误处理
        onAvatarError: function (e) {
            console.error('头像加载失败:', e);
            // 设置默认头像
            const { postindex } = e.currentTarget.dataset;
            if (postindex !== undefined) {
                const favorites = this.favorites;
                if (favorites[postindex]) {
                    favorites[postindex].postAuthorAvatar = '/images/avatar.png'; // 使用默认头像
                    this.setData({
                        favorites: favorites
                    });
                }
            }
        },

        // 头像加载成功处理
        onAvatarLoad: function (e) {
            // 头像加载成功，可以在这里做一些处理
        },

        // 跳转到用户资料页
        navigateToUserProfile: function (e) {
            const userId = e.currentTarget.dataset.userId;
            if (userId) {
                uni.navigateTo({
                    url: `/pages-user/user-profile/user-profile?userId=${userId}`
                });
            }
        },

        // 标签点击处理
        onTagClick: function (e) {
            const tag = e.currentTarget.dataset.tag;
            if (tag) {
                // 可以跳转到标签页面或搜索页面
                uni.navigateTo({
                    url: `/pages-tools/search/search?keyword=${encodeURIComponent(tag)}`
                });
            }
        }
    }
};
</script>
<style>
/* pages/favorite-content/favorite-content.wxss */
.container {
    padding: 20rpx;
    background-color: var(--app-page-bg, #f7f8fa);
    color: var(--app-primary-text, #111111);
    min-height: 100vh;
}

.loading-container {
    display: flex;
    justify-content: center;
    align-items: center;
    height: 400rpx;
    background-color: var(--app-elevated-bg, #fff);
    border-radius: 16rpx;
    margin: 30rpx;
    box-shadow: 0 4rpx 12rpx rgba(0, 0, 0, 0.05);
}

.loading-text {
    color: var(--app-muted-text, #999);
    font-size: 28rpx;
}

.favorites-container {
    margin: 0 30rpx 30rpx 30rpx;
}

.favorites-container--masonry {
    max-width: 1120px;
    margin: 0 auto;
    padding: 16px 20px 24px;
    box-sizing: border-box;
}

.favorites-container--single-wide {
    max-width: 680px;
    margin: 0 auto;
    padding: 16px 20px 24px;
    box-sizing: border-box;
}

.favorite-masonry .post-item-wrapper {
    border-radius: 14px;
    margin: 0 0 16px 0;
}

/* 新增：帖子项包装器样式 */
.post-item-wrapper {
    position: relative;
    background: var(--app-elevated-bg, #fff);
    border: 1rpx solid var(--app-border-color, transparent);
    border-radius: 16rpx;
    margin-bottom: 20rpx;
    padding: 30rpx;
    box-shadow: 0 2rpx 12rpx rgba(0, 0, 0, 0.06);
}

/* 原创帖子特殊样式 */
.post-item-wrapper.original-post {
    border: none;
    box-shadow: 0 2rpx 12rpx rgba(0, 0, 0, 0.06);
    position: relative;
}

/* 原创帖子光影效果 */
.post-item-wrapper.original-post::before {
    content: none;
    position: absolute;
    top: -2rpx;
    left: -2rpx;
    right: -2rpx;
    bottom: -2rpx;
    background: none;
    border-radius: 18rpx;
    z-index: -1;
    opacity: 0;
    filter: none;
}

/* 新增：内容导航器样式 */
.post-content-navigator {
    display: block;
    background: transparent;
}

/* 新增：导航器点击效果 */
.navigator-hover {
    opacity: 0.8;
}

/* 作者信息样式 */
.author-info-outside {
    display: flex;
    align-items: center;
    margin-bottom: 20rpx;
}

.author-avatar {
    width: 60rpx;
    height: 60rpx;
    border-radius: 50%;
    margin-right: 15rpx;
    background-color: var(--app-subtle-surface-bg, #f5f5f5);
}

.author-name {
    font-size: 28rpx;
    color: var(--app-primary-text, #333);
    font-weight: 500;
}

.post-title {
    font-size: 32rpx;
    font-weight: bold;
    color: var(--app-primary-text, #333333);
    margin-bottom: 10rpx;
    line-height: 1.4;
    word-break: break-word;
    overflow: hidden;
    text-overflow: ellipsis;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
}

/* 诗歌作者信息 */
.poem-author {
    font-size: 26rpx;
    color: var(--app-secondary-text, #666);
    font-style: italic;
    margin-bottom: 10rpx;
}

.post-content {
    font-size: 26rpx;
    color: var(--app-secondary-text, #666666);
    line-height: 1.5;
    margin-bottom: 15rpx;
    word-break: break-word;
    overflow: hidden;
    text-overflow: ellipsis;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    white-space: pre-wrap;
}

/* 图片容器样式 - 与首页保持一致 */
.image-container-wrapper {
    position: relative;
    width: 100%;
    background-color: var(--app-subtle-surface-bg, #f0f0f0); /* 占位时的背景色，很重要 */
    overflow: hidden;
    border-radius: 8px; /* 可以加个圆角，让占位块更好看 */
    margin: 20rpx 0; /* 图片和下方内容的间距 */
}

/* 让图片或Swiper填充整个占位容器 */
.image-container-wrapper .post-image,
.image-container-wrapper .image-swiper {
    position: absolute;
    top: 0;
    right: 0;
    bottom: 0;
    left: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
}

.post-image {
    transition: transform 0.3s ease;
}

.post-image:active {
    transform: scale(1.05);
}

.image-swiper {
    width: 100%;
    height: 100%;
    border-radius: 12rpx;
    overflow: hidden;
}

/* 标签样式 - 与首页和详情页保持一致 */
.post-tags {
    margin-top: 30rpx;
    margin-bottom: 10rpx;
    line-height: 1.5;
}

.post-tag {
    color: var(--app-accent-color, #24375f);
    font-size: 26rpx;
    margin-right: 10rpx;
    transition: all 0.2s ease;
    cursor: pointer;
}

.post-tag:active {
    opacity: 0.8;
}

/* 删除/操作按钮区域 */
.delete-section {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-top: 20rpx;
    padding-top: 20rpx;
    border-top: 1rpx solid var(--app-border-color, #f0f0f0);
}

.time-left {
    flex: 1;
}

.favorite-time {
    font-size: 24rpx;
    color: var(--app-muted-text, #999);
}

.more-menu-btn-top-right { position: absolute; top: 20rpx; right: 20rpx; display: flex; align-items: center; justify-content: center; padding: 8rpx; z-index: 10; }
.more-menu-btn-top-right:active { transform: scale(0.9); opacity: 0.7; }
.more-menu-dots-small { display: flex; align-items: center; justify-content: center; gap: 4rpx; }
.more-menu-dots-small .dot-small { width: 8rpx; height: 8rpx; border-radius: 50%; background-color: var(--app-post-menu-dot-color, #666); }

/* 加载更多样式 */
.loading-more {
    display: flex;
    justify-content: center;
    align-items: center;
    padding: 30rpx;
    color: var(--app-muted-text, #999);
    font-size: 28rpx;
}

.no-more {
    display: flex;
    justify-content: center;
    align-items: center;
    padding: 30rpx;
    color: var(--app-muted-text, #999);
    font-size: 28rpx;
}

.load-more-action {
    display: inline-block;
    padding: 12rpx 32rpx;
    border-radius: 999rpx;
    font-size: 26rpx;
    color: var(--app-secondary-text, #666);
    background: var(--app-subtle-surface-bg, #ebedf0);
    cursor: pointer;
}

@media screen and (min-width: 600px) {
    .favorite-content-page {
        padding-bottom: calc(28px + var(--app-safe-area-bottom, 0px));
        box-sizing: border-box;
    }
}

@media screen and (max-height: 500px) {
    .empty-container {
        padding: 48rpx 30rpx;
    }
}

/* 空状态样式 */
.empty-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 100rpx 30rpx;
    text-align: center;
}

.empty-text {
    font-size: 32rpx;
    color: var(--app-secondary-text, #666);
    margin-bottom: 10rpx;
}

.empty-subtext {
    font-size: 26rpx;
    color: var(--app-muted-text, #999);
}

.empty-refresh-btn {
    margin-top: 20rpx;
    padding: 15rpx 30rpx;
    background: var(--app-control-accent-bg, #333333);
    color: var(--app-control-accent-text, #ffffff);
    border-radius: 44rpx;
    font-size: 26rpx;
    font-weight: 500;
    box-shadow: none;
    min-height: 88rpx;
    box-sizing: border-box;
}
.empty-refresh-btn:active { opacity: 0.65; }
</style>
