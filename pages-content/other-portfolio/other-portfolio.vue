<template>
  <view class="other-portfolio-page" @touchstart="touchStart" @touchend="touchEnd">
    <!-- 自定义返回按钮 -->
    <view class="custom-back-btn" @tap="goBack">
      <image class="back-icon" src="/static/images/left_exit.png" mode="aspectFit"></image>
    </view>
    
    <view class="container">
      <!-- 加载中骨架 -->
      <view v-if="isLoading">
        <skeleton />
      </view>

      <!-- 内容列表 -->
      <scroll-view v-else class="content-scroll" scroll-y="true" @scrolltolower="loadMore">
      <view class="content-container">
        <view v-if="postList.length === 0" class="empty-state">
          <view class="empty-icon">😶</view>
          <view class="empty-text">这里还没有内容</view>
          <view class="empty-subtext">作者还没有添加任何作品</view>
        </view>

        <view v-else id="post-list-container">
          <view v-for="(item, index) in postList" :key="index" class="post-item-wrapper" :style="{ backgroundColor: item.backgroundColor }">
            <view class="post-content-navigator" @tap="togglePostExpansion" @longpress="onLongPressCard" :data-index="index" :data-postid="item._id">
              <view class="post-item">
                <view :class="'post-content ' + (item.isExpanded ? 'expanded' : 'collapsed') + (!item.isExpanded && (!item.displayHighlightLines || item.displayHighlightLines.length === 0) ? ' no-highlight' : '')" v-if="item.displayContent" :style="{ color: item.textColor, whiteSpace: 'pre-wrap' }">
                  <block v-if="item.isExpanded">
                    {{ item.displayContent }}
                  </block>
                  <block v-else>
                    <!-- 折叠状态下只显示高光行 -->
                    <block v-if="item.displayHighlightLines && item.displayHighlightLines.length > 0">
                      <text v-for="(highlightLine, index) in item.displayHighlightLines" :key="index" style="font-weight: 700; display: block;">{{ highlightLine }}</text>
                    </block>
                    <block v-else>
                      {{ item.displayContent }}
                    </block>
                  </block>
                </view>

                <!-- 作者签名 - 展开时显示大签名 -->
                <view v-if="item.isExpanded && item.authorSignature" class="user-signature">
                  <image class="signature-image" :src="item.authorSignature" mode="aspectFit" @error="onSignatureError" @load="onSignatureLoad"></image>
                </view>

                <!-- 作者签名 - 折叠时显示小签名 -->
                <view v-if="!item.isExpanded && item.authorSignature" class="user-signature-small">
                  <image class="signature-image-small" :src="item.authorSignature" mode="aspectFit" @error="onSignatureError" @load="onSignatureLoad"></image>
                </view>
              </view>
            </view>

            <!-- 交互区（展开时显示） -->
            <view class="vote-section" v-if="item.isExpanded" :style="{ backgroundColor: item.backgroundColor }">
              <view class="actions-left"><!-- 预留左侧空间 --></view>
              <view class="button-group">
                <view class="like-icon-container" @tap.stop.prevent="onVote" :data-postid="item._id" :data-index="index">
                  <image :class="['like-icon', item.isVoted ? 'like-icon--voted' : '']" :src="item.likeIcon || '/static/images/seed.png'" mode="aspectFit" @error="onLikeIconError" />
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
    </scroll-view>
    </view>

    <!-- 顶部提示（用于调试滑动预加载阈值） -->
    <view v-if="showPageIndicator" class="page-indicator"></view>
  </view>
</template>

<script>
import { cloudCall } from '../../utils/cloudCall.js';
import { formatRelativeTime } from '../../utils/time.js';
import { previewImage } from '../../utils/imagePreview.js';
import { togglePostLike } from '../../utils/likeService.js';
import likeIcon from '../../utils/likeIcon.js';
import { attachPoemDisplayFields } from '../../utils/poemDisplay.js';
import { syncLikeStatusForPosts, getLatestLikeStatus } from '../../utils/likeStatusSync.js';
// authorSignature???????????????????ignatureCache
// Temporary placeholder for hydrateTempUrls
const hydrateTempUrls = async (posts) => posts;

export default {
  data() {
    return {
      folderId: '',
      folderName: '',
      userId: '', // 作品集作者的用户ID
      postList: [],
      // 初始为 false，避免首次调用被"已在加载"判断拦住
      isLoading: false,
      hasMore: true,
      skip: 0,
      limit: 10,
      showPageIndicator: false, // 调试用
      touchStartY: 0,
      touchEndY: 0,
      // 背景色和文字颜色处理
      lastUsedColorIndex: -1,
      backgroundColors: ['#a4c4bd', '#c9cfcf', '#906161', '#909388'],
      votingInProgress: {} // 点赞进行中的状态
    };
  },

  onLoad(options) {
    // 注册全局点赞事件
    try { uni.$on && uni.$on('like-changed', this.onGlobalLikeChanged); } catch (_) {}
    console.log('【他人作品集】页面加载，参数:', options);
    this.folderId = options.folderId || '';
    this.folderName = decodeURIComponent(options.folderName || '未命名作品集');
    this.userId = options.userId || '';
    
    
    if (!this.folderId || !this.userId) {
      uni.showToast({
        title: '参数错误',
        icon: 'none'
      });
      setTimeout(() => {
        uni.navigateBack();
      }, 1500);
      return;
    }
    
    this.loadPortfolioContent();
  },

  onShow() {
    // 回到页面时，用缓存对齐当前可见帖子的点赞状态
    try { this.syncLikeStatusFromCache && this.syncLikeStatusFromCache(); } catch (_) {}
  },

  onUnload() {
    // 取消全局点赞事件监听
    try { uni.$off && this.onGlobalLikeChanged && uni.$off('like-changed', this.onGlobalLikeChanged); } catch (_) {}
  },

  onPullDownRefresh() {
    console.log('【他人作品集】下拉刷新');
    this.skip = 0;
    this.postList = [];
    this.hasMore = true;
    this.loadPortfolioContent(() => {
      uni.stopPullDownRefresh();
    });
  },

  methods: {
    // 统一云函数调用方法
    callCloudFunction(name, data = {}, extraOptions = {}) {
      return cloudCall(name, data, Object.assign({ pageTag: 'other-portfolio', context: this, requireAuth: true }, extraOptions));
    },

    goBack() {
      uni.navigateBack();
    },


    // 生成随机背景色
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

    // 加载作品集内容
    async loadPortfolioContent(callback) {
      // 正在加载时防重入，但首次要允许执行
      if (this.isLoading) {
        if (typeof callback === 'function') callback();
        return;
      }

      this.isLoading = true;
      try {
        console.log('【他人作品集】开始加载内容，folderId:', this.folderId, 'userId:', this.userId);
        
        // 使用统一的 getPortfolioItems，并传入 userId 查询他人作品集
        const res = await this.callCloudFunction('getPortfolioItems', {
          folderId: this.folderId,
          userId: this.userId,
          skip: this.skip,
          limit: this.limit
        });

        if (res.result && res.result.success) {
          const newPosts = res.result.portfolioItems || [];
          
          // 处理图片URL
          const processedPosts = await hydrateTempUrls(newPosts);
          
          // 优先使用本地缓存中的点赞状态，如果没有缓存则使用云函数返回的状态
                    
          // 处理背景色、文字颜色和展开状态
          processedPosts.forEach(post => {
            // 优先使用数据库中保存的背景颜色，如果没有则随机生成
            post.backgroundColor = post.backgroundColor || this.generateRandomBackgroundColor();
            post.textColor = post.textColor || '#222';
            post.isExpanded = false;
            // authorSignature已从云函数返回，保留原始值（如果没有则为空字符串）
            post.authorSignature = post.authorSignature || '';
            const normalized = attachPoemDisplayFields(post);
            post.displayContent = normalized.displayContent;
            post.displayHighlightLines = normalized.displayHighlightLines;
            
            // 尝试从本地缓存获取点赞状态
            const cachedStatus = getLatestLikeStatus(post._id);
            if (cachedStatus) {
              post.votes = cachedStatus.votes;
              post.isVoted = cachedStatus.isVoted;
            }
            post.likeIcon = likeIcon.getLikeIcon(post.votes || 0, post.isVoted || false);
            
            // 格式化时间
            if (post.createTime) {
              post.formattedCreateTime = this.formatTime(post.createTime);
            }
          });

          // 处理分页数据，避免重复
          if (this.skip === 0) {
            this.postList = processedPosts;
          } else {
            // 合并时去重：使用 Set 来去重，保留已存在的项
            const existingIds = new Set(this.postList.map(p => p._id));
            const uniqueNewList = processedPosts.filter(p => p && p._id && !existingIds.has(p._id));
            this.postList = [...this.postList, ...uniqueNewList];
          }

          this.hasMore = newPosts.length === this.limit;
          this.skip += newPosts.length;

          // authorSignature已从云函数返回，无需额外获取
          console.log('【他人作品集】加载成功，数量:', newPosts.length, '总数:', this.postList.length);
        } else {
          uni.showToast({
            title: res.result?.message || '获取作品集失败',
            icon: 'none'
          });
        }
      } catch (error) {
        console.error('【他人作品集】加载失败:', error);
        uni.showToast({
          title: '加载失败',
          icon: 'none'
        });
      } finally {
        this.isLoading = false;
        if (typeof callback === 'function') {
          callback();
        }
      }
    },

    // 加载更多
    loadMore() {
      if (!this.hasMore || this.isLoading) return;
      console.log('【他人作品集】加载更多');
      this.loadPortfolioContent();
    },

    // 切换帖子展开/折叠
    togglePostExpansion(e) {
      const index = e.currentTarget.dataset.index;
      const post = this.postList[index];
      if (post) {
        const nextPostList = this.postList.slice();
        nextPostList[index] = { ...post, isExpanded: !post.isExpanded };
        this.postList = nextPostList;
        // authorSignature已从云函数返回，无需额外获取
      }
    },

    // authorSignature已从云函数返回，不再需要fetchAuthorSignature函数

    // 长按卡片
    onLongPressCard(e) {
      console.log('【他人作品集】长按卡片，他人作品集不支持编辑');
    },

    // 点赞
    async onVote(e) {
      const postId = e.currentTarget.dataset.postid;
      const index = e.currentTarget.dataset.index;
      
      if (!postId) {
        console.error('【他人作品集】点赞失败：postId为空');
        return;
      }
      
      if (this.votingInProgress[postId]) {
        console.log('【他人作品集】正在点赞中，跳过重复请求');
        return;
      }
      
      this.votingInProgress[postId] = true;
      const list = this.postList;
      const originalVotes = Number(list[index].votes) || 0;
      const wasVoted = !!list[index].isVoted;
      
      // 乐观更新UI
      const optimisticVotes = wasVoted ? Math.max(0, originalVotes - 1) : originalVotes + 1;
      const optimisticItem = {
        ...list[index],
        votes: optimisticVotes,
        isVoted: !wasVoted,
        likeIcon: likeIcon.getLikeIcon(optimisticVotes, !wasVoted)
      };
      const optimisticList = list.slice();
      optimisticList[index] = optimisticItem;
      this.postList = optimisticList;
      
      try {
        const result = await togglePostLike(postId, {
          pageTag: 'other-portfolio',
          context: this,
          currentVotes: originalVotes,
          currentIsLiked: wasVoted,
          requireAuth: true
        });
        
        if (result && result.success) {
          const currentList = this.postList || [];
          const currentIndex = currentList.findIndex((p) => p && p._id === postId);
          if (currentIndex > -1) {
            const updatedItem = {
              ...currentList[currentIndex],
              votes: result.votes,
              isVoted: result.isLiked,
              likeIcon: result.likeIcon
            };
            const newList = currentList.slice();
            newList[currentIndex] = updatedItem;
            this.postList = newList;
          }
        } else {
          // 回滚
          const rollbackItem = {
            ...list[index],
            votes: originalVotes,
            isVoted: wasVoted,
            likeIcon: likeIcon.getLikeIcon(originalVotes, wasVoted)
          };
          const rollbackList = list.slice();
          rollbackList[index] = rollbackItem;
          this.postList = rollbackList;
          uni.showToast({ title: result?.message || '点赞失败', icon: 'none' });
        }
      } catch (err) {
        console.error('【他人作品集】点赞异常:', err);
        // 回滚
        const rollbackItem = {
          ...list[index],
          votes: originalVotes,
          isVoted: wasVoted,
          likeIcon: likeIcon.getLikeIcon(originalVotes, wasVoted)
        };
        const rollbackList = list.slice();
        rollbackList[index] = rollbackItem;
        this.postList = rollbackList;
        uni.showToast({ title: '操作失败', icon: 'none' });
      } finally {
        this.votingInProgress[postId] = false;
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
          const updatedItem = {
            ...list[idx],
            votes,
            isVoted: isLiked,
            likeIcon: likeIcon.getLikeIcon(votes, isLiked)
          };
          const newList = list.slice();
          newList[idx] = updatedItem;
          this.postList = newList;
        }
      } catch (_) {}
    },

    // 从缓存同步点赞状态
    syncLikeStatusFromCache() {
      try {
        const list = Array.isArray(this.postList) ? this.postList : [];
        const ids = list.map(p => p && p._id).filter(Boolean);
        if (!ids.length) return;
        try { 
          syncLikeStatusForPosts(ids); 
        } catch (_) {}
        let changed = false;
        const next = list.slice();
        for (let i = 0; i < next.length; i += 1) {
          const p = next[i]; 
          if (!p || !p._id) continue;
          const s = getLatestLikeStatus(p._id);
          if (s && ((p.votes || 0) !== s.votes || !!p.isVoted !== !!s.isVoted)) {
            p.votes = s.votes; 
            p.isVoted = s.isVoted; 
            p.likeIcon = likeIcon.getLikeIcon(s.votes, s.isVoted);
            changed = true;
          }
        }
        if (changed) this.postList = next;
      } catch (err) { 
        console.warn('[other-portfolio] syncLikeStatusFromCache failed', err); 
      }
    },

    // 评论点击
    onCommentClick(e) {
      const postId = e.currentTarget.dataset.postid;
      console.log('【他人作品集】点击评论，postId:', postId);
      uni.navigateTo({
        url: `/pages/post-detail/post-detail?id=${postId}`
      });
    },

    // 图片预览
    handlePreview(event) {
      return previewImage(event, { fallbackToast: false });
    },

    // 格式化时间
    formatTime(dateString) {
      return formatRelativeTime(dateString);
    },

    // 签名加载错误
    onSignatureError(e) {
      console.error('签名加载失败:', e.detail);
    },

    // 签名加载成功
    onSignatureLoad(e) {
      console.log('签名加载成功');
    },

    // 点赞图标加载错误
    onLikeIconError(e) {
      console.error('点赞图标加载失败:', e.detail);
    },

    // 触摸开始
    touchStart(e) {
      this.touchStartY = e.touches[0].clientY;
    },

    // 触摸结束
    touchEnd(e) {
      this.touchEndY = e.changedTouches[0].clientY;
      const deltaY = this.touchStartY - this.touchEndY;
      
      // 向上滑动超过50px时显示页面指示器（调试用）
      if (deltaY > 50) {
        this.showPageIndicator = true;
        setTimeout(() => {
          this.showPageIndicator = false;
        }, 1000);
      }
    }
  }
};
</script>

<style scoped>
/* 诗歌内容使用汇文明朝字体，其他地方使用系统默认字体 */

.other-portfolio-page {
  background: var(--app-page-bg, #fff);
  color: var(--app-primary-text, #111111);
  height: 100vh;
  display: flex;
  flex-direction: column;
  /* #ifdef APP-PLUS */
  padding-top: var(--status-bar-height);
  /* #endif */
}


/* 自定义返回按钮 */
.custom-back-btn {
  position: absolute;
  top: calc(90rpx + env(safe-area-inset-top, var(--safe-area-inset-top, 0px))); /* 添加安全区域偏移 */
  left: 40rpx;
  width: 100rpx;
  height: 100rpx;
  background: transparent;
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
  transition: all 0.2s ease;
  box-sizing: border-box;
}

.custom-back-btn:active {
  transform: scale(0.95);
}

.custom-back-btn .back-icon {
  width: 22rpx;
  height: 38rpx;
  display: block;
  object-fit: contain;
  filter: var(--app-icon-filter, none);
}

.container {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.content-scroll {
  flex: 1;
  height: 0;
}

.content-container {
  width: 100vw;            /* 占满视口宽度 */
  box-sizing: border-box;
  padding: 0 0 32rpx;
  padding-top: 140rpx; /* 顶部留白，避免与返回按钮重叠 */
  display: flex;
  flex-direction: column;
  align-items: stretch; /* 让卡片撑满容器 */
}

#post-list-container {
  width: 100vw;
  box-sizing: border-box;
}

.empty-state { 
  text-align: center; 
  padding: 100rpx 0; 
  color: var(--app-muted-text, #999);
}

.empty-icon { 
  font-size: 80rpx; 
  margin-bottom: 20rpx; 
}

.empty-text { 
  font-size: 32rpx; 
  margin-bottom: 10rpx; 
  color: var(--app-secondary-text, #666);
}

.empty-subtext { 
  font-size: 24rpx; 
  color: var(--app-muted-text, #999);
}

/* poem.css inspired card styles */
.post-item-wrapper {
  width: 100%; /* 占满容器，消除左右空白 */
  margin-left: 0;
  margin-right: 0;
  border-radius: 30rpx; /* 15px * 2 */
  margin-bottom: 32rpx; /* 减少间距，让卡片更紧凑 */
  overflow: hidden;
  box-shadow: 0 8rpx 8rpx rgba(0, 0, 0, 0.25); /* 0px 4px 4px * 2 */
  transition: transform .3s ease;
  border: none;
  position: relative; /* 为卷边效果添加定位 */
}

.post-item-wrapper:active { 
  transform: scale(0.98); 
}

.post-content-navigator { 
  display: block; 
}

.post-item { 
  padding: 32rpx; 
  position: relative; 
  width: 100%;
  box-sizing: border-box;
} /* 进一步减少上下padding，文字往左移动 */

/* Typography inspired by poem.css */
.post-content {
  font-family: 'Huiwen-mincho', '汇文明朝', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif;
  font-style: normal;
  font-weight: 500;
  font-size: 28rpx; /* 调小字体：14px * 2 */
  line-height: 38rpx; /* 调整行距：19px * 2 */
  margin: 30rpx 0;
  width: 100%;
  color: #FFFFFF;
}

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

.post-content.expanded { 
  display: block; 
  overflow: visible; 
}

.comment-emoji{ 
  font-size: 40rpx; 
}

.comment-icon { 
  width: 60rpx; 
  height: 60rpx; 
  filter: var(--app-post-action-icon-filter, none);
  opacity: var(--app-post-action-icon-opacity, 1);
}

.vote-section { 
  display: flex; 
  justify-content: space-between; 
  align-items: center; 
  padding: 35rpx 50rpx; 
}

.actions-left { 
  flex: 1; 
  display: flex; 
  align-items: center; 
  gap: 20rpx; 
}

.button-group { 
  display: flex; 
  align-items: center; 
  gap: 30rpx; 
}

.comment-count { 
  display: flex; 
  align-items: center; 
  gap: 8rpx; 
  padding: 10rpx 15rpx; 
}

.vote-count { 
  display: flex; 
  align-items: center; 
  gap: 8rpx; 
  padding: 10rpx 15rpx; 
  border-radius: 20rpx; 
  background: rgba(255,255,255,.9); 
  box-shadow: 0 2rpx 8rpx rgba(0,0,0,.1); 
}

.comment-icon { 
  width: 60rpx; 
  height: 60rpx; 
}

.like-icon { 
  width: 60rpx; 
  height: 60rpx; 
  margin-top: 5px; 
  filter: var(--app-post-action-icon-filter, none);
  opacity: var(--app-post-action-icon-opacity, 1);
}

.like-icon--voted {
  filter: none;
  opacity: 1;
}

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

/* 小签名样式 - 折叠状态下显示 */
.user-signature-small {
  position: absolute;
  bottom: 30rpx;
  right: 60rpx;
  z-index: 10;
  pointer-events: none; /* 防止签名影响点击事件 */
}

.signature-image-small {
  width: 100rpx;
  height: 50rpx;
  opacity: 0.6; /* 更透明，不抢夺主要内容的注意力 */
  filter: drop-shadow(0 1rpx 2rpx rgba(0, 0, 0, 0.1)); /* 添加轻微阴影 */
  display: block; /* 确保图片正确显示 */
  background: transparent; /* 确保背景透明 */
}

.loading-footer { 
  text-align: center; 
  color: var(--app-muted-text, #666);
  padding: 40rpx 0 60rpx; 
  font-size: 28rpx;
}

.page-indicator { 
  position: fixed; 
  top: 50%; 
  left: 50%; 
  transform: translate(-50%, -50%); 
  background: rgba(0,0,0,.7); 
  color: #fff; 
  padding: 20rpx 40rpx; 
  border-radius: 40rpx; 
  z-index: 1000; 
  font-size: 28rpx; 
}

.page-indicator-text { 
  text-align: center; 
}
</style>
