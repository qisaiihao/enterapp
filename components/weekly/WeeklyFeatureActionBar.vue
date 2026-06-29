<template>
  <view class="weekly-action-row">
    <view class="weekly-action-item">
      <image
        class="weekly-like-icon"
        src="/static/images/love.png"
        mode="aspectFit"
      ></image>
    </view>
    <view class="weekly-action-item">
      <image
        class="weekly-download-icon"
        src="/static/images/newicons/save_share.png"
        mode="aspectFit"
      ></image>
    </view>
    <view class="weekly-action-item">
      <image
        class="weekly-comment-icon"
        src="/static/images/newicons/comment.png"
        mode="aspectFit"
      ></image>
    </view>
  </view>
</template>

<script>
export default {
  name: 'WeeklyFeatureActionBar',
  props: {
  }
};
</script>

<style scoped>
.weekly-action-row {
  margin: 46rpx 58rpx 0;
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
}

.weekly-action-item {
  width: 144rpx;
  height: 124rpx;
  display: flex;
  align-items: center;
  justify-content: center;
}

.weekly-like-icon,
.weekly-download-icon,
.weekly-comment-icon {
  width: 112rpx;
  height: 112rpx;
}

.weekly-comment-icon {
  filter: none;
  opacity: 1;
}
</style>
