<template>
  <view class="post-item-simple" :class="{ selected }" @tap="$emit('select', post)">
    <view class="post-content-simple"><text class="post-title-simple">{{ post.title || '无标题' }}</text><text class="post-date-simple">{{ dateLabel }}</text></view>
    <view v-if="selected" class="selected-check-simple"><text>✓</text></view>
  </view>
</template>
<script>
export default { props: { post: { type: Object, required: true }, selected: Boolean, dateLabel: { type: String, default: '' } }, emits: ['select'] };
</script>
<style scoped>
.post-item-simple { background: var(--create-input-bg, var(--app-input-bg, #f7f6f3)); border-radius: 20rpx; padding: 24rpx; border: none; transition: all 0.3s ease; display: flex; align-items: center; justify-content: space-between; }
.post-item-simple.selected { background: var(--create-cancel-bg, var(--app-control-soft-bg, #e9e7e3)); }
.post-content-simple { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 6rpx; }
.post-title-simple { font-size: 30rpx; color: var(--create-text, var(--app-primary-text, #242020)); font-weight: 500; line-height: 1.4; overflow-wrap: anywhere; }
.post-date-simple { font-size: 24rpx; color: var(--create-muted, var(--app-muted-text, #8a807b)); }
.selected-check-simple { width: 40rpx; height: 40rpx; background: var(--create-confirm-bg, #403534); border-radius: 50%; display: flex; align-items: center; justify-content: center; color: var(--create-confirm-text, #fff); font-size: 24rpx; font-weight: bold; flex-shrink: 0; }
</style>
