<template>
  <community-shell title="" class="community-page">
    <community-state v-if="loading || error" :loading="loading" :error="error" :action="authNeeded ? '去登录' : ''" @action="recover" />
    <template v-else-if="society">
      <view class="row"><view class="grow"><text class="title">{{ society.name }}·管理</text><text v-if="society.motto" class="muted">{{ society.motto }}</text><button class="text-button" @tap="editProfile = !editProfile">{{ editProfile ? '收起资料' : '编辑资料' }}</button></view><image class="avatar" :src="society.avatarUrl || fallback" mode="aspectFit" /></view>
      <view v-if="editProfile" class="panel"><view v-for="field in profileFields" :key="field.key" class="field"><text class="field-label">{{ field.label }}</text><input v-model="profileForm[field.key]" class="field-input" :maxlength="field.max" /></view><view class="field"><text class="field-label">招募范围</text><picker :range="recruitmentOptions" range-key="label" :value="recruitmentIndex" @change="profileForm.recruitment = recruitmentOptions[$event.detail.value].value"><view class="field-input picker-value">{{ recruitmentLabel }}<text class="picker-arrow">›</text></view></picker></view><view class="field"><text class="field-label">简介</text><textarea v-model="profileForm.description" class="field-area" maxlength="1000" /></view><view class="row"><button class="text-button" :disabled="uploading" @tap="uploadAvatar">更换头像</button><image :src="profileAvatar || society.avatarUrl || fallback" class="avatar" mode="aspectFill" /></view><button class="primary-button" :disabled="!!busy || uploading" @tap="saveProfile">保存资料</button></view>
      <view class="metrics"><view v-for="item in metrics" :key="item.label" class="metric"><text>{{ item.label }}</text><text class="metric-value">{{ item.value }}</text><text class="metric-note">{{ item.note }}</text></view></view>
      <community-tabs v-model="tab" :tabs="tabs" />
      <button v-if="tab !== 'members' && !editor && !selectedCall" class="create-fab" aria-label="发布" @tap="startEdit()"><image src="/static/images/newicons/add.png" mode="aspectFit" /></button>
      <society-editor ref="editorForm" v-if="editor" :key="tab + editId" :society-id="id" :kind="kind" :item-id="editId" @cancel="editor = false" @saved="saved" />
      <template v-else-if="tab === 'members'">
        <view v-for="request in requests" :key="request._id" class="panel">
          <view class="row"><image class="avatar" :src="request.avatarUrl || '/static/images/avatar.png'" mode="aspectFill" /><view class="grow"><text>{{ request.nickName || '诗友' }}</text><view class="muted">{{ date(request.createdAt) }} 申请</view></view><button class="member-approve" :disabled="!!busy" @tap="review(request, 'approved')">通过</button><button class="member-reject" :disabled="!!busy" @tap="rejecting = rejecting === request._id ? '' : request._id">拒绝</button></view>
          <view v-if="rejecting === request._id"><input v-model="notes[request._id]" class="field-input" maxlength="200" placeholder="拒绝原因" /><button class="text-button" :disabled="!!busy" @tap="review(request, 'rejected')">确认拒绝</button></view>
        </view>
        <button v-if="requestsMore" class="text-button" :disabled="!!busy" @tap="moreRequests">更多申请</button>
        <view v-for="member in members" :key="member.userId" class="member-item"><image :src="member.avatarUrl || '/static/images/avatar.png'" mode="aspectFill" @tap="open('profile', { id, userId: member.userId })" /><text class="grow" @tap="open('profile', { id, userId: member.userId })">{{ member.nickName }}</text><text class="badge">{{ roles[member.role] }}</text><button v-if="member.userId === actor && member.role !== 'owner'" class="text-button" @tap="memberAction(member, 'leave')">退出</button><button v-if="owner && member.userId !== actor" class="text-button" @tap="memberMenu(member)">管理</button></view>
        <button v-if="membersMore" class="text-button" :disabled="!!busy" @tap="moreMembers">更多成员</button>
      </template>
      <template v-else-if="roster">
        <view class="row"><text class="grow">{{ roster.title }}</text><button class="text-button" @tap="roster = null">返回</button></view>
        <view v-for="record in registrations" :key="record._id" class="member-item"><image :src="record.avatarUrl || '/static/images/avatar.png'" mode="aspectFill" /><text class="grow">{{ record.nickName }}</text><text class="muted">{{ date(record.createdAt) }}</text></view>
        <button v-if="rosterMore" class="text-button" :disabled="!!busy" @tap="loadRoster(true)">更多</button>
      </template>
      <template v-else-if="tab === 'calls' && selectedCall">
        <submission-review :key="selectedCall._id" :item="selectedCall" :society-id="id" @switch="selectedCall = null" @reviewed="loadStats" />
      </template>
      <template v-else>
        <community-state v-if="contentError" :error="contentError" @action="loadContent(false)" />
        <view v-for="item in records" :key="item._id" :class="tab === 'news' ? 'panel' : 'managed-opportunity'">
          <template v-if="tab === 'news'"><view class="row"><text class="grow">{{ item.title }}</text><button class="text-button" :disabled="!!busy" @tap="change(item, item.pinned ? 'unpin' : 'pin')">{{ item.pinned ? '取消置顶' : '置顶' }}</button><button class="text-button" :disabled="!!busy" @tap="change(item, 'delete')">删除</button></view><text class="muted">{{ date(item.createdAt) }}</text><view class="body-text news-body">{{ item.content }}</view><button class="text-button" @tap="startEdit(item)">编辑</button></template>
          <template v-else><opportunity-card :item="item" :kind="kind" management><template #actions><view class="actions compact-actions" @tap.stop><button v-if="item.societyId === id" class="primary-button" @tap="startEdit(item)">编辑</button><button v-if="tab === 'events'" class="primary-button" @tap="showRoster(item)">预约名单</button><button v-else-if="canReview(item)" class="primary-button" @tap="selectedCall = item">评审</button><button v-else class="primary-button" :disabled="!!busy" @tap="accept(item)">接受合办</button><button v-if="item.societyId === id" class="primary-button" :disabled="!!busy" @tap="change(item, 'delete')">下架</button></view></template></opportunity-card></template>
        </view>
        <button v-if="hasMore" class="text-button" :disabled="contentLoading" @tap="loadContent(true)">更多</button>
      </template>
      <view v-if="tab !== 'members' && !editor && !selectedCall" class="create-fab-spacer" />
    </template>
  </community-shell>
  <app-overlay-host />
</template>
<script>
import OpportunityCard from '@/pages-community/components/society/OpportunityCard.vue';
import CommunityShell from '@/pages-community/components/society/CommunityShell.vue';
import CommunityState from '@/pages-community/components/society/CommunityState.vue';
import CommunityTabs from '@/pages-community/components/society/CommunityTabs.vue';
import SocietyEditor from '@/pages-community/components/society/SocietyEditor.vue';
import SubmissionReview from '@/pages-community/components/society/SubmissionReview.vue';
import { societyRequest } from '@/api-cache/societies.js';
import { societyFileUrls } from '@/api-cache/societies.js';
import { getCurrentUserId } from '@/utils/auth.js';
import { uploadFile } from '@/utils/uploader.js';
import { MANAGE_TABS, ROLE_LABELS, RECRUITMENT_LABELS, RECRUITMENT_OPTIONS, SOCIETY_AVATAR, openSocietyPage, openSocietyLogin, decodeSocietyParam, societyDate, showSocietyError } from '@/pages-community/utils/society.js';
export default {
  components: { OpportunityCard, CommunityShell, CommunityState, CommunityTabs, SocietyEditor, SubmissionReview },
  data: () => ({ id: '', society: null, actor: '', managerRole: '', members: [], membersMore: false, requests: [], requestsMore: false, records: [], stats: {}, notes: {}, tab: 'news', tabs: MANAGE_TABS, roles: ROLE_LABELS, recruitmentOptions: RECRUITMENT_OPTIONS, fallback: SOCIETY_AVATAR, editProfile: false, profileForm: {}, profileAvatar: '', uploadPrefix: '', uploading: false, profileFields: [{ key: 'name', label: '诗社名称', max: 40 }, { key: 'region', label: '地区', max: 40 }, { key: 'motto', label: '口号', max: 60 }],
    loading: true, error: '', authNeeded: false, busy: '', rejecting: '', editor: false, editId: '', selectedCall: null, roster: null, registrations: [], rosterMore: false,
    hasMore: false, contentLoading: false, contentError: '', sequence: 0 }),
  computed: {
    kind() { return { news: 'news', events: 'event', calls: 'call' }[this.tab]; },
    owner() { return this.managerRole === 'owner'; },
    recruitmentIndex() { return Math.max(0, RECRUITMENT_OPTIONS.findIndex(option => option.value === this.profileForm.recruitment)); },
    recruitmentLabel() { return RECRUITMENT_LABELS[this.profileForm.recruitment] || RECRUITMENT_LABELS.open; },
    metrics() { const s = this.stats; return [{ label: '成员', value: s.members ?? this.society.memberCount ?? 0, note: `本周+${s.weekMembers || 0}` }, { label: '作品', value: s.works ?? this.society.workCount ?? 0, note: `本周+${s.weekWorks || 0}` }, { label: '活动报名', value: s.registrations || 0, note: `${s.activeEvents || 0}场进行中` }, { label: '征稿', value: s.submissions || 0, note: `本周+${s.weekSubmissions || 0}` }]; }
  },
  watch: { tab() { this.editor = false; this.selectedCall = null; this.roster = null; this.records = []; this.loadContent(false); } },
  onLoad(options) { this.id = decodeSocietyParam(options.id); }, onShow() { this.load(); },
  methods: {
    open: openSocietyPage, date: societyDate, recover() { if (this.authNeeded) openSocietyLogin(); else this.load(); },
    async load() { this.loading = true; this.error = ''; this.authNeeded = false; try {
      const result = await societyRequest('manage', { societyId: this.id }, this); this.actor = getCurrentUserId(); this.managerRole = result.managerRole; this.society = result.society; this.members = result.members; this.membersMore = result.membersMore; this.requests = result.requests; this.requestsMore = result.requests.length === 20; this.uploadPrefix = result.uploadPrefix; if (!this.editProfile) { this.profileForm = { ...result.society, avatarUrl: result.society.avatarFileId || result.society.avatarUrl }; this.profileAvatar = result.society.avatarUrl; }
      await Promise.all([this.loadStats(), this.loadContent(false)]);
    } catch (error) { this.error = error.message; this.authNeeded = error.code === 'AUTH_REQUIRED'; } finally { this.loading = false; } },
    async loadStats() { try { this.stats = (await societyRequest('statistics', { societyId: this.id }, this)).statistics || {}; } catch (error) { showSocietyError(error); } },
    async moreMembers() { if (this.busy) return; this.busy = 'members'; try { const result = await societyRequest('memberList', { societyId: this.id, skip: this.members.length, limit: 20 }, this); this.members.push(...result.members); this.membersMore = result.hasMore; } catch (error) { showSocietyError(error); } finally { this.busy = ''; } },
    async moreRequests() { if (this.busy) return; this.busy = 'requests'; try { const result = await societyRequest('requestList', { societyId: this.id, skip: this.requests.length, limit: 20 }, this); this.requests.push(...result.requests); this.requestsMore = result.hasMore; } catch (error) { showSocietyError(error); } finally { this.busy = ''; } },
    memberMenu(member) { const actions = member.role === 'admin' ? ['取消管理员', '移交负责人', '移除成员'] : ['设为管理员', '移交负责人', '移除成员']; const operations = member.role === 'admin' ? ['demote', 'transfer', 'remove'] : ['promote', 'transfer', 'remove']; uni.showActionSheet({ itemList: actions, success: ({ tapIndex }) => this.memberAction(member, operations[tapIndex]) }); },
    async memberAction(member, operation) { if (this.busy) return; const titles = { leave: '退出诗社', remove: '移除成员', promote: '设为管理员', demote: '取消管理员', transfer: '移交负责人' }; const response = await new Promise(resolve => uni.showModal({ title: titles[operation], content: member.nickName, success: resolve, fail: () => resolve({ confirm: false }) })); if (!response.confirm) return; this.busy = operation; try { await societyRequest('changeMember', { societyId: this.id, userId: member.userId, operation }, this); if (operation === 'leave') { openSocietyPage('mine'); return; } await this.load(); } catch (error) { showSocietyError(error); } finally { this.busy = ''; } },
    async uploadAvatar() { if (this.uploading) return; this.uploading = true; try { const picked = await new Promise((resolve, reject) => uni.chooseImage({ count: 1, sizeType: ['compressed'], success: resolve, fail: reject })); const path = picked.tempFilePaths[0]; const extension = path.match(/\.(png|jpe?g|webp)(?:\?|$)/i)?.[1] || 'jpg'; const fileId = await uploadFile(`${this.uploadPrefix}/avatar/${Date.now()}.${extension}`, path, { context: this, requireAuth: true, pageTag: 'society-profile' }); if (!fileId) throw new Error('上传失败'); this.profileForm.avatarUrl = fileId; const urls = await societyFileUrls([fileId]); this.profileAvatar = urls[fileId] || fileId; } catch (error) { if (!/cancel/i.test(error.errMsg || '')) showSocietyError(error); } finally { this.uploading = false; } },
    async saveProfile() { if (this.busy || this.uploading) return; this.busy = 'profile'; try { await societyRequest('updateSociety', { societyId: this.id, form: this.profileForm }, this); this.editProfile = false; await this.load(); uni.showToast({ title: '资料已更新', icon: 'none' }); } catch (error) { showSocietyError(error); } finally { this.busy = ''; } },
    async loadContent(more) { const seq = ++this.sequence; if (!this.kind) return; this.contentLoading = true; this.contentError = ''; try {
      const result = await societyRequest('manageContent', { societyId: this.id, kind: this.kind, skip: more ? this.records.length : 0, limit: 20 }, this);
      if (seq !== this.sequence) return; this.records = more ? [...this.records, ...result.records] : result.records; this.hasMore = result.records.length === 20;
      if (this.tab === 'news') this.records.sort((a, b) => Number(!!b.pinned) - Number(!!a.pinned));
    } catch (error) { if (seq === this.sequence) this.contentError = error.message; } finally { if (seq === this.sequence) this.contentLoading = false; } },
    startEdit(item) { this.roster = null; this.selectedCall = null; this.editId = item?._id || ''; this.editor = true; },
    async saved() { this.editor = false; await this.load(); },
    canReview(item) { return item.societyId === this.id || (item.hostSocietyIds || []).includes(this.id); },
    async accept(item) { if (this.busy) return; this.busy = item._id; try { await societyRequest('acceptHost', { societyId: this.id, id: item._id }, this); await this.loadContent(false); } catch (error) { showSocietyError(error); } finally { this.busy = ''; } },
    async change(item, operation) { if (this.busy) return;
      if (operation === 'delete') { const response = await new Promise(resolve => uni.showModal({ title: this.tab === 'news' ? '删除动态' : '下架', content: item.title, success: resolve, fail: () => resolve({ confirm: false }) })); if (!response.confirm) return; }
      this.busy = item._id; try { await societyRequest('changeContent', { societyId: this.id, kind: this.kind, id: item._id, revision: item.revision, operation }, this); await this.loadContent(false); await this.loadStats(); } catch (error) { showSocietyError(error); } finally { this.busy = ''; }
    },
    async showRoster(item) { this.roster = item; this.registrations = []; await this.loadRoster(false); },
    async loadRoster(more) { if (this.busy) return; this.busy = 'roster'; const eventId = this.roster._id; try { const result = await societyRequest('registrations', { id: eventId, skip: more ? this.registrations.length : 0, limit: 20 }, this); if (this.roster?._id !== eventId) return; this.registrations = more ? [...this.registrations, ...result.records] : result.records; this.rosterMore = result.hasMore; } catch (error) { showSocietyError(error); } finally { this.busy = ''; } },
    async review(request, decision) { if (this.busy) return; const note = (this.notes[request._id] || '').trim(); if (decision === 'rejected' && !note) { uni.showToast({ title: '请填写拒绝原因', icon: 'none' }); return; }
      this.busy = request._id; try { await societyRequest('reviewJoin', { societyId: this.id, requestId: request._id, revision: request.revision, decision, note }, this); await this.load(); } catch (error) { if (error.code !== 'AUTH_REQUIRED') showSocietyError(error); } finally { this.busy = ''; }
    }
  }
};
</script>
<style scoped>
@import '@/styles/society.css';
.title { font-size: 48rpx !important; }.row > .avatar { width: 150rpx; height: 150rpx; }.metrics { display: flex; gap: 14rpx; margin: 44rpx 0 18rpx; }.metric { flex: 1; min-width: 0; border: 1rpx solid var(--app-border-color, #e6e0da); border-radius: 10rpx; padding: 22rpx 4rpx; text-align: center; font-size: 23rpx; }.metric-value { display: block; font-size: 42rpx; margin: 10rpx 0; }.metric-note { display: block; font-size: 19rpx; color: #647a37; }
.create-fab { position: fixed; right: 36rpx; bottom: calc(40rpx + env(safe-area-inset-bottom)); z-index: 10; display: flex; align-items: center; justify-content: center; width: 96rpx; height: 96rpx; padding: 0; border: 1rpx solid var(--app-border-color, #e6e0da); border-radius: 50%; background: var(--app-surface-bg, #fff); box-shadow: 0 6rpx 24rpx rgba(0, 0, 0, .12); }
.create-fab image { display: block; width: 64rpx; height: 64rpx; filter: var(--app-icon-filter, none); }
.create-fab-spacer { height: 140rpx; }
.member-item { display: flex; align-items: center; gap: 18rpx; padding: 24rpx 0; border-bottom: 1rpx solid var(--app-border-color, #e6e0da); }.member-item image { width: 70rpx; height: 70rpx; border-radius: 8rpx; }.member-approve, .member-reject { color: #fff; padding: 8rpx 18rpx; border-radius: 20rpx; font-size: 24rpx !important; white-space: nowrap; }.member-approve { background: #506541; }.member-reject { background: #40302d; }
.community-page .compact-actions { justify-content: flex-end; gap: 14rpx; margin-top: 12rpx; }
.community-page .compact-actions > button { flex: 0 0 auto; min-height: 58rpx; padding: 10rpx 22rpx; font-size: 23rpx; white-space: nowrap; }
.news-body { min-height: 220rpx; margin-top: 18rpx; }
.panel picker { display: block; }
.picker-value { display: flex; align-items: center; justify-content: space-between; }
.picker-arrow { color: var(--app-muted-text, #9a8d85); }
</style>
