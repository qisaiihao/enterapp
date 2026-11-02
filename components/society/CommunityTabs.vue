<template>
  <view class="community-tabs">
    <button v-for="tab in tabs" :key="tab.value" :class="['community-tab', { active: modelValue === tab.value }]" @tap="$emit('update:modelValue', tab.value)">{{ tab.label }}</button>
  </view>
</template>
<script>
export default { props: { tabs: { type: Array, default: () => [] }, modelValue: { type: String, default: '' } }, emits: ['update:modelValue'] };
</script>
<style scoped>
.community-tabs { display: flex; margin: 36rpx 0 30rpx; border-radius: 0 0 10rpx 10rpx; box-shadow: 0 4rpx 4rpx rgba(0, 0, 0, .2); background: var(--app-surface-bg, #fff); }
.community-tab { position: relative; flex: 1; margin: 0; padding: 14rpx 2rpx; background: transparent; color: var(--app-muted-text, #938680); border-radius: 0; font-size: 27rpx; line-height: 1.5; white-space: nowrap; }
.community-tab::after { border: 0; }
.community-tab.active { color: var(--app-primary-text, #292423); font-weight: 600; }
.tab-mark { position: absolute; bottom: -1rpx; left: 32%; right: 32%; height: 4rpx; background: currentColor; border-radius: 3rpx; }
</style>
