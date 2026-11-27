<template>
  <view class="activity-notice-carousel" :class="{ 'activity-notice-carousel--two-up': isTwoUp, 'activity-notice-carousel--wide-single': isWideLayout && !isTwoUp }">
    <view class="notice-viewport" :class="{ 'notice-viewport--two-up': isTwoUp }">
      <swiper
        :key="'notice-swiper-' + displayCount"
        class="notice-swiper"
        :current="safeCurrentIndex"
        :display-multiple-items="displayCount"
        :autoplay="canLoop"
        :interval="4200"
        :duration="450"
        :circular="canLoop"
        @change="handleChange"
      >
        <swiper-item
          v-for="notice in safeNotices"
          :key="notice.value"
          class="notice-swiper-item"
        >
          <view class="notice-slide-slot">
            <view :class="['notice-card', notice.tone || 'default', { 'is-linked': !!notice.linkUrl, 'has-image': !!notice.image }]" @tap="handleSelect(notice)">
              <image
                v-if="notice.image"
                class="notice-image"
                :src="notice.image"
                mode="aspectFill"
                :lazy-load="true"
                @error="onImageError(notice)"
              />
              <template v-else>
                <view class="notice-copy">
                  <text class="notice-kicker">{{ notice.kicker }}</text>
                  <text class="notice-title">{{ notice.title }}</text>
                  <text class="notice-summary">{{ notice.summary }}</text>
                </view>
                <view class="notice-art">
                  <text class="notice-art-mark">{{ notice.mark }}</text>
                </view>
              </template>
            </view>
          </view>
        </swiper-item>
      </swiper>
    </view>

    <view v-if="canLoop" class="notice-dots" aria-hidden="true">
      <view
        v-for="(notice, index) in safeNotices"
        :key="`${notice.value}-dot`"
        :class="['notice-dot', safeCurrentIndex === index ? 'active' : '']"
      ></view>
    </view>
  </view>
</template>

<script>
import { normalizeActivityNoticeLink } from '@/utils/activityNoticeLink.js';

export default {
  name: 'ActivityNoticeCarousel',
  emits: ['select'],
  props: {
    notices: {
      type: Array,
      default: () => []
    }
  },
  data() {
    return {
      activeIndex: 0,
      failedImages: {}
    };
  },
  computed: {
    safeNotices() {
      return (Array.isArray(this.notices) ? this.notices : [])
        .filter(item => item && item.value && item.title)
        .map(item => {
          const base = {
            kicker: '公告',
            summary: '',
            mark: '',
            tone: 'default',
            image: '',
            ...item
          };
          base.linkUrl = normalizeActivityNoticeLink(item.linkUrl);
          if (base.image && this.failedImages[item.value]) {
            base.image = '';
          }
          return base;
        });
    },
    isTwoUp() {
      return !!(this.isWideLayout && this.safeNotices.length >= 2);
    },
    displayCount() {
      return this.isTwoUp ? 2 : 1;
    },
    canLoop() {
      return this.safeNotices.length > this.displayCount;
    },
    safeCurrentIndex() {
      const len = this.safeNotices.length;
      if (len <= 0) return 0;
      const maxIndex = this.canLoop ? len - 1 : Math.max(0, len - this.displayCount);
      return Math.min(Math.max(0, this.activeIndex), maxIndex);
    }
  },
  methods: {
    handleSelect(notice) {
      if (notice && notice.linkUrl) this.$emit('select', notice);
    },
    handleChange(event) {
      const current = event && event.detail ? Number(event.detail.current) : 0;
      this.activeIndex = Number.isFinite(current) ? current : 0;
    },
    onImageError(notice) {
      if (!notice || !notice.value) return;
      this.failedImages = {
        ...this.failedImages,
        [notice.value]: true
      };
    }
  }
};
</script>

<style scoped>
.activity-notice-carousel {
  padding: 28rpx 24rpx 0;
  box-sizing: border-box;
}

.notice-viewport {
  position: relative;
  width: 100%;
  padding-top: 56.25%;
}

.notice-viewport--two-up {
  padding-top: 28.125%;
}

.activity-notice-carousel--two-up {
  padding: 16px 12px 0;
}

.activity-notice-carousel--wide-single .notice-viewport {
  max-width: 560px;
  margin: 0 auto;
  padding-top: min(56.25%, 315px);
}

.notice-swiper {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
}

.notice-swiper-item {
  height: 100%;
  box-sizing: border-box;
}

.notice-slide-slot {
  width: 100%;
  height: 100%;
  box-sizing: border-box;
}

.activity-notice-carousel--two-up .notice-slide-slot {
  padding: 0 8px;
}

.activity-notice-carousel--two-up .notice-card {
  border-radius: 12px;
}

.notice-card {
  position: relative;
  height: 100%;
  overflow: hidden;
  border-radius: 8rpx;
  background: #efe7d6;
  box-sizing: border-box;
}

.notice-card:not(.has-image)::before {
  content: '';
  position: absolute;
  inset: 0;
  background:
    linear-gradient(115deg, rgba(255, 255, 255, 0.18) 0 26%, transparent 26% 100%),
    linear-gradient(90deg, rgba(255, 255, 255, 0.34), rgba(255, 255, 255, 0));
  pointer-events: none;
}

.notice-card.is-linked {
  cursor: pointer;
}

.notice-card.is-linked:active {
  opacity: 0.88;
}

.notice-card:not(.has-image)::after {
  content: '';
  position: absolute;
  right: -50rpx;
  top: -58rpx;
  width: 420rpx;
  height: 400rpx;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.36);
}

.notice-card.weekly {
  background: #dbe8df;
}

.notice-card.cooperation {
  background: #e9dfd4;
}

.notice-card.market {
  background: #dde5ee;
}

.notice-image {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: #efe7d6;
}

.notice-copy {
  position: relative;
  z-index: 2;
  width: 68%;
  height: 100%;
  display: flex;
  flex-direction: column;
  justify-content: center;
  padding: 38rpx 0 38rpx 42rpx;
  box-sizing: border-box;
}

.notice-kicker {
  display: block;
  margin-bottom: 16rpx;
  color: #3b6f48;
  font-size: 28rpx;
  line-height: 36rpx;
  font-weight: 600;
}

.notice-title {
  display: block;
  color: #111111;
  font-size: 56rpx;
  line-height: 68rpx;
  font-weight: 700;
}

.notice-summary {
  display: block;
  margin-top: 18rpx;
  color: rgba(17, 17, 17, 0.72);
  font-size: 28rpx;
  line-height: 36rpx;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.notice-art {
  position: absolute;
  z-index: 2;
  right: 32rpx;
  top: 32rpx;
  bottom: 32rpx;
  width: 282rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 8rpx;
  background:
    repeating-linear-gradient(
      -30deg,
      rgba(255, 255, 255, 0.44) 0,
      rgba(255, 255, 255, 0.44) 2rpx,
      transparent 2rpx,
      transparent 34rpx
    ),
    rgba(255, 255, 255, 0.18);
}

.notice-art-mark {
  color: rgba(17, 17, 17, 0.66);
  font-size: 96rpx;
  line-height: 108rpx;
  font-weight: 700;
}

.notice-dots {
  height: 52rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 18rpx;
}

.notice-dot {
  width: 16rpx;
  height: 16rpx;
  border-radius: 50%;
  background: #e6e6e6;
  transition: background 0.2s ease, transform 0.2s ease;
}

.notice-dot.active {
  background: #cfcfcf;
  transform: scale(1.08);
}

@media (prefers-color-scheme: dark) {
  .notice-card {
    background: #d7d0c4;
  }
}
</style>
