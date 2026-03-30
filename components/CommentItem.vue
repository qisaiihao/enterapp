<template>
    <view :class="isReply ? 'reply-item' : 'comment-item'">
        <image
            :class="isReply ? 'reply-avatar' : 'comment-avatar'"
            :src="avatarSrc"
            mode="aspectFill"
            @error="onAvatarError"
            @click="onNavigateToUser"
        ></image>

        <view :class="isReply ? 'reply-main' : 'comment-main'">
            <view :class="isReply ? 'reply-author' : 'comment-author'">
                {{ item.isAnonymous ? '匿名用户' : item.authorName }}
            </view>
            
            <view :class="isReply ? 'reply-content' : 'comment-content'" @tap="onReplyClick">
                <text v-if="isReply && item.replyToAuthorName" class="reply-to">回复@{{ item.replyToAuthorName }}：</text>
                <text>{{ item.content }}</text>
            </view>
            
            <view v-if="item.imageUrls && item.imageUrls.length" :class="'comment-image-grid' + (isReply ? ' reply-image-grid' : '')">
                <image
                    v-for="(imageUrl, imageIndex) in item.imageUrls"
                    :key="imageIndex"
                    v-if="imageUrl"
                    class="comment-image"
                    :src="imageUrl"
                    :mode="isReply ? 'aspectFill' : 'widthFix'"
                    @tap="onPreviewImage(imageIndex)"
                    @error="onImageError"
                    @load="onImageLoad"
                ></image>
            </view>
            
            <view :class="isReply ? 'reply-footer' : 'comment-footer'">
                <view :class="isReply ? 'reply-time' : 'comment-time'">{{ item.formattedCreateTime }}</view>
                <view :class="isReply ? 'reply-actions' : 'comment-actions'">
                    <view class="like-section" @tap="onLike">
                        <image class="like-icon" :src="item.likeIcon"></image>
                        <text class="like-count">{{ item.likes || 0 }}</text>
                    </view>
                    <view v-if="item.canDelete" class="delete-btn" @tap="onDelete">
                        <image class="delete-icon" src="/static/images/delete.png" mode="aspectFit"></image>
                    </view>
                </view>
            </view>

            <!-- 回复列表（仅评论模式显示） -->
            <view v-if="!isReply && item.replies && item.replies.length > 0" class="replies-container">
                <comment-item
                    v-for="(reply, replyIndex) in visibleReplies"
                    :key="reply._id || replyIndex"
                    :item="reply"
                    :is-reply="true"
                    :comment-index="commentIndex"
                    :reply-index="replyIndex"
                    :parent-comment-id="item._id"
                    @avatar-error="$emit('avatar-error', $event)"
                    @navigate-to-user="$emit('navigate-to-user', $event)"
                    @reply-click="$emit('reply-click', $event)"
                    @like="$emit('like', $event)"
                    @delete="$emit('delete', $event)"
                    @preview-image="$emit('preview-image', $event)"
                />

                <view
                    v-if="item.replies.length > 3 && !item.showAllReplies"
                    class="show-more-replies"
                    @tap="onToggleReplies"
                >
                    <text class="show-more-text">显示{{ item.replies.length - 3 }}条回复</text>
                </view>

                <view
                    v-if="item.replies.length > 3 && item.showAllReplies"
                    class="show-more-replies"
                    @tap="onToggleReplies"
                >
                    <text class="show-more-text">收起回复</text>
                </view>
            </view>
        </view>
    </view>
</template>

<script>
import { resolveCommentAuthorAvatar } from '@/utils/defaultAvatar.js';

export default {
    name: 'CommentItem',
    props: {
        item: {
            type: Object,
            required: true
        },
        isReply: {
            type: Boolean,
            default: false
        },
        commentIndex: {
            type: Number,
            default: 0
        },
        replyIndex: {
            type: Number,
            default: 0
        },
        parentCommentId: {
            type: String,
            default: ''
        }
    },
    computed: {
        avatarSrc() {
            return resolveCommentAuthorAvatar(this.item);
        },
        visibleReplies() {
            if (!this.item.replies) return [];
            return this.item.showAllReplies 
                ? this.item.replies 
                : this.item.replies.slice(0, 3);
        }
    },
    methods: {
        onAvatarError(e) {
            this.$emit('avatar-error', e);
        },
        onNavigateToUser() {
            this.$emit('navigate-to-user', {
                userId: this.item._openid,
                authorName: this.item.authorName,
                isAnonymous: this.item.isAnonymous
            });
        },
        onReplyClick() {
            this.$emit('reply-click', {
                commentId: this.isReply ? this.parentCommentId : this.item._id,
                authorName: this.item.isAnonymous ? '匿名用户' : this.item.authorName,
                replyId: this.isReply ? this.item._id : null
            });
        },
        onLike() {
            this.$emit('like', {
                commentId: this.item._id,
                liked: this.item.liked,
                parentId: this.isReply ? this.parentCommentId : null
            });
        },
        onDelete() {
            this.$emit('delete', {
                commentId: this.item._id,
                parentId: this.isReply ? this.parentCommentId : null
            });
        },
        onPreviewImage(imageIndex) {
            this.$emit('preview-image', {
                commentIndex: this.commentIndex,
                replyIndex: this.isReply ? this.replyIndex : null,
                imageIndex: imageIndex,
                isReply: this.isReply,
                imageUrls: this.item.imageUrls
            });
        },
        onImageError(e) {
            this.$emit('image-error', e);
        },
        onImageLoad(e) {
            this.$emit('image-load', e);
        },
        onToggleReplies() {
            this.$emit('toggle-replies', {
                commentId: this.item._id
            });
        }
    }
};
</script>

<style scoped>
.comment-item {
    display: flex;
    margin-bottom: 0;
    padding: 20rpx 0;
    border-bottom: 1rpx solid #f0f0f0;
}
.comment-item:last-child {
    border-bottom: none;
    margin-bottom: 0;
}

.comment-avatar {
    width: 60rpx;
    height: 60rpx;
    border-radius: 50%;
    margin-right: 15rpx;
    flex-shrink: 0;
    background-color: #f5f5f5;
    pointer-events: auto;
    cursor: pointer;
}

.comment-main {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-width: 0;
}

.comment-author {
    font-size: 28rpx;
    color: #333;
    font-weight: bold;
    margin-bottom: 8rpx;
}

.comment-content {
    font-size: 28rpx;
    color: #666;
    line-height: 1.5;
    word-break: break-word;
    margin-bottom: 10rpx;
    cursor: pointer;
    transition: color 0.2s ease;
}
.comment-content:active {
    color: #9ed7ee;
}

.comment-image-grid {
    display: flex;
    flex-direction: column;
    gap: 12rpx;
    margin-bottom: 12rpx;
    width: 100%;
}

.comment-image {
    width: 100%;
    max-width: 100%;
    height: auto;
    min-height: 200rpx;
    max-height: 800rpx;
    border-radius: 12rpx;
    background-color: #f2f2f2;
    display: block;
    object-fit: contain;
    border: 1px solid #e0e0e0;
}

.reply-image-grid {
    margin-top: 10rpx;
}

.comment-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    width: 100%;
    margin-right: 40rpx;
}

.comment-time {
    font-size: 24rpx;
    color: #999;
    opacity: 0.8;
}

.comment-actions {
    display: flex;
    align-items: center;
    gap: 0;
}

.like-section {
    display: flex;
    align-items: center;
    padding: 4rpx 6rpx;
    transition: all 0.2s ease;
}
.like-section:active {
    transform: scale(0.95);
}

.like-section .like-icon {
    width: 32rpx;
    height: 32rpx;
    margin-right: 4rpx;
}

.like-count {
    font-size: 26rpx;
    color: #666;
}

.delete-btn {
    display: flex;
    align-items: center;
    padding: 4rpx 6rpx;
    transition: opacity 0.2s ease;
}
.delete-btn:active {
    opacity: 0.7;
}

.delete-icon {
    width: 60rpx;
    height: 60rpx;
}

/* 回复容器 */
.replies-container {
    margin-top: 15rpx;
    margin-left: 10rpx;
    padding-left: 10rpx;
    border-left: 2rpx solid #f0f0f0;
}

.reply-item {
    display: flex;
    margin-bottom: 15rpx;
}

.reply-avatar {
    width: 40rpx;
    height: 40rpx;
    border-radius: 50%;
    margin-right: 10rpx;
    flex-shrink: 0;
    background-color: #f5f5f5;
    pointer-events: auto;
    cursor: pointer;
}

.reply-main {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-width: 0;
}

.reply-author {
    font-size: 24rpx;
    color: #333;
    font-weight: bold;
    margin-bottom: 4rpx;
}

.reply-content {
    font-size: 26rpx;
    color: #666;
    line-height: 1.4;
    word-break: break-word;
    cursor: pointer;
    transition: color 0.2s ease;
}
.reply-content:active {
    color: #9ed7ee;
}

.reply-to {
    color: #9ed7ee;
    font-weight: bold;
}

.reply-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-top: 8rpx;
}

.reply-time {
    font-size: 22rpx;
    color: #999;
    opacity: 0.8;
}

.reply-actions {
    display: flex;
    align-items: center;
    gap: 0;
}

.show-more-replies {
    padding: 10rpx 0;
    transition: opacity 0.2s ease;
}
.show-more-replies:active {
    opacity: 0.7;
}

.show-more-text {
    font-size: 24rpx;
    color: #9ed7ee;
}
</style>
