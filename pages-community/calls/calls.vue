<template>
  <community-shell title="" class="community-page">
    <view class="calls-heading">
      <text class="calls-title">联合征稿</text>
      <view class="calls-filter">
        <button class="calls-filter-trigger" :class="{ active: availableOnly || showFilter }" aria-label="筛选征稿" @tap.stop="showFilter = !showFilter"><image src="/static/images/filter.png" mode="aspectFit" /></button>
        <app-motion :visible="showFilter" placement="popover" @dismiss="showFilter = false">
          <view class="calls-filter-mask" @tap="showFilter = false"></view>
          <view class="calls-filter-panel" @tap.stop>
            <view class="calls-filter-option" :class="{ active: !availableOnly }" @tap="setAvailable(false)">查看全部</view>
            <view class="calls-filter-option" :class="{ active: availableOnly }" @tap="setAvailable(true)">仅看可参与</view>
          </view>
        </app-motion>
      </view>
    </view>
    <view class="call-filters"><button v-for="option in callFilters" :key="option.value" :class="['call-filter', { active: callFilter === option.value }]" @tap="changeFilter(option.value)">{{ option.label }}</button></view>
    <community-state v-if="loading || error" :loading="loading" :error="error" @action="load" />
    <template v-else>
      <opportunity-card v-for="item in calls" :key="item._id" kind="call" :item="item" @select="select" />
      <community-state v-if="!calls.length" :title="emptyTitle" />
      <view v-if="loadingMore" class="loading-more">正在加载</view>
    </template>
  </community-shell>
  <app-overlay-host />
</template>
<script>
import CommunityShell from '@/pages-community/components/society/CommunityShell.vue';
import CommunityState from '@/pages-community/components/society/CommunityState.vue';
import OpportunityCard from '@/pages-community/components/society/OpportunityCard.vue';
import AppMotion from '@/components/overlay/AppMotion.vue';
import { societyRequest } from '@/api-cache/societies.js';
import { openSocietyPage, decodeSocietyParam } from '@/pages-community/utils/society.js';
const CALL_FILTERS = [{ value: 'current', label: '正在进行' }, { value: 'ending', label: '即将截止' }, { value: 'past', label: '往期' }];
export default {
  components: { CommunityShell, CommunityState, OpportunityCard, AppMotion },
  data: () => ({ callFilter: 'current', callFilters: CALL_FILTERS, calls: [], hasMore: false, loading: true, loadingMore: false, error: '', requestVersion: 0, availableOnly: false, showFilter: false }),
  computed: { emptyTitle() { return this.callFilter === 'past' ? '还没有往期征稿' : '暂时没有征稿'; } },
  onLoad(options = {}) {
    const filter = decodeSocietyParam(options.filter);
    if (CALL_FILTERS.some(option => option.value === filter)) this.callFilter = filter;
    this.load(false);
  },
  onReachBottom() { this.more(); },
  onHide() { this.showFilter = false; },
  methods: {
    open: openSocietyPage,
    select(item) { this.open('opportunity', { id: item._id, kind: 'call' }); },
    setAvailable(value) { this.showFilter = false; if (this.availableOnly === value) return; this.availableOnly = value; this.calls = []; this.hasMore = false; this.load(false); },
    changeFilter(value) { if (this.callFilter === value) return; this.callFilter = value; this.calls = []; this.hasMore = false; this.load(false); },
    more() { if (this.hasMore && !this.loading && !this.loadingMore) this.load(true); },
    async load(append) {
      const version = ++this.requestVersion;
      this.error = ''; this.loading = !append; this.loadingMore = append;
      try {
        const result = await societyRequest('callList', { filter: this.callFilter, skip: append ? this.calls.length : 0, limit: 20, availableOnly: this.availableOnly }, this);
        if (version !== this.requestVersion) return;
        this.calls = append ? this.calls.concat(result.calls) : result.calls;
        this.hasMore = result.hasMore;
      } catch (error) { if (version === this.requestVersion) this.error = error.message; }
      finally { if (version === this.requestVersion) { this.loading = false; this.loadingMore = false; } }
    }
  }
};
</script>
<style scoped>
@import '@/styles/society.css';
.calls-heading { display: flex; align-items: center; justify-content: space-between; gap: 24rpx; margin: 8rpx 0 30rpx; }
.calls-title { display: block; font-size: 68rpx; font-weight: 600; line-height: 1.45; margin: 0; }
.calls-filter { position: relative; flex-shrink: 0; }
.calls-filter-trigger { display: flex; align-items: center; justify-content: center; width: 64rpx; height: 64rpx; padding: 0; border-radius: 18rpx; background: transparent; }
.calls-filter-trigger::after { border: 0; }
.calls-filter-trigger image { width: 40rpx; height: 40rpx; filter: var(--app-filter-icon-filter, none); }
.calls-filter-trigger:active { transform: scale(.92); opacity: .7; }
.calls-filter :deep(.app-motion-root) { position: absolute; right: 0; top: 76rpx; z-index: 1200; }
.calls-filter-mask { position: fixed; top: 0; right: 0; bottom: 0; left: 0; z-index: 1; background: transparent; }
.calls-filter-panel { position: relative; z-index: 2; width: 332rpx; margin-top: 12rpx; padding: 24rpx; border-radius: 20rpx; background: var(--app-elevated-bg, #fff); box-shadow: var(--app-surface-shadow, 0 16rpx 40rpx rgba(0, 0, 0, .12)); border: var(--app-surface-border-line, none); box-sizing: border-box; }
.calls-filter-option { min-width: 92rpx; padding: 10rpx 18rpx; border-radius: 999rpx; background: var(--app-subtle-surface-bg, #f1efed); font-size: 24rpx; line-height: 34rpx; color: var(--app-secondary-text, #5a524e); text-align: center; box-sizing: border-box; }
.calls-filter-option + .calls-filter-option { margin-top: 12rpx; }
.calls-filter-option.active { background: var(--app-accent-color, #6d6565); color: #fff; }
.call-filters { display: flex; gap: 8rpx; padding: 7rpx; margin: 0 0 24rpx; background: var(--app-input-bg, #f1f1ee); border-radius: 9rpx; }
.call-filter { flex: 1; padding: 8rpx 0; background: transparent; color: var(--app-muted-text, #8a807b); font-size: 22rpx; }
.call-filter.active { background: var(--app-surface-bg, #fff); color: var(--app-primary-text, #242020); border-radius: 7rpx; }
.loading-more { padding: 20rpx 0; text-align: center; font-size: 22rpx; color: var(--app-muted-text, #8a807b); }
</style>
