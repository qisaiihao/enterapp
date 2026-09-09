<template>
  <view class="weekly-action-row">
    <view class="weekly-action-item" @tap.stop="emitLike">
      <image
        class="weekly-action-icon"
        :class="[
          'weekly-like-icon',
          getLikeIconVariantClass(likeIconSrc),
          isVoted ? 'like-icon--voted' : ''
        ]"
        :src="likeIconSrc"
        mode="aspectFit"
      ></image>
    </view>

    <view class="weekly-action-item" @tap.stop="emitFavorite">
      <image
        class="weekly-action-icon"
        src="/static/images/newicons/collection.png"
        mode="aspectFit"
      ></image>
    </view>

    <view class="weekly-action-item" @tap.stop="emitSave">
      <image
        class="weekly-action-icon weekly-download-icon"
        src="/static/images/newicons/save_share.png"
        mode="aspectFit"
      ></image>
    </view>

    <view class="weekly-action-item" @tap.stop="emitComment">
      <image
        class="weekly-action-icon weekly-comment-icon"
        src="/static/images/newicons/comment.png"
        mode="aspectFit"
      ></image>
    </view>
  </view>
</template>

<script>
export default {
  name: 'WeeklyFeatureActionBar',
  props: {
    likeIconSrc: {
      type: String,
      default: '/static/images/seed.png'
    },
    isVoted: {
      type: Boolean,
      default: false
    }
  },
  emits: ['like', 'favorite', 'save', 'comment'],
  methods: {
    emitLike() {
      this.$emit('like');
    },
    emitSave() {
      this.$emit('save');
    },
    emitFavorite() {
      this.$emit('favorite');
    },
    emitComment() {
      this.$emit('comment');
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
.weekly-action-row {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  padding: 10rpx 58rpx;
  padding-bottom: calc(20rpx + env(safe-area-inset-bottom, 0px));
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  background-color: #ffffff;
  border: none;
  box-shadow: none;
  z-index: 50;
}

.weekly-action-item {
  width: 80rpx;
  height: 80rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 12rpx;
}

.weekly-action-item:active .weekly-action-icon {
  transform: scale(0.92);
  opacity: 0.9;
}

.weekly-action-icon {
  width: 64rpx;
  height: 64rpx;
  display: block;
  transition: transform 0.2s ease, opacity 0.2s ease;
}

.weekly-like-icon {
  filter: none;
  opacity: 1;
}

.weekly-download-icon {
  filter: none;
  opacity: 1;
}

.weekly-comment-icon {
  filter: none;
  opacity: 1;
}

/* 与诗卡列表一致的点赞分级图标：未点赞的基础图标保持原色 */
.weekly-like-icon.like-icon--voted,
.weekly-like-icon.like-icon--seed:not(.like-icon--voted),
.weekly-like-icon.like-icon--leaf:not(.like-icon--voted),
.weekly-like-icon.like-icon--flower:not(.like-icon--voted),
.weekly-like-icon.like-icon--peach:not(.like-icon--voted) {
  filter: none;
  opacity: 1;
}
</style>
