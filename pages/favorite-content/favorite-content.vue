<template>
    <!-- pages/favorite-content/favorite-content.wxml -->
    <view class="container">
        <!-- 初始加载状态 -->
        <view v-if="isLoading && favorites.length === 0" class="loading-container">
            <view class="loading-text">加载中...</view>
        </view>

        <!-- 收藏内容列表 -->
        <view v-else-if="favorites.length > 0" class="favorites-container">
            <view :class="'post-item-wrapper ' + (item.isOriginal ? 'original-post' : '')" v-for="(item, index) in favorites" :key="index">
                <!-- 作者信息 -->

                <view class="author-info-outside">
                    <image
                        v-if="item.postAuthorAvatar"
                        class="author-avatar"
                        :src="item.postAuthorAvatar"
                        mode="aspectFill"
                        @error="onAvatarError"
                        @load="onAvatarLoad"
                        :data-postindex="index"
                        @tap.stop.prevent="navigateToUserProfile"
                        :data-user-id="item.postAuthorOpenid"
                    />
                    <text class="author-name">{{ item.postAuthorName }}</text>
                </view>

                <!-- 可点击的内容区域 - 跳转到详情页 -->

                <navigator class="post-content-navigator" :url="'/pages/post-detail/post-detail?id=' + item.postId" hover-class="navigator-hover">
                    <view class="post-item">
                        <view class="post-title">{{ item.postTitle }}</view>
                        <!-- 诗歌作者信息 -->
                        <view v-if="item.postIsPoem && item.postAuthor" class="poem-author">{{ item.postAuthor }}</view>

                        <!-- 图片显示逻辑 (已优化，使用 imageStyle 占位) -->
                        <view
                            v-if="item.imageUrls && item.imageUrls.length > 0"
                            class="image-container-wrapper"
                            :style="item.imageStyle"
                            @tap.stop.prevent="handlePreview"
                            :data-src="item.imageUrls[0]"
                            :data-original-image-urls="item.originalImageUrls || item.imageUrls"
                        >
                            <!-- 单张图片 -->
                            <block v-if="item.imageUrls.length === 1">
                                <image
                                    :id="'single-image-' + item.postId"
                                    class="post-image"
                                    :src="item.imageUrls[0]"
                                    mode="aspectFill"
                                    :lazy-load="true"
                                    @error="onImageError"
                                    @load="onImageLoad"
                                    :data-postid="item.postId"
                                    :data-postindex="index"
                                    data-imgindex="0"
                                    data-type="single"
                                />
                            </block>

                            <!-- 多张图片 -->
                            <block v-else-if="item.imageUrls.length > 1">
                                <swiper
                                    :id="'swiper-' + item.postId"
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
                                                :data-postid="item.postId"
                                                :data-postindex="index"
                                                :data-imgindex="imgindex"
                                                data-type="multi"
                                            />
                                        </swiper-item>
                                    </block>
                                </swiper>
                            </block>
                        </view>

                        <view class="post-content" v-if="item.postContent" style="white-space: pre-wrap">{{ item.postContent }}</view>

                        <!-- 标签显示 -->
                        <view v-if="item.postTags && item.postTags.length > 0" class="post-tags">
                            <text class="post-tag" @tap.stop.prevent="onTagClick" :data-tag="item" v-for="(item, index1) in item.postTags" :key="index1">#{{ item }}</text>
                        </view>
                    </view>
                </navigator>

                <!-- 取消收藏按钮区域 -->

                <view class="delete-section">
                    <view class="time-left">
                        <text class="favorite-time">收藏于 {{ item.formattedCreateTime || '未知时间' }}</text>
                    </view>
                    <view class="button-group">
                        <button class="remove-favorite-btn" size="mini" @tap.stop.prevent="removeFavorite" :data-favorite-id="item._id" :data-index="index">取消收藏</button>
                    </view>
                </view>
            </view>
        </view>

        <!-- 空状态 -->
        <view v-else class="empty-container">
            <view class="empty-icon">📖</view>
            <view class="empty-text">收藏夹是空的</view>
            <view class="empty-subtext">去发现一些好诗收藏起来吧</view>
            <button @tap="manualLoad" style="margin-top: 20rpx; padding: 15rpx 30rpx; background: #9ed7ee; color: white; border-radius: 8rpx; font-size: 26rpx">刷新</button>
        </view>

        <!-- 加载更多 -->
        <view v-if="favorites.length > 0 && isLoading" class="loading-more">
            <view class="loading-text">加载中...</view>
        </view>

        <!-- 没有更多 -->
        <view v-if="favorites.length > 0 && !hasMore && !isLoading" class="no-more">
            <text>没有更多了</text>
        </view>
    </view>
</template>

<script>
// pages/favorite-content/favorite-content.js
export default {
    data() {
        return {
            folderId: '',
            folderName: '',
            favorites: [],
            isLoading: true,
            hasMore: true,
            page: 0,
            pageSize: 10,
            swiperHeights: {},

            // 每个帖子的swiper高度，跟随第一张图片
            // 单图瘦高图钳制高度
            imageClampHeights: {},

            imgindex: 0,
            img: ''
        };
    },
    onLoad: function (options) {
        const folderId = options.folderId;
        const folderName = options.folderName || '';
        if (!folderId) {
            uni.showToast({
                title: '参数错误：收藏夹ID为空',
                icon: 'none'
            });
            this.setData({
                isLoading: false
            });
            return;
        }

        // 解码文件夹名称
        let decodedFolderName = folderName;
        try {
            decodedFolderName = decodeURIComponent(folderName || '');
        } catch (e) {
            console.log('CatchClause', e);
            console.log('CatchClause', e);
            decodedFolderName = folderName;
        }

        // 重置所有状态，确保可以加载
        this.setData({
            folderId: folderId,
            folderName: decodedFolderName,
            favorites: [],
            // 清空数据
            page: 0,
            // 重置页码
            hasMore: true,
            // 重置加载状态
            isLoading: false // 重置加载状态
        });

        // 设置标题并加载数据
        uni.setNavigationBarTitle({
            title: decodedFolderName || '收藏夹'
        });
        this.loadFavorites();
    },
    onShow: function () {
        // 不执行任何操作，避免干扰加载
    },
    onPullDownRefresh: function () {
        this.setData({
            favorites: [],
            page: 0,
            hasMore: true,
            isLoading: false
        });
        this.loadFavorites(() => {
            uni.stopPullDownRefresh();
        });
    },
    onReachBottom: function () {
        if (this.hasMore) {
            this.loadFavorites();
        }
    },
    methods: {
        // 兼容性云函数调用方法
        callCloudFunction(name, data = {}) {
            console.log(`🔍 [收藏内容页] 调用云函数: ${name}`, data);
            
            return new Promise((resolve, reject) => {
                // 使用新的平台检测工具
                const { getCurrentPlatform, getCloudFunctionMethod } = require('../../utils/platformDetector.js');
                
                const platform = getCurrentPlatform();
                const method = getCloudFunctionMethod();
                
                console.log(`🔍 [收藏内容页] 运行环境检测 - 平台: ${platform}, 方法: ${method}`);
                
                if (method === 'tcb') {
                    // 使用TCB调用云函数（H5和App环境）
                    if (this.$tcb && this.$tcb.callFunction) {
                        console.log(`🔍 [收藏内容页] TCB环境调用云函数: ${name}`);
                        this.$tcb.callFunction({
                            name: name,
                            data: data
                        }).then(resolve).catch(reject);
                    } else {
                        console.error(`❌ [收藏内容页] TCB实例不可用`);
                        reject(new Error('TCB实例不可用'));
                    }
                } else if (method === 'wx-cloud') {
                    // 使用微信云开发调用云函数（小程序环境）
                    if (wx.cloud && wx.cloud.callFunction) {
                        console.log(`🔍 [收藏内容页] 小程序环境调用云函数: ${name}`);
                        wx.cloud.callFunction({
                            name: name,
                            data: data,
                            success: (res) => {
                                console.log(`✅ [收藏内容页] 云函数调用成功: ${name}`, res);
                                resolve(res);
                            },
                            fail: (err) => {
                                console.error(`❌ [收藏内容页] 云函数调用失败: ${name}`, err);
                                reject(err);
                            }
                        });
                    } else {
                        console.error(`❌ [收藏内容页] 微信云开发不可用`);
                        reject(new Error('微信云开发不可用'));
                    }
                } else {
                    console.error(`❌ [收藏内容页] 不支持的云函数调用方式: ${method}`);
                    reject(new Error(`不支持的云函数调用方式: ${method}`));
                }
            });
        },
        loadFavorites: function (callback) {
            if (!this.folderId) {
                this.setData({
                    isLoading: false
                });
                return;
            }
            this.setData({
                isLoading: true
            });
            const skip = this.page * this.pageSize;

            // 设置加载超时机制
            const loadTimeout = setTimeout(() => {
                console.error('加载超时，强制结束加载状态');
                this.setData({
                    isLoading: false
                });
                uni.showToast({
                    title: '加载超时，请重试',
                    icon: 'none'
                });
            }, 10000); // 10秒超时

            // 添加全局错误保护
            try {
                this.callCloudFunction('getMyProfileData', {
                        action: 'getFavoritesByFolder',
                        folderId: this.folderId,
                        skip: skip,
                        limit: this.pageSize
                    }).then((res) => {
                        clearTimeout(loadTimeout);
                        console.log('云函数调用成功，返回结果:', res);
                        console.log('res.result:', res.result);
                        if (res.result && res.result.success) {
                            const newFavorites = res.result.favorites || [];
                            console.log('【收藏夹】获取到的收藏数据:', newFavorites);

                            // 格式化时间和设置图片样式
                            newFavorites.forEach((favorite, index) => {
                                favorite.formattedCreateTime = this.formatTime(favorite.createTime);
                                favorite.formattedPostCreateTime = this.formatTime(favorite.postCreateTime);

                                // 调试日志：检查图片数据
                                console.log(`【收藏夹】帖子${index}图片数据:`, {
                                    postId: favorite._id,
                                    postTitle: favorite.title,
                                    imageUrls: favorite.imageUrls,
                                    originalImageUrls: favorite.originalImageUrls,
                                    hasImageUrls: !!(favorite.imageUrls && favorite.imageUrls.length > 0)
                                });

                                // 设置图片样式占位符（与我的页面保持一致）
                                if (favorite.imageUrls && favorite.imageUrls.length > 0) {
                                    favorite.imageStyle = `height: 0; padding-bottom: 75%;`; // 4:3 宽高比占位
                                    console.log(`【收藏夹】设置图片样式:`, favorite.imageStyle);
                                }
                            });
                            const allFavorites = this.page === 0 ? newFavorites : this.favorites.concat(newFavorites);
                            this.setData({
                                favorites: allFavorites,
                                page: this.page + 1,
                                hasMore: newFavorites.length === this.pageSize,
                                isLoading: false
                            });
                        } else {
                            uni.showToast({
                                title: res.result?.message || '加载失败',
                                icon: 'none'
                            });
                            this.setData({
                                isLoading: false
                            });
                        }
                    }).catch((err) => {
                        clearTimeout(loadTimeout);
                        console.error('云函数调用失败:', err);
                        uni.showToast({
                            title: '网络错误',
                            icon: 'none'
                        });
                        this.setData({
                            isLoading: false
                        });
                    }).finally(() => {
                        clearTimeout(loadTimeout);
                        if (typeof callback === 'function') {
                            callback();
                        }
                    });
            } catch (error) {
                console.error('加载过程发生异常:', error);
                clearTimeout(loadTimeout);
                this.setData({
                    isLoading: false
                });
                uni.showToast({
                    title: '加载异常，请重试',
                    icon: 'none'
                });
                if (typeof callback === 'function') {
                    callback();
                }
            }
        },

        // 重新加载
        manualLoad: function () {
            if (!this.folderId) {
                uni.showToast({
                    title: '收藏夹ID为空',
                    icon: 'none'
                });
                return;
            }
            this.setData({
                favorites: [],
                page: 0,
                hasMore: true,
                isLoading: false
            });
            this.loadFavorites();
        },

        // 点击收藏项跳转到详情页
        onFavoriteTap: function (e) {
            const postId = e.currentTarget.dataset.postId;
            uni.navigateTo({
                url: `/pages/post-detail/post-detail?id=${postId}`
            });
        },

        // 长按收藏项显示操作选项
        onFavoriteLongPress: function (e) {
            const favoriteId = e.currentTarget.dataset.favoriteId;
            const postTitle = e.currentTarget.dataset.postTitle;
            uni.showActionSheet({
                itemList: ['取消收藏'],
                success: (res) => {
                    if (res.tapIndex === 0) {
                        this.removeFavorite(favoriteId, postTitle);
                    }
                }
            });
        },

        // 取消收藏
        removeFavorite: function (e) {
            const favoriteId = e.currentTarget.dataset.favoriteId;
            const index = e.currentTarget.dataset.index;
            const favorite = this.favorites[index];
            const postTitle = favorite ? favorite.postTitle : '未知标题';
            uni.showModal({
                title: '确认取消收藏',
                content: `确定要取消收藏"${postTitle}"吗？`,
                success: (res) => {
                    if (res.confirm) {
                        uni.showLoading({
                            title: '处理中...'
                        });
                        this.callCloudFunction('getMyProfileData', {
                                action: 'removeFromFavorite',
                                favoriteId: favoriteId
                            }).then((res) => {
                                uni.hideLoading();
                                if (res.result && res.result.success) {
                                    uni.showToast({
                                        title: '取消收藏成功'
                                    });
                                    // 从列表中移除该项
                                    const favorites = this.favorites.filter((item) => item._id !== favoriteId);
                                    this.setData({
                                        favorites: favorites
                                    });
                                } else {
                                    uni.showToast({
                                        title: res.result.message || '操作失败',
                                        icon: 'none'
                                    });
                                }
                            }).catch((err) => {
                                uni.hideLoading();
                                console.error('取消收藏失败:', err);
                                uni.showToast({
                                    title: '网络错误',
                                    icon: 'none'
                                });
                            });
                    }
                }
            });
        },

        // 图片预览
        onImagePreview: function (e) {
            const current = e.currentTarget.dataset.src;
            const urls = e.currentTarget.dataset.urls;
            if (current && urls && urls.length > 0) {
                uni.previewImage({
                    current,
                    urls
                });
            }
        },

        // 预览图片（与点赞页面统一）
        handlePreview: function (event) {
            const currentUrl = event.currentTarget.dataset.src;
            const originalUrls = event.currentTarget.dataset.originalImageUrls;
            if (currentUrl) {
                uni.previewImage({
                    current: currentUrl,
                    urls: originalUrls || [currentUrl]
                });
            } else {
                uni.showToast({
                    title: '图片加载失败',
                    icon: 'none'
                });
            }
        },

        // 图片加载错误处理（与点赞页面统一）
        onImageError: function (e) {
            console.error('【收藏夹】图片加载失败', e);
            const { src } = e.detail;
            console.error('【收藏夹】失败的图片URL:', src);
            // 获取当前图片的上下文信息
            const { postindex, imgindex } = e.currentTarget.dataset;
            if (postindex !== undefined && imgindex !== undefined) {
                const favorite = this.favorites[postindex];
                console.error('【收藏夹】图片加载失败的上下文:', {
                    postId: favorite ? favorite._id : 'unknown',
                    postTitle: favorite ? favorite.title : 'unknown',
                    imageIndex: imgindex,
                    imageUrl: src,
                    allImageUrls: favorite ? favorite.imageUrls : 'unknown'
                });
            }
            // 不显示toast，避免频繁弹窗，但记录错误
            console.error('【收藏夹】图片加载失败详情:', {
                error: e.detail,
                src: src,
                dataset: e.currentTarget.dataset
            });
        },

        // 图片加载成功时，动态设置swiper高度（与点赞页面统一）
        onImageLoad: function (e) {
            const { postid, postindex = 0, imgindex = 0, type } = e.currentTarget.dataset;
            const { width: originalWidth, height: originalHeight } = e.detail;
            console.log('【收藏夹】图片加载成功:', {
                postid,
                postindex,
                imgindex,
                type,
                width: originalWidth,
                height: originalHeight,
                src: e.currentTarget.src
            });
            if (!originalWidth || !originalHeight) {
                return;
            }

            // 多图 Swiper 逻辑
            if (type === 'multi' && imgindex === 0) {
                const query = uni.createSelectorQuery().in(this);
                query
                    .select(`#swiper-${postid}`)
                    .boundingClientRect((rect) => {
                        if (rect && rect.width) {
                            const containerWidth = rect.width;
                            const actualRatio = originalWidth / originalHeight;
                            const maxRatio = 1.7777777777777777;
                            const minRatio = 0.5625;
                            let targetRatio = actualRatio;
                            if (actualRatio > maxRatio) targetRatio = maxRatio;
                            else if (actualRatio < minRatio) {
                                targetRatio = minRatio;
                            }
                            const displayHeight = containerWidth / targetRatio;
                            if (this.swiperHeights[postindex] !== displayHeight) {
                                this.setData({
                                    [`swiperHeights[${postindex}]`]: displayHeight
                                });
                            }
                        }
                    })
                    .exec();
            }
            // 单图
            if (type === 'single') {
                const actualRatio = originalWidth / originalHeight;
                const minRatio = 0.5625;
                if (actualRatio < minRatio) {
                    const query = uni.createSelectorQuery().in(this);
                    query
                        .select(`#single-image-${postid}`)
                        .boundingClientRect((rect) => {
                            if (rect && rect.width) {
                                const containerWidth = rect.width;
                                const displayHeight = containerWidth / minRatio;
                                if (this.imageClampHeights[postid] !== displayHeight) {
                                    this.setData({
                                        [`imageClampHeights.${postid}`]: displayHeight
                                    });
                                }
                            }
                        })
                        .exec();
                }
            }
        },

        // 格式化时间
        formatTime: function (dateString) {
            if (!dateString) {
                return '';
            }
            const date = new Date(dateString);
            const now = new Date();
            const diff = now.getTime() - date.getTime();
            const minutes = Math.floor(diff / 60000);
            if (minutes < 1) {
                return '刚刚';
            }
            if (minutes < 60) {
                return `${minutes}分钟前`;
            }
            const hours = Math.floor(diff / 3600000);
            if (hours < 24) {
                return `${hours}小时前`;
            }
            const days = Math.floor(diff / 86400000);
            if (days < 7) {
                return `${days}天前`;
            }
            return date.toLocaleDateString();
        },

        // 头像加载错误处理
        onAvatarError: function (e) {
            console.error('头像加载失败:', e);
            // 设置默认头像
            const { postindex } = e.currentTarget.dataset;
            if (postindex !== undefined) {
                const favorites = this.favorites;
                if (favorites[postindex]) {
                    favorites[postindex].postAuthorAvatar = '/static/images/avatar.png'; // 使用默认头像
                    this.setData({
                        favorites: favorites
                    });
                }
            }
        },

        // 头像加载成功处理
        onAvatarLoad: function (e) {
            // 头像加载成功，可以在这里做一些处理
        },

        // 跳转到用户资料页
        navigateToUserProfile: function (e) {
            const userId = e.currentTarget.dataset.userId;
            if (userId) {
                uni.navigateTo({
                    url: `/pages/user-profile/user-profile?userId=${userId}`
                });
            }
        },

        // 标签点击处理
        onTagClick: function (e) {
            const tag = e.currentTarget.dataset.tag;
            if (tag) {
                // 可以跳转到标签页面或搜索页面
                uni.navigateTo({
                    url: `/pages/search/search?keyword=${encodeURIComponent(tag)}`
                });
            }
        }
    }
};
</script>
<style>
/* pages/favorite-content/favorite-content.wxss */
.container {
    padding: 20rpx;
    background-color: #f7f8fa;
    min-height: 100vh;
}

.loading-container {
    display: flex;
    justify-content: center;
    align-items: center;
    height: 400rpx;
    background-color: #fff;
    border-radius: 16rpx;
    margin: 30rpx;
    box-shadow: 0 4rpx 12rpx rgba(0, 0, 0, 0.05);
}

.loading-text {
    color: #999;
    font-size: 28rpx;
}

.favorites-container {
    margin: 0 30rpx 30rpx 30rpx;
}

/* 新增：帖子项包装器样式 */
.post-item-wrapper {
    background: #fff;
    border-radius: 16rpx;
    margin-bottom: 20rpx;
    padding: 30rpx;
    box-shadow: 0 2rpx 12rpx rgba(0, 0, 0, 0.06);
}

/* 原创帖子特殊样式 */
.post-item-wrapper.original-post {
    border: 3rpx solid #ebc88d;
    box-shadow: 0 4rpx 20rpx rgba(235, 200, 141, 0.3), 0 2rpx 12rpx rgba(0, 0, 0, 0.06);
    position: relative;
}

/* 原创帖子光影效果 */
.post-item-wrapper.original-post::before {
    content: '';
    position: absolute;
    top: -2rpx;
    left: -2rpx;
    right: -2rpx;
    bottom: -2rpx;
    background: linear-gradient(45deg, #ebc88d, #f4d03f, #ebc88d);
    border-radius: 18rpx;
    z-index: -1;
    opacity: 0.6;
    filter: blur(8rpx);
}

/* 新增：内容导航器样式 */
.post-content-navigator {
    display: block;
    background: transparent;
}

/* 新增：导航器点击效果 */
.navigator-hover {
    opacity: 0.8;
}

/* 作者信息样式 */
.author-info-outside {
    display: flex;
    align-items: center;
    margin-bottom: 20rpx;
}

.author-avatar {
    width: 60rpx;
    height: 60rpx;
    border-radius: 50%;
    margin-right: 15rpx;
    background-color: #f5f5f5;
}

.author-name {
    font-size: 28rpx;
    color: #333;
    font-weight: 500;
}

.post-title {
    font-size: 32rpx;
    font-weight: bold;
    color: #333333;
    margin-bottom: 10rpx;
    line-height: 1.4;
    word-break: break-word;
    overflow: hidden;
    text-overflow: ellipsis;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
}

/* 诗歌作者信息 */
.poem-author {
    font-size: 26rpx;
    color: #666;
    font-style: italic;
    margin-bottom: 10rpx;
}

.post-content {
    font-size: 26rpx;
    color: #666666;
    line-height: 1.5;
    margin-bottom: 15rpx;
    word-break: break-word;
    overflow: hidden;
    text-overflow: ellipsis;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    white-space: pre-wrap;
}

/* 图片容器样式 - 与首页保持一致 */
.image-container-wrapper {
    position: relative;
    width: 100%;
    background-color: #f0f0f0; /* 占位时的背景色，很重要 */
    overflow: hidden;
    border-radius: 8px; /* 可以加个圆角，让占位块更好看 */
    margin: 20rpx 0; /* 图片和下方内容的间距 */
}

/* 让图片或Swiper填充整个占位容器 */
.image-container-wrapper .post-image,
.image-container-wrapper .image-swiper {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
}

.post-image {
    transition: transform 0.3s ease;
}

.post-image:active {
    transform: scale(1.05);
}

.image-swiper {
    width: 100%;
    border-radius: 12rpx;
    overflow: hidden;
}

/* 标签样式 - 与首页和详情页保持一致 */
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

/* 删除/操作按钮区域 */
.delete-section {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-top: 20rpx;
    padding-top: 20rpx;
    border-top: 1rpx solid #f0f0f0;
}

.time-left {
    flex: 1;
}

.favorite-time {
    font-size: 24rpx;
    color: #999;
}

.button-group {
    display: flex;
    gap: 10rpx;
}

.remove-favorite-btn {
    background: #ff4757;
    color: white;
    border: none;
    border-radius: 8rpx;
    font-size: 24rpx;
    padding: 8rpx 16rpx;
}

.remove-favorite-btn:active {
    background: #ff3742;
}

/* 加载更多样式 */
.loading-more {
    display: flex;
    justify-content: center;
    align-items: center;
    padding: 30rpx;
    color: #999;
    font-size: 28rpx;
}

.no-more {
    display: flex;
    justify-content: center;
    align-items: center;
    padding: 30rpx;
    color: #999;
    font-size: 28rpx;
}

/* 空状态样式 */
.empty-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 100rpx 30rpx;
    text-align: center;
}

.empty-icon {
    font-size: 80rpx;
    margin-bottom: 20rpx;
    opacity: 0.5;
}

.empty-text {
    font-size: 32rpx;
    color: #666;
    margin-bottom: 10rpx;
}

.empty-subtext {
    font-size: 26rpx;
    color: #999;
}
</style>
