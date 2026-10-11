<template>
  <view class="report-page" :data-app-theme="appThemeMode" :style="appThemeVars">
    <view class="report-nav">
      <view class="back-button" aria-label="返回" @tap="goBack">
        <image src="/static/images/left_exit.png" mode="aspectFit" />
      </view>
      <text class="nav-title">举报帖子</text>
    </view>

    <view class="report-content">
      <view class="page-title">选择帖子举报原因</view>
      <view class="category-card">
        <view v-for="item in categories" :key="item.key" class="category-row"
          :class="{ selected: category === item.key }" @tap="selectCategory(item.key)">
          <view class="category-copy">
            <text class="category-title">{{ item.title }}</text>
            <text class="category-description">{{ item.description }}</text>
          </view>
          <view class="radio-circle"><view v-if="category === item.key" class="radio-inner" /></view>
        </view>
      </view>

      <view v-if="category" class="reason-card">
        <view class="section-title">选择举报原因 <text class="required">*</text></view>
        <view class="reason-options">
          <view v-for="item in currentReasons" :key="item" class="reason-chip"
            :class="{ selected: reason === item }" @tap="reason = item">{{ item }}</view>
        </view>
      </view>

      <view v-if="category" class="supplement-section">
        <view class="supplement-toggle" @tap="showSupplement = !showSupplement">
          <text>补充更多举报信息{{ category === 'rights' ? '及证据' : '' }}</text>
          <text class="toggle-arrow">{{ showSupplement ? '⌃' : '⌄' }}</text>
        </view>
        <view v-if="showSupplement" class="supplement-card">
          <view class="section-title">补充说明 <text v-if="requiresDescription" class="required">*</text></view>
          <textarea class="description-input" :value="description" @input="onDescriptionInput"
            maxlength="500" placeholder="请描述具体情况，帮助管理员核实" />
          <view class="character-count">{{ description.length }}/500</view>
          <template v-if="category === 'rights'">
            <view class="section-title evidence-title">图片证据 <text class="optional">选填，最多3张</text></view>
            <view class="evidence-list">
              <view v-for="(path, index) in images" :key="path" class="evidence-item">
                <image :src="path" mode="aspectFill" @tap="previewEvidence(index)" />
                <view class="remove-image" @tap.stop="removeEvidence(index)">×</view>
              </view>
              <view v-if="images.length < 3" class="add-image" @tap="chooseEvidence">
                <text class="add-symbol">+</text><text>添加证据</text>
              </view>
            </view>
          </template>
        </view>
      </view>
    </view>

    <view class="submit-bar">
      <button class="submit-button" :disabled="!canSubmit" @tap="submit">{{ submitting ? '提交中...' : '提交' }}</button>
    </view>
    <app-overlay-host />
  </view>
</template>

<script>
import { postReportCategories } from '@/utils/postReportReasons.js';
import { submitPostReport } from '@/api-cache/post-report.js';
import { uploadFile } from '@/utils/uploader.js';
import { getCurrentUserId } from '@/utils/auth.js';

export default {
  data() {
    return {
      categories: postReportCategories,
      postId: '', category: '', reason: '', description: '',
      showSupplement: false, images: [], uploadedEvidence: {}, submitting: false,
      requestId: `${Date.now()}_${Math.random().toString(36).slice(2, 12)}`
    };
  },
  computed: {
    currentReasons() {
      const selected = this.categories.find(item => item.key === this.category);
      return selected ? selected.reasons : [];
    },
    requiresDescription() {
      return this.reason === '其他问题' || this.reason === '其他侵权';
    },
    canSubmit() {
      return !!(this.postId && this.category && this.reason && !this.submitting &&
        (!this.requiresDescription || this.description.trim()));
    }
  },
  onLoad(options) {
    this.postId = typeof options.id === 'string' ? options.id : '';
    if (!this.postId) uni.showToast({ title: '帖子无效', icon: 'none' });
  },
  methods: {
    goBack() { uni.navigateBack(); },
    selectCategory(key) {
      if (this.category === key) return;
      this.category = key;
      this.reason = '';
      if (key !== 'rights') this.images = [];
    },
    onDescriptionInput(e) { this.description = e.detail.value || ''; },
    chooseEvidence() {
      uni.chooseImage({
        count: 3 - this.images.length,
        sizeType: ['compressed'],
        sourceType: ['album', 'camera'],
        success: result => {
          this.images = [...this.images, ...(result.tempFilePaths || [])].slice(0, 3);
        }
      });
    },
    removeEvidence(index) { this.images.splice(index, 1); },
    previewEvidence(index) { uni.previewImage({ current: this.images[index], urls: this.images }); },
    async submit() {
      if (!this.canSubmit) return;
      const openid = getCurrentUserId(this);
      if (!openid) {
        uni.showToast({ title: '请先登录', icon: 'none' });
        return;
      }
      this.submitting = true;
      uni.showLoading({ title: '提交中...' });
      try {
        const evidenceImages = [];
        if (this.category === 'rights') {
          for (let index = 0; index < this.images.length; index++) {
            const path = this.images[index];
            let fileId = this.uploadedEvidence[path];
            if (!fileId) {
              const extension = /\.(png|webp|jpe?g)(?:\?|$)/i.exec(path)?.[1] || 'jpg';
              const cloudPath = `post-reports/${openid}/${Date.now()}_${index}.${extension}`;
              fileId = await uploadFile(cloudPath, path, {
                context: this, requireAuth: true, pageTag: 'post-report:evidence'
              });
              if (fileId) this.uploadedEvidence[path] = fileId;
            }
            if (!fileId) throw new Error('证据图片上传失败');
            evidenceImages.push(fileId);
          }
        }
        await submitPostReport({
          postId: this.postId, category: this.category, reason: this.reason,
          description: this.description.trim(), evidenceImages, requestId: this.requestId
        }, this);
        uni.hideLoading();
        uni.showModal({
          title: '举报已提交', content: '管理员会核实举报内容。感谢你的反馈。',
          showCancel: false, success: () => this.goBack()
        });
      } catch (error) {
        uni.hideLoading();
        uni.showToast({ title: error.message || '提交失败，请重试', icon: 'none' });
      } finally {
        this.submitting = false;
      }
    }
  }
};
</script>

<style scoped>
.report-page { min-height: 100vh; background: var(--app-subtle-surface-bg, #f5f5f5); color: var(--app-primary-text, #242424); }
.report-nav { height: calc(108rpx + env(safe-area-inset-top)); padding-top: env(safe-area-inset-top); box-sizing: border-box; display: flex; align-items: center; position: relative; }
.back-button { width: 100rpx; height: 100rpx; margin-left: 20rpx; display: flex; align-items: center; justify-content: center; }
.back-button image { width: 22rpx; height: 38rpx; filter: var(--app-icon-filter, none); }
.nav-title { position: absolute; left: 50%; transform: translateX(-50%); font-size: 30rpx; font-weight: 500; }
.report-content { padding: 30rpx 34rpx 200rpx; }
.page-title { font-size: 38rpx; text-align: center; margin: 35rpx 0 62rpx; letter-spacing: 2rpx; }
.category-card, .reason-card, .supplement-card { background: var(--app-surface-bg, #fff); border-radius: 28rpx; padding: 6rpx 34rpx; }
.category-row { display: flex; align-items: center; gap: 22rpx; min-height: 168rpx; padding: 25rpx 0; box-sizing: border-box; border-bottom: 1rpx solid var(--app-border-color, #eee); }
.category-row:last-child { border-bottom: 0; }
.category-copy { flex: 1; display: flex; flex-direction: column; gap: 16rpx; }
.category-title { font-size: 32rpx; line-height: 1.4; }
.category-description { font-size: 25rpx; line-height: 1.55; color: var(--app-muted-text, #929292); }
.radio-circle { width: 39rpx; height: 39rpx; border: 3rpx solid #c8c8c8; border-radius: 50%; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.category-row.selected .radio-circle { border-color: #333; }
.radio-inner { width: 21rpx; height: 21rpx; background: #333; border-radius: 50%; }
.reason-card { margin-top: 26rpx; padding: 32rpx 34rpx 36rpx; }
.section-title { font-size: 30rpx; margin-bottom: 24rpx; }
.required { color: #c84242; }
.reason-options { display: flex; flex-wrap: wrap; gap: 16rpx; }
.reason-chip { padding: 17rpx 27rpx; border-radius: 12rpx; background: var(--app-subtle-surface-bg, #f3f3f3); color: var(--app-secondary-text, #666); font-size: 27rpx; line-height: 1.4; }
.reason-chip.selected { background: #292929; color: #fff; }
.supplement-section { margin-top: 28rpx; }
.supplement-toggle { display: flex; align-items: center; gap: 16rpx; min-height: 70rpx; color: var(--app-muted-text, #929292); font-size: 27rpx; }
.toggle-arrow { font-size: 34rpx; }
.supplement-card { padding: 30rpx 34rpx; margin-top: 12rpx; }
.description-input { width: 100%; height: 210rpx; box-sizing: border-box; padding: 20rpx; border-radius: 12rpx; background: var(--app-subtle-surface-bg, #f6f6f6); font-size: 27rpx; line-height: 1.5; }
.character-count { text-align: right; font-size: 22rpx; color: var(--app-muted-text, #999); margin-top: 10rpx; }
.evidence-title { margin-top: 32rpx; }
.optional { color: var(--app-muted-text, #999); font-size: 23rpx; }
.evidence-list { display: flex; flex-wrap: wrap; gap: 18rpx; }
.evidence-item, .add-image { width: 155rpx; height: 155rpx; border-radius: 12rpx; overflow: hidden; position: relative; }
.evidence-item image { width: 100%; height: 100%; }
.remove-image { position: absolute; right: 0; top: 0; width: 42rpx; height: 42rpx; background: rgba(0,0,0,.65); color: #fff; text-align: center; line-height: 40rpx; font-size: 32rpx; }
.add-image { display: flex; flex-direction: column; align-items: center; justify-content: center; background: var(--app-subtle-surface-bg, #f3f3f3); color: var(--app-muted-text, #999); font-size: 22rpx; }
.add-symbol { font-size: 52rpx; line-height: 1; margin-bottom: 8rpx; }
.submit-bar { position: fixed; bottom: 0; left: 0; right: 0; padding: 20rpx 12% calc(26rpx + env(safe-area-inset-bottom)); background: var(--app-subtle-surface-bg, #f5f5f5); }
.submit-button { border-radius: 999rpx; background: #262626; color: #fff; font-size: 32rpx; height: 96rpx; line-height: 96rpx; }
.submit-button[disabled] { background: #d5d5d5; color: #fff; }
.submit-button::after { border: none; }
</style>
