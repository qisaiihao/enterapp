<template>
  <view class="contact-admin">
    <view v-if="loading" class="state">加载中...</view>
    <view v-else-if="error" class="state">
      <text>{{ error }}</text>
      <button @tap="loadConfig">重新加载</button>
    </view>
    <template v-else-if="authorized">
      <view class="card">
        <text class="label">微信群二维码</text>
        <image v-if="previewUrl && !imageFailed" class="qr-code" :src="previewUrl" mode="aspectFit" @error="imageFailed = true" />
        <view v-else class="placeholder">{{ imageFailed ? '图片预览失败，可重新上传' : '请上传微信群二维码' }}</view>
        <button :disabled="uploading || saving" :loading="uploading" @tap="chooseQr">{{ uploading ? '上传中...' : (qrCode ? '更换二维码' : '上传二维码') }}</button>
        <text class="hint">请选择清晰完整的二维码图片，最大 10 MB</text>
      </view>
      <view class="card">
        <text class="label">联系方式</text>
        <textarea v-model="contactText" class="textarea" :maxlength="2000" :disabled="saving"
          placeholder="填写微信号、邮箱、电话等联系方式，支持换行" />
        <text class="counter">{{ contactText.length }}/2000</text>
      </view>
      <button class="save" :disabled="uploading || saving" :loading="saving" @tap="save">{{ saving ? '保存中...' : '保存' }}</button>
      <text class="hint">保存后将显示在“联系我们”页面</text>
    </template>
  </view>
</template>

<script>
import { getContactConfig, saveContactConfig } from '@/api-cache/contact.js';
import { refreshAdminStatus } from '@/utils/admin.js';
import { uploadFile } from '@/utils/uploader.js';
import fileUrlCache from '@/_utils/file-url-cache';

export default {
  data() {
    return { loading: true, error: '', authorized: false, uploading: false, saving: false,
      qrCode: '', previewUrl: '', contactText: '', imageFailed: false };
  },
  onLoad() { this.loadConfig(); },
  methods: {
    async loadConfig() {
      this.loading = true;
      this.error = '';
      try {
        this.authorized = await refreshAdminStatus();
        if (!this.authorized) throw new Error('仅管理员可编辑，请确认登录账号后重试');
        const config = await getContactConfig(this);
        this.qrCode = config.qrCode;
        this.contactText = config.contactText;
        this.imageFailed = false;
        if (this.qrCode) {
          try { this.previewUrl = await fileUrlCache.getTempUrl(this.qrCode); }
          catch (_) { this.imageFailed = true; }
        }
      } catch (error) { this.error = error.message || '加载失败'; }
      finally { this.loading = false; }
    },
    chooseQr() {
      if (this.uploading || this.saving) return;
      uni.chooseImage({
        count: 1, sizeType: ['original'], sourceType: ['album', 'camera'],
        success: async (result) => {
          const path = result.tempFilePaths && result.tempFilePaths[0];
          if (!path) return;
          const file = result.tempFiles && result.tempFiles[0];
          if (file && file.size > 10 * 1024 * 1024) {
            uni.showToast({ title: '图片不能超过 10 MB', icon: 'none' });
            return;
          }
          this.uploading = true;
          try {
            const info = await new Promise((resolve, reject) => uni.getImageInfo({ src: path, success: resolve, fail: reject }));
            const type = String(info.type || 'png').toLowerCase();
            const ext = type === 'jpeg' ? 'jpg' : type;
            if (!['jpg', 'png', 'webp'].includes(ext)) throw new Error('请选择 JPG、PNG 或 WebP 图片');
            const cloudPath = `contact/qr_${Date.now()}_${Math.random().toString(36).slice(2, 10)}.${ext}`;
            const fileID = await uploadFile(cloudPath, path, { context: this });
            if (!fileID || !fileID.startsWith('cloud://')) throw new Error('上传失败，请重试');
            this.qrCode = fileID;
            this.previewUrl = path;
            this.imageFailed = false;
          } catch (error) { uni.showToast({ title: error.message || '二维码上传失败', icon: 'none' }); }
          finally { this.uploading = false; }
        },
        fail: (error) => {
          if (!/cancel/i.test(error.errMsg || '')) uni.showToast({ title: '选择图片失败', icon: 'none' });
        }
      });
    },
    async save() {
      if (!this.authorized || this.uploading || this.saving) return;
      if (!this.qrCode || !this.contactText.trim()) {
        uni.showToast({ title: '请上传二维码并填写联系方式', icon: 'none' });
        return;
      }
      this.saving = true;
      try {
        await saveContactConfig({ qrCode: this.qrCode, contactText: this.contactText.trim() }, this);
        uni.showToast({ title: '保存成功', icon: 'success' });
      } catch (error) { uni.showToast({ title: error.message || '保存失败', icon: 'none' }); }
      finally { this.saving = false; }
    }
  }
};
</script>

<style scoped>
.contact-admin { min-height: 100vh; box-sizing: border-box; padding: 30rpx; background: #f5f5f5; }
.card { padding: 30rpx; margin-bottom: 24rpx; background: #fff; border-radius: 16rpx; }
.label { display: block; font-size: 30rpx; font-weight: 600; color: #333; margin-bottom: 24rpx; }
.qr-code { display: block; width: 420rpx; height: 420rpx; max-width: 100%; margin: 0 auto 24rpx; }
.placeholder { padding: 90rpx 0; text-align: center; font-size: 28rpx; color: #999; }
.hint { display: block; margin-top: 20rpx; text-align: center; font-size: 24rpx; color: #888; }
.textarea { width: 100%; height: 320rpx; box-sizing: border-box; padding: 20rpx; background: #f8f8f8; border-radius: 10rpx; font-size: 28rpx; line-height: 1.7; }
.counter { display: block; text-align: right; color: #999; font-size: 24rpx; margin-top: 12rpx; }
button { font-size: 28rpx; }
.save { background: #667eea; color: #fff; }
.save[disabled] { opacity: 0.5; }
.state { padding: 100rpx 20rpx; text-align: center; color: #888; }
.state button { margin-top: 30rpx; }
</style>
