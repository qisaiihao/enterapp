<template>
  <view class="ranking-page" :style="[pageInlineStyle, readFontVars]">
    <view class="ranking-header">
      <view class="back-btn" @tap="goBack">
        <image class="back-icon" src="/static/images/left_exit.png" mode="aspectFit"></image>
      </view>
      <text class="ranking-title">本周热榜</text>
    </view>

    <view class="ranking-list">
      <poem-card
        v-for="(item, index) in rankingItems"
        :key="item._id || item.postId || index"
        class="ranking-poem-card"
        :post="item"
        :index="index"
        @card-tap="toggleCardExpansion"
        @vote="onVote"
        @comment="onCommentClick"
        @longpress="goPostDetail(item)"
      />
    </view>
  </view>
</template>

<script>
import { getSystemInfoCompat } from '@/utils/system-info.js';
import { getWeeklyRanking } from '@/api-cache/weekly.js';
import PoemCard from '@/components/poem/PoemCard.vue';
import { attachPoemDisplayFields } from '@/utils/poemDisplay.js';
import likeIcon from '@/utils/likeIcon.js';
import { togglePostLike } from '@/utils/likeService.js';
import { syncLikeStatusForPosts, getLatestLikeStatus } from '@/utils/likeStatusSync.js';
import { isUserLoggedIn, requireLogin } from '@/utils/authHelper.js';
import { navigateToPostDetail } from '@/utils/navigation.js';
import { toggleArrayItemExpansion } from '@/utils/uiHelpers.js';

const CARD_COLORS = ['#ae7476', '#9fa599', '#e4eeee', '#a4c4bd', '#c9cfcf', '#906161', '#909388'];
const CARD_TEXT_COLORS = ['#ffffff', '#ffffff', '#111111', '#111111', '#111111', '#ffffff', '#ffffff'];
const FALLBACK_RANKING = [
  {
    postId: 'rank-1',
    content: '当我听到河哗哗作响\n岸上的声音自然就隐去了\n我转身消入河水\n想趁分流前，牵住你的手',
    authorName: 'Noah'
  },
  { postId: 'rank-2', content: '一扇没开的门\n一次偶然的相遇', authorName: '白告' },
  { postId: 'rank-3', content: '雨落在窗台\n像一封没有寄出的信', authorName: 'Noah' }
];

function normalizeRankingItems(items = []) {
  return (Array.isArray(items) ? items : [])
    .map((item = {}, index) => {
      const backgroundColor = item.backgroundColor || CARD_COLORS[index % CARD_COLORS.length];
      const fallbackTextColor = CARD_TEXT_COLORS[index % CARD_TEXT_COLORS.length];
      const content = item.content || item.copy || item.title || '诗歌内容待发布';
      const normalized = attachPoemDisplayFields({
        ...item,
        _id: item.postId || item._id || item.id || `rank-${index + 1}`,
        postId: item.postId || item._id || item.id || '',
        title: item.title || '',
        content,
        isPoem: true,
        isOriginal: true,
        isAnonymous: item.isAnonymous === true,
        authorName: item.authorName || item.author || '匿名',
        author: item.author || item.authorName || '',
        authorSignature: item.authorSignature || '',
        backgroundColor,
        textColor: item.textColor || fallbackTextColor,
        votes: Number(item.votes) || 0,
        commentCount: Number(item.commentCount || item.comments) || 0,
        likeIcon: item.likeIcon || likeIcon.getLikeIcon(Number(item.votes) || 0, item.isVoted === true),
        isVoted: item.isVoted === true
      });

      return normalized;
    })
    .filter(item => item && item._id);
}

export default {
  components: {
    PoemCard
  },
  data() {
    return {
      pageInlineStyle: {},
      rankingItems: normalizeRankingItems(FALLBACK_RANKING),
      votingInProgress: {}
    };
  },
  onLoad() {
    this.setupHeaderLayout();
    this.loadRanking();
    this.bindGlobalLikeEvents();
  },
  onShow() {
    this.syncLikeStatusFromCache();
  },
  onUnload() {
    this.unbindGlobalLikeEvents();
  },
  methods: {
    async loadRanking() {
      const result = await getWeeklyRanking({ context: this, forceRefresh: true });
      const rankingItems = Array.isArray(result.rankingItems) ? result.rankingItems : [];
      if (!rankingItems.length) return;
      this.rankingItems = normalizeRankingItems(rankingItems);
      this.syncLikeStatusFromCache();
    },

    onCommentClick(payload = {}) {
      if (payload && payload.postId) {
        navigateToPostDetail(payload.postId);
      }
    },

    toggleCardExpansion(payload = {}) {
      const index = Number(payload && payload.index);
      if (!Number.isFinite(index) || index < 0 || index >= this.rankingItems.length) return;
      this.rankingItems = toggleArrayItemExpansion(this.rankingItems, index);
    },

    async onVote(payload = {}) {
      const postId = payload && payload.postId;
      const index = Number(payload && payload.index);
      if (!postId) return;
      if (!isUserLoggedIn()) {
        requireLogin({ content: '点赞需要登录，请先登录' });
        return;
      }
      if (this.votingInProgress[postId]) return;

      const item = this.rankingItems[index];
      if (!item || (item._id !== postId && item.postId !== postId)) return;
      const originalVotes = Number(item.votes) || 0;
      const wasVoted = !!item.isVoted;

      const optimisticVotes = wasVoted ? Math.max(0, originalVotes - 1) : originalVotes + 1;
      this.setItemLike(index, {
        votes: optimisticVotes,
        isVoted: !wasVoted,
        likeIcon: likeIcon.getLikeIcon(optimisticVotes, !wasVoted)
      });
      this.votingInProgress = { ...this.votingInProgress, [postId]: true };

      try {
        const result = await togglePostLike(postId, {
          pageTag: 'weekly-ranking',
          context: this,
          currentVotes: originalVotes,
          currentIsLiked: wasVoted,
          requireAuth: true
        });
        if (result && result.success) {
          this.setItemLike(index, {
            votes: result.votes,
            isVoted: result.isLiked,
            likeIcon: result.likeIcon
          });
          return;
        }
        const rollback = (result && result.rollback) || { votes: originalVotes, isLiked: wasVoted };
        this.setItemLike(index, {
          votes: rollback.votes,
          isVoted: rollback.isLiked,
          likeIcon: likeIcon.getLikeIcon(rollback.votes, rollback.isLiked)
        });
        uni.showToast({ title: (result && result.message) || '点赞失败', icon: 'none' });
      } catch (error) {
        this.setItemLike(index, {
          votes: originalVotes,
          isVoted: wasVoted,
          likeIcon: likeIcon.getLikeIcon(originalVotes, wasVoted)
        });
        uni.showToast({ title: '操作失败', icon: 'none' });
      } finally {
        this.votingInProgress = { ...this.votingInProgress, [postId]: false };
      }
    },

    setItemLike(index, { votes, isVoted, likeIcon: icon }) {
      const list = this.rankingItems.slice();
      const item = list[index];
      if (!item) return;
      list[index] = {
        ...item,
        votes: Math.max(0, Number(votes) || 0),
        isVoted: !!isVoted,
        likeIcon: icon
      };
      this.rankingItems = list;
    },

    onGlobalLikeChanged(payload = {}) {
      const postId = payload && payload.postId;
      if (!postId) return;
      const index = this.rankingItems.findIndex(item => item && (item._id === postId || item.postId === postId));
      if (index < 0) return;
      const votes = typeof payload.votes === 'number' ? payload.votes : (this.rankingItems[index].votes || 0);
      const isVoted = typeof payload.isLiked === 'boolean' ? payload.isLiked : !!this.rankingItems[index].isVoted;
      this.setItemLike(index, {
        votes,
        isVoted,
        likeIcon: likeIcon.getLikeIcon(votes, isVoted)
      });
    },

    bindGlobalLikeEvents() {
      if (this._weeklyRankingLikeHandler) return;
      this._weeklyRankingLikeHandler = this.onGlobalLikeChanged;
      try {
        if (typeof uni !== 'undefined' && typeof uni.$on === 'function') {
          uni.$on('like-changed', this._weeklyRankingLikeHandler);
        }
      } catch (_) {}
    },

    unbindGlobalLikeEvents() {
      if (!this._weeklyRankingLikeHandler) return;
      try {
        if (typeof uni !== 'undefined' && typeof uni.$off === 'function') {
          uni.$off('like-changed', this._weeklyRankingLikeHandler);
        }
      } catch (_) {}
      this._weeklyRankingLikeHandler = null;
    },

    syncLikeStatusFromCache() {
      try {
        const list = Array.isArray(this.rankingItems) ? this.rankingItems : [];
        const ids = list.map(p => p && (p._id || p.postId)).filter(Boolean);
        if (!ids.length) return;
        try { syncLikeStatusForPosts(ids); } catch (_) {}
        let changed = false;
        const next = list.slice();
        for (let i = 0; i < next.length; i += 1) {
          const p = next[i];
          if (!p) continue;
          const id = p._id || p.postId;
          const s = getLatestLikeStatus(id);
          if (s && ((Number(p.votes) || 0) !== s.votes || !!p.isVoted !== !!s.isVoted)) {
            next[i] = {
              ...p,
              votes: s.votes,
              isVoted: s.isVoted,
              likeIcon: likeIcon.getLikeIcon(s.votes, s.isVoted)
            };
            changed = true;
          }
        }
        if (changed) this.rankingItems = next;
      } catch (error) {
        console.warn('[weekly-ranking] syncLikeStatusFromCache failed:', error);
      }
    },

    setupHeaderLayout() {
      try {
        const systemInfo = getSystemInfoCompat();
        const safeAreaTop = (systemInfo.safeAreaInsets && systemInfo.safeAreaInsets.top) || systemInfo.statusBarHeight || 0;
        if (safeAreaTop > 0) {
          this.pageInlineStyle = { '--ranking-safe-area-top': `${safeAreaTop}px` };
        }
      } catch (error) {
        console.warn('[weekly-ranking] setup header layout failed:', error);
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
      uni.navigateTo({ url: '/pages-content/weekly-home/weekly-home' });
    },

    goPostDetail(item) {
      const postId = item && (item.postId || item._id) ? (item.postId || item._id) : '';
      if (!postId || postId.startsWith('rank-')) return;
      uni.navigateTo({ url: `/pages/post-detail/post-detail?id=${encodeURIComponent(postId)}` });
    }
  }
};
</script>

<style scoped>
.ranking-page {
  min-height: 100vh;
  box-sizing: border-box;
  background: #ffffff;
  color: #111111;
}

.ranking-header {
  position: relative;
  height: calc(var(--ranking-safe-area-top, 0px) + 132rpx);
  padding-top: var(--ranking-safe-area-top, 0px);
  box-sizing: border-box;
  background: #ffffff;
}

.back-btn {
  position: absolute;
  left: 34rpx;
  bottom: 30rpx;
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

.ranking-title {
  position: absolute;
  left: 128rpx;
  right: 128rpx;
  bottom: 34rpx;
  color: #111111;
  font-size: 32rpx;
  line-height: 44rpx;
  font-weight: 700;
  text-align: center;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ranking-list {
  padding: 16rpx 100rpx 54rpx;
  box-sizing: border-box;
}
</style>
