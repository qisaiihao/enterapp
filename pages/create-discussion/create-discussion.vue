<template>
    <view class="create-discussion-container" @tap="onPageTap">
        <!-- 返回按钮 -->
        <view class="back-button" @tap.stop="goBack">
            <image class="back-icon" src="/static/images/back_to_edit.png" mode="aspectFit"></image>
        </view>

        <!-- 标题输入框 -->
        <view class="title-input-wrapper" @tap.stop="noop">
            <input 
                class="title-input" 
                placeholder="输入标题" 
                :value="discussionTitle"
                @input="onTitleInput"
                @tap.stop="noop"
                maxlength="50"
            />
        </view>

        <!-- 句子选择区域 -->
        <view v-if="!hasSelectedSentences" class="sentence-selection-area">
            <!-- 原文显示区域 -->
            <view class="original-content-wrapper">
                <view class="original-content-display">
                    <text class="content-line" v-for="(line, index) in splitContentLines"
                          :key="'content-line-' + index"
                          :class="{ 'selected-line': highlightSelectedLineIndices.includes(index) }"
                          @tap.stop="toggleLineSelection"
                          :data-index="index">
                        {{ line || '\u00A0' }}
                    </text>
                </view>

                <!-- 高光选择提示 -->
                <view v-if="showHighlightHint" class="highlight-hint">
                    <text class="hint-text">点击文字即可选择句子</text>
                </view>
            </view>

            <!-- 完成选择按钮 -->
            <view class="selection-actions">
                <view class="select-done-btn" @tap.stop="finishSelection" :class="{ 'disabled': highlightSelectedLineIndices.length === 0 }">
                    <image class="select-done-icon" src="/static/images/confirm_selection.png" mode="aspectFit"></image>
                </view>
            </view>
        </view>

        <!-- 已选句子评论区域 -->
        <view v-else class="selected-sentences-area">
            <view v-for="(sentenceGroup, groupIndex) in selectedSentenceGroups" :key="'group-' + groupIndex" class="sentence-group">
                <!-- 句子卡片 -->
                <view class="sentence-card">
                    <view class="sentence-content">
                        <text v-for="(line, lineIndex) in sentenceGroup.sentences" :key="'sentence-' + lineIndex" class="sentence-line">
                            {{ line }}
                        </text>
                    </view>
                </view>

                <!-- 评论输入框 -->
                <view class="comment-input-wrapper" @tap.stop="noop">
                    <textarea
                        class="comment-input"
                        :placeholder="groupIndex === 0 ? '分享你对这句子的看法...' : '继续分享你的看法...'"
                        :value="sentenceGroup.comment"
                        @input="onCommentInput"
                        @tap.stop="noop"
                        :data-group-index="groupIndex"
                        auto-height
                        maxlength="500"
                        :show-confirm-bar="false"
                    ></textarea>

                    <!-- 字数统计 -->
                    <view class="char-count">
                        {{ (sentenceGroup.comment || '').length }}/500
                    </view>
                </view>
            </view>

                  </view>

        <!-- 底部按钮组 - 只在已选择句子时显示 -->
        <view v-if="hasSelectedSentences" class="bottom-buttons">
            <view class="button-item" @tap.stop="addMoreSentences">
                <image class="button-icon" src="/static/images/add_tag.png" mode="aspectFit"></image>
            </view>

            <view class="button-item" @tap.stop="saveDraft">
                <image class="button-icon" src="/static/images/save_draft.png" mode="aspectFit"></image>
            </view>

            <view class="button-item" @tap.stop="deleteContent">
                <image class="button-icon" src="/static/images/delete.png" mode="aspectFit"></image>
            </view>

            <view class="button-item" @tap.stop="publishDiscussion">
                <image class="button-icon" src="/static/images/publish.png" mode="aspectFit"></image>
            </view>
        </view>

      </view>
</template>

<script>
const { cloudCall } = require('../../utils/cloudCall.js');

export default {
    data() {
        return {
            quotedPost: null,          // 引用的帖子
            isPublishing: false,       // 是否正在发布
            currentPostId: '',        // 当前引用的帖子ID
            discussionTitle: '',      // 讨论标题

            // 句子选择相关
            hasSelectedSentences: false,          // 是否已选择句子
            selectedSentenceGroups: [],          // 已选择的句子组
            currentSelectingGroup: 0,             // 当前正在选择的组索引

            // 高亮选择相关
            highlightSelectedLineIndices: [],     // 已选中的行索引
            showHighlightHint: false,             // 是否显示高亮提示
        };
    },

    computed: {
        canPublish() {
            // 检查是否至少有一个句子组有评论内容
            const hasValidComment = this.selectedSentenceGroups.some(group =>
                group.comment && group.comment.trim().length > 0
            );
            return hasValidComment && !this.isPublishing;
        },

        // 分割内容为行数组
        splitContentLines() {
            const content = this.quotedPost ? this.quotedPost.fullContent : '';
            return content.split(/\r?\n/);
        }
    },

    onLoad: function(options) {
        const postId = options.postId;
        if (postId) {
            this.currentPostId = postId;
            this.loadQuotedPost(postId);
        } else {
            uni.showToast({
                title: '参数错误',
                icon: 'none'
            });
            setTimeout(() => {
                uni.navigateBack();
            }, 1500);
        }
    },

    methods: {
        // 页面点击事件 - 点击外部区域退出键盘
        onPageTap() {
            uni.hideKeyboard();
        },

        // 空函数，用于阻止事件冒泡
        noop() {},

        // 统一云函数调用方法
        callCloudFunction(name, data = {}, extraOptions = {}) {
            return cloudCall(name, data, Object.assign({ pageTag: 'create-discussion', context: this, requireAuth: true }, extraOptions));
        },

        // 标题输入
        onTitleInput(e) {
            this.setData({
                discussionTitle: e.detail.value
            });
        },

        // 加载引用的帖子信息
        async loadQuotedPost(postId) {
            try {
                uni.showLoading({
                    title: '加载中...',
                    mask: true
                });

                const res = await this.callCloudFunction('getPostDetail', {
                    postId: postId
                });

                if (res.result && res.result.post) {
                    const post = res.result.post;

                    this.setData({
                        quotedPost: {
                            postId: post._id,
                            title: post.title,
                            fullContent: post.content, // 保存完整内容用于选择
                            authorName: post.authorName,
                            authorAvatar: post.authorAvatar,
                            createTime: post.createTime
                        }
                    });

                    // 显示选择提示
                    this.setData({ showHighlightHint: true });
                    setTimeout(() => {
                        this.setData({ showHighlightHint: false });
                    }, 3000);

                } else {
                    uni.showToast({
                        title: '帖子不存在',
                        icon: 'none'
                    });
                    setTimeout(() => {
                        uni.navigateBack();
                    }, 1500);
                }
            } catch (error) {
                console.error('加载引用帖子失败:', error);
                uni.showToast({
                    title: '加载失败',
                    icon: 'none'
                });
            } finally {
                uni.hideLoading();
            }
        },

        // 切换行选择
        toggleLineSelection(e) {
            const lineIndex = parseInt(e.currentTarget.dataset.index);
            console.log('【create-discussion】点击行索引:', lineIndex);

            const arr = this.highlightSelectedLineIndices.slice();
            const pos = arr.indexOf(lineIndex);
            console.log('【create-discussion】当前选中索引:', arr, '点击的索引:', lineIndex, '是否已选中:', pos >= 0);

            if (pos >= 0) {
                // 取消选中
                arr.splice(pos, 1);
                console.log('【create-discussion】取消选中行:', lineIndex);
            } else {
                // 添加选中
                arr.push(lineIndex);
                console.log('【create-discussion】选中行:', lineIndex);
            }

            arr.sort((a, b) => a - b);
            console.log('【create-discussion】更新后的选中索引:', arr);
            this.setData({ highlightSelectedLineIndices: arr });
        },

        // 完成选择
        finishSelection() {
            if (this.highlightSelectedLineIndices.length === 0) {
                uni.showToast({
                    title: '请至少选择一行',
                    icon: 'none'
                });
                return;
            }

            const lines = this.splitContentLines;
            const selectedLines = this.highlightSelectedLineIndices.map(i => lines[i] || '').filter(line => line.trim() !== '');

            if (selectedLines.length === 0) {
                uni.showToast({
                    title: '请选择有效的句子',
                    icon: 'none'
                });
                return;
            }

            // 添加到句子组
            const newGroup = {
                sentences: selectedLines,
                comment: ''
            };

            this.setData({
                selectedSentenceGroups: [...this.selectedSentenceGroups, newGroup],
                hasSelectedSentences: true,
                highlightSelectedLineIndices: []
            });

            uni.showToast({
                title: '句子选择完成',
                icon: 'success'
            });
        },

        // 评论输入
        onCommentInput(e) {
            const groupIndex = parseInt(e.currentTarget.dataset.groupIndex);
            const value = e.detail.value;
            const updatedGroups = this.selectedSentenceGroups.slice();
            updatedGroups[groupIndex].comment = value;

            this.setData({
                selectedSentenceGroups: updatedGroups
            });
        },

        // 添加更多句子
        addMoreSentences() {
            this.setData({
                hasSelectedSentences: false,
                highlightSelectedLineIndices: [],
                showHighlightHint: true
            });

            // 重新显示选择提示
            setTimeout(() => {
                this.setData({ showHighlightHint: false });
            }, 3000);
        },

        // 保存草稿
        saveDraft() {
            if (!this.quotedPost) {
                uni.showToast({
                    title: '没有内容可保存',
                    icon: 'none'
                });
                return;
            }

            try {
                const draftData = {
                    quotedPostId: this.currentPostId,
                    quotedPost: this.quotedPost,
                    selectedSentenceGroups: this.selectedSentenceGroups,
                    hasSelectedSentences: this.hasSelectedSentences,
                    saveTime: new Date().getTime(),
                    isDraft: true,
                    type: 'discussion'
                };

                // 获取现有草稿列表
                let drafts = [];
                try {
                    const existingDrafts = uni.getStorageSync('discussion_drafts');
                    if (existingDrafts && Array.isArray(existingDrafts)) {
                        drafts = existingDrafts;
                    }
                } catch (e) {
                    console.log('获取草稿列表失败，创建新列表');
                }

                // 添加新草稿
                drafts.unshift(draftData);

                // 限制草稿数量（最多保存10个）
                if (drafts.length > 10) {
                    drafts = drafts.slice(0, 10);
                }

                // 保存草稿列表
                uni.setStorageSync('discussion_drafts', drafts);

                uni.showToast({
                    title: '草稿已保存',
                    icon: 'success'
                });

            } catch (e) {
                console.error('保存草稿失败:', e);
                uni.showToast({
                    title: '保存失败',
                    icon: 'none'
                });
            }
        },

        // 删除内容
        deleteContent() {
            uni.showModal({
                title: '确认删除',
                content: '确定要删除所有已选内容吗？',
                confirmText: '删除',
                cancelText: '取消',
                confirmColor: '#ff4757',
                success: (res) => {
                    if (res.confirm) {
                        // 清空所有数据
                        this.setData({
                            selectedSentenceGroups: [],
                            hasSelectedSentences: false,
                            highlightSelectedLineIndices: [],
                            showHighlightHint: true
                        });

                        // 重新显示选择提示
                        setTimeout(() => {
                            this.setData({ showHighlightHint: false });
                        }, 3000);

                        uni.showToast({
                            title: '已清除内容',
                            icon: 'success'
                        });
                    }
                }
            });
        },

        // 发布讨论
        async publishDiscussion() {
            if (!this.canPublish || !this.currentPostId) {
                uni.showToast({
                    title: '请至少输入一条评论',
                    icon: 'none'
                });
                return;
            }

            if (this.isPublishing) {
                return;
            }

            this.setData({
                isPublishing: true
            });

            uni.showLoading({
                title: '发布中...',
                mask: true
            });

            try {
                // 准备发布数据
                const discussionData = {
                    quotedPostId: this.currentPostId,
                    sentenceGroups: this.selectedSentenceGroups,
                    publishMode: 'discussion',
                    isDiscussion: true
                };

                // 发布讨论
                const res = await this.callCloudFunction('createDiscussionPost', {
                    ...discussionData,
                    content: this.generateDiscussionContent(),
                    imageUrls: [],
                    sentenceData: this.selectedSentenceGroups
                });

                if (res.result && res.result.success) {
                    uni.showToast({
                        title: '发布成功',
                        icon: 'success'
                    });

                    // 清除草稿
                    this.clearDraft();

                    // 延迟返回
                    setTimeout(() => {
                        uni.navigateBack();
                    }, 1500);

                } else {
                    throw new Error(res.result?.message || '发布失败');
                }

            } catch (error) {
                console.error('发布讨论失败:', error);
                uni.showToast({
                    title: error.message || '发布失败',
                    icon: 'none',
                    duration: 3000
                });
            } finally {
                this.setData({
                    isPublishing: false
                });
                uni.hideLoading();
            }
        },

        // 清除草稿
        clearDraft() {
            try {
                uni.removeStorageSync('discussion_drafts');
            } catch (e) {
                console.error('清除草稿失败:', e);
            }
        },

        // 生成讨论内容
        generateDiscussionContent() {
            const contents = this.selectedSentenceGroups.map(group => {
                const sentences = group.sentences.join('\n');
                const comment = group.comment || '';
                return `${sentences}\n\n${comment}`;
            });
            return contents.join('\n\n---\n\n');
        },

        // 返回上一页
        goBack() {
            uni.navigateBack();
        }
    }
};
</script>

<style>
.create-discussion-container {
    background: #ffffff;
    min-height: 100vh;
    padding-top: env(safe-area-inset-top);
    padding-bottom: 0; /* 移除底部padding，让固定按钮真正固定 */
    position: relative;
}

/* 返回按钮 */
.back-button {
    position: relative;
    top: 40rpx;
    left: 30rpx;
    width: 80rpx;
    height: 80rpx;
    background: transparent;
    border-radius: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10;
    box-shadow: none;
    backdrop-filter: none;
    margin-top: calc(40rpx + env(safe-area-inset-top));
    margin-left: 0;
}

/* 标题输入框 */
.title-input-wrapper {
    margin: 120rpx 30rpx 20rpx 30rpx;
    position: relative;
}

.title-input {
    width: 100%;
    height: 88rpx; /* 44px * 2 */
    font-family: 'Inter', sans-serif;
    font-weight: 600;
    font-size: 48rpx; /* 24px * 2 */
    line-height: 58rpx; /* 29px * 2 */
    color: #000000;
    background: transparent;
    border: none;
    outline: none;
    padding: 0;
}

.back-button:active {
    transform: scale(0.9);
    opacity: 0.8;
}

.back-icon {
    width: 100rpx;
    height: 100rpx;
}

/* 引用帖子区域 */
.quoted-post {
    background: #fff;
    margin: 180rpx 30rpx 20rpx;
    border-radius: 16rpx;
    padding: 30rpx;
    border-left: 6rpx solid #9ed7ee;
}

.quoted-header {
    display: flex;
    align-items: center;
    margin-bottom: 20rpx;
}

.quoted-label {
    font-size: 24rpx;
    color: #666;
    margin-right: 20rpx;
}

.author-avatar {
    width: 40rpx;
    height: 40rpx;
    border-radius: 50%;
    margin-right: 15rpx;
}

.author-name {
    font-size: 26rpx;
    color: #666;
}

.quoted-content {
    margin-left: 100rpx;
}

.post-title {
    font-size: 30rpx;
    font-weight: 500;
    color: #333;
    margin-bottom: 10rpx;
    display: block;
}

.post-content-preview {
    font-size: 26rpx;
    color: #666;
    line-height: 1.4;
    display: block;
}

/* 主输入区域 */
.main-input-area {
    background: #fff;
    margin: 20rpx 30rpx;
    border-radius: 16rpx;
    padding: 30rpx;
    position: relative;
}

.discussion-input {
    width: 100%;
    min-height: 200rpx;
    font-size: 30rpx;
    line-height: 1.5;
    color: #333;
    background: transparent;
    border: none;
    outline: none;
}

.char-count {
    position: absolute;
    bottom: 20rpx;
    right: 30rpx;
    font-size: 24rpx;
    color: #999;
}

.selection-header {
    margin-bottom: 40rpx;
    text-align: center;
    position: relative;
    z-index: 1001;
}

.selection-title {
    font-size: 36rpx;
    font-weight: 500;
    color: #333;
    display: block;
    margin-bottom: 10rpx;
}

.selection-subtitle {
    font-size: 26rpx;
    color: #666;
    display: block;
}

.original-content-wrapper {
    position: relative;
    border: none;
    border-radius: 0;
    padding: 40rpx;
    background: #ffffff;
    margin-bottom: 40rpx;
}

.original-content-display {
    font-size: 36rpx;
    line-height: 1.8;
    color: #333;
}

.content-line {
    display: block;
    margin-bottom: 16rpx;
    padding: 12rpx 16rpx;
    border-radius: 8rpx;
    transition: all 0.2s ease;
    white-space: pre-wrap;
    word-break: break-word;
    color: #999;
    background-color: rgba(0, 0, 0, 0.05);
}

.content-line.selected-line {
    color: #333;
    background-color: rgba(158, 215, 238, 0.2);
    font-weight: 500;
    border-left: 4rpx solid #9ed7ee;
    padding-left: 20rpx;
}

/* 高光选择提示 */
.highlight-hint {
    position: fixed;
    bottom: 100rpx;
    left: 50%;
    transform: translateX(-50%);
    background: rgba(128, 128, 128, 0.8);
    color: white;
    padding: 12rpx 24rpx;
    border-radius: 20rpx;
    z-index: 1000;
    text-align: center;
    white-space: nowrap;
}

.hint-text {
    font-size: 24rpx;
    line-height: 1.2;
}

.selection-actions {
    position: fixed;
    bottom: 60rpx;
    right: 30rpx;
    z-index: 1001;
}

.select-done-btn {
    width: 100rpx;
    height: 100rpx;
    background: #9ed7ee;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 4rpx 12rpx rgba(0, 0, 0, 0.15);
    transition: all 0.3s ease;
}

.select-done-btn:active {
    transform: scale(0.95);
}

.select-done-btn.disabled {
    background: #ccc;
    opacity: 0.5;
}

.select-done-icon {
    width: 60rpx;
    height: 60rpx;
}

.sentence-group {
    background: #fff;
    border-radius: 16rpx;
    padding: 30rpx;
    margin-bottom: 20rpx;
}

.sentence-card {
    background: transparent;
    border-radius: 0;
    padding: 30rpx;
    margin-bottom: 20rpx;
    width: 100%;
    min-height: 120rpx;
    position: relative;
    box-sizing: border-box;
    max-width: 100%;
}

.sentence-content {
    position: relative;
    width: 100%;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: flex-start;
    box-sizing: border-box;
    max-width: 100%;
}

.sentence-line {
    font-family: 'Inter', sans-serif;
    font-style: italic;
    font-weight: 600;
    font-size: 40rpx; /* 20px * 2 */
    line-height: 48rpx; /* 24px * 2 */
    color: #989090;
    display: block;
    margin-bottom: 8rpx;
    word-wrap: break-word;
    word-break: break-all;
    width: 100%;
    max-width: 100%;
    box-sizing: border-box;
    overflow-wrap: break-word;
}

.sentence-line:last-child {
    margin-bottom: 0;
}

/* 响应式设计 - 根据屏幕宽度调整 */
@media screen and (max-width: 750rpx) {
    .sentence-card {
        padding: 20rpx;
        min-height: 100rpx;
    }
    
    .sentence-line {
        font-size: 36rpx;
        line-height: 44rpx;
    }
}

@media screen and (min-width: 750rpx) {
    .sentence-card {
        padding: 40rpx;
        min-height: 140rpx;
    }
    
    .sentence-line {
        font-size: 44rpx;
        line-height: 52rpx;
    }
}

/* 评论输入框 */
.comment-input-wrapper {
    position: relative;
    border: 1rpx solid #e0e0e0;
    border-radius: 20rpx;
    background: #fff;
}

.comment-input {
    width: 100%;
    min-height: 100rpx;
    font-family: 'Inter', sans-serif;
    font-weight: 600;
    font-size: 32rpx; /* 16px * 2 */
    line-height: 38rpx; /* 19px * 2 */
    color: #000000;
    padding: 20rpx;
    background: transparent;
    border: none;
    outline: none;
    resize: none;
}

/* 底部按钮组 */
.bottom-buttons {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    background: #fff;
    padding: 30rpx 40rpx calc(60rpx + env(safe-area-inset-bottom)) 40rpx;
    display: flex;
    justify-content: space-around;
    align-items: center;
    z-index: 9999; /* 提高z-index确保在所有元素之上 */
    border-top: 1rpx solid #f0f0f0;
    box-shadow: 0 -2rpx 10rpx rgba(0, 0, 0, 0.1); /* 添加阴影效果 */
}

.button-item {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 20rpx;
    min-width: 120rpx;
    transition: all 0.2s ease;
    cursor: pointer;
}

.button-item:active {
    transform: scale(0.9);
    opacity: 0.8;
}

.button-icon {
    width: 80rpx;
    height: 80rpx;
}

/* 句子选择区域 */
.sentence-selection-area {
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    background: #fff;
    z-index: 1000;
    padding: calc(env(safe-area-inset-top) + 120rpx) 30rpx 30rpx 30rpx;
    box-sizing: border-box;
    overflow-y: auto;
}

/* 已选句子区域 - 需要为底部按钮留出空间 */
.selected-sentences-area {
    margin: 20rpx 30rpx 20rpx 30rpx; /* 调整上边距，因为标题输入框已经处理了间距 */
    margin-bottom: 200rpx; /* 为底部按钮留出空间 */
    padding-bottom: 160rpx; /* 增加底部padding，为固定按钮留出足够空间 */
    box-sizing: border-box;
    max-width: calc(100vw - 60rpx); /* 确保不超出屏幕，减去左右边距 */
}

</style>