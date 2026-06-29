<template>
  <view class="activity-poster-card" @tap="handleTap">
    <view class="poster-frame">
      <image
        v-if="hasCover"
        class="poster-cover"
        :src="item.coverImage"
        mode="aspectFill"
      />
      <view v-else class="poster-cover poster-placeholder">
        <text class="poster-placeholder-text">海报</text>
      </view>

      <text :class="['poster-status', statusInfo.type]">{{ statusInfo.label }}</text>
      <view class="poster-caption">
        <text class="poster-caption-text">{{ captionText }}</text>
      </view>
    </view>
  </view>
</template>

<script>
function parseDate(input) {
  if (!input) return null;
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

function formatMonthDay(input) {
  const date = parseDate(input);
  if (!date) return '';
  return `${date.getMonth() + 1}.${date.getDate()}`;
}

function formatCompactRange(startTime, endTime) {
  const start = formatMonthDay(startTime);
  const end = formatMonthDay(endTime);
  if (start && end) return `${start}-${end}`;
  return start || end || '';
}

export default {
  name: 'ActivityPosterCard',
  emits: ['select'],
  props: {
    item: {
      type: Object,
      required: true
    }
  },
  computed: {
    hasCover() {
      return !!(this.item && this.item.coverImage);
    },
    statusInfo() {
      const start = parseDate(this.item && this.item.startTime);
      const end = parseDate(this.item && this.item.endTime);
      const now = Date.now();

      if (start && start.getTime() > now) {
        return { type: 'upcoming', label: '敬请期待' };
      }

      if (
        (this.item && this.item.isOngoing === true) ||
        (start && end && start.getTime() <= now && end.getTime() >= now)
      ) {
        return { type: 'ongoing', label: '进行中' };
      }

      return { type: 'ended', label: '已结束' };
    },
    captionText() {
      const summary = this.item && this.item.summary ? String(this.item.summary).trim() : '';
      if (summary) return summary;

      const range = formatCompactRange(this.item && this.item.startTime, this.item && this.item.endTime);
      const title = this.item && this.item.title ? String(this.item.title).trim() : '';
      if (range && title) return `${range}${title}`;
      return title || range || '活动标题';
    }
  },
  methods: {
    handleTap() {
      this.$emit('select', this.item);
    }
  }
};
</script>

<style scoped>
.activity-poster-card {
  width: 100%;
  overflow: hidden;
  border-radius: 8rpx;
  background: var(--app-subtle-surface-bg, #d7d7d7);
  box-shadow: none;
  transition: transform 0.18s ease, opacity 0.18s ease;
}

.activity-poster-card:active {
  transform: scale(0.99);
  opacity: 0.9;
}

.poster-frame {
  position: relative;
  width: 100%;
  height: 288rpx;
  overflow: hidden;
  border-radius: 8rpx;
  background: #d7d7d7;
}

.poster-cover {
  width: 100%;
  height: 100%;
  display: block;
  background: #d7d7d7;
}

.poster-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
}

.poster-placeholder-text {
  font-size: 62rpx;
  line-height: 72rpx;
  color: #000000;
}

.poster-status {
  position: absolute;
  top: 16rpx;
  right: 16rpx;
  min-width: 64rpx;
  height: 26rpx;
  line-height: 26rpx;
  padding: 0 10rpx;
  border-radius: 999rpx;
  color: #ffffff;
  font-size: 18rpx;
  text-align: center;
  box-sizing: border-box;
}

.poster-status.ongoing {
  background: #89c69b;
}

.poster-status.ended {
  background: #caa0aa;
}

.poster-status.upcoming {
  background: #85898d;
}

.poster-caption {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  min-height: 50rpx;
  display: flex;
  align-items: center;
  padding: 0 22rpx;
  box-sizing: border-box;
  background: rgba(177, 177, 177, 0.9);
}

.poster-caption-text {
  width: 100%;
  color: #111111;
  font-size: 22rpx;
  line-height: 30rpx;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
