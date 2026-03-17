<template>
  <view class="bottom-action-bar">
    <view class="comment-input-container">
      <input 
        class="comment-input"
        placeholder="评论..." 
        :value="quickCommentText"
        @input="$emit('quick-comment-input', $event.detail.value)"
        @confirm="$emit('quick-comment-submit')"
        @tap="$emit('expand-input')"
      />
    </view>
    <view class="action-icons">
      <view class="action-icon" @tap="$emit('show-discussion-modal')">
        <image class="action-icon-image" src="/static/images/newicons/comment.png" mode="aspectFit"/>
      </view>
      <view class="action-icon" @tap="$emit('toggle-favorite')">
        <image class="action-icon-image" :src="post && post.isFavorited ? '/static/images/newicons/collection.png' : '/static/images/newicons/collection.png'" mode="aspectFit"/>
      </view>
    </view>
  </view>
</template>
<script>
export default {
  name: 'BottomActionBar',
  props: {
    quickCommentText: String,
    post: Object
  }
};
</script>
<style scoped>
.bottom-action-bar { display: flex; align-items: center; background: #fff; box-shadow: 0 -2px 10px #eee; }
.comment-input-container { flex: 1; padding: 0 16rpx; }
.comment-input { width: 100%; border-radius: 4rpx; border: 1px solid #ddd; padding: 20rpx 28rpx; }
.action-icons { display: flex; gap: 12rpx; }
.action-icon { display: flex; align-items: center; justify-content: center; width: 60rpx; height: 60rpx; }
.action-icon-image { width: 60rpx; height: 60rpx; }
</style>










































