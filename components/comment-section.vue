<template>
  <view class="comment-section">
    <view class="section-title">共 {{ isCommentLoading ? '--' : commentCount }} 条评论</view>
    <view v-if="isCommentLoading" class="comment-skeleton-list">
      <!-- skeleton 评论加载态略，可移入骨架屏组件优化 -->
      <view class="comment-skeleton-item" v-for="n in 3" :key="n"></view>
    </view>
    <view v-else class="comment-list">
      <block v-if="comments.length > 0">
        <view class="comment-item" v-for="(item, idx) in comments" :key="item._id || idx">
          <image class="comment-avatar" :src="resolveAvatar(item)" mode="aspectFill"/>
          <view class="comment-main">
            <view class="cmt-header">
              <text class="comment-author">{{ item.isAnonymous ? '匿名用户' : item.authorName }}</text>
              <text class="comment-date">{{ item.createdAt || '' }}</text>
            </view>
            <text class="comment-text">{{ item.content }}</text>
          </view>
        </view>
      </block>
      <view v-else class="empty">暂无评论</view>
    </view>
  </view>
</template>
<script>
import { resolveCommentAuthorAvatar } from '@/utils/defaultAvatar.js';

export default {
  name: 'CommentSection',
  props: {
    commentCount: { type: Number, required: false, default: 0 },
    comments: { type: Array, required: true },
    isCommentLoading: Boolean
  },
  methods: {
    resolveAvatar(item) {
      return resolveCommentAuthorAvatar(item);
    }
  }
};
</script>
<style scoped>
.section-title { font-size: 28rpx; font-weight: 500; margin-bottom: 18rpx; }
.comment-list { margin-top: 10rpx; }
.comment-item { display: flex; border-bottom: 1rpx solid #eee; margin-bottom: 16rpx; padding-bottom: 16rpx; }
.comment-avatar { width: 56rpx; height: 56rpx; border-radius: 50%; margin-right: 15rpx; }
.cmt-header { display: flex; align-items: center; gap: 12rpx; }
.comment-author { font-weight: bold; margin-right: 6rpx; }
.comment-date { color: #aaa; font-size: 20rpx; }
.comment-text { font-size: 30rpx; }
.empty { color: #bbb; text-align: center; padding: 20rpx; }
</style>
