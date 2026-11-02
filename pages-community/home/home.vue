<template>
  <community-shell title="" class="community-page">
    <template #actions><button class="text-button" @tap="open('mine')">我的诗社</button></template>
    <view class="home-heading">
      <view><text class="home-title">街坊</text><text class="home-motto">以诗友芳邻，无问西与东</text></view>
      <view class="heading-actions">
        <button class="text-button icon-button notice-button" aria-label="诗社通知" @tap="open('notifications')"><image src="/static/images/newicons/notification.png" mode="aspectFit" /></button>
        <button class="settle-entry" @tap="open('apply')">入驻 ›››</button>
      </view>
    </view>
    <view class="search-box" @tap="startSearch">
      <image class="search-icon" src="/static/images/newicons/search.png" mode="aspectFit" />
      <input class="search-input" :value="query" :focus="searchFocus" maxlength="40" placeholder="搜索学校、诗社、地区" confirm-type="search" @input="onSearchInput" @focus="startSearch" @confirm="runSearch" />
      <button v-if="searching" class="search-cancel" @tap.stop="cancelSearch">取消</button>
    </view>
    <template v-if="searching">
      <view class="search-area">
        <community-state v-if="searchLoading || searchError" :loading="searchLoading" :error="searchError" @action="runSearch" />
        <template v-else>
          <society-card v-for="item in searchResults" :key="item._id" :society="item" followable :followed="!!item.following" @select="selectSociety" @follow="followSociety" />
          <community-state v-if="!searchResults.length && searchQuery" title="没有找到相关诗社" description="试试其他诗社名、学校或地区" />
          <community-state v-if="!searchQuery" title="搜索诗社" description="输入诗社名、学校或地区" />
          <button v-if="searchHasMore" class="secondary-button" :loading="searchLoadingMore" @tap="moreSearch">加载更多</button>
        </template>
      </view>
    </template>
    <template v-else>
      <community-state v-if="loading || error" :loading="loading" :error="error" @action="load" />
      <template v-else>
        <view class="section">
          <view class="section-heading"><text class="section-title">推荐诗社</text><button class="text-button" @tap="open('discover')">更多</button></view>
          <scroll-view v-if="societies.length" scroll-x class="featured-scroll"><view class="featured-row"><society-card v-for="item in societies" :key="item._id" :society="item" compact followable :followed="!!item.following" @select="selectSociety" @follow="followSociety" /></view></scroll-view>
          
        </view>
        <view class="section"><view class="section-heading"><text class="section-title">校园活动</text></view>
          <opportunity-card v-for="item in events" :key="item._id" :item="item" @select="selectEvent" />
          
        </view>
        <view class="section"><view class="section-heading"><text class="section-title section-link" @tap="openCallList">联合征稿</text></view>
          <view class="call-filters"><button v-for="option in callFilters" :key="option.value" :class="['call-filter', { active: callFilter === option.value }]" @tap="callFilter = option.value">{{ option.label }}</button></view>
          <opportunity-card v-for="item in visibleCalls" :key="item._id" kind="call" :item="item" @select="selectCall" />
          <button v-if="hasMoreCalls" class="more-link" @tap="openCallList">更多</button>
        </view>
        <view class="section"><view class="section-heading"><text class="section-title">最新诗社作品</text></view><society-works :items="works" stacked /></view>
        <view class="section"><view class="section-heading"><text class="section-title">发现诗社</text></view><view class="discover-options"><view @tap="open('discover')"><text>诗社地图</text><text>查看诗社分布</text></view><view @tap="open('discover')"><text>发现诗社</text><text>按地区 / 风格检索诗社</text></view></view></view>
      </template>
    </template>
  </community-shell>
  <app-overlay-host />
</template>
<script>
import CommunityShell from '@/components/society/CommunityShell.vue';
import CommunityState from '@/components/society/CommunityState.vue';
import SocietyCard from '@/components/society/SocietyCard.vue';
import OpportunityCard from '@/components/society/OpportunityCard.vue';
import SocietyWorks from '@/components/society/SocietyWorks.vue';
import { societyRequest } from '@/api-cache/societies.js';
import { openSocietyPage, showSocietyError } from '@/utils/society.js';
export default {
  components: { CommunityShell, CommunityState, SocietyCard, OpportunityCard, SocietyWorks },
  data: () => ({ societies: [], events: [], calls: [], pastCalls: [], currentCallTotal: 0, pastCallTotal: 0, works: [], callFilter: 'current', callFilters: [{ value: 'current', label: '正在进行' }, { value: 'ending', label: '即将截止' }, { value: 'past', label: '往期' }], loading: true, error: '', searching: false, searchFocus: false, query: '', searchQuery: '', searchResults: [], searchLoading: false, searchLoadingMore: false, searchError: '', searchHasMore: false, searchVersion: 0, searchTimer: null }),
  computed: {
    visibleCalls() {
      if (this.callFilter === 'past') return this.pastCalls.slice(0, 6);
      const now = Date.now();
      const calls = this.calls.filter(item => item.deadline && new Date(item.deadline).getTime() > now)
        .sort((a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime());
      return this.callFilter === 'ending' ? calls.slice(0, 3) : calls.slice(0, 6);
    },
    hasMoreCalls() { return this.callFilter === 'past' ? this.pastCallTotal > 6 : this.currentCallTotal > (this.callFilter === 'ending' ? 3 : 6); }
  },
  onShow() { if (this.searching && this.searchQuery) this.loadSearch(false); else if (!this.searching) this.load(); },
  onHide() { this.searchFocus = false; },
  onReachBottom() { if (this.searching && this.searchHasMore && !this.searchLoading && !this.searchLoadingMore) this.loadSearch(true); },
  onPullDownRefresh() { Promise.resolve(this.searching ? this.runSearch() : this.load()).finally(() => uni.stopPullDownRefresh()); },
  methods: {
    open: openSocietyPage,
    selectSociety(item) { this.open('society', { id: item._id }); },
    async followSociety(item) { try { await societyRequest('follow', { societyId: item._id, following: true }, this); item.following = true; } catch (error) { if (error.code !== 'AUTH_REQUIRED') showSocietyError(error); } },
    selectEvent(item) { this.open('opportunity', { id: item._id, kind: 'event' }); },
    selectCall(item) { this.open('opportunity', { id: item._id, kind: 'call' }); },
    openCallList() { this.open('calls', { filter: this.callFilter }); },
    startSearch() { this.searching = true; this.searchFocus = true; },
    onSearchInput(event) {
      this.query = (event && event.detail && event.detail.value) || '';
      if (this.searchTimer) { clearTimeout(this.searchTimer); this.searchTimer = null; }
      if (!this.query.trim()) { this.resetSearchResults(); return; }
      this.searchTimer = setTimeout(() => { this.searchTimer = null; this.runSearch(); }, 300);
    },
    resetSearchResults() {
      this.searchVersion++; this.searchQuery = ''; this.searchResults = []; this.searchHasMore = false;
      this.searchError = ''; this.searchLoading = false; this.searchLoadingMore = false;
    },
    runSearch() {
      if (this.searchTimer) { clearTimeout(this.searchTimer); this.searchTimer = null; }
      const value = this.query.trim();
      if (!value) { this.resetSearchResults(); return; }
      this.searchQuery = value; this.searchResults = []; this.searchHasMore = false;
      return this.loadSearch(false);
    },
    moreSearch() { if (this.searchHasMore && !this.searchLoading && !this.searchLoadingMore) return this.loadSearch(true); },
    async loadSearch(append) {
      const version = ++this.searchVersion;
      this.searchError = ''; this.searchLoading = !append; this.searchLoadingMore = append;
      try {
        const result = await societyRequest('list', { query: this.searchQuery, skip: append ? this.searchResults.length : 0, limit: 12 }, this);
        if (version !== this.searchVersion) return;
        this.searchResults = append ? this.searchResults.concat(result.societies) : result.societies;
        this.searchHasMore = result.hasMore;
      } catch (error) { if (version === this.searchVersion) this.searchError = error.message; }
      finally { if (version === this.searchVersion) { this.searchLoading = false; this.searchLoadingMore = false; } }
    },
    cancelSearch() {
      if (this.searchTimer) { clearTimeout(this.searchTimer); this.searchTimer = null; }
      this.searchVersion++;
      this.searching = false; this.searchFocus = false; this.query = '';
      this.searchQuery = ''; this.searchResults = []; this.searchHasMore = false; this.searchError = ''; this.searchLoading = false; this.searchLoadingMore = false;
      if (typeof uni !== 'undefined' && uni.hideKeyboard) uni.hideKeyboard();
    },
    async load() {
      this.loading = true; this.error = '';
      try { const result = await societyRequest('home', {}, this); this.societies = result.societies; this.events = result.events; this.calls = result.calls; this.pastCalls = result.pastCalls || []; this.currentCallTotal = result.currentCallTotal || 0; this.pastCallTotal = result.pastCallTotal || 0; this.works = result.works; }
      catch (error) { this.error = error.message; } finally { this.loading = false; }
    }
  }
};
</script>
<style scoped>
@import '@/styles/society.css';
.home-heading { display: flex; align-items: stretch; justify-content: space-between; gap: 24rpx; margin: 8rpx 0 34rpx; }
.heading-actions { display: flex; flex-direction: column; align-items: flex-end; justify-content: space-between; gap: 12rpx; flex-shrink: 0; }
.notice-button { margin: -4rpx -8rpx 0 0; }
.notice-button image { width: 60rpx; height: 60rpx; }
.home-title { display: block; font-size: 68rpx; font-weight: 600; line-height: 1.45; margin: 0 0 4rpx; }
.home-motto { font-size: 26rpx; color: var(--app-muted-text, #938680); }
.settle-entry { color: var(--app-muted-text, #938680); background: transparent; padding: 0 0 6rpx; flex-shrink: 0; }
.search-box { display: flex; align-items: center; gap: 18rpx; border-radius: 50rpx; padding: 0 28rpx; height: 88rpx; color: var(--app-muted-text, #a0938b); background: var(--app-input-bg, #f3f1ef); font-size: 26rpx; }
.search-icon { width: 32rpx; height: 32rpx; flex: none; opacity: .45; filter: var(--app-icon-filter, none); }
.search-input { flex: 1; min-width: 0; height: 88rpx; font-size: 26rpx; color: var(--app-primary-text, #242020); }
.search-cancel { flex: none; padding: 0 0 0 8rpx; margin: 0; background: transparent; color: var(--app-muted-text, #8a807b); font-size: 24rpx; line-height: 1.6; }
.search-cancel::after { border: 0; }
.search-area { padding-top: 28rpx; }
.empty-line { display: block; padding: 12rpx 0 20rpx; color: var(--app-muted-text, #8a807b); font-size: 24rpx; }
.featured-scroll { width: 100%; }
.featured-row { display: flex; gap: 18rpx; width: max-content; }
.call-filters { display: flex; gap: 8rpx; padding: 7rpx; margin: -4rpx 0 24rpx; background: var(--app-input-bg, #f1f1ee); border-radius: 9rpx; }
.call-filter { flex: 1; padding: 8rpx 0; background: transparent; color: var(--app-muted-text, #8a807b); font-size: 22rpx; }
.call-filter.active { background: var(--app-surface-bg, #fff); color: var(--app-primary-text, #242020); border-radius: 7rpx; }
.section-link { cursor: pointer; }
.more-link { display: block; margin: 2rpx auto 0; padding: 10rpx 0; background: transparent; color: var(--app-muted-text, #8a807b); font-size: 24rpx; text-decoration: underline; }
.more-link::after { border: 0; }
.discover-options { display: flex; gap: 30rpx; }
.discover-options > view { flex: 1; min-width: 0; padding: 22rpx; border: 1rpx solid var(--app-border-color, #e5ded7); border-radius: 8rpx; }
.discover-options text:first-child { display: block; font-size: 26rpx; font-weight: 600; }
.discover-options text:last-child { display: block; margin-top: 8rpx; font-size: 18rpx; color: var(--app-muted-text, #8a807b); }
</style>
