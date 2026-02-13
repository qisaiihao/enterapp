<template>
  <view v-if="isInputExpanded" class="comment-input-area" :style="'bottom: ' + keyboardHeight + 'px;'">
    <view class="expanded-container">
      <view v-if="replyToComment" class="reply-prompt">
        <text class="reply-prompt-text">回复 {{ replyToAuthor }}：</text>
        <view class="cancel-reply" @tap="$emit('cancel-reply')">
          <text class="cancel-text">取消</text>
        </view>
      </view>
      <textarea
        class="expanded-textarea"
        placeholder="留下你的精彩评论..."
        :value="newComment"
        @input="$emit('comment-input', $event.detail.value)"
        :focus="isFocus"
        auto-height maxlength="500" :show-confirm-bar="false" :adjust-position="false"
      ></textarea>
      <view v-if="commentImages.length" class="selected-comment-images">
        <view class="selected-image-item" :data-index="index" v-for="(item, index) in commentImages" :key="index">
          <image class="selected-image-thumb" :src="item.previewUrl" mode="aspectFill" @tap="$emit('preview-image', index)"/>
          <view class="remove-image-btn" @tap="$emit('remove-image', index)">✕</view>
        </view>
      </view>
      <view class="expanded-actions">
        <view class="action-icons">
          <view class="action-icon" @tap="$emit('choose-images')"></view>
        </view>
        <view class="submit-button" @tap="$emit('submit-comment')" :class="{ disabled: isSubmitDisabled }">
          <image class="submit-icon" src="/static/images/newicons/comment.png" mode="aspectFit"/>
        </view>
      </view>
    </view>
  </view>
</template>
<script>
export default {
  name: 'CommentInput',
  props: {
    isInputExpanded: Boolean,
    newComment: String,
    commentImages: Array,
    isFocus: Boolean,
    keyboardHeight: Number,
    replyToComment: [Object, Boolean],
    replyToAuthor: [String, Boolean],
    isSubmitDisabled: Boolean
  }
};
</script>
<style scoped>
.comment-input-area { position: fixed; left: 0; right: 0; background: #fff; z-index: 2000; box-shadow: 0 -2px 10px #eee; }
.expanded-textarea { width: 100%; min-height: 80px; margin-bottom: 18rpx; }
.selected-comment-images { display: flex; gap: 8px; margin-bottom: 10px; }
.selected-image-item { position: relative; }
.selected-image-thumb { width: 70rpx; height: 70rpx; border-radius: 6rpx; }
.remove-image-btn { position: absolute; top: -6px; right: -6px; background: #fff; color: #f33; border-radius: 50%; padding: 2px 4px; cursor: pointer; }
.expanded-actions { display: flex; align-items: center; justify-content: space-between; }
.submit-button { padding: 0 15rpx; }
.submit-button.disabled { opacity: 0.5; pointer-events: none; }
.submit-icon { width: 50rpx; height: 50rpx; }
</style>





























