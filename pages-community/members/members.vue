<template>
  <community-shell title="" class="community-page">
    <view class="members-heading"><text class="members-title">诗社成员</text><text v-if="society" class="muted">{{ society.name }} · 共 {{ society.memberCount || 0 }} 位成员</text></view>
    <community-state v-if="loading || error" :loading="loading" :error="error" @action="load" />
    <template v-else>
      <view v-if="managers.length" class="member-group">
        <text class="group-title">负责人与管理员</text>
        <view v-for="member in managers" :key="member.userId" class="member-row" @tap="openProfile(member)">
          <image class="avatar" :src="member.avatarUrl || '/static/images/avatar.png'" mode="aspectFill" />
          <text class="grow member-name">{{ member.nickName }}</text>
          <text class="badge">{{ roles[member.role] }}</text>
          <text class="chevron">›</text>
        </view>
      </view>
      <view v-if="members.length" class="member-group">
        <text class="group-title">全部成员</text>
        <view v-for="member in members" :key="member.userId" class="member-row" @tap="openProfile(member)">
          <image class="avatar" :src="member.avatarUrl || '/static/images/avatar.png'" mode="aspectFill" />
          <text class="grow member-name">{{ member.nickName }}</text>
          <text class="chevron">›</text>
        </view>
      </view>
      <community-state v-if="!managers.length && !members.length" />
      <button v-if="hasMore" class="secondary-button" :loading="loadingMore" @tap="more">加载更多</button>
    </template>
  </community-shell>
  <app-overlay-host />
</template>
<script>
import CommunityShell from '@/pages-community/components/society/CommunityShell.vue';
import CommunityState from '@/pages-community/components/society/CommunityState.vue';
import { societyRequest } from '@/api-cache/societies.js';
import { openSocietyPage, ROLE_LABELS, decodeSocietyParam, showSocietyError } from '@/pages-community/utils/society.js';
export default {
  components: { CommunityShell, CommunityState },
  data: () => ({ id: '', society: null, managers: [], members: [], nextSkip: 0, hasMore: false, roles: ROLE_LABELS, loading: true, loadingMore: false, error: '', requestVersion: 0 }),
  onLoad(options) { this.id = decodeSocietyParam(options.id); this.load(); },
  onReachBottom() { this.more(); },
  methods: {
    open: openSocietyPage,
    openProfile(member) { this.open('profile', { id: this.id, userId: member.userId }); },
    more() { if (this.hasMore && !this.loading && !this.loadingMore) this.load(true); },
    async load(append) {
      const version = ++this.requestVersion;
      this.error = ''; this.loading = !append; this.loadingMore = !!append;
      try {
        const skip = append ? this.nextSkip : 0;
        const result = await societyRequest('memberDirectory', { societyId: this.id, skip, limit: 20 }, this);
        if (version !== this.requestVersion) return;
        this.society = result.society;
        this.managers = result.managers || [];
        this.members = append ? this.members.concat(result.members || []) : (result.members || []);
        this.hasMore = !!result.hasMore;
        this.nextSkip = result.nextSkip ?? skip + 20;
      } catch (error) {
        if (version === this.requestVersion) { if (append) showSocietyError(error); else this.error = error.message; }
      } finally { if (version === this.requestVersion) { this.loading = false; this.loadingMore = false; } }
    }
  }
};
</script>
<style scoped>
@import '@/styles/society.css';
.members-heading { margin: 8rpx 0 30rpx; }
.members-title { display: block; font-size: 68rpx; font-weight: 600; line-height: 1.45; margin: 0 0 8rpx; }
.member-group { margin-top: 36rpx; }
.member-group:first-child { margin-top: 8rpx; }
.group-title { display: block; margin-bottom: 8rpx; font-size: 30rpx; font-weight: 600; }
.member-row { display: flex; gap: 20rpx; align-items: center; padding: 24rpx 0; border-bottom: 1rpx solid var(--app-border-color, #e6e0da); }
.member-row .avatar { width: 68rpx; height: 68rpx; }
.member-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.chevron { color: var(--app-muted-text, #b3a9a2); }
</style>
