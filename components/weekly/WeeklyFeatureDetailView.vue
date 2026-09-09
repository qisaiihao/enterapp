<template>
  <view class="feature-page" :data-app-theme="appThemeMode" :style="featurePageStyle">
    <view class="feature-header">
      <view class="back-btn" @tap="goBack">
        <image class="back-icon" src="/static/images/left_exit.png" mode="aspectFit"></image>
      </view>
      <text class="feature-title">{{ detail.title }}</text>
    </view>

    <view v-if="!postItems.length" class="feature-empty-state">
      <text class="feature-empty-title">本期暂未收录作品</text>
      <text class="feature-empty-sub">编辑正在挑选诗歌，请稍后再来看看</text>
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

    <WeeklyFeatureActionBar
      v-if="postItems.length"
      :like-icon-src="selectedLikeIcon"
      :is-voted="selectedIsVoted"
      @like="handleVote"
      @favorite="openFavoriteModal"
      @save="openShareCard"
      @comment="openCommentComposer"
    />

    <!-- 就地评论输入层（与诗歌详情页评论框一致） -->
    <view
      :class="'weekly-composer-overlay ' + (isInputExpanded ? 'show' : '')"
      @tap="collapseCommentInput"
    ></view>

    <view
      v-if="isInputExpanded"
      class="weekly-composer-area"
      :style="'bottom: ' + keyboardHeight + 'px;'"
    >
      <view class="weekly-composer-box">
        <view v-if="replyToComment" class="weekly-composer-reply-prompt">
          <text class="weekly-composer-reply-prompt-text">回复 {{ replyToAuthor }}：</text>
          <view class="weekly-composer-cancel-reply" @tap="cancelReply">
            <text class="weekly-composer-cancel-text">取消</text>
          </view>
        </view>

        <textarea
          class="weekly-composer-textarea"
          :style="'height: ' + commentTextareaHeight + 'px;'"
          placeholder="留下你的精彩评论..."
          :value="newComment"
          maxlength="500"
          :adjust-position="false"
          :show-confirm-bar="false"
          :focus="isFocus"
          :cursor-spacing="0"
          @input="onCommentInput"
          @linechange="onCommentLineChange"
          @focus="onComposerFocus"
          @blur="onComposerBlur"
        ></textarea>

        <view v-if="commentImages.length" class="weekly-composer-images">
          <view
            class="weekly-composer-image-item"
            :data-index="index"
            v-for="(item, index) in commentImages"
            :key="index"
          >
            <image
              class="weekly-composer-image-thumb"
              :src="item.previewUrl"
              mode="aspectFill"
              @tap="previewSelectedCommentImage"
              :data-index="index"
            ></image>
            <view class="weekly-composer-remove-btn" @tap="removeCommentImage" :data-index="index">✕</view>
          </view>
        </view>

        <view class="weekly-composer-actions">
          <view class="weekly-composer-action-icons">
            <view class="weekly-composer-action-icon" @tap="chooseCommentImages">
              <image
                class="weekly-composer-action-icon-image"
                src="/static/images/newicons/image.png"
                mode="aspectFit"
              ></image>
            </view>
          </view>
          <view
            class="weekly-composer-submit"
            :class="{ disabled: isSubmitDisabled }"
            @tap="onSubmitComment"
          >
            <image
              class="weekly-composer-submit-icon"
              src="/static/images/newicons/comment.png"
              mode="aspectFit"
            ></image>
          </view>
        </view>
      </view>
    </view>

    <FolderSelector
      :show="showFavoriteModal"
      :post-id="favoritePostId"
      @hide="hideFavoriteModal"
      @favoriteSuccess="hideFavoriteModal"
    />

    <!-- 分享/保存卡片弹窗 -->
    <WeeklyShareCardModal
      v-if="showShareCardModal"
      :post="selectedPost"
      @hide="closeShareCard"
    />
  </view>
</template>

<script>
import WeeklyFeatureActionBar from '@/components/weekly/WeeklyFeatureActionBar.vue';
import WeeklyShareCardModal from '@/components/weekly/WeeklyShareCardModal.vue';
import FolderSelector from '@/components/folder-selector/folder-selector.vue';
import { isUserLoggedIn, requireLogin } from '@/utils/authHelper.js';
import { getComments, submitComment } from '@/api-cache/comment.js';
import { getSystemInfoCompat, getWindowInfoCompat } from '@/utils/system-info.js';
import { resolvePostAuthorAvatar, resolveCommentAuthorAvatar } from '@/utils/defaultAvatar.js';
import { getReadableTextColor, getThemedCardBackgroundColor } from '@/utils/uiHelpers.js';
import { getThemeMode, getThemeVars, THEME_CHANGED_EVENT } from '@/utils/theme.js';
import { navigateToPostDetail } from '@/utils/navigation.js';
import likeIcon from '@/utils/likeIcon.js';
import { togglePostLike } from '@/utils/likeService.js';
import { getLatestLikeStatus, updateLikeStatus } from '@/utils/likeStatusSync.js';
import { validateCommentInput } from '@/utils/commentUtils.js';
import { uploadFile } from '@/utils/uploader.js';
import { getCurrentUserId } from '@/utils/auth.js';
import { getCurrentPlatform } from '@/utils/platformDetector.js';
import { requestAndroidStoragePermission } from '@/utils/permissions.js';
import { emitCommentCountChanged } from '@/utils/events.js';

const fallbackPoemColors = ['#a4c4bd', '#c9cfcf', '#906161', '#909388'];

export default {
  name: 'WeeklyFeatureDetailView',
  components: {
    WeeklyFeatureActionBar,
    WeeklyShareCardModal,
    FolderSelector
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
      stackTouchStartY: 0,
      // 点赞状态：postId -> { votes, isVoted, likeIcon }
      likeOverrides: {},
      votingInProgress: {},
      showShareCardModal: false,
      showFavoriteModal: false,
      favoritePostId: '',
      // 评论输入框
      newComment: '',
      commentImages: [],
      maxCommentImages: 3,
      isSubmitDisabled: true,
      isSubmittingComment: false,
      isInputExpanded: false,
      isFocus: false,
      keyboardHeight: 0,
      commentTextareaMinHeight: 90,
      commentTextareaMaxHeight: 175,
      commentTextareaHeight: 90,
      replyToComment: null,
      replyToAuthor: ''
    };
  },
  computed: {
    featurePageStyle() {
      return {
        ...this.appThemeVars,
        ...this.readFontVars,
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

    // 当前选中的诗歌快照点赞状态（含当前页面的点赞覆盖与本地缓存）
    selectedLike() {
      const postId = this.selectedPostId;
      const override = postId ? this.likeOverrides[postId] : null;
      if (override) {
        return override;
      }
      const post = this.selectedPost || {};
      const votes = Math.max(0, Number(post.votes) || 0);
      const isVoted = post.isVoted === true;
      return {
        votes,
        isVoted,
        likeIcon: likeIcon.getLikeIcon(votes, isVoted)
      };
    },

    selectedLikeIcon() {
      return this.selectedLike.likeIcon;
    },

    selectedIsVoted() {
      return this.selectedLike.isVoted;
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
        this.syncLikesFromCache();
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
    this.bindGlobalLikeEvents();
    this.bindComposerKeyboard();
    this.initializeComposerMetrics();
  },
  beforeDestroy() {
    this.unbindThemeChange();
    this.unbindGlobalLikeEvents();
    this.unbindComposerKeyboard();
  },
  unmounted() {
    this.unbindThemeChange();
    this.unbindGlobalLikeEvents();
    this.unbindComposerKeyboard();
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
        .slice()
        .reverse()
        // 云函数按时间正序返回，这里取最近发布的 3 条评论（新评论在最前，保证发布后能看到）
        .slice(0, 3);
    },

    // 把刚发布成功的评论立即插入到预览最前面（去重，最多保留 3 条）
    prependCommentToPreview(postId, commentItem) {
      if (!postId || !commentItem) return;
      const contentText = String(commentItem.content || '').trim();
      if (!contentText) return; // 与预览过滤逻辑一致：仅展示含文字的评论
      const commentId = commentItem._id || commentItem.id || '';
      const previous = Array.isArray(this.commentsByPostId[postId])
        ? this.commentsByPostId[postId].slice()
        : [];
      const merged = previous.filter((item) => {
        const itemId = item && (item._id || item.id || '');
        return !itemId || !commentId || itemId !== commentId;
      });
      merged.unshift(commentItem);
      this.commentsByPostId = {
        ...this.commentsByPostId,
        [postId]: merged.slice(0, 3)
      };
    },

    // 发布评论成功后刷新评论预览：先把服务端返回的新评论插入预览保证立即可见，
    // 再后台静默拉取最新列表并合并（避免服务端读后写延迟把刚发的评论覆盖掉）
    async refreshCommentsAfterSubmit(post, newComment) {
      const postId = this.getPostId(post);
      if (!postId) return;
      const requestKey = this.commentRequestKey || this.postItemsSignature;

      this.prependCommentToPreview(postId, newComment);

      this.commentLoadingByPostId = {
        ...this.commentLoadingByPostId,
        [postId]: true
      };
      try {
        const freshComments = await this.getPostComments(post);
        if (this.commentRequestKey && this.commentRequestKey !== requestKey) return;
        const freshList = Array.isArray(freshComments) ? freshComments : [];
        const newCommentId = newComment && (newComment._id || newComment.id || '');
        const hasNewComment = newCommentId && freshList.some((item) => {
          const itemId = item && (item._id || item.id || '');
          return itemId === newCommentId;
        });
        let mergedList;
        if (newCommentId && !hasNewComment) {
          // 服务端列表暂时还没包含刚发布的评论，把它保留在最前面
          mergedList = [newComment].concat(
            freshList.filter((item) => {
              const itemId = item && (item._id || item.id || '');
              return itemId !== newCommentId;
            })
          );
        } else {
          mergedList = freshList;
        }
        this.commentsByPostId = {
          ...this.commentsByPostId,
          [postId]: mergedList.slice(0, 3)
        };
      } catch (error) {
        console.warn('[WeeklyFeatureDetailView] 发布评论后刷新失败，保留本地预览:', {
          postId,
          error
        });
      } finally {
        this.commentLoadingByPostId = {
          ...this.commentLoadingByPostId,
          [postId]: false
        };
      }
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
    },

    // ========== 点赞 ==========

    setLikeOverride(postId, payload = {}) {
      if (!postId) return;
      const nextOverrides = {
        ...this.likeOverrides,
        [postId]: {
          votes: Math.max(0, Number(payload.votes) || 0),
          isVoted: !!payload.isVoted,
          likeIcon: payload.likeIcon || likeIcon.getLikeIcon(Number(payload.votes) || 0, !!payload.isVoted)
        }
      };
      this.likeOverrides = nextOverrides;
    },

    // 首次载入时从本地缓存同步点赞状态（当用户之前给该诗点过赞时，能立即反映）
    syncLikesFromCache() {
      const nextOverrides = { ...this.likeOverrides };
      this.postItems.forEach((post) => {
        const postId = this.getPostId(post);
        if (!postId) return;
        const cached = getLatestLikeStatus(postId);
        if (cached && typeof cached.votes === 'number') {
          nextOverrides[postId] = {
            votes: cached.votes,
            isVoted: !!cached.isVoted,
            likeIcon: likeIcon.getLikeIcon(cached.votes, !!cached.isVoted)
          };
          return;
        }
        // 服务端快照已带 isVoted 且本地无缓存时，写入本地点赞缓存（10 分钟有效），
        // 便于本次会话内其它页面/列表同步显示已点赞状态，又不覆盖更“新”的本地切换。
        if (post.isVoted === true && typeof post.votes === 'number') {
          updateLikeStatus(postId, post.votes, true);
          nextOverrides[postId] = {
            votes: post.votes,
            isVoted: true,
            likeIcon: likeIcon.getLikeIcon(post.votes, true)
          };
        }
      });
      this.likeOverrides = nextOverrides;
    },

    openFavoriteModal() {
      if (!this.selectedPostId) return;
      if (!isUserLoggedIn()) {
        requireLogin({ content: '收藏需要登录，请先登录' });
        return;
      }
      // 固定打开时的作品，避免切换卡片后收藏到另一首。
      this.favoritePostId = this.selectedPostId;
      this.showFavoriteModal = true;
    },

    hideFavoriteModal() {
      this.showFavoriteModal = false;
    },

    async handleVote() {
      const post = this.selectedPost;
      const postId = this.selectedPostId;
      if (!postId || !post) return;
      if (this.votingInProgress[postId]) return;

      const current = this.selectedLike;
      const newVoted = !current.isVoted;
      const newVotes = Math.max(0, current.votes + (newVoted ? 1 : -1));

      // 乐观更新
      this.setLikeOverride(postId, {
        votes: newVotes,
        isVoted: newVoted,
        likeIcon: likeIcon.getLikeIcon(newVotes, newVoted)
      });
      this.votingInProgress = { ...this.votingInProgress, [postId]: true };

      try {
        const result = await togglePostLike(postId, {
          pageTag: 'weekly-feature-detail',
          context: this,
          currentVotes: current.votes,
          currentIsLiked: current.isVoted,
          requireAuth: true
        });

        if (result && result.success) {
          this.setLikeOverride(postId, {
            votes: result.votes,
            isVoted: result.isLiked,
            likeIcon: result.likeIcon
          });
          return;
        }

        const rollback = (result && result.rollback) || current;
        this.setLikeOverride(postId, {
          votes: rollback.votes,
          isVoted: rollback.isLiked,
          likeIcon: rollback.likeIcon
        });
      } catch (error) {
        console.error('[WeeklyFeatureDetailView] 点赞失败', error);
        this.setLikeOverride(postId, current);
      } finally {
        this.votingInProgress = { ...this.votingInProgress, [postId]: false };
      }
    },

    // 跨页点赞事件同步：仅更新当前页面正在展示的诗歌
    onGlobalLikeChanged(payload = {}) {
      const postId = payload && payload.postId;
      if (!postId) return;
      const isInView = this.postItems.some(post => this.getPostId(post) === postId);
      if (!isInView && postId !== this.selectedPostId) return;
      const votes = typeof payload.votes === 'number' ? payload.votes : 0;
      const isVoted = !!payload.isLiked;
      this.setLikeOverride(postId, {
        votes,
        isVoted,
        likeIcon: likeIcon.getLikeIcon(votes, isVoted)
      });
    },

    bindGlobalLikeEvents() {
      if (this._weeklyLikeChangedHandler) return;
      this._weeklyLikeChangedHandler = this.onGlobalLikeChanged;
      try {
        if (typeof uni !== 'undefined' && typeof uni.$on === 'function') {
          uni.$on('like-changed', this._weeklyLikeChangedHandler);
        }
      } catch (_) {}
    },

    unbindGlobalLikeEvents() {
      if (!this._weeklyLikeChangedHandler) return;
      try {
        if (typeof uni !== 'undefined' && typeof uni.$off === 'function') {
          uni.$off('like-changed', this._weeklyLikeChangedHandler);
        }
      } catch (_) {}
      this._weeklyLikeChangedHandler = null;
    },

    // ========== 分享/保存卡片 ==========

    openShareCard() {
      if (!this.selectedPostId || !this.selectedPost) return;
      this.showShareCardModal = true;
    },

    closeShareCard() {
      this.showShareCardModal = false;
    },

    // ========== 就地评论输入 ==========

    initializeComposerMetrics() {
      try {
        const systemInfo = getWindowInfoCompat();
        const rpxToPx = systemInfo && systemInfo.windowWidth ? systemInfo.windowWidth / 750 : 0.5;
        const minHeight = Math.round(180 * rpxToPx);
        const maxHeight = Math.round(350 * rpxToPx);
        this.commentTextareaMinHeight = minHeight;
        this.commentTextareaMaxHeight = maxHeight;
        this.commentTextareaHeight = minHeight;
      } catch (error) {
        console.warn('[WeeklyFeatureDetailView] 初始化评论输入框高度失败:', error);
      }
    },

    bindComposerKeyboard() {
      if (this._weeklyKeyboardHandler) return;
      // #ifdef MP-WEIXIN || APP-PLUS || APP-HARMONY
      this._weeklyKeyboardHandler = (res) => {
        const height = res && res.height ? res.height : 0;
        this.keyboardHeight = height;
      };
      try {
        if (typeof uni.onKeyboardHeightChange === 'function') {
          uni.onKeyboardHeightChange(this._weeklyKeyboardHandler);
        }
      } catch (e) {
        console.warn('[WeeklyFeatureDetailView] 键盘高度监听设置失败:', e);
      }
      // #endif
    },

    unbindComposerKeyboard() {
      if (!this._weeklyKeyboardHandler) return;
      try {
        // #ifdef MP-WEIXIN || APP-PLUS || APP-HARMONY
        if (typeof uni.offKeyboardHeightChange === 'function') {
          uni.offKeyboardHeightChange(this._weeklyKeyboardHandler);
        }
        // #endif
      } catch (_) {}
      this._weeklyKeyboardHandler = null;
    },

    openCommentComposer() {
      if (!this.selectedPostId || !this.selectedPost) return;
      this.keyboardHeight = 0;
      this.isInputExpanded = true;
      this.isFocus = true;
    },

    collapseCommentInput() {
      this.resetComposerTextareaHeight();
      this.isInputExpanded = false;
      this.isFocus = false;
      this.keyboardHeight = 0;
      this.replyToComment = null;
      this.replyToAuthor = '';
    },

    resetComposerTextareaHeight() {
      const minHeight = this.commentTextareaMinHeight || 90;
      if (this.commentTextareaHeight !== minHeight) {
        this.commentTextareaHeight = minHeight;
      }
    },

    onComposerFocus(event) {
      if (event && event.detail && typeof event.detail.height === 'number' && event.detail.height > 0) {
        this.keyboardHeight = event.detail.height;
      }
    },

    onComposerBlur() {
      this.isFocus = false;
      this.keyboardHeight = 0;
    },

    onCommentInput(event) {
      this.newComment = event.detail.value;
      this.updateCommentSubmitState();
    },

    onCommentLineChange(event) {
      const nextHeight = event && event.detail ? Number(event.detail.height) : NaN;
      if (!Number.isFinite(nextHeight)) return;
      const minHeight = this.commentTextareaMinHeight || 90;
      const maxHeight = this.commentTextareaMaxHeight || 175;
      const clampedHeight = Math.max(minHeight, Math.min(nextHeight, maxHeight));
      if (Math.abs((this.commentTextareaHeight || 0) - clampedHeight) > 1) {
        this.commentTextareaHeight = clampedHeight;
      }
    },

    updateCommentSubmitState() {
      const hasText = (this.newComment || '').trim().length > 0;
      const hasImages = Array.isArray(this.commentImages) && this.commentImages.length > 0;
      const disabled = (!hasText && !hasImages) || this.isSubmittingComment;
      if (this.isSubmitDisabled !== disabled) {
        this.isSubmitDisabled = disabled;
      }
    },

    cancelReply() {
      this.replyToComment = null;
      this.replyToAuthor = '';
    },

    chooseCommentImages() {
      const existingImages = Array.isArray(this.commentImages) ? this.commentImages.length : 0;
      const remaining = this.maxCommentImages - existingImages;
      if (remaining <= 0) {
        uni.showToast({ title: '最多选择3张图片', icon: 'none' });
        return;
      }

      if (!this.isInputExpanded) {
        this.isInputExpanded = true;
      }

      const startChoose = () => {
        uni.chooseImage({
          count: remaining,
          sizeType: ['compressed'],
          sourceType: ['album', 'camera'],
          success: (res) => {
            const tempFiles = res.tempFiles
              || (res.tempFilePaths || []).map(path => ({ tempFilePath: path, size: 0 }));
            const tasks = tempFiles.map(file => this.prepareCommentImage(file));
            Promise.all(tasks)
              .then((processedImages) => {
                const validImages = processedImages.filter(item => !!item);
                if (!validImages.length) return;
                const updatedImages = (this.commentImages || []).concat(validImages);
                this.commentImages = updatedImages.slice(0, this.maxCommentImages);
                this.isInputExpanded = true;
                this.isFocus = false;
                this.updateCommentSubmitState();
              })
              .catch((err) => {
                console.error('[WeeklyFeatureDetailView] 评论图片处理失败:', err);
                uni.showToast({ title: '图片处理失败', icon: 'none' });
              });
          },
          fail: (err) => {
            if (err && err.errMsg && err.errMsg.indexOf('cancel') === -1) {
              console.error('[WeeklyFeatureDetailView] 选择图片失败:', err);
              uni.showToast({ title: '无法选择图片', icon: 'none' });
            }
          }
        });
      };

      try {
        const platform = getCurrentPlatform();
        if (platform === 'app') {
          requestAndroidStoragePermission().then((granted) => {
            if (granted) startChoose();
          });
          return;
        }
      } catch (_) {}

      startChoose();
    },

    prepareCommentImage(file) {
      return new Promise((resolve) => {
        const tempPath = file.tempFilePath || file.path || (Array.isArray(file.tempFilePaths) ? file.tempFilePaths[0] : '');
        if (!tempPath) {
          resolve(null);
          return;
        }
        const sizeInBytes = file.size || 0;
        resolve({
          id: 'weekly_comment_' + Date.now() + '_' + Math.floor(Math.random() * 100000),
          originalPath: tempPath,
          previewUrl: tempPath,
          compressedPath: tempPath,
          size: sizeInBytes,
          needCompression: false
        });
      });
    },

    removeCommentImage(event) {
      const index = event.currentTarget.dataset.index;
      if (index === undefined) return;
      const images = (this.commentImages || []).slice();
      images.splice(index, 1);
      this.commentImages = images;
      this.updateCommentSubmitState();
    },

    previewSelectedCommentImage(event) {
      const index = Number(event.currentTarget.dataset.index) || 0;
      const images = this.commentImages || [];
      if (!images.length) return;
      const urls = images.map(item => item.previewUrl).filter(Boolean);
      if (!urls.length) return;
      const current = urls[index] || urls[0];
      uni.previewImage({ current, urls });
    },

    getUploadUserKey() {
      try {
        const userId = getCurrentUserId(this);
        if (userId) return userId;
      } catch (_) {}
      try {
        const app = getApp();
        if (app && app.globalData && app.globalData.openid) {
          return app.globalData.openid;
        }
      } catch (_) {}
      return 'guest';
    },

    async uploadCommentImages() {
      const images = this.commentImages || [];
      if (!images.length) return [];
      const userKey = this.getUploadUserKey();
      const timestamp = Date.now();

      return Promise.all(
        images.map((image, index) => {
          const uniqueKey = `${userKey}_${timestamp}_${index}`;
          const compressedCloudPath = 'comment_images/' + uniqueKey + '_compressed.jpg';
          return uploadFile(compressedCloudPath, image.compressedPath || image.previewUrl || image.originalPath)
            .then((compressedFileID) => {
              return {
                compressedUrl: compressedFileID,
                originalUrl: compressedFileID
              };
            });
        })
      );
    },

    async onSubmitComment() {
      const postId = this.selectedPostId;
      const post = this.selectedPost;
      if (!postId || !post) {
        uni.showToast({ title: '帖子信息缺失', icon: 'none' });
        return;
      }
      if (this.isSubmitDisabled || this.isSubmittingComment) return;

      const trimmedContent = (this.newComment || '').trim();
      const validationResult = validateCommentInput(trimmedContent, this.commentImages || []);
      if (!validationResult.isValid) {
        uni.showToast({ title: validationResult.message, icon: 'none' });
        return;
      }

      this.isSubmittingComment = true;
      this.updateCommentSubmitState();
      uni.showLoading({ title: '提交中...' });

      try {
        const imageUploadResults = await this.uploadCommentImages();
        const imageUrls = imageUploadResults.map(item => item.compressedUrl);
        const originalImageUrls = imageUploadResults.map(item => item.originalUrl);

        const commentData = {
          postId,
          content: trimmedContent,
          images: imageUrls.map((url, index) => ({
            url,
            originalUrl: originalImageUrls[index],
            order: index
          })),
          parentId: this.replyToComment || null,
          replyToAuthorName: this.replyToAuthor || null,
          isAnonymous: post.isAnonymous === true
        };

        const result = await submitComment(commentData, {
          pageTag: 'weekly-feature-detail'
        });
        uni.hideLoading();

        if (result) {
          uni.showToast({ title: '评论成功' });
          // 发送评论数变更事件，便于详情页等处同步
          try {
            const commentCount = Math.max(0, Number(post.comments) || 0) + 1;
            emitCommentCountChanged({ postId, commentCount });
          } catch (_) {}

          this.newComment = '';
          this.commentImages = [];
          this.updateCommentSubmitState();
          this.collapseCommentInput();

          // 立刻刷新评论预览：先将服务端返回的新评论插入预览，再静默拉取最新列表合并。
          // （旧逻辑先置空再调用 ensureCommentPreview，会命中其“已缓存数组”守卫导致不刷新）
          const newComment = (result && result.comment) || null;
          this.refreshCommentsAfterSubmit(post, newComment);
        }
      } catch (error) {
        uni.hideLoading();
        console.error('[WeeklyFeatureDetailView] 提交评论失败:', error);
        uni.showToast({ title: '评论失败', icon: 'none' });
      } finally {
        this.isSubmittingComment = false;
        this.updateCommentSubmitState();
      }
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
  padding-bottom: calc(180rpx + env(safe-area-inset-bottom, 0px));
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

.feature-empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16rpx;
  padding: 160rpx 60rpx;
  background: #ffffff;
}

.feature-empty-title {
  font-size: 30rpx;
  font-weight: 600;
  color: #333333;
}

.feature-empty-sub {
  font-size: 24rpx;
  color: #999999;
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

/* ========== 就地评论输入层 ========== */
.weekly-composer-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.4);
  z-index: 99;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.3s ease;
}

.weekly-composer-overlay.show {
  opacity: 1;
  pointer-events: auto;
}

.weekly-composer-area {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: #ffffff;
  z-index: 100;
  padding-bottom: constant(safe-area-inset-bottom);
  padding-bottom: env(safe-area-inset-bottom, 0px);
}

.weekly-composer-box {
  padding: 20rpx 30rpx;
  display: flex;
  flex-direction: column;
  border-top: 1rpx solid #f0f0f0;
}

.weekly-composer-reply-prompt {
  display: flex;
  justify-content: flex-start;
  align-items: center;
  margin-bottom: 12rpx;
  padding: 0 10rpx;
}

.weekly-composer-reply-prompt-text {
  font-size: 26rpx;
  color: #666666;
}

.weekly-composer-cancel-reply {
  margin-left: 16rpx;
}

.weekly-composer-cancel-text {
  font-size: 26rpx;
  color: #9ed7ee;
}

.weekly-composer-textarea {
  width: 100%;
  min-height: 90px;
  padding: 20rpx 24rpx;
  background-color: #f6f7f9;
  color: #111111;
  border-radius: 16rpx;
  font-size: 30rpx;
  line-height: 1.6;
  box-sizing: border-box;
  border: none;
  overflow-y: auto;
  outline: none;
  resize: none;
  display: block;
}

.weekly-composer-images {
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx;
  margin-top: 16rpx;
}

.weekly-composer-image-item {
  position: relative;
  width: 140rpx;
  height: 140rpx;
  border-radius: 12rpx;
  overflow: hidden;
}

.weekly-composer-image-thumb {
  width: 100%;
  height: 100%;
  display: block;
  background-color: #f2f2f2;
}

.weekly-composer-remove-btn {
  position: absolute;
  top: 6rpx;
  right: 6rpx;
  width: 36rpx;
  height: 36rpx;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.55);
  color: #ffffff;
  font-size: 22rpx;
  display: flex;
  align-items: center;
  justify-content: center;
}

.weekly-composer-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 16rpx;
  width: 100%;
}

.weekly-composer-action-icons {
  display: flex;
  gap: 24rpx;
}

.weekly-composer-action-icon {
  width: 72rpx;
  height: 72rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: #f0f0f0;
}

.weekly-composer-action-icon:active {
  transform: scale(0.92);
}

.weekly-composer-action-icon-image {
  width: 44rpx;
  height: 44rpx;
}

.weekly-composer-submit {
  width: 72rpx;
  height: 72rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: opacity 0.2s ease;
}

.weekly-composer-submit.disabled {
  opacity: 0.45;
}

.weekly-composer-submit-icon {
  width: 72rpx;
  height: 72rpx;
  display: block;
}
</style>
