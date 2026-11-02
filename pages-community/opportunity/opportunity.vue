<template>
  <community-shell title="" class="community-page">
    <community-state v-if="loading || error" :loading="loading" :error="error" @action="load" />
    <template v-else-if="item">
      <image v-if="item.coverImage" class="detail-cover" :src="item.coverImage" mode="aspectFill" />
      <text class="title detail-title">{{ item.title }}</text>
      <text class="detail-meta">{{ kind === 'call' ? '截止 ' + date(item.deadline) : item.timeText || date(item.startTime) }}</text>
      <text v-if="kind === 'call'" class="detail-meta">收稿范围：{{ callScopeLabel }}</text>
      <text v-if="kind === 'event' && item.location" class="detail-meta">{{ item.location }}</text>
      <view class="organizer" @tap="open('society', { id: mainHost._id })"><view><text class="muted">主办诗社</text><text class="organizer-name">{{ mainHost.name }}</text></view><image class="avatar" :src="mainHost.avatarUrl || fallback" mode="aspectFit" /></view>
      <view v-for="host in coHosts" :key="host._id" class="organizer" @tap="open('society', { id: host._id })"><view><text class="muted">合办诗社</text><text class="organizer-name">{{ host.name }}</text></view><image class="avatar" :src="host.avatarUrl || fallback" mode="aspectFit" /></view>
      <view class="body-text">{{ item.description }}</view>
      <view v-if="item.requirements" class="section"><text class="section-title">{{ kind === 'call' ? '征稿要求' : '参与须知' }}</text><view class="body-text requirements">{{ item.requirements }}</view></view>
      <work-picker v-if="chooseMode === 'existing'" :busy="busy" original-only @cancel="chooseMode = ''" @select="submit" />
      <view v-else-if="chooseMode === 'options'" class="submission-options"><button class="secondary-button" @tap="chooseMode = 'existing'">选已写的诗</button><button class="primary-button" @tap="compose">去创作</button></view>
      <view v-else class="detail-footer"><button class="primary-button" :disabled="busy || closed" :loading="busy" @tap="participate">{{ registered ? '取消报名' : closed ? '已截止' : kind === 'call' ? '我要投稿' : '我要报名' }}</button></view>
      <view v-if="item.guests && item.guests.length" class="section"><view v-for="(guest, index) in item.guests" :key="index" class="guest"><image class="avatar" :src="guest.avatarUrl || '/static/images/avatar.png'" mode="aspectFill" /><view><text>{{ guest.role || '嘉宾' }} · {{ guest.name }}</text><view class="muted">{{ guest.bio }}</view></view></view></view>
      <view v-if="kind === 'call'" class="section"><view class="section-heading"><text class="section-title">已入选稿件</text><text v-if="works.length" class="muted">{{ works.length }} 首</text></view><society-works v-if="works.length" :items="works" :society-id="item.societyId" feed /><text v-else class="muted">暂无入选稿件</text></view>
    </template>
  </community-shell>
  <app-overlay-host />
</template>
<script>
import CommunityShell from '@/components/society/CommunityShell.vue';
import WorkPicker from '@/components/society/WorkPicker.vue';
import CommunityState from '@/components/society/CommunityState.vue';
import SocietyWorks from '@/components/society/SocietyWorks.vue';
import { societyRequest } from '@/api-cache/societies.js';
import { retryPendingSocietySubmission } from '@/utils/societySubmission.js';
import { openSocietyPage, SOCIETY_AVATAR, CALL_SCOPE_LABELS, decodeSocietyParam, societyDate, showSocietyError } from '@/utils/society.js';
export default {
  components: { CommunityShell, CommunityState, WorkPicker, SocietyWorks }, data: () => ({ id: '', kind: 'event', item: null, hosts: [], works: [], registered: false, chooseMode: '', busy: false, loading: true, error: '', fallback: SOCIETY_AVATAR }),
  computed: {
    callScopeLabel() { return CALL_SCOPE_LABELS[this.item?.audience] || CALL_SCOPE_LABELS.all; },
    closed() { if (!this.item) return true; const deadline = this.kind === 'call' ? this.item.deadline : this.registered ? this.item.startTime : this.item.registrationEnd; return !deadline || new Date(deadline).getTime() <= Date.now(); },
    mainHost() { const found = this.hosts.find(host => host._id === this.item?.societyId); return found || { _id: this.item?.societyId || '', name: this.item?.societyName || '', avatarUrl: this.item?.societyAvatar || '' }; },
    coHosts() { return this.hosts.filter(host => host._id !== this.item?.societyId); }
  },
  onLoad(options) { this.id = decodeSocietyParam(options.id); this.kind = options.kind === 'call' ? 'call' : 'event'; }, onShow() { this.load().then(() => this.retryPending()); },
  methods: { open: openSocietyPage, date: societyDate,
    handleError(error) { if (error.code !== 'AUTH_REQUIRED') showSocietyError(error); },
    async participate() { if (this.busy || this.closed) return; if (this.kind === 'call') { this.chooseMode = 'options'; return; } this.busy = true; try { const result = await societyRequest('registration', { id: this.id, registered: !this.registered }, this); this.registered = result.registered; } catch (error) { this.handleError(error); } finally { this.busy = false; } },
    compose() { this.chooseMode = ''; uni.navigateTo({ url: `/pages-publish/add/add?societyCallId=${encodeURIComponent(this.id)}` }); },
    async retryPending() { if (this.kind !== 'call' || this.error || this.busy) return; const result = await retryPendingSocietySubmission(this.id, this); if (!result.attempted) return; if (result.submitted) { uni.showToast({ title: '投稿成功', icon: 'success' }); await this.load(); } else if (result.error) this.handleError(result.error); },
    async submit(postId) { if (this.busy) return; this.busy = true; try { await societyRequest('submitWork', { id: this.id, postId }, this); this.chooseMode = ''; uni.showToast({ title: '投稿成功', icon: 'success' }); await this.load(); } catch (error) { this.handleError(error); } finally { this.busy = false; } },
    async load() { this.loading = true; this.error = ''; try { const result = await societyRequest('opportunity', { id: this.id, kind: this.kind }, this); this.item = result.item; this.hosts = result.hosts || []; this.works = result.works || []; this.registered = !!result.registered; } catch (error) { this.error = error.message; } finally { this.loading = false; } } }
};
</script>
<style scoped>
@import '@/styles/society.css';
.detail-cover { width: 100%; height: 330rpx; border-radius: 12rpx; margin-bottom: 30rpx; background: var(--app-input-bg, #f3f1ee); }
.detail-title { font-size: 44rpx !important; margin-bottom: 22rpx; }
.detail-meta { display: block; color: var(--app-muted-text, #938680); font-size: 26rpx; margin-top: 10rpx; }
.organizer { display: flex; justify-content: flex-end; gap: 24rpx; align-items: center; text-align: right; margin: 40rpx 0; }
.organizer-name { display: block; font-size: 27rpx; }.organizer .avatar { width: 90rpx; height: 90rpx; }
.requirements { margin-top: 20rpx; color: var(--app-secondary-text, #7c6f68); }
.guest { display: flex; gap: 24rpx; align-items: center; margin-bottom: 30rpx; }
.detail-footer { display: flex; justify-content: flex-end; margin-top: 40rpx; }
.detail-footer .primary-button { opacity: 1; }
.submission-options { display: flex; gap: 20rpx; margin: 64rpx 0 32rpx; }.submission-options button { flex: 1; min-width: 0; min-height: 76rpx; }
</style>
