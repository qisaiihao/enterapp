<template>
  <view class="square-speech-bubble" @tap.stop="$emit('tap')">
    <text class="square-speech-text">{{ text }}</text>
  </view>
</template>

<script>
export default {
  props: { text: { type: String, default: '' } },
  emits: ['tap']
};
</script>

<style scoped>
.square-speech-bubble {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  max-width: 360rpx;
  padding: 14rpx 22rpx;
  box-sizing: border-box;
  border-radius: 22rpx;
  background: #000;
  color: #fff;
}
.square-speech-bubble::before {
  content: '';
  position: absolute;
  left: -12rpx;
  top: 24rpx;
  border-top: 9rpx solid transparent;
  border-bottom: 9rpx solid transparent;
  border-right: 14rpx solid #000;
}
.square-speech-text {
  display: block;
  min-width: 0;
  text-align: center;
  font-size: 24rpx;
  line-height: 34rpx;
  color: #fff;
  overflow-wrap: anywhere;
  white-space: normal;
}
.square-speech-bubble:active { opacity: 0.85; }
</style>
