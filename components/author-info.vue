<template>
  <view class="author-info">
    <view class="author-basic">
      <image
        class="author-avatar"
        :src="post.isAnonymous ? '/static/images/avatar.png' : (post.authorAvatar || '/static/images/avatar.png')"
        mode="aspectFill"
        @error="$emit('avatar-error')"
        @click="$emit('navigateToUserProfile')"
        :data-user-id="post._openid"
        :data-author-name="post.authorName"
        :data-is-anonymous="post.isAnonymous"
        style="pointer-events: auto; cursor: pointer;"
      ></image>
      <text class="author-name">{{ post.isAnonymous ? '匿名用户' : post.authorName }}</text>
    </view>
    <view class="author-right-actions">
      <view v-if="!post.isAnonymous && isMutualFollow" class="mutual-tag">互相关注</view>
      <view v-else-if="!post.isAnonymous && isFollowedByAuthor && !isMutualFollow" class="followed-tag">TA关注了你</view>
    </view>
  </view>
</template>
<script>
export default {
  name: 'AuthorInfo',
  props: {
    post: { type: Object, required: true },
    isMutualFollow: Boolean,
    isFollowedByAuthor: Boolean
  }
};
</script>
<style scoped>
.author-info { display: flex; justify-content: space-between; align-items: center; }
.author-avatar { width: 88rpx; height: 88rpx; border-radius: 50%; }
.author-name { font-weight: bold; margin-left: 16rpx; }
.mutual-tag, .followed-tag { margin-left: 10rpx; color: #52c41a; font-size: 22rpx; }
</style>
