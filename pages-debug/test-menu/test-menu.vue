<template>
  <view class="container">
    <view class="header">
      <text class="title">测试工具</text>
      <text class="subtitle">管理员调试与数据操作入口</text>
    </view>

    <view class="menu-list card">
      <view class="menu-item" @tap="navigateTo('/pages-debug/test-domain-config/test-domain-config')">
        <view class="menu-content">
          <text class="menu-title">域名配置测试</text>
          <text class="menu-desc">检查云存储域名与 CORS 相关配置</text>
        </view>
        <text class="menu-arrow">›</text>
      </view>

      <view class="menu-item" @tap="navigateTo('/pages-debug/test-direct-download/test-direct-download')">
        <view class="menu-content">
          <text class="menu-title">直接下载测试</text>
          <text class="menu-desc">测试下载、保存与应用链路</text>
        </view>
        <text class="menu-arrow">›</text>
      </view>

      <view class="menu-item" @tap="navigateTo('/pages-debug/test-cloud-storage/test-cloud-storage')">
        <view class="menu-content">
          <text class="menu-title">云存储文件检查</text>
          <text class="menu-desc">检查云存储中的资源文件状态</text>
        </view>
        <text class="menu-arrow">›</text>
      </view>
    </view>

    <!-- #ifdef MP-WEIXIN -->
    <view class="card tips-card">
      <text class="section-title">数据库批量查找替换</text>
      <text class="tip-item">- 仅管理员可用，建议先预览再执行</text>
      <text v-for="(tip, index) in tips" :key="index" class="tip-item">- {{ tip }}</text>
      <text class="tip-item">- 替换值可以为空字符串</text>
    </view>

    <view class="card form-card">
      <view class="form-item">
        <text class="label">集合</text>
        <picker
          class="picker"
          :range="collections"
          range-key="label"
          :value="safeCollectionIndex"
          @change="onCollectionChange"
        >
          <view class="picker-value">{{ currentCollectionLabel }}</view>
        </picker>
      </view>

      <view v-if="isCustomCollection" class="form-item">
        <text class="label">自定义集合名</text>
        <input v-model.trim="customCollectionName" class="input" placeholder="例如 follows" />
      </view>

      <view class="form-item">
        <text class="label">字段</text>
        <picker
          class="picker"
          :range="fieldOptions"
          range-key="label"
          :value="safeFieldIndex"
          @change="onFieldChange"
        >
          <view class="picker-value">{{ currentFieldLabel }}</view>
        </picker>
      </view>

      <view v-if="isCustomField" class="form-item">
        <text class="label">自定义字段名</text>
        <input v-model.trim="customFieldName" class="input" placeholder="例如 followerId 或 profile.poemId" />
      </view>

      <view class="form-item">
        <text class="label">查找值</text>
        <textarea v-model="findValue" class="textarea" auto-height placeholder="输入需要查找的字段值" />
      </view>

      <view class="form-item">
        <text class="label">替换值</text>
        <textarea v-model="replaceValue" class="textarea" auto-height placeholder="输入要替换成的新值，可为空" />
      </view>

      <view class="button-row">
        <button class="btn preview-btn" @tap="previewReplace">先预览</button>
        <button class="btn execute-btn" @tap="executeReplace">执行替换</button>
      </view>
    </view>

    <view v-if="previewResult" class="card result-card">
      <text class="section-title">预览结果</text>
      <view class="summary-grid">
        <view class="summary-item">
          <text class="summary-label">集合</text>
          <text class="summary-value">{{ previewResult.collectionName }}</text>
        </view>
        <view class="summary-item">
          <text class="summary-label">字段</text>
          <text class="summary-value">{{ previewResult.fieldName }}</text>
        </view>
        <view class="summary-item">
          <text class="summary-label">命中数量</text>
          <text class="summary-value highlight">{{ previewResult.matchedCount }}</text>
        </view>
      </view>

      <text class="sample-title">样本记录</text>
      <view v-if="previewResult.sampleDocs && previewResult.sampleDocs.length" class="sample-list">
        <view v-for="(doc, index) in previewResult.sampleDocs" :key="doc._id || index" class="sample-card">
          <text class="sample-index">#{{ index + 1 }}</text>
          <text class="sample-json">{{ formatDoc(doc) }}</text>
        </view>
      </view>
      <text v-else class="empty-text">没有匹配样本</text>
    </view>

    <view v-if="executeResult" class="card result-card">
      <text class="section-title">执行结果</text>
      <view class="summary-grid">
        <view class="summary-item">
          <text class="summary-label">集合</text>
          <text class="summary-value">{{ executeResult.collectionName }}</text>
        </view>
        <view class="summary-item">
          <text class="summary-label">字段</text>
          <text class="summary-value">{{ executeResult.fieldName }}</text>
        </view>
        <view class="summary-item">
          <text class="summary-label">命中数量</text>
          <text class="summary-value">{{ executeResult.matchedCount }}</text>
        </view>
        <view class="summary-item">
          <text class="summary-label">更新数量</text>
          <text class="summary-value success">{{ executeResult.updatedCount }}</text>
        </view>
      </view>
      <text class="result-message">{{ executeResult.message || '执行完成' }}</text>
    </view>
    <!-- #endif -->

    <!-- #ifndef MP-WEIXIN -->
    <view class="card tips-card">
      <text class="section-title">数据库批量查找替换</text>
      <text class="tip-item">- 当前工具仅在微信小程序端启用</text>
      <text class="tip-item">- 其他平台默认隐藏数据库批量操作能力</text>
      <text class="tip-item">- 如需扩展到 H5 或 App，请走对应平台云调用链路</text>
    </view>
    <!-- #endif -->
  </view>
</template>

<script>
let adminManagerApi = null;

// #ifdef MP-WEIXIN
adminManagerApi = require('../../api-cache/admin-manager.js');
// #endif

const { isCurrentUserAdmin } = require('../../utils/admin.js');
const COLLECTION_NAME_REGEXP = /^[A-Za-z0-9_-]+$/;
const FIELD_NAME_REGEXP = /^[A-Za-z0-9_]+(?:\.[A-Za-z0-9_]+)*$/;

export default {
  data() {
    return {
      tips: [],
      collections: [],
      collectionIndex: 0,
      fieldIndex: 0,
      customCollectionName: '',
      customFieldName: '',
      findValue: '',
      replaceValue: '',
      previewResult: null,
      executeResult: null
    };
  },
  computed: {
    safeCollectionIndex() {
      return this.collectionIndex >= 0 ? this.collectionIndex : 0;
    },
    currentCollection() {
      return this.collections[this.safeCollectionIndex] || null;
    },
    isCustomCollection() {
      return this.currentCollection && this.currentCollection.value === '__custom__';
    },
    fieldOptions() {
      const current = this.currentCollection;
      const baseFields = current && Array.isArray(current.fields) ? current.fields : [];
      const options = baseFields.map((field) => ({
        value: field,
        label: field === '__custom__' ? '自定义字段' : field
      }));

      if (!options.some(item => item.value === '__custom__')) {
        options.push({ value: '__custom__', label: '自定义字段' });
      }

      return options;
    },
    safeFieldIndex() {
      return this.fieldIndex >= 0 && this.fieldIndex < this.fieldOptions.length ? this.fieldIndex : 0;
    },
    currentField() {
      return this.fieldOptions[this.safeFieldIndex] || null;
    },
    isCustomField() {
      return this.currentField && this.currentField.value === '__custom__';
    },
    currentCollectionLabel() {
      return this.currentCollection ? this.currentCollection.label : '请选择集合';
    },
    currentFieldLabel() {
      return this.currentField ? this.currentField.label : '请选择字段';
    }
  },
  onLoad() {
    // #ifdef MP-WEIXIN
    if (!this.ensureAdminAccess()) {
      return;
    }
    this.loadConfig();
    // #endif
  },
  methods: {
    navigateTo(url) {
      uni.navigateTo({ url });
    },
    ensureAdminAccess() {
      if (isCurrentUserAdmin()) {
        return true;
      }

      uni.showModal({
        title: '无权限',
        content: '仅管理员可使用该测试页',
        showCancel: false,
        success: () => {
          uni.navigateBack({
            fail: () => {
              uni.switchTab({ url: '/pages/profile/profile' });
            }
          });
        }
      });
      return false;
    },
    async loadConfig() {
      uni.showLoading({ title: '加载中...' });
      try {
        const result = await this.callBatchReplaceAction('getBatchReplaceConfig', {}, '加载配置失败');
        this.tips = Array.isArray(result.tips) ? result.tips : [];
        this.collections = Array.isArray(result.collections) ? result.collections : [];
        this.collectionIndex = 0;
        this.fieldIndex = 0;
      } catch (error) {
        console.error('加载配置失败:', error);
        uni.showToast({ title: error.message || '加载失败', icon: 'none' });
      } finally {
        uni.hideLoading();
      }
    },
    onCollectionChange(event) {
      this.collectionIndex = Number(event.detail.value || 0);
      this.fieldIndex = 0;
      this.customCollectionName = '';
      this.customFieldName = '';
    },
    onFieldChange(event) {
      this.fieldIndex = Number(event.detail.value || 0);
      this.customFieldName = '';
    },
    getResolvedCollectionName() {
      return this.isCustomCollection
        ? (this.customCollectionName || '').trim()
        : ((this.currentCollection && this.currentCollection.value) || '').trim();
    },
    getResolvedFieldName() {
      return this.isCustomField
        ? (this.customFieldName || '').trim()
        : ((this.currentField && this.currentField.value) || '').trim();
    },
    validateParams() {
      const collectionName = this.getResolvedCollectionName();
      const fieldName = this.getResolvedFieldName();
      const findValue = this.findValue;
      const replaceValue = this.replaceValue;

      if (!collectionName) {
        uni.showToast({ title: '请选择集合', icon: 'none' });
        return null;
      }

      if (!COLLECTION_NAME_REGEXP.test(collectionName)) {
        uni.showToast({ title: '集合名格式不正确', icon: 'none' });
        return null;
      }

      if (!fieldName) {
        uni.showToast({ title: '请选择字段', icon: 'none' });
        return null;
      }

      if (!FIELD_NAME_REGEXP.test(fieldName)) {
        uni.showToast({ title: '字段名格式不正确', icon: 'none' });
        return null;
      }

      if (findValue === '') {
        uni.showToast({ title: '查找值不能为空', icon: 'none' });
        return null;
      }

      if (findValue === replaceValue) {
        uni.showToast({ title: '查找值和替换值不能相同', icon: 'none' });
        return null;
      }

      return {
        collectionName,
        fieldName,
        findValue,
        replaceValue
      };
    },
    async previewReplace() {
      const params = this.validateParams();
      if (!params) {
        return;
      }

      uni.showLoading({ title: '预览中...' });
      try {
        const result = await this.callBatchReplaceAction('previewFieldReplace', params, '预览失败');
        this.previewResult = result;
        this.executeResult = null;
        if (!result.matchedCount) {
          uni.showToast({ title: '没有匹配记录', icon: 'none' });
        }
      } catch (error) {
        console.error('预览替换失败:', error);
        uni.showToast({ title: error.message || '预览失败', icon: 'none' });
      } finally {
        uni.hideLoading();
      }
    },
    async executeReplace() {
      const params = this.validateParams();
      if (!params) {
        return;
      }

      const matchedText = this.canReusePreview(params)
        ? `预计会更新 ${this.previewResult.matchedCount} 条记录。`
        : '建议先预览确认命中数据后再执行。';

      const modalResult = await new Promise((resolve) => {
        uni.showModal({
          title: '确认执行替换',
          content: `集合：${params.collectionName}\n字段：${params.fieldName}\n查找值：${params.findValue}\n替换值：${params.replaceValue}\n${matchedText}`,
          confirmText: '确认替换',
          success: resolve,
          fail: () => resolve({ confirm: false })
        });
      });

      if (!modalResult.confirm) {
        return;
      }

      uni.showLoading({ title: '执行中...' });
      try {
        const result = await this.callBatchReplaceAction('executeFieldReplace', params, '替换失败');
        this.executeResult = result;
        uni.showToast({ title: `已更新 ${result.updatedCount || 0} 条`, icon: 'none' });
      } catch (error) {
        console.error('执行替换失败:', error);
        uni.showToast({ title: error.message || '替换失败', icon: 'none' });
      } finally {
        uni.hideLoading();
      }
    },
    canReusePreview(params) {
      if (!this.previewResult) {
        return false;
      }
      return this.previewResult.collectionName === params.collectionName
        && this.previewResult.fieldName === params.fieldName
        && this.previewResult.findValue === params.findValue
        && this.previewResult.replaceValue === params.replaceValue;
    },
    formatDoc(doc) {
      try {
        return JSON.stringify(doc, null, 2);
      } catch (error) {
        return String(doc || '');
      }
    },
    async callBatchReplaceAction(action, payload = {}, fallbackMessage = '操作失败') {
      if (typeof adminManagerApi.callAdminManager !== 'function') {
        throw new Error('admin-manager 模块未正确加载');
      }

      return adminManagerApi.callAdminManager(
        action,
        payload,
        {
          pageTag: `admin-batch-replace:${action}`,
          context: this,
          fallbackMessage
        }
      );
    }
  }
};
</script>

<style scoped>
.container {
  min-height: 100vh;
  background: #f5f5f5;
  padding: 30rpx;
  box-sizing: border-box;
}

.header {
  text-align: center;
  margin-bottom: 36rpx;
  padding-top: 24rpx;
}

.title {
  font-size: 40rpx;
  font-weight: bold;
  color: #333;
  display: block;
  margin-bottom: 10rpx;
}

.subtitle {
  font-size: 26rpx;
  color: #999;
  display: block;
}

.card {
  background: white;
  border-radius: 16rpx;
  box-shadow: 0 6rpx 20rpx rgba(0, 0, 0, 0.05);
  margin-bottom: 24rpx;
}

.menu-list {
  overflow: hidden;
}

.menu-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 30rpx;
  border-bottom: 1rpx solid #f0f0f0;
}

.menu-item:last-child {
  border-bottom: none;
}

.menu-item:active {
  background-color: #f7f8fa;
}

.menu-content {
  flex: 1;
}

.menu-title {
  font-size: 32rpx;
  color: #333;
  display: block;
  margin-bottom: 8rpx;
}

.menu-desc {
  font-size: 24rpx;
  color: #999;
  display: block;
}

.menu-arrow {
  font-size: 40rpx;
  color: #ccc;
  font-weight: 300;
}

.tips-card,
.form-card,
.result-card {
  padding: 28rpx;
}

.section-title {
  display: block;
  font-size: 30rpx;
  font-weight: 600;
  color: #222;
  margin-bottom: 18rpx;
}

.tip-item {
  display: block;
  font-size: 24rpx;
  color: #666;
  line-height: 1.7;
}

.form-item {
  margin-bottom: 24rpx;
}

.label {
  display: block;
  font-size: 26rpx;
  color: #333;
  margin-bottom: 12rpx;
}

.picker,
.input,
.textarea {
  width: 100%;
  box-sizing: border-box;
  background: #f7f8fa;
  border-radius: 12rpx;
  padding: 20rpx 24rpx;
  font-size: 26rpx;
  color: #222;
}

.picker-value {
  min-height: 36rpx;
  line-height: 36rpx;
}

.textarea {
  min-height: 120rpx;
}

.button-row {
  display: flex;
  gap: 20rpx;
}

.btn {
  flex: 1;
  height: 84rpx;
  line-height: 84rpx;
  border-radius: 12rpx;
  font-size: 28rpx;
  color: white;
  border: none;
}

.preview-btn {
  background: #409eff;
}

.execute-btn {
  background: #e67e22;
}

.summary-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 16rpx;
  margin-bottom: 20rpx;
}

.summary-item {
  width: calc(50% - 8rpx);
  background: #f7f8fa;
  border-radius: 12rpx;
  padding: 18rpx 20rpx;
  box-sizing: border-box;
}

.summary-label {
  display: block;
  font-size: 22rpx;
  color: #888;
  margin-bottom: 8rpx;
}

.summary-value {
  display: block;
  font-size: 26rpx;
  color: #222;
  word-break: break-all;
}

.summary-value.highlight {
  color: #409eff;
  font-weight: 600;
}

.summary-value.success {
  color: #2ecc71;
  font-weight: 600;
}

.sample-title {
  display: block;
  font-size: 26rpx;
  font-weight: 600;
  color: #333;
  margin-bottom: 16rpx;
}

.sample-list {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
}

.sample-card {
  background: #f7f8fa;
  border-radius: 12rpx;
  padding: 20rpx;
}

.sample-index {
  display: block;
  font-size: 22rpx;
  color: #888;
  margin-bottom: 12rpx;
}

.sample-json {
  display: block;
  font-size: 22rpx;
  color: #333;
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-all;
  font-family: 'Courier New', monospace;
}

.empty-text,
.result-message {
  display: block;
  font-size: 24rpx;
  color: #666;
  line-height: 1.6;
}
</style>
