<template>
  <community-shell title="平台 · 诗社入驻审核" class="community-page">
    <text class="title">入驻审核</text>
    <community-tabs v-model="status" :tabs="tabs" @update:model-value="changeStatus" />
    <community-state v-if="loading || error" :loading="loading" :error="error" :action="authNeeded ? '去登录' : ''" @action="recover" />
    <template v-else>
      <view v-for="item in applications" :key="item._id" class="panel">
        <view class="row"><image class="avatar" :src="item.avatarDisplay || item.avatarUrl || fallback" mode="aspectFit" /><view class="grow"><text class="application-name">{{ item.name }}</text><view class="muted">{{ item.school }} · {{ item.region }}</view></view><text class="badge">{{ labels[item.status] }}</text></view>
        <view class="application-meta">负责人：{{ item.contactName }}<br />联系电话：{{ item.phone }}<br />招募范围：{{ recruitmentLabels[item.recruitment] || recruitmentLabels.open }}<br />提交时间：{{ date(item.submittedAt) }}</view>
        <view class="body-text">{{ item.description }}</view>
        <view class="proof-images"><image v-for="(url, index) in item.proofUrls" :key="index" :src="url" mode="aspectFill" @tap="preview(item, index)" /></view>
        <template v-if="item.status === 'pending'"><textarea v-model="notes[item._id]" class="field-area" maxlength="300" placeholder="审核意见（退回修改时必填）" /><view class="actions"><button class="secondary-button" :disabled="!!busy" @tap="review(item, 'rejected')">退回修改</button><button class="primary-button" :disabled="!!busy" :loading="busy === item._id" @tap="review(item, 'approved')">通过并开通</button></view></template>
        <view v-else-if="item.reviewNote" class="notice">{{ item.reviewNote }}</view>
      </view>
      <community-state v-if="!applications.length" />
      <button v-if="hasMore" class="secondary-button" :loading="loadingMore" @tap="more">加载更多</button>
    </template>
  </community-shell>
  <app-overlay-host />
</template>
<script>
import CommunityShell from '@/components/society/CommunityShell.vue';
import CommunityTabs from '@/components/society/CommunityTabs.vue';
import CommunityState from '@/components/society/CommunityState.vue';
import { societyRequest } from '@/api-cache/societies.js';
import { openSocietyPage, openSocietyLogin, societyDate, APPLICATION_LABELS, RECRUITMENT_LABELS, SOCIETY_AVATAR, showSocietyError } from '@/utils/society.js';
export default {
  components: { CommunityShell, CommunityTabs, CommunityState },
  data: () => ({ status: 'pending', tabs: [{ value: 'pending', label: '待审核' }, { value: 'approved', label: '已通过' }, { value: 'rejected', label: '已退回' }], applications: [], notes: {}, loading: true, loadingMore: false, hasMore: false, error: '', authNeeded: false, busy: '', version: 0, labels: APPLICATION_LABELS, recruitmentLabels: RECRUITMENT_LABELS, fallback: SOCIETY_AVATAR }),
  onShow() { this.load(); },
  methods: {
    date: societyDate, recover() { if (this.authNeeded) openSocietyLogin(); else this.load(); },
    changeStatus(value) { this.status = value; this.load(); },
    more() { if (this.hasMore && !this.loadingMore && !this.loading) this.load(true); },
    preview(item, index) { uni.previewImage({ urls: item.proofUrls, current: item.proofUrls[index] }); },
    async load(append = false) {
      const version = ++this.version;
      this.loading = !append; this.loadingMore = append; this.error = ''; this.authNeeded = false;
      try {
        const result = await societyRequest('listApplications', { status: this.status, skip: append ? this.applications.length : 0 }, this);
        if (version !== this.version) return;
        this.applications = append ? this.applications.concat(result.applications) : result.applications; this.hasMore = result.hasMore;
      } catch (error) { if (version === this.version) { this.error = error.message; this.authNeeded = error.code === 'AUTH_REQUIRED'; } }
      finally { if (version === this.version) { this.loading = false; this.loadingMore = false; } }
    },
    async review(item, decision) {
      if (this.busy) return;
      const note = (this.notes[item._id] || '').trim();
      if (decision === 'rejected' && !note) { uni.showToast({ title: '请填写退回原因', icon: 'none' }); return; }
      this.busy = item._id;
      try { await societyRequest('reviewApplication', { applicationId: item._id, revision: item.revision, decision, note }, this); await this.load(); uni.showToast({ title: decision === 'approved' ? '诗社已开通' : '已退回修改', icon: 'none' }); }
      catch (error) { if (error.code !== 'AUTH_REQUIRED') showSocietyError(error); } finally { this.busy = ''; }
    }
  }
};
</script>
<style scoped>
@import '@/styles/society.css';
.application-name { font-size: 32rpx; font-weight: 600; }
.application-meta { margin: 24rpx 0; font-size: 25rpx; color: var(--app-secondary-text, #7c6f68); line-height: 1.9; }
.proof-images { display: flex; flex-wrap: wrap; gap: 18rpx; margin: 24rpx 0; }
.proof-images image { width: 150rpx; height: 150rpx; border: 1rpx solid var(--app-border-color, #e6e0da); border-radius: 8rpx; }
</style>
