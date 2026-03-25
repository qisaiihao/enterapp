<template>
  <view
    :class="['activity-poem-card', isSeries && !seriesExpanded ? 'stacked-series-card' : '']"
    :style="{ backgroundColor: safeBackgroundColor }"
  >
    <view
      v-if="isSeries && !seriesExpanded"
      class="series-layer layer-1"
      :style="{ backgroundColor: safeBackgroundColor }"
    ></view>

    <block v-if="isSeries && seriesExpanded && currentSeriesPoem">
      <view class="series-expanded-wrapper">
        <view class="series-single-card" @tap="toggleCard" @longpress="onLongPress">
          <view class="post-content-navigator">
            <view class="post-item">
              <view
                v-if="currentSeriesPoem.subtitle"
                class="series-subtitle"
                :style="{ color: safeTextColor }"
              >
                {{ currentSeriesPoem.subtitle }}
              </view>

              <view class="post-content expanded" :style="{ color: safeTextColor, whiteSpace: 'pre-wrap' }">{{ currentSeriesPoem.content }}</view>

              <view v-if="showSignature" class="user-signature">
                <image
                  class="signature-image"
                  :src="item.authorSignature"
                  mode="aspectFit"
                  :webp="true"
                  :show-menu-by-longpress="false"
                  @error="onSignatureError"
                />
              </view>
            </view>
          </view>
        </view>

        <view class="series-page-indicator">
          {{ currentSeriesIndex + 1 }} / {{ seriesPoems.length }}
        </view>

        <view class="vote-section" :style="{ backgroundColor: safeBackgroundColor }">
          <view class="actions-left"></view>
          <view class="button-group">
            <view class="like-icon-container" @tap.stop.prevent="onVote">
              <image class="like-icon" :src="item.likeIcon || '/static/images/seed.png'" mode="aspectFit" />
            </view>
            <view class="comment-count" @tap.stop.prevent="onCommentClick">
              <image class="comment-icon" src="/static/images/newicons/comment.png" mode="aspectFit" />
            </view>
          </view>
        </view>
      </view>
    </block>

    <block v-else>
      <view
        class="post-content-navigator"
        :class="{ 'has-vote-section': expanded && !isSeries }"
        @tap="toggleCard"
        @longpress="onLongPress"
      >
        <view class="post-item">
          <view
            v-if="displayContent"
            :class="['post-content', expanded ? 'expanded' : 'collapsed', !expanded && safeHighlightLines.length === 0 ? 'no-highlight' : '']"
            :style="{ color: safeTextColor, whiteSpace: 'pre-wrap' }"
          ><block v-if="expanded">{{ displayContent }}</block><block v-else><block v-if="safeHighlightLines.length > 0"><text
                  v-for="(highlightLine, highlightIndex) in safeHighlightLines"
                  :key="highlightIndex"
                  class="highlight-line"
                >{{ highlightLine }}</text></block><block v-else>{{ displayContent }}</block></block></view>

          <view v-if="expanded && showSignature" class="user-signature">
            <image
              class="signature-image"
              :src="item.authorSignature"
              mode="aspectFit"
              :webp="true"
              :show-menu-by-longpress="false"
              @error="onSignatureError"
            />
          </view>

          <view v-if="!expanded && showSignature" class="user-signature-small">
            <image
              class="signature-image-small"
              :src="item.authorSignature"
              mode="aspectFit"
              :webp="true"
              :show-menu-by-longpress="false"
              @error="onSignatureError"
            />
          </view>
        </view>
      </view>

      <view
        v-if="expanded && !isSeries"
        class="vote-section"
        :style="{ backgroundColor: safeBackgroundColor }"
      >
        <view class="actions-left"></view>
        <view class="button-group">
          <view class="like-icon-container" @tap.stop.prevent="onVote">
            <image class="like-icon" :src="item.likeIcon || '/static/images/seed.png'" mode="aspectFit" />
          </view>
          <view class="comment-count" @tap.stop.prevent="onCommentClick">
            <image class="comment-icon" src="/static/images/newicons/comment.png" mode="aspectFit" />
          </view>
        </view>
      </view>
    </block>
  </view>
</template>

<script>
const {
  normalizePoemDisplayText,
  normalizePoemDisplayLines,
  normalizeSeriesBlocksForDisplay
} = require('@/utils/poemDisplay.js');

export default {
  name: 'ActivityPoemCard',
  props: {
    item: {
      type: Object,
      required: true
    },
    index: {
      type: Number,
      default: 0
    }
  },
  data() {
    return {
      expanded: false,
      seriesExpanded: false,
      currentSeriesIndex: 0,
      signatureHidden: false
    };
  },
  computed: {
    safeBackgroundColor() {
      return this.item && this.item.backgroundColor ? this.item.backgroundColor : '#a4c4bd';
    },
    safeTextColor() {
      return this.item && this.item.textColor ? this.item.textColor : '#222';
    },
    displayContent() {
      const raw = this.item && this.item.displayContent !== undefined
        ? this.item.displayContent
        : normalizePoemDisplayText(this.item && this.item.content ? this.item.content : '');
      return raw || '';
    },
    safeHighlightLines() {
      const rawLines = Array.isArray(this.item && this.item.displayHighlightLines)
        ? this.item.displayHighlightLines
        : normalizePoemDisplayLines(this.item && this.item.highlightLines);
      return rawLines.filter(line => (line || '').trim());
    },
    seriesPoems() {
      const rawSeries = Array.isArray(this.item && this.item.displaySeriesPoems) && this.item.displaySeriesPoems.length > 0
        ? this.item.displaySeriesPoems
        : normalizeSeriesBlocksForDisplay(
          Array.isArray(this.item && this.item.seriesPoems) && this.item.seriesPoems.length > 0
            ? this.item.seriesPoems
            : this.item && this.item.seriesBlocks
        );
      return rawSeries.filter(block => block && ((block.content || '').trim() || (block.subtitle || '').trim()));
    },
    isSeries() {
      return !!(this.item && (this.item.isSeries || this.seriesPoems.length > 0));
    },
    currentSeriesPoem() {
      if (!this.seriesPoems.length) return null;
      return this.seriesPoems[this.currentSeriesIndex] || this.seriesPoems[0];
    },
    showSignature() {
      return !!(
        this.item &&
        !this.item.isAnonymous &&
        this.item.authorSignature &&
        !this.signatureHidden
      );
    }
  },
  watch: {
    'item._id'() {
      this.resetState();
    },
    'item.authorSignature'() {
      this.signatureHidden = false;
    }
  },
  methods: {
    resetState() {
      this.expanded = false;
      this.seriesExpanded = false;
      this.currentSeriesIndex = 0;
      this.signatureHidden = false;
    },
    toggleCard() {
      if (this.isSeries) {
        if (!this.seriesExpanded) {
          this.seriesExpanded = true;
          return;
        }
        if (this.currentSeriesIndex < this.seriesPoems.length - 1) {
          this.currentSeriesIndex += 1;
          return;
        }
        this.seriesExpanded = false;
        this.currentSeriesIndex = 0;
        return;
      }
      this.expanded = !this.expanded;
    },
    onVote() {
      this.$emit('vote', {
        postId: this.item && this.item._id,
        index: this.index
      });
    },
    onCommentClick() {
      this.$emit('comment-click', {
        postId: this.item && this.item._id
      });
    },
    onLongPress() {
      this.$emit('longpress', {
        postId: this.item && this.item._id,
        index: this.index
      });
    },
    onSignatureError() {
      this.signatureHidden = true;
    }
  }
};
</script>

<style scoped>
.activity-poem-card {
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

.activity-poem-card:active { transform: scale(0.98); }

.post-content-navigator {
  display: block;
  border-radius: 30rpx;
  overflow: hidden;
}

.post-content-navigator.has-vote-section {
  border-radius: 30rpx 30rpx 0 0;
}

.post-item { padding: 26rpx 50rpx 26rpx 60rpx; position: relative; }

.stacked-series-card {
  position: relative;
}

.series-layer.layer-1 {
  position: absolute;
  top: -12rpx;
  left: -12rpx;
  right: 12rpx;
  bottom: 12rpx;
  border-radius: 30rpx;
  box-shadow: 0 6rpx 12rpx rgba(0,0,0,0.14);
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

.series-single-card .post-content-navigator {
  border-radius: 30rpx 30rpx 0 0;
}

.series-expanded-wrapper .vote-section {
  border-radius: 0 0 30rpx 30rpx;
}

.series-single-card .post-item {
  padding: 60rpx 50rpx 60rpx 60rpx;
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

.series-single-card .post-content {
  margin: 20rpx 0 20rpx 0;
}

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

.vote-section {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 25rpx 50rpx;
  border-radius: 0 0 30rpx 30rpx;
}

.actions-left { flex: 1; display: flex; align-items: center; gap: 20rpx; }
.button-group { display: flex; align-items: center; gap: 30rpx; }
.comment-count,
.like-icon-container { display: flex; align-items: center; gap: 8rpx; padding: 10rpx 15rpx; }
.comment-icon,
.like-icon { width: 60rpx; height: 60rpx; }
.like-icon { margin-top: 5px; }

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
}

.series-single-card .user-signature {
  bottom: 20rpx;
}

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
}

.series-page-indicator {
  margin: 0 auto 10rpx;
  padding: 0;
  background: transparent;
  border: none;
  color: #333;
  font-size: 24rpx;
  text-align: center;
  width: fit-content;
  align-self: center;
  font-weight: 500;
}

.highlight-line {
  display: block;
  font-family: 'Huiwen-mincho', '汇文明朝', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif;
  font-style: normal;
  font-weight: 500;
  font-size: 28rpx;
  line-height: 38rpx;
}
</style>
