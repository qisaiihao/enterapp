<template>
  <view class="feature-page" :data-app-theme="appThemeMode" :style="featurePageStyle">
    <view class="feature-header">
      <view class="back-btn" @tap="goBack">
        <image class="back-icon" src="/static/images/left_exit.png" mode="aspectFit"></image>
      </view>
      <text class="feature-title">{{ detail.title }}</text>
    </view>

    <view v-if="postItems.length" class="poem-stack-wrap">
      <view
        class="poem-stack"
        @touchstart="handleStackTouchStart"
        @touchend="handleStackTouchEnd"
      >
        <view
          v-for="(card, stackIndex) in currentStackCards"
          :key="getPostId(card) || card.title || stackIndex"
          :class="[
            'poem-stack-card',
            'poem-stack-card-' + (stackIndex + 1),
            stackAnimating ? 'is-shuffling' : ''
          ]"
          :style="getCardInlineStyle(card, stackIndex)"
          @tap="handleCardTap(card, stackIndex)"
        >
          <view v-if="stackIndex === 0" class="poem-stack-content">
            <text class="stack-poem-title" :style="getCardTextStyle(card, stackIndex)">{{ card.title || '未命名作品' }}</text>
            <text class="stack-poem-copy" :style="getCardTextStyle(card, stackIndex)">{{ card.copy || card.content || '' }}</text>
          </view>
        </view>
      </view>
    </view>

    <view v-if="postItems.length" class="author-row">
      <view class="author-left">
        <image
          class="author-avatar avatar-image"
          :src="currentAuthorAvatar"
          mode="aspectFill"
        ></image>
        <view class="author-copy">
          <text class="author-name">{{ currentAuthorName }}</text>
          <text class="author-subtitle">已收录{{ workCount }}首原创作品</text>
        </view>
      </view>
      <text v-if="currentSignatureText" class="signature-text">{{ currentSignatureText }}</text>
    </view>

    <view v-if="postItems.length" class="comment-preview-slot">
      <view v-if="selectedPostComments.length" class="comment-preview">
        <view
          v-for="(comment, index) in selectedPostComments"
          :key="comment._id || index"
          :class="['comment-preview-row', index % 2 === 0 ? 'align-right' : 'align-left']"
        >
          <image
            v-if="index % 2 !== 0"
            class="comment-avatar"
            :src="resolveCommentAvatar(comment)"
            mode="aspectFill"
          ></image>
          <view class="comment-bubble">
            <text class="comment-text">{{ comment.content }}</text>
          </view>
          <image
            v-if="index % 2 === 0"
            class="comment-avatar"
            :src="resolveCommentAvatar(comment)"
            mode="aspectFill"
          ></image>
        </view>
      </view>
    </view>

    <WeeklyFeatureActionBar v-if="postItems.length" />
  </view>
</template>

<script>
import WeeklyFeatureActionBar from '@/components/weekly/WeeklyFeatureActionBar.vue';
import { getComments } from '@/api-cache/comment.js';
import { getSystemInfoCompat } from '@/utils/system-info.js';
import { resolvePostAuthorAvatar, resolveCommentAuthorAvatar } from '@/utils/defaultAvatar.js';
import { getReadableTextColor, getThemedCardBackgroundColor } from '@/utils/uiHelpers.js';
import { getThemeMode, getThemeVars, THEME_CHANGED_EVENT } from '@/utils/theme.js';
import { navigateToPostDetail } from '@/utils/navigation.js';

const fallbackPoemColors = ['#a4c4bd', '#c9cfcf', '#906161', '#909388'];

export default {
  name: 'WeeklyFeatureDetailView',
  components: {
    WeeklyFeatureActionBar
  },
  props: {
    detail: {
      type: Object,
      default: () => ({})
    },
    fallbackUrl: {
      type: String,
      default: '/pages-content/weekly-home/weekly-home'
    }
  },
  data() {
    return {
      pageInlineStyle: {},
      appThemeMode: getThemeMode(),
      appThemeVars: getThemeVars(),
      commentsByPostId: {},
      commentLoadingByPostId: {},
      commentRequestKey: '',
      currentPostIndex: 0,
      stackAnimating: false,
      stackTouchStartX: 0,
      stackTouchStartY: 0
    };
  },
  computed: {
    featurePageStyle() {
      return {
        ...this.appThemeVars,
        ...this.pageInlineStyle
      };
    },

    postItems() {
      return Array.isArray(this.detail.posts) ? this.detail.posts.slice(0, 8) : [];
    },

    selectedPost() {
      return this.postItems[this.currentPostIndex] || this.postItems[0] || null;
    },

    selectedPostId() {
      return this.getPostId(this.selectedPost);
    },

    selectedPostComments() {
      const comments = this.selectedPostId ? this.commentsByPostId[this.selectedPostId] : [];
      return Array.isArray(comments) ? comments.slice(0, 3) : [];
    },

    currentStackCards() {
      return this.getStackCards(this.currentPostIndex);
    },

    postItemsSignature() {
      return this.postItems
        .map(post => this.getPostId(post))
        .filter(Boolean)
        .join('|');
    },

    workCount() {
      if (this.selectedPost) {
        const currentCount = this.getCurrentAuthorSelectionCount();
        if (
          this.selectedPost.authorHistoricalFeaturedCount !== undefined ||
          this.selectedPost.authorCurrentDetailFeaturedCount !== undefined
        ) {
          return (Number(this.selectedPost.authorHistoricalFeaturedCount) || 0)
            + (Number(this.selectedPost.authorCurrentDetailFeaturedCount) || currentCount);
        }
        if (this.selectedPost.authorFeaturedCount !== undefined) {
          return Number(this.selectedPost.authorFeaturedCount) || currentCount;
        }
        return currentCount;
      }
      return Number(this.detail.authorFeaturedCount) || 0;
    },

    currentAuthorName() {
      return (this.selectedPost && this.selectedPost.authorName) || this.detail.authorName || '';
    },

    currentAuthorAvatar() {
      if (this.selectedPost) {
        return this.resolvePostAvatar(this.selectedPost);
      }
      return resolvePostAuthorAvatar({
        _id: this.detail.id || this.detail._id || '',
        authorAvatar: this.detail.authorAvatar || '',
        authorName: this.detail.authorName || ''
      });
    },

    currentSignatureText() {
      if (this.selectedPost) {
        return this.resolveSignatureText(this.selectedPost.authorSignature || this.selectedPost.summary || '');
      }
      return this.resolveSignatureText(this.detail.authorSignature || this.detail.summary || '');
    }
  },
  watch: {
    postItemsSignature: {
      immediate: true,
      handler() {
        if (this.currentPostIndex >= this.postItems.length) {
          this.currentPostIndex = 0;
        }
        this.loadCommentPreviews();
      }
    },
    selectedPostId: {
      immediate: true,
      handler(postId) {
        if (postId) {
          this.ensureCommentPreview(this.selectedPost);
        }
      }
    }
  },
  mounted() {
    this.setupHeaderLayout();
    this.bindThemeChange();
  },
  beforeDestroy() {
    this.unbindThemeChange();
  },
  unmounted() {
    this.unbindThemeChange();
  },
  methods: {
    getPostId(post) {
      if (!post) return '';
      return post.postId || post._id || post.id || '';
    },

    getAuthorKey(post) {
      if (!post) return '';
      return String(post.authorName || post.author || post.authorAvatar || '').trim().toLowerCase();
    },

    getCurrentAuthorSelectionCount() {
      const selectedAuthorKey = this.getAuthorKey(this.selectedPost);
      if (!selectedAuthorKey) return this.selectedPost ? 1 : 0;
      const count = this.postItems.filter(post => this.getAuthorKey(post) === selectedAuthorKey).length;
      return Math.max(count, this.selectedPost ? 1 : 0);
    },

    resolveSignatureText(value) {
      const text = String(value || '').trim();
      if (!text) return '';
      if (/^(https?:\/\/|cloud:\/\/|wxfile:\/\/|data:image\/)/i.test(text)) return '';
      return text;
    },

    getStackCards(startIndex = 0) {
      if (!this.postItems.length) return [];
      const total = this.postItems.length;
      const maxCards = Math.min(4, total);
      const cards = [];

      for (let offset = 0; offset < maxCards; offset += 1) {
        cards.push(this.postItems[(startIndex + offset) % total]);
      }

      return cards;
    },

    handleStackTouchStart(event) {
      const touch = event && event.changedTouches && event.changedTouches[0];
      if (!touch) return;
      this.stackTouchStartX = touch.clientX || touch.pageX || 0;
      this.stackTouchStartY = touch.clientY || touch.pageY || 0;
    },

    handleStackTouchEnd(event) {
      const touch = event && event.changedTouches && event.changedTouches[0];
      if (!touch || this.postItems.length <= 1) return;

      const endX = touch.clientX || touch.pageX || 0;
      const endY = touch.clientY || touch.pageY || 0;
      const deltaX = endX - this.stackTouchStartX;
      const deltaY = endY - this.stackTouchStartY;

      if (Math.abs(deltaX) < 42 || Math.abs(deltaX) < Math.abs(deltaY) * 1.15) return;
      this.shiftTopCard(deltaX < 0 ? 1 : -1);
    },

    handleCardTap(card, stackIndex = 0) {
      if (stackIndex !== 0) return;
      const postId = this.getPostId(card);
      if (!postId) return;
      navigateToPostDetail(postId);
    },

    shiftTopCard(step) {
      const total = this.postItems.length;
      if (total <= 1) return;
      this.currentPostIndex = (this.currentPostIndex + step + total) % total;
      this.stackAnimating = true;
      setTimeout(() => {
        this.stackAnimating = false;
      }, 180);
    },

    resolvePostAvatar(post) {
      return resolvePostAuthorAvatar({
        ...post,
        _id: this.getPostId(post)
      });
    },

    resolveCommentAvatar(comment) {
      return resolveCommentAuthorAvatar(comment);
    },

    resolveCardBackground(card) {
      const sourceColor = card && card.backgroundColor ? card.backgroundColor : this.resolvePostFallbackColor(card);
      return getThemedCardBackgroundColor(sourceColor, this.appThemeMode);
    },

    resolveCardTextColor(card) {
      return getReadableTextColor(
        this.resolveCardBackground(card),
        (card && card.textColor) || '#222'
      );
    },

    getCardInlineStyle(card, stackIndex = 0) {
      const backgroundColor = this.resolveCardBackground(card);
      return {
        backgroundColor,
        borderColor: backgroundColor
      };
    },

    getCardTextStyle(card) {
      return {
        color: this.resolveCardTextColor(card)
      };
    },

    resolvePostFallbackColor(post) {
      const key = [
        this.getPostId(post),
        post && post.title,
        post && post.authorName
      ].filter(Boolean).join('|');
      if (!key) return fallbackPoemColors[0];

      let hash = 0;
      for (let index = 0; index < key.length; index += 1) {
        hash = ((hash << 5) - hash) + key.charCodeAt(index);
        hash |= 0;
      }
      const colorIndex = Math.abs(hash) % fallbackPoemColors.length;
      return fallbackPoemColors[colorIndex];
    },

    bindThemeChange() {
      if (this._weeklyThemeChangeHandler) return;
      this._weeklyThemeChangeHandler = ({ mode } = {}) => {
        this.appThemeMode = mode || getThemeMode();
        this.appThemeVars = getThemeVars(this.appThemeMode);
      };
      try {
        if (typeof uni !== 'undefined' && typeof uni.$on === 'function') {
          uni.$on(THEME_CHANGED_EVENT, this._weeklyThemeChangeHandler);
        }
      } catch (_) {}
    },

    unbindThemeChange() {
      if (!this._weeklyThemeChangeHandler) return;
      try {
        if (typeof uni !== 'undefined' && typeof uni.$off === 'function') {
          uni.$off(THEME_CHANGED_EVENT, this._weeklyThemeChangeHandler);
        }
      } catch (_) {}
      this._weeklyThemeChangeHandler = null;
    },

    async loadCommentPreviews() {
      const posts = this.postItems.filter(post => this.getPostId(post));
      const requestKey = this.postItemsSignature;
      this.commentRequestKey = requestKey;

      if (!posts.length) {
        this.commentsByPostId = {};
        this.commentLoadingByPostId = {};
        return;
      }

      const uniquePosts = posts.filter((post, index, list) => {
        const postId = this.getPostId(post);
        return list.findIndex(item => this.getPostId(item) === postId) === index;
      });

      await Promise.all(uniquePosts.map(async (post) => {
        await this.ensureCommentPreview(post, requestKey);
      }));
    },

    async ensureCommentPreview(post, requestKey = this.commentRequestKey || this.postItemsSignature) {
      const postId = this.getPostId(post);
      if (!postId) return;
      if (Array.isArray(this.commentsByPostId[postId]) || this.commentLoadingByPostId[postId]) return;

      this.commentLoadingByPostId = {
        ...this.commentLoadingByPostId,
        [postId]: true
      };

      try {
        const comments = await this.getPostComments(post);
        if (this.commentRequestKey && this.commentRequestKey !== requestKey) return;
        this.commentsByPostId = {
          ...this.commentsByPostId,
          [postId]: comments
        };
      } catch (error) {
        console.warn('[WeeklyFeatureDetailView] load comment preview failed:', {
          postId,
          error
        });
        if (this.commentRequestKey && this.commentRequestKey !== requestKey) return;
        this.commentsByPostId = {
          ...this.commentsByPostId,
          [postId]: []
        };
      } finally {
        if (!this.commentRequestKey || this.commentRequestKey === requestKey) {
          this.commentLoadingByPostId = {
            ...this.commentLoadingByPostId,
            [postId]: false
          };
        }
      }
    },

    async getPostComments(post) {
      const postId = this.getPostId(post);
      if (!postId) return [];

      const result = await getComments(postId, {
        context: this,
        pageTag: 'weekly-feature-detail',
        injectOpenId: false,
        silent: true
      });
      const comments = this.resolveCommentList(result);
      return comments
        .filter(comment => comment && String(comment.content || '').trim())
        .slice(0, 3);
    },

    resolveCommentList(result) {
      if (!result || typeof result !== 'object') return [];
      if (Array.isArray(result.comments)) return result.comments;
      if (Array.isArray(result.commentList)) return result.commentList;
      if (Array.isArray(result.list)) return result.list;
      if (Array.isArray(result.data)) return result.data;
      if (result.data && Array.isArray(result.data.comments)) return result.data.comments;
      return [];
    },

    setupHeaderLayout() {
      try {
        const systemInfo = getSystemInfoCompat();
        const safeAreaTop = (systemInfo.safeAreaInsets && systemInfo.safeAreaInsets.top) || systemInfo.statusBarHeight || 0;
        if (safeAreaTop > 0) {
          this.pageInlineStyle = { '--feature-safe-area-top': `${safeAreaTop}px` };
        }
      } catch (error) {
        console.warn('[WeeklyFeatureDetailView] setup header layout failed:', error);
      }
    },

    goBack() {
      try {
        const pages = typeof getCurrentPages === 'function' ? getCurrentPages() : [];
        if (pages && pages.length > 1) {
          uni.navigateBack({ delta: 1 });
          return;
        }
      } catch (_) {}
      uni.navigateTo({ url: this.fallbackUrl });
    }
  }
};
</script>

<style scoped>
.feature-page {
  min-height: 100vh;
  box-sizing: border-box;
  background: #ffffff;
  color: #111111;
  padding-bottom: 44rpx;
}

.feature-header {
  position: relative;
  height: calc(var(--feature-safe-area-top, 0px) + 88rpx);
  padding-top: var(--feature-safe-area-top, 0px);
  box-sizing: border-box;
  background: #ffffff;
}

.back-btn {
  position: absolute;
  left: 30rpx;
  bottom: 16rpx;
  width: 56rpx;
  height: 56rpx;
  display: flex;
  align-items: center;
  justify-content: center;
}

.back-icon {
  width: 22rpx;
  height: 38rpx;
  display: block;
  filter: var(--app-icon-filter, none);
}

.feature-title {
  position: absolute;
  left: 104rpx;
  right: 104rpx;
  bottom: 24rpx;
  color: #111111;
  font-size: 28rpx;
  line-height: 40rpx;
  font-weight: 600;
  text-align: center;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.poem-stack-wrap {
  padding-top: 44rpx;
}

.poem-stack {
  position: relative;
  width: 610rpx;
  height: 650rpx;
  margin: 0 auto;
}

.poem-stack-card {
  position: absolute;
  border-radius: 14rpx;
  box-sizing: border-box;
  overflow: hidden;
  transition: right 0.18s ease, bottom 0.18s ease, transform 0.18s ease;
}

.poem-stack-card.is-shuffling {
  transform: scale(0.992);
}

.poem-stack-card-1 {
  right: 104rpx;
  bottom: 0;
  z-index: 5;
  width: 484rpx;
  height: 536rpx;
  background: #00070a;
  border: 10rpx solid #00070a;
  cursor: pointer;
}

.poem-stack-card-2 {
  right: 58rpx;
  bottom: 34rpx;
  z-index: 4;
  width: 500rpx;
  height: 554rpx;
  background: #f5dfba;
  border: 10rpx solid #f5dfba;
}

.poem-stack-card-3 {
  right: 28rpx;
  bottom: 68rpx;
  z-index: 3;
  width: 516rpx;
  height: 572rpx;
  background: #71805c;
  border: 10rpx solid #71805c;
}

.poem-stack-card-4 {
  right: 0;
  bottom: 96rpx;
  z-index: 2;
  width: 532rpx;
  height: 590rpx;
  background: #7d2f2a;
  border: 10rpx solid #bfe9ee;
}

.poem-stack-content {
  width: 100%;
  height: 100%;
  padding: 44rpx 42rpx;
  display: flex;
  flex-direction: column;
  justify-content: center;
  box-sizing: border-box;
  font-family: 'Huiwen-mincho', '姹囨枃鏄庢湞', 'Songti SC', 'STSong', serif;
}

.stack-poem-title {
  color: #ffffff;
  font-family: 'Huiwen-mincho', '姹囨枃鏄庢湞', 'Songti SC', 'STSong', serif;
  font-size: 34rpx;
  line-height: 44rpx;
  font-weight: 700;
  text-align: center;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.stack-poem-copy {
  margin-top: 28rpx;
  color: rgba(255, 255, 255, 0.88);
  font-family: 'Huiwen-mincho', '姹囨枃鏄庢湞', 'Songti SC', 'STSong', serif;
  font-size: 26rpx;
  line-height: 44rpx;
  text-align: center;
  white-space: pre-line;
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 8;
  -webkit-box-orient: vertical;
}

.author-row {
  margin: 18rpx 54rpx 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24rpx;
}

.author-left {
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 16rpx;
}

.author-avatar {
  width: 52rpx;
  height: 52rpx;
  flex: 0 0 auto;
  border-radius: 50%;
  border: 1rpx solid #d8c6a7;
  background: #ffffff;
  box-sizing: border-box;
}

.avatar-image {
  display: block;
}

.author-copy {
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.author-name {
  color: #111111;
  font-size: 24rpx;
  line-height: 30rpx;
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.author-subtitle {
  margin-top: 2rpx;
  color: #a2a2a2;
  font-size: 18rpx;
  line-height: 24rpx;
}

.signature-text {
  max-width: 220rpx;
  color: #999999;
  font-size: 22rpx;
  line-height: 30rpx;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.comment-preview-slot {
  margin: 30rpx 38rpx 0;
  min-height: 342rpx;
}

.comment-preview {
  min-height: 342rpx;
}

.comment-preview-row {
  display: flex;
  align-items: flex-end;
  gap: 10rpx;
  margin-top: 28rpx;
}

.comment-preview-row:first-child {
  margin-top: 0;
}

.comment-preview-row.align-right {
  justify-content: flex-end;
}

.comment-preview-row.align-left {
  justify-content: flex-start;
}

.comment-bubble {
  max-width: 520rpx;
  min-height: 86rpx;
  padding: 20rpx 26rpx;
  border-radius: 12rpx;
  background: #c5cebe;
  box-sizing: border-box;
}

.comment-text {
  color: #333333;
  font-size: 24rpx;
  line-height: 34rpx;
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.comment-bubble-empty {
  width: 560rpx;
  padding: 0;
}

.comment-bubble-empty.short {
  width: 470rpx;
}

.comment-avatar {
  width: 52rpx;
  height: 52rpx;
  flex: 0 0 auto;
  border-radius: 50%;
  border: 1rpx solid #c9b891;
  background: #ffffff;
  box-sizing: border-box;
}

.comment-avatar-empty {
  border-color: #c9b891;
  background: #ffffff;
}
</style>

