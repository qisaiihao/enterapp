<template>
  <community-shell title="" class="community-page">
    <view class="mine-heading"><view><text class="title">{{ viewer.nickName || '我的诗社' }}</text><text v-if="viewer.school" class="muted">{{ viewer.school }}</text></view><image class="mine-avatar" :src="viewer.avatarUrl || '/static/images/avatar.png'" mode="aspectFill" /></view>
    <community-tabs v-model="tab" :tabs="tabs" />
    <community-state v-if="loading || error" :loading="loading" :error="error" :action="authNeeded ? '去登录' : ''" @action="recover" />
    <template v-else>
      <template v-if="tab === 'following'"><society-card v-for="item in displayed" :key="item._id" :society="item" @select="select" /><community-state v-if="!displayed.length" /></template>
      <template v-else-if="tab === 'joined'"><view v-for="item in joined" :key="item._id" class="panel"><view class="row"><text class="grow" @tap="select(item)">{{ item.name }} · {{ roles[item.role] }}</text><button v-if="item.role === 'owner' || item.role === 'admin'" class="text-button" @tap="open('manage', { id: item._id })">管理</button><button v-if="item.role !== 'owner'" class="text-button" @tap="leave(item)">退出</button></view></view><community-state v-if="!joined.length" /></template>
      <template v-else>
        <view v-for="record in submissions" :key="record._id" class="panel submission" @tap="openPoem(record)">
          <view class="row"><text class="grow">《{{ record.title || '无题' }}》</text><text class="badge">{{ statuses[record.status] }}</text></view>
          <view class="muted">{{ record.item ? record.item.title : '征稿已下架' }}　{{ date(record.submittedAt) }}</view>
          <view class="actions submission-actions">
            <button v-if="record.status !== 'approved' && record.status !== 'withdrawn'" class="text-button" :disabled="busy" @tap.stop="withdraw(record)">撤回</button>
            <button v-if="record.item" class="primary-button continue-button" @tap.stop="continueSubmit(record)">继续投稿</button>
          </view>
        </view>
        <button v-if="hasMore" class="text-button" :disabled="busy" @tap="moreSubmissions">更多</button>
      </template>
    </template>
  </community-shell>
  <app-overlay-host />
</template>
<script>
import CommunityShell from '@/pages-community/components/society/CommunityShell.vue';
import CommunityState from '@/pages-community/components/society/CommunityState.vue';
import CommunityTabs from '@/pages-community/components/society/CommunityTabs.vue';
import SocietyCard from '@/pages-community/components/society/SocietyCard.vue';
import { societyRequest } from '@/api-cache/societies.js';
import { openSocietyPage, openSocietyLogin, societyDate, showSocietyError } from '@/pages-community/utils/society.js';
import { navigateToPostDetail } from '@/utils/navigation.js';
export default {
  components: { CommunityShell, CommunityState, CommunityTabs, SocietyCard },
  data: () => ({ tab: 'following', tabs: [{ value: 'following', label: '我的关注' }, { value: 'joined', label: '已加入' }, { value: 'submissions', label: '我的投稿' }], roles: { owner: '负责人', admin: '管理员', member: '成员' }, viewer: {}, societies: [], submissions: [], hasMore: false, busy: false, statuses: { pending: '待审', deferred: '待定', approved: '已入选', rejected: '未通过', withdrawn: '已撤回' }, loading: true, error: '', authNeeded: false }),
  computed: { displayed() { return this.societies.filter(item => item.following); }, joined() { return this.societies.filter(item => item.role); } },
  onShow() { this.load(); },
  methods: {
    date: societyDate,
    async leave(item) { if (this.busy) return; const result = await new Promise(resolve => uni.showModal({ title: '退出诗社', content: item.name, success: resolve, fail: () => resolve({ confirm: false }) })); if (!result.confirm) return; this.busy = true; try { await societyRequest('changeMember', { societyId: item._id, operation: 'leave' }, this); await this.load(); } catch (error) { showSocietyError(error); } finally { this.busy = false; } },
    async moreSubmissions() { if (this.busy) return; this.busy = true; try { await this.loadSubmissions(true); } catch (error) { showSocietyError(error); } finally { this.busy = false; } },
    async loadSubmissions(more) { const result = await societyRequest('myParticipation', { kind: 'call', skip: more ? this.submissions.length : 0, limit: 20 }, this); this.submissions = more ? [...this.submissions, ...result.records] : result.records; this.hasMore = result.hasMore; },
    async withdraw(record) { if (this.busy) return; this.busy = true; try { await societyRequest('withdrawWork', { id: record._id, revision: record.revision }, this); await this.loadSubmissions(false); } catch (error) { showSocietyError(error); } finally { this.busy = false; } },
    openPoem(record) { if (record.postId) navigateToPostDetail(record.postId); },
    continueSubmit(record) { this.open('opportunity', { id: record.callId, kind: 'call' }); },
    open: openSocietyPage, select(item) { this.open('society', { id: item._id }); }, recover() { if (this.authNeeded) openSocietyLogin(); else this.load(); },
    async load() {
      this.loading = true; this.error = ''; this.authNeeded = false;
      try { const result = await societyRequest('mine', {}, this); this.societies = result.societies; await this.loadSubmissions(false); const local = uni.getStorageSync('userInfo'); this.viewer = local && typeof local === 'object' ? local : {}; }
      catch (error) { this.error = error.message; this.authNeeded = error.code === 'AUTH_REQUIRED'; } finally { this.loading = false; }
    }
  }
};
</script>
<style scoped>
@import '@/styles/society.css';
.community-page .submission-actions { justify-content: flex-end; align-items: center; margin-top: 20rpx; }
.community-page .submission-actions > button { flex: none; min-height: 0; padding: 8rpx 22rpx; font-size: 23rpx; line-height: 1.5; border-radius: 8rpx; }
.community-page .submission-actions .continue-button { background: var(--app-control-accent-bg, #403534); color: var(--app-control-accent-text, #fff); }
.mine-heading { display: flex; align-items: flex-start; justify-content: space-between; gap: 24rpx; margin: 16rpx 0 34rpx; }
.mine-avatar { width: 132rpx; height: 132rpx; flex-shrink: 0; border: 1rpx solid var(--app-border-color, #ddd); }
</style>
