<template>
  <view class="activity-category-bar">
    <view
      v-for="category in safeCategories"
      :key="category.value"
      :class="['category-item', activeValue === category.value ? 'active' : '']"
      @tap="selectCategory(category)"
    >
      <text class="category-label">{{ category.label }}</text>
    </view>
  </view>
</template>

<script>
export default {
  name: 'ActivityCategoryBar',
  emits: ['change'],
  props: {
    categories: {
      type: Array,
      default: () => []
    },
    activeValue: {
      type: String,
      default: ''
    }
  },
  computed: {
    safeCategories() {
      return (Array.isArray(this.categories) ? this.categories : [])
        .filter(item => item && item.value && item.label);
    }
  },
  methods: {
    selectCategory(category) {
      if (!category || !category.value) return;
      this.$emit('change', category.value);
    }
  }
};
</script>

<style scoped>
.activity-category-bar {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 34rpx;
  align-items: center;
  padding: 18rpx 28rpx 0;
  box-sizing: border-box;
}

.category-item {
  width: 96rpx;
  min-height: 96rpx;
  justify-self: center;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 12rpx 10rpx;
  box-sizing: border-box;
  border-radius: 8rpx;
  background: var(--app-subtle-surface-bg, #bfbfbf);
  color: var(--app-secondary-text, #222);
  transition: transform 0.18s ease, opacity 0.18s ease;
}

.category-item:active {
  transform: scale(0.96);
  opacity: 0.86;
}

.category-item.active {
  background: var(--app-control-active-bg, #b7b7b7);
  color: var(--app-primary-text, #111);
}

.category-label {
  font-size: 22rpx;
  line-height: 28rpx;
  text-align: center;
  word-break: break-all;
}
</style>
