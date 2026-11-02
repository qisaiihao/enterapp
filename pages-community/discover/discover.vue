<template>
  <community-shell title="" class="community-page">
    <view class="search-row"><input v-model="query" class="search-input" :focus="autofocus" maxlength="40" placeholder="搜索学校、诗社、地区" confirm-type="search" @confirm="search" /><button class="search-submit" aria-label="搜索" @tap="search"><image src="/static/images/newicons/search.png" mode="aspectFit" /></button></view>
    <community-state v-if="loading || error" :loading="loading" :error="error" @action="search" />
    <template v-else><society-card v-for="item in items" :key="item._id" :society="item" followable :followed="!!item.following" @select="select" @follow="followSociety" /><community-state v-if="!items.length" /><button v-if="hasMore" class="secondary-button" :loading="loadingMore" @tap="more">加载更多</button></template>
  </community-shell>
  <app-overlay-host />
</template>
<script>
import CommunityShell from '@/components/society/CommunityShell.vue';
import CommunityState from '@/components/society/CommunityState.vue';
import SocietyCard from '@/components/society/SocietyCard.vue';
import { societyRequest } from '@/api-cache/societies.js';
import { openSocietyPage, showSocietyError } from '@/utils/society.js';
export default {
  components: { CommunityShell, CommunityState, SocietyCard },
  data: () => ({ query: '', applied: {}, items: [], loading: true, loadingMore: false, error: '', hasMore: false, requestVersion: 0, autofocus: false }),
  onLoad(options = {}) { this.focusOnLoad = String(options.focus) === '1'; },
  onShow() { this.search(); },
  onReady() { if (this.focusOnLoad) setTimeout(() => { this.autofocus = true; }, 60); },
  onReachBottom() { this.more(); },
  methods: {
    open: openSocietyPage, select(item) { this.open('society', { id: item._id }); },
    async followSociety(item) { try { await societyRequest('follow', { societyId: item._id, following: true }, this); item.following = true; } catch (error) { if (error.code !== 'AUTH_REQUIRED') showSocietyError(error); } },
    clear() { this.query = ''; this.search(); },
    async search() { this.applied = { query: this.query.trim() }; this.items = []; await this.load(false); },
    more() { if (this.hasMore && !this.loading && !this.loadingMore) return this.load(true); },
    async load(append) {
      const version = ++this.requestVersion;
      this.error = ''; this.loading = !append; this.loadingMore = append;
      try {
        const result = await societyRequest('list', { ...this.applied, skip: append ? this.items.length : 0, limit: 12 }, this);
        if (version !== this.requestVersion) return;
        this.items = append ? this.items.concat(result.societies) : result.societies; this.hasMore = result.hasMore;
      } catch (error) { if (version === this.requestVersion) this.error = error.message; }
      finally { if (version === this.requestVersion) { this.loading = false; this.loadingMore = false; } }
    }
  }
};
</script>
<style scoped>
@import '@/styles/society.css';
.search-row { display: flex; align-items: center; margin: 0 0 16rpx; padding: 0 20rpx; border-radius: 50rpx; background: var(--app-input-bg, #f1f1ee); }
.search-input { flex: 1; height: 76rpx; font-size: 25rpx; min-width: 0; }
.search-submit { padding: 8rpx; background: transparent; }
.search-submit image { width: 40rpx; height: 40rpx; }
</style>
