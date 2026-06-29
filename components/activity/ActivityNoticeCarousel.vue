<template>
  <view class="activity-notice-carousel">
    <swiper
      class="notice-swiper"
      :current="activeIndex"
      :autoplay="true"
      :interval="4200"
      :duration="450"
      :circular="true"
      @change="handleChange"
    >
      <swiper-item
        v-for="notice in safeNotices"
        :key="notice.value"
      >
        <view :class="['notice-card', notice.tone || 'default']">
          <view class="notice-copy">
            <text class="notice-kicker">{{ notice.kicker }}</text>
            <text class="notice-title">{{ notice.title }}</text>
            <text class="notice-summary">{{ notice.summary }}</text>
          </view>
          <view class="notice-art">
            <text class="notice-art-mark">{{ notice.mark }}</text>
          </view>
        </view>
      </swiper-item>
    </swiper>

    <view class="notice-dots" aria-hidden="true">
      <view
        v-for="(notice, index) in safeNotices"
        :key="`${notice.value}-dot`"
        :class="['notice-dot', activeIndex === index ? 'active' : '']"
      ></view>
    </view>
  </view>
</template>

<script>
export default {
  name: 'ActivityNoticeCarousel',
  props: {
    notices: {
      type: Array,
      default: () => []
    }
  },
  data() {
    return {
      activeIndex: 0
    };
  },
  computed: {
    safeNotices() {
      return (Array.isArray(this.notices) ? this.notices : [])
        .filter(item => item && item.value && item.title)
        .map(item => ({
          kicker: '公告',
          summary: '',
          mark: '',
          tone: 'default',
          ...item
        }));
    }
  },
  methods: {
    handleChange(event) {
      const current = event && event.detail ? Number(event.detail.current) : 0;
      this.activeIndex = Number.isFinite(current) ? current : 0;
    }
  }
};
</script>

<style scoped>
.activity-notice-carousel {
  padding: 28rpx 24rpx 0;
  box-sizing: border-box;
}

.notice-swiper {
  width: 100%;
  height: 342rpx;
}

.notice-card {
  position: relative;
  height: 308rpx;
  overflow: hidden;
  border-radius: 8rpx;
  background: #efe7d6;
  box-sizing: border-box;
}

.notice-card::before {
  content: '';
  position: absolute;
  inset: 0;
  background:
    linear-gradient(115deg, rgba(255, 255, 255, 0.18) 0 26%, transparent 26% 100%),
    linear-gradient(90deg, rgba(255, 255, 255, 0.34), rgba(255, 255, 255, 0));
  pointer-events: none;
}

.notice-card::after {
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
