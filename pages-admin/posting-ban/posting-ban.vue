<template>
  <view class="page">
    <view class="panel">
      <text class="title">限制用户发帖</text>
      <text class="hint">输入用户的诗号（poemId）查询。限制后，该账号无法发布普通帖子、讨论、组诗和拼贴诗；已有内容仍可查看。</text>
      <view class="search-row">
        <input v-model="poemId" class="search-input" placeholder="输入用户诗号" confirm-type="search" @confirm="search" />
        <button class="search-button" :disabled="loading || saving" @tap="search">查询</button>
      </view>
    </view>

    <view v-if="user" class="panel user-panel">
      <view class="user-row">
        <image v-if="user.avatarUrl" class="avatar" :src="user.avatarUrl" mode="aspectFill" />
        <view class="user-details">
          <text class="name">{{ user.nickName || user.poemId }}</text>
          <text class="poem-id">{{ user.poemId }}</text>
        </view>
      </view>
      <text class="status">发帖状态：{{ user.postingBanned ? '已限制' : '正常' }}</text>
      <button class="action-button" :class="{ restore: user.postingBanned }" :disabled="saving" @tap="confirmChange">
        {{ user.postingBanned ? '解除发帖限制' : '限制发帖' }}
      </button>
    </view>
  </view>
  <app-overlay-host />
</template>

<script>
import { findPostingUser, setPostingBan } from '../../api-cache/admin-manager.js';

export default {
  data() {
    return { poemId: '', user: null, loading: false, saving: false };
  },
  methods: {
    async search() {
      const poemId = this.poemId.trim();
      this.user = null;
      if (!poemId) {
        uni.showToast({ title: '请输入用户诗号', icon: 'none' });
        return;
      }
      this.loading = true;
      try {
        const result = await findPostingUser({ poemId, context: this });
        this.user = result.user;
      } catch (error) {
        uni.showToast({ title: error.message || '查询失败', icon: 'none' });
      } finally {
        this.loading = false;
      }
    },
    confirmChange() {
      if (!this.user || this.saving) return;
      const banned = !this.user.postingBanned;
      uni.showModal({
        title: banned ? '确认限制发帖' : '确认解除限制',
        content: `确定要${banned ? '限制' : '恢复'}「${this.user.nickName || this.user.poemId}」的发帖权限吗？`,
        confirmText: banned ? '限制' : '解除',
        confirmColor: banned ? '#d9534f' : '#277d52',
        success: result => { if (result.confirm) this.save(banned); }
      });
    },
    async save(banned) {
      if (!this.user || this.saving) return;
      const poemId = this.user.poemId;
      this.saving = true;
      try {
        const result = await setPostingBan({ poemId, banned, context: this });
        this.user = result.user;
        uni.showToast({ title: banned ? '已限制发帖' : '已解除限制', icon: 'success' });
      } catch (error) {
        uni.showToast({ title: error.message || '操作失败', icon: 'none' });
      } finally {
        this.saving = false;
      }
    }
  }
};
</script>

<style scoped>
.page { min-height: 100vh; padding: 24rpx; background: #f5f5f5; box-sizing: border-box; }
.panel { padding: 32rpx; margin-bottom: 24rpx; background: #fff; border-radius: 16rpx; }
.title { display: block; font-size: 36rpx; font-weight: 600; color: #222; }
.hint { display: block; margin-top: 16rpx; font-size: 26rpx; line-height: 1.6; color: #666; }
.search-row { display: flex; align-items: center; gap: 16rpx; margin-top: 28rpx; }
.search-input { flex: 1; min-width: 0; height: 76rpx; padding: 0 20rpx; background: #f4f4f4; border-radius: 8rpx; font-size: 28rpx; }
.search-button { flex: none; margin: 0; font-size: 28rpx; }
.user-row { display: flex; align-items: center; gap: 20rpx; }
.avatar { width: 88rpx; height: 88rpx; border-radius: 50%; }
.user-details { display: flex; flex-direction: column; gap: 8rpx; }
.name { font-size: 32rpx; color: #222; }
.poem-id { font-size: 25rpx; color: #888; }
.status { display: block; margin: 28rpx 0; font-size: 28rpx; color: #555; }
.action-button { color: #fff; background: #d9534f; font-size: 30rpx; }
.action-button.restore { background: #277d52; }
</style>
