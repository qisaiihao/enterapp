<template>
  <community-shell title="" class="community-page">
    <community-state v-if="loading || error" :loading="loading" :error="error" @action="load" />
    <template v-else-if="profile">
      <view class="row profile-heading"><view class="grow"><text class="title">{{ profile.nickName }}</text><text class="profile-role">{{ society.name }} · {{ roles[profile.role] || '作者' }}</text><text v-if="profile.bio" class="muted">{{ profile.bio }}</text></view><image class="profile-avatar" :src="profile.avatarUrl || '/static/images/avatar.png'" mode="aspectFill" /></view>
      <view class="section-heading section"><text class="section-title">诗社作品</text><text class="muted">{{ works.length }} 首{{ hasMore ? '+' : '' }}</text></view>
      <society-works :items="works" :society-id="id" feed />
      <community-state v-if="!works.length" />
      <button v-if="hasMore" class="secondary-button" :loading="loadingMore" @tap="more">更多作品</button>
    </template>
  </community-shell>
  <app-overlay-host />
</template>
<script>
import CommunityShell from '@/components/society/CommunityShell.vue';
import CommunityState from '@/components/society/CommunityState.vue';
import SocietyWorks from '@/components/society/SocietyWorks.vue';
import { societyRequest } from '@/api-cache/societies.js';
import { openSocietyPage, ROLE_LABELS, decodeSocietyParam, showSocietyError } from '@/utils/society.js';
export default {
  components: { CommunityShell, CommunityState, SocietyWorks },
  data: () => ({ id: '', userId: '', society: null, profile: null, works: [], hasMore: false, cursor: '', loading: true, loadingMore: false, error: '', roles: ROLE_LABELS }),
  onLoad(options) { this.id = decodeSocietyParam(options.id); this.userId = decodeSocietyParam(options.userId); this.load(); },
  methods: {
    open: openSocietyPage,
    async load() {
      this.loading = true; this.error = '';
      try { const result = await societyRequest('profile', { societyId: this.id, userId: this.userId }, this); Object.assign(this, { society: result.society, profile: result.profile, works: result.works, hasMore: result.hasMore, cursor: result.cursor }); }
      catch (error) { this.error = error.message; } finally { this.loading = false; }
    },
    async more() {
      if (this.loadingMore || !this.hasMore) return;
      this.loadingMore = true;
      try { const result = await societyRequest('profile', { societyId: this.id, userId: this.userId, cursor: this.cursor }, this); this.works.push(...result.works); this.hasMore = result.hasMore; this.cursor = result.cursor; }
      catch (error) { showSocietyError(error); } finally { this.loadingMore = false; }
    }
  }
};
</script>
<style scoped>
@import '@/styles/society.css';
.profile-heading { align-items: flex-start; margin: 16rpx 0 36rpx; }
.profile-avatar { width: 156rpx; height: 156rpx; border-radius: 12rpx; border: 1rpx solid var(--app-border-color, #e6e0da); }
.profile-role { display: block; font-size: 25rpx; margin: 20rpx 0 12rpx; color: var(--app-muted-text, #938680); }
.profile-scope { display: flex; align-items: center; justify-content: space-between; gap: 20rpx; border-top: 1rpx solid var(--app-border-color, #e6e0da); border-bottom: 1rpx solid var(--app-border-color, #e6e0da); padding: 24rpx 0; font-size: 24rpx; }
.profile-scope text:last-child { color: var(--app-muted-text, #938680); }
.scope-note { display: block; font-size: 23rpx; color: var(--app-muted-text, #938680); margin: -8rpx 0 30rpx; }
</style>
