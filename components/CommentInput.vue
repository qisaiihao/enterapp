<template>
    <view>
        <!-- 遮罩层 -->
        <view :class="'input-overlay ' + (isExpanded ? 'show' : '')" @tap="collapse"></view>

        <!-- 展开的输入框 -->
        <view v-if="isExpanded" class="comment-input-area" :style="'bottom: ' + keyboardHeight + 'px;'">
            <view class="expanded-container">
                <!-- 回复提示 -->
                <view v-if="replyToComment" class="reply-prompt">
                    <text class="reply-prompt-text">回复 {{ replyToAuthor }}：</text>
                    <view class="cancel-reply" @tap="cancelReply">
                        <text class="cancel-text">取消</text>
                    </view>
                </view>

                <!-- 文本输入 -->
                <textarea
                    class="expanded-textarea"
                    placeholder="留下你的精彩评论..."
                    :value="newComment"
                    @input="onInput"
                    @focus="onFocus"
                    @blur="onBlur"
                    :focus="isFocus"
                    :adjust-position="false"
                    auto-height
                    maxlength="500"
                    :show-confirm-bar="false"
                    :cursor-spacing="0"
                ></textarea>

                <!-- 已选图片 -->
                <view v-if="images.length" class="selected-comment-images">
                    <view class="selected-image-item" v-for="(item, index) in images" :key="index">
                        <image class="selected-image-thumb" :src="item.previewUrl" mode="aspectFill" @tap="previewImage(index)"></image>
                        <view class="remove-image-btn" @tap="removeImage(index)">✕</view>
                    </view>
                </view>

                <!-- 底部操作 -->
                <view class="expanded-actions">
                    <view class="action-icons">
                        <view class="action-icon" @tap="chooseImages">
                            <image class="action-icon-image" src="/static/images/newicons/image.png" mode="aspectFit"></image>
                        </view>
                    </view>
                    <view class="submit-button" @tap="submit" :class="{ 'disabled': isSubmitDisabled }">
                        <image class="submit-icon" src="/static/images/newicons/comment.png" mode="aspectFit"></image>
                    </view>
                </view>
            </view>
        </view>

        <!-- 底部快捷输入栏 -->
        <view class="bottom-action-bar" v-if="!isExpanded">
            <view class="comment-input-container">
                <input 
                    class="comment-input" 
                    placeholder="评论..." 
                    :value="quickText"
                    :adjust-position="false"
                    @tap="expand"
                />
            </view>
            <view class="action-icons">
                <slot name="extra-actions"></slot>
            </view>
        </view>
    </view>
</template>

<script>
const { previewImage } = require('../utils/imagePreview.js');
const { uploadFile } = require('../utils/uploader.js');

export default {
    name: 'CommentInput',
    props: {
        postId: { type: String, default: '' },
        replyToComment: { type: String, default: '' },
        replyToAuthor: { type: String, default: '' },
        maxImages: { type: Number, default: 3 },
        keyboardHeight: { type: Number, default: 0 },
        submitting: { type: Boolean, default: false }
    },
    data() {
        return {
            isExpanded: false,
            isFocus: false,
            newComment: '',
            quickText: '',
            images: []
        };
    },
    computed: {
        isSubmitDisabled() {
            const hasContent = this.newComment && this.newComment.trim().length > 0;
            const hasImages = this.images.length > 0;
            return this.submitting || (!hasContent && !hasImages);
        }
    },
    watch: {
        replyToComment(val) {
            if (val) this.expand();
        }
    },
    methods: {
        expand() {
            this.isExpanded = true;
            this.isFocus = true;
            this.$emit('expand');
        },
        collapse() {
            if (this.submitting) return;
            this.isExpanded = false;
            this.isFocus = false;
            this.$emit('collapse');
        },
        cancelReply() {
            this.$emit('cancel-reply');
        },
        onInput(e) {
            this.newComment = e.detail.value;
        },
        onFocus() {
            this.isFocus = true;
            this.$emit('focus');
        },
        onBlur() {
            this.isFocus = false;
            this.$emit('blur');
        },
        chooseImages() {
            const remaining = this.maxImages - this.images.length;
            if (remaining <= 0) {
                uni.showToast({ title: `最多选择${this.maxImages}张图片`, icon: 'none' });
                return;
            }
            if (!this.isExpanded) this.expand();

            uni.chooseImage({
                count: remaining,
                sizeType: ['compressed'],
                sourceType: ['album', 'camera'],
                success: (res) => {
                    const tempFiles = res.tempFiles || (res.tempFilePaths || []).map(p => ({ tempFilePath: p }));
                    const newImages = tempFiles.map(file => ({
                        id: 'img_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
                        previewUrl: file.tempFilePath || file.path,
                        originalPath: file.tempFilePath || file.path
                    }));
                    this.images = this.images.concat(newImages).slice(0, this.maxImages);
                },
                fail: (err) => {
                    if (err?.errMsg?.indexOf('cancel') === -1) {
                        uni.showToast({ title: '选择图片失败', icon: 'none' });
                    }
                }
            });
        },
        removeImage(index) {
            this.images.splice(index, 1);
        },
        previewImage(index) {
            const urls = this.images.map(img => img.previewUrl).filter(Boolean);
            if (urls.length) previewImage(urls[index], urls);
        },
        async uploadImages() {
            if (!this.images.length) return [];
            const timestamp = Date.now();
            return Promise.all(this.images.map((img, i) => {
                const cloudPath = `comment_images/${timestamp}_${i}.jpg`;
                return uploadFile(cloudPath, img.originalPath).then(fileID => ({
                    compressedUrl: fileID,
                    originalUrl: fileID
                }));
            }));
        },
        async submit() {
            if (this.isSubmitDisabled || this.submitting) return;
            
            const content = this.newComment.trim();
            if (!content && !this.images.length) {
                uni.showToast({ title: '请输入评论内容', icon: 'none' });
                return;
            }

            this.$emit('submit', {
                content,
                images: this.images,
                uploadImages: () => this.uploadImages()
            });
        },
        // 外部调用：提交成功后清空
        clear() {
            this.newComment = '';
            this.quickText = '';
            this.images = [];
            this.isExpanded = false;
            this.isFocus = false;
        }
    }
};
</script>

<style scoped>
.input-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.3);
    z-index: 98;
    opacity: 0;
    pointer-events: none;
    transition: opacity 0.3s;
}
.input-overlay.show {
    opacity: 1;
    pointer-events: auto;
}

.comment-input-area {
    position: fixed;
    left: 0;
    right: 0;
    background: #fff;
    z-index: 99;
    box-shadow: 0 -4rpx 20rpx rgba(0, 0, 0, 0.1);
}

.expanded-container {
    padding: 20rpx;
}

.reply-prompt {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10rpx 0;
    margin-bottom: 10rpx;
    border-bottom: 1rpx solid #f0f0f0;
}
.reply-prompt-text {
    font-size: 26rpx;
    color: #666;
}
.cancel-reply { padding: 6rpx 12rpx; }
.cancel-text { font-size: 24rpx; color: #999; }

.expanded-textarea {
    width: 100%;
    min-height: 120rpx;
    max-height: 300rpx;
    font-size: 30rpx;
    line-height: 1.6;
    padding: 16rpx;
    box-sizing: border-box;
    border: none;
    outline: none;
    appearance: none;
    -webkit-appearance: none;
    user-select: text;
    -webkit-user-select: text;
}

.selected-comment-images {
    display: flex;
    flex-wrap: wrap;
    gap: 16rpx;
    margin: 16rpx 0;
}
.selected-image-item {
    position: relative;
    width: 160rpx;
    height: 160rpx;
}
.selected-image-thumb {
    width: 100%;
    height: 100%;
    border-radius: 12rpx;
}
.remove-image-btn {
    position: absolute;
    top: -10rpx;
    right: -10rpx;
    width: 40rpx;
    height: 40rpx;
    background: rgba(0,0,0,0.6);
    color: #fff;
    border-radius: 50%;
    font-size: 24rpx;
    display: flex;
    align-items: center;
    justify-content: center;
}

.expanded-actions {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-top: 16rpx;
}

.action-icons {
    display: flex;
    gap: 20rpx;
}
.action-icon { padding: 10rpx; }
.action-icon-image {
    width: 48rpx;
    height: 48rpx;
}

.submit-button {
    padding: 12rpx 24rpx;
    border-radius: 30rpx;
    background: #007AFF;
}
.submit-button.disabled {
    opacity: 0.5;
}
.submit-icon {
    width: 40rpx;
    height: 40rpx;
}

/* 底部快捷栏 */
.bottom-action-bar {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    display: flex;
    align-items: center;
    padding: 16rpx 24rpx;
    padding-bottom: calc(16rpx + env(safe-area-inset-bottom));
    background: #fff;
    border-top: 1rpx solid #f0f0f0;
    z-index: 97;
}
.comment-input-container {
    flex: 1;
    margin-right: 20rpx;
}
.comment-input {
    width: 100%;
    height: 64rpx;
    padding: 0 24rpx;
    background: #f5f5f5;
    border-radius: 32rpx;
    font-size: 28rpx;
}
</style>
