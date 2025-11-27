<template>
  <view class="mountain white-bg" @touchstart="touchStart" @touchend="touchEnd">
    <!-- 顶部栏 -->
    <top-bar />

    <!-- 加载中骨架 -->
    <view v-if="isLoading">
      <skeleton pageType="mountain" />
    </view>

    <!-- 内容列表 -->
    <view v-else class="square-mode-container">
      <view v-if="postList.length === 0" class="empty-state">
        <view class="empty-icon">⛰️</view>
        <view class="empty-text">还没刷出来，等一下~</view>
        <view class="empty-subtext">去广场看看先吧</view>
      </view>

      <view id="post-list-container">
        <view v-for="(item, index) in postList" :key="item._id ? `post-${item._id}-${index}` : `post-index-${index}`" class="post-item-wrapper" :style="{ backgroundColor: item.backgroundColor }">
          <view class="post-content-navigator" @tap="togglePostExpansion" @longpress="onLongPressCard" :data-index="index" :data-postid="item._id">
            <view class="post-item">
              <view :class="'post-content ' + (item.isExpanded ? 'expanded' : 'collapsed') + (!item.isExpanded && (!item.highlightLines || item.highlightLines.length === 0) ? ' no-highlight' : '')" v-if="item.content" :style="{ color: item.textColor, whiteSpace: 'pre-wrap' }">
                <block v-if="item.isExpanded">
                  {{ item.content }}
                </block>
                <block v-else>
                  <!-- 折叠状态下只显示高光行 -->
                  <block v-if="item.highlightLines && item.highlightLines.length > 0">
                    <text v-for="(highlightLine, index) in item.highlightLines" :key="'line-' + index" style="font-weight: 700; display: block;">{{ highlightLine }}</text>
                  </block>
                  <block v-else>
                    {{ item.content }}
                  </block>
                </block>
              </view>

            </view>
          </view>

          <!-- 交互区（展开时显示） -->
          <view class="vote-section" v-if="item.isExpanded" :style="{ backgroundColor: item.backgroundColor }">
            <view class="actions-left"><!-- 预留左侧空间 --></view>
            <view class="button-group">
              <view class="like-icon-container" @tap.stop.prevent="onVote" :data-postid="item._id" :data-index="index">
                <image class="like-icon" :src="item.likeIcon || '/static/images/seed.png'" mode="aspectFit" @error="onLikeIconError" />
              </view>
              <view class="comment-count" @tap.stop.prevent="onCommentClick" :data-postid="item._id">
                <image class="comment-icon" src="/static/images/newicons/comment.png" mode="aspectFit" />
              </view>
            </view>
          </view>
        </view>
      </view>

      <!-- 底部加载/结束提示 -->
      <view class="loading-footer">
        <block v-if="!hasMore && postList.length > 0"><text>—— 到底啦 ——</text></block>
      </view>
    </view>

    <!-- 顶部提示（用于调试滑动预加载阈值） -->
    <view v-if="showPageIndicator" class="page-indicator"></view>

    <!-- #ifndef MP-WEIXIN -->
    <app-tab-bar ref="customTabBar" />
    <!-- #endif -->
  </view>

</template>

<script>
// #ifndef MP-WEIXIN
import AppTabBar from '@/custom-tab-bar/index.vue';
// #endif
import skeleton from '@/components/skeleton/skeleton';
import topBar from '@/components/top-bar/top-bar.vue';
const { cloudCall } = require('@/utils/cloudCall.js');
const { getPostList: getPostListWithCache, invalidatePostList } = require('@/api-cache/post-list.js');
import { getMountainPoems } from '@/api-cache/poems.js';
const likeIcon = require('@/utils/likeIcon.js');
import {
  generateRandomBackgroundColor,
  toggleArrayItemExpansion,
  updatePostsUIProperties
} from '@/utils/uiHelpers.js';
import { navigateToPostDetail } from '@/utils/navigation.js';
const { togglePostLike } = require('../../utils/likeService.js');

const PAGE_SIZE = 10;

export default {
  onShow() {
    // #ifndef MP-WEIXIN
    try { uni.hideTabBar({ animation: false }); } catch (e) {}
    try { this.$refs.customTabBar && this.$refs.customTabBar.syncSelected && this.$refs.customTabBar.syncSelected(); } catch (e) {}
    // #endif

    // 检查是否需要刷新数据
    const shouldRefreshIndex = uni.getStorageSync('shouldRefreshIndex');
    const shouldRefreshProfile = uni.getStorageSync('shouldRefreshProfile');
    const shouldRefreshPoem = uni.getStorageSync('shouldRefreshPoem');
    const shouldRefreshMountain = uni.getStorageSync('shouldRefreshMountain');

    if (shouldRefreshIndex || shouldRefreshProfile || shouldRefreshPoem || shouldRefreshMountain) {
      console.log('【mountain】检测到需要刷新标记，开始刷新山页面数据:', {
        shouldRefreshIndex,
        shouldRefreshProfile,
        shouldRefreshPoem,
        shouldRefreshMountain
      });

      // 清除所有刷新标记
      uni.removeStorageSync('shouldRefreshIndex');
      uni.removeStorageSync('shouldRefreshProfile');
      uni.removeStorageSync('shouldRefreshPoem');
      uni.removeStorageSync('shouldRefreshMountain');

      // 刷新山页面数据
      this.getIndexData();
    }
    // 回到页面时，用缓存对齐当前可见帖子的点赞状态
    try { this.syncLikeStatusFromCache && this.syncLikeStatusFromCache(); } catch (_) {}
  },
  onLoad() {
    try { uni.$on && uni.$on('like-changed', this.onGlobalLikeChanged); } catch (_) {}
    // 初始化
    this.debugSafeArea();
    this.getIndexData();
  },
  onUnload() {
    try { uni.$off && this.onGlobalLikeChanged && uni.$off('like-changed', this.onGlobalLikeChanged); } catch (_) {}
  },
  components: {
    skeleton,
    topBar,
    // #ifndef MP-WEIXIN
    AppTabBar
    // #endif
  },
  data() {
    return {
      postList: [],
      page: 0,
      hasMore: true,
      isLoading: true,
      isLoadingMore: false,
      lastUsedColorIndex: -1,
      backgroundColors: ['#a4c4bd', '#c9cfcf', '#906161', '#909388'],
      showPageIndicator: false,
      votingInProgress: {},
      // 安全区域高度
      safeAreaTop: 0,
      // 加载锁定标志，防止重复触发加载
      _loadingLock: false
    };
  },
  onPullDownRefresh() {
    console.log('【mountain】📱 下拉刷新，重新获取数据');
    // 清除缓存并强制刷新
    invalidatePostList({ isPoem: true, isOriginal: false, excludeAnonymous: true });
    this.getIndexData(() => {
      console.log('【mountain】✅ 下拉刷新完成，停止刷新动画');
      uni.stopPullDownRefresh();
    });
  },
  onPageScroll(e) {
    // 增加防抖时间到300ms，减少频繁触发
    if (this._scrollTimer) clearTimeout(this._scrollTimer);
    this._scrollTimer = setTimeout(() => {
      // 双重检查：防止在定时器期间状态已变化
      if (!this.hasMore || this.isLoadingMore || this.isLoading) return;
      
      // 增加加载锁定标志，防止重复触发
      if (this._loadingLock) {
        console.log('【mountain】加载锁定中，跳过本次滚动检查');
        return;
      }
      
      try {
        const info = uni.getSystemInfoSync();
        const winH = info.windowHeight;
        uni.createSelectorQuery().in(this).select('#post-list-container').boundingClientRect((rect) => {
          if (!rect || !rect.height) return;
          const distanceToBottom = rect.height - e.scrollTop - winH;
          const preloadThreshold = winH * 1.5;
          if (distanceToBottom < preloadThreshold) {
            // 再次检查状态，防止在查询期间状态变化
            if (this._loadingLock || !this.hasMore || this.isLoadingMore || this.isLoading) {
              console.log('【mountain】onPageScroll 检查：已锁定或正在加载，跳过', {
                _loadingLock: this._loadingLock,
                hasMore: this.hasMore,
                isLoadingMore: this.isLoadingMore,
                isLoading: this.isLoading
              });
              return;
            }
            this.showPageIndicator = true;
            this.getPostList(() => {
              this.showPageIndicator = false;
            });
          }
        }).exec();
      } catch (_) {}
    }, 300); // 增加防抖时间到300ms
  },
  methods: {
    // 调试安全区域
    debugSafeArea() {
      try {
        // 获取系统信息
        const systemInfo = uni.getSystemInfoSync();
        console.log('【mountain】系统信息:', {
          statusBarHeight: systemInfo.statusBarHeight,
          safeAreaInsets: systemInfo.safeAreaInsets,
          safeArea: systemInfo.safeArea,
          windowHeight: systemInfo.windowHeight,
          screenHeight: systemInfo.screenHeight,
          platform: systemInfo.platform
        });

        // 动态设置安全区域 - 使用uni-app兼容方式
        if (systemInfo.statusBarHeight) {
          const safeAreaTop = systemInfo.statusBarHeight;
          console.log('【mountain】使用状态栏高度作为安全区域:', safeAreaTop);
          
          // 在uni-app中，我们可以通过设置页面数据来动态调整样式
          this.setData({
            safeAreaTop: safeAreaTop
          });
          
          // 尝试设置CSS变量（仅在支持的环境中）
          try {
            if (typeof document !== 'undefined' && document.documentElement) {
              document.documentElement.style.setProperty('--safe-area-inset-top', safeAreaTop + 'px');
              console.log('【mountain】CSS变量设置成功');
            }
          } catch (cssError) {
            console.log('【mountain】CSS变量设置失败，使用数据绑定方式:', cssError);
          }
        }
      } catch (error) {
        console.error('【mountain】安全区域调试失败:', error);
      }
    },

        getIndexData(callback) {
      console.log('【mountain】开始获取数据，callback:', typeof callback);
      this.setData({ 
        postList: [], 
        page: 0, 
        hasMore: true,
        isLoading: true,
        isLoadingMore: false,
        _loadingLock: false  // 重置加载锁定
      });
      this.getPostList(() => { 
        console.log('【mountain】getPostList 完成，设置 isLoading: false');
        this.setData({ isLoading: false });
        if (typeof callback === 'function') {
          console.log('【mountain】执行回调函数');
          callback();
        }
      });
    },
    generateRandomBackgroundColor() {
      const result = generateRandomBackgroundColor(this.backgroundColors, this.lastUsedColorIndex);
      this.lastUsedColorIndex = result.index;
      return result.color;
    },
    async getPostList(cb) {
      console.log('【mountain】getPostList 开始，isLoadingMore:', this.isLoadingMore, 'isLoading:', this.isLoading, 'page:', this.page, '_loadingLock:', this._loadingLock, 'callback:', typeof cb);
      // 双重检查：防止重复调用（首次加载时isLoading为true是正常的）
      const isFirstLoad = this.page === 0;
      if (!isFirstLoad && (this.isLoadingMore || this._loadingLock)) {
        console.log('【mountain】正在加载中或已锁定，跳过请求', {
          isLoadingMore: this.isLoadingMore,
          _loadingLock: this._loadingLock,
          page: this.page
        });
        if (typeof cb === 'function') cb();
        return;
      }
      // 设置加载锁定（首次加载时isLoading已经设置为true）
      if (!isFirstLoad) {
        this._loadingLock = true;
        this.setData({ isLoadingMore: true });
        console.log('【mountain】设置加载锁定，isLoadingMore: true');
      }
      try {
        // 使用山诗专用API
        const list = await getMountainPoems({
          page: this.page,
          pageSize: PAGE_SIZE,
          context: this
        });
        console.log('【mountain】获取到帖子数量:', list.length);
        console.log('【mountain】帖子匿名性判断:', list.map(p => ({
            postId: p._id,
            isAnonymous: p.isAnonymous,
            anonymousType: typeof p.isAnonymous
        })));
        
        const visibleList = list.filter(p => !p.isAnonymous);
        
        visibleList.forEach((p) => {
          // 优先使用数据库中保存的背景颜色，如果没有则随机生成
          p.backgroundColor = p.backgroundColor || this.generateRandomBackgroundColor();
          p.textColor = p.textColor || '#222';
          p.isExpanded = false;
          p.likeIcon = likeIcon && likeIcon.getLikeIcon ? likeIcon.getLikeIcon(p.votes || 0, !!p.isVoted) : '';
        });
        
        // 【修复】首次加载时直接替换，加载更多时合并并去重，避免重复key
        let newPostList;
        if (this.page === 0) {
          newPostList = visibleList;
        } else {
          // 加载更多时，过滤掉已存在的帖子，避免重复
          const existingIds = new Set(this.postList.map(post => post._id).filter(Boolean));
          const uniqueNewPosts = visibleList.filter(post => post && post._id && !existingIds.has(post._id));
          newPostList = this.postList.concat(uniqueNewPosts);
          console.log('【mountain】去重：新帖子', visibleList.length, '去重后', uniqueNewPosts.length);
        }
        this.setData({
          postList: newPostList,
          page: this.page + 1,
          hasMore: list.length === PAGE_SIZE
        });
        
        console.log('【mountain】数据处理完成');
      } catch (e) {
        console.error('【mountain】获取帖子列表失败:', e);
        uni.showToast({ title: '加载失败', icon: 'none' });
      } finally {
        const currentPage = this.page; // 保存当前页码，因为下面会改变
        console.log('【mountain】设置加载状态，执行回调', {
          page: currentPage,
          isFirstLoad: currentPage === 0
        });
        // 只有非首次加载时才设置isLoadingMore
        if (currentPage !== 0) {
          this.setData({ isLoadingMore: false });
          console.log('【mountain】设置 isLoadingMore: false');
        }
        this._loadingLock = false; // 释放加载锁定
        console.log('【mountain】释放加载锁定，_loadingLock: false');
        if (typeof cb === 'function') {
          console.log('【mountain】执行回调函数');
          cb();
        }
      }
    },
    togglePostExpansion(e) {
      const index = e.currentTarget.dataset.index;
      const newPostList = toggleArrayItemExpansion(this.postList, index);
      this.setData({ postList: newPostList });
    },
    onCommentClick(e) {
      const postId = e.currentTarget.dataset.postid;
      navigateToPostDetail(postId);
    },
    onLikeIconError() {},

    async onVote(e) {
      const postId = e.currentTarget.dataset.postid;
      const index = e.currentTarget.dataset.index;
      if (this.votingInProgress[postId]) return;
      this.setData({ [`votingInProgress.${postId}`]: true });
      const list = this.postList;
      const originalVotes = Number(list[index].votes) || 0;
      const wasVoted = !!list[index].isVoted;

      // 乐观更新
      const optimisticVotes = wasVoted ? Math.max(0, originalVotes - 1) : originalVotes + 1;
      list[index].votes = optimisticVotes;
      list[index].isVoted = !wasVoted;
      list[index].likeIcon = likeIcon.getLikeIcon(list[index].votes, list[index].isVoted);
      this.setData({ postList: list });

      try {
        const result = await togglePostLike(postId, {
          pageTag: 'mountain',
          context: this,
          currentVotes: originalVotes,
          currentIsLiked: wasVoted,
          requireAuth: true
        });
        if (result && result.success) {
          const updates = {};
          updates[`postList[${index}].votes`] = result.votes;
          updates[`postList[${index}].isVoted`] = result.isLiked;
          updates[`postList[${index}].likeIcon`] = result.likeIcon;
          this.setData(updates);
        } else {
          // 回滚
          const updates = {};
          updates[`postList[${index}].votes`] = originalVotes;
          updates[`postList[${index}].isVoted`] = wasVoted;
          updates[`postList[${index}].likeIcon`] = likeIcon.getLikeIcon(originalVotes, wasVoted);
          this.setData(updates);
        }
      } catch (err) {
        const updates = {};
        updates[`postList[${index}].votes`] = originalVotes;
        updates[`postList[${index}].isVoted`] = wasVoted;
        updates[`postList[${index}].likeIcon`] = likeIcon.getLikeIcon(originalVotes, wasVoted);
        this.setData(updates);
        uni.showToast({ title: '操作失败', icon: 'none' });
      } finally {
        this.setData({ [`votingInProgress.${postId}`]: false });
      }
    },

    // 跨页同步：监听全局点赞变更
    onGlobalLikeChanged(e = {}) {
      try {
        const postId = e.postId;
        if (!postId) return;
        const list = this.postList || [];
        const idx = list.findIndex(p => p && (p._id === postId || p.id === postId));
        if (idx > -1) {
          const votes = typeof e.votes === 'number' ? e.votes : (list[idx].votes || 0);
          const isLiked = typeof e.isLiked === 'boolean' ? e.isLiked : !!list[idx].isVoted;
          const updates = {};
          updates[`postList[${idx}].votes`] = votes;
          updates[`postList[${idx}].isVoted`] = isLiked;
          updates[`postList[${idx}].likeIcon`] = likeIcon.getLikeIcon(votes, isLiked);
          this.setData(updates);
        }
      } catch (_) {}
    },
    onLongPressCard(e) {
      const postId = e.currentTarget.dataset.postid;
      if (postId) {
        uni.navigateTo({ url: `/pages/post-detail/post-detail?id=${postId}` });
      }
    },
    touchStart() {},
    touchEnd() {}
  }
};
</script>

<style>
/* 定义 Huiwen-mincho 字体 */
@font-face {
  font-family: 'Huiwen-mincho';
  src: url('/static/fonts/Huiwen-mincho.otf') format('opentype');
  font-weight: normal;
  font-style: normal;
}



.white-bg { 
  background: #fff; 
  min-height: 100vh; 
  padding-top: env(safe-area-inset-top, var(--safe-area-inset-top, 44px)); /* 添加状态栏安全区域，备选方案 */
}
.square-mode-container {
  padding: 100rpx;
  margin-bottom: 200rpx;
  padding-top: 250rpx; /* 增加上边距：100rpx(top-bar高度) + 150rpx(额外间距) */
  display: flex;
  flex-direction: column;
  align-items: stretch; /* 居中卡片 */
}
.empty-state { text-align: center; padding: 100rpx 0; color: #999; }
.empty-icon { font-size: 80rpx; margin-bottom: 20rpx; }
.empty-text { font-size: 32rpx; margin-bottom: 10rpx; color: #666; }
.empty-subtext { font-size: 24rpx; color: #999; }
/* poem.css inspired card styles */
.post-item-wrapper {
  width: 100%;
  border-radius: 30rpx; /* 15px * 2 */
  margin-bottom: 40rpx; /* 减少间距，让卡片更紧凑 */
  overflow: hidden;
  box-shadow: 0 8rpx 8rpx rgba(0, 0, 0, 0.25); /* 0px 4px 4px * 2 */
  transition: transform .3s ease;
  border: none;
}

/* 背景颜色现在通过内联样式动态设置，不再使用固定的CSS类 */
.post-item-wrapper:active { transform: scale(0.98); }
.post-content-navigator { display: block; }
.post-item { padding: 30rpx 60rpx 30rpx 80rpx; position: relative; } /* 进一步减少上下padding，文字往左移动 */
/* Typography inspired by poem.css */
.post-content {
  font-family: 'Huiwen-mincho', sans-serif;
  font-style: normal;
  font-weight: 500;
  font-size: 28rpx; /* 调小字体：14px * 2 */
  line-height: 38rpx; /* 调整行距：19px * 2 */
  margin: 30rpx 0;
  width: 100%;
  color: #FFFFFF;
  overflow-wrap: break-word;
}

/* 文字颜色现在通过内联样式动态设置 */
/* 折叠态：当没有高光行时显示前三行，有高光行时显示高光行 */
.post-content.collapsed {
  overflow: hidden;
  text-overflow: ellipsis;
}

/* 当没有高光行时，使用三行裁切 */
.post-content.collapsed.no-highlight {
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 3;
}
.post-content.expanded { display: block; overflow: visible; }
.comment-emoji{ font-size: 40rpx; }
.comment-icon { width: 60rpx; height: 60rpx; }
.vote-section { display: flex; justify-content: space-between; align-items: center; padding: 25rpx 50rpx; }
.actions-left { flex: 1; display: flex; align-items: center; gap: 20rpx; }
.button-group { display: flex; align-items: center; gap: 30rpx; }
.comment-count { display: flex; align-items: center; gap: 8rpx; padding: 10rpx 15rpx; }
.vote-count { display: flex; align-items: center; gap: 8rpx; padding: 10rpx 15rpx; border-radius: 20rpx; background: rgba(255,255,255,.9); box-shadow: 0 2rpx 8rpx rgba(0,0,0,.1); }
.comment-icon { width: 80rpx; height: 80rpx; }
.like-icon { width: 60rpx; height: 60rpx; margin-top: 5px; }


.loading-footer { text-align: center; color: #666; padding: 30rpx 0 120rpx; }
.page-indicator { position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); background: rgba(0,0,0,.7); color: #fff; padding: 20rpx 40rpx; border-radius: 40rpx; z-index: 1000; font-size: 28rpx; }
.page-indicator-text { text-align: center; }
</style>
    // 从 like:status 缓存对齐当前列表的点赞状态（兜底：跨页返回时也能更新）
    syncLikeStatusFromCache() {
      try {
        const list = Array.isArray(this.postList) ? this.postList : [];
        const ids = list.map(p => p && p._id).filter(Boolean);
        if (!ids.length) return;
        try { const { syncLikeStatusForPosts } = require('../../utils/likeStatusSync.js'); syncLikeStatusForPosts(ids); } catch (_) {}
        const { getLatestLikeStatus } = require('../../utils/likeStatusSync.js');
        let changed = false;
        const next = list.slice();
        for (let i = 0; i < next.length; i += 1) {
          const p = next[i]; if (!p || !p._id) continue;
          const s = getLatestLikeStatus(p._id);
          if (s && ((p.votes || 0) !== s.votes || !!p.isVoted !== !!s.isVoted)) {
            p.votes = s.votes; p.isVoted = s.isVoted; p.likeIcon = likeIcon.getLikeIcon(s.votes, s.isVoted);
            changed = true;
          }
        }
        if (changed) this.setData({ postList: next });
      } catch (err) { console.warn('[mountain] syncLikeStatusFromCache failed', err); }
    },

