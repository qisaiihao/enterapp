<template>
  <view class="stack-work" :style="{ color: textColor, position: 'relative', width: '100%', height: '100%', boxSizing: 'border-box', padding: '58rpx 90rpx 52rpx 54rpx', display: 'flex', alignItems: 'center' }">
    <image
      class="stack-avatar"
      :src="avatar"
      mode="aspectFill"
      :style="{ position: 'absolute', top: '30rpx', right: '26rpx', width: '50rpx', height: '50rpx', boxSizing: 'border-box', zIndex: 1 }"
      @tap.stop="$emit('author', card)"
    />
    <text class="stack-copy">{{ copy }}</text>
    <image
      v-if="card.authorSignature && !card.isAnonymous"
      class="stack-signature"
      :src="card.authorSignature"
      mode="aspectFit"
      :style="{ position: 'absolute', right: '22rpx', bottom: '16rpx', width: '126rpx', height: '70rpx' }"
    />
  </view>
</template>
<script>
export default {
  name: 'SocietyStackFront',
  props: {
    card: { type: Object, required: true },
    avatar: { type: String, required: true },
    textColor: { type: String, default: '#fff' }
  },
  emits: ['author'],
  computed: {
    copy() {
      const highlights = Array.isArray(this.card.displayHighlightLines)
        ? this.card.displayHighlightLines.filter(line => typeof line === 'string' && line.trim()) : [];
      const source = highlights.length ? highlights.join('\n') : String(this.card.displayContent || this.card.content || '');
      return source.split(/\r?\n/).map(line => line.trim()).filter(Boolean).slice(0, 4).join('\n');
    }
  }
};
</script>
<style scoped>
.stack-work { position: relative; width: 100%; height: 100%; box-sizing: border-box; padding: 58rpx 90rpx 52rpx 54rpx; display: flex; align-items: center; font-family: 'Huiwen-mincho', '汇文明朝', 'PingFang SC', serif; }
.stack-avatar { display: block; flex-shrink: 0; border: 1rpx solid rgba(80, 66, 55, .3); border-radius: 8rpx; background: rgba(255, 255, 255, .35); overflow: hidden; }
.stack-copy { display: block; width: 100%; white-space: pre-line; overflow: hidden; font-size: 28rpx; font-weight: 600; line-height: 1.38; word-break: break-word; }
.stack-signature { display: block; }
</style>
