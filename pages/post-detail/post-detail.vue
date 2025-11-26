<template>
    <view>
        
        <!-- pages/post-detail/post-detail.wxml -->
        <!-- 自定义返回按钮 -->
        <view class="custom-back-btn" @tap="goBack">
            <image class="back-icon" src="/static/images/back_to_edit.png" mode="aspectFit"></image>
        </view>
        
        <view class="container">
            <block v-if="isLoading">
                <post-detail-skeleton :comment-count="commentSkeletonCount" />
            </block>
            <block v-else-if="post && post._id">
                <!-- Post Content -->
                <view :class="'post-detail-wrapper ' + (post.isOriginal ? 'original-post' : '') + (post.isPoem ? ' poem-post' : '')">
                    <view class="author-info">
                        <view class="author-basic">
                            <image
                                class="author-avatar"
                                :src="post.isAnonymous ? '/static/images/avatar.png' : (post.authorAvatar || '/static/images/avatar.png')"
                                mode="aspectFill"
                                @error="onAvatarError"
                                @click="navigateToUserProfile"
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
                            <button
                                v-if="showFollowButton && !post.isAnonymous && !isMutualFollow"
                                :class="'follow-btn ' + (isFollowing ? 'following' : '')"
                                @tap="onFollowTap"
                                :loading="followPending"
                                :disabled="followPending"
                            >
                                {{ isFollowing ? '已关注' : '关注' }}
                            </button>
                        </view>
                    </view>
                    <view class="post-title">{{ post.title }}</view>
                    <view v-if="post.isPoem && post.author" class="poem-author">{{ post.author }}</view>
                    
                    <!-- 讨论类型帖子特殊渲染 -->
                    <view v-if="post.isDiscussion && post.sentenceGroups" class="discussion-content">
                        <view v-for="(sentenceGroup, groupIndex) in post.sentenceGroups" :key="'discussion-group-' + groupIndex" class="discussion-sentence-group">
                            <!-- 句子卡片 -->
                            <view class="discussion-sentence-card">
                                <view class="discussion-sentence-content">
                                    <text v-for="(line, lineIndex) in sentenceGroup.sentences" :key="'discussion-sentence-' + lineIndex" class="discussion-sentence-line">
                                        {{ line }}
                                    </text>
                                </view>
                            </view>
                            
                            <!-- 评论内容 -->
                            <view v-if="sentenceGroup.comment" class="discussion-comment">
                                {{ sentenceGroup.comment }}
                            </view>
                        </view>
                    </view>
                    
                    <!-- 普通帖子内容 -->
                    <view class="post-content" v-else-if="post.content">{{ post.content }}</view>

                    <view v-if="post.tags && post.tags.length > 0" class="post-tags">
                        <text class="post-tag" @tap.stop.prevent="onTagClick" :data-tag="item" v-for="(item, index) in post.tags" :key="index">#{{ item }}</text>
                    </view>

                    <view v-if="post.imageUrl || (post.imageUrls && post.imageUrls.length > 0)" class="image-container" id="detail-image-container">
                        <block v-if="post.imageUrls && post.imageUrls.length === 1">
                            <image
                                :id="'single-image-' + (post && post._id ? post._id : '')"
                                :src="post.imageUrls[0]"
                                :mode="(post && post._id && imageClampHeights[post._id]) ? 'aspectFill' : 'widthFix'"
                                :style="
                                    'width: 100%; height: ' +
                                    (post && post._id && imageClampHeights[post._id] ? imageClampHeights[post._id] + 'px' : 'auto') +
                                    '; object-fit: ' +
                                    (post && post._id && imageClampHeights[post._id] ? 'cover' : 'contain') +
                                    '; background-color: #f0f0f0;'
                                "
                                @load="onImageLoad"
                                :data-postid="post && post._id ? post._id : ''"
                                data-type="single"
                                @error="onImageError"
                                @tap.stop.prevent="handlePreview"
                                :data-src="post.imageUrls[0]"
                                :data-original-image-urls="post.originalImageUrls || post.imageUrls"
                                :lazy-load="true"
                            />
                        </block>

                        <block v-else-if="post.imageUrls && post.imageUrls.length > 1">
                            <swiper
                                :id="'swiper-' + (post && post._id ? post._id : '')"
                                class="image-swiper"
                                :indicator-dots="true"
                                :circular="true"
                                :style="'width: 100%; height: ' + (swiperHeights[0] ? swiperHeights[0] + 'px' : '220px') + ';'"
                            >
                                <block v-for="(img, imgindex) in post.imageUrls" :key="imgindex">
                                    <swiper-item>
                                        <image
                                            :src="img"
                                            mode="aspectFill"
                                            @load="onImageLoad"
                                            :data-postid="post && post._id ? post._id : ''"
                                            data-postindex="0"
                                            :data-imgindex="imgindex"
                                            data-type="multi"
                                            @error="onImageError"
                                            @tap.stop.prevent="handlePreview"
                                            :data-src="img"
                                            :data-original-image-urls="post.originalImageUrls || post.imageUrls"
                                            :lazy-load="true"
                                            style="width: 100%; height: 100%; object-fit: cover; background-color: #f0f0f0"
                                        />
                                    </swiper-item>
                                </block>
                            </swiper>
                        </block>
                    </view>

                    <view class="post-meta">
                        <text class="post-time">{{ post.formattedCreateTime }}</text>
                    </view>
                    <view class="vote-section" @tap.stop.prevent="preventBubble">
                        <view class="actions-left">
                            <!-- 左侧按钮区域保留为空，或者可以放其他按钮 -->
                        </view>
                        <view class="button-group">
                            <view class="like-icon-container" @tap.stop.prevent="onVote" :data-postid="post && post._id ? post._id : ''">
                                <image class="like-icon" :src="post.likeIcon" mode="aspectFit"></image>
                            </view>
                            <!-- 作品集按钮 - 只有原创诗且是自己的帖子才显示 -->
                            <view v-if="post.isOriginal && post.isPoem && isOwnPost" class="portfolio-icon-container" @tap.stop.prevent="onAddToPortfolio">
                                <image class="portfolio-icon" src="/static/images/portfolio.png" mode="aspectFit"></image>
                            </view>
                              <!-- 分享按钮（仅诗歌帖子显示） -->
                            <view v-if="post && post.isPoem" class="share-icon-container" @tap.stop.prevent="onShare">
                                <image class="share-icon" src="/static/images/share.png" mode="aspectFit"></image>
                            </view>
                        </view>
                    </view>
                </view>

                <!-- Comment Section -->
                <comment-list
                    :comments="comments"
                    :comment-count="commentCount"
                    :is-loading="isCommentLoading"
                    :skeleton-count="commentSkeletonCount"
                    @avatar-error="onAvatarError"
                    @navigate-to-user="handleCommentNavigateToUser"
                    @reply-click="handleReplyClick"
                    @like="handleCommentLike"
                    @delete="handleCommentDelete"
                    @preview-image="handleCommentPreviewImage"
                    @toggle-replies="handleToggleReplies"
                />
            </block>
            <block v-else>
                <view class="error-container">
                    <view class="error-icon">❌</view>
                    <view class="error-text">帖子加载失败或不存在</view>
                </view>
            </block>
        </view>

        <!-- 遮罩层：当输入框展开时显示 -->
        <view :class="'input-overlay ' + (isInputExpanded ? 'show' : '')" @tap="collapseInput"></view>

        <!-- 输入框容器：保持在页面底部 -->
        <view v-if="isInputExpanded" class="comment-input-area" :style="'bottom: ' + keyboardHeight + 'px;'">

            <!-- 展开状态：真正的输入区域 -->
            <view v-if="isInputExpanded" class="expanded-container">

                <!-- 如果是回复，显示提示 -->
                <view v-if="replyToComment" class="reply-prompt">
                    <text class="reply-prompt-text">回复 {{ replyToAuthor }}：</text>
                    <view class="cancel-reply" @tap="cancelReply">
                        <text class="cancel-text">取消</text>
                    </view>
                </view>


                <!-- 多行文本输入框 -->
                <textarea
                    class="expanded-textarea"
                    placeholder="留下你的精彩评论..."
                    :value="newComment"
                    @input="onCommentInput"
                    @focus="onInputFocus"
                    @blur="onInputBlur"
                    :focus="isFocus"
                    :adjust-position="false"
                    auto-height
                    maxlength="500"
                    :show-confirm-bar="false"
                    :cursor-spacing="0"
                ></textarea>

                <!-- 评论图片显示 -->
                <view v-if="commentImages.length" class="selected-comment-images">
                    <view class="selected-image-item" :data-index="index" v-for="(item, index) in commentImages" :key="index">
                        <image class="selected-image-thumb" :src="item.previewUrl" mode="aspectFill" @tap="previewSelectedCommentImage" :data-index="index"></image>
                        <view class="remove-image-btn" @tap="removeCommentImage" :data-index="index">✕</view>
                    </view>
                </view>

                <!-- 底部操作栏，包含发送按钮 -->
                <view class="expanded-actions">
                    <view class="action-icons">
                        <view class="action-icon" @tap="chooseImages">
                            <image class="action-icon-image" src="/static/images/add_image.png" mode="aspectFit"></image>
                        </view>
                        </view>
                    <view class="submit-button" @tap="onSubmitComment" :class="{ 'disabled': isSubmitDisabled }">
                        <image class="submit-icon" src="/static/images/commententer.png" mode="aspectFit"></image>
                    </view>
                </view>
            </view>
        </view>

        <!-- 底部操作栏 -->
        <view class="bottom-action-bar" v-if="!isInputExpanded">
            <view class="comment-input-container">
                <input 
                    class="comment-input" 
                    placeholder="评论..." 
                    :value="quickCommentText"
                    :adjust-position="false"
                    @input="onQuickCommentInput"
                    @confirm="onQuickCommentSubmit"
                    @tap="expandInput"
                />
            </view>
            <view class="action-icons">
                <view class="action-icon" @tap="showDiscussionModal">
                    <image class="action-icon-image" src="/static/images/write_poetry.png" mode="aspectFit"></image>
                </view>
                <view class="action-icon" @tap="toggleFavorite">
                    <image class="action-icon-image" :src="post && post.isFavorited ? '/static/images/my_favorites.png' : '/static/images/my_favorites.png'" mode="aspectFit"></image>
                </view>
            </view>
        </view>

        <!-- Cloud Tip Modal -->
        <cloud-tip-modal :showUploadTip="showUploadTip"></cloud-tip-modal>

        <!-- 收藏夹选择器 -->
        <folder-selector :show="showFavoriteModal" :post-id="post && post._id ? post._id : ''" @hide="hideFavoriteModal" @favoriteSuccess="onFavoriteSuccess" />

        <!-- 作品集选择器 -->
        <portfolio-selector :show="showPortfolioModal" :post-id="post && post._id ? post._id : ''" @hide="hidePortfolioModal" @portfolioSuccess="onPortfolioSuccess" />

        <!-- 分享弹窗（仅诗歌帖子显示） -->
        <share-modal
            v-if="post && post.isPoem"
            :show="showShareModal"
            :image-url="shareImageUrl"
            :longpress-menu-enabled="shareLongpressMenuEnabled"
            @hide="hideShareModal"
            @longpress="onImageLongPress"
            @load="onShareImageLoad"
            @error="onShareImageError"
            @save="saveShareImage"
        />

        <!-- 隐藏的canvas用于生成分享图片（增加 id 便于 H5 兜底导出） -->
        <canvas id="shareCanvas" canvas-id="shareCanvas" style="position: fixed; top: -9999px; left: -9999px; width: 750px; border-radius: 15px; overflow: hidden;" :style="{ height: shareCanvasHeight + 'px' }"></canvas>
      <!-- 评论区、其它内容 --> 
    <view v-if="showEditModal" class="edit-modal-mask">
        <view class="edit-modal">
            <view class="edit-modal-title">编辑帖子</view>
            <input class="edit-title-input" :value="editForm.title" data-field="title" @input="onEditInput" placeholder="请输入标题" />
            <textarea class="edit-content-textarea" :value="editForm.content" data-field="content" @input="onEditInput" placeholder="请输入正文" />
            <view class="edit-modal-actions">
                <button class="modal-cancel" @tap="onCancelEdit">取消</button>
                <button class="modal-confirm" @tap="onSaveEdit">保存</button>
            </view>
        </view>
    </view>
    </view>
</template>

<script>
import cloudTipModal from '@/components/cloudTipModal/index';
import folderSelector from '@/components/folder-selector/folder-selector';
import portfolioSelector from '@/components/portfolio-selector/portfolio-selector';
import PostDetailSkeleton from '@/components/PostDetailSkeleton.vue';
import CommentList from '@/components/CommentList.vue';
import ShareModal from '@/components/ShareModal.vue';
// pages/post-detail/post-detail.js
const app = getApp();
const likeIcon = require('../../utils/likeIcon');
const { togglePostLike } = require('../../utils/likeService.js');
const { previewImage } = require('../../utils/imagePreview.js');
const { formatRelativeTime } = require('../../utils/time.js');
const avatarCache = require('../../utils/avatarCache');
const followCache = require('../../utils/followCache');
const { cloudCall } = require('../../utils/cloudCall.js');
const { uploadFile } = require('../../utils/uploader.js');
const postGalleryMixin = require('../../mixins/postGallery.js');
import { hydrateTempUrls, warmTempUrlsFromPosts } from '@/_utils/hydrate-temp-urls';
import fileUrlCache from '@/_utils/file-url-cache';

// 导入重构后的工具函数
const { getCurrentUserId } = require('../../utils/auth.js');
const { calculateActualLines, wrapText, clampText } = require('../../utils/canvasText.js');
const { processComments, validateCommentInput, processCommentImages, findComment, calculateRemainingChars } = require('../../utils/commentUtils.js');
const { generateShareImageName, isValidImageDataUrl, base64ToArrayBuffer, saveImageToAlbum, createTempFilePath, compressImage, getImageInfo } = require('../../utils/shareImage.js');

// 导入重构后的API函数
const { getPostDetail, updatePostContent, togglePostFavorite, recordPostView } = require('../../api-cache/post.js');
const { getComments, submitComment, deleteComment, likeComment } = require('../../api-cache/comment.js');
const { checkFollowStatus, toggleFollowStatus } = require('../../api-cache/following.js');
export default {
    components: {
        cloudTipModal,
        folderSelector,
        portfolioSelector,
        PostDetailSkeleton,
        CommentList,
        ShareModal
    },
    mixins: [postGalleryMixin],
    data() {
        return {
            post: null,
            comments: [],
            newComment: '',
            commentCount: 0,
            isLoading: true,
            isCommentLoading: true,
            commentSkeletonCount: 3,
            isSubmitDisabled: true,
            replyToComment: null,
            replyToAuthor: '',
            showUploadTip: false,
            votingInProgress: false,
            imageContainerHeight: null,
            swiperHeights: {},
            imageClampHeights: {},
            showFavoriteModal: false,
            showPortfolioModal: false,
            showShareModal: false,
            shareImageUrl: '',
            shareCanvasHeight: 1000,
            shareImageRetryCount: 0,
            isInputExpanded: false,
            currentScrollTop: 0,
            isFocus: false,
            keyboardHeight: 0,
            viewStartTime: 0,
            currentPostId: null,
            isFavorited: false,
            favoriteButtonText: '收藏',
            favoriteButtonClass: 'favorite-button',
            showFollowButton: false,
            isFollowing: false,
            followPending: false,
            isFollowedByAuthor: false,
            isMutualFollow: false,
            isOwnPost: false,
            showEditModal: false,
            editForm: {
                title: '',
                content: '',
            },
            commentImages: [],
            maxCommentImages: 3,
            isSubmittingComment: false,
            quickCommentText: '',
            // 是否启用原生长按菜单（仅小程序有效）
            shareLongpressMenuEnabled: false,
        };
    },
    onLoad: function (options) {
        const postId = options.id;
        if (postId) {
            this.setData({
                currentPostId: postId
            });
            this.loadPostDetail(postId);
            // 监听全局点赞变更，实时同步当前帖子的点赞状态
            try { uni.$on && uni.$on('like-changed', this.onGlobalLikeChanged); } catch (_) {}
            // 监听评论点赞变更
            try { uni.$on && uni.$on('comment-like-changed', this.onGlobalCommentLikeChanged); } catch (_) {}
            // 监听全局点赞变更，实时同步当前帖子的点赞状态
        } else {
            this.setData({
                isLoading: false,
                isCommentLoading: false
            });
            uni.showToast({
                title: '无效的帖子ID',
                icon: 'none'
            });
        }

        // 平台开关：仅小程序启用系统长按菜单
        try {
            // #ifdef MP-WEIXIN
            this.shareLongpressMenuEnabled = true;
            // #endif
        } catch (e) {}

        // 注册键盘高度监听
        // #ifdef MP-WEIXIN || APP-PLUS
        try {
            this.keyboardHeightChangeHandler = (res) => {
                const height = res.height || 0;
                this.setData({
                    keyboardHeight: height
                });
            };
            uni.onKeyboardHeightChange(this.keyboardHeightChangeHandler);
        } catch (e) {
            console.warn('键盘高度监听设置失败:', e);
        }
        // #endif

    },
    onShow: function () {
        this.setData({
            viewStartTime: Date.now()
        });

        // 同步当前帖子的点赞状态
        this.syncCurrentPostLikeStatus();
    },
    onPageScroll: function(e) {
        // 持续记录当前滚动位置
        this.currentScrollTop = e.scrollTop || 0;
    },
    onUnload: function () {
        try { const viewEvents = require('../../utils/viewEvents.js'); viewEvents.flushViewQueue(); } catch (e) {}
        try { uni.$off && this.onGlobalCommentLikeChanged && uni.$off('comment-like-changed', this.onGlobalCommentLikeChanged); } catch (_) {}

        // 取消键盘高度监听
        // #ifdef MP-WEIXIN || APP-PLUS
        try {
            if (this.keyboardHeightChangeHandler) {
                uni.offKeyboardHeightChange(this.keyboardHeightChangeHandler);
                this.keyboardHeightChangeHandler = null;
            }
        } catch (e) {
            console.warn('取消键盘高度监听失败:', e);
        }
        // #endif
    },
    onHide: function () {
        if (this.isInputExpanded) {
            this.collapseInput();
        }
        try { const viewEvents = require('../../utils/viewEvents.js'); viewEvents.flushViewQueue(); } catch (e) {}
    },
    methods: {
        // 处理匿名头像点击事件的函数
        handleAnonymousAvatarClick(e) {
            if (e && e.preventDefault) {
                e.preventDefault();
            }
            if (e && e.stopPropagation) {
                e.stopPropagation();
            }
            // 显示提示信息
            uni.showToast({
                title: '匿名用户无法查看主页',
                icon: 'none'
            });
        },
        // 跨页同步：监听 like-changed 的处理
        onGlobalLikeChanged: function (e = {}) {
            try {
                const postId = e.postId;
                if (!postId || !this.post || !this.post._id) return;
                if (postId !== this.post._id) return;
                const votes = typeof e.votes === 'number' ? e.votes : (this.post.votes || 0);
                const isLiked = typeof e.isLiked === 'boolean' ? e.isLiked : !!this.post.isVoted;
                const likeIcon = require('../../utils/likeIcon');
                this.setData({
                    'post.votes': votes,
                    'post.isVoted': isLiked,
                    'post.likeIcon': likeIcon.getLikeIcon(votes, isLiked)
                });
            } catch (_) {}
        },
        // 接收外部评论点赞事件进行本页同步
        onGlobalCommentLikeChanged: function (e = {}) {
            try {
                const { commentId, likes, liked } = e || {};
                if (!commentId) return;
                const comments = this.comments || [];
                const { comment } = this.findComment(comments, commentId);
                if (!comment) return;
                const likeIconUtil = require('../../utils/likeIcon');
                comment.likes = typeof likes === 'number' ? likes : (comment.likes || 0);
                comment.liked = typeof liked === 'boolean' ? liked : !!comment.liked;
                comment.likeIcon = likeIconUtil.getLikeIcon(comment.likes, comment.liked);
                this.setData({ comments });
            } catch (_) {}
        },
        // 同步当前帖子的点赞状态
        syncCurrentPostLikeStatus: function () {
            try {
                if (!this.post || !this.post._id) {
                    return;
                }

                const postId = this.post._id;

                // 使用同步工具同步当前帖子的点赞状态
                const { syncLikeStatusForPosts } = require('../../utils/likeStatusSync.js');
                const syncResult = syncLikeStatusForPosts([postId]);

                if (syncResult.success && syncResult.updated > 0) {
                    // 更新当前帖子的显示状态
                    const { getLatestLikeStatus } = require('../../utils/likeStatusSync.js');
                    const latestStatus = getLatestLikeStatus(postId);

                    if (latestStatus) {
                        const likeIcon = require('../../utils/likeIcon');
                        const newLikeIcon = likeIcon.getLikeIcon(latestStatus.votes, latestStatus.isVoted);

                        this.setData({
                            'post.votes': latestStatus.votes,
                            'post.isVoted': latestStatus.isVoted,
                            'post.likeIcon': newLikeIcon
                        });
                    }
                } else if (syncResult.errors.length > 0) {
                    console.warn('【帖子详情】点赞状态同步出现错误:', syncResult.errors);
                }
            } catch (err) {
                console.error('【帖子详情】同步当前帖子点赞状态失败:', err);
            }
        },

        loadPostDetail: function (postId) {
            this.setData({
                isCommentLoading: true
            });

            getPostDetail(postId)
                .then(async (res) => {
                    if (res.result && res.result.post) {
                        let post = res.result.post;
                        post.formattedCreateTime = this.formatTime(post.createTime);
                        post.likeIcon = likeIcon.getLikeIcon(post.votes || 0, post.isVoted || false);
                        // 将 cloud:// 映射为可访问 URL，并预热
                        await hydrateTempUrls([post]);
                        warmTempUrlsFromPosts([post]);
                        const finalCommentCount = res.result.commentCount || post.commentCount || 0;
                        this.setData({
                            post: post,
                            commentCount: finalCommentCount
                        });
                        this.getComments(post && post._id ? post._id : '');
                        this.prepareFollowState(post._openid);
                    } else {
                        this.setData({
                            isCommentLoading: false
                        });
                        uni.showToast({
                            title: '帖子加载失败',
                            icon: 'none'
                        });
                    }
                })
                .catch((err) => {
                    console.error('Failed to get post detail', err);
                    this.setData({
                        isCommentLoading: false
                    });
                    uni.showToast({
                        title: '网络错误',
                        icon: 'none'
                    });
                })
                .finally(() => {
                    this.setData({
                        isLoading: false
                    });
                });
        },

        getComments: function (postId) {
            this.setData({
                isCommentLoading: true
            });

            getComments(postId)
                .then(async (res) => {
                    if (res.result && res.result.comments) {
                        // 使用新的评论处理工具函数
                        const comments = processComments(res.result.comments);
                        const newCommentCount = res.result.commentCount || comments.length;
                        const shouldUpdateCount = newCommentCount > this.commentCount;

                        // 使用setData确保响应式更新
                        this.setData({
                            comments: comments,
                            commentCount: shouldUpdateCount ? newCommentCount : this.commentCount
                        });
                    } else {
                        uni.showToast({
                            title: '评论加载失败',
                            icon: 'none'
                        });
                    }
                })
                .catch((err) => {
                    console.error('Failed to get comments', err);
                    uni.showToast({
                        title: '网络错误',
                        icon: 'none'
                    });
                })
                .finally(() => {
                    this.setData({
                        isCommentLoading: false
                    });
                });
        },

        onVote: function (event) {
            const postId = event.currentTarget.dataset.postid;
            if (this.votingInProgress) {
                return;
            }
            this.setData({
                votingInProgress: true
            });
            const post = this.post;
            const originalVotes = post.votes;
            const originalIsVoted = post.isVoted;
            const newVotes = originalIsVoted ? originalVotes - 1 : originalVotes + 1;
            const newIsVoted = !originalIsVoted;
            const newLikeIcon = likeIcon.getLikeIcon(newVotes, newIsVoted);
            this.setData({
                'post.votes': newVotes,
                'post.isVoted': newIsVoted,
                'post.likeIcon': newLikeIcon
            });
            togglePostLike(postId, {
                pageTag: 'post-detail',
                context: this,
                currentVotes: originalVotes,
                currentIsLiked: originalIsVoted,
                requireAuth: true
            }).then((result) => {
                if (result.success) {
                    this.setData({
                        'post.votes': result.votes,
                        'post.isVoted': result.isLiked,
                        'post.likeIcon': result.likeIcon
                    });
                    return;
                }

                const rollback = result.rollback || {
                    votes: originalVotes,
                    isLiked: originalIsVoted,
                    likeIcon: likeIcon.getLikeIcon(originalVotes, originalIsVoted)
                };
                this.setData({
                    'post.votes': rollback.votes,
                    'post.isVoted': rollback.isLiked,
                    'post.likeIcon': rollback.likeIcon
                });
            }).catch((error) => {
                console.error('【帖子详情点赞】调用 likeService 失败', error);
                this.setData({
                    'post.votes': originalVotes,
                    'post.isVoted': originalIsVoted,
                    'post.likeIcon': likeIcon.getLikeIcon(originalVotes, originalIsVoted)
                });
            }).finally(() => {
                this.setData({
                    votingInProgress: false
                });
            });
        },

        onFavorite: function () {
            if (this.isFavorited) {
                uni.showToast({
                    title: '已经收藏过了',
                    icon: 'none'
                });
                return;
            }
            this.setData({
                showFavoriteModal: true
            });
        },

        onAddToPortfolio: function () {
            if (!this.post || !this.post._id) {
                uni.showToast({
                    title: '帖子信息无效',
                    icon: 'none'
                });
                return;
            }

            // 显示作品集选择器
            this.setData({
                showPortfolioModal: true
            });

            // 延迟一下确保数据已设置
        },

        hideFavoriteModal: function () {
            this.setData({
                showFavoriteModal: false
            });
        },

        onFavoriteSuccess: function () {
            this.hideFavoriteModal();
            this.setData({
                isFavorited: true,
                favoriteButtonText: '已收藏',
                favoriteButtonClass: 'favorite-button favorited'
            });
            uni.showToast({
                title: '收藏成功',
                icon: 'success'
            });
            try {
                const appInstance = getApp();
                const userId = appInstance && appInstance.globalData && appInstance.globalData.openid;
                const postId = this.post && this.post._id;
                if (userId && postId && uni.$emit) {
                    uni.$emit('favorite-changed', { userId, postId, favored: true });
                }
            } catch (e) {}
        },

        hidePortfolioModal: function () {
            this.setData({
                showPortfolioModal: false
            });
        },

        // 分享相关方法
        onShare: function () {
            if (!this.post || !this.post._id) {
                uni.showToast({
                    title: '帖子信息无效',
                    icon: 'none'
                });
                return;
            }
            if (!this.post.isPoem) {
                uni.showToast({
                    title: '仅诗歌帖子支持分享',
                    icon: 'none'
                });
                return;
            }

            // 显示分享弹窗，重置图片URL，并立即开始生成图片
            this.setData({
                showShareModal: true,
                shareImageUrl: '',
                shareImageRetryCount: 0,
                shareCanvasHeight: 4000
            });
            
            // 立即开始生成图片
            this.generateShareImage();
        },

        hideShareModal: function () {
            this.setData({
                showShareModal: false
            });
        },

        generateShareImage: function () {
            // 先加载字体，然后绘制Canvas
            this.loadFontAndDraw();
        },

        loadFontAndDraw: function () {
            uni.loadFontFace({
                family: 'Huiwen-mincho',
                source: 'url("/static/fonts/Huiwen-mincho.otf")',
                success: () => {
                    // 延迟一下确保DOM已渲染
                    setTimeout(() => {
                        this.drawCanvas();
                    }, 100);
                },
                fail: (err) => {
                    console.error('【post-detail】字体加载失败:', err);
                    // 即使字体加载失败，也继续绘制（使用默认字体）
                    setTimeout(() => {
                        this.drawCanvas();
                    }, 100);
                }
            });
        },

        /**
         * 异步绘制网络图片到 Canvas，固定宽度，高度自适应
         * @param {Object} ctx - Canvas 的绘图上下文
         * @param {string} url - 网络图片的 URL
         * @param {number} x - 绘制位置的 x 坐标
         * @param {number} y - 绘制位置的 y 坐标
         * @param {number} fixedWidth - 固定宽度
         * @returns {Promise<void>} - 操作完成时 resolve
         */
        drawImageAsync: function(ctx, url, x, y, fixedWidth) {
            return new Promise((resolve, reject) => {
                // 检查URL是否有效
                if (!url || typeof url !== 'string') {
                    console.error('【Canvas】无效的图片URL:', url);
                    reject(new Error('无效的图片URL'));
                    return;
                }
                
                // 统一使用uni.getImageInfo，但添加错误处理
                uni.getImageInfo({
                    src: url,
                    success: (res) => {
                        try {
                            // 固定宽度，高度按比例自适应
                            const scale = fixedWidth / res.width;
                            const drawWidth = fixedWidth;
                            const drawHeight = res.height * scale;
                            
                            ctx.drawImage(res.path, x, y, drawWidth, drawHeight);
                            resolve(); // 绘制指令已发出，Promise 完成
                        } catch (e) {
                            console.error('【Canvas】drawImage 异常:', e);
                            reject(e);
                        }
                    },
                    fail: (err) => {
                        console.error(`【Canvas】图片下载失败: ${url}`, err);
                        // 如果是XMLHttpRequest相关的错误，尝试使用备用方案
                        if (err && err.errMsg && err.errMsg.includes('responseText')) {
                            // 在H5环境下，可以尝试直接使用图片URL
                            try {
                                ctx.drawImage(url, x, y, fixedWidth, fixedWidth);
                                resolve();
                            } catch (e) {
                                console.error('【Canvas】备用方案也失败:', e);
                                reject(err);
                            }
                        } else {
                            reject(err); // 下载失败
                        }
                    }
                });
            });
        },



        /**
         * 精确计算文字在Canvas中的实际渲染行数
         * @param {Object} ctx - Canvas上下文
         * @param {string} text - 要计算的文本
         * @param {number} maxWidth - 最大宽度
         * @param {number} fontSize - 字体大小
         * @returns {number} 实际需要的行数
         */
        calculateActualLines: function(ctx, text, maxWidth, fontSize) {
            // 设置字体
            ctx.font = fontSize + 'px Huiwen-mincho, sans-serif';

            const lines = text.split('\n');
            let actualLineCount = 0;

            lines.forEach(line => {
                if (!line.trim()) {
                    actualLineCount += 0.5; // 空行占一半高度
                    return;
                }

                // 测量文字宽度
                const textWidth = ctx.measureText ? ctx.measureText(line).width : line.length * fontSize * 0.6;

                // 计算需要多少行
                if (textWidth <= maxWidth) {
                    actualLineCount += 1;
                } else {
                    // 长文本需要换行，精确计算需要的行数
                    const estimatedLines = Math.ceil(textWidth / maxWidth);
                    actualLineCount += estimatedLines;
                }
            });

            return actualLineCount;
        },

        /**
         * 智能处理文字换行，将长文本按宽度分割成适合的行
         * 应用中文排版优化，避免单字换行
         * @param {Object} ctx - Canvas上下文
         * @param {string} text - 原始文本
         * @param {number} maxWidth - 最大宽度
         * @param {number} fontSize - 字体大小
         * @returns {Array} 处理后的行数组
         */
        wrapTextForCanvas: function(ctx, text, maxWidth, fontSize) {
            ctx.font = fontSize + 'px Huiwen-mincho, sans-serif';

            // 先应用中文排版优化
            const optimizedText = this.preventShortLineBreakForCanvas(text);
            const originalLines = optimizedText.split('\n');
            const wrappedLines = [];

            originalLines.forEach(line => {
                if (!line.trim()) {
                    // 保留空行
                    wrappedLines.push('');
                    return;
                }

                // 测量当前行宽度
                const textWidth = ctx.measureText ? ctx.measureText(line).width : line.length * fontSize * 0.6;

                if (textWidth <= maxWidth) {
                    // 不需要换行
                    wrappedLines.push(line);
                } else {
                    // 需要换行，使用智能分割策略
                    const smartLines = this.smartWrapLine(ctx, line, maxWidth, fontSize);
                    wrappedLines.push(...smartLines);
                }
            });

            return wrappedLines;
        },

        /**
         * 为Canvas文字渲染优化的短行换行预防函数
         * @param {string} text - 原始文本
         * @returns {string} - 处理后的文本
         */
        preventShortLineBreakForCanvas: function(text) {
            if (!text || typeof text !== 'string') return text;
            
            // 使用正则表达式匹配 "1个或2个字符" + "一个标点符号" 的组合
            const regex = /(.{1,2})([，。；：！？、])/g;
            
            // 在匹配到的字符和标点之间，插入一个零宽度的"单词连接符" (\u2060)
            return text.replace(regex, '$1\u2060$2');
        },

        /**
         * 智能分割单行文字，避免单字换行
         * @param {Object} ctx - Canvas上下文
         * @param {string} line - 要分割的行
         * @param {number} maxWidth - 最大宽度
         * @param {number} fontSize - 字体大小
         * @returns {Array} 分割后的行数组
         */
        smartWrapLine: function(ctx, line, maxWidth, fontSize) {
            const lines = [];
            let currentLine = '';
            
            // 按标点符号分割，优先在标点后换行
            const segments = line.split(/([，。；：！？、])/);
            
            for (let i = 0; i < segments.length; i++) {
                const segment = segments[i];
                if (!segment) continue;
                
                const testLine = currentLine + segment;
                const testWidth = ctx.measureText ? ctx.measureText(testLine).width : testLine.length * fontSize * 0.6;
                
                if (testWidth <= maxWidth) {
                    currentLine = testLine;
                } else {
                    // 当前行已满，需要换行
                    if (currentLine) {
                        lines.push(currentLine);
                    }
                    
                    // 如果单个标点符号，直接添加到当前行
                    if (/^[，。；：！？、]$/.test(segment)) {
                        currentLine = segment;
                    } else {
                        // 如果是内容段，需要进一步分割
                        const subLines = this.splitLongSegment(ctx, segment, maxWidth, fontSize);
                        if (subLines.length > 0) {
                            lines.push(...subLines.slice(0, -1)); // 除了最后一行
                            currentLine = subLines[subLines.length - 1]; // 最后一行作为当前行
                        } else {
                            currentLine = segment;
                        }
                    }
                }
            }
            
            // 添加最后一行
            if (currentLine) {
                lines.push(currentLine);
            }
            
            return lines;
        },

        /**
         * 分割过长的内容段
         * @param {Object} ctx - Canvas上下文
         * @param {string} segment - 要分割的内容段
         * @param {number} maxWidth - 最大宽度
         * @param {number} fontSize - 字体大小
         * @returns {Array} 分割后的行数组
         */
        splitLongSegment: function(ctx, segment, maxWidth, fontSize) {
            const lines = [];
            let currentLine = '';
            
            for (let i = 0; i < segment.length; i++) {
                const testLine = currentLine + segment[i];
                const testWidth = ctx.measureText ? ctx.measureText(testLine).width : testLine.length * fontSize * 0.6;
                
                if (testWidth <= maxWidth) {
                    currentLine = testLine;
                } else {
                    // 当前行已满，开始新行
                    if (currentLine) {
                        lines.push(currentLine);
                    }
                    currentLine = segment[i];
                }
            }
            
            // 添加最后一行
            if (currentLine) {
                lines.push(currentLine);
            }
            
            return lines;
        },

        drawCanvas: async function () {
            try {
                
                // 签名URL已从云函数返回，直接使用post.authorSignature（匿名帖子或非原创诗歌不显示签名）
                const shouldShowSignature = (!!this.post && !this.post.isAnonymous && !(this.post.isPoem && this.post.isOriginal === false));
                
                // 使用canvas生成图片
                const ctx = uni.createCanvasContext('shareCanvas', this);
                
                if (!ctx) {
                    console.error('【post-detail】Canvas上下文创建失败');
                    uni.showToast({
                        title: 'Canvas创建失败',
                        icon: 'none'
                    });
                    return;
                }
                
                
                // 计算内容尺寸 - 模拟poem-square的样式
                const content = this.post.content || '';
                const lines = content.split('\n');
                
                // 字体设置 - 完全按照poem-square的样式
                const fontSize = 38; // 进一步增大字号到38px
                const lineHeight = 48; // 相应调整行高
                const fontFamily = 'Huiwen-mincho, sans-serif';
                
                // 设置字体 - 使用加载的自定义字体
                ctx.font = fontSize + 'px Huiwen-mincho, sans-serif';

                // 计算文字区域尺寸
                const textPadding = 80; // 增大左右padding
                const textTopPadding = 80; // 增大上padding
                const textBottomPadding = 60; // 进一步增大下padding

                // 标题字体设置
                const titleFontSize = 46; // 标题字号比正文大
                const titleLineHeight = 56; // 相应调整标题行高
                const titleBottomSpacing = 32; // 标题与正文的间距

                // 计算画布尺寸 - 固定宽度，高度自适应
                // 使用与poem-square页面一致的尺寸比例
                const canvasWidth = 750; // 增大卡片宽度到750px
                const textAreaWidth = canvasWidth - 160; // 减去左右padding (80*2)

                // 【新增】使用精确的文字测量函数计算实际行数
                const actualLines = this.calculateActualLines(ctx, content, textAreaWidth, fontSize);

                // 【新增】使用智能换行函数处理长文本
                const processedLines = this.wrapTextForCanvas(ctx, content, textAreaWidth, fontSize);
                const wrappedContentHeight = processedLines.reduce((h, line) => h + (line && line.trim() ? lineHeight : lineHeight * 0.5), 0);

                // 更准确的内容高度计算 - 基于实际测量
                const contentHeight = Math.max(wrappedContentHeight, 200); // 使用 wrap 后的精确高度，最小 200px
                
                // 【修复】计算标题的实际高度（支持多行标题）
                let actualTitleHeight = titleLineHeight + 20; // 默认单行标题高度
                if (this.post.title) {
                    const titleLines = this.wrapTextForCanvas(ctx, this.post.title, textAreaWidth, titleFontSize);
                    const titleLinesCount = titleLines.filter(line => line.trim()).length;
                    if (titleLinesCount > 1) {
                        actualTitleHeight = titleLinesCount * titleLineHeight + 20; // 多行标题高度
                    }
                }
                const titleHeight = actualTitleHeight;
                
                // 计算基础高度
                const baseHeight = textTopPadding + titleHeight + titleBottomSpacing + contentHeight + textBottomPadding;
                
                // 为签名预留足够空间
                // 动态签名参数：放在正文下方，并按固定宽度等比缩放高度
                const signatureTopGap = 40;
                const fixedSignatureWidth = 120;
                const signatureTextFontSize = 28; // 无签名图片时用文字署名字号
                let signatureDrawHeight = 0;
                if (this.post.authorSignature && shouldShowSignature) {
                    try {
                        const __sigInfo = await new Promise((resolve)=>{
                            uni.getImageInfo({ src: this.post.authorSignature, success: (res)=>resolve(res), fail: ()=>resolve(null) });
                        });
                        if (__sigInfo && __sigInfo.width > 0) {
                            const __scale = fixedSignatureWidth / __sigInfo.width;
                            signatureDrawHeight = Math.max(1, Math.round(__sigInfo.height * __scale));
                        }
                    } catch(_) {}
                }

                // 【优化】动态调整Canvas高度，确保有足够空间
                // 非原创诗歌需要为转载作者名字预留空间
                const isNonOriginalPoem = this.post.isPoem && this.post.isOriginal === false && this.post.author;
                const needsAuthorSpace = shouldShowSignature || isNonOriginalPoem;
                
                let finalCanvasHeight = textTopPadding + titleHeight + titleBottomSpacing + contentHeight
                    + (this.post.authorSignature && shouldShowSignature
                        ? (signatureTopGap + signatureDrawHeight)
                        : (needsAuthorSpace && ((this.post.authorName && this.post.authorName.trim()) || (this.post.author && this.post.author.trim())))
                            ? (signatureTopGap + signatureTextFontSize)
                            : 0)
                    + textBottomPadding + 10;

                // 【优化】更智能的高度调整策略
                if (false && actualLines > 8) {
                    // 超过8行就增加缓冲，避免计算误差
                    const extraHeight = (actualLines - 8) * lineHeight * 1.2; // 1.2倍缓冲
                    finalCanvasHeight += extraHeight;
                }

                // 【优化】增加额外的安全边距，确保底部有足够空间
                const safetyMargin = 0;
                finalCanvasHeight += safetyMargin;
                
                const canvasHeight = Math.ceil(finalCanvasHeight);
                try { this.setData && this.setData({ shareCanvasHeight: canvasHeight }); } catch(_) { this.shareCanvasHeight = canvasHeight; }
                if (this.$nextTick) { await new Promise(r => this.$nextTick(r)); }
                
                
                // 绘制圆角背景 - 模拟poem-square的卡片样式
                const bgColor = this.post.backgroundColor || '#FFFFFF';
                
                // 绘制圆角背景 - 模拟poem-square的卡片样式
                ctx.setFillStyle(bgColor);
                this.drawRoundedRect(ctx, 0, 0, canvasWidth, canvasHeight, 15);
                ctx.fill();
                
                // 绘制文字内容
                const textColor = this.post.textColor || '#000000';
                ctx.setFillStyle(textColor);
                ctx.setTextAlign('left');
                
                // 绘制标题
                const title = this.post.title || '';
                if (title) {
                    // 设置标题字体
                    ctx.font = titleFontSize + 'px Huiwen-mincho, sans-serif';
                    ctx.setFillStyle(textColor);
                    ctx.setTextAlign('left');
                    
                    // 【修复】对标题也应用换行处理，避免标题过长溢出
                    const titleLines = this.wrapTextForCanvas(ctx, title, textAreaWidth, titleFontSize);
                    
                    // 绘制标题（支持多行）
                    let titleY = textTopPadding + titleFontSize;
                    const titleX = textPadding;
                    
                    titleLines.forEach((line, index) => {
                        if (line.trim()) {
                            ctx.fillText(line, titleX, titleY);
                            titleY += titleLineHeight;
                        } else {
                            titleY += titleLineHeight * 0.5; // 空行间距
                        }
                    });
                    
                    // 恢复正文字体
                    ctx.font = fontSize + 'px Huiwen-mincho, sans-serif';
                }
                
                // 【修改】使用处理后的行数组进行绘制，确保长文本正确换行
                let y = textTopPadding + titleHeight + titleBottomSpacing + fontSize; // 标题下方开始绘制正文，增加间距
                const x = textPadding;

                // 【优化】更保守的边界检查，为签名和底部留出充足空间
                const maxY = Number.POSITIVE_INFINITY; // 不再限制正文绘制高度，由最终导出高度裁切

                processedLines.forEach((line, index) => {
                    if (line.trim()) {
                        // 检查是否超出边界
                        if (y > maxY) {
                            return;
                        }

                        ctx.fillText(line, x, y);
                        y += lineHeight;
                    } else {
                        y += lineHeight * 0.5; // 空行间距
                    }
                });
                
                
                // 绘制签名 - 模拟poem-square的签名位置（匿名或非原创诗歌不绘制签名）
                if (this.post.authorSignature && shouldShowSignature) {
                    // 缩小签名尺寸
                    const fixedSignatureWidth = 120; // 缩小签名宽度到120px
                    const __wmMargin = 36, __wmW = 220, __wmH = 180, __sigPad = 12;
                    const signatureX = canvasWidth - __wmW - __wmMargin + __sigPad; // 调整右边距到60px
                    const signatureY = y + signatureTopGap; // 增大签名下边距，从底部向上160px开始绘制

                    // 让签名位于右下角水印区域内
                    const __wmMargin2 = 24, __wmW2 = 220, __wmH2 = 180, __sigPad2 = 12;
                    const sigX = canvasWidth - __wmW2 - __wmMargin2 + __sigPad2;
                    const sigY = (canvasHeight - __wmH2 - __wmMargin2) + (__wmH2 - signatureDrawHeight - __sigPad2);

                    // 使用 await 等待异步绘制函数完成，固定宽度，高度自适应
                    await this.drawImageAsync(
                        ctx,
                        this.post.authorSignature,
                        sigX,
                        sigY,
                        fixedSignatureWidth
                    );
                }
                else if (shouldShowSignature) { 
                    const authorName = ((this.post.authorName || this.post.author || '') + '').trim();
                    if (authorName) {
                        ctx.setTextAlign('right');
                        ctx.setFillStyle(textColor);
                        ctx.font = signatureTextFontSize + 'px Huiwen-mincho, sans-serif';
                        const __wmMargin3 = 24, __sigInset3 = 24;
                        const sigTextX = canvasWidth - __wmMargin3 - __sigInset3;
                        const sigTextY = canvasHeight - __wmMargin3 - __sigInset3;
                        ctx.fillText(authorName, sigTextX, sigTextY);
                        ctx.setTextAlign('left');
                    }
                }
                // 非原创诗歌需要显示转载作者名字（不是发布者昵称）
                else if (this.post.isPoem && this.post.isOriginal === false && this.post.author) {
                    const originalAuthor = (this.post.author + '').trim();
                    if (originalAuthor) {
                        ctx.setTextAlign('right');
                        ctx.setFillStyle(textColor);
                        ctx.font = signatureTextFontSize + 'px Huiwen-mincho, sans-serif';
                        const __wmMargin3 = 24, __sigInset3 = 24;
                        const sigTextX = canvasWidth - __wmMargin3 - __sigInset3;
                        const sigTextY = canvasHeight - __wmMargin3 - __sigInset3;
                        ctx.fillText(originalAuthor, sigTextX, sigTextY);
                        ctx.setTextAlign('left');
                    }
                }
                
                console.log('【post-detail】开始执行draw');
                // 右下角水印（细线阶梯形）
                try { this.drawCornerWatermark(ctx, canvasWidth, canvasHeight); } catch (e) { console.warn('draw watermark failed', e); }


                ctx.draw(false, () => {
                    console.log('【post-detail】Canvas绘制完成，开始导出图片');
                    
                    // 再次延迟确保绘制完成
                    setTimeout(() => {
                        this.exportCanvas(canvasWidth, canvasHeight);
                    }, 150); // 增加一个微小延迟，应对低性能设备
                });

            } catch (error) {
                console.error('【post-detail】绘制过程中出现严重错误:', error);
                uni.showToast({ title: '图片生成失败，请重试', icon: 'none' });
            }
        },

        // 右下角水印（参考 login 页 Enter 键造型）
                // 右下角水印（参考 login 页 Enter 键造型）
        // 需求：右、下两条边不可见；并在键帽内写小字 poementer
        drawCornerWatermark(ctx, canvasWidth, canvasHeight) {
            const margin = 24; // 更靠近右下角
            const w = 220;     // 水印宽度
            const h = 180;     // 水印高度
            const stepX = 0.55; // 折点（横向比例）
            const stepY = 0.60; // 折点（纵向比例）
            const x0 = canvasWidth - w - margin;
            const y0 = canvasHeight - h - margin;
            const lineWidth = 1.5;                 // 更细的线
            const strokeColor = 'rgba(0,0,0,0.16)'; // 略淡
            const textColor = 'rgba(0,0,0,0.22)';   // 文字稍重一点
            const sx = x0 + w * stepX;
            const sy = y0 + h * stepY;
            // 只画：顶边(左段)+左边(下段)+内横线+内竖线；不画右边和底边
            ctx.save();
            try {
                if (ctx.setLineWidth) ctx.setLineWidth(lineWidth); else ctx.lineWidth = lineWidth;
                if (ctx.setStrokeStyle) ctx.setStrokeStyle(strokeColor); else ctx.strokeStyle = strokeColor;
                // 顶边（从折点到右上）——保持右/下两边不可见
                ctx.beginPath();
                ctx.moveTo(sx, y0);
                ctx.lineTo(x0 + w, y0);
                ctx.stroke();
                // 左边（从折点高度到左下角）
                ctx.beginPath();
                ctx.moveTo(x0, sy);
                ctx.lineTo(x0, y0 + h);
                ctx.stroke();
                // 内横线（折点高度）
                ctx.beginPath();
                ctx.moveTo(x0, sy);
                ctx.lineTo(sx, sy);
                ctx.stroke();
                // 内竖线（折点宽度）
                ctx.beginPath();
                ctx.moveTo(sx, y0);
                ctx.lineTo(sx, sy);
                ctx.stroke();
                // 小字"poementer"
                try {
                    const inset = 12; // 内边距
                    if (ctx.setFillStyle) ctx.setFillStyle(textColor); else ctx.fillStyle = textColor;
                    const fontPx = 18;
                    try { ctx.font = fontPx + 'px Huiwen-mincho, sans-serif'; } catch (_) {}
                    if (ctx.setFontSize) ctx.setFontSize(fontPx);
                    if (ctx.setTextAlign) ctx.setTextAlign('left'); else ctx.textAlign = 'left';
                    const textX = x0 + inset;
                    const textY = y0 + h - inset;
                    ctx.fillText('poementer', textX, textY);
                } catch (_) {}
            } finally { ctx.restore(); }
        },

        // 独立的导出函数
        exportCanvas: function(canvasWidth, canvasHeight) {
            console.log('【Canvas】开始导出Canvas，尺寸:', { canvasWidth, canvasHeight });
            
            uni.canvasToTempFilePath({
                canvasId: 'shareCanvas',
                x: 0,
                y: 0,
                width: canvasWidth,
                height: canvasHeight,
                destWidth: canvasWidth * 2, // 提高分辨率
                destHeight: canvasHeight * 2, // 提高分辨率
                success: (res) => {
                    console.log('【Canvas】图片生成成功:', res.tempFilePath);
                    console.log('【Canvas】导出参数:', {
                        canvasWidth,
                        canvasHeight,
                        destWidth: canvasWidth * 2,
                        destHeight: canvasHeight * 2
                    });
                    
                    // 确保隐藏loading
                    uni.hideLoading();
                    console.log('【Canvas】Loading已隐藏');
                    
                    // 直接显示图片，不保存
                    const generateImageUrl = function(){
                        try{
                            var raw=(res && (res.tempFilePath||res.apFilePath||res.filePath))||'';
                            var b=Date.now();
                            // 确保URL格式正确，避免base64 URI问题
                            if (raw && raw.startsWith('data:')) {
                                            // 如果是base64 URI，直接返回
                                            return raw;
                                        } else {
                                            // 如果是文件路径，添加时间戳防止缓存
                                            return (raw? raw+((raw.indexOf('?')>-1?'&':'?')+'_'+b) : raw);
                                        }
                                    }catch(e){
                                        return res.tempFilePath;
                                    }
                                };

                                const imageUrl = generateImageUrl();
                                
                                // 如果是base64 URI，根据平台使用不同的处理方式
                                if (imageUrl && imageUrl.startsWith('data:')) {
                                    console.log('【post-detail】检测到base64 URI，使用跨平台处理');
                                    
                                    // #ifdef H5
                                    // H5平台：直接使用base64 Data URI
                                    console.log('【post-detail】H5平台直接使用base64 URI');
                                    this.setData({
                                        shareImageUrl: imageUrl
                                    });
                                    // #endif
                                    
                                    // #ifndef H5
                                    // 非H5平台：使用uni.base64ToTempFilePath()转换
                                    console.log('【post-detail】非H5平台使用uni.base64ToTempFilePath()转换');
                                    uni.base64ToTempFilePath({
                                        base64Data: imageUrl,
                                        success: (res) => {
                                            console.log('【post-detail】base64转换成功，临时文件路径:', res.filePath);
                                            this.setData({
                                                shareImageUrl: res.filePath
                                            });
                                        },
                                        fail: (err) => {
                                            console.error('【post-detail】base64转换失败:', err);
                                            // 如果转换失败，直接使用原URL
                                            this.setData({
                                                shareImageUrl: imageUrl
                                            });
                                        }
                                    });
                                    // #endif
                                } else {
                                    // 如果不是base64，直接使用
                                    this.setData({
                                        shareImageUrl: imageUrl
                                    });
                                }
                                
                                // 验证设置是否成功
                                setTimeout(() => {
                                    console.log('【post-detail】当前shareImageUrl:', this.shareImageUrl);
                                }, 100);
                            },
                            fail: (err) => {
                                console.error('【Canvas】生成图片失败:', err);
                                console.error('【Canvas】失败详情:', {
                                    canvasWidth,
                                    canvasHeight,
                                    destWidth: canvasWidth * 2,
                                    destHeight: canvasHeight * 2,
                                    error: err
                                });
                                
                                // 确保隐藏loading
                                uni.hideLoading();
                                console.log('【Canvas】Loading已隐藏 (失败情况)');
                                
                                uni.showToast({ title: '图片导出失败', icon: 'none' });
                            }
                        }, this);
        },

        // 绘制圆角矩形
        drawRoundedRect: function (ctx, x, y, width, height, radius) {
            ctx.beginPath();
            ctx.moveTo(x + radius, y);
            ctx.lineTo(x + width - radius, y);
            ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
            ctx.lineTo(x + width, y + height - radius);
            ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
            ctx.lineTo(x + radius, y + height);
            ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
            ctx.lineTo(x, y + radius);
            ctx.quadraticCurveTo(x, y, x + radius, y);
            ctx.closePath();
        },


        onImageLongPress: function () {
            console.log('【post-detail】用户长按图片');
            // App 端没有系统长按菜单，这里直接触发保存
            // #ifdef APP-PLUS
            this.saveShareImage();
            // #endif
            // #ifndef APP-PLUS
            uni.showToast({ title: '长按可保存', icon: 'none' });
            // #endif
        },

        onShareImageLoad: function () {
            console.log('【post-detail】分享图片加载成功');
            
            // 延迟检查，确保图片完全渲染
            setTimeout(() => {
                this.checkImageDOMState();
            }, 100);
        },
        
        // 检查图片DOM状态
        checkImageDOMState: function () {
            if (this.$refs.shareImage) {
                const img = this.$refs.shareImage;
                
                // 检查DOM元素是否有效
                if (!img || typeof img !== 'object') {
                    this.refreshCommentListIfNeeded();
                }
                
                console.log('【post-detail】图片DOM状态检查:', {
                    src: img.src ? img.src.substring(0, 50) + '...' : 'N/A',
                    width: img.width,
                    height: img.height,
                    offsetWidth: img.offsetWidth,
                    offsetHeight: img.offsetHeight,
                    style: img.style.cssText,
                    complete: img.complete,
                    naturalWidth: img.naturalWidth,
                    naturalHeight: img.naturalHeight
                });
                
                // 如果尺寸都是undefined，尝试多种解决方案
                if (!img.offsetWidth || !img.offsetHeight) {
                    console.log('【post-detail】检测到图片尺寸为undefined，尝试多种解决方案');
                    
                    // 方案1：通过CSS类强制设置图片样式，避免直接修改DOM
                    if (img.classList && typeof img.classList.add === 'function') {
                        img.classList.add('force-image-display');
                        console.log('【post-detail】添加force-image-display类');
                    } else {
                        // 如果classList不可用，安全地设置样式
                        console.log('【post-detail】classList不可用，安全设置样式');
                        try {
                            if (img.style) {
                                img.style.width = '100%';
                                img.style.height = 'auto';
                                img.style.minHeight = '200px';
                                img.style.maxHeight = '80vh';
                                img.style.display = 'block';
                                img.style.visibility = 'visible';
                                img.style.opacity = '1';
                                img.style.backgroundColor = '#f0f0f0';
                                img.style.border = '2px solid #007aff';
                                console.log('【post-detail】样式设置成功');
                            } else {
                                console.log('【post-detail】img.style不可用，跳过样式设置');
                            }
                        } catch (error) {
                            console.error('【post-detail】设置样式时出错:', error);
                        }
                    }
                    
                    // 方案2：检查base64数据是否有效
                    if (img.src && img.src.startsWith('data:image/')) {
                        console.log('【post-detail】base64数据长度:', img.src.length);
                        console.log('【post-detail】base64数据前缀:', img.src.substring(0, 100));
                        
                        // 方案3：不直接修改img.src，而是通过Vue的响应式系统
                        console.log('【post-detail】检测到base64数据，准备重新设置shareImageUrl');
                        const originalSrc = this.shareImageUrl;
                        this.setData({
                            shareImageUrl: ''
                        });
                        setTimeout(() => {
                            this.setData({
                                shareImageUrl: originalSrc
                            });
                            console.log('【post-detail】通过Vue重新设置shareImageUrl后检查尺寸');
                        }, 100);
                    }
                    
                    // 方案4：如果还是不行，尝试使用临时文件路径
                    setTimeout(() => {
                        if (!img.offsetWidth || !img.offsetHeight) {
                            console.log('【post-detail】强制设置后尺寸仍为undefined，尝试转换为临时文件');
                            this.tryConvertToTempFile();
                        }
                    }, 200);
                }
                
                // 兼容性检查：只在支持closest方法的环境中使用
                try {
                    if (typeof img.closest === 'function') {
                        const modal = img.closest('.share-modal');
                        const overlay = img.closest('.share-modal-overlay');
                        
                        console.log('【post-detail】容器尺寸检查:', {
                            modalWidth: modal ? modal.offsetWidth : 'N/A',
                            modalHeight: modal ? modal.offsetHeight : 'N/A',
                            overlayWidth: overlay ? overlay.offsetWidth : 'N/A',
                            overlayHeight: overlay ? overlay.offsetHeight : 'N/A'
                        });
                    } else {
                        console.log('【post-detail】当前环境不支持closest方法，跳过容器尺寸检查');
                    }
                } catch (error) {
                    console.log('【post-detail】容器尺寸检查失败:', error.message);
                }
            }
        },

        // 跨端保存分享图片
        saveShareImage: function () {
            const url = this.shareImageUrl;
            if (!url) {
                uni.showToast({ title: '图片生成中…', icon: 'none' });
                return;
            }

            const toastOK = (msg) => uni.showToast({ title: msg || '已保存', icon: 'success' });
            const toastFail = (msg) => uni.showToast({ title: msg || '保存失败', icon: 'none' });

            // 权限引导（小程序/APP）
            const handlePermissionFail = () => {
                uni.showModal({
                    title: '需要相册权限',
                    content: '请在设置中开启保存到相册权限后重试。',
                    confirmText: '去设置',
                    success: (r) => {
                        if (r.confirm && uni.openSetting) {
                            uni.openSetting({});
                        }
                    }
                });
            };

            // 真正执行保存（小程序/APP）
            const saveFromPath = (filePath) => {
                // #ifdef MP-WEIXIN || APP-PLUS
                uni.saveImageToPhotosAlbum({
                    filePath,
                    success: () => toastOK('已保存到相册'),
                    fail: (err) => {
                        console.error('saveImageToPhotosAlbum 失败:', err);
                        const msg = (err && err.errMsg) || '';
                        if (/auth|authorize|denied|permission/i.test(msg)) {
                            handlePermissionFail();
                        } else {
                            toastFail('保存失败');
                        }
                    }
                });
                // #endif
            };

            // H5：下载到本地
            const saveOnH5 = (finalUrl) => {
                // #ifdef H5
                try {
                    if (finalUrl.startsWith('data:')) {
                        // dataURL → blob → a[download]
                        const arr = finalUrl.split(',');
                        const mime = arr[0].match(/:(.*?);/)[1] || 'image/png';
                        const bstr = atob(arr[1]);
                        let n = bstr.length;
                        const u8arr = new Uint8Array(n);
                        while (n--) u8arr[n] = bstr.charCodeAt(n);
                        const blob = new Blob([u8arr], { type: mime });
                        const urlObj = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = urlObj;
                        a.download = 'poementer.png';
                        document.body.appendChild(a);
                        a.click();
                        document.body.removeChild(a);
                        URL.revokeObjectURL(urlObj);
                        toastOK('已开始下载');
                    } else {
                        const a = document.createElement('a');
                        a.href = finalUrl;
                        a.download = 'poementer.png';
                        document.body.appendChild(a);
                        a.click();
                        document.body.removeChild(a);
                        toastOK('已开始下载');
                    }
                } catch (e) {
                    console.error('H5 保存失败，尝试打开新窗口:', e);
                    window.open(finalUrl, '_blank');
                }
                // #endif
            };

            // 统一入口：根据 URL 形态分支
            if (url.startsWith('data:')) {
                // base64 → 临时文件
                // #ifdef MP-WEIXIN || APP-PLUS
                uni.base64ToTempFilePath({
                    base64Data: url,
                    success: (res) => saveFromPath(res.filePath),
                    fail: (err) => {
                        console.error('base64ToTempFilePath 失败:', err);
                        toastFail('图片转换失败');
                    }
                });
                // #endif
                // #ifdef H5
                saveOnH5(url);
                // #endif
            } else if (/^https?:\/\//i.test(url)) {
                // 远程 URL 先下载
                // #ifdef MP-WEIXIN || APP-PLUS
                uni.downloadFile({
                    url,
                    success: (res) => {
                        if (res.statusCode === 200) {
                            saveFromPath(res.tempFilePath || res.filePath);
                        } else {
                            console.error('downloadFile 非200:', res.statusCode);
                            toastFail('下载失败');
                        }
                    },
                    fail: (err) => {
                        console.error('downloadFile 失败:', err);
                        toastFail('下载失败');
                    }
                });
                // #endif
                // #ifdef H5
                saveOnH5(url);
                // #endif
            } else {
                // 认为是本地临时路径
                // #ifdef MP-WEIXIN || APP-PLUS
                saveFromPath(url);
                // #endif
                // #ifdef H5
                saveOnH5(url);
                // #endif
            }
        },

        onShareImageError: function (e) {
            console.error('【post-detail】分享图片加载失败:', e);
            console.log('【post-detail】当前shareImageUrl:', this.shareImageUrl);
            console.log('【post-detail】图片URL类型:', typeof this.shareImageUrl);
            console.log('【post-detail】图片URL长度:', this.shareImageUrl ? this.shareImageUrl.length : 0);
            
            // 如果是base64 URI，检查格式
            if (this.shareImageUrl && this.shareImageUrl.startsWith('data:')) {
                console.log('【post-detail】检测到base64 URI，检查格式...');
                const isValidBase64 = this.shareImageUrl.match(/^data:image\/[a-zA-Z]*;base64,/);
                if (!isValidBase64) {
                    console.error('【post-detail】base64 URI格式无效');
                } else {
                    console.log('【post-detail】base64 URI格式正确');
                }
            }
            
            // 检查是否可以重试
            if (this.shareImageRetryCount < 2) {
                console.log('【post-detail】尝试重新生成图片，重试次数:', this.shareImageRetryCount + 1);
                this.setData({
                    shareImageRetryCount: this.shareImageRetryCount + 1
                });
                
                // 延迟重试
                setTimeout(() => {
                    this.generateShareImage();
                }, 1000);
            } else {
                // 如果重试失败，尝试使用不同的显示方式
                console.log('【post-detail】重试失败，尝试使用备用方案');
                this.tryAlternativeDisplay();
            }
        },

        // 备用显示方案
        tryAlternativeDisplay: function () {
            console.log('【post-detail】尝试备用显示方案');
            
            // 如果当前是base64 URI，根据平台使用不同的处理方式
            if (this.shareImageUrl && this.shareImageUrl.startsWith('data:')) {
                console.log('【post-detail】检测到base64 URI，使用跨平台备用方案');
                
                // #ifdef H5
                // H5平台：直接使用base64 URI
                console.log('【post-detail】H5备用方案：直接使用base64 URI');
                // 在H5平台，base64 URI应该能直接显示，如果还是失败，说明有其他问题
                uni.showToast({
                    title: '图片显示失败，请重试',
                    icon: 'none'
                });
                // #endif
                
                // #ifndef H5
                // 非H5平台：使用uni.base64ToTempFilePath()转换
                console.log('【post-detail】非H5备用方案：使用uni.base64ToTempFilePath()转换');
                uni.base64ToTempFilePath({
                    base64Data: this.shareImageUrl,
                    success: (res) => {
                        console.log('【post-detail】备用方案base64转换成功:', res.filePath);
                        this.setData({
                            shareImageUrl: res.filePath
                        });
                    },
                    fail: (err) => {
                        console.error('【post-detail】备用方案base64转换失败:', err);
                        uni.showToast({
                            title: '图片显示失败，请重试',
                            icon: 'none'
                        });
                    }
                });
                // #endif
            } else {
                // 如果不是base64，显示错误信息
                uni.showToast({
                    title: '图片显示失败，请重试',
                    icon: 'none'
                });
            }
        },

        // 尝试将base64转换为临时文件
        tryConvertToTempFile: function () {
            if (this.shareImageUrl && this.shareImageUrl.startsWith('data:')) {
                console.log('【post-detail】尝试将base64转换为临时文件');
                
                // #ifndef H5
                // 非H5平台：使用uni.base64ToTempFilePath()转换
                uni.base64ToTempFilePath({
                    base64Data: this.shareImageUrl,
                    success: (res) => {
                        console.log('【post-detail】base64转临时文件成功:', res.filePath);
                        this.setData({
                            shareImageUrl: res.filePath
                        });
                    },
                    fail: (err) => {
                        console.error('【post-detail】base64转临时文件失败:', err);
                        // 如果转换失败，显示错误信息
                        uni.showToast({
                            title: '图片显示失败，请重试',
                            icon: 'none'
                        });
                    }
                });
                // #endif
                
                // #ifdef H5
                // H5平台：尝试使用blob URL
                try {
                    const base64Data = this.shareImageUrl.split(',')[1];
                    const binaryString = atob(base64Data);
                    const bytes = new Uint8Array(binaryString.length);
                    for (let i = 0; i < binaryString.length; i++) {
                        bytes[i] = binaryString.charCodeAt(i);
                    }
                    const blob = new Blob([bytes], { type: 'image/png' });
                    const blobUrl = URL.createObjectURL(blob);
                    
                    console.log('【post-detail】H5环境blob URL生成成功:', blobUrl);
                    this.setData({
                        shareImageUrl: blobUrl
                    });
                } catch (error) {
                    console.error('【post-detail】H5环境blob URL生成失败:', error);
                    uni.showToast({
                        title: '图片显示失败，请重试',
                        icon: 'none'
                    });
                }
                // #endif
            }
        },

        onPortfolioSuccess: function () {
            this.hidePortfolioModal();
            uni.showToast({
                title: '添加成功',
                icon: 'success'
            });
        },

        onCreateDiscussion: function () {
            if (!this.post || !this.post._id) {
                uni.showToast({
                    title: '帖子信息无效',
                    icon: 'none'
                });
                return;
            }

            console.log('【post-detail】跳转到创建讨论页面，postId:', this.post._id);
            uni.navigateTo({
                url: `/pages/create-discussion/create-discussion?postId=${this.post._id}`,
                success: () => {
                    console.log('【post-detail】跳转到创建讨论页面成功');
                },
                fail: (err) => {
                    console.error('【post-detail】跳转到创建讨论页面失败:', err);
                    uni.showToast({
                        title: '跳转失败',
                        icon: 'none'
                    });
                }
            });
        },

        handlePreview: function (event) {
            const result = previewImage(event, { fallbackToast: false });
            if (!result) {
                uni.showToast({
                    title: '图片加载失败',
                    icon: 'none'
                });
            }
            return result;
        },


        onAvatarError: function (e) {
            console.error('头像加载失败', e);
        },

        updateSubmitState: function () {
                const hasText = (this.newComment || '').trim().length > 0;
                const hasImages = Array.isArray(this.commentImages) && this.commentImages.length > 0;
                const disabled = (!hasText && !hasImages) || this.isSubmittingComment;
                if (this.isSubmitDisabled !== disabled) {
                    this.setData({
                        isSubmitDisabled: disabled
                    });
            }
        },






        onCommentInput: function (e) {
            this.setData(
                {
                    newComment: e.detail.value
                },
                () => {
                    this.updateSubmitState();
                }
            );
        },


        chooseImages: function () {
            const existingImages = this.commentImages ? this.commentImages.length : 0;
            const maxImages = this.maxCommentImages;
            const remaining = maxImages - existingImages;

            if (remaining <= 0) {
                uni.showToast({
                    title: '最多选择3张图片',
                    icon: 'none'
                });
                return;
            }

            // 确保输入框保持展开状态
            if (!this.isInputExpanded) {
                this.expandInput();
            }

            // 在APP端先请求读取存储权限
            const startChoose = () => {
                uni.chooseImage({
                count: remaining,
                sizeType: ['compressed'],
                sourceType: ['album', 'camera'],
                success: (res) => {
                    const tempFiles =
                        res.tempFiles ||
                        (res.tempFilePaths || []).map((path) => ({
                            tempFilePath: path,
                            size: 0
                        }));

                    const tasks = tempFiles.map((file) => this.prepareCommentImage(file));

                    Promise.all(tasks)
                        .then((processedImages) => {
                            const validImages = processedImages.filter((item) => !!item);
                            if (validImages.length === 0) {
                                return;
                            }

                                const updatedImages = (this.commentImages || []).concat(validImages);
                                this.setData(
                                    {
                                        commentImages: updatedImages.slice(0, this.maxCommentImages)
                                    },
                                    () => {
                                        this.updateSubmitState();
                                        this.setData({
                                            isInputExpanded: true,
                                            isFocus: false
                                        });
                                    }
                                );
                        })
                        .catch((err) => {
                            console.error('评论图片处理失败:', err);
                            uni.showToast({
                                title: '图片处理失败',
                                icon: 'none'
                            });
                        });
                },
                fail: (err) => {
                    if (err && err.errMsg && err.errMsg.indexOf('cancel') === -1) {
                        console.error('选择图片失败:', err);
                        uni.showToast({
                            title: '无法选择图片',
                            icon: 'none'
                        });
                    }
                }
            });
            };

            try {
                const { getCurrentPlatform } = require('../../utils/platformDetector.js');
                const platform = getCurrentPlatform();
                if (platform === 'app') {
                    const { requestAndroidStoragePermission } = require('../../utils/permissions.js');
                    requestAndroidStoragePermission().then((granted) => {
                        if (granted) {
                            startChoose();
                        }
                    });
                    return;
                }
            } catch (e) {}

            startChoose();
        },

        chooseCommentImages: function () {
            this.chooseImages();
        },

        prepareCommentImage: function (file) {
            return new Promise((resolve) => {
                const tempPath = file.tempFilePath || file.path || (Array.isArray(file.tempFilePaths) ? file.tempFilePaths[0] : '');
                if (!tempPath) {
                    resolve(null);
                    return;
                }
                const sizeInBytes = file.size || 0;
                // 跳过压缩，直接使用原图
                const imageInfo = {
                    id: 'comment_' + Date.now() + '_' + Math.floor(Math.random() * 100000),
                    originalPath: tempPath,
                    previewUrl: tempPath,
                    compressedPath: tempPath,
                    size: sizeInBytes,
                    needCompression: false
                };
                resolve(imageInfo);
            });
        },

        compressCommentImage: function (imageInfo) {
            return new Promise((resolve) => {
                // 使用更激进的压缩参数，确保文件大小不超过200KB
                const compressWithQuality = (quality) => {
                    uni.compressImage({
                        src: imageInfo.originalPath,
                        quality: quality,
                        success: (res) => {
                            // 检查压缩后的文件大小
                            uni.getFileInfo({
                                filePath: res.tempFilePath,
                                success: (fileInfo) => {
                                    const compressedSize = fileInfo.size;
                                    console.log(`压缩质量${quality}%，文件大小: ${(compressedSize / 1024).toFixed(2)}KB`);

                                    // 如果文件大小超过200KB且质量还可以继续降低，则继续压缩
                                    if (compressedSize > 204800 && quality > 30) {
                                        console.log(`文件大小${(compressedSize / 1024).toFixed(2)}KB超过200KB，继续压缩...`);
                                        compressWithQuality(quality - 10);
                                    } else {
                                        imageInfo.compressedPath = res.tempFilePath;
                                        imageInfo.previewUrl = res.tempFilePath;
                                        imageInfo.compressedSize = compressedSize;
                                        console.log(`最终压缩质量${quality}%，文件大小: ${(compressedSize / 1024).toFixed(2)}KB`);
                                        resolve(imageInfo);
                                    }
                                },
                                fail: () => {
                                    // 如果无法获取文件信息，直接使用压缩结果
                                    imageInfo.compressedPath = res.tempFilePath;
                                    imageInfo.previewUrl = res.tempFilePath;
                                    resolve(imageInfo);
                                }
                            });
                        },
                        fail: (err) => {
                            console.warn(`压缩质量${quality}%失败:`, err);
                            if (quality > 30) {
                                // 如果压缩失败且质量还可以降低，尝试更低的质量
                                compressWithQuality(quality - 10);
                            } else {
                                // 如果所有压缩都失败，使用原图
                                imageInfo.compressedPath = imageInfo.originalPath;
                                imageInfo.previewUrl = imageInfo.originalPath;
                                imageInfo.needCompression = false;
                                resolve(imageInfo);
                            }
                        }
                    });
                };

                // 从60%质量开始压缩，逐步降低直到文件大小符合要求
                compressWithQuality(60);
            });
        },


        removeCommentImage: function (e) {
            const index = e.currentTarget.dataset.index;
            if (index === undefined) {
                return;
            }
            const images = (this.commentImages || []).slice();
            images.splice(index, 1);
            this.setData(
                {
                    commentImages: images
                },
                () => {
                    this.updateSubmitState();
                }
            );
        },

        previewSelectedCommentImage: function (e) {
            const index = e.currentTarget.dataset.index || 0;
            const images = this.commentImages || [];
            if (!images.length) {
                return;
            }
            const urls = images.map((item) => item.previewUrl).filter(Boolean);
            if (!urls.length) {
                return;
            }
            const current = urls[index] || urls[0];
            return previewImage({ current, urls }, { fallbackToast: false });
        },

        uploadCommentImages: function () {
            const images = this.commentImages || [];
            
            if (!images.length) {
                return Promise.resolve([]);
            }
            const openid = this.getCurrentUserId() || 'guest';
            const timestamp = Date.now();
            
            // 使用通用的文件上传方法
            return Promise.all(
                images.map((image, index) => {
                    const uniqueKey = (openid || 'guest') + '_' + timestamp + '_' + index;
                    const compressedCloudPath = 'comment_images/' + uniqueKey + '_compressed.jpg';
                    
                    // 使用通用的文件上传方法（uploadFile 返回 fileID 字符串）
                    return uploadFile(compressedCloudPath, image.compressedPath || image.previewUrl || image.originalPath)
                        .then((compressedFileID) => {
                            if (image.needCompression) {
                                const originalCloudPath = 'comment_images/' + uniqueKey + '_original.jpg';
                                return uploadFile(originalCloudPath, image.originalPath)
                                    .then((originalFileID) => {
                                        return {
                                            compressedUrl: compressedFileID,
                                            originalUrl: originalFileID
                                        };
                                    });
                            }
                            return {
                                compressedUrl: compressedFileID,
                                originalUrl: compressedFileID
                            };
                        });
                })
            );
        },

        previewCommentImageFromList: function (e) {
            const commentIndex = Number(e.currentTarget.dataset.commentIndex);
            const replyIndexRaw = e.currentTarget.dataset.replyIndex;
            const replyIndex = typeof replyIndexRaw === 'undefined' ? -1 : Number(replyIndexRaw);
            const imageIndex = Number(e.currentTarget.dataset.imageIndex) || 0;
            const isReplyRaw = e.currentTarget.dataset.isReply;
            const isReply = isReplyRaw === true || isReplyRaw === 'true';
            let images = [];
            if (!Number.isNaN(commentIndex) && commentIndex >= 0) {
                const targetComment = this.comments[commentIndex];
                if (targetComment) {
                    if (isReply && Array.isArray(targetComment.replies) && replyIndex >= 0) {
                        const targetReply = targetComment.replies[replyIndex];
                        if (targetReply) {
                            if (Array.isArray(targetReply.originalImageUrls) && targetReply.originalImageUrls.length > 0) {
                                images = targetReply.originalImageUrls;
                            } else if (Array.isArray(targetReply.imageUrls)) {
                                images = targetReply.imageUrls;
                            }
                        }
                    } else {
                        if (Array.isArray(targetComment.originalImageUrls) && targetComment.originalImageUrls.length > 0) {
                            images = targetComment.originalImageUrls;
                        } else if (Array.isArray(targetComment.imageUrls)) {
                            images = targetComment.imageUrls;
                        }
                    }
                }
            }
            if (!images || !images.length) {
                return;
            }
            const filteredImages = images.filter(Boolean);
            if (!filteredImages.length) {
                return;
            }
            const current = filteredImages[imageIndex] || filteredImages[0];
            return previewImage({ current, urls: filteredImages }, { fallbackToast: false });
        },

        onSubmitComment: async function () {
            if (this.isSubmitDisabled || this.isSubmittingComment) {
                return;
            }
            const trimmedContent = (this.newComment || '').trim();

            // 使用新的验证工具函数
            const validationResult = validateCommentInput(trimmedContent, this.commentImages);
            if (!validationResult.isValid) {
                uni.showToast({
                    title: validationResult.message,
                    icon: 'none'
                });
                return;
            }
            const postId = this.post && this.post._id ? this.post._id : '';
            if (!postId) {
                uni.showToast({
                    title: '帖子信息缺失',
                    icon: 'none'
                });
                return;
            }
            const parentId = this.replyToComment;
            const replyToAuthor = this.replyToAuthor;
            this.setData({
                isSubmittingComment: true
            });
            this.updateSubmitState();
            uni.showLoading({
                title: '提交中...'
            });
            try {
                const imageUploadResults = await this.uploadCommentImages();
                const imageUrls = imageUploadResults.map((item) => item.compressedUrl);
                const originalImageUrls = imageUploadResults.map((item) => item.originalUrl);
                
                const commentData = {
                    postId: postId,
                    content: trimmedContent,
                    images: imageUrls.map((url, index) => ({
                        url: url,
                        originalUrl: originalImageUrls[index],
                        order: index
                    })),
                    parentId: parentId,
                    replyToAuthorName: replyToAuthor,
                    isAnonymous: this.post.isAnonymous || false
                };

                const res = await submitComment(commentData);
                uni.hideLoading();
                if (res.result && res.result.success) {
                    uni.showToast({
                        title: '评论成功'
                    });
                    const newCommentCount = this.commentCount + 1;
                    try { const { emitCommentCountChanged } = require('../../utils/events.js'); emitCommentCountChanged({ postId, commentCount: newCommentCount }); } catch (_) {}
                    this.setData({
                        newComment: '',
                        commentImages: [],
                        commentCount: newCommentCount
                    });
                    this.updateSubmitState();
                    this.collapseInput();
                    this.getComments(postId);
                    const pages = getCurrentPages();
                    if (pages.length > 1) {
                        const prePage = pages[pages.length - 2];
                        if ((prePage.route === 'pages/index/index' || prePage.route === 'pages/profile/profile') && typeof prePage.updatePostCommentCount === 'function') {
                            prePage.updatePostCommentCount(postId, newCommentCount);
                        }
                    }
                } else {
                    uni.showToast({
                        title: (res.result && res.result.message) || '评论失败',
                        icon: 'none'
                    });
                }
            } catch (error) {
                console.log('CatchClause', error);
                console.log('CatchClause', error);
                uni.hideLoading();
                console.error('Failed to add comment with media:', error);
                uni.showToast({
                    title: '评论失败',
                    icon: 'none'
                });
            } finally {
                this.setData({
                    isSubmittingComment: false
                });
                this.updateSubmitState();
            }
        },

        showReplyInput: function (e) {
            console.log('--- showReplyInput function triggered ---');
            console.log('收到的 data- attributes:', e.currentTarget.dataset);
            const commentId = e.currentTarget.dataset.commentId;
            const authorName = e.currentTarget.dataset.authorName;
            const replyId = e.currentTarget.dataset.replyId; // 被回复的二级评论ID（如果存在）
            
            // 如果存在 replyId，说明是回复二级评论；否则是回复一级评论
            this.setData({
                replyToComment: commentId, // 父评论ID，作为 parentId
                replyToAuthor: authorName  // 被回复的用户名，作为 replyToAuthorName
            });
            console.log('设置后的回复状态:', {
                replyToComment: this.replyToComment,
                replyToAuthor: this.replyToAuthor,
                replyId: replyId // 记录被回复的二级评论ID（用于日志）
            });
            this.expandInput();
        },

        cancelReply: function () {
            this.setData({
                replyToComment: null,
                replyToAuthor: ''
            });
            console.log('回复状态已被取消');
        },

        onDeleteComment: function (e) {
            const { commentId, parentId } = e.currentTarget.dataset;
            if (!commentId) {
                return;
            }

            const postId = this.post && this.post._id ? this.post._id : '';
            if (!postId) {
                uni.showToast({
                    title: '帖子信息缺失',
                    icon: 'none'
                });
                return;
            }

            uni.showModal({
                title: '删除评论',
                content: '确定要删除这条评论吗？',
                confirmColor: '#ff4d4f',
                success: (res) => {
                    if (!res.confirm) {
                        return;
                    }
                    uni.showLoading({
                        title: '正在删除',
                        mask: true
                    });
                    deleteComment(commentId, postId, parentId).then((result) => {
                            if (result.result && result.result.success) {
                                const deletedCount = Math.max(1, result.result.deletedCount || 1);
                                let updatedComments;
                                if (parentId) {
                                    updatedComments = this.comments.map((comment) => ({
                                        ...comment,
                                        replies: comment.replies ? comment.replies.slice() : []
                                    }));
                                    const parentIndex = updatedComments.findIndex((comment) => comment._id === parentId);
                                    if (parentIndex !== -1) {
                                        updatedComments[parentIndex].replies = updatedComments[parentIndex].replies.filter((reply) => reply._id !== commentId);
                                    }
                                } else {
                                    updatedComments = this.comments.filter((comment) => comment._id !== commentId);
                                }
                                const newCommentCount = Math.max(0, this.commentCount - deletedCount);
                                try { const { emitCommentCountChanged } = require('../../utils/events.js'); emitCommentCountChanged({ postId: this.post && this.post._id ? this.post._id : '', commentCount: newCommentCount }); } catch (_) {}
                                this.setData({
                                    comments: updatedComments,
                                    commentCount: newCommentCount
                                });
                                const pages = getCurrentPages();
                                if (pages.length > 1) {
                                    const prePage = pages[pages.length - 2];
                                    if (typeof prePage.updatePostCommentCount === 'function') {
                                        prePage.updatePostCommentCount(this.post && this.post._id ? this.post._id : '', newCommentCount);
                                    }
                                }
                                uni.showToast({
                                    title: '已删除',
                                    icon: 'success'
                                });
                            } else {
                                uni.showToast({
                                    title: (result.result && result.result.message) || '删除失败',
                                    icon: 'none'
                                });
                            }
                        }).catch((err) => {
                            console.error('Failed to delete comment', err);
                            uni.showToast({
                                title: '删除失败',
                                icon: 'none'
                            });
                        }).finally(() => {
                            uni.hideLoading();
                        });
                }
            });
        },

        toggleLikeComment: function (e) {
            const { commentId } = e.currentTarget.dataset;
            const postId = this.post && this.post._id ? this.post._id : '';
            const { comment, isReply, commentIndex, replyIndex } = this.findCommentWithIndex(this.comments, commentId);
            if (!comment) return;
            
            const newLikeState = !comment.liked;
            const oldLikes = comment.likes || 0;
            const newLikes = oldLikes + (newLikeState ? 1 : -1);
            const newLikeIcon = likeIcon.getLikeIcon(newLikes, newLikeState);
            
            // 使用 Vue 响应式方式更新
            if (isReply) {
                this.$set(this.comments[commentIndex].replies[replyIndex], 'liked', newLikeState);
                this.$set(this.comments[commentIndex].replies[replyIndex], 'likes', newLikes);
                this.$set(this.comments[commentIndex].replies[replyIndex], 'likeIcon', newLikeIcon);
            } else {
                this.$set(this.comments[commentIndex], 'liked', newLikeState);
                this.$set(this.comments[commentIndex], 'likes', newLikes);
                this.$set(this.comments[commentIndex], 'likeIcon', newLikeIcon);
            }
            
            likeComment(commentId, postId, newLikeState).then((res) => {
                    const result = res.result || res;
                    if (result && result.success) {
                        if (newLikes !== result.likes) {
                            this.updateCommentLikeStatus(commentId, newLikeState, result.likes);
                        }
                    } else {
                        this.updateCommentLikeStatus(commentId, !newLikeState, oldLikes);
                        uni.showToast({ title: '操作失败', icon: 'none' });
                    }
                }).catch((err) => {
                    this.updateCommentLikeStatus(commentId, !newLikeState, oldLikes);
                    uni.showToast({ title: '网络错误', icon: 'none' });
                });
        },

        updateCommentLikeStatus: function (commentId, newLikeState, finalLikes) {
            const { comment, isReply, commentIndex, replyIndex } = this.findCommentWithIndex(this.comments, commentId);
            if (comment) {
                const newLikeIcon = likeIcon.getLikeIcon(finalLikes, newLikeState);
                if (isReply) {
                    this.$set(this.comments[commentIndex].replies[replyIndex], 'liked', newLikeState);
                    this.$set(this.comments[commentIndex].replies[replyIndex], 'likes', finalLikes);
                    this.$set(this.comments[commentIndex].replies[replyIndex], 'likeIcon', newLikeIcon);
                } else {
                    this.$set(this.comments[commentIndex], 'liked', newLikeState);
                    this.$set(this.comments[commentIndex], 'likes', finalLikes);
                    this.$set(this.comments[commentIndex], 'likeIcon', newLikeIcon);
                }
            }
        },

        // 查找评论并返回索引（用于 Vue 响应式更新）
        findCommentWithIndex: function (comments, commentId) {
            for (let i = 0; i < comments.length; i++) {
                if (comments[i]._id === commentId) {
                    return {
                        comment: comments[i],
                        isReply: false,
                        commentIndex: i,
                        replyIndex: -1
                    };
                }
                if (comments[i].replies) {
                    for (let j = 0; j < comments[i].replies.length; j++) {
                        if (comments[i].replies[j]._id === commentId) {
                            return {
                                comment: comments[i].replies[j],
                                isReply: true,
                                commentIndex: i,
                                replyIndex: j
                            };
                        }
                    }
                }
            }
            return {
                comment: null,
                isReply: false,
                commentIndex: -1,
                replyIndex: -1
            };
        },

        toggleShowAllReplies: function (e) {
            const commentId = e.currentTarget.dataset.commentId;
            let comments = this.comments;
            const comment = comments.find((c) => c._id === commentId);
            if (comment) {
                comment.showAllReplies = !comment.showAllReplies;
                this.setData({
                    comments: comments
                });
            }
        },

        // ========== CommentItem 组件事件适配方法 ==========
        
        handleCommentNavigateToUser: function (data) {
            const fakeEvent = {
                currentTarget: {
                    dataset: {
                        userId: data.userId,
                        authorName: data.authorName,
                        isAnonymous: data.isAnonymous
                    }
                }
            };
            this.navigateToUserProfile(fakeEvent);
        },

        handleReplyClick: function (data) {
            const fakeEvent = {
                currentTarget: {
                    dataset: {
                        commentId: data.commentId,
                        authorName: data.authorName,
                        replyId: data.replyId
                    }
                }
            };
            this.showReplyInput(fakeEvent);
        },

        handleCommentLike: function (data) {
            this.toggleLikeComment({
                currentTarget: {
                    dataset: { commentId: data.commentId, liked: data.liked }
                }
            });
        },

        handleCommentDelete: function (data) {
            const fakeEvent = {
                currentTarget: {
                    dataset: {
                        commentId: data.commentId,
                        parentId: data.parentId
                    }
                }
            };
            this.onDeleteComment(fakeEvent);
        },

        handleCommentPreviewImage: function (data) {
            const { imageUrls, imageIndex } = data;
            if (imageUrls && imageUrls.length > 0) {
                previewImage(imageUrls[imageIndex], imageUrls);
            }
        },

        handleToggleReplies: function (data) {
            const fakeEvent = {
                currentTarget: {
                    dataset: {
                        commentId: data.commentId
                    }
                }
            };
            this.toggleShowAllReplies(fakeEvent);
        },

        formatTime: function (dateString) {
            return formatRelativeTime(dateString);
        },

        prepareFollowState: function (authorOpenid) {
            const currentUserId = this.getCurrentUserId();
            const isSameUser = authorOpenid === currentUserId;
            console.log('【关注状态】prepareFollowState调用:', {
                authorOpenid,
                currentUserId,
                isSameUser: isSameUser
            });

            // 设置是否是自己的帖子
            this.setData({
                isOwnPost: isSameUser
            });

            if (!authorOpenid || !currentUserId || isSameUser) {
                console.log('【关注状态】不显示关注按钮 - 自己或无效用户');
                this.setData({
                    showFollowButton: false,
                    isFollowing: false,
                    isFollowedByAuthor: false,
                    isMutualFollow: false
                });
                return;
            }
            console.log('【关注状态】显示关注按钮');
            this.setData({
                showFollowButton: true,
                isFollowing: false,
                isFollowedByAuthor: false,
                isMutualFollow: false
            });
            this.fetchFollowStatusWithCache(authorOpenid);
        },

        fetchFollowStatusWithCache: function (targetOpenid) {
            if (!targetOpenid) {
                return;
            }
            const currentUserId = this.getCurrentUserId();
            if (!currentUserId) {
                return;
            }

            // 使用缓存获取关注状态
            followCache.getFollowStatus(currentUserId, targetOpenid).then((followData) => {
                if (followData) {
                    this.setData({
                        isFollowing: followData.isFollowing,
                        isFollowedByAuthor: followData.isFollowedByAuthor,
                        isMutualFollow: followData.isMutualFollow
                    });
                }
            });
        },

        fetchFollowStatus: function (targetOpenid) {
            if (!targetOpenid) {
                return;
            }

            checkFollowStatus(targetOpenid).then((res) => {
                    if (res.result && res.result.success) {
                        this.setData({
                            isFollowing: !!res.result.isFollowing,
                            isFollowedByAuthor: !!res.result.isFollower,
                            isMutualFollow: !!res.result.isMutual
                        });
                    } else {
                        console.warn('检查关注状态失败', res.result);
                    }
                }).catch((err) => {
                    console.error('检查关注状态调用失败:', err);
                });
        },

        onFollowTap: function () {
            if (this.followPending || !this.post) {
                return;
            }
            const targetOpenid = this.post._openid;
            if (!targetOpenid) {
                return;
            }
            const currentUserId = this.getCurrentUserId();
            if (!currentUserId) {
                uni.showToast({
                    title: '请先登录',
                    icon: 'none'
                });
                return;
            }
            this.setData({
                followPending: true
            });

            // 使用缓存切换关注状态
            followCache
                .toggleFollowStatus(currentUserId, targetOpenid)
                .then((followData) => {
                    if (followData) {
                        this.setData({
                            isFollowing: followData.isFollowing,
                            isFollowedByAuthor: followData.isFollowedByAuthor,
                            isMutualFollow: followData.isMutualFollow
                        });
                        uni.showToast({
                            title: followData.isFollowing ? '关注成功' : '已取消关注',
                            icon: 'success'
                        });
                    } else {
                        uni.showToast({
                            title: '操作失败',
                            icon: 'none'
                        });
                    }
                })
                .catch((err) => {
                    console.error('切换关注状态失败:', err);
                    uni.showToast({
                        title: '网络错误',
                        icon: 'none'
                    });
                })
                .finally(() => {
                    this.setData({
                        followPending: false
                    });
                });
        },

        getCurrentUserId: function () {
            return getCurrentUserId(this);
        },

        retryLoad: function () {
            if (this.currentPostId) {
                this.setData({
                    isLoading: true,
                    post: null
                });
                this.loadPostDetail(this.currentPostId);
            }
        },

        navigateToUserProfile: function (e) {
            try {
                console.log('【详情页头像点击】函数被调用，事件对象:', e);
                const currentTarget = e.currentTarget || e.target || {};
                const dataset = currentTarget.dataset || {};
                const isAnonymous = dataset.isAnonymous === 'true' || dataset.isAnonymous === true;
                const userId = dataset.userId || dataset.userid || dataset.user || '';

                console.log('【详情页头像点击】完整dataset:', dataset);
                console.log('【详情页头像点击】isAnonymous:', isAnonymous);
                console.log('【详情页头像点击】userId:', userId);
                console.log('【详情页头像点击】currentTarget:', currentTarget);

                // 如果是匿名评论，不跳转
                if (isAnonymous || (dataset.authorName === '匿名用户' && userId.includes('anonymous'))) {
                    console.log('【详情页头像点击】匿名评论，不跳转');
                    uni.showToast({
                        title: '匿名用户无法查看主页',
                        icon: 'none'
                    });
                    return;
                }

                if (!userId) {
                    console.error('【头像点击】userId为空，dataset:', dataset);
                    return;
                }

                const currentUserOpenid = this.openid || this.getCurrentUserId();

                // 检查是否点击的是自己的头像
                if (userId === currentUserOpenid) {
                    uni.switchTab({
                        url: '/pages/profile/profile'
                    });
                } else {
                    uni.navigateTo({
                        url: `/pages/user-profile/user-profile?userId=${encodeURIComponent(userId)}`
                    });
                }
            } catch (err) {
                console.error('【头像点击】函数执行出错:', err);
                uni.showToast({
                    title: '跳转异常',
                    icon: 'none'
                });
            }
        },

        preventBubble: function () {
            // 空函数，仅用于阻止事件冒泡
        },

        expandInput: function () {
            // 先重置键盘高度，确保弹窗在底部显示
            // 直接同时设置所有状态，不需要延迟，让弹窗立即显示
            this.setData({
                keyboardHeight: 0,
                isInputExpanded: true,
                isFocus: true, // 直接聚焦，让键盘和弹窗同步响应
            });
        },

        onInputFocus: function (e) {
            // 输入框获得焦点时的处理
            // 从 focus 事件中获取键盘高度作为备用（如果 uni.onKeyboardHeightChange 响应慢）
            if (e && e.detail && typeof e.detail.height === 'number' && e.detail.height > 0) {
                this.setData({
                    keyboardHeight: e.detail.height
                });
            }
        },

        onInputBlur: function () {
            this.setData({
                isFocus: false,
                keyboardHeight: 0 // 键盘收起时重置高度
            });
        },

        collapseInput: function () {
            this.setData({
                isInputExpanded: false,
                isFocus: false,
                replyToComment: null,
                replyToAuthor: '',
            });
        },


        onTagClick: function (e) {
            const tag = e.currentTarget.dataset.tag;
            console.log('点击标签:', tag);
            uni.navigateTo({
                url: `/pages/tag-filter/tag-filter?tag=${encodeURIComponent(tag)}`,
                success: () => {
                    console.log('跳转到标签筛选页面成功');
                },
                fail: (err) => {
                    console.error('跳转到标签筛选页面失败', err);
                    uni.showToast({
                        title: '跳转失败',
                        icon: 'none'
                    });
                }
            });
        },

        // 返回按钮方法
        goBack: function () {
            // 获取页面栈
            const pages = getCurrentPages();
            console.log('当前页面栈长度:', pages.length);
            
            if (pages.length > 1) {
                // 有上一页，正常返回
                uni.navigateBack({
                    delta: 1,
                    fail: () => {
                        console.log('navigateBack失败，尝试switchTab');
                        // 如果返回失败，尝试跳转到首页
                        uni.switchTab({
                            url: '/pages/index/index'
                        });
                    }
                });
            } else {
                // 没有上一页，跳转到首页
                console.log('没有上一页，跳转到首页');
                uni.switchTab({
                    url: '/pages/index/index'
                });
            }
        },

        // 底部栏快速评论输入
        onQuickCommentInput: function(e) {
            this.quickCommentText = e.detail.value;
        },

        // 底部栏快速评论提交
        onQuickCommentSubmit: function() {
            const text = this.quickCommentText.trim();
            if (!text) {
                return;
            }
            
            // 使用现有的评论提交逻辑
            this.newComment = text;
            this.quickCommentText = '';
            this.onSubmitComment();
        },

        // 显示讨论模态框
        showDiscussionModal: function() {
            // 这里可以跳转到写讨论页面或显示讨论模态框
            uni.navigateTo({
                url: '/pages/create-discussion/create-discussion?postId=' + (this.post && this.post._id ? this.post._id : '')
            });
        },

        // 切换收藏状态
        toggleFavorite: function() {
            if (!this.post || !this.post._id) {
                return;
            }
            
            // 使用现有的收藏逻辑
            this.showFavoriteModal = true;
        },


        // 图片加载事件处理
        onImageLoad: function(e) {
        },

        onImageError: function(e) {
            // 显示错误信息
            uni.showToast({
                title: '图片加载失败',
                icon: 'none',
                duration: 2000
            });
        },

        onEditPost() {
            // 打开弹窗，回填当前内容
            this.showEditModal = true;
            this.editForm = {
                title: this.post.title || '',
                content: this.post.content || '',
            };
        },
        onCancelEdit() {
            this.showEditModal = false;
        },
        onEditInput(e) {
            const field = e.currentTarget.dataset.field;
            this.editForm[field] = e.detail.value;
        },
        onSaveEdit() {
            // 验证输入
            if (!this.editForm.title || !this.editForm.title.trim()) {
                uni.showToast({ title: '请输入标题', icon: 'none' });
                return;
            }
            if (!this.editForm.content || !this.editForm.content.trim()) {
                uni.showToast({ title: '请输入正文', icon: 'none' });
                return;
            }
            
            // 检查是否有权限编辑
            if (!this.post || !this.post._id) {
                uni.showToast({ title: '帖子信息无效', icon: 'none' });
                return;
            }
            
            uni.showLoading({ title: '保存中...' });
            
            // 调用更新接口
            updatePostContent(this.post._id, {
                title: this.editForm.title.trim(),
                content: this.editForm.content.trim()
            })
            .then((res) => {
                uni.hideLoading();
                if (res && res.result && res.result.success) {
                    uni.showToast({ title: '保存成功', icon: 'success' });
                    // 更新本地帖子数据
                    this.setData({
                        'post.title': this.editForm.title.trim(),
                        'post.content': this.editForm.content.trim(),
                        showEditModal: false
                    });
                    // 发送更新事件通知其他页面
                    try {
                        const { emitPostUpdated } = require('@/utils/events.js');
                        emitPostUpdated(this.post._id);
                    } catch (e) {
                        if (uni.$emit) {
                            uni.$emit('post-updated', { postId: this.post._id });
                        }
                    }
                } else {
                    uni.showToast({ 
                        title: res.result?.message || '保存失败', 
                        icon: 'none' 
                    });
                }
            })
            .catch((err) => {
                uni.hideLoading();
                console.error('保存失败:', err);
                uni.showToast({ 
                    title: err.message || '保存失败', 
                    icon: 'none' 
                });
            });
        },

    }
};
</script>
<style>
/* pages/post-detail/post-detail.wxss */

/* 自定义返回按钮 */
.custom-back-btn {
    position: absolute;
    top: calc(90rpx + env(safe-area-inset-top, var(--safe-area-inset-top, 44px))); /* 添加安全区域偏移 */
    left: 40rpx;
    width: 100rpx;
    height: 100rpx;
    background: transparent;
    border: none;
    display: block;
    z-index: 100;
    transition: all 0.2s ease;
    box-sizing: border-box;
}

.custom-back-btn:active {
    transform: scale(0.95);
}

.custom-back-btn .back-icon {
    width: 100rpx;
    height: 100rpx;
    display: block;
    object-fit: contain;
}

/* 确保 page 元素有高度 */
page {
    height: 100vh;
}

.container {
    background-color: #ffffff;
    /* min-height: 100vh; */
    padding-bottom: 140rpx;
    padding-top: calc(160rpx + env(safe-area-inset-top, var(--safe-area-inset-top, 44px))); /* 添加安全区域上边距 */
    position: relative; /* 为返回按钮提供定位上下文 */
    /* 新增，确保在内容不足时也能撑满一屏 */
    display: flex;
    flex-direction: column;
    min-height: 100%; /* 使用百分比继承 page 的高度 */
    box-sizing: border-box; /* 加上这个好习惯 */
}

.post-detail-skeleton {
    padding: 0;
}

.skeleton-wrapper {
    background: #fff;
    padding: 40rpx 40rpx 20rpx 40rpx;
    border-bottom: 1rpx solid #f0f0f0;
    margin-bottom: 0;
}

.comment-skeleton-item {
    display: flex;
    align-items: flex-start;
    background-color: #fff;
    padding: 20rpx 40rpx;
    border-bottom: 1rpx solid #f5f5f5;
}

.skeleton-header {
    display: flex;
    align-items: center;
    margin-bottom: 24rpx;
}

.skeleton-avatar {
    width: 88rpx;
    height: 88rpx;
    border-radius: 50%;
    background-color: #e9edf3;
}

.skeleton-header-text {
    flex: 1;
    margin-left: 24rpx;
}

.skeleton-line {
    height: 24rpx;
    background-color: #e9edf3;
    border-radius: 999rpx;
    margin-bottom: 16rpx;
}

.skeleton-line:last-child {
    margin-bottom: 0;
}

.skeleton-line.long {
    width: 100%;
}

.skeleton-line.medium {
    width: 70%;
}

.skeleton-line.short {
    width: 45%;
}

.skeleton-line.xshort {
    width: 30%;
}

.skeleton-image {
    width: 100%;
    height: 340rpx;
    border-radius: 20rpx;
    background-color: #e9edf3;
    margin: 30rpx 0;
}

.skeleton-section-title {
    width: 50%;
    height: 28rpx;
    border-radius: 999rpx;
    background-color: #e9edf3;
    margin: 10rpx 0 30rpx;
}

.comment-skeleton-list {
    display: flex;
    flex-direction: column;
    gap: 24rpx;
}

.comment-skeleton-item {
    display: flex;
    align-items: flex-start;
    background-color: #fff;
    border-radius: 16rpx;
    padding: 24rpx;
    box-shadow: 0 4rpx 12rpx rgba(0, 0, 0, 0.05);
}

.comment-skeleton-body {
    flex: 1;
    margin-left: 24rpx;
}

.comment-skeleton-body .skeleton-line {
    height: 20rpx;
}

.skeleton-animate {
    position: relative;
    overflow: hidden;
}

.skeleton-animate::after {
    content: '';
    position: absolute;
    top: 0;
    left: -150%;
    width: 150%;
    height: 100%;
    background: linear-gradient(90deg, rgba(233, 237, 243, 0) 0%, rgba(255, 255, 255, 0.9) 50%, rgba(233, 237, 243, 0) 100%);
    animation: skeletonPulse 1.2s ease-in-out infinite;
}

@keyframes skeletonPulse {
    0% {
        left: -150%;
    }
    100% {
        left: 100%;
    }
}

.error-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 100rpx 40rpx;
    text-align: center;
}

.error-icon {
    font-size: 120rpx;
    margin-bottom: 30rpx;
    opacity: 0.6;
}

.error-text {
    font-size: 32rpx;
    color: #666;
}

.post-detail-wrapper {
    background: #fff;
    padding: 40rpx 40rpx 20rpx 40rpx;
    border-bottom: 1rpx solid #f0f0f0;
    margin-bottom: 0;
}

.post-detail-wrapper.original-post {
    background: linear-gradient(180deg, rgba(255, 255, 255, 0) 0%, rgba(255, 255, 255, 0) 90%, rgba(235, 200, 141, 0.05) 95%, rgba(235, 200, 141, 0.08) 100%);
    border-left: 3rpx solid #ebc88d;
    position: relative;
}

.post-detail-wrapper.poem-post {
    background: #ffffff !important;
}

.author-info {
    display: flex;
    align-items: center;
    justify-content: flex-start;
    margin-bottom: 20rpx;
    gap: 20rpx;
}

.author-basic {
    display: flex;
    align-items: center;
    flex: 1;
    min-width: 0;
    gap: 12rpx;
    flex-wrap: wrap;
}

.author-right-actions {
    display: flex;
    align-items: center;
    flex-shrink: 0;
    margin-left: auto;
    gap: 12rpx;
}

.follow-btn {
    padding: 0 28rpx;
    height: 60rpx;
    line-height: 60rpx;
    background-color: #9ed7ee;
    color: #ffffff;
    border: none;
    border-radius: 999rpx;
    font-size: 26rpx;
    flex-shrink: 0;
}

.follow-btn.following {
    background-color: #f0f0f0;
    color: #666666;
}

.follow-btn::after {
    border: none;
}

.follow-btn[disabled] {
    opacity: 0.7;
}

.author-avatar {
    width: 60rpx;
    height: 60rpx;
    border-radius: 50%;
    margin-right: 15rpx;
    background-color: #f5f5f5;
    pointer-events: auto;
    cursor: pointer;
    z-index: 10;
    position: relative;
}

.author-name {
    font-weight: bold;
    font-size: 28rpx;
    color: #333;
}

.post-title {
    font-size: 36rpx;
    font-weight: bold;
    margin-bottom: 15rpx;
    line-height: 1.4;
    color: #333;
    word-break: break-word;
    overflow: hidden;
    text-overflow: ellipsis;
    display: -webkit-box;
    line-clamp: 2;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
}

.poem-author {
    font-size: 28rpx;
    color: #333;
    text-align: left;
    margin: 10rpx 0 15rpx 0;
    font-weight: bold;
    letter-spacing: 2rpx;
}

.post-content {
    font-size: 28rpx;
    line-height: 1.6;
    margin-bottom: 20rpx;
    white-space: pre-wrap;
    color: #666;
    word-break: break-word;
}

.image-container {
    position: relative;
    width: 100%;
    margin: 20rpx 0;
    background-color: #f5f5f5;
}

.post-image {
    width: 100%;
    height: auto;
    display: block;
    background-color: #f5f5f5;
    transition: transform 0.3s ease;
}

.post-image:active {
    transform: scale(1.05);
}

.post-image.single-image {
    width: 100% !important;
    height: auto !important;
    display: block !important;
    background-color: #f5f5f5;
}

.image-count-indicator {
    position: absolute;
    top: 20rpx;
    right: 20rpx;
    background-color: rgba(0, 0, 0, 0.6);
    color: white;
    padding: 8rpx 16rpx;
    border-radius: 20rpx;
    font-size: 24rpx;
    z-index: 10;
    backdrop-filter: blur(10rpx);
}

.post-meta {
    margin-bottom: 15rpx;
}

.post-time {
    font-size: 24rpx;
    color: #999;
    opacity: 0.8;
}

.vote-section {
    display: flex;
    justify-content: flex-end;
    align-items: center;
    margin-top: 10rpx;
    padding: 10rpx 40rpx 0 40rpx;
}

.actions-left {
    display: flex;
    align-items: center;
}

.vote-count,
.comment-count {
    display: flex;
    align-items: center;
    font-size: 28rpx;
    color: #999;
    margin-left: 10rpx;
    transition: color 0.2s ease;
}

.action-emoji {
    font-size: 28rpx;
    margin-right: 8rpx;
}

.action-text {
    font-size: 28rpx;
    color: inherit;
}

.like-icon-container {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 12rpx;
    border-radius: 12rpx;
    transition: all 0.2s ease;
    width: 60rpx;
    height: 60rpx;
    margin-right: 12rpx;
}

.like-icon-container:active {
    transform: scale(0.95);
}

.vote-count.voted {
    color: #ff4757;
}

.button-group {
    display: flex;
    align-items: center;
}


.portfolio-icon-container {
    margin-right: 12rpx;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 12rpx;
    border-radius: 12rpx;
    transition: all 0.2s ease;
    width: 60rpx;
    height: 60rpx;
}

.portfolio-icon-container:active {
    transform: scale(0.95);
}

.portfolio-icon {
    width: 56rpx;
    height: 56rpx;
}

.share-icon-container {
    margin-right: 12rpx;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 12rpx;
    border-radius: 12rpx;
    transition: all 0.2s ease;
    width: 60rpx;
    height: 60rpx;
}

.share-icon-container:active {
    transform: scale(0.95);
}

.share-icon {
    width: 56rpx;
    height: 56rpx;
}


.like-icon {
    width: 56rpx;
    height: 56rpx;
}

.comment-section {
    background: #fff;
    padding: 30rpx 40rpx;
    border-bottom: 1rpx solid #f0f0f0;
}

.section-title {
    font-size: 26rpx;
    font-weight: normal;
    margin-bottom: 20rpx;
    padding-bottom: 15rpx;
    border-bottom: 1rpx solid #f0f0f0;
    color: #999;
    margin-left: 0;
    text-align: left;
}

/* 评论相关样式已移入 CommentItem.vue 和 CommentList.vue */

.no-comment-tip {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 60rpx 40rpx;
    text-align: center;
}

.empty-icon {
    font-size: 80rpx;
    margin-bottom: 20rpx;
    opacity: 0.6;
}

.empty-text {
    font-size: 28rpx;
    color: #999;
}

.input-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background-color: rgba(0, 0, 0, 0.4);
    z-index: 99;
    opacity: 0;
    pointer-events: none;
    transition: opacity 0.3s ease;
}
.input-overlay.show {
    opacity: 1;
    pointer-events: auto;
}

.comment-input-area {
    position: fixed;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: #ffffff;
    z-index: 100;
    padding-bottom: constant(safe-area-inset-bottom);
    padding-bottom: env(safe-area-inset-bottom);
    transition: none; /* 禁用动画，直接显示到位 */
    will-change: bottom; /* 优化性能 */
}

.collapsed-bar {
    padding: 16rpx 40rpx;
    display: flex;
    align-items: center;
    border-top: 1rpx solid #f0f0f0;
}
.collapsed-input-placeholder {
    flex: 1;
    height: 68rpx;
    line-height: 68rpx;
    padding: 0 24rpx;
    background-color: #f7f8fa;
    border-radius: 34rpx;
    font-size: 28rpx;
    color: #999;
}

.expanded-container {
    padding: 20rpx 40rpx;
    display: flex;
    flex-direction: column;
    border-top: 1rpx solid #f0f0f0;
}

.expanded-textarea {
    width: 100%;
    min-height: 180rpx;
    max-height: 350rpx;
    padding: 20rpx 24rpx;
    background-color: #ffffff;
    border-radius: 0;
    font-size: 30rpx;
    line-height: 1.6;
    box-sizing: border-box;
    border: none;
    appearance: none;
    -webkit-appearance: none;
    -webkit-box-sizing: border-box;
    user-select: text;
    -webkit-user-select: text;
    -webkit-touch-callout: default;
    outline: none;
}

.expanded-actions {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-top: 20rpx;
    width: 100%;
}
.action-icons {
    display: flex;
    gap: 24rpx;
}

.action-icon {
    width: 100rpx;
    height: 100rpx;
    border-radius: 0;
    background: transparent;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: transform 0.2s ease;
}

.action-icon:active {
    transform: scale(0.92);
    background: transparent;
}

.action-icon-text {
    font-size: 36rpx;
}

.action-icon-image {
    width: 80rpx;
    height: 80rpx;
}

.selected-comment-images {
    display: flex;
    flex-wrap: wrap;
    gap: 12rpx;
    margin-top: 16rpx;
}

.selected-image-item {
    position: relative;
    width: 150rpx;
    height: 150rpx;
    border-radius: 12rpx;
    overflow: hidden;
}

.selected-image-thumb {
    width: 100%;
    height: 100%;
    background-color: #f2f2f2;
    display: block;
}

.remove-image-btn {
    position: absolute;
    top: 6rpx;
    right: 6rpx;
    width: 36rpx;
    height: 36rpx;
    border-radius: 50%;
    background: rgba(0, 0, 0, 0.55);
    color: #fff;
    font-size: 24rpx;
    display: flex;
    align-items: center;
    justify-content: center;
}

.emoji-panel {
    margin-top: 16rpx;
    padding: 20rpx 18rpx;
    background: #f6f7f9;
    border-radius: 16rpx;
    display: flex;
    flex-wrap: wrap;
    gap: 18rpx;
}

.emoji-item {
    font-size: 36rpx;
    padding: 6rpx 10rpx;
}

.reply-prompt {
    display: flex;
    justify-content: flex-start;
    align-items: center;
    margin-bottom: 15rpx;
    padding: 0 10rpx;
}
.reply-prompt-text {
    font-size: 26rpx;
    color: #666;
}
.cancel-reply .cancel-text {
    font-size: 26rpx;
    color: #9ed7ee;
}

.submit-button {
    width: 80rpx !important;
    height: 80rpx !important;
    background: transparent !important;
    border: none !important;
    padding: 0 !important;
    margin: 0 !important;
    box-sizing: border-box !important;
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: opacity 0.2s ease;
}
.submit-button.disabled {
    opacity: 0.5;
}
.submit-icon {
    width: 80rpx;
    height: 80rpx;
}
.submit-button::after {
    border: none;
}

.swiper-wrapper {
    position: relative;
    width: 100%;
}

.image-swiper {
    width: 100%;
    background-color: #f0f0f0;
    border-radius: 12rpx;
    overflow: hidden;
}

.swiper-item {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
}

.post-image {
    max-width: 100%;
    max-height: 100%;
}

.image-count-indicator {
    position: absolute;
    bottom: 20rpx;
    right: 20rpx;
    background-color: rgba(0, 0, 0, 0.6);
    color: white;
    padding: 8rpx 16rpx;
    border-radius: 20rpx;
    font-size: 24rpx;
    z-index: 10;
    backdrop-filter: blur(10rpx);
}

.post-tags {
    margin: 30rpx 0 10rpx 0;
    line-height: 1.5;
}

.post-tag {
    color: #24375f;
    font-size: 26rpx;
    margin-right: 10rpx;
    transition: all 0.2s ease;
    cursor: pointer;
}

.post-tag:active {
    color: #1a2a4a;
    opacity: 0.8;
}

.mutual-tag {
    font-size: 24rpx;
    padding: 0 16rpx;
    height: 60rpx;
    line-height: 60rpx;
    border-radius: 999rpx;
    background-color: #d9d9d9;
    color: #ffffff;
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
}

.followed-tag {
    font-size: 24rpx;
    padding: 4rpx 16rpx;
    border-radius: 999rpx;
    background-color: #f4ebff;
    color: #7c55c7;
    flex-shrink: 0;
}

/* 模式切换样式 */
.mode-switcher {
    display: flex;
    background: #f7f8fa;
    border-radius: 25rpx;
    padding: 6rpx;
    margin-bottom: 20rpx;
    border: 2rpx solid #e9ecef;
}

.mode-item {
    flex: 1;
    text-align: center;
    padding: 16rpx 24rpx;
    border-radius: 20rpx;
    transition: all 0.3s ease;
    position: relative;
}

.mode-item.active {
    background: #9ed7ee;
    box-shadow: 0 2rpx 8rpx rgba(158, 215, 238, 0.3);
}

.mode-text {
    font-size: 28rpx;
    font-weight: 500;
    color: #666;
    transition: color 0.3s ease;
}

.mode-item.active .mode-text {
    color: #fff;
    font-weight: 600;
}

/* 讨论标题输入样式 */
.discussion-title-wrapper {
    margin-bottom: 15rpx;
    border-bottom: 1rpx solid #f0f0f0;
    padding-bottom: 15rpx;
}

.discussion-title-input {
    width: 100%;
    height: 80rpx;
    line-height: 80rpx;
    padding: 0 24rpx;
    background-color: #ffffff;
    border: 1rpx solid #e9ecef;
    border-radius: 12rpx;
    font-size: 30rpx;
    color: #333;
    box-sizing: border-box;
}

.discussion-title-input::placeholder {
    color: #999;
}

/* 讨论类型帖子样式 */
.discussion-content {
    margin: 20rpx 0;
}

.discussion-sentence-group {
    margin-bottom: 30rpx;
}

.discussion-sentence-card {
    background: #f5f5f5; /* 添加灰色背景 */
    border-radius: 12rpx; /* 添加圆角 */
    padding: 30rpx;
    margin-bottom: 20rpx;
    width: 100%;
    min-height: 120rpx;
    position: relative;
    box-sizing: border-box;
    max-width: 100%;
}

.discussion-sentence-content {
    position: relative;
    width: 100%;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: flex-start;
    box-sizing: border-box;
    max-width: 100%;
}

.discussion-sentence-line {
    font-family: 'Inter', sans-serif;
    font-style: italic;
    font-weight: 600;
    font-size: 40rpx;
    line-height: 48rpx;
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

.discussion-sentence-line:last-child {
    margin-bottom: 0;
}

.discussion-comment {
    font-family: 'Inter', sans-serif;
    font-weight: 600;
    font-size: 32rpx;
    line-height: 38rpx;
    color: #000000;
    margin-top: 20rpx;
    padding: 20rpx 0; /* 移除左右padding，只保留上下padding */
    background: transparent; /* 移除灰色背景 */
    border-radius: 0; /* 移除圆角 */
    word-wrap: break-word;
    word-break: break-all;
    width: 100%;
    max-width: 100%;
    box-sizing: border-box;
    overflow-wrap: break-word;
}

/* 分享弹窗样式已移入 ShareModal.vue */

/* 定义 Huiwen-mincho 字体 */
@font-face {
  font-family: 'Huiwen-mincho';
  src: url('/static/fonts/Huiwen-mincho.otf') format('opentype');
  font-weight: normal;
  font-style: normal;
}

/* 底部操作栏样式 */
.bottom-action-bar {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    background-color: #ffffff;
    padding: 20rpx 30rpx;
    padding-bottom: calc(20rpx + constant(safe-area-inset-bottom));
    padding-bottom: calc(20rpx + env(safe-area-inset-bottom));
    display: flex;
    align-items: center;
    justify-content: space-between;
    z-index: 50;
}

.comment-input-container {
    flex: 1;
    margin-right: 30rpx;
}

.comment-input {
    width: 100%;
    height: 60rpx;
    background-color: #f5f5f5;
    border-radius: 30rpx;
    padding: 0 30rpx;
    font-size: 28rpx;
    color: #333;
    border: none;
    box-sizing: border-box;
}

.comment-input::placeholder {
    color: #999;
}

.bottom-action-bar .action-icons {
    display: flex;
    gap: 30rpx;
    align-items: center;
}

.bottom-action-bar .action-icon {
    width: 60rpx;
    height: 60rpx;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: transform 0.2s ease;
}

.bottom-action-bar .action-icon:active {
    transform: scale(0.95);
}

.bottom-action-bar .action-icon-image {
    width: 60rpx;
    height: 60rpx;
}

/* 调整页面底部间距，避免被底部栏遮挡 */
.container {
    padding-bottom: 140rpx;
}
.edit-modal-mask {
  position: fixed; left: 0; top: 0; right: 0; bottom: 0;
  background: rgba(0,0,0,0.35); z-index: 9999;
  display: flex; align-items: center; justify-content: center;
}
.edit-modal {
  background: #fff; border-radius: 10px; padding: 24px; width: 80vw; max-width: 400px;
  box-shadow: 0 4px 40px #0002;
}
.edit-modal-title { font-weight: bold; font-size: 18px; margin-bottom: 12px; }
.edit-title-input, .edit-content-textarea {
  width: 100%; margin-bottom: 16px; border: 1px solid #eee; padding: 8px; border-radius: 6px; font-size: 16px;
}
.edit-content-textarea { min-height: 80px; resize: vertical; }
.edit-modal-actions { display: flex; justify-content: flex-end; gap: 10px; }
.modal-cancel { background: #eee; }
.modal-confirm { background: #3797ff; color: #fff; }

</style>


















