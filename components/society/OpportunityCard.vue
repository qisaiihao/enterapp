<template>
  <view class="opportunity-card" @tap="$emit('select', item)">
    <image v-if="kind === 'event'" class="opportunity-cover" :src="item.coverImage || fallback" mode="aspectFill" />
    <view class="opportunity-info">
      <view v-if="item.category || item.statusLabel || (kind === 'call' && scopeLabel)" class="tags"><text v-if="item.category" class="tag">{{ item.category }}</text><text v-if="item.statusLabel" class="tag status">{{ item.statusLabel }}</text><text v-if="kind === 'call' && scopeLabel" class="tag scope">{{ scopeLabel }}</text></view>
      <text class="opportunity-title">{{ item.title }}</text>
      <text v-if="kind === 'call' && item.deadline" class="opportunity-meta">截止 {{ date(item.deadline) }}</text>
      <text v-if="!management && kind === 'event' && item.societyName" class="opportunity-meta">{{ item.societyName }}</text>
      <text v-if="!management && (kind === 'call' ? item.societyName : item.location)" class="opportunity-meta">{{ kind === 'call' ? item.societyName : item.location }}</text>
      <slot name="actions" />
    </view>
    <text v-if="!management" class="opportunity-arrow">›</text>
  </view>
</template>
<script>
import { SOCIETY_AVATAR, societyDate, CALL_SCOPE_LABELS } from '@/utils/society.js';
export default {
  props: { management: Boolean, item: { type: Object, required: true }, kind: { type: String, default: 'event' } },
  emits: ['select'],
  data: () => ({ fallback: SOCIETY_AVATAR }),
  computed: { scopeLabel() { return this.kind === 'call' ? CALL_SCOPE_LABELS[this.item.audience] || CALL_SCOPE_LABELS.all : ''; } },
  methods: { date: societyDate }
};
</script>
<style scoped>
.opportunity-card { display: flex; align-items: center; gap: 22rpx; padding: 24rpx; border: 1rpx solid var(--app-border-color, #e5ded7); border-radius: 12rpx; margin-bottom: 22rpx; }
.opportunity-cover { width: 104rpx; height: 142rpx; border-radius: 7rpx; background: #f5f3f0; flex-shrink: 0; }
.opportunity-info { flex: 1; min-width: 0; }
.tags { display: flex; flex-wrap: wrap; gap: 10rpx; margin-bottom: 10rpx; }
.tag { font-size: 18rpx; line-height: 1.5; padding: 1rpx 10rpx; color: #8a743f; border: 1rpx solid #b7a66a; border-radius: 7rpx; }
.tag.status { color: #6c7c4a; border-color: #a7b48e; }
.tag.scope { color: #5f6f8a; border-color: #9aa9c0; }
.opportunity-title { display: block; font-size: 29rpx; line-height: 1.5; font-weight: 600; margin-bottom: 12rpx; }
.opportunity-meta { display: block; font-size: 22rpx; color: var(--app-muted-text, #938680); line-height: 1.7; }
.opportunity-arrow { font-size: 40rpx; color: var(--app-muted-text, #9a8d85); }
</style>
