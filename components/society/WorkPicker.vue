<template>
  <view class="work-picker community-page">
    <text v-if="originalOnly" class="work-picker-note">仅可选择本人公开发表、已通过审核的原创诗歌</text>
    <community-state v-if="loading || error" :loading="loading" :error="error" @action="load(false)" />
    <poem-selection-item v-for="work in works" :key="work._id" :post="work" :selected="selected === work._id" :date-label="date(work.createTime)" @select="selected = $event._id" />
    <community-state v-if="!loading && !error && !works.length" :description="originalOnly ? '暂无可投稿的原创诗歌，可先去创作' : ''" />
    <button v-if="hasMore" class="text-button" :disabled="loading" @tap="load(true)">更多</button>
    <view class="actions"><button class="secondary-button" :disabled="busy" @tap="$emit('cancel')">取消</button><button class="primary-button" :loading="busy" :disabled="busy || !selected" @tap="$emit('select', selected)">{{ label }}</button></view>
  </view>
</template>
<script>
import CommunityState from './CommunityState.vue';
import PoemSelectionItem from '@/components/poem/PoemSelectionItem.vue';
import { societyRequest } from '@/api-cache/societies.js';
import { societyDate } from '@/utils/society.js';
export default {
  components: { CommunityState, PoemSelectionItem }, props: { busy: Boolean, label: { type: String, default: '投稿' }, originalOnly: Boolean }, emits: ['cancel', 'select'],
  data: () => ({ works: [], selected: '', skip: 0, hasMore: false, loading: false, error: '' }),
  mounted() { this.load(false); },
  methods: { date: societyDate, async load(more) { if (this.loading) return; this.loading = true; this.error = ''; try {
    const skip = more ? this.skip : 0; const result = await societyRequest('myWorks', { skip, limit: 20, originalOnly: this.originalOnly }, this);
    this.works = more ? [...this.works, ...result.works] : result.works; this.skip = skip + 20; this.hasMore = result.hasMore;
  } catch (error) { this.error = error.message; } finally { this.loading = false; } } }
};
</script>
<style scoped>
@import '@/styles/society.css';
.work-picker { margin: 30rpx 0; display: flex; flex-direction: column; gap: 12rpx; }
.work-picker-note { font-size: 23rpx; color: var(--app-muted-text, #938680); }
</style>
