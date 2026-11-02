<template>
  <view class="community-state" :class="{ compact }">
    <text v-if="loading || error" class="state-symbol">{{ loading ? '· · ·' : '—' }}</text>
    <text class="state-title">{{ loading ? '正在加载' : error ? '暂时无法加载' : title }}</text>
    <text v-if="!loading && (error || description)" class="state-description">{{ error || description }}</text>
    <button v-if="!loading && (error || action)" class="state-action" @tap="$emit('action')">{{ action || '重新加载' }}</button>
  </view>
</template>
<script>
export default { props: { loading: Boolean, compact: Boolean, error: { type: String, default: '' }, title: { type: String, default: '暂时没有' }, description: { type: String, default: '' }, action: { type: String, default: '' } }, emits: ['action'] };
</script>
<style scoped>
.community-state { display: flex; align-items: center; flex-direction: column; padding: 80rpx 28rpx; text-align: center; }
.community-state.compact { padding: 36rpx 22rpx; background: var(--app-input-bg, #f8f7f4); border-radius: 12rpx; }
.state-symbol { font-size: 42rpx; color: var(--app-muted-text, #b6aaa0); letter-spacing: 8rpx; }
.state-title { margin-top: 14rpx; font-size: 28rpx; color: var(--app-secondary-text, #695d57); }
.state-description { max-width: 480rpx; font-size: 24rpx; margin-top: 10rpx; color: var(--app-muted-text, #9a8d85); line-height: 1.8; overflow-wrap: anywhere; }
.state-action { margin: 24rpx 0 0; background: transparent; color: var(--app-secondary-text, #5b5049); font-size: 26rpx; line-height: 1.6; padding: 10rpx 24rpx; border: 1rpx solid var(--app-border-color, #d4c9c0); border-radius: 8rpx; }
.state-action::after { border: 0; }
</style>
