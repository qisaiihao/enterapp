<template>
  <view class="web-link-page">
    <web-view v-if="url && !failed" :src="url" @error="failed = true" />
    <view v-else class="web-link-error">
      <text>{{ url ? '网页暂时无法打开' : '链接无效' }}</text>
      <button v-if="url" @tap="copyLink">复制链接</button>
    </view>
  </view>
</template>

<script>
import { normalizeActivityNoticeLink } from '@/utils/activityNoticeLink.js';

export default {
  data() { return { url: '', failed: false }; },
  onLoad(options = {}) {
    let value = '';
    try { value = decodeURIComponent(options.url || ''); } catch (_) {}
    const url = normalizeActivityNoticeLink(value);
    this.url = /^https?:\/\//i.test(url) ? url : '';
  },
  methods: {
    copyLink() { uni.setClipboardData({ data: this.url }); }
  }
};
</script>

<style scoped>
.web-link-error {
  padding: 100rpx 40rpx;
  color: var(--app-text-color, #333);
  text-align: center;
}
.web-link-error button {
  margin-top: 32rpx;
}
</style>
