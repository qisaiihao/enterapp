<template>
    <view :class="'post-item-wrapper ' + (item.isOriginal ? 'original-post' : '')">
        <!-- 右上角三个点菜单按钮 -->
        <view 
            v-if="showMenu" 
            class="more-menu-btn-top-right" 
            @tap.stop.prevent="onShowActionMenu"
        >
            <view class="more-menu-dots-small">
                <view class="dot-small"></view>
                <view class="dot-small"></view>
                <view class="dot-small"></view>
            </view>
        </view>

        <!-- 作者信息 -->
        <view class="author-info-outside">
            <image
                class="author-avatar"
                :src="item.isAnonymous ? '/static/images/avatar.png' : (item.authorAvatar || '/static/images/avatar.png')"
                mode="aspectFill"
                @error="onAvatarError"
                @load="onAvatarLoad"
                @tap.stop.prevent="onNavigateToUser"
            ></image>
            <text class="author-name">{{ item.authorName }}</text>
            <view v-if="item.isAnonymous" class="anonymous-tag">匿名</view>
        </view>

        <!-- 可点击的内容区域 - 跳转到详情页 -->
        <navigator class="post-content-navigator" :url="'/pages/post-detail/post-detail?id=' + item._id" hover-class="none">
            <view class="post-item">
                <view class="post-title">{{ item.title }} <text v-if="item.isHidden" class="hidden-tag">已隐藏</text></view>
                <!-- 诗歌作者信息 -->
                <view v-if="showPoemAuthor && item.isPoem && item.author" class="poem-author">{{ item.author }}</view>

                <!-- 图片显示逻辑 (已优化，使用 imageStyle 占位) -->
                <view
                    v-if="item.imageUrls && item.imageUrls.length > 0"
                    class="image-container-wrapper"
                    :style="item.imageStyle"
                    @tap.stop.prevent="onPreviewImage"
                    :data-src="item.imageUrls[0]"
                    :data-original-image-urls="item.originalImageUrls || item.imageUrls"
                >
                    <!-- 单张图片 -->
                    <block v-if="item.imageUrls.length === 1">
                        <image
                            :id="'single-image-' + item._id"
                            class="post-image"
                            :src="item.imageUrls[0]"
                            mode="aspectFill"
                            :lazy-load="true"
                            @error="onImageError"
                            @load="onImageLoad"
                            :data-postid="item._id"
                            :data-imgindex="0"
                            data-type="single"
                        />
                    </block>

                    <!-- 多张图片 -->
                    <block v-else-if="item.imageUrls.length > 1">
                        <swiper
                            :id="'swiper-' + item._id"
                            class="image-swiper"
                            :indicator-dots="true"
                            :circular="true"
                            :style="'height: ' + (swiperHeight ? swiperHeight + 'px' : '220px') + ';'"
                        >
                            <block v-for="(img, imgindex) in item.imageUrls" :key="imgindex">
                                <swiper-item>
                                    <image
                                        class="post-image"
                                        :src="img"
                                        mode="aspectFill"
                                        :lazy-load="true"
                                        @error="onImageError"
                                        @load="onImageLoad"
                                        @tap.stop.prevent="onPreviewImageMulti"
                                        :data-src="img"
                                        :data-original-image-urls="item.originalImageUrls || item.imageUrls"
                                        :data-postid="item._id"
                                        :data-imgindex="imgindex"
                                        data-type="multi"
                                    />
                                </swiper-item>
                            </block>
                        </swiper>
                    </block>
                </view>

                <!-- 讨论帖子优先展示引用句子块，其次正文 -->
                <view v-if="item.isDiscussion && hasValidDiscussionGroups(item)" class="discussion-content">
                    <!-- 只显示第一个有效的引用句子组 -->
                    <view v-if="getFirstValidDiscussionGroup(item)" class="discussion-sentence-group">
                        <view v-if="hasDiscussionSentences(getFirstValidDiscussionGroup(item))" class="discussion-sentence-card">
                            <view class="discussion-sentence-content">
                                <!-- 只显示第一句 -->
                                <text class="discussion-sentence-line">
                                    {{ getFirstValidDiscussionGroup(item).sentences[0] }}
                                </text>
                            </view>
                        </view>
                        <view v-if="getFirstValidDiscussionGroup(item).comment" class="discussion-comment-preview">{{ getFirstValidDiscussionGroup(item).comment }}</view>
                    </view>
                </view>
                <view v-else-if="isSeriesPost(item)" class="series-simple-preview">
                    <view class="post-content" style="white-space: pre-wrap">{{ getSeriesPreviewText(item) }}</view>
                    <view class="series-meta-tag">组诗·{{ item.seriesBlockCount || (item.seriesBlocks && item.seriesBlocks.length) }}</view>
                </view>
                <view class="post-content" v-else-if="item.content" style="white-space: pre-wrap">{{ item.content }}</view>

                <!-- 标签显示 -->
                <view v-if="item.tags && item.tags.length > 0" class="post-tags">
                    <text 
                        class="post-tag" 
                        @tap.stop.prevent="onTagClick" 
                        :data-tag="tag" 
                        v-for="(tag, tagIndex) in item.tags" 
                        :key="tagIndex"
                    >
                        #{{ tag }}
                    </text>
                </view>
            </view>
        </navigator>

        <!-- 底部操作区域 - profile模式：时间+取消收藏 -->
        <view v-if="!showVoteSection" class="delete-section">
            <view class="time-left">
                <text class="post-time">{{ timeLabel }}{{ displayTime }}</text>
            </view>
            <view v-if="showRemoveFavoriteBtn" class="button-group">
                <button class="remove-favorite-btn" size="mini" @tap.stop.prevent="onRemoveFavorite">
                    取消收藏
                </button>
            </view>
        </view>

        <!-- 底部操作区域 - feed模式：评论+点赞 -->
        <view v-if="showVoteSection" class="vote-section">
            <view class="actions-left">
                <!-- 左侧留空，保持布局平衡 -->
            </view>
            <view class="button-group">
                <view class="comment-count" @tap.stop.prevent="onCommentClick">
                    <image class="comment-icon" src="/static/images/newicons/comment.png" mode="aspectFit" />
                    <text class="action-text">{{ item.commentCount || 0 }}</text>
                </view>
                <view
                    class="like-icon-container"
                    @tap.stop.prevent="onVote"
                >
                    <image class="like-icon" :src="item.likeIcon || '/static/images/seed.png'" mode="aspectFit" @error="onLikeIconError"></image>
                </view>
                <view :class="'vote-count ' + (item.isVoted ? 'voted' : '')">
                    <text class="action-text">{{ item.votes || 0 }}</text>
                </view>
            </view>
        </view>
    </view>
</template>

<script>
export default {
    name: 'PostItem',
    props: {
        // 帖子数据
        item: {
            type: Object,
            required: true
        },
        // 帖子索引
        index: {
            type: Number,
            required: true
        },
        // swiper高度
        swiperHeight: {
            type: Number,
            default: 220
        },
        // 是否显示三点菜单
        showMenu: {
            type: Boolean,
            default: false
        },
        // 是否显示诗歌作者
        showPoemAuthor: {
            type: Boolean,
            default: true
        },
        // 时间标签前缀
        timeLabel: {
            type: String,
            default: '发布于'
        },
        // 显示的时间字段
        timeField: {
            type: String,
            default: 'formattedCreateTime'
        },
        // 是否显示取消收藏按钮
        showRemoveFavoriteBtn: {
            type: Boolean,
            default: false
        },
        // 是否显示互动区（评论/点赞）- feed模式
        showVoteSection: {
            type: Boolean,
            default: false
        },
        // 列表类型标识（用于点赞事件区分）
        listType: {
            type: String,
            default: 'home'
        }
    },
    computed: {
        displayTime() {
            return this.item[this.timeField] || '未知时间';
        }
    },
    methods: {
        hasDiscussionSentences(group) {
            return group && Array.isArray(group.sentences) && group.sentences.some(line => (line || '').trim().length > 0);
        },
        // 获取第一个有效的讨论句子组
        getFirstValidDiscussionGroup(post) {
            if (!post || !Array.isArray(post.sentenceGroups)) return null;
            return post.sentenceGroups.find(g => this.hasDiscussionSentences(g) || (g && g.comment && g.comment.trim().length > 0));
        },
        // 兼容：后端遗漏 isSeries 时，只要有分块也按组诗渲染
        isSeriesPost(post) {
            return !!(post && (post.isSeries || (Array.isArray(post.seriesBlocks) && post.seriesBlocks.length > 0)));
        },
        // 获取组诗预览文本（前三行）
        getSeriesPreviewText(post) {
            if (!post || !Array.isArray(post.seriesBlocks) || post.seriesBlocks.length === 0) {
                return post.content || '';
            }
            
            // 合并所有段落的内容
            const allContent = post.seriesBlocks
                .map(block => block.content || '')
                .join('\n\n')
                .trim();
            
            // 分割成行并取前三行
            const lines = allContent.split(/\r?\n/).filter(line => line.trim());
            const previewLines = lines.slice(0, 3);
            
            // 如果内容超过三行，添加省略号
            const hasMore = lines.length > 3;
            const previewText = previewLines.join('\n');
            
            return hasMore ? previewText + '\n…' : previewText;
        },
        hasValidDiscussionGroups(post) {
            if (!post || !Array.isArray(post.sentenceGroups)) return false;
            return post.sentenceGroups.some(g => this.hasDiscussionSentences(g) || (g && g.comment && g.comment.trim().length > 0));
        },
        seriesCoverBlocks(post) {
            if (!post) return [];
            let blocks = [];
            if (Array.isArray(post.seriesBlocks) && post.seriesBlocks.length > 0) {
                blocks = post.seriesBlocks.slice(0, 3).map((b, idx) => {
                    const subtitle = (b.subtitle && b.subtitle.trim()) || `其${idx + 1}`;
                    const linesAll = (b.content || '').split(/\r?\n/).map(l => l.trim()).filter(Boolean);
                    const lines = linesAll.slice(0, 3);
                    const hasMore = linesAll.length > 3;
                    return { subtitle, lines, hasMore };
                });
            } else if (post.content) {
                // fallback: 若缺少seriesBlocks，尝试用正文分段生成至少2-3张卡片
                const parts = post.content.split(/\n\s*\n/).filter(p => p && p.trim()).slice(0, 3);
                parts.forEach((p, idx) => {
                    const linesAll = p.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
                    if (linesAll.length === 0) return;
                    blocks.push({
                        subtitle: `其${idx + 1}`,
                        lines: linesAll.slice(0, 3),
                        hasMore: linesAll.length > 3
                    });
                });
            }
            if (blocks.length === 0) {
                blocks = [{
                    subtitle: '其一',
                    lines: [post.highlightSentence || post.title || '组诗'],
                    hasMore: false
                }];
            }
            // 调试：输出叠层块数量
            try {
                if (blocks.length > 1) {
                    console.log('[PostItem] seriesCoverBlocks', post._id, 'count', blocks.length, blocks);
                }
            } catch (e) {}
            return blocks;
        },
        stackStyle(index) {
            // 阶梯向右下错位，露出底层边缘
            const offset = 20 * index;
            const dx = 12 * index;
            const dy = 12 * index;
            const scale = 1 - index * 0.04; // 0->1,1->0.96,2->0.92
            return `top:${offset}rpx; left:${offset}rpx; transform: translate(${dx}rpx, ${dy}rpx) scale(${scale}); z-index:${10 - index};`;
        },
        // 显示操作菜单
        onShowActionMenu() {
            this.$emit('show-action-menu', {
                postId: this.item._id,
                index: this.index,
                isHidden: this.item.isHidden === true
            });
        },
        // 头像加载失败
        onAvatarError(e) {
            this.$emit('avatar-error', e);
        },
        // 头像加载成功
        onAvatarLoad(e) {
            this.$emit('avatar-load', e);
        },
        // 跳转用户主页
        onNavigateToUser() {
            // 统一使用 _openid 字段
            const userId = this.item._openid;
            console.log('【PostItem】点击头像，帖子信息:', { 
                postId: this.item._id, 
                _openid: this.item._openid,
                authorName: this.item.authorName,
                isAnonymous: this.item.isAnonymous 
            });
            this.$emit('navigate-to-user', {
                userId: userId,
                authorName: this.item.authorName,
                isAnonymous: this.item.isAnonymous
            });
        },
        // 预览图片（单图/外层容器点击）
        onPreviewImage(e) {
            console.log('【PostItem】图片预览 - 单图:', {
                src: this.item.imageUrls[0],
                originalUrls: this.item.originalImageUrls,
                compressedUrls: this.item.imageUrls
            });
            this.$emit('preview-image', {
                src: this.item.imageUrls[0],
                urls: this.item.originalImageUrls || this.item.imageUrls,
                event: e
            });
        },
        // 预览图片（多图swiper内点击）
        onPreviewImageMulti(e) {
            const dataset = e.currentTarget.dataset;
            console.log('【PostItem】图片预览 - 多图:', {
                clickedSrc: dataset.src,
                originalUrls: this.item.originalImageUrls,
                compressedUrls: this.item.imageUrls
            });
            // 直接使用 item 中的原图数组，避免 dataset 转换问题
            this.$emit('preview-image', {
                src: dataset.src,
                urls: this.item.originalImageUrls || this.item.imageUrls,
                event: e
            });
        },
        // 图片加载失败
        onImageError(e) {
            this.$emit('image-error', {
                postId: this.item._id,
                index: this.index,
                imgindex: e.currentTarget.dataset.imgindex,
                type: e.currentTarget.dataset.type,
                event: e
            });
        },
        // 图片加载成功
        onImageLoad(e) {
            this.$emit('image-load', {
                postId: this.item._id,
                index: this.index,
                imgindex: e.currentTarget.dataset.imgindex,
                type: e.currentTarget.dataset.type,
                event: e
            });
        },
        // 点击标签
        onTagClick(e) {
            const tag = e.currentTarget.dataset.tag;
            this.$emit('tag-click', { tag });
        },
        // 取消收藏
        onRemoveFavorite() {
            this.$emit('remove-favorite', {
                favoriteId: this.item.favoriteId,
                index: this.index
            });
        },
        // 点赞
        onVote() {
            this.$emit('vote', {
                postId: this.item._id,
                index: this.index,
                listType: this.listType
            });
        },
        // 评论点击
        onCommentClick() {
            this.$emit('comment-click', {
                postId: this.item._id
            });
        },
        // 点赞图标加载失败
        onLikeIconError(e) {
            this.$emit('like-icon-error', e);
        }
    }
};
</script>

<style scoped>
/* 帖子项包装器样式 */
.post-item-wrapper {
    position: relative;
    background: var(--app-post-wrapper-bg, #fff);
    margin: var(--app-post-wrapper-margin, 0 0 20rpx 0);
    padding: 0;
    box-shadow: var(--app-post-wrapper-shadow, none);
    border-radius: var(--app-post-wrapper-radius, 0);
    border: var(--app-post-wrapper-border, none);
    border-bottom: var(--app-post-wrapper-divider, 1rpx solid #f0f0f0);
    border-left: 3rpx solid var(--app-post-original-accent-color, transparent);
    overflow: hidden;
    /* 列表项淡入动画 */
    animation: postFadeIn 0.35s ease-out;
    transform-origin: center top;
}

@keyframes postFadeIn {
    from {
        opacity: 0;
        transform: translateY(15rpx);
    }
    to {
        opacity: 1;
        transform: translateY(0);
    }
}

/* 原创帖子特殊样式 */
.post-item-wrapper.original-post {
    background: linear-gradient(90deg, rgba(235, 200, 141, 0.05) 0%, rgba(255, 255, 255, 0) 100%);
    border-left: 3rpx solid var(--app-post-original-accent-color, #ebc88d);
    position: relative;
}

/* 右上角三个点菜单按钮（缩小版） */
.more-menu-btn-top-right {
    position: absolute;
    top: 20rpx;
    right: 20rpx;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 8rpx;
    cursor: pointer;
    transition: all 0.2s ease;
    z-index: 10;
}

.more-menu-btn-top-right:active {
    transform: scale(0.9);
    opacity: 0.7;
}

.more-menu-dots-small {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 4rpx;
}

.more-menu-dots-small .dot-small {
    width: 8rpx;
    height: 8rpx;
    border-radius: 50%;
    background-color: var(--app-post-menu-dot-color, #666);
}

/* 外部作者信息样式 */
.author-info-outside {
    display: flex;
    align-items: center;
    padding: 20rpx 40rpx 10rpx 40rpx;
    background: var(--app-post-section-bg, #fff);
    border-radius: 0;
    box-shadow: none;
}

.author-info-outside .author-avatar {
    width: 60rpx;
    height: 60rpx;
    border-radius: 50%;
    margin-right: 15rpx;
    background-color: #f5f5f5;
    cursor: pointer;
}

.author-info-outside .author-name {
    font-size: 28rpx;
    color: var(--app-post-author-color, #333);
    font-weight: 500;
}

/* 匿名标签样式 */
.anonymous-tag {
    background: #ff6b6b;
    color: white;
    font-size: 20rpx;
    padding: 4rpx 8rpx;
    border-radius: 10rpx;
    margin-left: 10rpx;
    font-weight: 500;
}

/* 内容导航器样式 */
.post-content-navigator {
    display: block;
    background: transparent;
}

/* 导航器点击效果 - 更明显的反馈 */
.navigator-hover {
    background-color: rgba(0, 0, 0, 0.04);
    transform: scale(0.995);
    transition: all 0.12s ease;
}

.post-item {
    width: 100%;
    background: var(--app-post-section-bg, #fff);
    border-radius: 0;
    box-shadow: none;
    box-sizing: border-box;
    padding: 20rpx 40rpx 30rpx 40rpx;
}

.post-title {
    font-size: 36rpx;
    font-weight: bold;
    color: var(--app-post-title-color, #333333);
    margin-bottom: 15rpx;
    line-height: 1.4;
    word-break: break-word;
    overflow: hidden;
    text-overflow: ellipsis;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
}

/* 诗歌作者样式 */
.poem-author {
    font-size: 32rpx;
    color: var(--app-post-poem-author-color, #000);
    text-align: center;
    margin: 5rpx 0 15rpx 0;
    letter-spacing: 2rpx;
}

/* 隐藏标签 */
.hidden-tag { 
    font-size: 22rpx; 
    color: #ff6b6b; 
    margin-left: 8rpx; 
    padding: 2rpx 8rpx; 
    border: 1rpx solid #ffadb0; 
    border-radius: 6rpx; 
}

/* 图片容器占位样式 */
.image-container-wrapper {
    position: relative;
    width: 100%;
    background-color: #f0f0f0;
    overflow: hidden;
    border-radius: 8px;
    margin: 20rpx 0;
}

/* 让图片或swiper填充整个占位容器 */
.image-container-wrapper .post-image,
.image-container-wrapper .image-swiper {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
}

/* 多张图片的swiper样式 */
.image-swiper {
    width: 100%;
    background-color: #fff;
}

.swiper-item {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
}

.post-image {
    width: 100%;
    height: 100%;
    display: block;
    object-fit: contain;
    /* 图片加载淡入动画 */
    opacity: 0;
    animation: imageFadeIn 0.4s ease forwards;
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

.post-image:active {
    transform: scale(1.02);
    transition: transform 0.15s ease;
}

.post-image.single-image {
    width: 100%;
    height: auto;
    display: block;
    object-fit: cover;
}

.post-content {
    font-size: 28rpx;
    color: var(--app-post-content-color, #666666);
    line-height: 1.6;
    margin-top: 15rpx;
    word-break: break-word;
    overflow: hidden;
    text-overflow: ellipsis;
    display: -webkit-box;
    -webkit-line-clamp: 3;
    line-clamp: 3;
    -webkit-box-orient: vertical;
}

/* 标签样式 */
.post-tags {
    margin-top: 30rpx;
    margin-bottom: 10rpx;
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

/* 删除按钮区域样式 */
.delete-section {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-top: 20rpx;
    padding: 0 40rpx 0 40rpx;
    background: var(--app-post-section-bg, transparent);
}

/* 左侧时间区域 */
.time-left {
    flex: 1;
}

.button-group {
    display: flex;
    align-items: center;
}

.post-time {
    font-size: 24rpx;
    color: var(--app-post-time-color, #999);
}

/* 取消收藏按钮 */
.remove-favorite-btn {
    background-color: #f39c12;
    color: #fff;
    border: none;
    border-radius: 8rpx;
    font-size: 24rpx;
    padding: 8rpx 16rpx;
    line-height: 1.2;
    min-width: 100rpx;
    transition: background-color 0.2s ease;
}

.remove-favorite-btn:active {
    background-color: #e67e22;
}

.remove-favorite-btn::after {
    border: none;
}

/* ========== 互动区样式（feed模式） ========== */
.vote-section {
    display: flex;
    justify-content: space-between;
    align-items: center;
    /* 上移一点：收紧与内容的垂直间距 */
    margin-top: -8rpx;
    padding: 10rpx 60rpx 15rpx 60rpx;
    background: var(--app-post-section-bg, transparent);
}

.vote-count,
.comment-count {
    display: flex;
    align-items: center;
    font-size: 28rpx;
    color: var(--app-post-meta-color, #999);
    margin-left: 10rpx;
    transition: color 0.2s ease;
}

.comment-icon {
    width: 40rpx;
    height: 40rpx;
    margin-right: 8rpx;
}

.vote-count {
    margin-left: 10rpx;
}

.actions-left {
    display: flex;
    align-items: center;
}

.action-text {
    font-size: 28rpx;
    color: inherit;
}

.like-icon-container {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 8rpx;
    border-radius: 8rpx;
    margin-left: 20rpx;
    transition: transform 0.15s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}

.like-icon-container:active {
    transform: scale(0.85);
}

/* 点赞弹跳动画 */
.like-icon-container.bouncing {
    animation: likeBouncePop 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.6);
}

@keyframes likeBouncePop {
    0% { transform: scale(1); }
    25% { transform: scale(0.8); }
    50% { transform: scale(1.25); }
    75% { transform: scale(0.95); }
    100% { transform: scale(1); }
}

.like-icon {
    width: 48rpx;
    height: 48rpx;
    transition: transform 0.2s ease;
}

/* 点赞数字变化动画 */
.vote-count {
    transition: color 0.2s ease, transform 0.15s ease;
}

.vote-count.voted {
    color: #e74c3c;
}

.vote-count.vote-changed {
    animation: voteNumberPop 0.3s ease;
}

@keyframes voteNumberPop {
    0% { transform: scale(1); }
    50% { transform: scale(1.2); }
    100% { transform: scale(1); }
}

/* 组诗简单预览 */
.series-simple-preview {
    margin-top: 16rpx;
}
.series-meta-tag {
    margin-top: 16rpx;
    font-size: 24rpx;
    color: var(--app-post-meta-color, #999);
    font-style: italic;
}

/* 讨论类型帖子样式 */
.discussion-content {
    margin: 20rpx 0;
}

.discussion-sentence-group {
    margin-bottom: 30rpx;
}

.discussion-sentence-card {
    background: var(--app-post-discussion-quote-bg, var(--app-subtle-surface-bg, #f5f5f5));
    border-radius: 12rpx;
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
    color: var(--app-post-discussion-color, #989090);
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

/* 讨论评论预览样式 - 与普通帖子正文保持一致 */
.discussion-comment-preview {
    font-size: 28rpx;
    color: var(--app-post-content-color, #666666);
    line-height: 1.6;
    margin-top: 15rpx;
    word-break: break-word;
    overflow: hidden;
    text-overflow: ellipsis;
    display: -webkit-box;
    -webkit-line-clamp: 3;
    line-clamp: 3;
    -webkit-box-orient: vertical;
}
</style>
