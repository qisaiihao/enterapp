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
          <view class="post-content-navigator" @tap="togglePostExpansion" :data-index="index">
            <view class="post-item">
              <view :class="'post-content ' + (item.isExpanded ? 'expanded' : 'collapsed')" v-if="item.content" :style="{ color: item.textColor, whiteSpace: 'pre-wrap' }">
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

              <!-- 作者签名 - 只在展开时显示 -->
              <view v-if="item.isExpanded && item.authorSignature" class="user-signature">
                <image class="signature-image" :src="item.authorSignature" mode="aspectFit" @error="onSignatureError" @load="onSignatureLoad"></image>
              </view>
            </view>
          </view>

          <!-- 交互区（展开时显示） -->
          <view class="vote-section" v-if="item.isExpanded" :style="{ backgroundColor: item.backgroundColor }">
            <view class="actions-left">
              <view class="like-icon-container" @tap.stop.prevent="onVote" :data-postid="item._id" :data-index="index">
                <image class="like-icon" :src="item.likeIcon || '/static/images/seed.png'" mode="aspectFit" @error="onLikeIconError" />
              </view>
              <view class="comment-count" @tap.stop.prevent="onCommentClick" :data-postid="item._id">
                <text class="comment-emoji">💬</text>
              </view>
            </view>
            <view class="button-group"><!-- 预留 --></view>
          </view>
        </view>
      </view>

      <!-- 底部加载/结束提示 -->
      <view class="loading-footer">
        <block v-if="isLoadingMore"><text>加载中...</text></block>
        <block v-else-if="!hasMore && postList.length > 0"><text>—— 到底啦 ——</text></block>
      </view>
    </view>

    <!-- 顶部提示（用于调试滑动预加载阈值） -->
    <view v-if="showPageIndicator" class="page-indicator"><view class="page-indicator-text">加载更多...</view></view>

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
      // 用户签名相关
      fetchingSignatures: {} // 防止重复获取签名的状态管理
    };
  },
  onLoad() {
    this.getIndexData();
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
    callCloudFunction(name, data = {}, extraOptions = {}) {
      return cloudCall(name, data, Object.assign({ pageTag: 'mountain', context: this, requireAuth: false }, extraOptions));
    },
    getIndexData() {
      this.isLoading = true;
      this.page = 0;
      this.postList = [];
      this.getPostList(() => { this.isLoading = false; });
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
      if (this.isLoadingMore) return;
      this.isLoadingMore = true;
      try {
        const res = await this.callCloudFunction('getPostList', {
          skip: this.page * PAGE_SIZE,
          limit: PAGE_SIZE,
          isPoem: true,       // 山页面：只获取诗歌类型的内容
          isOriginal: false   // 只获取非原创内容（山诗）
        });
        const list = (res && res.result && res.result.posts) ? res.result.posts : [];
        list.forEach((p) => {
          p.backgroundColor = this.generateRandomBackgroundColor();
          p.textColor = '#222';
          p.isExpanded = false;
          p.authorSignature = ''; // 添加作者签名属性
          p.likeIcon = likeIcon && likeIcon.getLikeIcon ? likeIcon.getLikeIcon(p.votes || 0, !!p.isVoted) : '';
        });
        this.postList = this.page === 0 ? list : this.postList.concat(list);
        this.page += 1;
        this.hasMore = list.length === PAGE_SIZE;
      } catch (e) {
        uni.showToast({ title: '加载失败', icon: 'none' });
      } finally {
        this.isLoadingMore = false;
        if (typeof cb === 'function') cb();
      }
    },
    togglePostExpansion(e) {
      const index = e.currentTarget.dataset.index;
      const post = this.postList[index];
      const next = !post.isExpanded;

      this.setData({ [`postList[${index}].isExpanded`]: next });

      // 如果展开且还没有签名，则获取签名
      if (next && post._openid && !post.authorSignature) {
        this.fetchAuthorSignature(post._openid, index);
      }
    },
    onCommentClick(e) {
      const postId = e.currentTarget.dataset.postid;
      uni.navigateTo({ url: `/pages/post-detail/post-detail?id=${postId}` });
    },
    onLikeIconError() {},

    // 获取作者签名
    async fetchAuthorSignature(authorOpenid, postIndex) {
      if (!authorOpenid || this.fetchingSignatures[authorOpenid]) {
        return;
      }

      // 防重复调用
      this.fetchingSignatures[authorOpenid] = true;

      try {
        const res = await this.callCloudFunction('getUserProfile', { userId: authorOpenid });

        if (res.result && res.result.success && res.result.userInfo && res.result.userInfo.signatureUrl) {
          const signatureUrl = res.result.userInfo.signatureUrl;
          console.log('【mountain】获取到作者签名:', signatureUrl);

          this.setData({
            [`postList[${postIndex}].authorSignature`]: signatureUrl
          });
        } else {
          console.log('【mountain】作者未设置签名');
          this.setData({
            [`postList[${postIndex}].authorSignature`]: ''
          });
        }
      } catch (err) {
        console.error('【mountain】获取作者签名失败:', err);
        this.setData({
          [`postList[${postIndex}].authorSignature`]: ''
        });
      } finally {
        // 清除获取状态
        delete this.fetchingSignatures[authorOpenid];
      }
    },

    // 签名图片加载成功
    onSignatureLoad(e) {
      console.log('【mountain】签名图片加载成功:', e);
    },

    // 签名图片加载失败
    onSignatureError(e) {
      console.error('【mountain】签名图片加载失败:', e);
    },
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
    touchStart() {},
    touchEnd() {}
  }
};
</script>

<style>
.white-bg { background: #fff; min-height: 100vh; }
.square-mode-container { padding: 40rpx; margin-bottom: 200rpx; padding-top: 80rpx; /* 减少上边距 */ }
.empty-state { text-align: center; padding: 100rpx 0; color: #999; }
.empty-icon { font-size: 80rpx; margin-bottom: 20rpx; }
.empty-text { font-size: 32rpx; margin-bottom: 10rpx; color: #666; }
.empty-subtext { font-size: 24rpx; color: #999; }
.post-item-wrapper { border-radius: 40rpx; margin-bottom: 60rpx; overflow: hidden; border: 1rpx solid #e9ecef; box-shadow: 0 12rpx 15rpx rgba(0,0,0,0.20); transition: transform .3s ease; }
.post-item-wrapper:active { transform: scale(0.98); }
.post-content-navigator { display: block; }
.post-item { padding: 40rpx 50rpx; position: relative; }
.post-content { font-size: 32rpx; line-height: 1.6; margin: 30rpx 0; width: 100%; }
/* 折叠态：多端兼容的三行裁切（参考原始小程序实现） */
.post-content.collapsed {
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 3;
  overflow: hidden;
  text-overflow: ellipsis;
}
.post-content.expanded { display: block; overflow: visible; }
.comment-emoji{ font-size: 40rpx; }
.vote-section { display: flex; justify-content: space-between; align-items: center; padding: 25rpx 50rpx; }
.actions-left { flex: 1; display: flex; align-items: center; gap: 20rpx; }
.button-group { display: flex; align-items: center; gap: 30rpx; }
.comment-count { display: flex; align-items: center; gap: 8rpx; padding: 10rpx 15rpx; }
.vote-count { display: flex; align-items: center; gap: 8rpx; padding: 10rpx 15rpx; border-radius: 20rpx; background: rgba(255,255,255,.9); box-shadow: 0 2rpx 8rpx rgba(0,0,0,.1); }
.comment-icon { width: 80rpx; height: 80rpx; }
.like-icon { width: 60rpx; height: 60rpx; margin-top: 5px; }

/* 用户签名样式 */
.user-signature {
  position: absolute;
  bottom: -25rpx; /* 从15rpx往下移动40rpx */
  right: 60rpx;
  z-index: 10;
  pointer-events: none; /* 防止签名影响点击事件 */
}

.signature-image {
  width: 180rpx;
  height: 90rpx;
  opacity: 0.8; /* 稍微透明，不抢夺主要内容的注意力 */
  filter: drop-shadow(0 2rpx 4rpx rgba(0, 0, 0, 0.1)); /* 添加轻微阴影 */
  display: block; /* 确保图片正确显示 */
  background: transparent; /* 确保背景透明 */
}

.loading-footer { text-align: center; color: #666; padding: 30rpx 0 120rpx; }
.page-indicator { position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); background: rgba(0,0,0,.7); color: #fff; padding: 20rpx 40rpx; border-radius: 40rpx; z-index: 1000; font-size: 28rpx; }
.page-indicator-text { text-align: center; }
</style>
