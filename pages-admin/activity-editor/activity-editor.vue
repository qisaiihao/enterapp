<template>
  <view class="activity-editor-page">
    <view class="form-card">
      <view class="form-item">
        <text class="label">活动标题 *</text>
        <input
          class="input"
          placeholder="请输入活动标题"
          maxlength="40"
          v-model="form.title"
        />
      </view>

      <view class="form-item">
        <text class="label">活动简介</text>
        <textarea
          class="textarea"
          placeholder="最多 200 字"
          maxlength="200"
          v-model="form.summary"
        />
      </view>

      <view class="form-item">
        <text class="label">活动细则</text>
        <textarea
          class="textarea rules-textarea"
          placeholder="填写活动参与方式、评审规则、奖励说明等（最多5000字）"
          maxlength="5000"
          v-model="form.rules"
        />
      </view>

      <view class="form-item">
        <text class="label">活动封面</text>
        <view class="cover-upload-box">
          <image
            v-if="getCoverPreviewSrc()"
            class="cover-preview"
            :src="getCoverPreviewSrc()"
            mode="aspectFill"
          />
          <view v-else class="cover-placeholder">
            <text>建议比例 16:9，支持 JPG/PNG</text>
          </view>
        </view>
        <view class="cover-actions">
          <button
            class="cover-btn primary"
            :disabled="uploadingCover || submitting"
            @tap="chooseAndUploadCover"
          >
            {{ uploadingCover ? '上传中...' : (form.coverImage ? '重新上传' : '上传封面') }}
          </button>
          <button
            v-if="form.coverImage"
            class="cover-btn"
            :disabled="uploadingCover || submitting"
            @tap="clearCoverImage"
          >
            移除
          </button>
        </view>
      </view>

      <view class="form-item">
        <text class="label">开始日期 *</text>
        <picker mode="date" :value="form.startDate" @change="onStartDateChange">
          <view class="picker-value">{{ form.startDate || '请选择开始日期' }}</view>
        </picker>
      </view>

      <view class="form-item">
        <text class="label">结束日期 *</text>
        <picker mode="date" :value="form.endDate" @change="onEndDateChange">
          <view class="picker-value">{{ form.endDate || '请选择结束日期' }}</view>
        </picker>
      </view>

      <view class="form-item">
        <text class="label">排序权重</text>
        <input
          class="input"
          type="number"
          :value="String(form.sortWeight)"
          @input="onSortWeightInput"
        />
      </view>

      <view class="form-item">
        <text class="label">状态</text>
        <picker mode="selector" :range="statusLabels" :value="statusIndex" @change="onStatusChange">
          <view class="picker-value">{{ statusLabels[statusIndex] }}</view>
        </picker>
      </view>
    </view>

    <button class="submit-btn" :disabled="submitting || uploadingCover" @tap="submitForm">
      {{ submitting ? '保存中...' : (isEdit ? '保存修改' : '创建活动') }}
    </button>
  </view>
</template>

<script>
const { uploadFile } = require('@/utils/uploader.js');
import fileUrlCache from '@/_utils/file-url-cache';
import { invalidateRecentActivities, invalidateActivityPosts } from '@/api-cache/activities.js';
const {
  getAdminActivityDetail,
  createAdminActivity,
  updateAdminActivity
} = require('@/api-cache/admin-activities.js');
const {
  ACTIVITY_STATUS_OPTIONS,
  decodeParamSafe,
  formatDateYmd
} = require('@/utils/activity.js');

export default {
  data() {
    return {
      activityId: '',
      isEdit: false,
      submitting: false,
      uploadingCover: false,
      coverLocalPath: '',
      coverPreviewUrl: '',
      coverPreviewToken: 0,
      form: {
        title: '',
        summary: '',
        rules: '',
        coverImage: '',
        startDate: '',
        endDate: '',
        sortWeight: 0,
        status: 'draft'
      },
      statusIndex: 0,
      statusLabels: ACTIVITY_STATUS_OPTIONS.map(item => item.label)
    };
  },
  onLoad(options) {
    options = options || {};
    const activityId = decodeParamSafe(options.activityId);
    if (activityId) {
      this.activityId = activityId;
      this.isEdit = true;
      this.loadDetail();
    }
  },
  methods: {
    async loadDetail() {
      try {
        uni.showLoading({ title: '加载中...' });
        const result = await getAdminActivityDetail({
          activityId: this.activityId,
          context: this
        });
        if (!result.activity) {
          throw new Error('加载失败');
        }
        this.fillForm(result.activity);
      } catch (error) {
        uni.showToast({
          title: error.message || '加载失败',
          icon: 'none'
        });
      } finally {
        uni.hideLoading();
      }
    },

    fillForm(activity) {
      const statusValue = activity.status || 'draft';
      const statusIndex = ACTIVITY_STATUS_OPTIONS.findIndex(item => item.value === statusValue);
      this.coverLocalPath = '';
      this.coverPreviewUrl = '';
      this.form = {
        title: activity.title || '',
        summary: activity.summary || '',
        rules: activity.rules || '',
        coverImage: activity.coverImage || '',
        startDate: formatDateYmd(activity.startTime, ''),
        endDate: formatDateYmd(activity.endTime, ''),
        sortWeight: Number(activity.sortWeight) || 0,
        status: statusValue
      };
      this.statusIndex = statusIndex >= 0 ? statusIndex : 0;
      this.refreshCoverPreview();
    },

    getCoverPreviewSrc() {
      if (this.coverLocalPath) return this.coverLocalPath;
      if (this.coverPreviewUrl) return this.coverPreviewUrl;
      const cover = String(this.form.coverImage || '');
      if (!cover.startsWith('cloud://')) return cover;
      return '';
    },

    async refreshCoverPreview() {
      if (this.coverLocalPath) {
        this.coverPreviewUrl = this.coverLocalPath;
        return;
      }

      const cover = String(this.form.coverImage || '').trim();
      if (!cover) {
        this.coverPreviewUrl = '';
        return;
      }
      if (!cover.startsWith('cloud://')) {
        this.coverPreviewUrl = cover;
        return;
      }

      const token = ++this.coverPreviewToken;
      try {
        const tempUrl = await fileUrlCache.getTempUrl(cover);
        if (token !== this.coverPreviewToken) return;
        this.coverPreviewUrl = tempUrl || '';
      } catch (error) {
        if (token !== this.coverPreviewToken) return;
        this.coverPreviewUrl = '';
      }
    },

    buildCoverCloudPath(localPath) {
      const normalized = String(localPath || '');
      const extMatch = normalized.match(/\.([a-zA-Z0-9]+)(?:$|\?)/);
      const ext = extMatch && extMatch[1] ? extMatch[1].toLowerCase() : 'jpg';
      const timestamp = Date.now();
      const random = Math.floor(Math.random() * 100000);
      return `activities/covers/${timestamp}_${random}.${ext}`;
    },

    async chooseAndUploadCover() {
      if (this.uploadingCover) return;

      let tempFilePath = '';
      try {
        const chooseRes = await new Promise((resolve, reject) => {
          uni.chooseImage({
            count: 1,
            sizeType: ['compressed'],
            sourceType: ['album', 'camera'],
            success: resolve,
            fail: reject
          });
        });

        const list = (chooseRes && chooseRes.tempFilePaths) || [];
        tempFilePath = list[0] || '';
        if (!tempFilePath) {
          throw new Error('未获取到图片');
        }

        this.uploadingCover = true;
        uni.showLoading({ title: '上传封面中...' });
        const cloudPath = this.buildCoverCloudPath(tempFilePath);
        const fileID = await uploadFile(cloudPath, tempFilePath);
        if (!fileID) {
          throw new Error('上传失败');
        }

        this.form = {
          ...this.form,
          coverImage: fileID
        };
        this.coverLocalPath = tempFilePath;
        this.coverPreviewUrl = tempFilePath;
        uni.showToast({
          title: '封面上传成功',
          icon: 'success'
        });
      } catch (error) {
        const errMsg = (error && (error.errMsg || error.message)) || '';
        if (String(errMsg).toLowerCase().includes('cancel')) {
          return;
        }
        uni.showToast({
          title: errMsg || '上传失败',
          icon: 'none'
        });
      } finally {
        if (this.uploadingCover) {
          uni.hideLoading();
        }
        this.uploadingCover = false;
      }
    },

    clearCoverImage() {
      this.coverLocalPath = '';
      this.coverPreviewUrl = '';
      this.form = {
        ...this.form,
        coverImage: ''
      };
    },

    onStartDateChange(event) {
      const value = event && event.detail ? event.detail.value : '';
      this.form = {
        ...this.form,
        startDate: value
      };
    },

    onEndDateChange(event) {
      const value = event && event.detail ? event.detail.value : '';
      this.form = {
        ...this.form,
        endDate: value
      };
    },

    onSortWeightInput(event) {
      const raw = event && event.detail ? event.detail.value : '0';
      this.form = {
        ...this.form,
        sortWeight: Number(raw) || 0
      };
    },

    onStatusChange(event) {
      const index = Number(event && event.detail ? event.detail.value : 0) || 0;
      const option = ACTIVITY_STATUS_OPTIONS[index] || ACTIVITY_STATUS_OPTIONS[0];
      this.statusIndex = index;
      this.form = {
        ...this.form,
        status: option.value
      };
    },

    validateForm() {
      const title = (this.form.title || '').trim();
      if (!title) {
        return '请输入活动标题';
      }
      if (!this.form.startDate || !this.form.endDate) {
        return '请选择起止日期';
      }
      const start = new Date(`${this.form.startDate}T00:00:00`);
      const end = new Date(`${this.form.endDate}T23:59:59`);
      if (end.getTime() < start.getTime()) {
        return '结束日期不能早于开始日期';
      }
      return '';
    },

    buildPayload() {
      return {
        title: (this.form.title || '').trim(),
        summary: (this.form.summary || '').trim(),
        rules: String(this.form.rules || '').replace(/\r\n/g, '\n').trim(),
        coverImage: (this.form.coverImage || '').trim(),
        startTime: new Date(`${this.form.startDate}T00:00:00`).toISOString(),
        endTime: new Date(`${this.form.endDate}T23:59:59`).toISOString(),
        sortWeight: Number(this.form.sortWeight) || 0,
        status: this.form.status || 'draft'
      };
    },

    async submitForm() {
      if (this.submitting) return;
      if (this.uploadingCover) {
        uni.showToast({
          title: '封面上传中，请稍后',
          icon: 'none'
        });
        return;
      }
      const errorMsg = this.validateForm();
      if (errorMsg) {
        uni.showToast({
          title: errorMsg,
          icon: 'none'
        });
        return;
      }

      this.submitting = true;
      try {
        const payload = this.buildPayload();
        const result = this.isEdit
          ? await updateAdminActivity({ ...payload, activityId: this.activityId }, { context: this })
          : await createAdminActivity(payload, { context: this });
        const affectedId = this.isEdit ? this.activityId : (result.activityId || '');
        invalidateRecentActivities();
        if (affectedId) {
          invalidateActivityPosts({ activityId: affectedId });
        }

        uni.showToast({
          title: this.isEdit ? '修改成功' : '创建成功',
          icon: 'success'
        });
        uni.setStorageSync('shouldRefreshAdminActivities', true);
        setTimeout(() => {
          uni.navigateBack();
        }, 300);
      } catch (error) {
        uni.showToast({
          title: error.message || '保存失败',
          icon: 'none'
        });
      } finally {
        this.submitting = false;
      }
    }
  }
};
</script>

<style scoped>
.activity-editor-page {
  min-height: 100vh;
  background: #f5f5f5;
  padding: 20rpx;
  box-sizing: border-box;
}

.form-card {
  background: #fff;
  border-radius: 14rpx;
  padding: 24rpx;
}

.form-item {
  margin-bottom: 22rpx;
}

.form-item:last-child {
  margin-bottom: 0;
}

.label {
  display: block;
  font-size: 26rpx;
  color: #555;
  margin-bottom: 10rpx;
}

.input,
.picker-value,
.textarea {
  width: 100%;
  box-sizing: border-box;
  background: #f7f8fa;
  border-radius: 10rpx;
  padding: 18rpx 20rpx;
  font-size: 28rpx;
  color: #222;
}

.input {
  display: block;
  height: 84rpx;
  line-height: 84rpx;
  padding: 0 20rpx;
}

.textarea {
  min-height: 170rpx;
}

.textarea.rules-textarea {
  min-height: 260rpx;
}

.cover-upload-box {
  width: 100%;
  border-radius: 12rpx;
  overflow: hidden;
  background: #f7f8fa;
}

.cover-preview {
  width: 100%;
  height: 280rpx;
  display: block;
}

.cover-placeholder {
  height: 220rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #999;
  font-size: 24rpx;
}

.cover-actions {
  margin-top: 14rpx;
  display: flex;
  gap: 16rpx;
}

.cover-btn {
  margin: 0;
  padding: 0 20rpx;
  width: auto;
  flex: 0 0 auto;
  min-width: 180rpx;
  height: 64rpx;
  line-height: 64rpx;
  border-radius: 10rpx;
  border: 1rpx solid #d8d8d8;
  background: #fff;
  color: #333;
  font-size: 26rpx;
}

.cover-btn.primary {
  border-color: #1f9d55;
  background: #1f9d55;
  color: #fff;
}

.cover-btn::after {
  border: none;
}

.submit-btn {
  margin-top: 24rpx;
  height: 80rpx;
  line-height: 80rpx;
  border-radius: 12rpx;
  border: none;
  background: #1f9d55;
  color: #fff;
  font-size: 30rpx;
}

.submit-btn[disabled] {
  opacity: 0.7;
}
</style>
