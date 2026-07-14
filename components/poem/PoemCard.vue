<template>
  <view
    v-if="post"
    :class="['poem-card', isSeries && !seriesExpanded ? 'stacked-series-card' : '']"
    :style="{ backgroundColor: cardBackgroundColor }"
  >
    <view
      v-if="isSeries && !seriesExpanded"
      class="series-layer layer-1"
      :style="{ backgroundColor: cardBackgroundColor }"
    ></view>

    <block v-if="seriesExpanded && currentSeriesPoem">
      <view class="series-expanded-wrapper">
        <view
          class="series-single-card"
          :style="{ backgroundColor: cardBackgroundColor }"
          @tap="emitCardTap"
          @longpress="emitLongpress"
        >
          <view class="post-item">
            <view
              v-if="currentSeriesPoem.subtitle"
              class="series-subtitle"
              :style="{ color: cardTextColor }"
            >
              {{ currentSeriesPoem.subtitle }}
            </view>

            <view
              class="post-content expanded"
              :style="{ color: cardTextColor, whiteSpace: 'pre-wrap' }"
            >{{ currentSeriesPoem.content }}</view>

            <view v-if="canShowSignature" class="user-signature">
              <image
                class="signature-image"
                :src="post.authorSignature"
                mode="aspectFit"
                :webp="true"
                :show-menu-by-longpress="false"
                @error="emitSignatureError"
                @load="emitSignatureLoad"
              ></image>
            </view>
          </view>
        </view>

        <view class="series-page-indicator">
          {{ currentSeriesIndex + 1 }} / {{ seriesPoems.length }}
        </view>

        <view class="vote-section" :style="{ backgroundColor: cardBackgroundColor }">
          <view class="actions-left"></view>
          <view class="button-group">
            <view class="like-icon-container" @tap.stop.prevent="emitVote">
              <image
                :class="['like-icon', getLikeIconVariantClass(post.likeIcon), post.isVoted ? 'like-icon--voted' : '']"
                :src="post.likeIcon || '/static/images/seed.png'"
                mode="aspectFit"
              ></image>
            </view>
            <view class="comment-count" @tap.stop.prevent="emitComment">
              <image class="comment-icon" src="/static/images/newicons/comment.png" mode="aspectFit"></image>
            </view>
          </view>
        </view>
      </view>
    </block>

    <block v-if="!seriesExpanded">
      <view
        class="post-content-navigator"
        :class="{ 'has-vote-section': post.isExpanded && !isSeries }"
        :style="{ backgroundColor: cardBackgroundColor }"
        @tap="emitCardTap"
        @longpress="emitLongpress"
      >
        <view class="post-item">
          <view
            v-if="post.displayContent"
            :class="[
              'post-content',
              post.isExpanded ? 'expanded' : 'collapsed',
              !post.isExpanded && highlightLines.length === 0 ? 'no-highlight' : ''
            ]"
            :style="{ color: cardTextColor, whiteSpace: 'pre-wrap' }"
          ><block v-if="post.isExpanded">{{ post.displayContent }}</block><block v-else><block v-if="highlightLines.length > 0"><text
                  v-for="(highlightLine, highlightIndex) in highlightLines"
                  :key="highlightIndex"
                  class="highlight-line"
                >{{ highlightLine }}</text></block><block v-else>{{ post.displayContent }}</block></block></view>

          <view v-if="post.isExpanded && canShowSignature" class="user-signature">
            <image
              class="signature-image"
              :src="post.authorSignature"
              mode="aspectFit"
              :webp="true"
              :show-menu-by-longpress="false"
              @error="emitSignatureError"
              @load="emitSignatureLoad"
            ></image>
          </view>

          <view v-if="!post.isExpanded && canShowSignature" class="user-signature-small">
            <image
              class="signature-image-small"
              :src="post.authorSignature"
              mode="aspectFit"
              :webp="true"
              :show-menu-by-longpress="false"
              @error="emitSignatureError"
              @load="emitSignatureLoad"
            ></image>
          </view>
        </view>
      </view>

      <view
        v-if="post.isExpanded && !isSeries"
        class="vote-section"
        :style="{ backgroundColor: cardBackgroundColor }"
      >
        <view class="actions-left"></view>
        <view class="button-group">
          <view class="like-icon-container" @tap.stop.prevent="emitVote">
            <image
              :class="['like-icon', getLikeIconVariantClass(post.likeIcon), post.isVoted ? 'like-icon--voted' : '']"
              :src="post.likeIcon || '/static/images/seed.png'"
              mode="aspectFit"
            ></image>
          </view>
          <view class="comment-count" @tap.stop.prevent="emitComment">
            <image class="comment-icon" src="/static/images/newicons/comment.png" mode="aspectFit"></image>
          </view>
        </view>
      </view>
    </block>
  </view>
</template>

<script>
import { getReadableTextColor, getThemedCardBackgroundColor } from '@/utils/uiHelpers.js';

export default {
  name: 'PoemCard',
  emits: [
    'card-tap',
    'vote',
    'comment',
    'longpress',
    'signature-error',
    'signature-load'
  ],
  props: {
    post: {
      type: Object,
      required: true
    },
    index: {
      type: Number,
      default: 0
    },
    enableSeries: {
      type: Boolean,
      default: false
    },
    showSignature: {
      type: Boolean,
      default: false
    }
  },
  computed: {
    cardBackgroundColor() {
      return getThemedCardBackgroundColor(this.post.backgroundColor, this.appThemeMode);
    },
    cardTextColor() {
      return getReadableTextColor(this.cardBackgroundColor, this.post.textColor || '#222');
    },
    isSeries() {
      return this.enableSeries && !!this.post.isSeries;
    },
    seriesExpanded() {
      return this.isSeries && !!this.post.seriesExpanded;
    },
    seriesPoems() {
      return Array.isArray(this.post.seriesPoems) ? this.post.seriesPoems : [];
    },
    currentSeriesIndex() {
      const currentIndex = Number(this.post.currentSeriesIndex) || 0;
      return currentIndex >= 0 && currentIndex < this.seriesPoems.length ? currentIndex : 0;
    },
    currentSeriesPoem() {
      return this.seriesPoems[this.currentSeriesIndex] || null;
    },
    highlightLines() {
      return Array.isArray(this.post.displayHighlightLines) ? this.post.displayHighlightLines : [];
    },
    canShowSignature() {
      return this.showSignature && !this.post.isAnonymous && !!this.post.authorSignature;
    }
  },
  methods: {
    buildEventPayload() {
      return {
        postId: this.post && this.post._id,
        index: this.index
      };
    },
    emitCardTap() {
      this.$emit('card-tap', this.buildEventPayload());
    },
    emitVote() {
      this.$emit('vote', this.buildEventPayload());
    },
    emitComment() {
      this.$emit('comment', this.buildEventPayload());
    },
    emitLongpress() {
      this.$emit('longpress', this.buildEventPayload());
    },
    emitSignatureError(nativeEvent) {
      this.$emit('signature-error', {
        ...this.buildEventPayload(),
        signature: this.post.authorSignature || '',
        nativeEvent
      });
    },
    emitSignatureLoad(nativeEvent) {
      this.$emit('signature-load', {
        ...this.buildEventPayload(),
        signature: this.post.authorSignature || '',
        nativeEvent
      });
    },
    getLikeIconVariantClass(iconSrc) {
      const src = String(iconSrc || '/static/images/seed.png').toLowerCase();
      if (src.includes('seedplus.png')) return 'like-icon--seedplus';
      if (src.includes('seed.png')) return 'like-icon--seed';
      if (src.includes('leafplus.png')) return 'like-icon--leafplus';
      if (src.includes('leaf.png')) return 'like-icon--leaf';
      if (src.includes('flowerplus.png')) return 'like-icon--flowerplus';
      if (src.includes('flower.png')) return 'like-icon--flower';
      if (src.includes('peachplus.png')) return 'like-icon--peachplus';
      if (src.includes('peach.png')) return 'like-icon--peach';
      return '';
    }
  }
};
</script>

<style scoped>
.poem-card {
  width: 100%;
  border-radius: 30rpx;
  margin-bottom: 40rpx;
  overflow: visible;
  box-shadow: 0 8rpx 8rpx rgba(0, 0, 0, 0.25);
  transition: transform .3s ease;
  border: none;
  position: relative;
  padding: 0;
}

.poem-card:active { transform: scale(0.98); }

.post-content-navigator {
  display: block;
  border-radius: 30rpx;
  overflow: hidden;
}

.post-content-navigator.has-vote-section {
  border-radius: 30rpx 30rpx 0 0;
}

.post-item { padding: 26rpx 50rpx 26rpx 60rpx; position: relative; }

.stacked-series-card { position: relative; }

.series-layer.layer-1 {
  position: absolute;
  top: -12rpx;
  left: -12rpx;
  right: 12rpx;
  bottom: 12rpx;
  border-radius: 30rpx;
  box-shadow: 0 6rpx 12rpx rgba(0, 0, 0, 0.14);
  z-index: 1;
}

.stacked-series-card .post-content-navigator {
  position: relative;
  z-index: 2;
}

.series-expanded-wrapper {
  width: 100%;
  display: flex;
  flex-direction: column;
}

.series-single-card {
  position: relative;
  width: 100%;
  border-radius: 30rpx 30rpx 0 0;
  overflow: visible;
  min-height: auto;
}

.series-expanded-wrapper .vote-section { border-radius: 0 0 30rpx 30rpx; }
.series-single-card .post-item { padding: 60rpx 50rpx 60rpx 60rpx; }

.series-page-indicator {
  margin: 0 auto 10rpx;
  padding: 0;
  background: transparent;
  border: none;
  color: var(--app-secondary-text, #333);
  font-size: 24rpx;
  text-align: center;
  width: fit-content;
  align-self: center;
  font-weight: 500;
}

.post-content {
  font-family: 'Huiwen-mincho', '汇文明朝', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif;
  font-style: normal;
  font-weight: 500;
  font-size: 28rpx;
  line-height: 38rpx;
  margin: 30rpx 0;
  width: 100%;
  overflow-wrap: break-word;
}

.series-single-card .post-content { margin: 20rpx 0; }

.series-subtitle {
  font-family: 'Huiwen-mincho', '汇文明朝', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif;
  font-size: 24rpx;
  font-weight: 600;
  margin-bottom: 20rpx;
  opacity: 0.8;
}

.post-content.collapsed {
  overflow: hidden;
  text-overflow: ellipsis;
}

.post-content.collapsed.no-highlight {
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 3;
}

.post-content.expanded { display: block; overflow: visible; }

.highlight-line {
  display: block;
  font-weight: 700;
}

.vote-section {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 25rpx 50rpx;
  border-radius: 0 0 30rpx 30rpx;
}

.actions-left { flex: 1; display: flex; align-items: center; gap: 20rpx; }
.button-group { display: flex; align-items: center; gap: 30rpx; }
.like-icon-container { display: flex; align-items: center; justify-content: center; padding: 8rpx; }
.comment-count { display: flex; align-items: center; gap: 8rpx; padding: 10rpx 15rpx; color: var(--app-post-action-color, #999); }
.comment-icon { width: 60rpx; height: 60rpx; filter: var(--app-post-action-icon-filter, none); opacity: var(--app-post-action-icon-opacity, 1); }
.like-icon { width: 60rpx; height: 60rpx; margin-top: 5px; }
.like-icon--voted { filter: none; opacity: 1; }
.like-icon--seed:not(.like-icon--voted),
.like-icon--leaf:not(.like-icon--voted),
.like-icon--flower:not(.like-icon--voted),
.like-icon--peach:not(.like-icon--voted) {
  filter: none;
  opacity: 1;
}

.user-signature {
  position: absolute;
  bottom: 10rpx;
  right: 60rpx;
  z-index: 10;
  pointer-events: none;
}

.signature-image {
  width: 180rpx;
  height: 90rpx;
  opacity: 0.8;
  filter: drop-shadow(0 2rpx 4rpx rgba(0, 0, 0, 0.1));
  display: block;
  background: transparent;
  /* #ifdef MP-WEIXIN */
  image-rendering: -webkit-optimize-contrast;
  /* #endif */
}

.series-single-card .user-signature { bottom: 20rpx; }

.user-signature-small {
  position: absolute;
  bottom: 30rpx;
  right: 60rpx;
  z-index: 10;
  pointer-events: none;
}

.signature-image-small {
  width: 100rpx;
  height: 50rpx;
  opacity: 0.6;
  filter: drop-shadow(0 1rpx 2rpx rgba(0, 0, 0, 0.1));
  display: block;
  background: transparent;
  /* #ifdef MP-WEIXIN */
  image-rendering: -webkit-optimize-contrast;
  /* #endif */
}
</style>
