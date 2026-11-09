<template>
  <community-shell title="" class="community-page">
    <template #actions><button class="clear-button" :disabled="clearing" @tap="clearAll">清空</button></template>
    <view class="row"><text class="title">诗社通知</text><text v-if="unread" class="badge">{{ unread }} 条未读</text></view>
    <view class="categories"><view class="category-row"><button v-for="item in categories" :key="item.value" class="category" :class="{ selected: category === item.value }" @tap="select(item.value)">{{ item.label }}</button></view></view>
    <community-state v-if="loading || error" :loading="loading" :error="error" :action="authNeeded ? '去登录' : ''" @action="recover" />
    <template v-else><view v-for="item in items" :key="item._id" class="notice-item" :class="{ unread: !item.read }" @tap="openNotice(item)"><view class="notice-icon" :class="{ avatar: !!item.societyAvatar }"><image v-if="item.societyAvatar" :src="item.societyAvatar" mode="aspectFill" /><image v-else src="/static/images/newicons/notification.png" mode="aspectFit" /></view><view class="notice-main"><view class="notice-header"><text class="notice-title">{{ item.title }}</text><text class="notice-time">{{ date(item.createdAt) }}</text></view><text class="notice-category">{{ labels[item.category] }}</text><view v-if="item.body" class="notice-preview"><text>{{ item.body }}</text></view></view><view v-if="!item.read" class="unread-dot" /></view><community-state v-if="!items.length" title="暂无诗社通知" /><button v-if="hasMore" class="secondary-button" :disabled="loadingMore" @tap="load(true)">加载更多</button></template>
  </community-shell>
  <app-overlay-host />
</template>
<script>
import CommunityShell from '@/pages-community/components/society/CommunityShell.vue';
import CommunityState from '@/pages-community/components/society/CommunityState.vue';
import { societyRequest } from '@/api-cache/societies.js';
import { openSocietyPage, openSocietyLogin, societyDate, showSocietyError } from '@/pages-community/utils/society.js';
const categories = [{ value: 'all', label: '全部' }, { value: 'application', label: '入驻' }, { value: 'membership', label: '成员' }, { value: 'activity', label: '活动' }, { value: 'submission', label: '投稿' }, { value: 'invitation', label: '合办' }];
export default {
  components: { CommunityShell, CommunityState },
  data: () => ({ categories, labels: Object.fromEntries(categories.map(item => [item.value, item.label])), category: 'all', items: [], unread: 0, loading: true, loadingMore: false, clearing: false, error: '', authNeeded: false, hasMore: false, version: 0, countVersion: 0 }),
  onShow() { this.load(false); this.refreshCount(); }, onReachBottom() { if (this.hasMore) this.load(true); },
  methods: {
    date: societyDate, recover() { if (this.authNeeded) openSocietyLogin(); else this.load(false); },
    select(value) { if (this.clearing || this.category === value) return; this.category = value; this.load(false); },
    async refreshCount() { const version = ++this.countVersion; try { const result = await societyRequest('unreadNotifications', {}, this); if (version === this.countVersion) this.unread = result.count || 0; } catch (_) { if (version === this.countVersion) this.unread = 0; } },
    async clearAll() {
      if (this.clearing) return;
      const response = await new Promise(resolve => uni.showModal({ title: '清空消息', content: '确定要清空所有诗社通知吗？此操作不可恢复。', success: resolve, fail: () => resolve({ confirm: false }) }));
      if (!response.confirm) return;
      this.clearing = true;
      this.version++;
      this.countVersion++;
      try {
        await societyRequest('clearNotifications', {}, this);
        this.items = []; this.unread = 0; this.hasMore = false; this.error = ''; this.authNeeded = false;
        uni.showToast({ title: '已清空', icon: 'success' });
      } catch (error) {
        if (error.code !== 'AUTH_REQUIRED') showSocietyError(error);
        await Promise.all([this.load(false), this.refreshCount()]);
      } finally { this.clearing = false; this.loading = false; this.loadingMore = false; }
    },
    async load(more) { if (more && this.loadingMore) return; const version = ++this.version; this.error = ''; this.loading = !more; this.loadingMore = more;
      try { const result = await societyRequest('notifications', { category: this.category, skip: more ? this.items.length : 0, limit: 20 }, this); if (version !== this.version) return; this.items = more ? [...this.items, ...result.notifications] : result.notifications; this.hasMore = result.hasMore; }
      catch (error) { if (version === this.version) { this.error = error.message; this.authNeeded = error.code === 'AUTH_REQUIRED'; } }
      finally { if (version === this.version) { this.loading = false; this.loadingMore = false; } }
    },
    async openNotice(item) { if (this.clearing) return; try { if (!item.read) { await societyRequest('readNotification', { id: item._id }, this); item.read = true; this.unread = Math.max(0, this.unread - 1); }
      if (item.targetKind === 'society') openSocietyPage('society', { id: item.targetId });
      else if (item.targetKind === 'call' || item.targetKind === 'event') openSocietyPage('opportunity', { id: item.targetId, kind: item.targetKind });
      else if (item.targetKind === 'manage') openSocietyPage('manage', { id: item.targetId });
      else if (item.targetKind === 'apply') openSocietyPage('apply');
    } catch (error) { showSocietyError(error); } }
  }
};
</script>
<style scoped>
@import '@/styles/society.css';
.clear-button { min-width: 96rpx; height: 48rpx; padding: 0 16rpx; border-radius: 10rpx; background: var(--app-subtle-surface-bg, #d9d9d9); color: var(--app-secondary-text, #989090); font-size: 24rpx; }
.title { font-size: 48rpx; }.categories { margin: 24rpx -30rpx 12rpx; background: var(--app-surface-bg, #fff); border-bottom: 1rpx solid var(--app-border-color, #eee); }.category-row { display: flex; padding: 0 8rpx; }.category { flex: 1; min-width: 0; padding: 26rpx 4rpx; border-radius: 0; background: transparent; color: var(--app-secondary-text, #666); font-size: 26rpx; white-space: nowrap; }.category.selected { color: var(--app-primary-text, #222); font-weight: 600; border-bottom: 4rpx solid currentColor; }.category::after { border: 0; }
.notice-item { display: flex; align-items: flex-start; gap: 24rpx; position: relative; padding: 28rpx 18rpx; border-bottom: 1rpx solid var(--app-border-color, #eee); background: var(--app-surface-bg, #fff); }.notice-item.unread { background: var(--app-message-unread-bg, #f8f9fa); }.notice-icon { width: 76rpx; height: 76rpx; flex: none; border-radius: 50%; border: 1rpx solid var(--app-border-color, #eee); display: flex; align-items: center; justify-content: center; }.notice-icon.avatar { overflow: hidden; }.notice-icon.avatar image { width: 100%; height: 100%; filter: none; }.notice-icon image { width: 36rpx; height: 36rpx; filter: var(--app-icon-filter, none); }.notice-main { flex: 1; min-width: 0; }.notice-header { display: flex; align-items: center; gap: 12rpx; }.notice-title { font-size: 28rpx; font-weight: 600; flex: 1; min-width: 0; }.notice-time { flex: none; color: var(--app-muted-text, #999); background: var(--app-subtle-surface-bg, #f5f5f5); border-radius: 12rpx; padding: 4rpx 10rpx; font-size: 20rpx; }.notice-category { color: var(--app-muted-text, #999); font-size: 22rpx; }.notice-preview { margin-top: 12rpx; padding: 14rpx; border-radius: 8rpx; background: var(--app-subtle-surface-bg, #f5f5f5); color: var(--app-secondary-text, #555); font-size: 25rpx; }.unread-dot { position: absolute; top: 20rpx; left: 10rpx; width: 13rpx; height: 13rpx; border-radius: 50%; background: var(--app-danger-strong-color, #c46b5b); }
</style>
