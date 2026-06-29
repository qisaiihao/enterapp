<template>
  <view class="ranking-page" :style="pageInlineStyle">
    <view class="ranking-header">
      <view class="back-btn" @tap="goBack">
        <image class="back-icon" src="/static/images/left_exit.png" mode="aspectFit"></image>
      </view>
      <text class="ranking-title">本周热榜</text>
    </view>

    <view class="ranking-list">
      <activity-poem-card
        v-for="(item, index) in rankingItems"
        :key="item._id || item.postId || index"
        class="ranking-poem-card"
        :item="item"
        :index="index"
        :collapsed-max-lines="3"
        @longpress="goPostDetail(item)"
      />
    </view>
  </view>
</template>

<script>
import { getSystemInfoCompat } from '@/utils/system-info.js';
import { getWeeklyRanking } from '@/api-cache/weekly.js';
import ActivityPoemCard from '@/components/activity/ActivityPoemCard.vue';
import { attachPoemDisplayFields } from '@/utils/poemDisplay.js';

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
        likeIcon: item.likeIcon || '/static/images/seed.png',
        isVoted: item.isVoted === true
      });

      return normalized;
    })
    .filter(item => item && item._id);
}

export default {
  components: {
    ActivityPoemCard
  },
  data() {
    return {
      pageInlineStyle: {},
      rankingItems: normalizeRankingItems(FALLBACK_RANKING)
    };
  },
  onLoad() {
    this.setupHeaderLayout();
    this.loadRanking();
  },
  methods: {
    async loadRanking() {
      const result = await getWeeklyRanking({ context: this, forceRefresh: true });
      const rankingItems = Array.isArray(result.rankingItems) ? result.rankingItems : [];
      if (!rankingItems.length) return;
      this.rankingItems = normalizeRankingItems(rankingItems);
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
  padding: 16rpx 20rpx 54rpx;
  box-sizing: border-box;
}
</style>
