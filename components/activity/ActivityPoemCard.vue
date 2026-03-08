<template>
  <view class="activity-poem-card" :style="{ backgroundColor: item.backgroundColor || '#a4c4bd' }">
    <view class="post-content-navigator" @tap="toggleExpanded">
      <view class="post-item">
        <view
          :class="'post-content ' + (expanded ? 'expanded' : 'collapsed') + (!expanded && (!safeHighlightLines || safeHighlightLines.length === 0) ? ' no-highlight' : '')"
          :style="{ color: item.textColor || '#222', whiteSpace: 'pre-wrap' }"
        >
          <block v-if="expanded">
            {{ item.content || '' }}
          </block>
          <block v-else>
            <block v-if="safeHighlightLines && safeHighlightLines.length > 0">
              <text
                v-for="(highlightLine, hlIndex) in safeHighlightLines"
                :key="hlIndex"
                style="font-weight: 700; display: block;"
              >
                {{ highlightLine }}
              </text>
            </block>
            <block v-else>
              {{ item.content || '' }}
            </block>
          </block>
        </view>

        <view v-if="expanded && item.authorSignature && !item.isAnonymous" class="user-signature">
          <image
            class="signature-image"
            :src="item.authorSignature"
            mode="aspectFit"
            @error="onSignatureError"
          />
        </view>
      </view>
    </view>

    <view class="vote-section" v-if="expanded" :style="{ backgroundColor: item.backgroundColor || '#a4c4bd' }">
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
</template>

<script>
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
      expanded: false
    };
  },
  computed: {
    safeHighlightLines() {
      return Array.isArray(this.item && this.item.highlightLines)
        ? this.item.highlightLines.filter(line => (line || '').trim())
        : [];
    }
  },
  watch: {
    'item._id': {
      immediate: false,
      handler() {
        this.expanded = false;
      }
    }
  },
  methods: {
    toggleExpanded() {
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
    onSignatureError(error) {
      this.$emit('signature-error', error);
    }
  }
};
</script>

<style scoped>
.activity-poem-card {
  width: calc(100% - 40rpx);
  margin: 24rpx 20rpx 0;
  border-radius: 28rpx;
  overflow: hidden;
  box-shadow: 0 8rpx 8rpx rgba(0, 0, 0, 0.2);
  transition: transform 0.25s ease;
}

.activity-poem-card:active {
  transform: scale(0.99);
}

.post-content-navigator {
  display: block;
}

.post-item {
  padding: 30rpx 60rpx 30rpx 80rpx;
  position: relative;
}

.post-content {
  font-family: '汇文明朝', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif;
  font-style: normal;
  font-weight: 500;
  font-size: 34rpx;
  line-height: 58rpx;
  letter-spacing: 0.08em;
  min-height: 140rpx;
}

.post-content.collapsed {
  max-height: 220rpx;
  overflow: hidden;
}

.post-content.no-highlight {
  font-weight: 500;
}

.post-content.expanded {
  max-height: none;
}

.user-signature {
  position: absolute;
  bottom: 0;
  right: 40rpx;
}

.signature-image {
  width: 180rpx;
  height: 90rpx;
  opacity: 0.8;
}

.vote-section {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 18rpx 36rpx 20rpx;
}

.actions-left {
  width: 1rpx;
  height: 1rpx;
}

.button-group {
  display: flex;
  align-items: center;
  gap: 24rpx;
}

.like-icon-container,
.comment-count {
  width: 56rpx;
  height: 56rpx;
  display: flex;
  align-items: center;
  justify-content: center;
}

.like-icon,
.comment-icon {
  width: 42rpx;
  height: 42rpx;
}
</style>
