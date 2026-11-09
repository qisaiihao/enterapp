<template>
  <view :class="{ 'society-works--feed': feed }">
    <PoemStack v-if="stacked && items.length" variant="society" :items="items" :current="currentIndex" :card-style="cardStyle" @shift="shift" @select="detail">
      <template #front="{ card }">
        <SocietyStackFront :card="card" :avatar="avatar(card)" :text-color="cardTextColor(card)" @author="author" />
      </template>
    </PoemStack>
    <template v-else-if="feed">
      <PostItem
        v-for="(item, index) in feedItems"
        :key="item._id"
        :item="item"
        :index="index"
        list-type="society"
        :show-poem-author="false"
        :show-vote-section="true"
        @navigate-to-user="feedAuthor"
        @comment-click="feedComment"
        @vote="vote"
        @preview-image="previewImage"
      />
    </template>
    <template v-else>
      <view v-for="item in items" :key="item._id" class="society-work">
        <view class="work-author" @tap="author(item)"><image :src="avatar(item)" mode="aspectFill" /><text>{{ item.authorName || '诗友' }}</text><text class="work-date">{{ date(item.societyPublishedAt || item.createTime) }}</text></view>
        <poem-card :post="item" show-signature @card-tap="detail(item)" @comment="detail(item)" @vote="detail(item)" />
      </view>
    </template>
  </view>
</template>
<script>
import PoemCard from '@/components/poem/PoemCard.vue';
import PoemStack from '@/components/poem/PoemStack.vue';
import PostItem from '@/components/PostItem.vue';
import SocietyStackFront from '@/pages-community/components/society/SocietyStackFront.vue';
import { openSocietyPage, societyDate } from '@/pages-community/utils/society.js';
import { navigateToPostDetail } from '@/utils/navigation.js';
import { resolvePostAuthorAvatar } from '@/utils/defaultAvatar.js';
import { getReadableTextColor, getThemedCardBackgroundColor } from '@/utils/uiHelpers.js';
import { processPostListSync } from '@/utils/postProcessor.js';
import { togglePostLike } from '@/utils/likeService.js';
import likeStatusCache from '@/cache/stores/like-status.js';
import likeIcon from '@/utils/likeIcon.js';
export default {
  components: { PoemCard, PoemStack, PostItem, SocietyStackFront },
  props: {
    items: { type: Array, default: () => [] },
    societyId: { type: String, default: '' },
    stacked: { type: Boolean, default: false },
    feed: { type: Boolean, default: false }
  },
  data: () => ({ currentIndex: 0, voteOverrides: {}, voting: {} }),
  computed: {
    feedItems() {
      return processPostListSync(this.items, { useCachedLikeStatus: true }).map(item => {
        const override = this.voteOverrides[item._id];
        return override ? { ...item, ...override, likeIcon: likeIcon.getLikeIcon(override.votes, override.isVoted) } : item;
      });
    }
  },
  watch: {
    items: {
      immediate: true,
      handler(items) {
        likeStatusCache.preloadFromPosts(items);
        if (this.currentIndex >= items.length) this.currentIndex = 0;
        this.voteOverrides = {};
      }
    }
  },
  methods: {
    date: societyDate,
    detail(item) { if (item?._id) navigateToPostDetail(item._id); },
    author(item) { if (item && !item.isAnonymous && item._openid) openSocietyPage('profile', { id: item.societyId || this.societyId, userId: item._openid }); },
    feedAuthor({ userId, isAnonymous }) { if (userId && !isAnonymous) openSocietyPage('profile', { id: this.societyId, userId }); },
    feedComment({ postId }) { if (postId) navigateToPostDetail(postId); },
    previewImage({ src, urls }) { if (src && Array.isArray(urls) && urls.length) uni.previewImage({ current: src, urls }); },
    async vote({ postId }) {
      const item = this.feedItems.find(row => row._id === postId);
      if (!item || this.voting[postId]) return;
      const originalVotes = Number(item.votes) || 0;
      const originalIsVoted = !!item.isVoted;
      this.voting = { ...this.voting, [postId]: true };
      this.voteOverrides = { ...this.voteOverrides, [postId]: {
        votes: originalIsVoted ? Math.max(0, originalVotes - 1) : originalVotes + 1,
        isVoted: !originalIsVoted
      } };
      try {
        const result = await togglePostLike(postId, { pageTag: 'society-works', context: this, currentVotes: originalVotes, currentIsLiked: originalIsVoted });
        this.voteOverrides = { ...this.voteOverrides, [postId]: result.success
          ? { votes: result.votes, isVoted: result.isLiked }
          : { votes: originalVotes, isVoted: originalIsVoted } };
      } catch (_) {
        this.voteOverrides = { ...this.voteOverrides, [postId]: { votes: originalVotes, isVoted: originalIsVoted } };
      } finally {
        this.voting = { ...this.voting, [postId]: false };
      }
    },
    avatar(item) { return resolvePostAuthorAvatar(item || {}); },
    shift(step) { if (this.items.length > 1) this.currentIndex = (this.currentIndex + step + this.items.length) % this.items.length; },
    cardBackground(card) { return getThemedCardBackgroundColor(card.backgroundColor || '#f1d5bf', this.appThemeMode); },
    cardTextColor(card) { return getReadableTextColor(this.cardBackground(card), card.textColor || '#fff'); },
    cardStyle(card) { return { backgroundColor: this.cardBackground(card) }; }
  }
};
</script>
<style scoped>
.society-works--feed { margin: 0 -36rpx; }
.society-work { margin-bottom: 32rpx; }
.work-author { display: flex; align-items: center; gap: 12rpx; margin-bottom: 16rpx; font-size: 24rpx; color: var(--app-secondary-text, #7c6f68); }
.work-author image { width: 40rpx; height: 40rpx; border-radius: 50%; }
.work-date { color: var(--app-muted-text, #a99c91); font-size: 20rpx; }
.work-author .work-date { margin-left: auto; }
</style>
