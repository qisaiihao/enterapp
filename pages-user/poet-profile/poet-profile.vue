<template>
    <view class="container">
        <!-- 骨架屏：当 isLoading 为 true 时显示 -->
        <view v-if="isLoading">
            <skeleton pageType="user-profile" />
        </view>

        <!-- 主要内容 -->
        <view v-else class="main-content">
            <!-- 诗人信息卡片 -->
            <view class="profile-card profile-card-center">
                <view class="profile-avatar-large" @tap="onAvatarTap">
                    <image :src="(poetInfo.avatar && poetInfo.avatar.trim()) || '/static/images/avatar.png'" mode="aspectFill" @error="onAvatarError"></image>
                </view>
                <view class="profile-info-center">
                    <text class="profile-name-center">{{ poetInfo.name || '未知诗人' }}</text>
                    <view class="profile-bio-wrapper">
                        <view v-if="!isEditingBio" @tap="onBioTap">
                            <text class="profile-bio-center">{{ poetInfo.bio || '暂无诗人简介' }}</text>
                            <text v-if="!poetInfo.bio && canEdit" class="bio-edit-hint">（点击可编辑简介、头像）</text>
                        </view>
                        <view v-else class="bio-edit-wrapper">
                            <textarea 
                                class="bio-textarea"
                                v-model="editingBio"
                                placeholder="输入诗人简介..."
                                maxlength="200"
                                :auto-height="true"
                            ></textarea>
                            <view class="bio-edit-actions">
                                <button class="bio-btn cancel" @tap="cancelEditBio">取消</button>
                                <button class="bio-btn confirm" @tap="saveBio" :loading="savingBio">保存</button>
                            </view>
                        </view>
                    </view>
                    <view class="profile-stats-row">
                        <text class="profile-stat">共 {{ postCount }} 首诗作</text>
                    </view>
                </view>
            </view>

            <!-- 诗人作品列表 -->
            <view class="posts-section">
                <view class="section-header">
                    <text class="section-title">诗作</text>
                </view>
                
                <block v-if="poetPosts.length > 0">
                    <view class="post-item-wrapper" v-for="(item, index) in poetPosts" :key="item._id">
                        <view class="author-info-outside">
                            <image
                                class="author-avatar"
                                :src="item.authorAvatar || '/static/images/avatar.png'"
                                mode="aspectFill"
                                @error="onPostAvatarError"
                                :data-postindex="index"
                                @tap.stop.prevent="navigateToUserProfile"
                                :data-user-id="item._openid"
                            ></image>
                            <text class="author-name">{{ item.authorName || '匿名用户' }}</text>
                            <text class="uploader-label">上传</text>
                        </view>

                        <navigator class="post-content-navigator" :url="'/pages/post-detail/post-detail?id=' + item._id" hover-class="navigator-hover">
                            <view class="post-item">
                                <view class="post-title">{{ item.title }}</view>
                                <view
                                    v-if="item.imageUrls && item.imageUrls.length > 0"
                                    class="image-container-wrapper"
                                    :style="item.imageStyle"
                                    @tap.stop.prevent="handlePreview"
                                    :data-src="item.imageUrls[0]"
                                    :data-original-image-urls="item.originalImageUrls || item.imageUrls"
                                >
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
                                            :data-postindex="index"
                                            data-imgindex="0"
                                            data-type="single"
                                        />
                                    </block>
                                    <block v-else-if="item.imageUrls.length > 1">
                                        <swiper
                                            :id="'swiper-' + item._id"
                                            class="image-swiper"
                                            :indicator-dots="true"
                                            :circular="true"
                                            :style="'height: ' + (swiperHeights[index] ? swiperHeights[index] + 'px' : '220px') + ';'"
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
                                                        @tap.stop.prevent="handlePreview"
                                                        :data-src="img"
                                                        :data-original-image-urls="item.originalImageUrls || item.imageUrls"
                                                        :data-postid="item._id"
                                                        :data-postindex="index"
                                                        :data-imgindex="imgindex"
                                                        data-type="multi"
                                                    />
                                                </swiper-item>
                                            </block>
                                        </swiper>
                                    </block>
                                </view>
                                <view class="post-content" v-if="item.content" style="white-space: pre-wrap">{{ item.content }}</view>
                                <view v-if="item.tags && item.tags.length > 0" class="post-tags">
                                    <text class="post-tag" v-for="(tag, tagIndex) in item.tags" :key="tagIndex">#{{ tag }}</text>
                                </view>
                            </view>
                        </navigator>
                        <view class="delete-section">
                            <view class="time-left">
                                <text class="post-time">{{ item.formattedCreateTime || '未知时间' }}</text>
                            </view>
                        </view>
                    </view>
                    <view class="loading-footer">
                        <block v-if="postsLoading">
                            <text>加载中...</text>
                        </block>
                        <block v-else-if="!hasMore && poetPosts.length > 0">
                            <text>--- 已经到底了 ---</text>
                        </block>
                    </view>
                    <view style="height: 200rpx"></view>
                </block>
                <!-- 骨架屏：数据未加载完成时显示 -->
                <view v-else-if="!postsHasEverLoaded">
                    <skeleton pageType="user-posts" />
                </view>
                <!-- 真正的空状态 -->
                <view v-else class="empty-tip"><text>暂无该诗人的作品</text></view>
            </view>
        </view>
    </view>
</template>

<script>
import { getPoetInfo, getPoetPosts, updatePoetInfo, invalidatePoetInfo, invalidatePoetPosts } from '@/api-cache/poet.js';
import { hydrateTempUrls, warmTempUrlsFromPosts } from '../../_utils/hydrate-temp-urls';
import fileUrlCache from '@/cache/core/file-url';
import skeleton from '@/components/skeleton/skeleton';
const { formatRelativeTime } = require('../../utils/time.js');
const { previewImage } = require('../../utils/imagePreview.js');
const { cloudCall } = require('../../utils/cloudCall.js');
const postGalleryMixin = require('../../mixins/postGallery.js');

const PAGE_SIZE = 10;

export default {
    components: {
        skeleton
    },
    mixins: [postGalleryMixin],
    data() {
        return {
            poetName: '',  // 诗人名字（路由参数）
            poetInfo: {
                name: '',
                avatar: '',
                bio: ''
            },
            poetPosts: [],
            postCount: 0,
            
            isLoading: true,
            postsLoading: false,
            postsHasEverLoaded: false,
            
            page: 0,
            hasMore: true,
            PAGE_SIZE: PAGE_SIZE,
            swiperHeights: {},
            imageClampHeights: {},
            
            // 编辑相关
            canEdit: false,  // 是否可以编辑诗人信息
            isEditingBio: false,
            editingBio: '',
            savingBio: false
        };
    },
    onLoad(options) {
        const poetName = options.poetName ? decodeURIComponent(options.poetName) : '';
        if (!poetName) {
            uni.showToast({
                title: '诗人信息获取失败',
                icon: 'none'
            });
            uni.navigateBack();
            return;
        }
        this.poetName = poetName;
        this.loadPoetProfile();
    },
    onPullDownRefresh() {
        invalidatePoetInfo(this.poetName);
        invalidatePoetPosts(this.poetName);
        
        this.setData({
            poetPosts: [],
            page: 0,
            hasMore: true,
            swiperHeights: {},
            imageClampHeights: {},
            postsHasEverLoaded: false
        });
        this.loadPoetProfile(() => {
            uni.stopPullDownRefresh();
        });
    },
    onReachBottom() {
        if (!this.hasMore || this.postsLoading) return;
        this.loadMorePosts();
    },
    methods: {
        setData(data) {
            Object.keys(data).forEach(key => {
                this[key] = data[key];
            });
        },
        
        // 加载诗人信息和作品
        async loadPoetProfile(cb) {
            this.setData({ isLoading: true });
            
            try {
                // 并行加载诗人信息和作品列表
                const [poetInfoRaw, postsResult] = await Promise.all([
                    getPoetInfo(this.poetName, this),
                    getPoetPosts({ poetName: this.poetName, page: 0, pageSize: PAGE_SIZE, context: this })
                ]);
                
                // 处理诗人头像 URL 转换
                let poetInfo = { ...poetInfoRaw };
                // 确保空字符串被当作无头像处理
                if (poetInfo.avatar && poetInfo.avatar.trim() && poetInfo.avatar.startsWith('cloud://')) {
                    try {
                        const urlMap = await fileUrlCache.getTempUrls([poetInfo.avatar]);
                        if (urlMap[poetInfo.avatar]) {
                            poetInfo.avatar = urlMap[poetInfo.avatar];
                        }
                    } catch (e) {
                        console.error('转换诗人头像URL失败:', e);
                        poetInfo.avatar = '';  // 转换失败时清空
                    }
                } else if (!poetInfo.avatar || !poetInfo.avatar.trim()) {
                    // 确保空字符串被设置为空
                    poetInfo.avatar = '';
                }
                
                // 处理帖子数据
                let posts = postsResult.posts || [];
                posts.forEach(post => {
                    if (post.createTime) {
                        post.formattedCreateTime = this.formatTime(post.createTime);
                    }
                });
                
                // 处理cloud://协议的URL转换
                posts = await hydrateTempUrls(posts);
                warmTempUrlsFromPosts(posts);
                
                // 检查是否可以编辑（登录用户都可以编辑诗人信息）
                const app = getApp();
                const canEdit = !!(app.globalData && app.globalData.openid);
                
                this.setData({
                    poetInfo: poetInfo || { name: this.poetName, avatar: '', bio: '' },
                    poetPosts: posts,
                    postCount: postsResult.total || posts.length,
                    page: 1,
                    hasMore: posts.length === PAGE_SIZE,
                    canEdit,
                    postsHasEverLoaded: true
                });
                
                uni.setNavigationBarTitle({ title: poetInfo.name || this.poetName });
            } catch (err) {
                console.error('加载诗人信息失败:', err);
                uni.showToast({ title: '加载失败，请重试', icon: 'none' });
                this.setData({ postsHasEverLoaded: true });
            } finally {
                this.setData({ isLoading: false });
                if (typeof cb === 'function') cb();
            }
        },
        
        // 加载更多作品
        async loadMorePosts() {
            if (this.postsLoading || !this.hasMore) return;
            
            this.setData({ postsLoading: true });
            
            try {
                const postsResult = await getPoetPosts({
                    poetName: this.poetName,
                    page: this.page,
                    pageSize: PAGE_SIZE,
                    context: this
                });
                
                let posts = postsResult.posts || [];
                posts.forEach(post => {
                    if (post.createTime) {
                        post.formattedCreateTime = this.formatTime(post.createTime);
                    }
                });
                
                posts = await hydrateTempUrls(posts);
                warmTempUrlsFromPosts(posts);
                
                // 去重合并
                const existingIds = new Set(this.poetPosts.map(p => p._id));
                const newPosts = posts.filter(p => !existingIds.has(p._id));
                
                this.setData({
                    poetPosts: [...this.poetPosts, ...newPosts],
                    page: this.page + 1,
                    hasMore: posts.length === PAGE_SIZE
                });
            } catch (err) {
                console.error('加载更多作品失败:', err);
                uni.showToast({ title: '加载失败', icon: 'none' });
            } finally {
                this.setData({ postsLoading: false });
            }
        },
        
        // 格式化时间
        formatTime(time) {
            return formatRelativeTime(time);
        },
        
        // 点击头像更换
        onAvatarTap() {
            if (!this.canEdit) return;
            
            uni.showActionSheet({
                itemList: ['更换诗人照片'],
                success: (res) => {
                    if (res.tapIndex === 0) {
                        this.chooseAndUploadAvatar();
                    }
                }
            });
        },
        
        // 选择并上传头像
        async chooseAndUploadAvatar() {
            try {
                const res = await new Promise((resolve, reject) => {
                    uni.chooseImage({
                        count: 1,
                        sizeType: ['compressed'],
                        sourceType: ['album', 'camera'],
                        success: resolve,
                        fail: reject
                    });
                });
                
                if (!res.tempFilePaths || res.tempFilePaths.length === 0) return;
                
                uni.showLoading({ title: '上传中...' });
                
                const result = await updatePoetInfo({
                    poetName: this.poetName,
                    avatarPath: res.tempFilePaths[0],
                    context: this
                });
                
                if (result.success) {
                    console.log('【诗人头像更新】返回的avatar:', result.avatar);
                    
                    // 如果返回的是 cloud:// 格式，需要转换
                    let avatarUrl = result.avatar;
                    if (avatarUrl && avatarUrl.startsWith('cloud://')) {
                        try {
                            const urlMap = await fileUrlCache.getTempUrls([avatarUrl]);
                            if (urlMap[avatarUrl]) {
                                avatarUrl = urlMap[avatarUrl];
                            }
                        } catch (e) {
                            console.error('转换头像URL失败:', e);
                        }
                    }
                    
                    console.log('【诗人头像更新】最终的avatarUrl:', avatarUrl);
                    this.setData({
                        poetInfo: {
                            ...this.poetInfo,
                            avatar: avatarUrl
                        }
                    });
                    console.log('【诗人头像更新】setData后 poetInfo.avatar:', this.poetInfo.avatar);
                    uni.showToast({ title: '更新成功', icon: 'success' });
                }
            } catch (err) {
                console.error('上传头像失败:', err);
                uni.showToast({ title: '上传失败', icon: 'none' });
            } finally {
                uni.hideLoading();
            }
        },
        
        // 点击简介开始编辑
        onBioTap() {
            if (!this.canEdit) return;
            
            this.setData({
                isEditingBio: true,
                editingBio: this.poetInfo.bio || ''
            });
        },
        
        // 取消编辑简介
        cancelEditBio() {
            this.setData({
                isEditingBio: false,
                editingBio: ''
            });
        },
        
        // 保存简介
        async saveBio() {
            if (this.savingBio) return;
            
            this.setData({ savingBio: true });
            
            try {
                const result = await updatePoetInfo({
                    poetName: this.poetName,
                    bio: this.editingBio,
                    context: this
                });
                
                if (result.success) {
                    this.setData({
                        poetInfo: {
                            ...this.poetInfo,
                            bio: this.editingBio
                        },
                        isEditingBio: false
                    });
                    uni.showToast({ title: '保存成功', icon: 'success' });
                }
            } catch (err) {
                console.error('保存简介失败:', err);
                uni.showToast({ title: '保存失败', icon: 'none' });
            } finally {
                this.setData({ savingBio: false });
            }
        },
        
        // 跳转到用户主页
        navigateToUserProfile(e) {
            const userId = e.currentTarget.dataset.userId;
            if (!userId) return;
            
            const app = getApp();
            if (app.globalData && app.globalData.openid === userId) {
                uni.switchTab({ url: '/pages/my/my' });
            } else {
                uni.navigateTo({ url: `/pages-user/user-profile/user-profile?userId=${userId}` });
            }
        },
        
        // 图片预览
        handlePreview(e) {
            const dataset = e.currentTarget.dataset;
            const urls = dataset.originalImageUrls || [dataset.src];
            const current = dataset.src;
            previewImage(urls, current);
        },
        
        // 头像加载错误
        onAvatarError(e) {
            console.error('【诗人头像】加载失败，当前URL:', this.poetInfo.avatar, '错误:', e);
            // 确保设置为默认头像
            this.setData({
                poetInfo: {
                    ...this.poetInfo,
                    avatar: '/static/images/avatar.png'
                }
            });
        },
        
        // 帖子头像加载错误
        onPostAvatarError(e) {
            const index = e.currentTarget.dataset.postindex;
            if (index !== undefined && this.poetPosts[index]) {
                const posts = [...this.poetPosts];
                posts[index].authorAvatar = '/static/images/avatar.png';
                this.setData({ poetPosts: posts });
            }
        }
    }
};
</script>

<style>
.container {
    min-height: 100vh;
    background-color: #ffffff;
}

.main-content {
    width: 100%;
    min-height: 100vh;
    background-color: #ffffff;
}

/* 诗人信息卡片 */
.profile-card-center {
    position: relative;
    margin: 0;
    padding: 40rpx 40rpx 20rpx 40rpx;
    background-color: transparent;
    border-radius: 0;
    box-shadow: none;
    display: flex;
    flex-direction: column;
    align-items: center;
    overflow: visible;
}

.profile-avatar-large {
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    margin: 70rpx 0 40rpx 0;
    position: relative;
}

.profile-avatar-large image {
    width: 200rpx;
    height: 200rpx;
    border-radius: 50%;
    display: block;
    border: 4rpx solid #f0f0f0;
}

.avatar-edit-hint {
    position: absolute;
    bottom: -30rpx;
    font-size: 22rpx;
    color: #999;
}

.profile-info-center {
    display: flex;
    flex-direction: column;
    align-items: center;
    margin-top: 20rpx;
    width: 100%;
}

.profile-name-center {
    font-family: 'Inter', sans-serif;
    font-weight: 600;
    font-size: 36rpx;
    line-height: 44rpx;
    color: #000000;
    margin-bottom: 20rpx;
    text-align: center;
}

.profile-bio-wrapper {
    width: 100%;
    padding: 0 20rpx;
    box-sizing: border-box;
}

.profile-bio-center {
    font-family: 'Inter', sans-serif;
    font-weight: 400;
    font-size: 26rpx;
    line-height: 36rpx;
    color: #666666;
    text-align: center;
    margin-bottom: 20rpx;
    display: block;
}

.bio-edit-hint {
    font-family: 'Inter', sans-serif;
    font-weight: 400;
    font-size: 22rpx;
    line-height: 32rpx;
    color: #999999;
    text-align: center;
    display: block;
    margin-top: 8rpx;
}

.bio-edit-wrapper {
    width: 100%;
    margin-bottom: 20rpx;
}

.bio-textarea {
    width: 100%;
    min-height: 120rpx;
    padding: 20rpx;
    font-size: 26rpx;
    line-height: 36rpx;
    color: #333;
    background: #f8f8f8;
    border-radius: 12rpx;
    box-sizing: border-box;
}

.bio-edit-actions {
    display: flex;
    justify-content: flex-end;
    gap: 20rpx;
    margin-top: 16rpx;
}

.bio-btn {
    padding: 12rpx 32rpx;
    font-size: 26rpx;
    border-radius: 8rpx;
    line-height: 1.5;
}

.bio-btn.cancel {
    background: #f0f0f0;
    color: #666;
}

.bio-btn.confirm {
    background: #333;
    color: #fff;
}

.bio-btn::after {
    border: none;
}

.profile-stats-row {
    display: flex;
    justify-content: center;
    align-items: center;
    margin-top: 10rpx;
}

.profile-stat {
    font-size: 24rpx;
    color: #999;
}

/* 作品列表区域 */
.posts-section {
    margin-top: 20rpx;
}

.section-header {
    padding: 20rpx 40rpx;
    border-bottom: 1rpx solid #f0f0f0;
}

.section-title {
    font-size: 30rpx;
    font-weight: 600;
    color: #333;
}

.post-item-wrapper {
    background: #fff;
    margin-bottom: 20rpx;
    padding: 0;
    box-shadow: none;
    border-radius: 0;
    border-bottom: 1rpx solid #f0f0f0;
}

.post-content-navigator {
    display: block;
    background: transparent;
}

.navigator-hover {
    background-color: rgba(0, 0, 0, 0.02);
}

.author-info-outside {
    display: flex;
    align-items: center;
    padding: 20rpx 40rpx 10rpx 40rpx;
    background: #fff;
}

.author-info-outside .author-avatar {
    width: 60rpx;
    height: 60rpx;
    border-radius: 50%;
    margin-right: 15rpx;
    background-color: #f5f5f5;
}

.author-info-outside .author-name {
    font-size: 28rpx;
    color: #333;
    font-weight: 500;
}

.uploader-label {
    font-size: 22rpx;
    color: #999;
    margin-left: 10rpx;
}

.post-item {
    width: 100%;
    background: #fff;
    border-radius: 0;
    box-shadow: none;
    box-sizing: border-box;
    padding: 20rpx 40rpx 30rpx 40rpx;
}

.post-title {
    font-size: 36rpx;
    font-weight: bold;
    color: #333333;
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

.image-container-wrapper {
    position: relative;
    width: 100%;
    background-color: #f0f0f0;
    overflow: hidden;
    border-radius: 8px;
    margin: 20rpx 0;
}

.image-container-wrapper .post-image,
.image-container-wrapper .image-swiper {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
}

.image-swiper {
    width: 100%;
    background-color: #fff;
}

.post-image {
    width: 100%;
    height: 100%;
    display: block;
    object-fit: contain;
}

.post-content {
    font-size: 28rpx;
    color: #666666;
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

.post-tags {
    margin-top: 30rpx;
    margin-bottom: 10rpx;
    line-height: 1.5;
}

.post-tag {
    color: #24375f;
    font-size: 26rpx;
    margin-right: 10rpx;
}

.delete-section {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-top: 20rpx;
    padding: 0 40rpx 20rpx 40rpx;
}

.time-left .post-time {
    font-size: 24rpx;
    color: #999;
}

.loading-footer {
    text-align: center;
    padding: 20rpx 0;
    color: #999;
    font-size: 14px;
}

.empty-tip {
    display: flex;
    justify-content: center;
    align-items: center;
    padding: 60rpx 40rpx;
    color: #666;
    font-size: 28rpx;
}
</style>
