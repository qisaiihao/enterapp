<template>
  <view class="activity-category-bar">
    <view
      v-for="category in safeCategories"
      :key="category.value"
      :class="['category-item', activeValue === category.value ? 'active' : '']"
      @tap="selectCategory(category)"
    >
      <view class="category-icon-wrap">
        <image class="category-icon" :src="category.icon" mode="aspectFit" />
      </view>
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
  gap: 16rpx;
  align-items: center;
  padding: 18rpx 28rpx 0;
  box-sizing: border-box;
}

.category-item {
  width: 100%;
  min-width: 0;
  min-height: 132rpx;
  justify-self: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 8rpx 0;
  box-sizing: border-box;
  background: transparent;
  color: var(--app-secondary-text, #222);
  transition: transform 0.18s ease, opacity 0.18s ease;
}

.category-item:active {
  transform: scale(0.96);
  opacity: 0.86;
}

.category-item.active {
  color: var(--app-primary-text, #111);
}

.category-icon-wrap {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 88rpx;
  height: 88rpx;
  margin-bottom: 8rpx;
  border-radius: 16rpx;
}

.category-icon {
  display: block;
  width: 80rpx;
  height: 80rpx;
  filter: var(--app-activity-entry-icon-filter, none);
}

.category-label {
  font-size: 22rpx;
  line-height: 28rpx;
  text-align: center;
  white-space: nowrap;
}
</style>
