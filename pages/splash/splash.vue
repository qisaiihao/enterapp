<template>
    <view class="container" :style="{ opacity: fadeOut ? 0 : 1, transition: 'opacity 0.2s ease' }">
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
            <view v-if="showEnterButton" :class="'enter-key-container ' + (preloadCompleted ? '' : 'loading')" @tap="handleEnterButtonClick">
                <image class="enter-key-image" src="/static/images/enter_key.png" mode="aspectFit"></image>
            </view>
        </view>
        <!-- 网络未完成时沿用现有加载提示 -->
        <view class="loading-indicator" v-if="isPreloading">正在加载内容...</view>
    </view>
    <PrivacyConsentDialog
        :visible="showPrivacyConsent"
        @agree="handlePrivacyConsentAgree"
        @decline="handlePrivacyConsentDecline"
    />
    <app-overlay-host :suppress-update="true" />
</template>

<script>
import PrivacyConsentDialog from '@/components/PrivacyConsentDialog.vue';
import { getShareAppMessageConfig, getShareTimelineConfig } from '@/utils/shareHelper.js';
import { formatErrorForLog } from '@/utils/error-log.js';
import { lightImpact } from '@/utils/haptics.js';
import { acceptPrivacyConsent, hasAcceptedPrivacyConsent } from '@/utils/privacyConsent.js';
import { createSplashGate, SPLASH_MIN_MS } from '@/utils/splashGate.js';
import { preloadPoemSquare } from '@/utils/splashPreload.js';

export default {
    components: { PrivacyConsentDialog },
    data() {
        return {
            currentPhase: 'typing',
            fullText: 'poementer',
            typedText: '',
            typingCompleted: false,
            showEnterButton: false,
            showNewLineCursor: false,
            textMoveUp: false,
            preloadCompleted: false,
            isPreloading: true,
            fadeOut: false,
            showPrivacyConsent: false
        };
    },
    onLoad() {
        this._splashDisposed = false;
        this._splashLeaving = false;
        this._splashNavigating = false;
        this._splashFlowStarted = false;
        this._startupStartedAt = Date.now();
        this.executeTypingAnimation();
        // 未确认隐私政策前不启动数据预加载和开屏放行计时，确认后再进入。
        if (hasAcceptedPrivacyConsent()) this.startSplashFlow();
        else this.showPrivacyConsent = true;
    },
    onUnload() {
        this._splashDisposed = true;
        clearTimeout(this._typingTimer);
        clearTimeout(this._privacyReopenTimer);
        this._splashGate?.dispose();
    },
    methods: {
        executeTypingAnimation() {
            const startedAt = Date.now();
            const interval = SPLASH_MIN_MS / Math.max(1, this.fullText.length);
            const typeNextChar = () => {
                if (this._splashDisposed || this._splashLeaving) return;
                this.typedText = this.fullText.slice(0, this.typedText.length + 1);
                if (this.typedText.length >= this.fullText.length) {
                    this.typingCompleted = true;
                    this.showEnterButton = !this.preloadCompleted;
                    this.textMoveUp = true;
                    this.enterWhenReady();
                    return;
                }
                // 以启动时间校准节奏，约 1.5 秒完整打完，不受网络速度影响。
                this._typingTimer = setTimeout(typeNextChar,
                    Math.max(0, (this.typedText.length + 1) * interval - (Date.now() - startedAt)));
            };
            this._typingTimer = setTimeout(typeNextChar, interval);
        },
        startSplashFlow() {
            if (this._splashDisposed || this._splashFlowStarted) return;
            this._splashFlowStarted = true;
            this._splashGate = createSplashGate({
                onLeaving: ({ reason, elapsedMs }) => {
                    this._splashLeaving = true;
                    clearTimeout(this._typingTimer);
                    this.showEnterButton = false;
                    this.showNewLineCursor = true;
                    this.isPreloading = false;
                    this.fadeOut = true;
                    console.info('[splash] leaving', { reason, elapsedMs, contentReady: this.preloadCompleted });
                },
                onNavigate: () => this.navigateAfterSplash(),
                // 隐私确认已占用过开屏展示时间，最短时长只补足剩余部分。
                minMs: Math.max(0, SPLASH_MIN_MS - (Date.now() - this._startupStartedAt))
            });
            preloadPoemSquare(this).then(() => {
                if (this._splashDisposed) return;
                this.preloadCompleted = true;
                this.isPreloading = false;
                console.info('[splash] content ready', { elapsedMs: Date.now() - this._startupStartedAt });
                this.enterWhenReady();
            }).catch(error => {
                if (this._splashDisposed) return;
                console.warn('[splash] preload fallback:', formatErrorForLog(error));
                // 失败也保留跳过按钮，未点击则由独立的 6 秒截止定时器放行。
            });
            this.enterWhenReady();
        },
        handlePrivacyConsentAgree() {
            acceptPrivacyConsent();
            this.showPrivacyConsent = false;
            this.startSplashFlow();
        },
        handlePrivacyConsentDecline() {
            this.showPrivacyConsent = false;
            if (this.exitForPrivacyConsent()) return;
            this.reopenPrivacyConsent();
        },
        exitForPrivacyConsent() {
            // #ifdef APP-PLUS
            if (typeof plus !== 'undefined' && plus.runtime && typeof plus.runtime.quit === 'function') {
                plus.runtime.quit();
                return true;
            }
            // #endif
            // #ifdef MP-WEIXIN
            if (typeof wx !== 'undefined' && typeof wx.exitMiniProgram === 'function') {
                wx.exitMiniProgram({ fail: () => this.reopenPrivacyConsent() });
                return true;
            }
            // #endif
            return false;
        },
        reopenPrivacyConsent() {
            if (this._splashDisposed) return;
            uni.showToast({ title: '请同意隐私政策后使用本应用', icon: 'none' });
            clearTimeout(this._privacyReopenTimer);
            this._privacyReopenTimer = setTimeout(() => {
                if (!this._splashDisposed) this.showPrivacyConsent = true;
            }, 300);
        },
        enterWhenReady() {
            if (this._splashDisposed || this._splashLeaving || !this._splashGate || !this.typingCompleted || !this.preloadCompleted) return;
            this.showEnterButton = false;
            this._splashGate.settle('ready');
        },
        handleEnterButtonClick() {
            if (this._splashDisposed || this._splashNavigating || !this.showEnterButton) return;
            lightImpact();
            if (this._navigationFailed) this.navigateAfterSplash();
            else this._splashGate?.skip();
        },
        navigateAfterSplash() {
            if (this._splashDisposed || this._splashNavigating) return;
            this._splashNavigating = true;
            this._navigationFailed = false;
            const url = '/pages/poem-square/poem-square';
            // switchTab 在 App 上会以 auto 关闭非 Tab 窗口，额外触发右滑。
            // 开屏已经自行淡出，reLaunch 用 none 切换并清理开屏页面栈。
            uni.reLaunch({
                url,
                fail: () => {
                    if (this._splashDisposed) return;
                    this._splashNavigating = false;
                    this._navigationFailed = true;
                    this.fadeOut = false;
                    this.showEnterButton = true;
                    this.showNewLineCursor = false;
                    uni.showToast({ title: '进入失败，请点击重试', icon: 'none' });
                }
            });
        },
        onShareAppMessage() {
            return getShareAppMessageConfig({ title: 'poementer', path: '/pages/poem-square/poem-square' });
        },
        onShareTimeline() {
            return getShareTimelineConfig({ title: 'poementer' });
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
