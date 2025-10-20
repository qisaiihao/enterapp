<template>
  <view class="mountain white-bg" @touchstart="touchStart" @touchend="touchEnd">
    <!-- 顶部栏 -->
    <top-bar />

    <!-- 加载中骨架 -->
    <view v-if="isLoading">
      <skeleton />
    </view>

    <!-- 内容列表 -->
    <view v-else class="square-mode-container">
      <view v-if="postList.length === 0" class="empty-state">
        <view class="empty-icon">⛰️</view>
        <view class="empty-text">这里还没有山诗</view>
        <view class="empty-subtext">去广场发现好诗吧～</view>
      </view>

      <view id="post-list-container">
        <view v-for="(item, index) in postList" :key="item._id || index" class="post-item-wrapper" :style="{ backgroundColor: item.backgroundColor }">
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
                <image class="comment-icon" src="/static/images/comment.png" mode="aspectFit" />
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
const likeIcon = require('@/utils/likeIcon.js');

const PAGE_SIZE = 10;

export default {
  onShow() {
    // #ifndef MP-WEIXIN
    try { uni.hideTabBar({ animation: false }); } catch (e) {}
    try { this. $refs.customTabBar && this.$refs.customTabBar.syncSelected && this.$refs.customTabBar.syncSelected(); } catch (e) {}
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
      safeAreaTop: 0
    };
  },
  onLoad() {
    // 调试：检查安全区域高度
    this.debugSafeArea();
    this.getIndexData();
  },
  onPullDownRefresh() {
    console.log('【mountain】📱 下拉刷新，重新获取数据');
    this.getIndexData(() => {
      console.log('【mountain】✅ 下拉刷新完成，停止刷新动画');
      uni.stopPullDownRefresh();
    });
  },
  onPageScroll(e) {
    if (this._scrollTimer) clearTimeout(this._scrollTimer);
    this._scrollTimer = setTimeout(() => {
      if (!this.hasMore || this.isLoadingMore || this.isLoading) return;
      try {
        const info = uni.getSystemInfoSync();
        const winH = info.windowHeight;
        uni.createSelectorQuery().in(this).select('#post-list-container').boundingClientRect((rect) => {
          if (!rect || !rect.height) return;
          const distanceToBottom = rect.height - e.scrollTop - winH;
          const preloadThreshold = winH * 1.5;
          if (distanceToBottom < preloadThreshold) {
            this.showPageIndicator = true;
            this.getPostList(() => { this.showPageIndicator = false; });
          }
        }).exec();
      } catch (_) {}
    }, 100);
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

    callCloudFunction(name, data = {}, extraOptions = {}) {
      return cloudCall(name, data, Object.assign({ pageTag: 'mountain', context: this, requireAuth: false }, extraOptions));
    },
    getIndexData(callback) {
      console.log('【mountain】开始获取数据，callback:', typeof callback);
      this.setData({ 
        isLoading: true, 
        postList: [], 
        page: 0, 
        hasMore: true 
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
      const colors = this.backgroundColors;
      const last = this.lastUsedColorIndex;
      if (last === -1) {
        const idx = Math.floor(Math.random() * colors.length);
        this.lastUsedColorIndex = idx;
        return colors[idx];
      }
      const avail = colors.filter((_, i) => i !== last);
      const pick = avail[Math.floor(Math.random() * avail.length)];
      this.lastUsedColorIndex = colors.indexOf(pick);
      return pick;
    },
    async getPostList(cb) {
      console.log('【mountain】getPostList 开始，isLoadingMore:', this.isLoadingMore, 'callback:', typeof cb);
      if (this.isLoadingMore) {
        console.log('【mountain】正在加载更多，跳过请求');
        if (typeof cb === 'function') cb();
        return;
      }
      this.setData({ isLoadingMore: true });
      try {
        const res = await this.callCloudFunction('getPostList', {
          skip: this.page * PAGE_SIZE,
          limit: PAGE_SIZE,
          isPoem: true,       // 山页面：只获取诗歌类型的内容
          isOriginal: false   // 只获取非原创内容（山诗）
        });
        const list = (res && res.result && res.result.posts) ? res.result.posts : [];
        console.log('【mountain】获取到帖子数量:', list.length);
        
        list.forEach((p) => {
          // 优先使用数据库中保存的背景颜色，如果没有则随机生成
          p.backgroundColor = p.backgroundColor || this.generateRandomBackgroundColor();
          p.textColor = p.textColor || '#222';
          p.isExpanded = false;
          p.likeIcon = likeIcon && likeIcon.getLikeIcon ? likeIcon.getLikeIcon(p.votes || 0, !!p.isVoted) : '';
        });
        
        const newPostList = this.page === 0 ? list : this.postList.concat(list);
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
        console.log('【mountain】设置 isLoadingMore: false，执行回调');
        this.setData({ isLoadingMore: false });
        if (typeof cb === 'function') {
          console.log('【mountain】执行回调函数');
          cb();
        }
      }
    },
    togglePostExpansion(e) {
      const index = e.currentTarget.dataset.index;
      const post = this.postList[index];
      const next = !post.isExpanded;

      this.setData({ [`postList[${index}].isExpanded`]: next });

    },
    onCommentClick(e) {
      const postId = e.currentTarget.dataset.postid;
      uni.navigateTo({ url: `/pages/post-detail/post-detail?id=${postId}` });
    },
    onLikeIconError() {},

    async onVote(e) {
      const postId = e.currentTarget.dataset.postid;
      const index = e.currentTarget.dataset.index;
      if (this.votingInProgress[postId]) return;
      this.setData({ [`votingInProgress.${postId}`]: true });
      const list = this.postList;
      const originalVotes = list[index].votes || 0;
      const wasVoted = !!list[index].isVoted;
      list[index].votes = wasVoted ? originalVotes - 1 : originalVotes + 1;
      list[index].isVoted = !wasVoted;
      list[index].likeIcon = likeIcon.getLikeIcon(list[index].votes, list[index].isVoted);
      this.setData({ postList: list });
      try {
        const res = await this.callCloudFunction('vote', { postId });
        if (!res || !res.result || !res.result.success) throw new Error('vote failed');
        if (typeof res.result.votes === 'number' && res.result.votes !== list[index].votes) {
          this.setData({ [`postList[${index}].votes`]: res.result.votes });
        }
      } catch (err) {
        list[index].votes = originalVotes; list[index].isVoted = wasVoted;
        list[index].likeIcon = likeIcon.getLikeIcon(originalVotes, wasVoted);
        this.setData({ postList: list });
        uni.showToast({ title: '操作失败', icon: 'none' });
      } finally {
        this.setData({ [`votingInProgress.${postId}`]: false });
      }
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
  padding: 40rpx;
  margin-bottom: 200rpx;
  padding-top: 250rpx; /* 增加上边距：100rpx(top-bar高度) + 150rpx(额外间距) */
  display: flex;
  flex-direction: column;
  align-items: center; /* 居中卡片 */
}
.empty-state { text-align: center; padding: 100rpx 0; color: #999; }
.empty-icon { font-size: 80rpx; margin-bottom: 20rpx; }
.empty-text { font-size: 32rpx; margin-bottom: 10rpx; color: #666; }
.empty-subtext { font-size: 24rpx; color: #999; }
/* poem.css inspired card styles */
.post-item-wrapper {
  width: calc(100% - 80rpx); /* 响应式宽度：屏幕宽度减去左右各40rpx边距 */
  margin-left: 40rpx; /* 左边距 */
  margin-right: 40rpx; /* 右边距 */
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
