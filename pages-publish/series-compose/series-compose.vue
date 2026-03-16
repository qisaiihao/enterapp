<template>
  <view class="series-compose-page">
    <view class="header">
      <view class="title">组诗合成</view>
      <view class="tip">选择你发布过的短诗，合成为一首组诗</view>
    </view>

    <view v-if="step === 'select'" class="select-list">
      <view v-for="item in singles" :key="item._id" class="single-item" @tap="toggleSelect(item._id)">
        <view class="checkbox" :class="{ checked: selectedIds.includes(item._id) }"></view>
        <view class="single-text">
          <text class="single-title">{{ item.title || '未命名' }}</text>
          <text class="single-preview">{{ (item.content || '').split('\\n').slice(0,2).join(' / ') }}</text>
        </view>
      </view>
      <view v-if="singles.length === 0" class="empty">暂无可合成的短诗</view>
      <button class="primary-btn" :disabled="selectedIds.length === 0" @tap="goEdit">下一步（{{ selectedIds.length }}）</button>
    </view>

    <view v-else class="edit-panel">
      <view class="field">
        <text class="label">组诗标题</text>
        <input class="input" placeholder="输入组诗标题" v-model="seriesTitle" />
      </view>
        <view class="block-item" v-for="(b, idx) in blocks" :key="b.postId">
          <view class="block-header">
            <text class="label">小标题</text>
            <textarea
              class="input subtitle-textarea"
              v-model="b.subtitle"
              auto-height
              placeholder="输入小标题"
              maxlength="80"
              show-confirm-bar="false"
            ></textarea>
          </view>
          <view class="actions-row">
            <button size="mini" @tap="moveBlock(idx,-1)" :disabled="idx===0">上移</button>
            <button size="mini" @tap="moveBlock(idx,1)" :disabled="idx===blocks.length-1">下移</button>
            <button size="mini" type="warn" @tap="removeBlock(idx)">删除</button>
          </view>
          <view class="block-content">
            <text v-for="(line, li) in b.preview" :key="li">{{ line }}</text>
          </view>
        </view>
      <button class="primary-btn" :disabled="blocks.length===0" @tap="publish">发布组诗</button>
    </view>
  </view>
</template>

<script>
import { cloudCall } from '@/utils/cloudCall.js';

export default {
  data() {
    return {
      step: 'select',
      singles: [],
      selectedIds: [],
      blocks: [],
      seriesTitle: ''
    };
  },
  onLoad() {
    this.fetchSingles();
  },
  methods: {
    async fetchSingles() {
      try {
        const res = await cloudCall('listMySingles', {});
        this.singles = (res.result && res.result.posts) || [];
      } catch (e) {
        console.error('listMySingles failed', e);
        uni.showToast({ title: '加载失败', icon: 'none' });
      }
    },
    toggleSelect(id) {
      const set = new Set(this.selectedIds);
      if (set.has(id)) set.delete(id); else set.add(id);
      this.selectedIds = Array.from(set);
    },
    goEdit() {
      const map = new Map(this.singles.map(p => [p._id, p]));
      this.blocks = this.selectedIds.map((id, i) => {
        const p = map.get(id) || {};
        const lines = (p.content || '').split(/\\r?\\n/).filter(Boolean);
        return {
          postId: id,
          subtitle: p.title || `其${i + 1}`,
          content: p.content || '',
          preview: lines.slice(0, 3)
        };
      });
      if (!this.seriesTitle) {
        this.seriesTitle = this.blocks[0]?.subtitle || '组诗';
      }
      this.step = 'edit';
    },
    moveBlock(idx, delta) {
      const target = idx + delta;
      if (target < 0 || target >= this.blocks.length) return;
      const next = this.blocks.slice();
      const [item] = next.splice(idx, 1);
      next.splice(target, 0, item);
      this.blocks = next;
    },
    removeBlock(idx) {
      const next = this.blocks.slice();
      next.splice(idx, 1);
      this.blocks = next;
      this.selectedIds = next.map(b => b.postId);
    },
    async publish() {
      if (!this.blocks.length) return;
      uni.showLoading({ title: '发布中...' });
      try {
        const payload = {
          title: this.seriesTitle || '组诗',
          blocks: this.blocks.map((b, order) => ({
            postId: b.postId,
            subtitle: b.subtitle || `其${order + 1}`,
            order
          }))
        };
        const res = await cloudCall('createSeriesFromSingles', payload);
        if (res.result && res.result.code === 0) {
          uni.showToast({ title: '发布成功', icon: 'success' });
          uni.setStorageSync('shouldRefreshProfile', true);
          uni.setStorageSync('shouldRefreshIndex', true);
          setTimeout(() => uni.navigateTo({ url: `/pages/post-detail/post-detail?id=${res.result.postId}` }), 300);
        } else {
          uni.showToast({ title: res.result?.msg || '发布失败', icon: 'none' });
        }
      } catch (e) {
        console.error('createSeriesFromSingles failed', e);
        uni.showToast({ title: '发布失败', icon: 'none' });
      } finally {
        uni.hideLoading();
      }
    }
  }
};
</script>

<style scoped>
.series-compose-page {
  padding: 24rpx;
  background: #f7f7f7;
  min-height: 100vh;
  box-sizing: border-box;
}
.header .title {
  font-size: 36rpx;
  font-weight: 700;
}
.header .tip {
  color: #888;
  margin-top: 6rpx;
  font-size: 24rpx;
}
.select-list .single-item {
  display: flex;
  align-items: center;
  background: #fff;
  padding: 20rpx;
  border-radius: 16rpx;
  margin-top: 16rpx;
  box-shadow: 0 8rpx 20rpx rgba(0,0,0,0.05);
}
.checkbox {
  width: 32rpx;
  height: 32rpx;
  border-radius: 50%;
  border: 2rpx solid #888;
  margin-right: 20rpx;
}
.checkbox.checked {
  background: #3b7cff;
  border-color: #3b7cff;
}
.single-text .single-title {
  display: block;
  font-size: 30rpx;
  font-weight: 600;
  color: #333;
}
.single-text .single-preview {
  display: block;
  color: #888;
  margin-top: 6rpx;
  font-size: 24rpx;
}
.primary-btn {
  margin-top: 24rpx;
  background: #3b7cff;
  color: #fff;
  border-radius: 12rpx;
}
.empty {
  text-align: center;
  color: #999;
  margin-top: 40rpx;
}
.edit-panel .field {
  margin: 16rpx 0;
}
.label {
  font-size: 26rpx;
  color: #666;
}
.input {
  margin-top: 8rpx;
  padding: 16rpx;
  border-radius: 12rpx;
  background: #fff;
  box-shadow: 0 8rpx 20rpx rgba(0,0,0,0.05);
}
.block-item {
  background: #fff;
  border-radius: 16rpx;
  padding: 16rpx;
  margin-top: 16rpx;
  box-shadow: 0 8rpx 20rpx rgba(0,0,0,0.05);
}
.block-header {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  gap: 10rpx;
}
.block-header .label {
  flex: 0 0 110rpx;
}
.block-header .input {
  flex: 1 1 auto;
  min-width: 0;
  padding: 12rpx 16rpx;
  box-sizing: border-box;
  line-height: 40rpx;
  height: auto;
}
.subtitle-textarea {
  display: block;
  flex: 1 1 auto;
  width: auto;
  min-width: 0;
  min-height: 64rpx;
  max-height: 320rpx;
  padding: 12rpx 16rpx;
  line-height: 40rpx;
  background: #fff;
  border-radius: 12rpx;
  box-shadow: 0 8rpx 20rpx rgba(0,0,0,0.05);
  overflow: hidden;
  white-space: normal;
  word-break: break-all;
}
.actions-row {
  margin-top: 8rpx;
  display: flex;
  justify-content: flex-end;
  gap: 8rpx;
}
.block-content {
  margin-top: 12rpx;
  color: #555;
  font-size: 26rpx;
  line-height: 36rpx;
}
</style>
