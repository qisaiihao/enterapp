<template>
  <view class="post-content">
    <text v-if="post.title" class="title">{{ post.title }}</text>
    <view v-if="post.content" class="main-content">{{ post.content }}</view>
    <!-- 可扩展图片、标签、特殊标志等，在此添加具体内容逻辑 -->
  </view>
</template>
<script>
export default {
  name: 'PostContent',
  props: {
    post: { type: Object, required: true }
  }
};
</script>
<style scoped>
.title { font-size: 38rpx; font-weight: bold; margin-bottom: 24rpx; }
.main-content { white-space: pre-wrap; font-size: 30rpx; margin-bottom: 30rpx; }
</style>
