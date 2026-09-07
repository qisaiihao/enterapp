<template>
  <view class="contact-page">
    <view v-if="loading" class="state">加载中...</view>
    <view v-else-if="error" class="state">
      <text>{{ error }}</text>
      <button class="retry" @tap="loadContact">重新加载</button>
    </view>
    <template v-else>
      <view class="card qr-card">
        <text class="title">加入微信群</text>
        <image v-if="qrUrl && !imageFailed" class="qr-code" :src="qrUrl" mode="aspectFit"
          :show-menu-by-longpress="true" @tap="previewQr" @error="imageFailed = true" />
        <view v-else class="placeholder">{{ imageFailed ? '二维码加载失败，请下拉刷新' : '微信群二维码暂未设置' }}</view>
        <text v-if="qrUrl && !imageFailed" class="hint">点击查看大图，保存图片到微信扫码识别</text>
      </view>
      <view class="card">
        <view class="heading">
          <text class="title">联系方式</text>
        </view>
        <text class="contact-text" selectable>{{ contactText || '联系方式暂未设置' }}</text>
      </view>
    </template>
  </view>
</template>

<script>
import { getContactConfig } from '@/api-cache/contact.js';
import fileUrlCache from '@/_utils/file-url-cache';

export default {
  data() {
    return { loading: false, error: '', qrUrl: '', contactText: '', imageFailed: false };
  },
  onShow() { this.loadContact(); },
  async onPullDownRefresh() {
    try { await this.loadContact(); } finally { uni.stopPullDownRefresh(); }
  },
  methods: {
    async loadContact() {
      if (this.loading) return;
      this.loading = true;
      this.error = '';
      this.imageFailed = false;
      this.qrUrl = '';
      try {
        const config = await getContactConfig(this);
        this.contactText = config.contactText;
        if (config.qrCode) {
          try {
            this.qrUrl = await fileUrlCache.getTempUrl(config.qrCode);
            this.imageFailed = !this.qrUrl;
          } catch (_) { this.imageFailed = true; }
        }
      } catch (error) {
        this.error = error.message || '加载失败，请重试';
      } finally { this.loading = false; }
    },
    previewQr() { uni.previewImage({ current: this.qrUrl, urls: [this.qrUrl] }); }
  }
};
</script>

<style scoped>
.contact-page { min-height: 100vh; box-sizing: border-box; padding: 32rpx; background: #f5f5f5; }
.card { background: #fff; border-radius: 20rpx; padding: 36rpx; margin-bottom: 28rpx; }
.qr-card { display: flex; flex-direction: column; align-items: center; }
.title { font-size: 32rpx; font-weight: 600; color: #333; }
.qr-code { width: 440rpx; height: 440rpx; max-width: 100%; margin: 32rpx 0 24rpx; }
.placeholder { padding: 100rpx 0; font-size: 26rpx; color: #999; text-align: center; }
.hint { font-size: 24rpx; color: #888; }
.heading { display: flex; justify-content: space-between; align-items: center; margin-bottom: 24rpx; }
.contact-text { display: block; font-size: 28rpx; line-height: 1.8; color: #555; white-space: pre-wrap; overflow-wrap: anywhere; }
.state { padding: 100rpx 20rpx; text-align: center; color: #888; font-size: 28rpx; }
.retry { margin-top: 30rpx; font-size: 28rpx; }
</style>
