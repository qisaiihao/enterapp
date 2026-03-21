<template>
  <view class="mountain white-bg" @touchstart="touchStart" @touchend="touchEnd">
    <!-- 顶部栏 -->
    <top-bar />

    <!-- 诗人筛选栏 -->
    <view class="poet-avatar-bar-wrapper" :style="{ top: (safeAreaTop * 2 + 140) + 'rpx' }">
      <poet-avatar-bar
        ref="poetAvatarBar"
        :selectedPoetName="selectedPoetName"
        @select="onPoetSelect"
      />
    </view>

    <!-- 内容列表 -->
    <view class="square-mode-container with-avatar-bar" :style="{ paddingTop: (safeAreaTop * 2 + 340) + 'rpx' }">
      <!-- 加载中骨架 - 嵌入到内容容器中，而不是覆盖整个页面 -->
      <!-- 在存在诗人筛选组件时正常显示骨架屏 -->
      <view v-if="isLoading">
        <skeleton
          pageType="mountain"
          :hasFilterBar="false"
          filterBarType=""
        />
      </view>

      <!-- 真实内容 -->
      <view v-else>
      <view v-if="postList.length === 0" class="empty-state">
        <view class="empty-icon">⛰️</view>
        <view class="empty-text">还没刷出来，等一下~</view>
        <view class="empty-subtext">去广场看看先吧</view>
      </view>

      <view id="post-list-container">
        <view v-for="(item, index) in postList" :key="index" class="post-item-wrapper" :style="{ backgroundColor: item.backgroundColor }">
          <view class="post-content-navigator" @tap="togglePostExpansion" @longpress="onLongPressCard" :data-index="index" :data-postid="item._id">
            <view class="post-item">
              <view :class="'post-content ' + (item.isExpanded ? 'expanded' : 'collapsed') + (!item.isExpanded && (!item.highlightLines || item.highlightLines.length === 0) ? ' no-highlight' : '')" v-if="item.content" :style="{ color: item.textColor, whiteSpace: 'pre-wrap' }">
                <block v-if="item.isExpanded">
                  {{ item.content }}
                </block>
                <block v-else>
                  <!-- 折叠状态下只显示高光行 -->
                  <block v-if="item.highlightLines && item.highlightLines.length > 0">
                    <text v-for="(highlightLine, index) in item.highlightLines" :key="index" style="font-weight: 700; display: block;">{{ highlightLine }}</text>
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
      </view>  <!-- 关闭 v-else -->
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
import poetAvatarBar from '@/components/poet-avatar-bar/poet-avatar-bar.vue';
import { cloudCall } from '@/utils/cloudCall.js';
import { getPostList as getPostListWithCache, invalidatePostList } from '@/api-cache/post-list.js';
import { getMountainPoems } from '@/api-cache/poems.js';
import likeIcon from '@/utils/likeIcon.js';
import {
  generateRandomBackgroundColor,
  toggleArrayItemExpansion,
  updatePostsUIProperties
} from '@/utils/uiHelpers.js';
import { navigateToPostDetail } from '@/utils/navigation.js';
import { togglePostLike } from '@/utils/likeService.js';
import { syncLikeStatusForPosts, getLatestLikeStatus } from '@/utils/likeStatusSync.js';
import { updateTabBarStatus } from '@/utils/tabBarCompatibility.js';
import { getShareAppMessageConfig, getShareTimelineConfig } from '@/utils/shareHelper.js';

const PAGE_SIZE = 10;

export default {
  onShow() {
    // #ifndef MP-WEIXIN
    try { uni.hideTabBar({ animation: false }); } catch (e) {}
    try { this.$refs.customTabBar && this.$refs.customTabBar.syncSelected && this.$refs.customTabBar.syncSelected(); } catch (e) {}
    // #endif
    updateTabBarStatus(this, 2);

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

      // 刷新山页面数据和诗人筛选栏
      try { this.$refs.poetAvatarBar && this.$refs.poetAvatarBar.refresh(); } catch (_) {}
      this.getIndexData();
      return; // 强制刷新后不再进行缓存检查
    }
    
    // 检查缓存新鲜度：从其他页面返回时触发SWR检查
    try {
      if (this.hasEverLoaded && this.postList.length > 0) {
        getMountainPoems({ page: 0, pageSize: PAGE_SIZE, context: this, filterByPoet: this.selectedPoetName }).catch(() => {});
      }
    } catch (_) {}
    
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
    poetAvatarBar,
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
      selectedPoetName: null,  // 当前选中的诗人名字，null表示全部
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
    // 同时刷新诗人筛选栏
    try { this.$refs.poetAvatarBar && this.$refs.poetAvatarBar.refresh(); } catch (_) {}
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
    // 选择诗人筛选
    onPoetSelect(poetName) {
      console.log('【mountain】选择诗人:', poetName);
      this.selectedPoetName = poetName;
      // 重新加载数据
      this.getIndexData();
    },
    
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

        // 动态设置安全区域 - 优先使用safeAreaInsets.top，其次使用statusBarHeight
        let safeAreaTop = 0;

        // #ifdef APP-PLUS
        // 在app端，优先使用safeAreaInsets.top
        if (systemInfo.safeAreaInsets && systemInfo.safeAreaInsets.top > 0) {
          safeAreaTop = systemInfo.safeAreaInsets.top;
          console.log('【mountain】使用safeAreaInsets.top作为安全区域:', safeAreaTop);
        } else if (systemInfo.statusBarHeight) {
          safeAreaTop = systemInfo.statusBarHeight;
          console.log('【mountain】使用statusBarHeight作为安全区域:', safeAreaTop);
        }
        // #endif

        // #ifndef APP-PLUS
        // 在H5端，使用statusBarHeight
        if (systemInfo.statusBarHeight) {
          safeAreaTop = systemInfo.statusBarHeight;
          console.log('【mountain】使用statusBarHeight作为安全区域:', safeAreaTop);
        }
        // #endif

        // 设置页面数据
        this.setData({
          safeAreaTop: safeAreaTop
        });

        // 设置CSS变量 - 适配不同平台
        try {
          // #ifdef H5
          if (typeof document !== 'undefined' && document.documentElement) {
            document.documentElement.style.setProperty('--safe-area-top', safeAreaTop + 'px');
            console.log('【mountain】H5端CSS变量设置成功: --safe-area-top =', safeAreaTop + 'px');
          }
          // #endif

          // #ifdef APP-PLUS
          // 在app端，通过page的style设置CSS变量
          const pages = getCurrentPages();
          if (pages.length > 0) {
            const currentPage = pages[pages.length - 1];
            if (currentPage && currentPage.$el) {
              currentPage.$el.style.setProperty('--safe-area-top', safeAreaTop + 'px');
              console.log('【mountain】APP端CSS变量设置成功: --safe-area-top =', safeAreaTop + 'px');
            }
          }
          // #endif
        } catch (cssError) {
          console.log('【mountain】CSS变量设置失败，使用数据绑定方式:', cssError);
        }

        // 备用方案：直接修改页面根元素样式
        try {
          // #ifdef APP-PLUS
          const app = getApp();
          if (app.globalData) {
            app.globalData.safeAreaTop = safeAreaTop;
          }
          // #endif
        } catch (_) {}

      } catch (error) {
        console.error('【mountain】安全区域调试失败:', error);
        // 使用默认值
        this.setData({
          safeAreaTop: 44
        });
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
          context: this,
          filterByPoet: this.selectedPoetName,
          // SWR后台更新回调
          onBackgroundUpdate: async (newPosts) => {
            if (!Array.isArray(newPosts) || newPosts.length === 0 || this.page !== 0) return;
            try {
              const visibleList = newPosts.filter(p => p && !p.isAnonymous);
              visibleList.forEach((p) => {
                if (!p) return;
                p.backgroundColor = p.backgroundColor || this.generateRandomBackgroundColor();
                p.textColor = p.textColor || '#222';
                p.isExpanded = false;
                p.authorSignature = p.authorSignature || '';
                p.likeIcon = likeIcon && likeIcon.getLikeIcon ? likeIcon.getLikeIcon(p.votes || 0, !!p.isVoted) : '';
              });
              
              const currentPostIds = this.postList.slice(0, PAGE_SIZE).map(p => p._id).join(',');
              const newPostIds = visibleList.map(p => p._id).join(',');
              if (currentPostIds !== newPostIds) {
                const existingLaterPosts = this.postList.slice(PAGE_SIZE);
                this.setData({ postList: [...visibleList, ...existingLaterPosts] });
              }
            } catch (_) {}
          }
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
      const list = this.postList;
      const originalVotes = Number(list[index].votes) || 0;
      const wasVoted = !!list[index].isVoted;

      // 乐观更新
      const optimisticVotes = wasVoted ? Math.max(0, originalVotes - 1) : originalVotes + 1;
      list[index].votes = optimisticVotes;
      list[index].isVoted = !wasVoted;
      list[index].likeIcon = likeIcon.getLikeIcon(list[index].votes, list[index].isVoted);
      // 批量更新：标记投票进行中 + 乐观更新列表
      this.setData({ 
        [`votingInProgress.${postId}`]: true,
        postList: list 
      });

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
    touchEnd() {},
    
    // 分享到好友/群聊
    onShareAppMessage(res) {
      return getShareAppMessageConfig({
        title: 'poementer',
        path: '/pages/mountain/mountain'
      });
    },
    
    // 分享到朋友圈
    onShareTimeline() {
      return getShareTimelineConfig({
        title: 'poementer'
      });
    }
  }
};
</script>

<style>
/* 诗歌内容使用汇文明朝字体，其他地方使用系统默认字体 */

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
  font-family: '汇文明朝', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif;
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

/* 诗人筛选栏定位 */
.poet-avatar-bar-wrapper {
  position: absolute;
  top: calc(var(--safe-area-top, 44px) + 140rpx); /* 使用动态变量的安全区域高度 */
  left: 0;
  right: 0;
  z-index: 10;
}

/* 内容列表有头像栏时的上边距 */
.square-mode-container.with-avatar-bar {
  padding-top: calc(var(--safe-area-top, 44px) + 340rpx); /* 动态计算：安全区域 + 头像栏高度 */
}
</style>
    // 从 like:status 缓存对齐当前列表的点赞状态（兜底：跨页返回时也能更新）
    syncLikeStatusFromCache() {
      try {
        const list = Array.isArray(this.postList) ? this.postList : [];
        const ids = list.map(p => p && p._id).filter(Boolean);
        if (!ids.length) return;
        try { syncLikeStatusForPosts(ids); } catch (_) {}
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

