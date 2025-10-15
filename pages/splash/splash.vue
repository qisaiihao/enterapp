<template>
    <view class="container">
        <!-- 阶段一：打字机动画 -->
        <view v-if="currentPhase === 'typing'" class="typing-phase-container">
            <!-- 文字层：固定高度，预留光标空间 -->
            <view class="text-layer">
                <view class="typewriter-effect">
                    <text>{{ typedText }}</text>
                    <view :class="'blinking-cursor ' + (showNewLineCursor ? 'hidden' : '')"></view>
                </view>

                <!-- 换行后的光标（点击按钮后显示） -->
                <view v-if="showNewLineCursor" class="new-line-cursor-container">
                    <view class="new-line-cursor"></view>
                </view>
            </view>

            <!-- 按钮层：独立定位，不影响文字 -->
            <!--
            <view v-if="showEnterButton" :class="'enter-key-container ' + (preloadCompleted ? '' : 'loading')" @tap="handleEnterButtonClick">
                <view class=\"enter-key-l-shape\">
    <view class=\"ek-layer ek-border\"></view>
    <view class=\"ek-layer ek-fill\">
        <text class=\"ek-label\">{{ preloadCompleted ? 'Enter' : 'Loading' }}</text>
        <text class=\"ek-arrow\">{{ preloadCompleted ? '↵' : '⏳' }}</text>
    </view>
</view>
            </view>
            -->
            <view v-if="showEnterButton" :class="'enter-key-container ' + (preloadCompleted ? '' : 'loading')" @tap="handleEnterButtonClick">
                <image class="enter-key-image" :src="preloadCompleted ? '/static/images/回车键.png' : '/static/images/回车键.png'" mode="aspectFit"></image>
            </view>
        </view>

        <!-- 阶段二：显示开屏图（暂时注释掉） -->
        <!-- <view wx:if="{{currentPhase === 'imageDisplay'}}" class="image-phase-container">
    <image class="splash-image" src="{{preloadedImagePath}}" mode="aspectFill" />
  </view> -->

        <!-- 原有的加载指示器（保留作为备用） -->
        <view class="loading-indicator" v-if="isPreloading">正在加载内容...</view>
    </view>
</template>

<script>
const { imageManager } = require('../../utils/imageManager.js');
const { cloudCall } = require('../../utils/cloudCall.js');
export default {
    data() {
        return {
            // ---- 新增的状态控制 ----
            currentPhase: 'typing',

            // 'typing', 'imageDisplay', 'done'
            showEnterButton: false,

            // 控制进入按钮的显示
            showNewLineCursor: false,

            // 控制换行后光标的显示
            textMoveUp: false,

            // 控制文字上移动画
            preloadCompleted: false,

            // 预加载是否完成

            // ---- 打字机动画所需数据 ----
            fullText: 'poementer',

            typedText: '',

            // ---- 预加载的开屏图数据 ----
            preloadedImagePath: '',

            // 存储预加载成功的图片本地路径

            // ---- 原有数据 ----
            preloadProgress: 0,

            isPreloading: false,

            // 默认本地开屏图
            splashImageUrl: '/static/images/splash.png',

            fadeOut: false,
            zoomOut: false
        };
    },
    onLoad: function () {
        // 1. 启动打字机动画
        this.executeTypingAnimation();

        // 2. 并行执行图片预加载和原有的数据预加载
        this.loadSplashImage();
    },
    methods: {
        // 统一云函数调用方法
        callCloudFunction(name, data = {}, extraOptions = {}) {
            return cloudCall(name, data, Object.assign({ pageTag: 'splash', context: this }, extraOptions));
        },

        /**
         * 函数：执行打字机动画
         */
        executeTypingAnimation: function () {
            const textToType = this.fullText; // 获取要完整显示的文本
            let charIndex = 0; // 定义一个索引，用于追踪当前应该显示哪个字符

            // 递归函数，模拟人打字的节奏
            const typeNextChar = () => {
                if (charIndex < textToType.length) {
                    // 1. 更新 typedText：将当前已显示的文本加上下一个要显示的字符
                    this.setData({
                        typedText: this.typedText + textToType[charIndex]
                    });

                    // 2. 索引递增，准备显示下一个字符
                    charIndex++;

                    // 3. 根据字符位置和内容决定下一个字符的延迟时间
                    let delay = this.getTypingDelay(charIndex, textToType);

                    // 4. 递归调用，继续下一个字符
                    setTimeout(typeNextChar, delay);
                } else {
                    // 所有字符都已显示完毕，延迟后显示"进入"按钮
                    setTimeout(() => {
                        this.setData({
                            showEnterButton: true,
                            textMoveUp: true // 触发文字上移动画
                        });
                    }, 500);
                }
            };

            // 开始打字动画
            typeNextChar();
        },

        /**
         * 获取打字延迟时间，模拟人打字的节奏
         */
        getTypingDelay: function (charIndex, text) {
            const char = text[charIndex - 1]; // 当前字符
            const nextChar = text[charIndex]; // 下一个字符

            // 基础延迟时间
            let baseDelay = 100;

            // 根据字符类型调整延迟
            if (char === ' ') {
                // 空格后稍微停顿
                baseDelay = 200;
            } else if (char === 'e' && nextChar === 'n') {
                // "poem"后的"enter"开始前，停顿更长时间
                baseDelay = 600;
            } else if (char === 'm' && nextChar === 'e') {
                // "poem"结束后，停顿
                baseDelay = 400;
            } else if (char === 't' && nextChar === 'e') {
                // "enter"中的"te"之间
                baseDelay = 180;
            } else if (char === 'e' && nextChar === 'r') {
                // "enter"中的"er"之间
                baseDelay = 160;
            } else {
                // 其他字符的随机延迟，模拟人打字的自然节奏
                baseDelay = 120 + Math.random() * 100; // 120-220ms的随机延迟
            }

            return baseDelay;
        },

        /**
         * 响应：用户点击"进入"按钮
         */
        handleEnterButtonClick: function () {
            // 添加按钮点击反馈
            uni.vibrateShort();

            // 检查预加载是否完成
            if (!this.preloadCompleted) {
                uni.showToast({
                    title: '正在加载中...',
                    icon: 'loading',
                    duration: 1000
                });
                return;
            }

            // 隐藏按钮，显示换行后的光标
            this.setData({
                showEnterButton: false,
                showNewLineCursor: true
            });

            // 闪烁两下后跳转
            this.blinkNewLineCursorAndNavigate();
        },

        /**
         * 换行光标闪烁两下后跳转
         */
        blinkNewLineCursorAndNavigate: function () {
            console.log('开始换行光标闪烁动画');
            let blinkCount = 0;
            const maxBlinks = 2;
            const blinkInterval = setInterval(() => {
                blinkCount++;
                console.log(`光标闪烁第${blinkCount}次`);
                if (blinkCount >= maxBlinks) {
                    clearInterval(blinkInterval);
                    console.log('光标闪烁完成，准备跳转');
                    // 闪烁完成后跳转
                    setTimeout(() => {
                        console.log('调用navigateToTarget方法');
                        this.navigateToTarget();
                    }, 500); // 延迟0.5秒后跳转
                }
            }, 600); // 每0.6秒闪烁一次
        },

        // 加载云端开屏图 - 暂时注释掉
        async loadSplashImage() {
            // try {
            //   console.log('开始加载云端开屏图...')
            //   const splashUrl = await imageManager.getSplashImageUrl()
            //
            //   if (splashUrl && splashUrl !== '/static/images/splash.png') {
            //     console.log('成功获取云端开屏图URL:', splashUrl)
            //     this.setData({
            //       splashImageUrl: splashUrl,
            //       preloadedImagePath: splashUrl
            //     })
            //   } else {
            //     console.log('使用默认本地开屏图')
            //     this.setData({
            //       preloadedImagePath: '/static/images/splash.png'
            //     })
            //   }
            // } catch (error) {
            //   console.error('加载云端开屏图失败:', error)
            //   // 出错时使用默认本地图片
            // }

            // 暂时直接使用本地开屏图
            console.log('使用默认本地开屏图');
            this.setData({
                preloadedImagePath: '/static/images/splash.png'
            });

            // 无论云端加载是否成功，都开始预加载流程
            this.executeOriginalPreloadTasks();
        },

        /**
         * 等待登录流程完成，确保获取到 openid
         */
        async waitForOpenId(maxWait = 6000) {
            const start = Date.now();

            const readOpenId = () => {
                let appInstance = null;
                if (typeof getApp === 'function') {
                    try {
                        appInstance = getApp();
                    } catch (error) {
                        console.warn('获取全局 App 实例失败:', error);
                    }
                }

                if (appInstance) {
                    appInstance.globalData = appInstance.globalData || {};
                }

                let currentOpenId = appInstance && appInstance.globalData && appInstance.globalData.openid;
                if (!currentOpenId && typeof uni !== 'undefined' && typeof uni.getStorageSync === 'function') {
                    try {
                        currentOpenId = uni.getStorageSync('userOpenId') || uni.getStorageSync('openid');
                        if (currentOpenId && appInstance) {
                            appInstance.globalData.openid = currentOpenId;
                        }
                    } catch (error) {
                        console.warn('读取本地 openid 失败:', error);
                    }
                }
                return {
                    appInstance,
                    currentOpenId
                };
            };

            let { appInstance, currentOpenId } = readOpenId();

            while (!currentOpenId && Date.now() - start < maxWait) {
                await new Promise((resolve) => setTimeout(resolve, 200));
                ({ appInstance, currentOpenId } = readOpenId());
            }

            if (!currentOpenId) {
                console.warn('等待 openid 超时，预加载将退化为普通加载');
            }

            return {
                app: appInstance,
                openid: currentOpenId
            };
        },

        /**
         * 函数：执行原有的其它预加载任务
         */
        async executeOriginalPreloadTasks() {
            const { app, openid } = await this.waitForOpenId();

            if (!openid) {
                this.setData({
                    preloadCompleted: true
                });
                return;
            }

            if (app) {
                app.globalData = app.globalData || {};
                if (!app.globalData.openid) {
                    app.globalData.openid = openid;
                }
            }

            // 创建一个数组来存放所有的预加载任务 (Promise)
            const preloadTasks = [
                this.preloadTabIcons(),
                this.preloadPoemData(),
                this.preloadMountainData()
            ];

            try {
                await Promise.all(preloadTasks);
            } catch (error) {
                console.error('预加载任务执行过程中出现错误:', error);
            } finally {
                // 预加载完成后，设置标志位，但不自动跳转
                // 跳转将由用户点击"进入"按钮触发
                this.setData({
                    preloadCompleted: true
                });
                console.log('预加载任务完成，等待用户点击进入按钮');
            }
        },

        // 使用 async/await 语法来更清晰地处理异步流程
        preloadPoemData: function () {
            // Promise 的执行函数本身也可以是 async 函数
            return new Promise(async (resolve, reject) => {
                this.setData({
                    isPreloading: true
                });
                this.callCloudFunction('getPostList', {
                    skip: 0,
                    limit: 5,
                    isPoem: true,
                    isOriginal: true
                }).then(async (res) => {
                        // <-- success 回调也变成 async
                        try {
                            if (res.result && res.result.success && res.result.posts) {
                                const app = getApp();
                                app.globalData.preloadedPoemData = res.result.posts;
                                if (res.result.posts.length > 0) {
                                    console.log('诗歌数据获取成功，开始预加载相关图片...');
                                    // 关键改动：等待图片下载任务完成！
                                    await this.preloadFirstPostImages(res.result.posts[0]);
                                    console.log('相关图片预加载完成！');
                                }
                            }
                            resolve(); // <-- 成功路径的 resolve 移动到这里
                        } catch (e) {
                            console.log('CatchClause', e);
                            console.log('CatchClause', e);
                            reject(e); // 捕获内部错误
                        }
                }).catch((err) => {
                    console.error('诗歌数据预加载失败:', err);
                    reject(err);
                }).finally(() => {
                    console.log('诗歌数据预加载流程结束');
                    this.setData({
                        preloadProgress: 100,
                        isPreloading: false
                    });
                });
            });
        },

        // 预加载山页面数据
        preloadMountainData: function () {
            return new Promise(async (resolve, reject) => {
                this.callCloudFunction('getPostList', {
                    skip: 0,
                    limit: 5,
                    isPoem: true,
                    isOriginal: false
                }).then(async (res) => {
                        try {
                            if (res.result && res.result.success && res.result.posts) {
                                const app = getApp();
                                app.globalData.preloadedMountainData = res.result.posts;
                                if (res.result.posts.length > 0) {
                                    console.log('山页面数据获取成功，开始预加载相关图片...');
                                    // 预加载第一张图片
                                    await this.preloadFirstMountainImages(res.result.posts[0]);
                                    console.log('山页面相关图片预加载完成！');
                                }
                            }
                            resolve();
                        } catch (e) {
                            console.log('CatchClause', e);
                            console.log('CatchClause', e);
                            reject(e);
                        }
                }).catch((err) => {
                    console.error('山页面数据预加载失败:', err);
                    reject(err);
                });
            });
        },

        // 预加载山页面第一张图片
        preloadFirstMountainImages: function (post) {
            const app = getApp();
            if (!app.globalData.preloadedImages) {
                app.globalData.preloadedImages = {};
            }
            const imageDownloadTasks = [];

            // 预加载背景图片
            const bgImageUrl = post.poemBgImage || (post.imageUrls && post.imageUrls[0]);
            if (bgImageUrl) {
                imageDownloadTasks.push(
                    new Promise((resolve) => {
                        const isH5 = typeof window !== 'undefined';
                        const isCloudFile = typeof bgImageUrl === 'string' && bgImageUrl.indexOf('cloud://') === 0;
                        let shouldSkipDownload = false;
                        if (isH5) {
                            if (isCloudFile) {
                                shouldSkipDownload = true;
                            } else if (/^https?:\/\//.test(bgImageUrl)) {
                                shouldSkipDownload = !bgImageUrl.startsWith(window.location.origin);
                            }
                        }
                        if (shouldSkipDownload) {
                            console.log('🔍 [H5] 山页面首张背景图跳过下载，直接使用原URL:', bgImageUrl);
                            app.globalData.preloadedImages[bgImageUrl] = bgImageUrl;
                            resolve();
                            return;
                        }
                        
                        uni.downloadFile({
                            url: bgImageUrl,
                            success: (res) => {
                                if (res.statusCode === 200) {
                                    console.log('山页面首张背景图预加载成功:', res.tempFilePath);
                                    app.globalData.preloadedImages[bgImageUrl] = res.tempFilePath;
                                }
                            },
                            fail: (err) => {
                                console.error('山页面背景图预加载失败:', bgImageUrl, err);
                                if (isH5 || isCloudFile) {
                                    console.log('🔍 [H5] 山页面背景图预加载失败，使用原URL:', bgImageUrl);
                                    app.globalData.preloadedImages[bgImageUrl] = bgImageUrl;
                                }
                            },
                            complete: () => {
                                resolve();
                            }
                        });
                    })
                );
            }

            // 预加载用户头像
            if (post.authorAvatar) {
                imageDownloadTasks.push(
                    new Promise((resolve) => {
                        const isH5 = typeof window !== 'undefined';
                        const isCloudFile = typeof post.authorAvatar === 'string' && post.authorAvatar.indexOf('cloud://') === 0;
                        let shouldSkipDownload = false;
                        if (isH5) {
                            if (isCloudFile) {
                                shouldSkipDownload = true;
                            } else if (/^https?:\/\//.test(post.authorAvatar)) {
                                shouldSkipDownload = !post.authorAvatar.startsWith(window.location.origin);
                            }
                        }
                        if (shouldSkipDownload) {
                            console.log('🔍 [H5] 山页面作者头像预加载跳过下载，直接使用原URL');
                            app.globalData.preloadedImages[post.authorAvatar] = post.authorAvatar;
                            resolve();
                            return;
                        }
                        uni.downloadFile({
                            url: post.authorAvatar,
                            success: (res) => {
                                if (res.statusCode === 200) {
                                    console.log('山页面作者头像预加载成功');
                                    app.globalData.preloadedImages[post.authorAvatar] = res.tempFilePath;
                                }
                            },
                            fail: (err) => {
                                console.error('山页面作者头像预加载失败:', post.authorAvatar, err);
                                if (isH5 || isCloudFile) {
                                    app.globalData.preloadedImages[post.authorAvatar] = post.authorAvatar;
                                }
                            },
                            complete: () => {
                                resolve();
                            }
                        });
                    })
                );
            }
            return Promise.all(imageDownloadTasks);
        },

        preloadTabIcons: function () {
            return new Promise((resolve) => {
                const tabIcons = [
                    '/static/images/icons/home.png',
                    '/static/images/icons/home-active.png',
                    '/static/images/icons/examples.png',
                    '/static/images/icons/examples-active.png',
                    '/static/images/icons/usercenter.png',
                    '/static/images/icons/usercenter-active.png'
                ];
                let loadedCount = 0;
                const totalCount = tabIcons.length;
                if (totalCount === 0) {
                    resolve(); // 如果没有图标，直接完成
                    return;
                }
                tabIcons.forEach((iconPath) => {
                    uni.getImageInfo({
                        src: iconPath,
                        complete: () => {
                            // 使用 complete 确保无论成功失败都会计数
                            loadedCount++;
                            if (loadedCount === totalCount) {
                                console.log('所有Tab图标预加载尝试完毕');
                                resolve(); // 所有图标都处理完后，完成 Promise
                            }
                        }
                    });
                });
            });
        },

        // 这个函数现在需要返回一个 Promise，它包裹了所有图片下载任务
        preloadFirstPostImages: function (post) {
            const app = getApp();
            if (!app.globalData.preloadedImages) {
                app.globalData.preloadedImages = {};
            }

            // 创建一个数组来收集所有图片下载的 Promise
            const imageDownloadTasks = [];

            // 预加载背景图片
            const bgImageUrl = post.poemBgImage || (post.imageUrls && post.imageUrls[0]);
            if (bgImageUrl) {
                // 为每个下载任务创建一个 Promise
                imageDownloadTasks.push(
                    new Promise((resolve) => {
                        const isH5 = typeof window !== 'undefined';
                        const isCloudFile = typeof bgImageUrl === 'string' && bgImageUrl.indexOf('cloud://') === 0;
                        let shouldSkipDownload = false;
                        if (isH5) {
                            if (isCloudFile) {
                                shouldSkipDownload = true;
                            } else if (/^https?:\/\//.test(bgImageUrl)) {
                                shouldSkipDownload = !bgImageUrl.startsWith(window.location.origin);
                            }
                        }
                        if (shouldSkipDownload) {
                            console.log('🔍 [H5] 首张背景图预加载跳过下载，直接使用原URL:', bgImageUrl);
                            app.globalData.preloadedImages[bgImageUrl] = bgImageUrl;
                            resolve();
                            return;
                        }
                        
                        uni.downloadFile({
                            url: bgImageUrl,
                            success: (res) => {
                                if (res.statusCode === 200) {
                                    console.log('首张背景图预加载成功:', res.tempFilePath);
                                    app.globalData.preloadedImages[bgImageUrl] = res.tempFilePath;
                                }
                            },
                            fail: (err) => {
                                console.error('首张背景图预加载失败:', bgImageUrl, err);
                                if (isH5 || isCloudFile) {
                                    console.log('🔍 [H5] 首张背景图预加载失败，使用原URL:', bgImageUrl);
                                    app.globalData.preloadedImages[bgImageUrl] = bgImageUrl;
                                }
                            },
                            complete: () => {
                                resolve(); // 无论成功失败，都算完成，不阻塞主流程
                            }
                        });
                    })
                );
            }

            // 预加载用户头像
            if (post.authorAvatar) {
                imageDownloadTasks.push(
                    new Promise((resolve) => {
                        const isH5 = typeof window !== 'undefined';
                        const isCloudFile = typeof post.authorAvatar === 'string' && post.authorAvatar.indexOf('cloud://') === 0;
                        let shouldSkipDownload = false;
                        if (isH5) {
                            if (isCloudFile) {
                                shouldSkipDownload = true;
                            } else if (/^https?:\/\//.test(post.authorAvatar)) {
                                shouldSkipDownload = !post.authorAvatar.startsWith(window.location.origin);
                            }
                        }
                        if (shouldSkipDownload) {
                            console.log('🔍 [H5] 作者头像预加载跳过下载，直接使用原URL');
                            app.globalData.preloadedImages[post.authorAvatar] = post.authorAvatar;
                            resolve();
                            return;
                        }
                        uni.downloadFile({
                            url: post.authorAvatar,
                            success: (res) => {
                                if (res.statusCode === 200) {
                                    console.log('作者头像预加载成功');
                                    app.globalData.preloadedImages[post.authorAvatar] = res.tempFilePath;
                                }
                            },
                            fail: (err) => {
                                if (isH5 || isCloudFile) {
                                    console.error('作者头像预加载失败(已使用原URL):', err);
                                    app.globalData.preloadedImages[post.authorAvatar] = post.authorAvatar;
                                }
                            },
                            complete: () => {
                                resolve();
                            }
                        });
                    })
                );
            }

            // 预加载其他可能用到的图片（移除svg）
            const commonImages = ['/static/images/like.png', '/static/images/liked.png'];
            commonImages.forEach((imagePath) => {
                imageDownloadTasks.push(
                    new Promise((resolve) => {
                        uni.getImageInfo({
                            src: imagePath,
                            complete: () => {
                                console.log('通用图片预加载尝试完毕:', imagePath);
                                resolve(); // 无论成功失败，都算完成
                            }
                        });
                    })
                );
            });

            // 返回一个 Promise.all，它会等待所有图片下载任务都完成
            return Promise.all(imageDownloadTasks);
        },

        navigateToTarget: function () {
            console.log('navigateToTarget方法被调用');
            // 开始淡出动画
            this.startFadeOut();

            // 延迟跳转，让动画完成
            setTimeout(() => {
                console.log('开始检查用户登录状态');
                // 检查用户是否已登录
                const app = getApp();
                console.log('用户登录状态检查:', {
                    userInfo: !!app.globalData.userInfo,
                    openid: !!app.globalData.openid
                });

                if (app.globalData.userInfo && app.globalData.openid) {
                    console.log('用户已登录，跳转到poem页面');
                    // 用户已登录，跳转到主页面
                    uni.switchTab({
                        url: '/pages/poem-square/poem-square'
                    });
                } else {
                    console.log('用户未登录，跳转到登录页面');
                    // 用户未登录，跳转到新的登录页面（支持poemid和password登录）
                    uni.redirectTo({
                        url: '/pages/login/login'
                    });
                }
            }, 800); // 等待动画完成
        },

        startFadeOut: function () {
            // 添加淡出和缩放动画类
            this.setData({
                fadeOut: true,
                zoomOut: true
            });
        }
    }
};
</script>
<style>
page {
    margin: 0;
    padding: 0;
    height: 100vh;
    overflow: hidden;
}

.container {
    width: 100vw;
    height: 100vh;
    background-color: #fff;
    color: #000;
    display: flex;
    justify-content: center;
    align-items: center;
}

/* ---- 阶段一：打字机 ---- */
.typing-phase-container {
    position: relative;
    width: 100%;
    height: 100vh;
}

/* ---- 文字层：固定高度，预留光标空间 ---- */
.text-layer {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    display: flex;
    flex-direction: column;
    align-items: center;
    min-height: 120rpx; /* 预留足够空间给光标 */
}

.typewriter-effect {
    font-family: monospace;
    font-size: 48rpx;
    display: flex;
    align-items: center;
}

.blinking-cursor {
    width: 4rpx;
    height: 48rpx;
    background-color: #000;
    margin-left: 10rpx;
    animation: blink 1s steps(1) infinite;
}

.blinking-cursor.hidden {
    opacity: 0 !important;
    animation: none !important;
}

@keyframes blink {
    50% {
        opacity: 0;
    }
}

/* ---- 按钮层：独立定位 ---- */
.enter-key-container {
    position: absolute;
    bottom: 50rpx;
    right: 20rpx;
    cursor: pointer;
    animation: slideInUp 0.8s ease-out;
    transition: all 0.2s ease;
    width: 640rpx;
    height: 400rpx;
    padding: 20rpx;
    box-sizing: border-box;
}

.enter-key-container:active {
    transform: scale(0.95);
}

.enter-key-container.loading {
    opacity: 0.6;
    cursor: not-allowed;
}

.enter-key-container.loading:active {
    transform: scale(1);
}

.enter-key-image {
    width: 100%;
    height: 100%;
    display: block;
}

/* L形回车键主体 */
.enter-key-l-shape {
    position: relative;
    width: 100%;
    height: 100%;
}

/* 横向部分 - 较长 */
.enter-key-horizontal {
    position: absolute;
    top: 0;
    left: 50rpx;
    right: 0;
    height: 50rpx;
    background-color: #f5f5f5;
    border: 2rpx solid #ddd;
    border-radius: 6rpx;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0 12rpx;
    z-index: 2;
    box-sizing: border-box;
}

/* 纵向部分 - 较短 */
.enter-key-vertical {
    position: absolute;
    top: 48rpx;  /* 与横向部分底部对齐（50rpx - 2rpx边框） */
    left: 0;
    width: 52rpx;  /* 与横向部分左侧对齐（50rpx + 2rpx边框） */
    height: 52rpx;  /* 总高度100rpx - 横向高度50rpx + 边框调整 */
    background-color: #f5f5f5;
    border: 2rpx solid #ddd;
    border-radius: 6rpx;
    z-index: 1;
    box-sizing: border-box;
}

/* 确保连接处没有重叠或间隙 */
.enter-key-horizontal {
    border-left: none;  /* 移除横向部分的左边框，让两部分无缝连接 */
    border-top-left-radius: 0;
    border-bottom-left-radius: 0;
}

.enter-key-vertical {
    border-top: none;  /* 移除纵向部分的上边框，让两部分无缝连接 */
    border-top-left-radius: 0;
    border-top-right-radius: 0;
}

.enter-key-arrow {
    font-size: 28rpx;
    font-weight: bold;
    color: #333;
    margin-right: 6rpx;
}

.enter-key-label {
    font-size: 20rpx;
    font-weight: 500;
    color: #333;
    text-transform: lowercase;
    letter-spacing: 1rpx;
}

/* 悬浮和点击效果 */
.enter-key-container:hover .enter-key-horizontal,
.enter-key-container:hover .enter-key-vertical {
    background-color: #e8e8e8;
    border-color: #ccc;
}

.enter-key-container:active .enter-key-horizontal,
.enter-key-container:active .enter-key-vertical {
    background-color: #d0d0d0;
    border-color: #bbb;
}

/* ——— Override: hide legacy pieces to avoid ghosts ——— */


/* New L-key layers */
.ek-layer { display: none !important; }

/* ---- 换行后的光标 ---- */
.new-line-cursor-container {
    display: flex;
    justify-content: center;
    align-items: center;
    margin-top: 20rpx;
}

.new-line-cursor {
    width: 4rpx;
    height: 48rpx;
    background-color: #000;
    animation: blink 1s steps(1) infinite;
}

@keyframes slideInUp {
    from {
        opacity: 0;
        transform: translateX(60rpx) translateY(60rpx);
    }
    to {
        opacity: 1;
        transform: translateX(0) translateY(0);
    }
}

/* ---- 阶段二：开屏图 ---- */
.image-phase-container {
    width: 100%;
    height: 100%;
    animation: fadeIn 0.8s ease-in-out;
}

.splash-image {
    width: 100%;
    height: 100%;
    object-fit: cover;
}

@keyframes fadeIn {
    from {
        opacity: 0;
    }
    to {
        opacity: 1;
    }
}

/* ---- 原有的样式（保留作为备用） ---- */
.splash-container {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    width: 100vw;
    height: 100vh;
    margin: 0;
    padding: 0;
    overflow: hidden;
    background-color: #000;
    opacity: 1;
    transition: opacity 0.8s ease-in-out;
}

.splash-container.fade-out {
    opacity: 0;
}

.splash-image.zoom-out {
    transform: scale(1.1);
}

.loading-indicator {
    position: absolute;
    bottom: 100rpx;
    left: 50%;
    transform: translateX(-50%);
    color: rgba(255, 255, 255, 0.8);
    font-size: 28rpx;
    z-index: 10;
}

.ek-layer { display: none !important; }

/* 平面风回车键统一描边 */
.enter-key-l-shape { position: relative; width: 100%; height: 100%; }
.enter-key-horizontal { position: absolute; top: 0; left: 64rpx; right: 0; height: 96rpx; background: #fff; border: 4rpx solid #333; border-left: none; border-top-left-radius: 0; border-bottom-left-radius: 0; border-top-right-radius: 22rpx; border-bottom-right-radius: 22rpx; box-sizing: border-box; }
.enter-key-vertical { position: absolute; top: 92rpx; left: 0; width: 64rpx; height: 68rpx; background: #fff; border: 4rpx solid #333; border-top: none; border-top-left-radius: 0; border-top-right-radius: 0; border-bottom-left-radius: 22rpx; border-bottom-right-radius: 22rpx; box-sizing: border-box; }
.enter-key-label { position: absolute; left: 22rpx; bottom: 18rpx; font-size: 24rpx; color: #333; font-weight: 500; }
.enter-key-arrow { position: absolute; right: 22rpx; bottom: 18rpx; font-size: 26rpx; color: #333; font-weight: 700; }
</style>

