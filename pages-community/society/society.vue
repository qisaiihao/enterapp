<template>
  <community-shell title="" class="community-page">
    <community-state v-if="loading || error" :loading="loading" :error="error" @action="load" />
    <template v-else-if="society">
      <view class="society-heading"><view class="grow"><text class="title">{{ society.name }}</text><text class="school-line">{{ society.school }} · {{ society.region }}</text><text class="recruitment-line">{{ recruitmentLabel }}</text><text v-if="society.foundedAt" class="muted">成立于 {{ date(society.foundedAt) }}</text></view><image class="hero-avatar" :src="society.avatarUrl || fallback" mode="aspectFit" /></view>
      <text v-if="society.motto" class="society-motto">{{ society.motto }}</text>
      <view class="statistics"><view class="stat-entry" @tap="open('members', { id })"><text>{{ society.memberCount || 0 }}</text><text>成员</text></view><view><text>{{ society.workCount || 0 }}</text><text>作品</text></view><view><text>{{ society.eventCount || 0 }}</text><text>活动</text></view></view>
      <view class="actions">
        <button class="secondary-button" :disabled="busy" @tap="follow">{{ relationship.following ? '已关注' : '关注' }}</button>
        <button v-if="!relationship.role" class="primary-button" :disabled="busy" @tap="joinAction">{{ relationship.joinStatus === 'pending' ? '申请中 · 撤回' : '加入' }}</button>
        <button v-else class="secondary-button" disabled>已加入</button>
        <button v-if="canManage" class="primary-button" @tap="open('manage', { id })">管理入口</button>
      </view>
      <view v-if="showJoin" class="notice"><text class="field-label">向诗社介绍一下自己</text><textarea v-model="joinReason" class="field-area" maxlength="300" placeholder="你的学校、写诗经历，或想加入的理由" /><view class="actions"><button class="secondary-button" @tap="showJoin = false">取消</button><button class="primary-button" :disabled="busy || !joinReason.trim()" @tap="submitJoin">提交申请</button></view></view>
      <community-tabs v-model="tab" :tabs="tabs" />
      <template v-if="tab === 'news'"><view v-for="item in news" :key="item._id" class="panel"><view class="row spread"><text>{{ item.title }}</text><text v-if="item.pinned" class="badge">置顶</text></view><text class="muted">{{ date(item.createdAt) }}</text><view class="body-text">{{ item.content }}</view></view><community-state v-if="!news.length" /></template>
      <template v-if="tab === 'works'"><button v-if="relationship.role && !choosing" class="text-button" aria-label="发表作品" @tap="choosing = true">＋</button><work-picker v-if="choosing" label="发表" :busy="busy" @cancel="choosing = false" @select="publish" /><society-works :items="works" :society-id="id" feed /><community-state v-if="!works.length" /><button v-if="worksMore" class="text-button more-works" :disabled="worksLoading" @tap="moreWorks">{{ worksLoading ? '加载中' : '更多作品' }}</button></template>
      <template v-if="tab === 'events'"><opportunity-card v-for="item in events" :key="item._id" :item="item" @select="eventDetail" /><community-state v-if="!events.length" /></template>
      <template v-if="tab === 'calls'"><opportunity-card v-for="item in calls" :key="item._id" kind="call" :item="item" @select="callDetail" /><community-state v-if="!calls.length" /></template>
      <template v-if="tab === 'about'"><text class="section-title">关于我们</text><view class="body-text about-copy">{{ society.description }}</view><view v-if="members.length" class="section"><text class="section-title">诗社成员</text><view v-for="member in members" :key="member.userId" class="member-row" @tap="open('profile', { id, userId: member.userId })"><image class="avatar" :src="member.avatarUrl || '/static/images/avatar.png'" mode="aspectFill" /><text class="grow">{{ member.nickName }}</text><text class="badge">{{ roles[member.role] }}</text><text>›</text></view><button v-if="membersMore" class="text-button" :disabled="busy" @tap="moreMembers">更多成员</button></view></template>
    </template>
  </community-shell>
  <app-overlay-host />
</template>
<script>
import WorkPicker from '@/components/society/WorkPicker.vue';
import CommunityShell from '@/components/society/CommunityShell.vue';
import CommunityTabs from '@/components/society/CommunityTabs.vue';
import CommunityState from '@/components/society/CommunityState.vue';
import OpportunityCard from '@/components/society/OpportunityCard.vue';
import SocietyWorks from '@/components/society/SocietyWorks.vue';
import { societyRequest } from '@/api-cache/societies.js';
import { openSocietyPage, SOCIETY_AVATAR, SOCIETY_TABS, ROLE_LABELS, RECRUITMENT_LABELS, decodeSocietyParam, societyDate, showSocietyError } from '@/utils/society.js';
export default {
  components: { WorkPicker, CommunityShell, CommunityTabs, CommunityState, OpportunityCard, SocietyWorks },
  data: () => ({ id: '', society: null, relationship: {}, viewerId: '', members: [], membersMore: false, news: [], works: [], worksCursor: '', worksMore: false, worksLoading: false, worksVersion: 0, events: [], calls: [], tab: 'news', tabs: SOCIETY_TABS, roles: ROLE_LABELS, fallback: SOCIETY_AVATAR, loading: true, error: '', busy: false, choosing: false, showJoin: false, joinReason: '' }),
  computed: { canManage() { return ['owner', 'admin'].includes(this.relationship.role); }, recruitmentLabel() { return RECRUITMENT_LABELS[this.society?.recruitment] || RECRUITMENT_LABELS.open; } },
  onLoad(options) { this.id = decodeSocietyParam(options.id); }, onShow() { this.load(); },
  onPullDownRefresh() { this.load().finally(() => uni.stopPullDownRefresh()); },
  onReachBottom() { if (this.tab === 'works') this.moreWorks(); },
  methods: {
    open: openSocietyPage, date: societyDate,
    eventDetail(item) { this.open('opportunity', { id: item._id, kind: 'event' }); }, callDetail(item) { this.open('opportunity', { id: item._id, kind: 'call' }); },
    async load() {
      ++this.worksVersion;
      this.worksLoading = false;
      this.loading = true; this.error = '';
      try { const data = await societyRequest('detail', { societyId: this.id }, this); for (const key of ['society', 'relationship', 'viewerId', 'members', 'news', 'works', 'events', 'calls']) this[key] = data[key]; this.membersMore = this.members.length === 50; this.worksCursor = data.worksCursor || ''; this.worksMore = !!data.worksMore; }
      catch (error) { this.error = error.message; } finally { this.loading = false; }
    },
    async moreWorks() { if (this.loading || this.worksLoading || !this.worksMore) return; const version = this.worksVersion; this.worksLoading = true; try {
      const result = await societyRequest('societyWorks', { societyId: this.id, cursor: this.worksCursor, limit: 12 }, this);
      if (version !== this.worksVersion) return;
      this.works.push(...result.works); this.worksCursor = result.cursor; this.worksMore = result.hasMore;
    } catch (error) { if (version === this.worksVersion) showSocietyError(error); } finally { if (version === this.worksVersion) this.worksLoading = false; } },
    async moreMembers() { if (this.busy) return; this.busy = true; try { const result = await societyRequest('publicMembers', { societyId: this.id, skip: this.members.length, limit: 20 }, this); this.members.push(...result.members); this.membersMore = result.hasMore; } catch (error) { showSocietyError(error); } finally { this.busy = false; } },
    async mutate(action, payload) {
      if (this.busy) return;
      this.busy = true;
      try { await societyRequest(action, { societyId: this.id, ...payload }, this); this.showJoin = false; await this.load(); }
      catch (error) { if (error.code !== 'AUTH_REQUIRED') showSocietyError(error); }
      finally { this.busy = false; }
    },
    async publish(postId) { await this.mutate('publishWork', { postId }); this.choosing = false; },
    follow() { return this.mutate('follow', { following: !this.relationship.following }); },
    joinAction() { if (this.relationship.joinStatus === 'pending') return this.mutate('cancelJoin'); this.showJoin = !this.showJoin; },
    submitJoin() { return this.mutate('applyJoin', { reason: this.joinReason }); }
  }
};
</script>
<style scoped>
@import '@/styles/society.css';
.society-heading { display: flex; align-items: flex-start; gap: 28rpx; margin-top: 12rpx; }
.hero-avatar { width: 156rpx; height: 156rpx; border: 1rpx solid var(--app-border-color, #ded5cc); border-radius: 8rpx; background: #fff; flex-shrink: 0; }
.school-line { display: block; margin: 18rpx 0 7rpx; font-size: 25rpx; color: var(--app-muted-text, #938680); }
.recruitment-line { display: block; margin: 0 0 7rpx; font-size: 23rpx; color: var(--app-muted-text, #938680); }
.society-motto { display: block; text-align: right; margin-top: 24rpx; color: var(--app-muted-text, #938680); font-size: 26rpx; }
.statistics { display: flex; gap: 56rpx; margin: 34rpx 0 40rpx; }
.statistics view { display: flex; flex-direction: column; }
.statistics text:first-child { font-size: 40rpx; line-height: 1.4; }
.statistics text:last-child { font-size: 23rpx; color: var(--app-muted-text, #938680); }
.manage-link { text-align: right; margin-top: 12rpx; }
.about-copy { margin: 24rpx 0 40rpx; color: var(--app-secondary-text, #7c6f68); }
.member-row { display: flex; gap: 20rpx; align-items: center; padding: 24rpx 0; border-bottom: 1rpx solid var(--app-border-color, #e6e0da); }
.member-row .avatar { width: 68rpx; height: 68rpx; }
</style>
