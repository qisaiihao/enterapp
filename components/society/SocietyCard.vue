<template>
  <view class="society-card" :class="{ compact }" @tap="$emit('select', society)">
    <view class="card-heading">
      <image class="society-avatar" :src="society.avatarUrl || fallback" mode="aspectFit" />
      <view class="card-info"><text class="card-name">{{ society.name }}</text><text class="card-school">{{ society.school }}</text></view>
      <text v-if="society.role" class="role">{{ roles[society.role] || '成员' }}</text>
      <button v-else-if="followable" class="follow-button" @tap.stop="$emit('follow', society)">{{ followed ? '已关注' : '关注' }}</button>
      <text v-else class="card-arrow">›</text>
    </view>
    <text v-if="society.description || society.motto" class="card-description">{{ society.description || society.motto }}</text>
    <view class="card-footer"><text>{{ society.region }}</text><text>{{ society.memberCount || 0 }} 位成员<text class="separator">·</text>{{ society.workCount || 0 }} 首作品</text></view>
  </view>
</template>
<script>
import { SOCIETY_AVATAR, ROLE_LABELS } from '@/utils/society.js';
export default { props: { society: { type: Object, required: true }, compact: Boolean, followable: Boolean, followed: Boolean }, emits: ['select', 'follow'], data: () => ({ fallback: SOCIETY_AVATAR, roles: ROLE_LABELS }) };
</script>
<style scoped>
.society-card { padding: 28rpx; border: 1rpx solid var(--app-border-color, #e5ded7); border-radius: 14rpx; margin-bottom: 22rpx; background: var(--app-surface-bg, #fff); }
.card-heading { display: flex; align-items: center; gap: 20rpx; }
.society-avatar { width: 88rpx; height: 88rpx; border: 1rpx solid var(--app-border-color, #e7e2dc); border-radius: 6rpx; flex-shrink: 0; background: #fff; }
.card-info { flex: 1; min-width: 0; }
.card-name { display: block; font-size: 32rpx; font-weight: 600; line-height: 1.5; }
.card-school { display: block; color: var(--app-muted-text, #938680); font-size: 23rpx; margin-top: 5rpx; }
.card-arrow { color: var(--app-muted-text, #9a8d85); font-size: 38rpx; }
.card-description { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; font-size: 25rpx; color: var(--app-secondary-text, #7c6f68); line-height: 1.75; margin: 22rpx 0; }
.card-footer { display: flex; justify-content: space-between; gap: 12rpx; font-size: 21rpx; color: var(--app-muted-text, #9a8d85); }
.separator { margin: 0 10rpx; }
.role { font-size: 21rpx; color: var(--app-secondary-text, #6e7356); background: var(--app-control-soft-bg, #f0f2e9); padding: 5rpx 12rpx; border-radius: 6rpx; }
.follow-button { flex-shrink: 0; padding: 5rpx 12rpx; color: #fff; background: #403534; border-radius: 18rpx; font-size: 20rpx; line-height: 1.5; }
.follow-button::after { border: 0; }
.compact { width: 360rpx; min-height: 210rpx; box-sizing: border-box; padding: 18rpx; margin-bottom: 0; }
.compact .society-avatar { width: 76rpx; height: 76rpx; }
.compact .card-heading { gap: 10rpx; }
.compact .card-name { font-size: 27rpx; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.compact .card-school { font-size: 20rpx; }
.compact .card-description { font-size: 20rpx; line-height: 1.4; margin: 12rpx 0; min-height: 56rpx; }
.compact .card-footer { font-size: 18rpx; }
.compact .card-footer > text:first-child { display: none; }
</style>
