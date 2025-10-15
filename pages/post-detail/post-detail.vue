<template>
    <view>
        
        <!-- pages/post-detail/post-detail.wxml -->
        <view class="container">
            <block v-if="isLoading">
                <view class="post-detail-skeleton">
                    <view class="skeleton-wrapper">
                        <view class="skeleton-header">
                            <view class="skeleton-avatar skeleton-animate"></view>
                            <view class="skeleton-header-text">
                                <view class="skeleton-line medium skeleton-animate"></view>
                                <view class="skeleton-line short skeleton-animate"></view>
                            </view>
                        </view>
                        <view class="skeleton-line long skeleton-animate"></view>
                        <view class="skeleton-line medium skeleton-animate"></view>
                        <view class="skeleton-line short skeleton-animate"></view>
                        <view class="skeleton-image skeleton-animate"></view>
                        <view class="skeleton-line long skeleton-animate"></view>
                        <view class="skeleton-line medium skeleton-animate"></view>
                    </view>
                    <view class="skeleton-section-title skeleton-animate"></view>
                    <view class="comment-skeleton-list">
                        <view class="comment-skeleton-item" v-for="n in commentSkeletonCount" :key="'post-skeleton-comment-' + n">
                            <view class="skeleton-avatar skeleton-animate"></view>
                            <view class="comment-skeleton-body">
                                <view class="skeleton-line medium skeleton-animate"></view>
                                <view class="skeleton-line short skeleton-animate"></view>
                            </view>
                        </view>
                    </view>
                </view>
            </block>
            <block v-else-if="post && post._id">
                <!-- Post Content -->
                <view :class="'post-detail-wrapper ' + (post.isOriginal ? 'original-post' : '')">
                    <view class="author-info">
                        <view class="author-basic">
                            <image
                                v-if="post.authorAvatar"
                                class="author-avatar"
                                :src="post.authorAvatar"
                                mode="aspectFill"
                                @error="onAvatarError"
                                @tap="navigateToUserProfile"
                                :data-user-id="post._openid"
                            ></image>
                            <text class="author-name">{{ post.authorName }}</text>
                            <view v-if="isMutualFollow" class="mutual-tag">互相关注</view>
                            <view v-else-if="isFollowedByAuthor" class="followed-tag">TA关注了你</view>
                        </view>
                        <button
                            v-if="showFollowButton"
                            :class="'follow-btn ' + (isFollowing ? 'following' : '')"
                            @tap="onFollowTap"
                            :loading="followPending"
                            :disabled="followPending"
                        >
                            {{ isFollowing ? '已关注' : '关注' }}
                        </button>
                    </view>
                    <view class="post-title">{{ post.title }}</view>
                    <view v-if="post.isPoem && post.author" class="poem-author">{{ post.author }}</view>
                    <view class="post-content" v-if="post.content">{{ post.content }}</view>

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
                            <button :class="favoriteButtonClass" size="mini" @tap.stop.prevent="onFavorite">
                                {{ favoriteButtonText }}
                            </button>
                        </view>
                        <view class="button-group">
                            <view class="comment-count">
                                <text class="action-emoji">💬</text>
                                <text class="action-text">{{ commentCount }}</text>
                            </view>
                            <view class="like-icon-container" @tap.stop.prevent="onVote" :data-postid="post && post._id ? post._id : ''">
                                <image class="like-icon" :src="post.likeIcon" mode="aspectFit"></image>
                            </view>
                            <view :class="'vote-count ' + (post.isVoted ? 'voted' : '')">
                                <text class="action-text">{{ post.votes || 0 }}</text>
                            </view>
                        </view>
                    </view>
                </view>

                <!-- Comment Section -->
                <view class="comment-section">
                    <view class="section-title">共{{ isCommentLoading ? '--' : commentCount }} 条评论</view>
                    <view v-if="isCommentLoading" class="comment-skeleton-list">
                        <view class="comment-skeleton-item" v-for="n in commentSkeletonCount" :key="'detail-comment-skeleton-' + n">
                            <view class="skeleton-avatar skeleton-animate"></view>
                            <view class="comment-skeleton-body">
                                <view class="skeleton-line medium skeleton-animate"></view>
                                <view class="skeleton-line short skeleton-animate"></view>
                            </view>
                        </view>
                    </view>
                    <view v-else class="comment-list">
                        <block v-if="comments.length > 0">
                            <view class="comment-item" v-for="(item, commentIndex) in comments" :key="commentIndex">
                                <image
                                    class="comment-avatar"
                                    :src="item.authorAvatar"
                                    mode="aspectFill"
                                    @error="onAvatarError"
                                    @tap="navigateToUserProfile"
                                    :data-user-id="item._openid"
                                ></image>

                                <view class="comment-main">
                                    <view class="comment-author">{{ item.authorName }}</view>
                                    <view class="comment-content">{{ item.content }}</view>
                                    <view v-if="item.imageUrls && item.imageUrls.length" class="comment-image-grid">
                                        <image
                                            class="comment-image"
                                            :src="commentImage"
                                            mode="aspectFill"
                                            @tap="previewCommentImageFromList"
                                            :data-comment-index="commentIndex"
                                            :data-image-index="imageIndex"
                                            :data-is-reply="false"
                                            v-for="(commentImage, imageIndex) in item.imageUrls"
                                            :key="imageIndex"
                                        ></image>
                                    </view>
                                    <view class="comment-footer">
                                        <view class="comment-time">{{ item.formattedCreateTime }}</view>
                                        <view class="comment-actions">
                                            <view class="like-section" @tap="toggleLikeComment" :data-comment-id="item._id" :data-liked="item.liked">
                                                <image class="like-icon" :src="item.likeIcon"></image>
                                                <text class="like-count">{{ item.likes || 0 }}</text>
                                            </view>
                                            <view v-if="item.canDelete" class="delete-btn" @tap="onDeleteComment" :data-comment-id="item._id">
                                                <text class="delete-text">删除</text>
                                            </view>
                                            <view class="reply-btn" @tap="showReplyInput" :data-comment-id="item._id" :data-author-name="item.authorName">
                                                <text class="reply-text">回复</text>
                                            </view>
                                        </view>
                                    </view>

                                    <!-- Replies -->
                                    <view v-if="item.replies && item.replies.length > 0" class="replies-container">
                                        <view
                                            class="reply-item"
                                            v-if="replyIndex < (item.showAllReplies ? item.replies.length : 3)"
                                            v-for="(reply, replyIndex) in item.replies"
                                            :key="replyIndex"
                                        >
                                            <image
                                                class="reply-avatar"
                                                :src="reply.authorAvatar"
                                                mode="aspectFill"
                                                @error="onAvatarError"
                                                @tap="navigateToUserProfile"
                                                :data-user-id="reply._openid"
                                            ></image>

                                            <view class="reply-main">
                                                <view class="reply-author">{{ reply.authorName }}</view>
                                                <view class="reply-content">
                                                    <text class="reply-to">回复@{{ item.authorName }}：</text>
                                                    <text>{{ reply.content }}</text>
                                                </view>
                                                <view v-if="reply.imageUrls && reply.imageUrls.length" class="comment-image-grid reply-image-grid">
                                                    <image
                                                        class="comment-image"
                                                        :src="replyImage"
                                                        mode="aspectFill"
                                                        @tap="previewCommentImageFromList"
                                                        :data-comment-index="commentIndex"
                                                        :data-reply-index="replyIndex"
                                                        :data-image-index="replyImageIndex"
                                                        :data-is-reply="true"
                                                        v-for="(replyImage, replyImageIndex) in reply.imageUrls"
                                                        :key="replyImageIndex"
                                                    ></image>
                                                </view>
                                                <view class="reply-footer">
                                                    <view class="reply-time">{{ reply.formattedCreateTime }}</view>
                                                    <view class="reply-actions">
                                                        <view class="like-section" @tap="toggleLikeComment" :data-comment-id="reply._id" :data-liked="reply.liked">
                                                            <image class="like-icon" :src="reply.likeIcon"></image>
                                                            <text class="like-count">{{ reply.likes || 0 }}</text>
                                                        </view>
                                                        <view
                                                            v-if="reply.canDelete"
                                                            class="delete-btn"
                                                            @tap="onDeleteComment"
                                                            :data-comment-id="reply._id"
                                                            :data-parent-id="item._id"
                                                        >
                                                            <text class="delete-text">删除</text>
                                                        </view>
                                                        <view class="reply-btn" @tap="showReplyInput" :data-comment-id="item._id" :data-author-name="reply.authorName">
                                                            <text class="reply-text">回复</text>
                                                        </view>
                                                    </view>
                                                </view>
                                            </view>
                                        </view>

                                        <view
                                            v-if="item.replies.length > 3 && !item.showAllReplies"
                                            class="show-more-replies"
                                            @tap="toggleShowAllReplies"
                                            :data-comment-id="item._id"
                                        >
                                            <text class="show-more-text">显示{{ item.replies.length - 3 }}条回复</text>
                                        </view>

                                        <view
                                            v-if="item.replies.length > 3 && item.showAllReplies"
                                            class="show-more-replies"
                                            @tap="toggleShowAllReplies"
                                            :data-comment-id="item._id"
                                        >
                                            <text class="show-more-text">收起回复</text>
                                        </view>
                                    </view>
                                </view>
                            </view>
                        </block>
                        <block v-else>
                            <view class="no-comment-tip">
                                <view class="empty-icon">💬</view>
                                <view class="empty-text">暂无评论，快来抢沙发吧！</view>
                            </view>
                        </block>
                    </view>
                </view>
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

        <!-- 输入框容器：整体会根据键盘高度上移 -->
        <view class="comment-input-area" :style="'bottom: ' + keyboardHeight + 'px;'">
            <!-- 收起状态：一个假的输入框，点击后展开 -->
            <view v-if="!isInputExpanded" class="collapsed-bar" @tap="expandInput">
                <view class="collapsed-input-placeholder">留下你的精彩评论...</view>
            </view>

            <!-- 展开状态：真正的输入区域 -->
            <view v-if="isInputExpanded" class="expanded-container">
                <!-- 模式切换 -->
                <view class="mode-switcher">
                    <view :class="'mode-item ' + (!isDiscussionMode ? 'active' : '')" @tap="switchToComment">
                        <text class="mode-text">💬 评论</text>
                    </view>
                    <view :class="'mode-item ' + (isDiscussionMode ? 'active' : '')" @tap="switchToDiscussion">
                        <text class="mode-text">💭 讨论</text>
                    </view>
                </view>

                <!-- 如果是回复，显示提示 -->
                <view v-if="replyToComment && !isDiscussionMode" class="reply-prompt">
                    <text class="reply-prompt-text">回复 {{ replyToAuthor }}：</text>
                    <view class="cancel-reply" @tap="cancelReply">
                        <text class="cancel-text">取消</text>
                    </view>
                </view>

                <!-- 讨论模式的标题输入 -->
                <view v-if="isDiscussionMode" class="discussion-title-wrapper">
                    <input
                        class="discussion-title-input"
                        placeholder="讨论标题（可选）"
                        :value="discussionTitle"
                        @input="onDiscussionTitleInput"
                        maxlength="50"
                    />
                </view>

                <!-- 多行文本输入框 -->
                <textarea
                    class="expanded-textarea"
                    :placeholder="isDiscussionMode ? '分享你的深入讨论...' : '留下你的精彩评论...'"
                    :value="isDiscussionMode ? discussionContent : newComment"
                    @input="isDiscussionMode ? onDiscussionContentInput : onCommentInput"
                    @focus="onInputFocus"
                    @blur="onInputBlur"
                    :focus="isFocus"
                    auto-height
                    maxlength="isDiscussionMode ? 1500 : 500"
                    :show-confirm-bar="false"
                    :adjust-position="false"
                ></textarea>

                <!-- 评论图片显示 -->
                <view v-if="!isDiscussionMode && commentImages.length" class="selected-comment-images">
                    <view class="selected-image-item" :data-index="index" v-for="(item, index) in commentImages" :key="index">
                        <image class="selected-image-thumb" :src="item.previewUrl" mode="aspectFill" @tap="previewSelectedCommentImage" :data-index="index"></image>
                        <view class="remove-image-btn" @tap="removeCommentImage" :data-index="index">✕</view>
                    </view>
                </view>

                <!-- 讨论图片显示 -->
                <view v-if="isDiscussionMode && discussionImages.length" class="selected-comment-images">
                    <view class="selected-image-item" :data-index="index" v-for="(item, index) in discussionImages" :key="index">
                        <image class="selected-image-thumb" :src="item.previewUrl" mode="aspectFill" @tap="previewSelectedDiscussionImage" :data-index="index"></image>
                        <view class="remove-image-btn" @tap="removeDiscussionImage" :data-index="index">✕</view>
                    </view>
                </view>

                <!-- 底部操作栏，包含发送按钮 -->
                <view class="expanded-actions">
                    <view class="action-icons">
                        <view class="action-icon" @tap="chooseImages">
                            <text class="action-icon-text">🖼️</text>
                        </view>
                        <view class="action-icon" @tap="toggleEmojiPanel">
                            <text class="action-icon-text">😊</text>
                        </view>
                    </view>
                    <button class="submit-button" @tap="isDiscussionMode ? onSubmitDiscussion : onSubmitComment" :disabled="isSubmitDisabled">
                        {{ isDiscussionMode ? '发布讨论' : '发送' }}
                    </button>
                </view>
                <view v-if="showEmojiPanel" class="emoji-panel">
                    <text class="emoji-item" :data-emoji="item" @tap="insertEmoji" v-for="(item, index) in emojiList" :key="index">{{ item }}</text>
                </view>
            </view>
        </view>

        <!-- Cloud Tip Modal -->
        <cloud-tip-modal :showUploadTip="showUploadTip"></cloud-tip-modal>

        <!-- 收藏夹选择器 -->
        <folder-selector :show="showFavoriteModal" :post-id="post && post._id ? post._id : ''" @hide="hideFavoriteModal" @favoriteSuccess="onFavoriteSuccess" />
    </view>
</template>

<script>
import cloudTipModal from '@/components/cloudTipModal/index';
import folderSelector from '@/components/folder-selector/folder-selector';
// pages/post-detail/post-detail.js
const app = getApp();
const likeIcon = require('../../utils/likeIcon');
const { togglePostLike } = require('../../utils/likeService.js');
const { previewImage } = require('../../utils/imagePreview.js');
const { formatRelativeTime } = require('../../utils/time.js');
const avatarCache = require('../../utils/avatarCache');
const followCache = require('../../utils/followCache');
const { cloudCall } = require('../../utils/cloudCall.js');
const postGalleryMixin = require('../../mixins/postGallery.js');
import { hydrateTempUrls, warmTempUrlsFromPosts } from '@/_utils/hydrate-temp-urls';
import fileUrlCache from '@/_utils/file-url-cache';
export default {
    components: {
        cloudTipModal,
        folderSelector
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
            isInputExpanded: false,
            keyboardHeight: 0,
            isFocus: false,
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
            commentImages: [],
            maxCommentImages: 3,
            showEmojiPanel: false,
            emojiList: ['😀', '😁', '😂', '🤣', '😊', '😍', '😎', '🤔', '😢', '🙏', '👍', '👎'],
            isSubmittingComment: false,
            imgindex: 0,
            img: '',
            commentIndex: 0,
            commentImage: '',
            imageIndex: 0,
            replyIndex: 0,

            reply: {
                authorAvatar: '',
                _openid: '',
                authorName: '',
                content: '',
                imageUrls: '',
                formattedCreateTime: '',
                _id: '',
                liked: '',
                likeIcon: '',
                likes: '',
                canDelete: ''
            },

            replyImage: '',
            replyImageIndex: 0,

            // 讨论功能相关
            isDiscussionMode: false,
            discussionTitle: '',
            discussionContent: '',
            discussionImages: [],
            maxDiscussionImages: 9
        };
    },
    onLoad: function (options) {
        const postId = options.id;
        if (postId) {
            this.setData({
                currentPostId: postId
            });
            this.loadPostDetail(postId);
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
    },
    onShow: function () {
        this.setData({
            viewStartTime: Date.now()
        });
    },
    onUnload: function () {
        this.recordViewBehavior();
    },
    onHide: function () {
        if (this.isInputExpanded) {
            this.collapseInput();
        }
        this.recordViewBehavior();
    },
    methods: {
        // 统一云函数调用方法
        callCloudFunction(name, data = {}, extraOptions = {}) {
            return cloudCall(name, data, Object.assign({ pageTag: 'post-detail', context: this }, extraOptions));
        },
        loadPostDetail: function (postId) {
            this.setData({
                isCommentLoading: true
            });
            this.callCloudFunction(
                'getPostDetail',
                {
                    postId: postId
                },
                {
                    injectOpenId: false
                }
            ).then(async (res) => {
                if (res.result && res.result.post) {
                    let post = res.result.post;
                    post.formattedCreateTime = this.formatTime(post.createTime);
                    post.likeIcon = likeIcon.getLikeIcon(post.votes || 0, post.isVoted || false);
                    // 将 cloud:// 映射为可访问 URL，并预热
                    await hydrateTempUrls([post]);
                    warmTempUrlsFromPosts([post]);
                    console.log('loadPostDetail完整返回数据:', res.result);
                    console.log('loadPostDetail获取到的commentCount:', res.result.commentCount, '类型:', typeof res.result.commentCount);
                    console.log('loadPostDetail获取到的post.commentCount:', post.commentCount, '类型:', typeof post.commentCount);
                    const finalCommentCount = res.result.commentCount || post.commentCount || 0;
                    console.log('最终使用的commentCount:', finalCommentCount);
                    this.setData({
                        post: post,
                        commentCount: finalCommentCount
                    });
                    console.log('loadPostDetail设置后的commentCount:', this.commentCount);
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
            }).catch((err) => {
                console.error('Failed to get post detail', err);
                this.setData({
                    isCommentLoading: false
                });
                uni.showToast({
                    title: '网络错误',
                    icon: 'none'
                });
            }).finally(() => {
                this.setData({
                    isLoading: false
                });
            });
        },

        getComments: function (postId) {
            this.setData({
                isCommentLoading: true
            });
            this.callCloudFunction(
                'getComments',
                {
                    postId: postId
                },
                {
                    injectOpenId: false
                }
            ).then(async (res) => {
                if (res.result && res.result.comments) {
                    const currentUserOpenid = this.openid || uni.getStorageSync('openid');
                    const comments = res.result.comments.map((comment) => {
                        const processedComment = {
                            ...comment,
                            formattedCreateTime: this.formatTime(comment.createTime),
                            likeIcon: likeIcon.getLikeIcon(comment.likes || 0, comment.liked || false),
                            canDelete: comment._openid === currentUserOpenid,
                            imageUrls: comment.imageUrls || [],
                            originalImageUrls: comment.originalImageUrls || []
                        };
                        if (comment.replies) {
                            processedComment.replies = comment.replies.map((reply) => ({
                                ...reply,
                                formattedCreateTime: this.formatTime(reply.createTime),
                                likeIcon: likeIcon.getLikeIcon(reply.likes || 0, reply.liked || false),
                                canDelete: reply._openid === currentUserOpenid,
                                imageUrls: reply.imageUrls || [],
                                originalImageUrls: reply.originalImageUrls || []
                            }));
                        }
                        return processedComment;
                    });
                    // 将评论与回复中的 cloud:// 图片映射为可访问 URL
                    try {
                        const ids = new Set();
                        comments.forEach(c => {
                            (Array.isArray(c.imageUrls) ? c.imageUrls : []).forEach(u => { if (typeof u === 'string' && u.startsWith('cloud://')) ids.add(u); });
                            (Array.isArray(c.replies) ? c.replies : []).forEach(r => (Array.isArray(r.imageUrls) ? r.imageUrls : []).forEach(u => { if (typeof u === 'string' && u.startsWith('cloud://')) ids.add(u); }));
                        });
                        if (ids.size > 0) {
                            const map = await fileUrlCache.getTempUrls(Array.from(ids));
                            comments.forEach(c => {
                                if (Array.isArray(c.imageUrls)) c.imageUrls = c.imageUrls.map(u => map[u] || u);
                                if (Array.isArray(c.replies)) c.replies = c.replies.map(r => ({
                                    ...r,
                                    imageUrls: Array.isArray(r.imageUrls) ? r.imageUrls.map(u => map[u] || u) : r.imageUrls
                                }));
                            });
                        }
                    } catch (_) {}
                    console.log('getComments返回的commentCount:', res.result.commentCount);
                    console.log('comments数组长度:', comments.length);
                    console.log('当前页面的commentCount:', this.commentCount);
                    const newCommentCount = res.result.commentCount || comments.length;
                    const shouldUpdateCount = newCommentCount > this.commentCount;
                    this.setData({
                        comments: comments,
                        commentCount: shouldUpdateCount ? newCommentCount : this.commentCount
                    });
                    console.log('更新后的commentCount:', this.commentCount);
                } else {
                    uni.showToast({
                        title: '评论加载失败',
                        icon: 'none'
                    });
                }
            }).catch((err) => {
                console.error('Failed to get comments', err);
                uni.showToast({
                    title: '网络错误',
                    icon: 'none'
                });
            }).finally(() => {
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

        onImageError: function (e) {
            console.error('图片加载失败', e);
        },

        onAvatarError: function (e) {
            console.error('头像加载失败', e);
        },

        updateSubmitState: function () {
            if (this.isDiscussionMode) {
                const hasTitle = (this.discussionTitle || '').trim().length > 0;
                const hasContent = (this.discussionContent || '').trim().length > 0;
                const hasImages = Array.isArray(this.discussionImages) && this.discussionImages.length > 0;
                const disabled = (!hasContent && !hasImages) || this.isSubmittingComment;
                if (this.isSubmitDisabled !== disabled) {
                    this.setData({
                        isSubmitDisabled: disabled
                    });
                }
            } else {
                const hasText = (this.newComment || '').trim().length > 0;
                const hasImages = Array.isArray(this.commentImages) && this.commentImages.length > 0;
                const disabled = (!hasText && !hasImages) || this.isSubmittingComment;
                if (this.isSubmitDisabled !== disabled) {
                    this.setData({
                        isSubmitDisabled: disabled
                    });
                }
            }
        },

        // 讨论模式切换
        switchToComment: function() {
            if (this.isDiscussionMode) {
                this.setData({
                    isDiscussionMode: false,
                    replyToComment: null,
                    replyToAuthor: ''
                });
                this.updateSubmitState();
            }
        },

        switchToDiscussion: function() {
            if (!this.isDiscussionMode) {
                this.setData({
                    isDiscussionMode: true,
                    replyToComment: null,
                    replyToAuthor: ''
                });
                this.updateSubmitState();
            }
        },

        onDiscussionTitleInput: function(e) {
            this.setData({
                discussionTitle: e.detail.value
            });
            this.updateSubmitState();
        },

        onDiscussionContentInput: function(e) {
            this.setData({
                discussionContent: e.detail.value
            });
            this.updateSubmitState();
        },

        previewSelectedDiscussionImage: function(e) {
            const index = e.currentTarget.dataset.index || 0;
            const images = this.discussionImages || [];
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

        removeDiscussionImage: function(e) {
            const index = e.currentTarget.dataset.index;
            if (index === undefined) {
                return;
            }
            const images = (this.discussionImages || []).slice();
            images.splice(index, 1);
            this.setData(
                {
                    discussionImages: images
                },
                () => {
                    this.updateSubmitState();
                }
            );
        },

        onSubmitDiscussion: async function() {
            if (this.isSubmitDisabled || this.isSubmittingComment) {
                return;
            }

            const trimmedTitle = (this.discussionTitle || '').trim();
            const trimmedContent = (this.discussionContent || '').trim();
            const hasContent = trimmedContent.length > 0;
            const hasImages = Array.isArray(this.discussionImages) && this.discussionImages.length > 0;

            if (!hasContent && !hasImages) {
                uni.showToast({
                    title: '请输入内容或添加图片',
                    icon: 'none'
                });
                return;
            }

            const parentPostId = this.post && this.post._id ? this.post._id : '';
            if (!parentPostId) {
                uni.showToast({
                    title: '帖子信息缺失',
                    icon: 'none'
                });
                return;
            }

            this.setData({
                isSubmittingComment: true
            });
            this.updateSubmitState();

            uni.showLoading({
                title: '发布中...'
            });

            try {
                // 上传讨论图片
                let imageUrls = [];
                let originalImageUrls = [];

                if (this.discussionImages.length > 0) {
                    const imageUploadResults = await this.uploadDiscussionImages();
                    imageUrls = imageUploadResults.map((item) => item.compressedUrl);
                    originalImageUrls = imageUploadResults.map((item) => item.originalUrl);
                }

                // 调用内容审核云函数创建讨论帖子
                const res = await this.callCloudFunction(
                    'contentCheck',
                    {
                        title: trimmedTitle,
                        content: trimmedContent,
                        fileIDs: imageUrls,
                        originalFileIDs: originalImageUrls,
                        isDiscussion: true,
                        parentPostId: parentPostId,
                        publishMode: 'discussion'
                    },
                    { requireAuth: true }
                );

                uni.hideLoading();

                if (res.result && res.result.code === 0) {
                    uni.showToast({
                        title: '讨论发布成功',
                        icon: 'success'
                    });

                    // 清空讨论内容
                    this.setData({
                        discussionTitle: '',
                        discussionContent: '',
                        discussionImages: [],
                        showEmojiPanel: false,
                        isDiscussionMode: false
                    });

                    this.updateSubmitState();
                    this.collapseInput();

                    // 刷新评论列表，显示新创建的讨论
                    this.getComments(parentPostId);

                    // 更新评论计数
                    const newCommentCount = this.commentCount + 1;
                    this.setData({
                        commentCount: newCommentCount
                    });

                    // 更新上一页面的评论计数
                    const pages = getCurrentPages();
                    if (pages.length > 1) {
                        const prePage = pages[pages.length - 2];
                        if ((prePage.route === 'pages/index/index' || prePage.route === 'pages/profile/profile') && typeof prePage.updatePostCommentCount === 'function') {
                            prePage.updatePostCommentCount(parentPostId, newCommentCount);
                        }
                    }
                } else {
                    uni.showToast({
                        title: (res.result && res.result.msg) || '讨论发布失败',
                        icon: 'none'
                    });
                }
            } catch (error) {
                console.error('Failed to submit discussion:', error);
                uni.hideLoading();
                uni.showToast({
                    title: '讨论发布失败',
                    icon: 'none'
                });
            } finally {
                this.setData({
                    isSubmittingComment: false
                });
                this.updateSubmitState();
            }
        },

        uploadDiscussionImages: function() {
            const images = this.discussionImages || [];
            if (!images.length) {
                return Promise.resolve([]);
            }
            const openid = this.getCurrentUserId() || 'guest';
            const timestamp = Date.now();

            // 使用兼容性的文件上传方法
            return Promise.all(
                images.map((image, index) => {
                    const uniqueKey = (openid || 'guest') + '_' + timestamp + '_discussion_' + index;
                    const compressedCloudPath = 'discussion_images/' + uniqueKey + '_compressed.jpg';

                    // 使用兼容性的文件上传方法
                    return this.uploadFile(compressedCloudPath, image.compressedPath || image.previewUrl || image.originalPath)
                        .then((compressedRes) => {
                            if (image.needCompression) {
                                const originalCloudPath = 'discussion_images/' + uniqueKey + '_original.jpg';
                                return this.uploadFile(originalCloudPath, image.originalPath)
                                    .then((originalRes) => ({
                                        compressedUrl: compressedRes.fileID,
                                        originalUrl: originalRes.fileID
                                    }));
                            }
                            return {
                                compressedUrl: compressedRes.fileID,
                                originalUrl: compressedRes.fileID
                            };
                        });
                })
            );
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

        toggleEmojiPanel: function () {
            const shouldShow = !this.showEmojiPanel;
            const updateData = {
                showEmojiPanel: shouldShow,
                isFocus: !shouldShow
            };
            if (shouldShow) {
                updateData.keyboardHeight = 0;
                uni.hideKeyboard();
            }
            this.setData(updateData);
        },

        insertEmoji: function (e) {
            const emoji = e.currentTarget.dataset.emoji;
            if (!emoji) {
                return;
            }

            if (this.isDiscussionMode) {
                const newDiscussionContent = (this.discussionContent || '') + emoji;
                this.setData(
                    {
                        discussionContent: newDiscussionContent
                    },
                    () => {
                        this.updateSubmitState();
                    }
                );
            } else {
                const newComment = (this.newComment || '') + emoji;
                this.setData(
                    {
                        newComment: newComment
                    },
                    () => {
                        this.updateSubmitState();
                    }
                );
            }
        },

        closeEmojiPanel: function () {
            if (this.showEmojiPanel) {
                this.setData({
                    showEmojiPanel: false
                });
            }
        },

        chooseImages: function () {
            this.closeEmojiPanel();

            const isDiscussionMode = this.isDiscussionMode;
            const existingImages = isDiscussionMode ?
                (this.discussionImages ? this.discussionImages.length : 0) :
                (this.commentImages ? this.commentImages.length : 0);
            const maxImages = isDiscussionMode ? this.maxDiscussionImages : this.maxCommentImages;
            const remaining = maxImages - existingImages;

            if (remaining <= 0) {
                uni.showToast({
                    title: isDiscussionMode ? '最多选择9张图片' : '最多选择3张图片',
                    icon: 'none'
                });
                return;
            }

            // 确保输入框保持展开状态
            if (!this.isInputExpanded) {
                this.expandInput();
            }

            uni.chooseImage({
                count: remaining,
                sizeType: ['original', 'compressed'],
                sourceType: ['album', 'camera'],
                success: (res) => {
                    const tempFiles =
                        res.tempFiles ||
                        (res.tempFilePaths || []).map((path) => ({
                            tempFilePath: path,
                            size: 0
                        }));

                    const prepareMethod = isDiscussionMode ? 'prepareDiscussionImage' : 'prepareCommentImage';
                    const tasks = tempFiles.map((file) => this[prepareMethod](file));

                    Promise.all(tasks)
                        .then((processedImages) => {
                            const validImages = processedImages.filter((item) => !!item);
                            if (validImages.length === 0) {
                                return;
                            }

                            if (isDiscussionMode) {
                                const updatedImages = (this.discussionImages || []).concat(validImages);
                                this.setData(
                                    {
                                        discussionImages: updatedImages.slice(0, this.maxDiscussionImages)
                                    },
                                    () => {
                                        this.updateSubmitState();
                                        this.setData({
                                            isInputExpanded: true,
                                            isFocus: false
                                        });
                                    }
                                );
                            } else {
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
                            }
                        })
                        .catch((err) => {
                            console.error((isDiscussionMode ? '讨论' : '评论') + '图片处理失败:', err);
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
                // 降低压缩阈值到200KB，确保所有超过200KB的图片都被压缩
                const needCompression = sizeInBytes > 204800;
                const imageInfo = {
                    id: 'comment_' + Date.now() + '_' + Math.floor(Math.random() * 100000),
                    originalPath: tempPath,
                    previewUrl: tempPath,
                    compressedPath: tempPath,
                    size: sizeInBytes,
                    needCompression: needCompression
                };
                if (!needCompression) {
                    resolve(imageInfo);
                    return;
                }
                this.compressCommentImage(imageInfo)
                    .then((resolvedInfo) => {
                        resolve(resolvedInfo);
                    })
                    .catch((err) => {
                        console.warn('评论图片压缩异常:', err);
                        imageInfo.compressedPath = imageInfo.originalPath;
                        imageInfo.previewUrl = imageInfo.originalPath;
                        imageInfo.needCompression = false;
                        resolve(imageInfo);
                    });
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

        prepareDiscussionImage: function (file) {
            return new Promise((resolve) => {
                const tempPath = file.tempFilePath || file.path || (Array.isArray(file.tempFilePaths) ? file.tempFilePaths[0] : '');
                if (!tempPath) {
                    resolve(null);
                    return;
                }
                const sizeInBytes = file.size || 0;
                // 讨论图片可以稍微大一些，阈值设为300KB
                const needCompression = sizeInBytes > 307200;
                const imageInfo = {
                    id: 'discussion_' + Date.now() + '_' + Math.floor(Math.random() * 100000),
                    originalPath: tempPath,
                    previewUrl: tempPath,
                    compressedPath: tempPath,
                    size: sizeInBytes,
                    needCompression: needCompression
                };
                if (!needCompression) {
                    resolve(imageInfo);
                    return;
                }
                this.compressDiscussionImage(imageInfo)
                    .then((resolvedInfo) => {
                        resolve(resolvedInfo);
                    })
                    .catch((err) => {
                        console.warn('讨论图片压缩异常:', err);
                        imageInfo.compressedPath = imageInfo.originalPath;
                        imageInfo.previewUrl = imageInfo.originalPath;
                        imageInfo.needCompression = false;
                        resolve(imageInfo);
                    });
            });
        },

        compressDiscussionImage: function (imageInfo) {
            return new Promise((resolve) => {
                // 讨论图片压缩，允许稍大的文件大小，阈值300KB
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
                                    console.log(`讨论图片压缩质量${quality}%，文件大小: ${(compressedSize / 1024).toFixed(2)}KB`);

                                    // 如果文件大小超过300KB且质量还可以继续降低，则继续压缩
                                    if (compressedSize > 307200 && quality > 30) {
                                        console.log(`讨论图片大小${(compressedSize / 1024).toFixed(2)}KB超过300KB，继续压缩...`);
                                        compressWithQuality(quality - 10);
                                    } else {
                                        imageInfo.compressedPath = res.tempFilePath;
                                        imageInfo.previewUrl = res.tempFilePath;
                                        imageInfo.compressedSize = compressedSize;
                                        console.log(`讨论图片最终压缩质量${quality}%，文件大小: ${(compressedSize / 1024).toFixed(2)}KB`);
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
                            console.warn(`讨论图片压缩质量${quality}%失败:`, err);
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

                // 从70%质量开始压缩，讨论图片可以用更高质量
                compressWithQuality(70);
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
            
            // 使用兼容性的文件上传方法
            return Promise.all(
                images.map((image, index) => {
                    const uniqueKey = (openid || 'guest') + '_' + timestamp + '_' + index;
                    const compressedCloudPath = 'comment_images/' + uniqueKey + '_compressed.jpg';
                    
                    // 使用兼容性的文件上传方法
                    return this.uploadFile(compressedCloudPath, image.compressedPath || image.previewUrl || image.originalPath)
                        .then((compressedRes) => {
                            if (image.needCompression) {
                                const originalCloudPath = 'comment_images/' + uniqueKey + '_original.jpg';
                                return this.uploadFile(originalCloudPath, image.originalPath)
                                    .then((originalRes) => ({
                                        compressedUrl: compressedRes.fileID,
                                        originalUrl: originalRes.fileID
                                    }));
                            }
                            return {
                                compressedUrl: compressedRes.fileID,
                                originalUrl: compressedRes.fileID
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
            const hasContent = trimmedContent.length > 0;
            const hasImages = Array.isArray(this.commentImages) && this.commentImages.length > 0;
            if (!hasContent && !hasImages) {
                uni.showToast({
                    title: '请输入内容或添加图片',
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
                const res = await this.callCloudFunction(
                    'addComment',
                    {
                        postId: postId,
                        content: trimmedContent,
                        parentId: parentId,
                        replyToAuthorName: replyToAuthor,
                        imageUrls: imageUrls,
                        originalImageUrls: originalImageUrls
                    },
                    { requireAuth: true }
                );
                uni.hideLoading();
                if (res.result && res.result.success) {
                    uni.showToast({
                        title: '评论成功'
                    });
                    const newCommentCount = this.commentCount + 1;
                    this.setData({
                        newComment: '',
                        commentImages: [],
                        showEmojiPanel: false,
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
            this.setData({
                replyToComment: commentId,
                replyToAuthor: authorName
            });
            console.log('设置后的回复状态:', {
                replyToComment: this.replyToComment,
                replyToAuthor: this.replyToAuthor
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
                    this.callCloudFunction(
                        'deleteComment',
                        {
                            commentId
                        },
                        { requireAuth: true }
                    ).then((result) => {
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
            const comments = this.comments;
            const { comment, isReply } = this.findComment(comments, commentId);
            if (!comment) {
                return;
            }
            const newLikeState = !comment.liked;
            const oldLikes = comment.likes || 0;
            comment.liked = newLikeState;
            comment.likes = oldLikes + (newLikeState ? 1 : -1);
            comment.likeIcon = likeIcon.getLikeIcon(comment.likes, comment.liked);
            this.setData({
                comments: comments
            });
            this.callCloudFunction(
                'likeComment',
                {
                    commentId: commentId,
                    postId: postId
                },
                { requireAuth: true }
            ).then((res) => {
                    if (res.result && res.result.success) {
                        if (comment.likes !== res.result.likes) {
                            this.updateCommentLikeStatus(commentId, newLikeState, res.result.likes);
                        }
                    } else {
                        this.updateCommentLikeStatus(commentId, !newLikeState, oldLikes);
                        uni.showToast({
                            title: '操作失败',
                            icon: 'none'
                        });
                    }
                }).catch((err) => {
                    this.updateCommentLikeStatus(commentId, !newLikeState, oldLikes);
                    console.error('Failed to like comment', err);
                    uni.showToast({
                        title: '网络错误',
                        icon: 'none'
                    });
                });
        },

        updateCommentLikeStatus: function (commentId, newLikeState, finalLikes) {
            let comments = this.comments;
            const { comment, isReply } = this.findComment(comments, commentId);
            if (comment) {
                comment.liked = newLikeState;
                comment.likes = finalLikes;
                comment.likeIcon = likeIcon.getLikeIcon(comment.likes, comment.liked);
                this.setData({
                    comments: comments
                });
            }
        },

        findComment: function (comments, commentId) {
            for (let i = 0; i < comments.length; i++) {
                if (comments[i]._id === commentId) {
                    return {
                        comment: comments[i],
                        isReply: false
                    };
                }
                if (comments[i].replies) {
                    for (let j = 0; j < comments[i].replies.length; j++) {
                        if (comments[i].replies[j]._id === commentId) {
                            return {
                                comment: comments[i].replies[j],
                                isReply: true
                            };
                        }
                    }
                }
            }
            return {
                comment: null,
                isReply: false
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

        formatTime: function (dateString) {
            return formatRelativeTime(dateString);
        },

        prepareFollowState: function (authorOpenid) {
            const currentUserId = this.getCurrentUserId();
            console.log('【关注状态】prepareFollowState调用:', {
                authorOpenid,
                currentUserId,
                isSameUser: authorOpenid === currentUserId
            });
            if (!authorOpenid || !currentUserId || authorOpenid === currentUserId) {
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
            this.callCloudFunction(
                'follow',
                {
                    action: 'checkFollow',
                    targetOpenid
                },
                { requireAuth: true }
            ).then((res) => {
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
            return this.openid || uni.getStorageSync('openid') || uni.getStorageSync('userOpenId');
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
            const userId = e.currentTarget.dataset.userId;
            if (userId) {
                const currentUserOpenid = this.openid;
                if (userId === currentUserOpenid) {
                    console.log('【帖子详情】点击的是自己头像，切换到我的页面');
                    uni.switchTab({
                        url: '/pages/profile/profile'
                    });
                } else {
                    console.log('【帖子详情】点击的是他人头像，跳转到用户主页');
                    uni.navigateTo({
                        url: `/pages/user-profile/user-profile?userId=${userId}`
                    });
                }
            }
        },

        preventBubble: function () {
            // 空函数，仅用于阻止事件冒泡
        },

        expandInput: function () {
            this.setData({
                isInputExpanded: true,
                isFocus: true,
                showEmojiPanel: false
            });
        },

        onInputFocus: function (e) {
            console.log('键盘弹起，高度为:', e.detail.height);
            this.setData({
                keyboardHeight: e.detail.height,
                showEmojiPanel: false
            });
        },

        onInputBlur: function () {
            setTimeout(() => {
                this.setData({
                    isFocus: false,
                    keyboardHeight: 0
                });
            }, 100);
        },

        collapseInput: function () {
            this.setData({
                isInputExpanded: false,
                isFocus: false,
                keyboardHeight: 0,
                replyToComment: null,
                replyToAuthor: '',
                showEmojiPanel: false
            });
        },

        recordViewBehavior: function () {
            if (!this.currentPostId || !this.viewStartTime) {
                return;
            }
            const viewDuration = Math.floor((Date.now() - this.viewStartTime) / 1000);
            if (viewDuration < 3) {
                return;
            }
            this.callCloudFunction('recordView', {
                    postId: this.currentPostId,
                    viewDuration: viewDuration
                }).then((res) => {
                    console.log('浏览记录已保存', res);
                }).catch((err) => {
                    console.error('浏览记录保存失败:', err);
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

        // 兼容性文件上传方法
        uploadFile(cloudPath, filePath) {
            console.log(`🔍 [帖子详情页] 上传文件: ${cloudPath}`, filePath);
            
            return new Promise((resolve, reject) => {
                // 使用新的平台检测工具
                const { getCurrentPlatform, getCloudFunctionMethod } = require('../../utils/platformDetector.js');
                
                const platform = getCurrentPlatform();
                const method = getCloudFunctionMethod();
                
                console.log(`🔍 [帖子详情页] 运行环境检测 - 平台: ${platform}, 方法: ${method}`);
                
                if (method === 'tcb') {
                    // 使用TCB上传文件（H5和App环境）
                    if (this.$tcb && this.$tcb.uploadFile) {
                        console.log(`🔍 [帖子详情页] TCB环境上传文件: ${cloudPath}`);
                        this.$tcb.uploadFile({
                            cloudPath: cloudPath,
                            filePath: filePath
                        }).then(resolve).catch(reject);
                    } else {
                        console.error(`❌ [帖子详情页] TCB实例不可用`);
                        reject(new Error('TCB实例不可用'));
                    }
                } else if (method === 'wx-cloud') {
                    // 使用微信云开发上传文件（小程序环境）
                    if (wx.cloud && wx.cloud.uploadFile) {
                        console.log(`🔍 [帖子详情页] 小程序环境上传文件: ${cloudPath}`);
                        wx.cloud.uploadFile({
                            cloudPath: cloudPath,
                            filePath: filePath,
                            success: (res) => {
                                console.log(`✅ [帖子详情页] 文件上传成功: ${cloudPath}`, res);
                                resolve(res);
                            },
                            fail: (err) => {
                                console.error(`❌ [帖子详情页] 文件上传失败: ${cloudPath}`, err);
                                reject(err);
                            }
                        });
                    } else {
                        console.error(`❌ [帖子详情页] 微信云开发不可用`);
                        reject(new Error('微信云开发不可用'));
                    }
                } else {
                    console.error(`❌ [帖子详情页] 不支持的文件上传方式: ${method}`);
                    reject(new Error(`不支持的文件上传方式: ${method}`));
                }
            });
        }
    }
};
</script>
<style>
/* pages/post-detail/post-detail.wxss */
.container {
    background-color: #ffffff;
    min-height: 100vh;
    padding-bottom: 140rpx;
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
    background: linear-gradient(90deg, rgba(235, 200, 141, 0.05) 0%, rgba(255, 255, 255, 0) 100%);
    border-left: 3rpx solid #ebc88d;
    position: relative;
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
    margin-left: auto;
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
    justify-content: space-between;
    align-items: center;
    margin-top: 10rpx;
    padding: 10rpx 60rpx 0 60rpx;
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
    margin-left: 20rpx;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 8rpx;
    border-radius: 8rpx;
    transition: all 0.2s ease;
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

.favorite-button {
    background-color: #ffc300;
    color: white;
    border: none;
    border-radius: 8rpx;
    font-size: 24rpx;
    padding: 8rpx 16rpx;
    line-height: 1.2;
    transition: all 0.2s ease;
}

.favorite-button:active {
    background-color: #e6b000;
}

.favorite-button::after {
    border: none;
}

.favorite-button.favorited {
    background-color: #999;
    color: #fff;
}

.favorite-button.favorited:active {
    background-color: #777;
}

.like-icon {
    width: 48rpx;
    height: 48rpx;
}

.comment-section {
    background: #fff;
    padding: 30rpx 40rpx;
    border-bottom: 1rpx solid #f0f0f0;
}

.section-title {
    font-size: 32rpx;
    font-weight: bold;
    margin-bottom: 20rpx;
    padding-bottom: 15rpx;
    border-bottom: 1rpx solid #f0f0f0;
    color: #333;
}

.comment-list {
    margin-top: 20rpx;
}

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
    margin-left: 40rpx;
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
}
.comment-image-grid {
    display: flex;
    flex-direction: column;
    gap: 12rpx;
    margin-bottom: 12rpx;
}

.comment-image {
    width: 100%;
    height: 400rpx;
    border-radius: 12rpx;
    background-color: #f2f2f2;
    display: block;
    object-fit: cover;
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
}

.like-section {
    display: flex;
    align-items: center;
    padding: 8rpx 12rpx;
    margin-right: 15rpx;
    transition: all 0.2s ease;
}

.like-section:active {
    transform: scale(0.95);
}

.like-section .like-icon {
    width: 32rpx;
    height: 32rpx;
    margin-right: 8rpx;
}

.like-count {
    font-size: 26rpx;
    color: #666;
}

.delete-btn {
    display: flex;
    align-items: center;
    padding: 8rpx 12rpx;
    margin-right: 15rpx;
    transition: opacity 0.2s ease;
}

.delete-btn:active {
    opacity: 0.7;
}

.delete-text {
    font-size: 26rpx;
    color: #ff4d4f;
}

.reply-btn {
    display: flex;
    align-items: center;
    padding: 8rpx 12rpx;
    transition: opacity 0.2s ease;
}

.reply-btn:active {
    opacity: 0.7;
}

.reply-text {
    font-size: 26rpx;
    color: #9ed7ee;
}

.replies-container {
    margin-top: 15rpx;
    margin-left: 20rpx;
    padding-left: 20rpx;
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
    transition: bottom 0.2s ease-out;
    padding-bottom: constant(safe-area-inset-bottom);
    padding-bottom: env(safe-area-inset-bottom);
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
    -webkit-appearance: none;
    -webkit-box-sizing: border-box;
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
    width: 64rpx;
    height: 64rpx;
    border-radius: 50%;
    background: #f3f5f7;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: transform 0.2s ease;
}

.action-icon:active {
    transform: scale(0.92);
    background: #e6eef3;
}

.action-icon-text {
    font-size: 36rpx;
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
    width: 120rpx !important;
    height: 64rpx !important;
    line-height: 64rpx !important;
    background-color: #9ed7ee;
    color: white;
    border-radius: 32rpx;
    font-size: 28rpx;
    padding: 0 !important;
    margin: 0 !important;
    border: none !important;
    box-sizing: border-box !important;
    flex-shrink: 0;
    transition: background-color 0.2s ease;
}
.submit-button[disabled] {
    background-color: #b3e6c9;
    color: #ffffff;
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
    padding: 4rpx 16rpx;
    border-radius: 999rpx;
    background-color: #e6f4ff;
    color: #1f6fd2;
    flex-shrink: 0;
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
</style>
