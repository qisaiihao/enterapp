<template>
    <view>

        <!-- pages/post-detail/post-detail.wxml -->
        <!-- 鑷畾涔夎繑鍥炴寜閽?-->
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
                            <text class="author-name">{{ post.isAnonymous ? '鍖垮悕鐢ㄦ埛' : post.authorName }}</text>
                        </view>
                        <view class="author-right-actions">
                            <view v-if="!post.isAnonymous && isMutualFollow" class="mutual-tag">浜掔浉鍏虫敞</view>
                            <view v-else-if="!post.isAnonymous && isFollowedByAuthor && !isMutualFollow" class="followed-tag">TA鍏虫敞浜嗕綘</view>
                            <button
                                v-if="showFollowButton && !post.isAnonymous && !isMutualFollow"
                                :class="'follow-btn ' + (isFollowing ? 'following' : '')"
                                @tap="onFollowTap"
                                :loading="followPending"
                                :disabled="followPending"
                            >
                                {{ isFollowing ? '???' : '??' }}
                            </button>
                        </view>
                    </view>
                    <view class="post-title">{{ post.title }}</view>
                    <view v-if="post.isPoem && post.author" class="poem-author" :class="{ 'poem-author-clickable': canGoToPoetProfile }" @tap="onPoetNameTap">{{ post.author }}</view>

                    <!-- 璁ㄨ绫诲瀷甯栧瓙鐗规畩娓叉煋锛氫粎褰撳瓨鍦ㄦ湁鏁堝彞瀛愭垨璇勮鏃跺睍绀猴紝鍚﹀垯鍥為€€鍒版鏂?-->
                    <view v-if="post.isDiscussion && hasValidDiscussionGroups(post)" class="discussion-content">
                        <view v-for="(sentenceGroup, groupIndex) in post.sentenceGroups" :key="groupIndex" class="discussion-sentence-group">
                            <!-- 鍙ュ瓙鍗＄墖锛氫粎鍦ㄦ湁鏈夋晥鍙ュ瓙鏃舵樉绀猴紝閬垮厤绌虹伆妗?-->
                            <view v-if="hasDiscussionSentences(sentenceGroup)" class="discussion-sentence-card">
                                <view class="discussion-sentence-content">
                                    <text v-for="(line, lineIndex) in sentenceGroup.sentences" :key="lineIndex" class="discussion-sentence-line">
                                        {{ line }}
                                    </text>
                                </view>
                            </view>

                            <!-- 璇勮鍐呭 -->
                            <view v-if="sentenceGroup.comment" class="discussion-comment">
                                {{ sentenceGroup.comment }}
                            </view>
                        </view>
                    </view>
                    <!-- 缁勮瘲鍐呭 -->
                    <view v-else-if="post.isSeries && post.seriesBlocks && post.seriesBlocks.length > 0" class="series-simple-display">
                        <view v-for="(block, idx) in post.seriesBlocks" :key="idx" class="series-poem-block">
                            <view v-if="block.subtitle" class="series-poem-subtitle">{{ block.subtitle }}</view>
                            <view class="post-content">{{ block.content }}</view>
                        </view>
                    </view>

                    <!-- 鏅€氬笘瀛愬唴瀹?-->
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
                            <!-- 宸︿晶鎸夐挳鍖哄煙淇濈暀涓虹┖锛屾垨鑰呭彲浠ユ斁鍏朵粬鎸夐挳 -->
                        </view>
                        <view class="button-group">
                            <view class="like-icon-container" @tap.stop.prevent="onVote" :data-postid="post && post._id ? post._id : ''">
                                <image class="like-icon" :src="post.likeIcon" mode="aspectFit"></image>
                            </view>
                            <!-- 浣滃搧闆嗘寜閽?- 鍙湁鍘熷垱璇椾笖鏄嚜宸辩殑甯栧瓙鎵嶆樉绀?-->
                            <view v-if="post.isOriginal && post.isPoem && isOwnPost" class="portfolio-icon-container" @tap.stop.prevent="onAddToPortfolio">
                                <image class="portfolio-icon" src="/static/images/newicons/library.png" mode="aspectFit"></image>
                            </view>
                              <!-- 鍒嗕韩鎸夐挳锛堜粎璇楁瓕甯栧瓙鏄剧ず锛?-->
                            <view v-if="post && post.isPoem" class="share-icon-container" @tap.stop.prevent="onShare">
                                <image class="share-icon" src="/static/images/newicons/save_share.png" mode="aspectFit"></image>
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
                    <view class="error-text">甯栧瓙鍔犺浇失败鎴栦笉瀛樺湪</view>
                </view>
            </block>
        </view>
        <!-- 閬僵灞傦細褰撹緭鍏ユ灞曞紑鏃舵樉绀?-->
        <view :class="'input-overlay ' + (isInputExpanded ? 'show' : '')" @tap="collapseInput"></view>
        <!-- 杈撳叆妗嗗鍣細淇濇寔鍦ㄩ〉闈㈠簳閮?-->
        <view v-if="isInputExpanded" class="comment-input-area" :style="'bottom: ' + keyboardHeight + 'px;'">
            <!-- 灞曞紑鐘舵€侊細鐪熸鐨勮緭鍏ュ尯鍩?-->
            <view v-if="isInputExpanded" class="expanded-container">
                <!-- 濡傛灉鏄洖澶嶏紝鏄剧ず鎻愮ず -->
                <view v-if="replyToComment" class="reply-prompt">
                    <text class="reply-prompt-text">回复 {{ replyToAuthor }}：</text>
                    <view class="cancel-reply" @tap="cancelReply">
                        <text class="cancel-text">取消</text>
                    </view>
                </view>
                <!-- 澶氳鏂囨湰杈撳叆妗?-->
                <textarea
                    class="expanded-textarea"
                    :style="'height: ' + commentTextareaHeight + 'px;'"
                    placeholder="鐣欎笅浣犵殑绮惧僵璇勮..."
                    :value="newComment"
                    @input="onCommentInput"
                    @linechange="onCommentLineChange"
                    @focus="onInputFocus"
                    @blur="onInputBlur"
                    :focus="isFocus"
                    :adjust-position="false"
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
                <!-- 搴曢儴鎿嶄綔鏍忥紝鍖呭惈鍙戦€佹寜閽?-->
                <view class="expanded-actions">
                    <view class="action-icons">
                        <view class="action-icon" @tap="chooseImages">
                            <image class="action-icon-image" src="/static/images/newicons/image.png" mode="aspectFit"></image>
                        </view>
                        </view>
                    <view class="submit-button" @tap="onSubmitComment" :class="{ 'disabled': isSubmitDisabled }">
                        <image class="submit-icon" src="/static/images/newicons/comment.png" mode="aspectFit"></image>
                    </view>
                </view>
            </view>
        </view>
        <!-- 搴曢儴鎿嶄綔鏍?-->
        <view class="bottom-action-bar" v-if="!isInputExpanded">
            <view class="comment-input-container">
                <input
                    class="comment-input"
                    placeholder="璇勮..."
                    :value="quickCommentText"
                    :adjust-position="false"
                    @input="onQuickCommentInput"
                    @confirm="onQuickCommentSubmit"
                    @tap="expandInput"
                />
            </view>
            <view class="action-icons">
                <view class="action-icon" @tap="showDiscussionModal">
                    <image class="action-icon-image" src="/static/images/newicons/taolun.png" mode="aspectFit"></image>
                </view>
                <view class="action-icon" @tap="toggleFavorite">
                    <image class="action-icon-image" :src="post && post.isFavorited ? '/static/images/newicons/collection.png' : '/static/images/newicons/collection.png'" mode="aspectFit"></image>
                </view>
            </view>
        </view>
        <!-- Cloud Tip Modal -->
        <cloud-tip-modal :showUploadTip="showUploadTip"></cloud-tip-modal>
        <!-- 鏀惰棌澶归€夋嫨鍣?-->
        <folder-selector :show="showFavoriteModal" :post-id="post && post._id ? post._id : ''" @hide="hideFavoriteModal" @favoriteSuccess="onFavoriteSuccess" />
        <!-- 浣滃搧闆嗛€夋嫨鍣?-->
        <portfolio-selector :show="showPortfolioModal" :post-id="post && post._id ? post._id : ''" @hide="hidePortfolioModal" @portfolioSuccess="onPortfolioSuccess" />
        <!-- 鍒嗕韩寮圭獥锛堜粎璇楁瓕甯栧瓙鏄剧ず锛?-->
        <share-modal
            v-if="post && post.isPoem"
            :show="showShareModal"
            :image-url="shareImageUrl"
            :longpress-menu-enabled="shareLongpressMenuEnabled"
            :share-config="shareConfig"
            :preview-text="post.content ? (post.content.split('\n')[0] || '春花秋月何时了') : '春花秋月何时了'"
            :color-palettes="colorPalettes"
            :poem-lines="poemLines"
            @hide="hideShareModal"
            @longpress="onImageLongPress"
            @load="onShareImageLoad"
            @error="onShareImageError"
            @save="saveShareImage"
            @font-size-preview="onFontSizePreview"
            @font-family-preview="onFontFamilyPreview"
            @font-settings-change="onFontSettingsChange"
            @color-change="onColorChange"
            @force-regenerate="forceRegenerateCanvas"
        />
        <!-- 隐藏的 canvas 用于生成分享图片，增加 id 便于 H5 兜底导出 -->
        <canvas id="shareCanvas" canvas-id="shareCanvas" style="position: fixed; top: -9999px; left: -9999px; width: 750px; border-radius: 15px; overflow: hidden;" :style="{ height: shareCanvasHeight + 'px' }"></canvas>
      <!-- 璇勮鍖恒€佸叾瀹冨唴瀹?-->
    <view v-if="showEditModal" class="edit-modal-mask">
        <view class="edit-modal">
            <view class="edit-modal-title">缂栬緫甯栧瓙</view>
            <input class="edit-title-input" :value="editForm.title" data-field="title" @input="onEditInput" placeholder="璇疯緭鍏ユ爣棰? />
            <textarea class="edit-content-textarea" :value="editForm.content" data-field="content" @input="onEditInput" placeholder="璇疯緭鍏ユ鏂? />
            <view class="edit-modal-actions">
                <button class="modal-cancel" @tap="onCancelEdit">取消</button>
                <button class="modal-confirm" @tap="onSaveEdit">淇濆瓨</button>
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
// 宸ュ叿鍑芥暟瀵煎叆
import { hydrateTempUrls, warmTempUrlsFromPosts } from '@/_utils/hydrate-temp-urls';
import fileUrlCache from '@/_utils/file-url-cache';
import likeIcon from '@/utils/likeIcon';
import { togglePostLike } from '@/utils/likeService.js';
import { previewImage } from '@/utils/imagePreview.js';
import { formatRelativeTime } from '@/utils/time.js';
import avatarCache from '@/utils/avatarCache';
import followCache from '@/utils/followCache';
import { cloudCall } from '@/utils/cloudCall.js';
import { uploadFile } from '@/utils/uploader.js';
import postGalleryMixin from '@/mixins/postGallery.js';
import { getCurrentUserId } from '@/utils/auth.js';
import { calculateActualLines as calcCanvasLines, wrapText, clampText } from '@/utils/canvasText.js';
import { drawImageAsync, calculateActualLines as calcLines, wrapText as wrapCanvasText, calculateShareCardHeight, drawShareCardContent, exportShareCanvas } from '@/utils/shareCanvas.js';
import { processComments, mergeCommentUiState, validateCommentInput, processCommentImages, findComment, calculateRemainingChars } from '@/utils/commentUtils.js';
import { generateShareImageName, isValidImageDataUrl, base64ToArrayBuffer, saveImageToAlbum, createTempFilePath, compressImage, getImageInfo } from '@/utils/shareImage.js';
import { syncLikeStatusForPosts, getLatestLikeStatus } from '@/utils/likeStatusSync.js';
import { flushViewQueue } from '@/utils/viewEvents.js';
import { colorPalettes } from '@/utils/colorPalettes.js';
import { poemLines } from '@/utils/poemLines.js';
import { getCurrentPlatform } from '@/utils/platformDetector.js';
import { requestAndroidStoragePermission } from '@/utils/permissions.js';
import { emitCommentCountChanged, emitPostUpdated } from '@/utils/events.js';
import fontManager from '@/utils/fontManager.js'; // 娣诲姞fontManager瀵煎叆
import { checkContentSafe, checkTextSafe, shouldModerate } from '@/utils/contentModeration.js';
import { getShareAppMessageConfig, getShareTimelineConfig } from '@/utils/shareHelper.js';
// API鍑芥暟瀵煎叆
import { getPostDetail, updatePostContent, togglePostFavorite, recordPostView } from '@/api-cache/post.js';
import { getComments, submitComment, deleteComment, likeComment } from '@/api-cache/comment.js';
import { checkFollowStatus, toggleFollowStatus } from '@/api-cache/following.js';
// pages/post-detail/post-detail.js
const app = getApp();
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
    computed: {
        // 鏄惁鍙互璺宠浆鍒拌瘲浜轰富椤碉紙闈炲師鍒涜瘲涓斾綔鑰呭悕涓庡彂甯冪敤鎴锋樀绉颁笉鍚岋級
        canGoToPoetProfile() {
            if (!this.post || !this.post.author) return false;
            if (this.post.isOriginal) return false;
            const poetName = this.post.author;
            const authorName = this.post.authorName || this.post.authorNameSnapshot || '';
            return poetName.trim() !== authorName.trim();
        }
    },
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
            shareImageFilePath: '',
            shareCanvasHeight: 1000,
            shareImageRetryCount: 0,
            shareRenderToken: 0,
            shareConfig: {
                fontSize: 38,
                titleFontSize: 46,
                fontFamily: '姹囨枃鏄庢湞',
                backgroundColor: '#FFFFFF',
                textColor: '#000000',
                fontScale: 1.0
            },
            regenerateTimeout: null,
            colorPalettes: colorPalettes,
            poemLines: poemLines,
            isInputExpanded: false,
            currentScrollTop: 0,
            isFocus: false,
            keyboardHeight: 0,
            viewStartTime: 0,
            currentPostId: null,
            isFavorited: false,
            favoriteButtonText: '鏀惰棌',
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
            commentTextareaMinHeight: 90,
            commentTextareaMaxHeight: 175,
            commentTextareaHeight: 90,
            // 是否启用原生长按菜单（仅小程序有效）
            shareLongpressMenuEnabled: false,
            fontManager: null
        };
    },
    onLoad: function (options) {
        this.initializeCommentTextareaMetrics();
        const postId = options.id;
        if (postId) {
            this.setData({
                currentPostId: postId
            });
            this.loadPostDetail(postId);
            // 鐩戝惉鍏ㄥ眬鐐硅禐鍙樻洿锛屽疄鏃跺悓姝ュ綋鍓嶅笘瀛愮殑鐐硅禐鐘舵€?
            try { uni.$on && uni.$on('like-changed', this.onGlobalLikeChanged); } catch (_) {}
            // 鐩戝惉璇勮鐐硅禐鍙樻洿
            try { uni.$on && uni.$on('comment-like-changed', this.onGlobalCommentLikeChanged); } catch (_) {}
        } else {
            this.setData({
                isLoading: false,
                isCommentLoading: false
            });
            uni.showToast({
                title: '鏃犳晥鐨勫笘瀛怚D',
                icon: 'none'
            });
        }
        // 骞冲彴寮€鍏筹細浠呭皬绋嬪簭鍚敤绯荤粺闀挎寜鑿滃崟
        try {
            // #ifdef MP-WEIXIN
            this.shareLongpressMenuEnabled = true;
            // #endif
        } catch (e) {}
        // 娉ㄥ唽閿洏楂樺害鐩戝惉
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
            console.warn('閿洏楂樺害鐩戝惉璁剧疆失败:', e);
        }
        // #endif
        // 鍒濆鍖栧瓧浣撶鐞嗗櫒
        this.fontManager = fontManager;
    },
    onShow: function () {
        this.setData({
            viewStartTime: Date.now()
        });
        // 鍚屾褰撳墠甯栧瓙鐨勭偣璧炵姸鎬?
        this.syncCurrentPostLikeStatus();
    },
    onPageScroll: function(e) {
        // 鎸佺画璁板綍褰撳墠婊氬姩浣嶇疆
        this.currentScrollTop = e.scrollTop || 0;
    },
    onUnload: function () {
        try { flushViewQueue(); } catch (e) {}
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
        try { flushViewQueue(); } catch (e) {}
    },
    methods: {
        // 澶勭悊鍖垮悕澶村儚鐐瑰嚮浜嬩欢鐨勫嚱鏁?
        handleAnonymousAvatarClick(e) {
            if (e && e.preventDefault) {
                e.preventDefault();
            }
            if (e && e.stopPropagation) {
                e.stopPropagation();
            }
            // 鏄剧ず鎻愮ず淇℃伅
            uni.showToast({
                title: '??????????',
                icon: 'none'
            });
        },
        // 鍒ゆ柇璁ㄨ鍙ュ瓙缁勬槸鍚︽湁鏈夋晥鍙ュ瓙锛岄伩鍏嶆覆鏌撶┖鐏板崱鐗?
        hasDiscussionSentences(group) {
            return (
                group &&
                Array.isArray(group.sentences) &&
                group.sentences.some((line) => (line || '').trim().length > 0)
            );
        },
        // 鍒ゆ柇鏁翠釜甯栧瓙鏄惁鏈夋湁鏁堢殑璁ㄨ鍐呭锛堝彞瀛愭垨璇勮锛夛紝鐢ㄤ簬鍐冲畾鏄惁灞曠ず璁ㄨ鍧?
        hasValidDiscussionGroups(post) {
            if (!post || !Array.isArray(post.sentenceGroups)) return false;
            return post.sentenceGroups.some(g => {
                const hasLines = Array.isArray(g.sentences) && g.sentences.some(l => (l || '').trim().length > 0);
                const hasComment = g && g.comment && g.comment.trim().length > 0;
                return hasLines || hasComment;
            });
        },
        // 璺ㄩ〉鍚屾锛氱洃鍚?like-changed 鐨勫鐞?
        onGlobalLikeChanged: function (e = {}) {
            try {
                const postId = e.postId;
                if (!postId || !this.post || !this.post._id) return;
                if (postId !== this.post._id) return;
                const votes = typeof e.votes === 'number' ? e.votes : (this.post.votes || 0);
                const isLiked = typeof e.isLiked === 'boolean' ? e.isLiked : !!this.post.isVoted;
                this.setData({
                    'post.votes': votes,
                    'post.isVoted': isLiked,
                    'post.likeIcon': likeIcon.getLikeIcon(votes, isLiked)
                });
            } catch (_) {}
        },
        // 鎺ユ敹澶栭儴璇勮鐐硅禐浜嬩欢杩涜鏈〉鍚屾
        onGlobalCommentLikeChanged: function (e = {}) {
            try {
                const { commentId, likes, liked } = e || {};
                if (!commentId) return;
                const comments = this.comments || [];
                const { comment } = this.findComment(comments, commentId);
                if (!comment) return;
                comment.likes = typeof likes === 'number' ? likes : (comment.likes || 0);
                comment.liked = typeof liked === 'boolean' ? liked : !!comment.liked;
                comment.likeIcon = likeIcon.getLikeIcon(comment.likes, comment.liked);
                this.setData({ comments });
            } catch (_) {}
        },
        // 鍚屾褰撳墠甯栧瓙鐨勭偣璧炵姸鎬?
        syncCurrentPostLikeStatus: function () {
            try {
                if (!this.post || !this.post._id) {
                    return;
                }
                const postId = this.post._id;
                // 浣跨敤鍚屾宸ュ叿鍚屾褰撳墠甯栧瓙鐨勭偣璧炵姸鎬?
                const syncResult = syncLikeStatusForPosts([postId]);
                if (syncResult.success && syncResult.updated > 0) {
                    // 鏇存柊褰撳墠甯栧瓙鐨勬樉绀虹姸鎬?
                    const latestStatus = getLatestLikeStatus(postId);
                    if (latestStatus) {
                        const newLikeIcon = likeIcon.getLikeIcon(latestStatus.votes, latestStatus.isVoted);
                        this.setData({
                            'post.votes': latestStatus.votes,
                            'post.isVoted': latestStatus.isVoted,
                            'post.likeIcon': newLikeIcon
                        });
                    }
                } else if (syncResult.errors.length > 0) {
                    console.warn('銆愬笘瀛愯鎯呫€戠偣璧炵姸鎬佸悓姝ュ嚭鐜伴敊璇?', syncResult.errors);
                }
            } catch (err) {
                console.error('銆愬笘瀛愯鎯呫€戝悓姝ュ綋鍓嶅笘瀛愮偣璧炵姸鎬佸け璐?', err);
            }
        },
        loadPostDetail: function (postId) {
            this.setData({
                isCommentLoading: true
            });
            getPostDetail(postId)
                .then(async (detail) => {
                    if (detail && detail.post) {
                        let post = detail.post;
                        post.formattedCreateTime = this.formatTime(post.createTime);
                        post.likeIcon = likeIcon.getLikeIcon(post.votes || 0, post.isVoted || false);
                        // 灏?cloud:// 鏄犲皠涓哄彲璁块棶 URL锛屽苟棰勭儹
                        await hydrateTempUrls([post]);
                        warmTempUrlsFromPosts([post]);
                        const finalCommentCount = detail.commentCount || post.commentCount || 0;
                        post.commentCount = finalCommentCount;
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
                            title: '甯栧瓙鍔犺浇失败',
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
                        title: '缃戠粶閿欒',
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
                .then(async (result) => {
                    if (result && result.comments) {
                        // 浣跨敤鏂扮殑璇勮澶勭悊宸ュ叿鍑芥暟
                        const comments = mergeCommentUiState(processComments(result.comments), this.comments || []);
                        const newCommentCount = result.commentCount || comments.length;
                        const shouldUpdateCount = newCommentCount > this.commentCount;
                        const resolvedCommentCount = shouldUpdateCount ? newCommentCount : this.commentCount;
                        this.setData({
                            comments: comments,
                            commentCount: resolvedCommentCount,
                            'post.commentCount': resolvedCommentCount
                        });
                    } else {
                        uni.showToast({
                            title: '璇勮鍔犺浇失败',
                            icon: 'none'
                        });
                    }
                })
                .catch((err) => {
                    console.error('Failed to get comments', err);
                    uni.showToast({
                        title: '缃戠粶閿欒',
                        icon: 'none'
                    });
                })
                .finally(() => {
                    this.setData({
                        isCommentLoading: false
                    });
                });
        },
        getCurrentUserInfo: function () {
            if (app && app.globalData && app.globalData.userInfo) {
                return app.globalData.userInfo;
            }
            try {
                return uni.getStorageSync('userInfo') || null;
            } catch (_) {
                return null;
            }
        },
        buildSubmittedComment: function (submittedComment, fallback = {}) {
            const userInfo = this.getCurrentUserInfo() || {};
            const isAnonymous = typeof (submittedComment && submittedComment.isAnonymous) === 'boolean'
                ? submittedComment.isAnonymous
                : !!(this.post && this.post.isAnonymous);
            const fallbackImageUrls = Array.isArray(fallback.imageUrls) ? fallback.imageUrls.filter(Boolean) : [];
            const fallbackOriginalImageUrls = Array.isArray(fallback.originalImageUrls)
                ? fallback.originalImageUrls.filter(Boolean)
                : fallbackImageUrls;
            const nextComment = {
                _id: submittedComment && submittedComment._id ? submittedComment._id : `comment_${Date.now()}`,
                postId: submittedComment && submittedComment.postId ? submittedComment.postId : (fallback.postId || ''),
                parentId: submittedComment && Object.prototype.hasOwnProperty.call(submittedComment, 'parentId')
                    ? submittedComment.parentId
                    : (fallback.parentId || null),
                replyToAuthorName: submittedComment && Object.prototype.hasOwnProperty.call(submittedComment, 'replyToAuthorName')
                    ? submittedComment.replyToAuthorName
                    : (fallback.replyToAuthorName || null),
                _openid: submittedComment && submittedComment._openid ? submittedComment._openid : (this.getCurrentUserId() || ''),
                content: submittedComment && typeof submittedComment.content === 'string' ? submittedComment.content : (fallback.content || ''),
                createTime: submittedComment && submittedComment.createTime ? submittedComment.createTime : new Date(),
                imageUrls: Array.isArray(submittedComment && submittedComment.imageUrls) && submittedComment.imageUrls.length > 0
                    ? submittedComment.imageUrls
                    : fallbackImageUrls,
                originalImageUrls: Array.isArray(submittedComment && submittedComment.originalImageUrls) && submittedComment.originalImageUrls.length > 0
                    ? submittedComment.originalImageUrls
                    : fallbackOriginalImageUrls,
                likes: submittedComment && typeof submittedComment.likes === 'number' ? submittedComment.likes : 0,
                liked: !!(submittedComment && submittedComment.liked),
                canDelete: submittedComment && typeof submittedComment.canDelete === 'boolean' ? submittedComment.canDelete : true,
                isAnonymous: isAnonymous,
                authorName: submittedComment && submittedComment.authorName
                    ? submittedComment.authorName
                    : (isAnonymous ? '鍖垮悕鐢ㄦ埛' : (userInfo.nickName || '寰俊鐢ㄦ埛')),
                authorAvatar: submittedComment && submittedComment.authorAvatar
                    ? submittedComment.authorAvatar
                    : (isAnonymous ? '/static/images/avatar.png' : (userInfo.avatarUrl || '/static/images/avatar.png')),
                replies: Array.isArray(submittedComment && submittedComment.replies) ? submittedComment.replies : []
            };
            return processComments(nextComment);
        },
        appendSubmittedComment: function (submittedComment, fallback = {}) {
            const nextComment = this.buildSubmittedComment(submittedComment, fallback);
            const comments = (this.comments || []).map((comment) => ({
                ...comment,
                replies: Array.isArray(comment.replies) ? comment.replies.slice() : []
            }));
            if (nextComment.parentId) {
                const parentComment = comments.find((comment) => comment && comment._id === nextComment.parentId);
                if (!parentComment) {
                    return { comments, inserted: false };
                }
                const replies = Array.isArray(parentComment.replies) ? parentComment.replies.slice() : [];
                replies.push(nextComment);
                parentComment.replies = replies;
                parentComment.showAllReplies = true;
                return { comments, inserted: true };
            }
            comments.push(nextComment);
            return { comments, inserted: true };
        },
        onVote: function (event) {
            const postId = event.currentTarget.dataset.postid;
            if (this.votingInProgress) {
                return;
            }
            const post = this.post;
            const originalVotes = post.votes;
            const originalIsVoted = post.isVoted;
            const newVotes = originalIsVoted ? originalVotes - 1 : originalVotes + 1;
            const newIsVoted = !originalIsVoted;
            const newLikeIcon = likeIcon.getLikeIcon(newVotes, newIsVoted);
            // 鎵归噺鏇存柊锛氭爣璁版姇绁ㄨ繘琛屼腑 + 涔愯鏇存柊甯栧瓙鐘舵€?
            this.setData({
                votingInProgress: true,
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
                console.error('銆愬笘瀛愯鎯呯偣璧炪€戣皟鐢?likeService 失败', error);
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
                    title: '??????',
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
                    title: '??????',
                    icon: 'none'
                });
                return;
            }
            // 鏄剧ず浣滃搧闆嗛€夋嫨鍣?
            this.setData({
                showPortfolioModal: true
            });
            // 寤惰繜涓€涓嬬‘淇濇暟鎹凡璁剧疆
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
                favoriteButtonText: '???',
                favoriteButtonClass: 'favorite-button favorited'
            });
            uni.showToast({
                title: '????',
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
        // 鍒嗕韩鐩稿叧鏂规硶
        onShare: function () {
            if (!this.post || !this.post._id) {
                uni.showToast({
                    title: '??????',
                    icon: 'none'
                });
                return;
            }
            if (!this.post.isPoem) {
                uni.showToast({
                    title: '?????????',
                    icon: 'none'
                });
                return;
            }
            // 鍒濆鍖杝hareConfig浣跨敤甯栧瓙鐨勫疄闄呴鑹?
            this.shareConfig.backgroundColor = this.post.backgroundColor || '#FFFFFF';
            this.shareConfig.textColor = this.post.textColor || '#000000';
            // 鏄剧ず鍒嗕韩寮圭獥锛岄噸缃浘鐗嘦RL锛屽苟绔嬪嵆寮€濮嬬敓鎴愬浘鐗?
            this.setData({
                showShareModal: true,
                shareImageUrl: '',
                shareImageFilePath: '',
                shareImageRetryCount: 0,
                shareCanvasHeight: 4000
            });

            // 绔嬪嵆寮€濮嬬敓鎴愬浘鐗?
            this.generateShareImage();
        },
        hideShareModal: function () {
            this.shareRenderToken += 1;
            this.setData({
                showShareModal: false,
                shareImageFilePath: ''
            });
        },
        generateShareImage: function () {
            // 鍏堝姞杞藉瓧浣擄紝鐒跺悗缁樺埗Canvas
            const renderToken = (this.shareRenderToken || 0) + 1;
            this.shareRenderToken = renderToken;
            this.loadFontAndDraw(renderToken);
        },
        loadFontAndDraw: async function (renderToken) {
            const fontFamily = this.shareConfig.fontFamily || '姹囨枃鏄庢湞';
            console.log('銆恜ost-detail銆戝紑濮嬪姞杞藉瓧浣?', fontFamily);
            if (fontFamily === 'system') {
                this.shareConfig.fontScale = 1.0;
                await new Promise(r => setTimeout(r, 50));
                this.drawCanvas(renderToken);
                return;
            }
            try {
                // 浣跨敤fontManager纭繚瀛椾綋鍙敤锛堣嚜鍔ㄤ笅杞藉拰缂撳瓨锛?
                await this.fontManager.ensureFontAvailable(fontFamily, (progress, loaded, total) => {
                    console.log(`銆恜ost-detail銆戝瓧浣撲笅杞借繘搴? ${progress}% (${loaded}/${total})`);
                    // 鍙互鍦ㄨ繖閲屾樉绀轰笅杞借繘搴︾粰鐢ㄦ埛
                });

                console.log('銆恜ost-detail銆戝瓧浣撳姞杞芥垚鍔?', fontFamily);

                // 瀛椾綋缂╂斁绯绘暟鏄犲皠琛?- 瑙ｅ喅涓嶅悓瀛椾綋鍦ㄧ浉鍚屽瓧鍙蜂笅澶у皬宸紓闂
                const fontScaleMap = {
                    '姹囨枃鏄庢湞': 1.0,
                    '?????': 1.0,
                    '榫欒棌浣?': 1.0,
                    '灏忓皬鐨撲綋': 1.0,
                    '鍗楄タ闆呰嚧榛?': 1.0,
                    '瀛椾綋鍦堟鎰忓悏绁ュ畫': 1.0
                };

                // 搴旂敤瀛椾綋缂╂斁绯绘暟鍒皊hareConfig
                const fontScale = fontScaleMap[fontFamily] || 1.0;
                this.shareConfig.fontScale = fontScale;

                // 銆愬叧閿€戠瓑寰呭瓧浣撴覆鏌撳氨缁紝App绔渶瑕佹洿闀挎椂闂?
                await new Promise(r => setTimeout(r, 150));

                this.drawCanvas(renderToken);

            } catch (error) {
                console.error('銆恜ost-detail銆戝瓧浣撳姞杞藉け璐?', fontFamily, error);

                // 鍥為€€鍒伴粯璁ゅ瓧浣?
                this.shareConfig.fontFamily = 'system';
                this.shareConfig.fontScale = 1.0;
                uni.showToast({
                    title: '??????????????',
                    icon: 'none',
                    duration: 2000
                });
                // 鍗充娇瀛椾綋鍔犺浇失败锛屼篃缁х画缁樺埗
                await new Promise(r => setTimeout(r, 150));
                this.drawCanvas(renderToken);
            }
        },




        drawCanvas: async function (renderToken) {
            try {
                if (renderToken !== this.shareRenderToken) return;
                const canvasWidth = 750;
                // 绛惧悕URL宸蹭粠浜戝嚱鏁拌繑鍥烇紝鐩存帴浣跨敤post.authorSignature锛堝尶鍚嶅笘瀛愭垨闈炲師鍒涜瘲姝屼笉鏄剧ず绛惧悕锛?
                const shouldShowSignature = (!!this.post && !this.post.isAnonymous && !(this.post.isPoem && this.post.isOriginal === false));

                // 銆愪紭鍖栥€戜娇鐢ㄧ嫭绔嬫ā鍧楄绠桟anvas楂樺害
                const measureCtx = uni.createCanvasContext('shareCanvas', this);
                const heightResult = await calculateShareCardHeight({
                    measureCtx,
                    post: this.post,
                    shareConfig: this.shareConfig,
                    canvasWidth,
                    shouldShowSignature
                });

                const canvasHeight = heightResult.canvasHeight;
                if (renderToken !== this.shareRenderToken) return;
                console.log('銆恉rawCanvas銆戣绠楅珮搴?', canvasHeight);
                // 銆愬叧閿慨澶嶃€戝厛鏇存柊Canvas楂樺害锛岀瓑寰匘OM鏇存柊瀹屾垚
                try { this.setData && this.setData({ shareCanvasHeight: canvasHeight }); } catch(_) { this.shareCanvasHeight = canvasHeight; }
                if (this.$nextTick) { await new Promise(r => this.$nextTick(r)); }
                // 棰濆绛夊緟纭繚Canvas灏哄宸叉洿鏂帮紙App绔渶瑕佹洿闀挎椂闂达級
                await new Promise(r => setTimeout(r, 100));
                if (renderToken !== this.shareRenderToken) return;

                // 銆愬叧閿慨澶嶃€慍anvas楂樺害鏇存柊鍚庯紝閲嶆柊鍒涘缓涓婁笅鏂囪繘琛岀粯鍒?
                const ctx = uni.createCanvasContext('shareCanvas', this);
                if (!ctx) {
                    console.error('[post-detail] failed to create canvas context');
                    uni.showToast({ title: 'Canvas????', icon: 'none' });
                    return;
                }
                // 銆愪慨澶嶃€戝厛娓呯┖Canvas锛岄伩鍏嶆畫鐣?
                ctx.clearRect(0, 0, canvasWidth, canvasHeight);
                // 銆愪紭鍖栥€戜娇鐢ㄧ嫭绔嬫ā鍧楃粯鍒跺垎浜崱鐗囧唴瀹?
                await drawShareCardContent({
                    ctx,
                    post: this.post,
                    shareConfig: this.shareConfig,
                    canvasWidth,
                    canvasHeight,
                    shouldShowSignature,
                    ...heightResult
                });
                console.log('銆恜ost-detail銆戝紑濮嬫墽琛宒raw');
                ctx.draw(false, () => {
                    if (renderToken !== this.shareRenderToken) return;
                    console.log('[post-detail] canvas draw complete, exporting image');

                    // 鍐嶆寤惰繜纭繚缁樺埗瀹屾垚
                    setTimeout(() => {
                        if (renderToken !== this.shareRenderToken) return;
                        this.exportCanvas(canvasWidth, canvasHeight, renderToken);
                    }, 150); // 澧炲姞涓€涓井灏忓欢杩燂紝搴斿浣庢€ц兘璁惧
                });
            } catch (error) {
                console.error('銆恜ost-detail銆戠粯鍒惰繃绋嬩腑鍑虹幇涓ラ噸閿欒:', error);
                uni.showToast({ title: '图片生成失败，请重试', icon: 'none' });
            }
        },
        // 鐙珛鐨勫鍑哄嚱鏁?
        exportCanvas: async function(canvasWidth, canvasHeight, renderToken) {
            if (renderToken !== this.shareRenderToken) return;
            console.log('[Canvas] export start', { canvasWidth, canvasHeight });
            try {
                const exportResult = await exportShareCanvas({
                    canvasId: 'shareCanvas',
                    context: this,
                    width: canvasWidth,
                    height: canvasHeight,
                    fileType: 'jpg',
                    quality: 0.9,
                    scales: [2, 2, 1.5, 1],
                    retryDelayMs: 120
                });
                if (renderToken !== this.shareRenderToken) return;
                const raw = (exportResult && exportResult.tempFilePath) || '';
                let imageUrl = raw;
                // H5 绔睍绀烘椂杩藉姞鏃堕棿鎴抽伩鍏嶅浘鐗囩紦瀛橈紱灏忕▼搴?APP 闇€淇濈暀鍘熷涓存椂鏂囦欢璺緞鐢ㄤ簬淇濆瓨銆?
                // #ifdef H5
                if (raw && !raw.startsWith('data:') && !/^blob:/i.test(raw)) {
                    const cacheBuster = Date.now();
                    imageUrl = raw + ((raw.indexOf('?') > -1 ? '&' : '?') + '_' + cacheBuster);
                }
                // #endif
                uni.hideLoading();
                this.setData({
                    shareImageUrl: imageUrl,
                    shareImageFilePath: raw
                });
                console.log('[Canvas] export success', { scale: exportResult.scale, imageUrl, raw });
            } catch (err) {
                if (renderToken !== this.shareRenderToken) return;
                console.error('[Canvas] export failed', err);
                uni.hideLoading();
                uni.showToast({ title: '图片导出失败', icon: 'none' });
            }
        },
        onImageLongPress: function () {
            console.log('[post-detail] user long pressed image');
            // App 绔病鏈夌郴缁熼暱鎸夎彍鍗曪紝杩欓噷鐩存帴瑙﹀彂淇濆瓨
            // #ifdef APP-PLUS
            this.saveShareImage();
            // #endif
            // #ifndef APP-PLUS
            uni.showToast({ title: '?????', icon: 'none' });
            // #endif
        },
        onShareImageLoad: function () {
            console.log('[post-detail] share image loaded');

            // 延迟检查，确保图片完全渲染
            setTimeout(() => {
                this.checkImageDOMState();
            }, 100);
        },

        // 妫€鏌ュ浘鐗嘍OM鐘舵€?
        checkImageDOMState: function () {
            if (this.$refs.shareImage) {
                const img = this.$refs.shareImage;

                // 妫€鏌OM鍏冪礌鏄惁鏈夋晥
                if (!img || typeof img !== 'object') {
                    this.refreshCommentListIfNeeded();
                }

                console.log('銆恜ost-detail銆戝浘鐗嘍OM鐘舵€佹鏌?', {
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

                // 濡傛灉灏哄閮芥槸undefined锛屽皾璇曞绉嶈В鍐虫柟妗?
                if (!img.offsetWidth || !img.offsetHeight) {
                    console.log('[post-detail] image size unavailable, trying fallback strategies');

                    // 鏂规1锛氶€氳繃CSS绫诲己鍒惰缃浘鐗囨牱寮忥紝閬垮厤鐩存帴淇敼DOM
                    if (img.classList && typeof img.classList.add === 'function') {
                        img.classList.add('force-image-display');
                        console.log('[post-detail] added force-image-display class');
                    } else {
                        // 濡傛灉classList涓嶅彲鐢紝瀹夊叏鍦拌缃牱寮?
                        console.log('[post-detail] classList unavailable, applying safe styles');
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
                                console.log('[post-detail] image style fallback applied');
                            } else {
                                console.log('[post-detail] img.style unavailable, skipping style fallback');
                            }
                        } catch (error) {
                            console.error('銆恜ost-detail銆戣缃牱寮忔椂鍑洪敊:', error);
                        }
                    }

                    // 鏂规2锛氭鏌ase64鏁版嵁鏄惁鏈夋晥
                    if (img.src && img.src.startsWith('data:image/')) {
                        console.log('銆恜ost-detail銆慴ase64鏁版嵁闀垮害:', img.src.length);
                        console.log('銆恜ost-detail銆慴ase64鏁版嵁鍓嶇紑:', img.src.substring(0, 100));

                        // 鏂规3锛氫笉鐩存帴淇敼img.src锛岃€屾槸閫氳繃Vue鐨勫搷搴斿紡绯荤粺
                        console.log('銆恜ost-detail銆戞娴嬪埌base64鏁版嵁锛屽噯澶囬噸鏂拌缃畇hareImageUrl');
                        const originalSrc = this.shareImageUrl;
                        this.setData({
                            shareImageUrl: ''
                        });
                        setTimeout(() => {
                            this.setData({
                                shareImageUrl: originalSrc
                            });
                            console.log('[post-detail] reset shareImageUrl via Vue and rechecking size');
                        }, 100);
                    }

                    // 鏂规4锛氬鏋滆繕鏄笉琛岋紝灏濊瘯浣跨敤涓存椂鏂囦欢璺緞
                    setTimeout(() => {
                        if (!img.offsetWidth || !img.offsetHeight) {
                            console.log('[post-detail] size still unavailable after fallback, trying temp file conversion');
                            this.tryConvertToTempFile();
                        }
                    }, 200);
                }

                // 鍏煎鎬ф鏌ワ細鍙湪鏀寔closest鏂规硶鐨勭幆澧冧腑浣跨敤
                try {
                    if (typeof img.closest === 'function') {
                        const modal = img.closest('.share-modal');
                        const overlay = img.closest('.share-modal-overlay');

                        console.log('銆恜ost-detail銆戝鍣ㄥ昂瀵告鏌?', {
                            modalWidth: modal ? modal.offsetWidth : 'N/A',
                            modalHeight: modal ? modal.offsetHeight : 'N/A',
                            overlayWidth: overlay ? overlay.offsetWidth : 'N/A',
                            overlayHeight: overlay ? overlay.offsetHeight : 'N/A'
                        });
                    } else {
                        console.log('[post-detail] closest is unavailable, skipping container size check');
                    }
                } catch (error) {
                    console.log('銆恜ost-detail銆戝鍣ㄥ昂瀵告鏌ュけ璐?', error.message);
                }
            }
        },
        // 跨端保存分享图片
        saveShareImage: function () {
            const url = this.shareImageUrl;
            const filePath = this.shareImageFilePath;
            const isRemoteUrl = (value) => /^https?:\/\//i.test(value || '');
            const isDataUrl = (value) => typeof value === 'string' && value.startsWith('data:');
            const isLocalFilePath = (value) => {
                if (!value || typeof value !== 'string') return false;
                return /^(wxfile:\/\/|file:\/\/|blob:|\/_doc\/|\/_www\/|\/?storage\/|[A-Za-z]:\\|\/data\/|\/var\/|tmp\/|\.\/tmp\/)/i.test(value)
                    || (!isRemoteUrl(value) && !isDataUrl(value));
            };
            if (!url) {
                uni.showToast({ title: '??????', icon: 'none' });
                return;
            }
            const toastOK = (msg) => uni.showToast({ title: msg || '???', icon: 'success' });
            const toastFail = (msg) => uni.showToast({ title: msg || '????', icon: 'none' });
            // 鏉冮檺寮曞锛堝皬绋嬪簭/APP锛?
            const handlePermissionFail = () => {
                uni.showModal({
                    title: '??????',
                    content: '??????????????????',
                    confirmText: '???',
                    success: (r) => {
                        if (r.confirm && uni.openSetting) {
                            uni.openSetting({});
                        }
                    }
                });
            };
            // 鐪熸鎵ц淇濆瓨锛堝皬绋嬪簭/APP锛?
            const saveFromPath = (filePath) => {
                // #ifdef MP-WEIXIN || APP-PLUS
                uni.saveImageToPhotosAlbum({
                    filePath,
                    success: () => toastOK('宸蹭繚瀛樺埌鐩稿唽'),
                    fail: (err) => {
                        console.error('saveImageToPhotosAlbum 失败:', err);
                        const msg = (err && err.errMsg) || '';
                        if (/auth|authorize|denied|permission/i.test(msg)) {
                            handlePermissionFail();
                        } else {
                            toastFail('????');
                        }
                    }
                });
                // #endif
            };
            // H5锛氫笅杞藉埌鏈湴
            // #ifdef MP-WEIXIN || APP-PLUS
            if (filePath && isLocalFilePath(filePath)) {
                saveFromPath(filePath);
                return;
            }
            // #endif
            const saveOnH5 = (finalUrl) => {
                // #ifdef H5
                try {
                    if (finalUrl.startsWith('data:')) {
                        // dataURL 鈫?blob 鈫?a[download]
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
                        toastOK('?????');
                    } else {
                        const a = document.createElement('a');
                        a.href = finalUrl;
                        a.download = 'poementer.png';
                        document.body.appendChild(a);
                        a.click();
                        document.body.removeChild(a);
                        toastOK('?????');
                    }
                } catch (e) {
                    console.error('H5 淇濆瓨失败锛屽皾璇曟墦寮€鏂扮獥鍙?', e);
                    window.open(finalUrl, '_blank');
                }
                // #endif
            };
            // 缁熶竴鍏ュ彛锛氭牴鎹?URL 褰㈡€佸垎鏀?
            if (url.startsWith('data:')) {
                // base64 鈫?涓存椂鏂囦欢
                // #ifdef MP-WEIXIN || APP-PLUS
                uni.base64ToTempFilePath({
                    base64Data: url,
                    success: (res) => {
                        this.setData({ shareImageFilePath: res.filePath });
                        saveFromPath(res.filePath);
                    },
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
                // 杩滅▼ URL 鍏堜笅杞?
                // #ifdef MP-WEIXIN || APP-PLUS
                uni.downloadFile({
                    url,
                    success: (res) => {
                        if (res.statusCode === 200) {
                                const downloadedPath = res.tempFilePath || res.filePath;
                                if (downloadedPath) {
                                    this.setData({ shareImageFilePath: downloadedPath });
                                    saveFromPath(downloadedPath);
                                } else {
                                    console.error('downloadFile succeeded without file path:', res);
                                    toastFail('save failed');
                                }
                        } else {
                            console.error('downloadFile 闈?00:', res.statusCode);
                            toastFail('????');
                        }
                    },
                    fail: (err) => {
                        console.error('downloadFile 失败:', err);
                        toastFail('????');
                    }
                });
                // #endif
                // #ifdef H5
                saveOnH5(url);
                // #endif
            } else {
                // 璁や负鏄湰鍦颁复鏃惰矾寰?
                // #ifdef MP-WEIXIN || APP-PLUS
                if (url && isLocalFilePath(url)) {
                    this.setData({ shareImageFilePath: url });
                }
                saveFromPath(url);
                // #endif
                // #ifdef H5
                saveOnH5(url);
                // #endif
            }
        },
        onShareImageError: function (e) {
            console.error('銆恜ost-detail銆戝垎浜浘鐗囧姞杞藉け璐?', e);
            console.log('銆恜ost-detail銆戝綋鍓峴hareImageUrl:', this.shareImageUrl);
            console.log('銆恜ost-detail銆戝浘鐗嘦RL绫诲瀷:', typeof this.shareImageUrl);
            console.log('銆恜ost-detail銆戝浘鐗嘦RL闀垮害:', this.shareImageUrl ? this.shareImageUrl.length : 0);

            // 濡傛灉鏄痓ase64 URI锛屾鏌ユ牸寮?
            if (this.shareImageUrl && this.shareImageUrl.startsWith('data:')) {
                console.log('銆恜ost-detail銆戞娴嬪埌base64 URI锛屾鏌ユ牸寮?..');
                const isValidBase64 = this.shareImageUrl.match(/^data:image\/[a-zA-Z]*;base64,/);
                if (!isValidBase64) {
                    console.error('銆恜ost-detail銆慴ase64 URI鏍煎紡鏃犳晥');
                } else {
                    console.log('[post-detail] base64 URI format valid');
                }
            }

            // 妫€鏌ユ槸鍚﹀彲浠ラ噸璇?
            if (this.shareImageRetryCount < 2) {
                console.log('銆恜ost-detail銆戝皾璇曢噸鏂扮敓鎴愬浘鐗囷紝閲嶈瘯娆℃暟:', this.shareImageRetryCount + 1);
                this.setData({
                    shareImageRetryCount: this.shareImageRetryCount + 1
                });

                // 寤惰繜閲嶈瘯
                setTimeout(() => {
                    this.generateShareImage();
                }, 1000);
            } else {
                // 濡傛灉閲嶈瘯失败锛屽皾璇曚娇鐢ㄤ笉鍚岀殑鏄剧ず鏂瑰紡
                console.log('[post-detail] retry exhausted, trying alternative display');
                this.tryAlternativeDisplay();
            }
        },
        // 澶囩敤鏄剧ず鏂规
        tryAlternativeDisplay: function () {
            console.log('[post-detail] trying alternative image display');

            // 濡傛灉褰撳墠鏄痓ase64 URI锛屾牴鎹钩鍙颁娇鐢ㄤ笉鍚岀殑澶勭悊鏂瑰紡
            if (this.shareImageUrl && this.shareImageUrl.startsWith('data:')) {
                console.log('[post-detail] detected base64 URI, using alternative display strategy');

                // #ifdef H5
                // H5骞冲彴锛氱洿鎺ヤ娇鐢╞ase64 URI
                console.log('銆恜ost-detail銆慔5澶囩敤鏂规锛氱洿鎺ヤ娇鐢╞ase64 URI');
                // 鍦℉5骞冲彴锛宐ase64 URI搴旇鑳界洿鎺ユ樉绀猴紝濡傛灉杩樻槸失败锛岃鏄庢湁鍏朵粬闂
                uni.showToast({
                    title: '图片显示失败，请重试',
                    icon: 'none'
                });
                // #endif

                // #ifndef H5
                // 闈濰5骞冲彴锛氫娇鐢╱ni.base64ToTempFilePath()杞崲
                console.log('[post-detail] non-H5 fallback: uni.base64ToTempFilePath');
                uni.base64ToTempFilePath({
                    base64Data: this.shareImageUrl,
                    success: (res) => {
                        console.log('銆恜ost-detail銆戝鐢ㄦ柟妗坆ase64杞崲鎴愬姛:', res.filePath);
                        this.setData({
                            shareImageUrl: res.filePath
                        });
                    },
                    fail: (err) => {
                        console.error('銆恜ost-detail銆戝鐢ㄦ柟妗坆ase64杞崲失败:', err);
                        uni.showToast({
                            title: '图片显示失败，请重试',
                            icon: 'none'
                        });
                    }
                });
                // #endif
            } else {
                // 濡傛灉涓嶆槸base64锛屾樉绀洪敊璇俊鎭?
                uni.showToast({
                    title: '图片显示失败，请重试',
                    icon: 'none'
                });
            }
        },
        // 瀛椾綋璁剧疆鐩稿叧浜嬩欢澶勭悊
        onFontSizePreview: function(fontSize) {
            // 瀹炴椂棰勮瀛楀彿鍙樺寲锛屼娇鐢ㄩ槻鎶?            // 纭繚fontScale涔熻姝ｇ‘璁剧疆
            const fontFamily = this.shareConfig.fontFamily || '姹囨枃鏄庢湞';
            const fontScaleMap = {
                '姹囨枃鏄庢湞': 1.0,
                '?????': 1.0,
                '榫欒棌浣?': 1.0,
                '灏忓皬鐨撲綋': 1.0,
                '鍗楄タ闆呰嚧榛?': 1.0,
                '瀛椾綋鍦堟鎰忓悏绁ュ畫': 1.0
            };
            const fontScale = fontScaleMap[fontFamily] || 1.0;

            this.debouncedRegenerateImage({
                ...this.shareConfig,
                fontSize: fontSize,
                titleFontSize: Math.round(fontSize * 1.21), // 鏍囬瀛楀彿姣旀鏂囧ぇ21%
                fontScale: fontScale
            });
        },
        onFontFamilyPreview: function(fontFamily) {
            // 瀹炴椂棰勮瀛椾綋鍙樺寲锛屼娇鐢ㄩ槻鎶?            // 纭繚fontScale涔熻姝ｇ‘璁剧疆
            const fontScaleMap = {
                '姹囨枃鏄庢湞': 1.0,
                '?????': 1.0,
                '榫欒棌浣?': 1.0,
                '灏忓皬鐨撲綋': 1.0,
                '鍗楄タ闆呰嚧榛?': 1.0,
                '瀛椾綋鍦堟鎰忓悏绁ュ畫': 1.0
            };
            const fontScale = fontScaleMap[fontFamily] || 1.0;

            this.debouncedRegenerateImage({
                ...this.shareConfig,
                fontFamily: fontFamily,
                fontScale: fontScale
            });
        },
        onFontSettingsChange: function(settings) {
            this.shareConfig = {
                ...this.shareConfig,
                fontSize: settings.fontSize,
                titleFontSize: Math.round(settings.fontSize * 1.21),
                fontFamily: settings.fontFamily
            };
            this.regenerateShareImage();
        },
        onColorChange: function(colorConfig) {
            this.shareConfig = {
                ...this.shareConfig,
                backgroundColor: colorConfig.backgroundColor,
                textColor: colorConfig.textColor
            };
            this.regenerateShareImage();
        },
        debouncedRegenerateImage: function(tempConfig) {
            clearTimeout(this.regenerateTimeout);
            this.regenerateTimeout = setTimeout(() => {
                this.shareConfig = tempConfig;
                this.regenerateShareImage();
            }, 300);
        },
        regenerateShareImage: function() {
            console.log('?????????????:', this.shareConfig);
            this.shareImageUrl = '';
            this.shareImageFilePath = '';
            this.shareImageRetryCount = 0;
            this.shareCanvasHeight = 1000;
            this.$nextTick(() => {
                setTimeout(() => {
                    this.generateShareImage();
                }, 50);
            });
        },
        forceRegenerateCanvas: function() {
            console.log('?????? Canvas???????');
            this.shareImageUrl = '';
            this.shareImageFilePath = '';
            this.shareImageRetryCount = 0;
            this.shareCanvasHeight = 1000;
            this.$nextTick(() => {
                setTimeout(() => {
                    this.generateShareImage();
                }, 200);
            });
        },
        tryConvertToTempFile: function () {
            if (!this.shareImageUrl || !this.shareImageUrl.startsWith('data:')) {
                return;
            }
            console.log('[post-detail] converting base64 to temp file');
            // #ifndef H5
            uni.base64ToTempFilePath({
                base64Data: this.shareImageUrl,
                success: (res) => {
                    console.log('[post-detail] base64 converted to temp file:', res.filePath);
                    this.setData({
                        shareImageUrl: res.filePath
                    });
                },
                fail: (err) => {
                    console.error('[post-detail] base64 to temp file failed:', err);
                    uni.showToast({
                        title: '??????????',
                        icon: 'none'
                    });
                }
            });
            // #endif
            // #ifdef H5
            try {
                const base64Data = this.shareImageUrl.split(',')[1];
                const binaryString = atob(base64Data);
                const bytes = new Uint8Array(binaryString.length);
                for (let i = 0; i < binaryString.length; i++) {
                    bytes[i] = binaryString.charCodeAt(i);
                }
                const blob = new Blob([bytes], { type: 'image/png' });
                const blobUrl = URL.createObjectURL(blob);
                console.log('[post-detail] blob URL created:', blobUrl);
                this.setData({
                    shareImageUrl: blobUrl
                });
            } catch (error) {
                console.error('[post-detail] blob URL creation failed:', error);
                uni.showToast({
                    title: '??????????',
                    icon: 'none'
                });
            }
            // #endif
        },
        onPortfolioSuccess: function () {
            this.hidePortfolioModal();
            uni.showToast({
                title: '娣诲姞鎴愬姛',
                icon: 'success'
            });
        },
        onCreateDiscussion: function () {
            if (!this.post || !this.post._id) {
                uni.showToast({
                    title: '??????',
                    icon: 'none'
                });
                return;
            }
            console.log('銆恜ost-detail銆戣烦杞埌鍒涘缓璁ㄨ椤甸潰锛宲ostId:', this.post._id);
            uni.navigateTo({
                url: `/pages-tools/create-discussion/create-discussion?postId=${this.post._id}`,
                success: () => {
                    console.log('[post-detail] navigate to create discussion page success');
                },
                fail: (err) => {
                    console.error('銆恜ost-detail銆戣烦杞埌鍒涘缓璁ㄨ椤甸潰失败:', err);
                    uni.showToast({
                        title: '????',
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
            console.error('澶村儚鍔犺浇失败', e);
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
        initializeCommentTextareaMetrics: function () {
            try {
                const systemInfo = uni.getSystemInfoSync ? uni.getSystemInfoSync() : null;
                const rpxToPx = systemInfo && systemInfo.windowWidth ? systemInfo.windowWidth / 750 : 0.5;
                const minHeight = Math.round(180 * rpxToPx);
                const maxHeight = Math.round(350 * rpxToPx);
                this.setData({
                    commentTextareaMinHeight: minHeight,
                    commentTextareaMaxHeight: maxHeight,
                    commentTextareaHeight: minHeight
                });
            } catch (error) {
                console.warn('Failed to initialize comment textarea height:', error);
            }
        },
        resetCommentTextareaHeight: function () {
            const minHeight = this.commentTextareaMinHeight || 90;
            if (this.commentTextareaHeight !== minHeight) {
                this.setData({
                    commentTextareaHeight: minHeight
                });
            }
        },
        onCommentLineChange: function (e) {
            const nextHeight = e && e.detail ? Number(e.detail.height) : NaN;
            if (!Number.isFinite(nextHeight)) {
                return;
            }
            const minHeight = this.commentTextareaMinHeight || 90;
            const maxHeight = this.commentTextareaMaxHeight || 175;
            const clampedHeight = Math.max(minHeight, Math.min(nextHeight, maxHeight));
            if (Math.abs((this.commentTextareaHeight || 0) - clampedHeight) > 1) {
                this.setData({
                    commentTextareaHeight: clampedHeight
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
                    title: '????3???',
                    icon: 'none'
                });
                return;
            }
            // 纭繚杈撳叆妗嗕繚鎸佸睍寮€鐘舵€?
            if (!this.isInputExpanded) {
                this.expandInput();
            }
            // 鍦ˋPP绔厛璇锋眰璇诲彇瀛樺偍鏉冮檺
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
                const platform = getCurrentPlatform();
                if (platform === 'app') {
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
                // 璺宠繃鍘嬬缉锛岀洿鎺ヤ娇鐢ㄥ師鍥?
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
                // 浣跨敤鏇存縺杩涚殑鍘嬬缉鍙傛暟锛岀‘淇濇枃浠跺ぇ灏忎笉瓒呰繃200KB
                const compressWithQuality = (quality) => {
                    uni.compressImage({
                        src: imageInfo.originalPath,
                        quality: quality,
                        success: (res) => {
                            // 妫€鏌ュ帇缂╁悗鐨勬枃浠跺ぇ灏?
                            uni.getFileInfo({
                                filePath: res.tempFilePath,
                                success: (fileInfo) => {
                                    const compressedSize = fileInfo.size;
                                    console.log(`鍘嬬缉璐ㄩ噺${quality}%锛屾枃浠跺ぇ灏? ${(compressedSize / 1024).toFixed(2)}KB`);
                                    // 濡傛灉鏂囦欢澶у皬瓒呰繃200KB涓旇川閲忚繕鍙互缁х画闄嶄綆锛屽垯缁х画鍘嬬缉
                                    if (compressedSize > 204800 && quality > 30) {
                                        console.log(`鏂囦欢澶у皬${(compressedSize / 1024).toFixed(2)}KB瓒呰繃200KB锛岀户缁帇缂?..`);
                                        compressWithQuality(quality - 10);
                                    } else {
                                        imageInfo.compressedPath = res.tempFilePath;
                                        imageInfo.previewUrl = res.tempFilePath;
                                        imageInfo.compressedSize = compressedSize;
                                        console.log(`鏈€缁堝帇缂╄川閲?{quality}%锛屾枃浠跺ぇ灏? ${(compressedSize / 1024).toFixed(2)}KB`);
                                        resolve(imageInfo);
                                    }
                                },
                                fail: () => {
                                    // 濡傛灉无法鑾峰彇鏂囦欢淇℃伅锛岀洿鎺ヤ娇鐢ㄥ帇缂╃粨鏋?
                                    imageInfo.compressedPath = res.tempFilePath;
                                    imageInfo.previewUrl = res.tempFilePath;
                                    resolve(imageInfo);
                                }
                            });
                        },
                        fail: (err) => {
                            console.warn(`鍘嬬缉璐ㄩ噺${quality}%失败:`, err);
                            if (quality > 30) {
                                // 濡傛灉鍘嬬缉失败涓旇川閲忚繕鍙互闄嶄綆锛屽皾璇曟洿浣庣殑璐ㄩ噺
                                compressWithQuality(quality - 10);
                            } else {
                                // 濡傛灉鎵€鏈夊帇缂╅兘失败锛屼娇鐢ㄥ師鍥?
                                imageInfo.compressedPath = imageInfo.originalPath;
                                imageInfo.previewUrl = imageInfo.originalPath;
                                imageInfo.needCompression = false;
                                resolve(imageInfo);
                            }
                        }
                    });
                };
                // 浠?0%璐ㄩ噺寮€濮嬪帇缂╋紝閫愭闄嶄綆鐩村埌鏂囦欢澶у皬绗﹀悎瑕佹眰
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

            // 浣跨敤閫氱敤鐨勬枃浠朵笂浼犳柟娉?
            return Promise.all(
                images.map((image, index) => {
                    const uniqueKey = (openid || 'guest') + '_' + timestamp + '_' + index;
                    const compressedCloudPath = 'comment_images/' + uniqueKey + '_compressed.jpg';

                    // 浣跨敤閫氱敤鐨勬枃浠朵笂浼犳柟娉曪紙uploadFile 杩斿洖 fileID 瀛楃涓诧級
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
            // 浣跨敤鏂扮殑楠岃瘉宸ュ叿鍑芥暟
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
                    title: '??????',
                    icon: 'none'
                });
                return;
            }
            // 銆愬唴瀹瑰鏍搞€戝鏍歌瘎璁哄唴瀹癸紙浠呭皬绋嬪簭绔級
            const moderationResult = await this.moderateCommentContent(trimmedContent, this.commentImages);
            if (!moderationResult.passed) {
                uni.showModal({
                    title: '鍐呭瀹℃牳鏈€氳繃',
                    content: moderationResult.message || '???????????????????',
                    showCancel: false,
                    confirmText: '???'
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
                title: '鎻愪氦涓?..'
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
                const localPreviewImages = (this.commentImages || [])
                    .map((item) => item.previewUrl || item.path || '')
                    .filter(Boolean);
                const result = await submitComment(commentData);
                uni.hideLoading();
                if (result) {
                    uni.showToast({
                        title: '璇勮鎴愬姛'
                    });
                    const newCommentCount = this.commentCount + 1;
                    const { comments: nextComments, inserted } = this.appendSubmittedComment(result.comment, {
                        postId,
                        parentId,
                        replyToAuthorName: replyToAuthor || null,
                        content: trimmedContent,
                        imageUrls: localPreviewImages,
                        originalImageUrls: localPreviewImages
                    });
                    try { emitCommentCountChanged({ postId, commentCount: newCommentCount }); } catch (_) {}
                    this.setData({
                        comments: nextComments,
                        newComment: '',
                        commentImages: [],
                        commentCount: newCommentCount,
                        'post.commentCount': newCommentCount
                    });
                    this.updateSubmitState();
                    this.collapseInput();
                    if (!inserted) {
                        this.getComments(postId);
                    }
                    const pages = getCurrentPages();
                    if (pages.length > 1) {
                        const prePage = pages[pages.length - 2];
                        if ((prePage.route === 'pages/index/index' || prePage.route === 'pages/profile/profile') && typeof prePage.updatePostCommentCount === 'function') {
                            prePage.updatePostCommentCount(postId, newCommentCount);
                        }
                    }
                }
            } catch (error) {
                console.log('CatchClause', error);
                console.log('CatchClause', error);
                uni.hideLoading();
                console.error('Failed to add comment with media:', error);
                uni.showToast({
                    title: '????',
                    icon: 'none'
                });
            } finally {
                this.setData({
                    isSubmittingComment: false
                });
                this.updateSubmitState();
            }
        },
        // 銆愬唴瀹瑰鏍搞€戝鏍歌瘎璁哄唴瀹癸紙浠呭皬绋嬪簭绔級
        async moderateCommentContent(content, images) {
            console.log('[PostDetail] start comment moderation');
            if (!shouldModerate()) {
                console.log('[PostDetail] moderation skipped in current environment');
                return {
                    passed: true,
                    message: '?????'
                };
            }

            try {
                uni.showLoading({
                    title: '瀹℃牳涓?..',
                    mask: true
                });
                // 提取图片 URL
                const imageUrls = [];
                if (images && Array.isArray(images)) {
                    images.forEach(img => {
                        if (img.previewUrl) {
                            imageUrls.push(img.previewUrl);
                        } else if (img.path) {
                            imageUrls.push(img.path);
                        }
                    });
                }
                // 璋冪敤瀹℃牳
                const result = await checkContentSafe({
                    text: content,
                    images: imageUrls
                }, {
                    scene: 2 // 鍦烘櫙2-璇勮
                });
                uni.hideLoading();
                console.log('[PostDetail] moderation result:', result);
                return result;
            } catch (error) {
                uni.hideLoading();
                console.error('鉂?[PostDetail] 璇勮瀹℃牳失败:', error);

                // 瀹℃牳失败鏃惰繑鍥為€氳繃
                return {
                    passed: true,
                    message: '?????????'
                };
            }
        },
        showReplyInput: function (e) {
            console.log('--- showReplyInput function triggered ---');
            console.log('鏀跺埌鐨?data- attributes:', e.currentTarget.dataset);
            const commentId = e.currentTarget.dataset.commentId;
            const authorName = e.currentTarget.dataset.authorName;
            const replyId = e.currentTarget.dataset.replyId; // 琚洖澶嶇殑浜岀骇璇勮ID锛堝鏋滃瓨鍦級

            // 濡傛灉瀛樺湪 replyId锛岃鏄庢槸鍥炲浜岀骇璇勮锛涘惁鍒欐槸鍥炲涓€绾ц瘎璁?
            this.setData({
                replyToComment: commentId, // 鐖惰瘎璁篒D锛屼綔涓?parentId
                replyToAuthor: authorName  // 琚洖澶嶇殑鐢ㄦ埛鍚嶏紝浣滀负 replyToAuthorName
            });
            console.log('璁剧疆鍚庣殑鍥炲鐘舵€?', {
                replyToComment: this.replyToComment,
                replyToAuthor: this.replyToAuthor,
                replyId: replyId // 璁板綍琚洖澶嶇殑浜岀骇璇勮ID锛堢敤浜庢棩蹇楋級
            });
            this.expandInput();
        },
        cancelReply: function () {
            this.setData({
                replyToComment: null,
                replyToAuthor: ''
            });
            console.log('[post-detail] reply state cleared');
        },
        onDeleteComment: function (e) {
            const { commentId, parentId } = e.currentTarget.dataset;
            if (!commentId) {
                return;
            }
            const postId = this.post && this.post._id ? this.post._id : '';
            if (!postId) {
                uni.showToast({
                    title: '??????',
                    icon: 'none'
                });
                return;
            }
            uni.showModal({
                title: '鍒犻櫎璇勮',
                content: '???????????',
                confirmColor: '#ff4d4f',
                success: (res) => {
                    if (!res.confirm) {
                        return;
                    }
                    uni.showLoading({
                        title: '姝ｅ湪鍒犻櫎',
                        mask: true
                    });
                    deleteComment(commentId, postId, parentId).then((result) => {
                            if (result && result.success) {
                                const deletedCount = Math.max(1, result.deletedCount || 1);
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
                                try { emitCommentCountChanged({ postId: this.post && this.post._id ? this.post._id : '', commentCount: newCommentCount }); } catch (_) {}
                                this.setData({
                                    comments: updatedComments,
                                    commentCount: newCommentCount,
                                    'post.commentCount': newCommentCount
                                });
                                const pages = getCurrentPages();
                                if (pages.length > 1) {
                                    const prePage = pages[pages.length - 2];
                                    if (typeof prePage.updatePostCommentCount === 'function') {
                                        prePage.updatePostCommentCount(this.post && this.post._id ? this.post._id : '', newCommentCount);
                                    }
                                }
                                uni.showToast({
                                    title: '???',
                                    icon: 'success'
                                });
                            } else {
                                uni.showToast({
                                    title: (result && result.message) || '????',
                                    icon: 'none'
                                });
                            }
                        }).catch((err) => {
                            console.error('Failed to delete comment', err);
                            uni.showToast({
                                title: '????',
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

            // 浣跨敤 Vue 鍝嶅簲寮忔柟寮忔洿鏂?
            if (isReply) {
                this.$set(this.comments[commentIndex].replies[replyIndex], 'liked', newLikeState);
                this.$set(this.comments[commentIndex].replies[replyIndex], 'likes', newLikes);
                this.$set(this.comments[commentIndex].replies[replyIndex], 'likeIcon', newLikeIcon);
            } else {
                this.$set(this.comments[commentIndex], 'liked', newLikeState);
                this.$set(this.comments[commentIndex], 'likes', newLikes);
                this.$set(this.comments[commentIndex], 'likeIcon', newLikeIcon);
            }

            likeComment(commentId, postId, newLikeState).then((result) => {
                    if (result && result.success) {
                        if (newLikes !== result.likes) {
                            this.updateCommentLikeStatus(commentId, newLikeState, result.likes);
                        }
                    } else {
                        this.updateCommentLikeStatus(commentId, !newLikeState, oldLikes);
                        uni.showToast({ title: '????', icon: 'none' });
                    }
                }).catch((err) => {
                    this.updateCommentLikeStatus(commentId, !newLikeState, oldLikes);
                    uni.showToast({ title: '缃戠粶閿欒', icon: 'none' });
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
        // 鏌ユ壘璇勮骞惰繑鍥炵储寮曪紙鐢ㄤ簬 Vue 鍝嶅簲寮忔洿鏂帮級
        findComment: function (comments, commentId) {
            return findComment(comments, commentId);
        },
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
                const nextVal = !comment.showAllReplies;
                // keep reactivity even if the flag was not pre-defined
                this.$set(comment, 'showAllReplies', nextVal);
                // trigger view update
                this.setData({
                    comments: comments
                });
            }
        },
        // ========== CommentItem 缁勪欢浜嬩欢閫傞厤鏂规硶 ==========

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
            console.log('銆愬叧娉ㄧ姸鎬併€憄repareFollowState璋冪敤:', {
                authorOpenid,
                currentUserId,
                isSameUser: isSameUser
            });
            // 璁剧疆鏄惁鏄嚜宸辩殑甯栧瓙
            this.setData({
                isOwnPost: isSameUser
            });
            if (!authorOpenid || !currentUserId || isSameUser) {
                console.log('[follow] hide follow button for self or invalid user');
                this.setData({
                    showFollowButton: false,
                    isFollowing: false,
                    isFollowedByAuthor: false,
                    isMutualFollow: false
                });
                return;
            }
            console.log('[follow] show follow button');
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
            // 浣跨敤缂撳瓨鑾峰彇鍏虫敞鐘舵€?
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
                    if (res && res.success) {
                        this.setData({
                            isFollowing: !!res.isFollowing,
                            isFollowedByAuthor: !!res.isFollower,
                            isMutualFollow: !!res.isMutual
                        });
                    } else {
                        console.warn('检查关注状态失败:', res);
                    }
                }).catch((err) => {
                    console.error('妫€鏌ュ叧娉ㄧ姸鎬佽皟鐢ㄥけ璐?', err);
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
                    title: '璇峰厛鐧诲綍',
                    icon: 'none'
                });
                return;
            }
            this.setData({
                followPending: true
            });
            // 浣跨敤缂撳瓨鍒囨崲鍏虫敞鐘舵€?
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
                            title: followData.isFollowing ? '????' : '?????',
                            icon: 'success'
                        });
                    } else {
                        uni.showToast({
                            title: '????',
                            icon: 'none'
                        });
                    }
                })
                .catch((err) => {
                    console.error('鍒囨崲鍏虫敞鐘舵€佸け璐?', err);
                    uni.showToast({
                        title: '缃戠粶閿欒',
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
        // 鐐瑰嚮璇椾汉鍚嶈烦杞埌璇椾汉涓婚〉锛堜粎闈炲師鍒涜瘲锛?
        onPoetNameTap: function () {
            if (!this.post || !this.post.author) return;

            // 鍙湁闈炲師鍒涜瘲鎵嶈烦杞?
            if (this.post.isOriginal) {
                return;
            }

            // 濡傛灉浣滆€呭悕鍜屽彂甯冪敤鎴锋樀绉扮浉鍚岋紝鍙兘鏄敤鎴蜂笂浼犻敊璇紝涓嶅垱寤鸿瘲浜轰富椤?
            const poetName = this.post.author;
            const authorName = this.post.authorName || this.post.authorNameSnapshot || '';
            if (poetName.trim() === authorName.trim()) {
                return;
            }

            uni.navigateTo({
                url: `/pages-user/poet-profile/poet-profile?poetName=${encodeURIComponent(poetName)}`
            });
        },
        navigateToUserProfile: function (e) {
            try {
                console.log('銆愯鎯呴〉澶村儚鐐瑰嚮銆戝嚱鏁拌璋冪敤锛屼簨浠跺璞?', e);
                const currentTarget = e.currentTarget || e.target || {};
                const dataset = currentTarget.dataset || {};
                const isAnonymous = dataset.isAnonymous === 'true' || dataset.isAnonymous === true;
                const userId = dataset.userId || dataset.userid || dataset.user || '';
                console.log('銆愯鎯呴〉澶村儚鐐瑰嚮銆戝畬鏁磀ataset:', dataset);
                console.log('銆愯鎯呴〉澶村儚鐐瑰嚮銆慽sAnonymous:', isAnonymous);
                console.log('銆愯鎯呴〉澶村儚鐐瑰嚮銆憉serId:', userId);
                console.log('銆愯鎯呴〉澶村儚鐐瑰嚮銆慶urrentTarget:', currentTarget);
                // 濡傛灉鏄尶鍚嶈瘎璁猴紝涓嶈烦杞?
                if (isAnonymous || (dataset.authorName === '鍖垮悕鐢ㄦ埛' && userId.includes('anonymous'))) {
                    console.log('[post-detail] anonymous comment profile navigation skipped');
                    uni.showToast({
                        title: '??????????',
                        icon: 'none'
                    });
                    return;
                }
                if (!userId) {
                    console.error('銆愬ご鍍忕偣鍑汇€憉serId涓虹┖锛宒ataset:', dataset);
                    return;
                }
                const currentUserOpenid = this.openid || this.getCurrentUserId();
                // 妫€鏌ユ槸鍚︾偣鍑荤殑鏄嚜宸辩殑澶村儚
                if (userId === currentUserOpenid) {
                    uni.switchTab({
                        url: '/pages/profile/profile'
                    });
                } else {
                    uni.navigateTo({
                        url: `/pages-user/user-profile/user-profile?userId=${encodeURIComponent(userId)}`
                    });
                }
            } catch (err) {
                console.error('銆愬ご鍍忕偣鍑汇€戝嚱鏁版墽琛屽嚭閿?', err);
                uni.showToast({
                    title: '璺宠浆寮傚父',
                    icon: 'none'
                });
            }
        },
        preventBubble: function () {
            // 绌哄嚱鏁帮紝浠呯敤浜庨樆姝簨浠跺啋娉?        },
        },
        expandInput: function () {
            // 鍏堥噸缃敭鐩橀珮搴︼紝纭繚寮圭獥鍦ㄥ簳閮ㄦ樉绀?            // 鐩存帴鍚屾椂璁剧疆鎵€鏈夌姸鎬侊紝涓嶉渶瑕佸欢杩燂紝璁╁脊绐楃珛鍗虫樉绀?
            this.setData({
                keyboardHeight: 0,
                isInputExpanded: true,
                isFocus: true, // 鐩存帴鑱氱劍锛岃閿洏鍜屽脊绐楀悓姝ュ搷搴?            });
            });
        },
        onInputFocus: function (e) {
            // 杈撳叆妗嗚幏寰楃劍鐐规椂鐨勫鐞?            // 浠?focus 浜嬩欢涓幏鍙栭敭鐩橀珮搴︿綔涓哄鐢紙濡傛灉 uni.onKeyboardHeightChange 鍝嶅簲鎱級
            if (e && e.detail && typeof e.detail.height === 'number' && e.detail.height > 0) {
                this.setData({
                    keyboardHeight: e.detail.height
                });
            }
        },
        onInputBlur: function () {
            this.setData({
                isFocus: false,
                keyboardHeight: 0 // 閿洏鏀惰捣鏃堕噸缃珮搴?            });
            });
        },
        collapseInput: function () {
            this.resetCommentTextareaHeight();
            this.setData({
                isInputExpanded: false,
                isFocus: false,
                replyToComment: null,
                replyToAuthor: '',
            });
        },
        onTagClick: function (e) {
            const tag = e.currentTarget.dataset.tag;
            console.log('鐐瑰嚮鏍囩:', tag);
            uni.navigateTo({
                url: `/pages-tools/tag-filter/tag-filter?tag=${encodeURIComponent(tag)}`,
                success: () => {
                    console.log('跳转到标签筛选页成功');
                },
                fail: (err) => {
                    console.error('跳转到标签筛选页失败:', err);
                    uni.showToast({
                        title: '????',
                        icon: 'none'
                    });
                }
            });
        },
        // 杩斿洖鎸夐挳鏂规硶
        goBack: function () {
            // 鑾峰彇椤甸潰鏍?
            const pages = getCurrentPages();
            console.log('褰撳墠椤甸潰鏍堥暱搴?', pages.length);

            if (pages.length > 1) {
                // 鏈変笂涓€椤碉紝姝ｅ父杩斿洖
                uni.navigateBack({
                    delta: 1,
                    fail: () => {
                        console.log('navigateBack失败锛屽皾璇晄witchTab');
                        // 濡傛灉杩斿洖失败锛屽皾璇曡烦杞埌棣栭〉
                        uni.switchTab({
                            url: '/pages/index/index'
                        });
                    }
                });
            } else {
                // 娌℃湁涓婁竴椤碉紝璺宠浆鍒伴椤?
                console.log('[post-detail] no previous page, switching to home tab');
                uni.switchTab({
                    url: '/pages/index/index'
                });
            }
        },
        // 搴曢儴鏍忓揩閫熻瘎璁鸿緭鍏?
        onQuickCommentInput: function(e) {
            this.quickCommentText = e.detail.value;
        },
        // 搴曢儴鏍忓揩閫熻瘎璁烘彁浜?
        onQuickCommentSubmit: function() {
            const text = this.quickCommentText.trim();
            if (!text) {
                return;
            }

            // 浣跨敤鐜版湁鐨勮瘎璁烘彁浜ら€昏緫
            this.newComment = text;
            this.quickCommentText = '';
            this.onSubmitComment();
        },
        // 鏄剧ず璁ㄨ妯℃€佹
        showDiscussionModal: function() {
            // 杩欓噷鍙互璺宠浆鍒板啓璁ㄨ椤甸潰鎴栨樉绀鸿璁烘ā鎬佹
            uni.navigateTo({
                url: '/pages-tools/create-discussion/create-discussion?postId=' + (this.post && this.post._id ? this.post._id : '')
            });
        },
        // 鍒囨崲鏀惰棌鐘舵€?
        toggleFavorite: function() {
            if (!this.post || !this.post._id) {
                return;
            }

            // 浣跨敤鐜版湁鐨勬敹钘忛€昏緫
            this.showFavoriteModal = true;
        },
        // 图片加载事件处理
        onImageLoad: function(e) {
        },
        onImageError: function(e) {
            // 鏄剧ず閿欒淇℃伅
            uni.showToast({
                title: '图片加载失败',
                icon: 'none',
                duration: 2000
            });
        },
        onEditPost() {
            // 鎵撳紑寮圭獥锛屽洖濉綋鍓嶅唴瀹?
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
            // 楠岃瘉杈撳叆
            if (!this.editForm.title || !this.editForm.title.trim()) {
                uni.showToast({ title: '?????', icon: 'none' });
                return;
            }
            if (!this.editForm.content || !this.editForm.content.trim()) {
                uni.showToast({ title: '?????', icon: 'none' });
                return;
            }

            // 妫€鏌ユ槸鍚︽湁鏉冮檺缂栬緫
            if (!this.post || !this.post._id) {
                uni.showToast({ title: '??????', icon: 'none' });
                return;
            }

            uni.showLoading({ title: '淇濆瓨涓?..' });

            // 璋冪敤鏇存柊鎺ュ彛
            updatePostContent(this.post._id, {
                title: this.editForm.title.trim(),
                content: this.editForm.content.trim()
            })
            .then(() => {
                uni.hideLoading();
                uni.showToast({ title: '淇濆瓨鎴愬姛', icon: 'success' });
                // 鏇存柊鏈湴甯栧瓙鏁版嵁
                this.setData({
                    'post.title': this.editForm.title.trim(),
                    'post.content': this.editForm.content.trim(),
                    showEditModal: false
                });
                // 鍙戦€佹洿鏂颁簨浠堕€氱煡鍏朵粬椤甸潰
                try {
                    emitPostUpdated(this.post._id);
                } catch (e) {
                    if (uni.$emit) {
                        uni.$emit('post-updated', { postId: this.post._id });
                    }
                }
            })
            .catch((err) => {
                uni.hideLoading();
                console.error('淇濆瓨失败:', err);
                uni.showToast({
                    title: err.message || '????',
                    icon: 'none'
                });
            });
        },

        // 鍒嗕韩鍒板ソ鍙?缇よ亰
        onShareAppMessage(res) {
            const postId = this.post?._id;
            // 浼樺厛浣跨敤鏍囬锛屽鏋滄病鏈夋爣棰樺垯浣跨敤鍐呭鍓?0涓瓧绗?
            let title = 'poementer';
            if (this.post?.title) {
                title = this.post.title;
            } else if (this.post?.content) {
                title = this.post.content.substring(0, 20) + (this.post.content.length > 20 ? '...' : '');
            }

            return getShareAppMessageConfig({
                title: title,
                path: postId ? `/pages/post-detail/post-detail?id=${postId}` : '/pages/poem-square/poem-square'
            });
        },

        // 鍒嗕韩鍒版湅鍙嬪湀
        onShareTimeline() {
            const postId = this.post?._id;
            // 浼樺厛浣跨敤鏍囬锛屽鏋滄病鏈夋爣棰樺垯浣跨敤鍐呭鍓?0涓瓧绗?
            let title = 'poementer';
            if (this.post?.title) {
                title = this.post.title;
            } else if (this.post?.content) {
                title = this.post.content.substring(0, 20) + (this.post.content.length > 20 ? '...' : '');
            }

            return getShareTimelineConfig({
                title: title,
                query: postId ? `id=${postId}` : ''
            });
        }
    }
};
</script>
<style>
/* pages/post-detail/post-detail.wxss */
/* 鑷畾涔夎繑鍥炴寜閽?*/
.custom-back-btn {
    position: absolute;
    top: calc(90rpx + env(safe-area-inset-top, var(--safe-area-inset-top, 44px))); /* 娣诲姞瀹夊叏鍖哄煙鍋忕Щ */
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
/* 纭繚 page 鍏冪礌鏈夐珮搴?*/
page {
    height: 100vh;
}
.container {
    background-color: #ffffff;
    /* min-height: 100vh; */
    padding-bottom: 140rpx;
    padding-top: calc(160rpx + env(safe-area-inset-top, var(--safe-area-inset-top, 44px))); /* 娣诲姞瀹夊叏鍖哄煙涓婅竟璺?*/
    position: relative; /* 涓鸿繑鍥炴寜閽彁渚涘畾浣嶄笂涓嬫枃 */
    /* 鏂板锛岀‘淇濆湪鍐呭涓嶈冻鏃朵篃鑳芥拺婊′竴灞?*/
    display: flex;
    flex-direction: column;
    min-height: 100%; /* 浣跨敤鐧惧垎姣旂户鎵?page 鐨勯珮搴?*/
    box-sizing: border-box; /* 鍔犱笂杩欎釜濂戒範鎯?*/
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
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif;
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
    background-color: #4a4a4a;
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
.poem-author-clickable:active {
    opacity: 0.7;
}
.post-content {
    font-size: 28rpx;
    line-height: 1.6;
    margin-bottom: 20rpx;
    white-space: pre-wrap;
    color: #666;
    word-break: break-word;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif;
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
    padding: 10rpx 0rpx 0 40rpx;
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
/* 璇勮鐩稿叧鏍峰紡宸茬Щ鍏?CommentItem.vue 鍜?CommentList.vue */
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
    transition: none; /* 绂佺敤鍔ㄧ敾锛岀洿鎺ユ樉绀哄埌浣?*/
    will-change: bottom; /* 浼樺寲鎬ц兘 */
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
    overflow-y: auto;
    overflow-x: hidden;
    padding: 20rpx 24rpx;
    background-color: #ffffff;
    border-radius: 0;
    font-size: 30rpx;
    line-height: 1.6;
    box-sizing: border-box;
    border: none;
    overflow-y: auto;
    appearance: none;
    -webkit-appearance: none;
    -webkit-box-sizing: border-box;
    user-select: text;
    -webkit-user-select: text;
    -webkit-touch-callout: default;
    outline: none;
    resize: none;
    display: block;
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
/* 妯″紡鍒囨崲鏍峰紡 */
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
/* 璁ㄨ鏍囬杈撳叆鏍峰紡 */
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
/* 璁ㄨ绫诲瀷甯栧瓙鏍峰紡 */
.discussion-content {
    margin: 20rpx 0;
}
.discussion-sentence-group {
    margin-bottom: 30rpx;
}
.discussion-sentence-card {
    background: #f5f5f5; /* 娣诲姞鐏拌壊鑳屾櫙 */
    border-radius: 12rpx; /* 娣诲姞鍦嗚 */
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
    padding: 20rpx 0; /* 绉婚櫎宸﹀彸padding锛屽彧淇濈暀涓婁笅padding */
    background: transparent; /* 绉婚櫎鐏拌壊鑳屾櫙 */
    border-radius: 0; /* 绉婚櫎鍦嗚 */
    word-wrap: break-word;
    word-break: break-all;
    width: 100%;
    max-width: 100%;
    box-sizing: border-box;
    overflow-wrap: break-word;
}
/* 鍒嗕韩寮圭獥鏍峰紡宸茬Щ鍏?ShareModal.vue */
/* 璇楁瓕鍐呭浣跨敤姹囨枃鏄庢湞瀛椾綋锛屽叾浠栧湴鏂逛娇鐢ㄧ郴缁熼粯璁ゅ瓧浣?*/
/* 搴曢儴鎿嶄綔鏍忔牱寮?*/
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
/* 璋冩暣椤甸潰搴曢儴闂磋窛锛岄伩鍏嶈搴曢儴鏍忛伄鎸?*/
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
/* ========== 杩囨浮鍔ㄧ敾 ========== */
/* 甯栧瓙璇︽儏鍐呭娣″叆鍔ㄧ敾 */
.post-detail-wrapper {
    animation: detailFadeIn 0.4s ease-out;
}
@keyframes detailFadeIn {
    from {
        opacity: 0;
        transform: translateY(20rpx);
    }
    to {
        opacity: 1;
        transform: translateY(0);
    }
}
/* 图片加载淡入动画 */
.post-image {
    animation: imageFadeIn 0.5s ease-out;
}
@keyframes imageFadeIn {
    from {
        opacity: 0;
        transform: scale(0.98);
    }
    to {
        opacity: 1;
        transform: scale(1);
    }
}
/* 鐐硅禐鎸夐挳鐐瑰嚮寮硅烦鍔ㄧ敾 */
.like-icon-container.liked-animation {
    animation: likeBouncePop 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.6);
}
@keyframes likeBouncePop {
    0% { transform: scale(1); }
    25% { transform: scale(0.8); }
    50% { transform: scale(1.25); }
    75% { transform: scale(0.95); }
    100% { transform: scale(1); }
}
/* 鐐硅禐鏁板瓧鍙樺寲鍔ㄧ敾 */
.vote-count.vote-changed {
    animation: voteNumberPop 0.3s ease;
}
@keyframes voteNumberPop {
    0% { transform: scale(1); }
    50% { transform: scale(1.2); }
    100% { transform: scale(1); }
}
/* 璇勮鍖烘贰鍏ュ姩鐢?*/
.comment-section {
    animation: commentFadeIn 0.4s ease-out 0.1s both;
}
@keyframes commentFadeIn {
    from {
        opacity: 0;
        transform: translateY(15rpx);
    }
    to {
        opacity: 1;
        transform: translateY(0);
    }
}
/* 鍗曟潯璇勮娣″叆鍔ㄧ敾 */
.comment-item {
    animation: commentItemFadeIn 0.3s ease-out both;
}
@keyframes commentItemFadeIn {
    from {
        opacity: 0;
        transform: translateX(-10rpx);
    }
    to {
        opacity: 1;
        transform: translateX(0);
    }
}
/* 搴曢儴鎿嶄綔鏍忔粦鍏ュ姩鐢?*/
.bottom-action-bar {
    animation: bottomBarSlideIn 0.3s ease-out;
}
@keyframes bottomBarSlideIn {
    from {
        opacity: 0;
        transform: translateY(100%);
    }
    to {
        opacity: 1;
        transform: translateY(0);
    }
}
/* 鏍囩娣″叆鍔ㄧ敾 */
.tags-section {
    animation: tagsFadeIn 0.4s ease-out 0.15s both;
}
@keyframes tagsFadeIn {
    from {
        opacity: 0;
    }
    to {
        opacity: 1;
    }
}
/* 缁勮瘲绠€鍗曟樉绀?*/
.series-simple-display {
    margin-top: 16rpx;
}
.series-poem-block {
    margin-bottom: 60rpx;
}
.series-poem-block:last-child {
    margin-bottom: 0;
}
.series-poem-subtitle {
    font-size: 28rpx;
    font-weight: 600;
    color: #666;
    margin-bottom: 20rpx;
    opacity: 0.8;
}
</style>
