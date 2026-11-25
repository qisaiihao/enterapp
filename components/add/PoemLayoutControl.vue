<template>
    <view class="poem-layout-control" :class="{ 'poem-layout-control--inline': inline }">
        <text class="poem-layout-label">卡片排版</text>
        <view class="poem-layout-options">
            <button class="poem-layout-option" :class="{ 'is-selected': !vertical }" :aria-pressed="!vertical" @tap.stop="$emit('change', false)">横排</button>
            <button class="poem-layout-option" :class="{ 'is-selected': vertical }" :aria-pressed="vertical" @tap.stop="$emit('change', true)">竖排</button>
        </view>
    </view>
</template>

<script>
export default {
    name: 'PoemLayoutControl',
    props: {
        vertical: { type: Boolean, default: false },
        inline: { type: Boolean, default: false }
    },
    emits: ['change']
};
</script>

<style scoped>
.poem-layout-control { display: flex; align-items: center; gap: 16rpx; margin: 0 30rpx 16rpx; min-height: 56rpx; }
.poem-layout-control--inline { margin: 12rpx 0 16rpx; }
.poem-layout-label { font-size: 24rpx; color: var(--app-muted-text, #666); }
.poem-layout-options { display: flex; gap: 4rpx; padding: 4rpx; border-radius: 14rpx; background: var(--app-input-bg, #e8e8e8); }
.poem-layout-option { margin: 0; padding: 0 18rpx; border-radius: 10rpx; background: transparent; color: var(--app-primary-text, #333); font-size: 24rpx; line-height: 52rpx; }
.poem-layout-option::after { border: 0; }
.poem-layout-option.is-selected { background: var(--app-control-accent-bg, #333); color: var(--app-control-accent-text, #fff); }
</style>
