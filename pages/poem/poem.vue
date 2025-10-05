<template>
    <view>
        <!-- poem.wxml - 原创诗歌页面（路） -->
        <view class="container">
            <!-- 双图层清晰背景 -->
            <view class="background-wrapper">
                <image
                    :class="'bg-image ' + (item.visible ? 'visible' : '')"
                    :src="item.url"
                    mode="aspectFill"
                    @load="onBackgroundImageLoad"
                    :data-layer-index="index"
                    v-for="(item, index) in bgLayers"
                    :key="index"
                ></image>
            </view>
            <!-- 双图层模糊背景 -->
            <view class="blur-background-wrapper">
                <image
                    :class="'bg-image blur-image ' + (item.visible ? 'visible' : '')"
                    :src="item.url"
                    mode="aspectFill"
                    @load="onBackgroundImageLoad"
                    :data-layer-index="index"
                    v-for="(item, index) in bgLayers"
                    :key="index"
                ></image>
            </view>

            <!-- 骨架屏 -->
            <view v-if="isLoading && postList.length === 0" class="skeleton-container">
                <skeleton />
                <view class="loading-text">正在加载诗歌...</view>
            </view>

            <!-- 路模式（原创诗歌） -->
            <view v-if="postList.length > 0" class="poem-mode-container" @touchstart="touchStart" @touchend="touchEnd">
                <!-- 
      核心改动：
      不再使用 postList[currentPostIndex]，而是使用独立的 currentPost 对象。
      这样切换时，小程序只会更新 image 和 text 的内容，而不会重新渲染整个 view 结构。
    -->
                <view :class="'single-post-content ' + (isTransitioning ? 'is-transitioning' : '')" @tap.stop.prevent="onSinglePostTap" :data-postid="currentPost._id">
                    <!-- 作者信息 -->
                    <view class="single-author-info">
                        <image v-if="currentPost.authorAvatar" class="single-author-avatar" :src="currentPost.authorAvatar" mode="aspectFill" />
                        <text class="single-author-name">{{ currentPost.authorName }}</text>
                    </view>

                    <!-- 标题 -->
                    <view class="single-post-title" v-if="currentPost.title">{{ currentPost.title }}</view>
                    <!-- 诗歌作者信息 -->
                    <view v-if="currentPost.isPoem" class="single-poem-author">{{ currentPost.author || currentPost.authorName }}</view>

                    <!-- 内容 -->
                    <view class="single-post-content-text" v-if="currentPost.content" style="white-space: pre-wrap">{{ currentPost.content }}</view>

                    <!-- 作者签名 -->
                    <view v-if="currentAuthorSignature" class="user-signature">
                        <image class="signature-image" :src="currentAuthorSignature" mode="aspectFit" @error="onSignatureError" @load="onSignatureLoad"></image>
                    </view>
                </view>

                <view v-if="postList.length === 0 && !isLoading" class="empty-state">
                    <view class="empty-icon">🛤️</view>
                    <view class="empty-text">还没有路诗哦～</view>
                    <view class="empty-subtext">快去广场发现原创好诗吧！</view>
                </view>
            </view>

            <!-- 调试按钮 (仅在开发环境显示) -->
            <view v-if="true" class="debug-button" @tap="testPoemData">
                <view>🐛</view>
            </view>
        </view>

    </view>
</template>

<script>
import skeleton from '@/components/skeleton/skeleton';
import folderSelector from '@/components/folder-selector/folder-selector';
// poem.js
// 兼容H5环境，使用CloudBase SDK
// const db = wx.cloud.database(); // 小程序环境
// const db = this.$tcb.database(); // H5环境
const PAGE_SIZE = 5;
export default {
    components: {
        skeleton,
        folderSelector
    },
    data() {
        return {
            isLoading: true,

            // 默认显示骨架屏
            postList: [],

            currentPostIndex: 0,
            touchStartX: 0,
            touchEndX: 0,
            touchStartY: 0,
            touchEndY: 0,
            hasMore: true,
            page: 0,
            backgroundImage: '',

            // 这个变量可以废弃了，或者只用来做逻辑判断
            isTransitioning: false,

            preloadedImages: {},
            hasFirstLoad_var: false,

            // 新增：标记是否首次加载

            // --- 新增数据 ---
            currentPost: null,

            // 专门存放当前帖子的数据
            bgLayers: [
                // 管理背景图层的数组
                {
                    url: '',
                    visible: false
                },
                {
                    url: '',
                    visible: false
                }
            ],

            activeLayerIndex: 0,

            // 当前激活的图层索引 (0 或 1)

            // --- 用户签名相关 ---
            currentAuthorSignature: '',

            // 当前帖子作者的签名图片URL
            currentAuthorOpenid: '',

            // 当前作者的openid，用于防重复获取
            // 是否正在获取签名，防止重复调用
            isFetchingSignature: false,

            selected: 0,
            url: '',
            visible: false
        };
    },
    onLoad: function () {
        console.log('Poem 页面 onLoad');
        const app = getApp();
        // 检查预加载数据
        if (app.globalData.preloadedPoemData && app.globalData.preloadedPoemData.length > 0) {
            // 【情况A】预加载成功：直接渲染，不显示骨架屏
            console.log('Poem: 使用预加载数据');
            this.setData({
                postList: app.globalData.preloadedPoemData,
                isLoading: false,
                // 关键：直接关闭骨架屏
                page: 1,
                hasFirstLoad_var: true // 标记已首次加载
            });
            // 使用我们之前写的 updatePostDisplay 来统一更新界面
            this.updatePostDisplay(0);
            app.globalData.preloadedPoemData = null; // 用完即焚
            this._hasFirstLoad = true; // 标记已首次加载
        } else {
            // 【情况B】无预加载：显示骨架屏，并异步请求数据
            console.log('Poem: 无预加载数据，开始请求');
            this.getPostList();
        }
    },
    onShow: function () {
        // TabBar 状态更新，使用兼容性处理
        const { updateTabBarStatus } = require('../../utils/tabBarCompatibility.js');
        updateTabBarStatus(this, 1);

        // 检查是否需要刷新（发布帖子后）
        try {
            const shouldRefresh = uni.getStorageSync('shouldRefreshPoem');
            if (shouldRefresh) {
                console.log('【poem】检测到发布标记，刷新数据');
                uni.removeStorageSync('shouldRefreshPoem');
                this.refreshPoemData();
                return; // 刷新后直接返回，不执行后续逻辑
            }
        } catch (e) {
            console.log('CatchClause', e);
            console.log('CatchClause', e);
            console.error('检查刷新标记失败:', e);
        }

        // 首次进入时刷新数据，之后保持之前的内容
        if (!this._hasFirstLoad) {
            console.log('【poem】首次进入，刷新数据');
            this._hasFirstLoad = true; // 标记已首次加载
            // 只有在onLoad中没有预加载数据时才调用refreshPoemData
            if (this.postList.length === 0) {
                this.refreshPoemData();
            }
        } else {
            console.log('【poem】再次进入，保持之前内容');
        }
    },
    methods: {
        // 新增：刷新诗歌数据的方法
        refreshPoemData: function () {
            console.log('【poem】开始刷新诗歌数据');
            this.setData({
                postList: [],
                currentPostIndex: 0,
                page: 0,
                hasMore: true,
                isLoading: false, // 重置加载状态
                bgLayers: [
                    {
                        url: '',
                        visible: false
                    },
                    {
                        url: '',
                        visible: false
                    }
                ],
                activeLayerIndex: 0
            });
            this.getPostList();
        },

        // 获取指定作者的签名信息
        fetchAuthorSignature: function (authorOpenid) {
            if (!authorOpenid) {
                console.log('【poem】作者openid为空，不获取签名');
                this.setData({
                    currentAuthorSignature: ''
                });
                return;
            }

            // 防重复调用：如果是同一个作者且正在获取中，直接返回
            if (this.currentAuthorOpenid === authorOpenid && this.isFetchingSignature) {
                console.log('【poem】正在获取该作者签名，跳过重复调用');
                return;
            }

            // 防重复调用：如果是同一个作者且已有签名，直接返回
            if (this.currentAuthorOpenid === authorOpenid && this.currentAuthorSignature) {
                console.log('【poem】该作者签名已存在，跳过重复获取');
                return;
            }
            console.log('【poem】获取作者签名信息，openid:', authorOpenid);

            // 设置获取状态
            this.setData({
                isFetchingSignature: true,
                currentAuthorOpenid: authorOpenid
            });

            // 临时调试：直接查询数据库
            // 修复：确保正确获取数据库实例
            let db;
            if (this.$tcb && this.$tcb.database) {
                db = this.$tcb.database();
                console.log('【poem】使用TCB数据库实例');
            } else if (typeof wx !== 'undefined' && wx.cloud && wx.cloud.database) {
                db = wx.cloud.database();
                console.log('【poem】使用微信云数据库实例');
            } else {
                console.error('【poem】无法获取数据库实例，$tcb和wx.cloud都不可用');
                this.setData({
                    currentAuthorSignature: '',
                    isFetchingSignature: false
                });
                return;
            }
            db.collection('users')
                .where({
                    _openid: authorOpenid
                })
                .get()
                .then((res) => {
                    console.log('【poem】直接查询数据库结果:', res);
                    if (res.data && res.data.length > 0) {
                        const user = res.data[0];
                        console.log('【poem】数据库中的用户信息:', user);
                        if (user.signatureUrl) {
                            console.log('【poem】数据库中找到签名:', user.signatureUrl);
                            this.setData({
                                currentAuthorSignature: user.signatureUrl,
                                isFetchingSignature: false
                            });
                        } else {
                            console.log('【poem】数据库中用户没有设置签名');
                            this.setData({
                                currentAuthorSignature: '',
                                isFetchingSignature: false
                            });
                        }
                    } else {
                        console.log('【poem】数据库中未找到用户');
                        this.setData({
                            currentAuthorSignature: '',
                            isFetchingSignature: false
                        });
                    }
                })
                .catch((err) => {
                    console.error('【poem】直接查询数据库失败:', err);
                    this.setData({
                        currentAuthorSignature: '',
                        isFetchingSignature: false
                    });
                });

            // 原来的云函数调用（保留作为备用）
            // 使用TCB调用云函数
            if (this.$tcb && this.$tcb.callFunction) {
                this.$tcb.callFunction({
                    name: 'getUserProfile',
                    data: {
                        userId: authorOpenid
                    },
                }).then((res) => {
                    console.log('【poem】getUserProfile返回结果:', res);
                    if (res.result && res.result.success && res.result.userInfo) {
                        const user = res.result.userInfo;
                        console.log('【poem】作者信息:', user);
                        if (user.signatureUrl) {
                            console.log('【poem】获取到作者签名:', user.signatureUrl);
                            this.setData({
                                currentAuthorSignature: user.signatureUrl,
                                isFetchingSignature: false
                            });
                            console.log('【poem】作者签名已设置到data中');
                        } else {
                            console.log('【poem】作者未设置签名，signatureUrl为空');
                            this.setData({
                                currentAuthorSignature: '',
                                isFetchingSignature: false
                            });
                        }
                    } else {
                        console.log('【poem】获取作者信息失败或数据格式错误');
                        this.setData({
                            currentAuthorSignature: '',
                            isFetchingSignature: false
                        });
                    }
                }).catch((err) => {
                    console.error('【poem】获取作者签名失败:', err);
                    this.setData({
                        currentAuthorSignature: '',
                        isFetchingSignature: false
                    });
                });
            }
        },

        // 签名图片加载成功
        onSignatureLoad: function (e) {
            console.log('【poem】签名图片加载成功:', e);
        },

        // 签名图片加载失败
        onSignatureError: function (e) {
            console.error('【poem】签名图片加载失败:', e);
        },

        getPostList: function (cb) {
            console.log('🔍 [Poem] getPostList 开始调用');
            console.log('🔍 [Poem] 当前状态 - isLoading:', this.isLoading, 'page:', this.page);
            
            if (this.isLoading) {
                console.log('🔍 [Poem] 正在加载中，跳过重复调用');
                return;
            }
            
            this.setData({
                isLoading: true
            });
            
            const skip = this.page * PAGE_SIZE;
            console.log('🔍 [Poem] 请求参数 - skip:', skip, 'page:', this.page, 'PAGE_SIZE:', PAGE_SIZE);
            
            // 检查TCB实例
            if (!this.$tcb) {
                console.error('❌ [Poem] TCB实例不存在');
                uni.showToast({
                    title: 'TCB未初始化',
                    icon: 'none'
                });
                this.setData({ isLoading: false });
                return;
            }
            
            if (!this.$tcb.callFunction) {
                console.error('❌ [Poem] TCB callFunction方法不存在');
                uni.showToast({
                    title: 'TCB方法不可用',
                    icon: 'none'
                });
                this.setData({ isLoading: false });
                return;
            }
            
            console.log('🔍 [Poem] 开始调用云函数 getPostList');
            console.log('🔍 [Poem] 云函数参数:', {
                skip: skip,
                limit: PAGE_SIZE,
                isPoem: true,
                isOriginal: true
            });
            
            // 使用TCB调用云函数
            this.$tcb.callFunction({
                name: 'getPostList',
                data: {
                    skip: skip,
                    limit: PAGE_SIZE,
                    isPoem: true,
                    isOriginal: true
                }
            }).then((res) => {
                console.log('✅ [Poem] 云函数调用成功，原始响应:', res);
                
                if (res.result && res.result.success) {
                    const posts = res.result.posts || [];
                    console.log('✅ [Poem] 获取到路诗歌数量:', posts.length);
                    console.log('✅ [Poem] 完整响应数据:', res.result);

                    // 调试：检查返回的诗歌数据
                    if (posts.length > 0) {
                        console.log('🔍 [Poem] 诗歌数据详情:');
                        posts.forEach((post, index) => {
                            console.log(`📝 [Poem] 诗歌${index + 1}:`, {
                                _id: post._id,
                                title: post.title,
                                isPoem: post.isPoem,
                                isOriginal: post.isOriginal,
                                content: post.content ? post.content.substring(0, 50) + '...' : '无内容',
                                authorName: post.authorName,
                                createTime: post.createTime
                            });
                        });
                    } else {
                        console.log('⚠️ [Poem] 没有获取到任何诗歌数据');
                    }
                    
                    posts.forEach((post) => {
                        if (!post.imageUrls || post.imageUrls.length === 0) {
                            post.imageUrls = post.imageUrl ? [post.imageUrl] : [];
                        }
                    });
                    
                    const newPostList = this.page === 0 ? posts : this.postList.concat(posts);
                    console.log('✅ [Poem] 更新后的postList长度:', newPostList.length);
                    
                    this.setData({
                        postList: newPostList,
                        page: this.page + 1,
                        hasMore: posts.length === PAGE_SIZE
                    });

                    // 首次加载或刷新后，初始化显示
                    if (this.page === 1 && newPostList.length > 0) {
                        console.log('🎯 [Poem] 首次加载，显示第一个诗歌');
                        console.log('🎯 [Poem] 第一个诗歌详情:', {
                            title: newPostList[0].title,
                            imageUrls: newPostList[0].imageUrls,
                            poemBgImage: newPostList[0].poemBgImage,
                            hasBgImage: !!newPostList[0].poemBgImage
                        });
                        this.updatePostDisplay(0); // 使用新函数来统一更新显示

                        // 预加载后续几张图片，例如第2、3张
                        if (newPostList.length > 1) {
                            console.log('🔍 [Poem] 预加载第2张图片');
                            this.loadImageForIndex(1);
                        }
                        if (newPostList.length > 2) {
                            console.log('🔍 [Poem] 预加载第3张图片');
                            this.loadImageForIndex(2);
                        }
                    } else {
                        console.log('⚠️ [Poem] 未获取到诗歌帖子数据或非首次加载');
                    }
                } else {
                    console.error('❌ [Poem] 云函数返回失败:', res.result);
                    uni.showToast({
                        title: '加载失败',
                        icon: 'none'
                    });
                }
            }).catch((err) => {
                console.error('❌ [Poem] 云函数调用失败:', err);
                console.error('❌ [Poem] 错误详情:', {
                    message: err.message,
                    stack: err.stack,
                    code: err.code
                });
                uni.showToast({
                    title: '网络错误',
                    icon: 'none'
                });
            }).finally(() => {
                console.log('🔍 [Poem] 云函数调用完成，设置loading为false');
                this.setData({
                    isLoading: false,
                    hasFirstLoad_var: true // 标记首次加载完成
                });

                if (typeof cb === 'function') {
                    cb();
                }
            });
        },

        touchStart: function (e) {
            this.setData({
                touchStartX: e.touches[0].clientX,
                touchStartY: e.touches[0].clientY
            });
        },

        touchEnd: function (e) {
            const touchEndX = e.changedTouches[0].clientX;
            const touchEndY = e.changedTouches[0].clientY;
            const diffX = this.touchStartX - touchEndX;
            const diffY = this.touchStartY - touchEndY;

            // 计算滑动距离和角度
            const distance = Math.sqrt(diffX * diffX + diffY * diffY);
            // 修复角度计算：使用绝对值确保角度正确
            const angle = Math.abs((Math.atan2(Math.abs(diffY), Math.abs(diffX)) * 180) / Math.PI);

            // 只有当水平滑动距离足够大，且滑动角度接近水平（小于45度）时才翻页
            if (distance > 80 && Math.abs(diffX) > 50 && angle < 45) {
                if (diffX > 0) {
                    this.nextPost();
                } else {
                    this.prevPost();
                }
            }
        },

        nextPost: function () {
            if (this.currentPostIndex < this.postList.length - 1) {
                this.setData({
                    isTransitioning: true
                });
                this.updatePostDisplay(this.currentPostIndex + 1); // 调用新函数

                setTimeout(() => {
                    this.setData({
                        isTransitioning: false
                    });
                }, 500); // 动画时长与CSS中的 transition 一致
            } else {
                if (this.hasMore && !this.isLoading) {
                    this.loadMorePosts(() => {
                        if (this.postList.length > this.currentPostIndex + 1) {
                            this.updatePostDisplay(this.currentPostIndex + 1);
                        }
                    });
                }
            }
        },

        prevPost: function () {
            if (this.currentPostIndex > 0) {
                this.setData({
                    isTransitioning: true
                });
                this.updatePostDisplay(this.currentPostIndex - 1); // 调用新函数

                setTimeout(() => {
                    this.setData({
                        isTransitioning: false
                    });
                }, 500);
            }
        },

        onSinglePostTap: function (e) {
            const postId = e.currentTarget.dataset.postid;
            uni.navigateTo({
                url: `/pages/post-detail/post-detail?id=${postId}`
            });
        },

        onImageLoad: function (e) {
            const { postid, type } = e.currentTarget.dataset;
            const { width: originalWidth, height: originalHeight } = e.detail;
            if (!originalWidth || !originalHeight) {
                return;
            }
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
                                if (this.imageClampHeights && this.imageClampHeights[postid] !== displayHeight) {
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

        onImageError: function (e) {
            console.error('图片加载失败', e.detail);
        },

        // 加载更多帖子（不显示骨架屏）
        loadMorePosts: function (cb) {
            if (this.isLoading) {
                return;
            }
            // 注意：这里不设置 isLoading: true，避免触发骨架屏

            const skip = this.page * PAGE_SIZE;
            console.log('开始加载更多路诗歌，skip:', skip, 'page:', this.page);
            // 使用TCB调用云函数
            if (this.$tcb && this.$tcb.callFunction) {
                this.$tcb.callFunction({
                    name: 'getPostList',
                    data: {
                        skip: skip,
                        limit: PAGE_SIZE,
                        isPoem: true,
                        isOriginal: true
                    }
                }).then((res) => {
                    console.log('加载更多路诗歌结果:', res);
                    if (res.result && res.result.success) {
                        const posts = res.result.posts || [];
                        console.log('获取到更多路诗歌数量:', posts.length);
                        posts.forEach((post) => {
                            if (!post.imageUrls || post.imageUrls.length === 0) {
                                post.imageUrls = post.imageUrl ? [post.imageUrl] : [];
                            }
                        });
                        const newPostList = this.postList.concat(posts);
                        this.setData({
                            postList: newPostList,
                            page: this.page + 1,
                            hasMore: posts.length === PAGE_SIZE
                        });

                        // 预加载新加载的图片
                        const startIndex = this.postList.length - posts.length;
                        posts.forEach((post, index) => {
                            this.loadImageForIndex(startIndex + index);
                        });
                    }
                }).catch((err) => {
                    console.error('加载更多路诗歌失败:', err);
                }).finally(() => {
                    // 注意：这里不设置 isLoading: false，因为之前没有设置为 true
                    if (typeof cb === 'function') {
                        cb();
                    }
                });
            }
        },

        // 预加载下一首的背景图
        preloadNextBackgroundImage: function (currentIndex) {
            const nextIndex = currentIndex + 1;
            if (nextIndex >= this.postList.length) {
                // 如果下一首不存在，检查是否需要加载更多
                if (this.hasMore && !this.isLoading) {
                    this.loadMorePosts(() => {
                        // 加载完成后再次尝试预加载
                        if (nextIndex < this.postList.length) {
                            this.loadImageForIndex(nextIndex);
                        }
                    });
                }
                return;
            }
            console.log(`开始预加载第${nextIndex + 1}张图片`);
            this.loadImageForIndex(nextIndex);
        },

        resetBackgroundLayers: function () {
            this.setData({
                'bgLayers[0].url': '',
                'bgLayers[0].visible': false,
                'bgLayers[1].url': '',
                'bgLayers[1].visible': false,
                activeLayerIndex: 0
            });
        },

        // --- 核心新函数 ---
        // 统一更新帖子内容和背景的函数
        updatePostDisplay: function (index) {
            if (index < 0 || index >= this.postList.length) {
                return;
            }
            const post = this.postList[index];
            if (!post) {
                return;
            }

            // 1. 立即更新卡片内容（文字先切换）
            this.setData({
                currentPost: post,
                currentPostIndex: index
            });

            // 2. 获取当前帖子作者的签名
            this.fetchAuthorSignature(post._openid);

            // 2. 延迟切换背景图，让文字先显示
            const imageUrl = post.poemBgImage || (post.imageUrls && post.imageUrls[0]) || '';
            if (!imageUrl) {
                this.resetBackgroundLayers();
                this.preloadNextBackgroundImage(index);
                return;
            }

            // 优先使用预加载好的本地缓存路径
            let finalImageUrl = this.preloadedImages[imageUrl];

            // 如果本地缓存没有，检查全局预加载缓存
            if (!finalImageUrl) {
                const app = getApp();
                if (app.globalData.preloadedImages && app.globalData.preloadedImages[imageUrl]) {
                    finalImageUrl = app.globalData.preloadedImages[imageUrl];
                    // 同步到本地缓存
                    this.setData({
                        [`preloadedImages.${imageUrl}`]: finalImageUrl
                    });
                } else {
                    finalImageUrl = imageUrl;
                }
            }

            // 检查是否是首次显示（双图层都为空）
            const isFirstDisplay = this.bgLayers[0].url === '' && this.bgLayers[1].url === '';
            if (isFirstDisplay) {
                // 首次显示：直接设置第一个图层，不进行切换动画
                console.log('首次显示背景图，直接设置第一个图层');
                this.setData({
                    'bgLayers[0].url': finalImageUrl,
                    'bgLayers[0].visible': true,
                    'bgLayers[1].visible': false,
                    activeLayerIndex: 0
                });

                // 首次显示时立即预加载第二张图片，确保切换时不会卡顿
                console.log('首次显示完成，立即预加载第二张图片');
                this.preloadNextBackgroundImage(index);
            } else {
                // 后续切换：延迟切换背景图，让文字先显示
                setTimeout(() => {
                    this.switchBackgroundImage(finalImageUrl);
                }, 100); // 100ms延迟，让文字先切换

                // 预加载下一张
                this.preloadNextBackgroundImage(index);
            }
        },

        // 双图层切换函数 - 轻量级版本
        switchBackgroundImage: function (newImageUrl) {
            if (!newImageUrl) {
                this.resetBackgroundLayers();
                return;
            }

            // 优先使用预加载的本地路径
            const preloadedUrl = this.preloadedImages[newImageUrl];
            const finalImageUrl = preloadedUrl || newImageUrl;
            console.log('切换背景图:', {
                originalUrl: newImageUrl,
                preloadedUrl: preloadedUrl,
                finalUrl: finalImageUrl,
                hasPreloaded: !!preloadedUrl
            });
            const currentActiveIndex = this.activeLayerIndex;
            const nextActiveIndex = (currentActiveIndex + 1) % 2; // 0 -> 1, 1 -> 0

            // 先设置下一层的图片URL
            this.setData({
                [`bgLayers[${nextActiveIndex}].url`]: finalImageUrl
            });

            // 使用较短的延迟，平衡性能和体验
            setTimeout(
                () => {
                    this.setData({
                        [`bgLayers[${currentActiveIndex}].visible`]: false,
                        // 当前层淡出
                        [`bgLayers[${nextActiveIndex}].visible`]: true,
                        // 下一层淡入
                        activeLayerIndex: nextActiveIndex
                    });
                },
                preloadedUrl ? 50 : 150
            ); // 预加载图片用50ms，网络图片用150ms
        },

        // 背景图片加载完成事件（保留用于调试）
        onBackgroundImageLoad: function (e) {
            const layerIndex = e.currentTarget.dataset.layerIndex;
            console.log(`图层${layerIndex}图片加载完成`);
        },

        // 为指定索引加载图片
        loadImageForIndex: function (index, callback) {
            const post = this.postList[index];
            if (!post) {
                console.log(`第${index + 1}张图片：帖子数据不存在`);
                return;
            }
            const imageUrl = post.poemBgImage || (post.imageUrls && post.imageUrls[0]) || '';
            if (!imageUrl) {
                console.log(`第${index + 1}张图片：没有图片URL`);
                return;
            }

            // 检查全局预加载缓存
            const app = getApp();
            if (app.globalData.preloadedImages && app.globalData.preloadedImages[imageUrl]) {
                console.log(`第${index + 1}张图片：使用全局预加载缓存`);
                this.setData({
                    [`preloadedImages.${imageUrl}`]: app.globalData.preloadedImages[imageUrl]
                });
                if (typeof callback === 'function') {
                    callback(app.globalData.preloadedImages[imageUrl]);
                }
                return;
            }

            // 检查本地预加载缓存
            if (this.preloadedImages[imageUrl]) {
                console.log(`第${index + 1}张图片：已存在本地缓存`);
                return;
            }
            console.log(`第${index + 1}张图片：开始下载预加载`);

            // H5环境特殊处理
            const isH5 = typeof window !== 'undefined';
            if (isH5 && (imageUrl.includes('tcb.qcloud.la') || imageUrl.includes('cloudbase'))) {
                console.log(`🔍 [H5] 第${index + 1}张图片检测到腾讯云存储URL，直接使用:`, imageUrl);
                // H5环境下直接使用原URL，避免CORS问题
                this.setData({
                    [`preloadedImages.${imageUrl}`]: imageUrl
                });
                if (typeof callback === 'function') {
                    callback(imageUrl);
                }
                return;
            }

            // 使用微信图片API预加载
            uni.downloadFile({
                url: imageUrl,
                success: (res) => {
                    if (res.statusCode === 200) {
                        console.log(`第${index + 1}张图片：预加载成功`);
                        this.setData({
                            [`preloadedImages.${imageUrl}`]: res.tempFilePath
                        });
                        // 如果有回调函数，则执行
                        if (typeof callback === 'function') {
                            callback(res.tempFilePath);
                        }
                    } else {
                        console.error(`第${index + 1}张图片：下载失败，状态码:`, res.statusCode);
                    }
                },
                fail: (err) => {
                    console.error(`第${index + 1}张图片：预加载失败:`, err);
                    // H5环境下失败时，直接使用原URL
                    const isH5 = typeof window !== 'undefined';
                    if (isH5) {
                        console.log(`🔍 [H5] 第${index + 1}张图片预加载失败，使用原URL:`, imageUrl);
                        this.setData({
                            [`preloadedImages.${imageUrl}`]: imageUrl
                        });
                        if (typeof callback === 'function') {
                            callback(imageUrl);
                        }
                    }
                }
            });
        },

        // 测试诗歌数据获取
        testPoemData: function() {
            console.log('🧪 [Poem] 开始测试诗歌数据获取');
            console.log('🧪 [Poem] 当前状态:', {
                postListLength: this.postList.length,
                currentPostIndex: this.currentPostIndex,
                isLoading: this.isLoading,
                page: this.page,
                hasMore: this.hasMore
            });
            
            // 重置状态并重新获取数据
            this.setData({
                postList: [],
                currentPostIndex: 0,
                page: 0,
                hasMore: true,
                isLoading: false
            });
            
            console.log('🧪 [Poem] 重置状态完成，开始重新获取数据');
            this.getPostList();
        }
    }
};
</script>
<style>
page {
    background: transparent;
    padding: 0;
    opacity: 0;
    animation: fadeIn 0.8s ease-in-out forwards;
}

@keyframes fadeIn {
    from {
        opacity: 0;
    }
    to {
        opacity: 1;
    }
}

/* poem.wxss - 原创诗歌页面（路） */
.container {
    /* 移除 background-image, background-size 等都删掉 */
    position: relative;
    overflow: hidden;
    min-height: 100vh;
}

/* 读诗模式容器 */
.poem-mode-container {
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    z-index: 1; /* 确保在模糊层之上 */
    overflow: visible; /* 允许签名显示在容器外部 */
}

/* 新增：背景图的容器和样式 */
.background-wrapper,
.blur-background-wrapper {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    z-index: -2; /* 确保在最底层 */
}

.bg-image {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    opacity: 0; /* 默认隐藏 */
    transition: opacity 0.5s ease-in-out; /* 关键：平滑的透明度过渡 */
}

.bg-image.visible {
    opacity: 1; /* 显示 */
}

/* 新增：模糊背景的容器和样式 */
.blur-background-wrapper {
    z-index: -1;
    filter: blur(30px) brightness(0.7);
    transform: scale(1.1);
}

/* 收藏按钮 */
.favorite-btn {
    position: absolute;
    top: 60rpx;
    right: 60rpx;
    width: 80rpx;
    height: 80rpx;
    background: rgba(255, 255, 255, 0.9);
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 4rpx 12rpx rgba(0, 0, 0, 0.15);
    z-index: 999;
    transition: all 0.3s ease;
}

.favorite-btn:active {
    transform: scale(0.95);
}

.favorite-icon {
    font-size: 36rpx;
}

/* 单帖内容区域 */
.single-post-content {
    width: calc(100% - 40rpx);
    height: calc(100% - 60rpx); /* 减少上下边距，增加内容区域高度 */
    display: flex;
    flex-direction: column;
    padding: 60rpx 20rpx 80rpx 20rpx; /* 增加底部内边距，让最后一行不显示 */
    box-sizing: border-box;
    background: rgba(255, 255, 255, 0.8); /* 增加透明度，让背景图更明显 */
    margin: 30rpx 20rpx; /* 减少外边距，增加内容区域 */
    border-radius: 24rpx;
    box-shadow: 0 8rpx 32rpx rgba(0, 0, 0, 0.1);
    position: relative; /* 为原创标识定位 */
    transition: transform 0.3s ease-in-out; /* 卡片切换动画 */
    transform: translateX(0); /* 默认位置 */
}

/* 切换动画状态 */
.single-post-content.is-transitioning {
    /* 可以尝试只改变透明度，而不是位移 */
    opacity: 0.95;
    transform: scale(0.99);
}

/* 作者信息 */
.single-author-info {
    display: flex;
    align-items: center;
    margin-bottom: 15rpx; /* 减小作者信息与标题的间距 */
    padding-bottom: 10rpx; /* 减小底部内边距 */
    border-bottom: 1rpx solid rgba(240, 240, 240, 0.5); /* 半透明白色分割线 */
}

.single-author-avatar {
    width: 80rpx;
    height: 80rpx;
    border-radius: 50%;
    margin-right: 20rpx;
    background-color: #f5f5f5;
    border: 4rpx solid white;
    box-shadow: 0 4rpx 12rpx rgba(0, 0, 0, 0.1);
}

.single-author-name {
    font-size: 32rpx;
    color: #000;
    font-weight: 600;
    text-shadow: 0 1rpx 2rpx rgba(255, 255, 255, 0.8); /* 添加文字阴影 */
}

/* 标题 */
.single-post-title {
    font-size: 36rpx;
    font-weight: bold;
    color: #000;
    margin-bottom: 10rpx; /* 减小标题与内容的间距 */
    line-height: 1.4;
    text-align: center; /* 标题居中显示 */
    text-shadow: 0 1rpx 2rpx rgba(255, 255, 255, 0.8); /* 添加文字阴影 */
}

/* 诗歌作者样式 */
.single-poem-author {
    font-size: 32rpx;
    color: #000;
    text-align: center;
    margin: 5rpx 0 15rpx 0;
    text-shadow: 0 1rpx 2rpx rgba(255, 255, 255, 0.8);
    letter-spacing: 2rpx;
}

/* 图片容器 */
.single-image-container {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    margin: 20rpx 0;
    border-radius: 16rpx;
    overflow: hidden;
    background: #f8f9fa;
    width: 100%;
    height: 100%;
    max-height: 50vh;
}

.single-post-image {
    width: 100%;
    height: 100%;
    object-fit: contain;
    border-radius: 16rpx;
}

/* 多张图片轮播 */
.single-image-swiper {
    width: 100%;
    height: 50vh;
    border-radius: 16rpx;
}

/* 内容文字 */
.single-post-content-text {
    font-size: 32rpx;
    color: #000;
    line-height: 1.8;
    margin-top: 20rpx;
    padding: 20rpx 30rpx 120rpx 30rpx; /* 增加底部内边距，为签名留出空间 */
    background: transparent; /* 完全透明背景 */
    border-radius: 0; /* 移除圆角 */
    max-height: 62vh; /* 稍微减少高度，配合底部内边距 */
    overflow-y: auto;
    overflow-x: visible; /* 确保水平方向不被裁剪 */
    font-family: -apple-system-font, 'PingFang SC', 'Helvetica Neue', Arial, sans-serif;
    letter-spacing: 1rpx;
    text-shadow: 0 1rpx 2rpx rgba(255, 255, 255, 0.8); /* 添加文字阴影增强可读性 */
    flex: 1; /* 让文字区域占据剩余空间 */
    position: relative; /* 确保定位上下文正确 */
}

/* 用户签名样式 */
.user-signature {
    position: absolute;
    bottom: 140rpx; /* 从30rpx调整到120rpx，避免被底部导航栏遮挡 */
    right: 50rpx;
    z-index: 1001; /* 提高层级，确保不被其他元素覆盖 */
    pointer-events: none; /* 防止签名影响点击事件 */
}

.signature-image {
    width: 120rpx;
    height: 60rpx;
    opacity: 0.8; /* 稍微透明，不抢夺主要内容的注意力 */
    filter: drop-shadow(0 2rpx 4rpx rgba(0, 0, 0, 0.1)); /* 添加轻微阴影 */
    display: block; /* 确保图片正确显示 */
    background: transparent; /* 确保背景透明 */
}

/* 骨架屏容器 */
.skeleton-container {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(255, 255, 255, 0.95);
    z-index: 999;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
}

.loading-text {
    margin-top: 40rpx;
    font-size: 28rpx;
    color: #666;
    text-align: center;
}

/* 空状态 */
.empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 100rpx 40rpx;
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
    font-size: 28rpx;
    color: #999;
}

/* 悬浮发布按钮 */
.add-button {
    position: fixed;
    bottom: 120rpx;
    right: 30rpx;
    width: 100rpx;
    height: 100rpx;
    background-color: #9ed7ee;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    font-size: 48rpx;
    box-shadow: 0 4rpx 16rpx rgba(7, 193, 96, 0.3);
    z-index: 1000;
}

/* 调试按钮 */
.debug-button {
    position: fixed;
    bottom: 240rpx;
    right: 30rpx;
    width: 80rpx;
    height: 80rpx;
    background-color: #ff9500;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    font-size: 32rpx;
    box-shadow: 0 4rpx 16rpx rgba(255, 149, 0, 0.3);
    z-index: 1000;
}
</style>
