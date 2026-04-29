<script>
// #ifdef APP-PLUS
import { checkAndUpdate } from '@/utils/hotUpdate.js';
// #endif
import {
    getAppState,
    markLoginProcessCompleted,
    markLoginProcessStarted,
    patchAppState,
    setUserSession
} from '@/utils/app-state.js';
import { formatErrorForLog } from '@/utils/error-log.js';
import { ensureRuntimeOpenid, ensureTcbAuthenticated, installRuntimeBindings } from '@/utils/runtime-bootstrap.js';

export default {
    data() {
        return {
            appState: {
                userInfo: null,
                openid: null,
                isLoggedIn: false,
                _loginProcessStarted: false,
                _loginProcessCompleted: false
            }
        };
    },

    onLaunch() {
        installRuntimeBindings(this);
        this.syncGlobalDataFromAppState();
        // #ifdef APP-PLUS
        this.runWhenPlusReady((plusInstance) => {
            const args = this.getPlusRuntimeArguments(plusInstance);
            if (args && args.includes('github-callback')) {
                this.handleUrlScheme({ path: args });
            }
        }, 'handle launch args');
        // #endif

        uni.removeStorageSync('cachedPostList');

        // #ifdef APP-PLUS
        this.runWhenPlusReady((plusInstance) => {
            try {
                plusInstance.runtime.getProperty(plusInstance.runtime.appid, () => {
                    checkAndUpdate({ silent: true, showConfirm: true }).catch((error) => {
                        const message = error && (error.errMsg || error.message || String(error));
                        if (!message || (!message.includes('resource exhausted') && !message.includes('ResourceExhausted'))) {
                            console.warn(`[App] hot update check skipped: ${formatErrorForLog(error)}`);
                        }
                    });
                });
            } catch (error) {
                console.warn(`[App] hot update bootstrap failed: ${formatErrorForLog(error)}`);
            }
        }, 'check hot update');
        // #endif

        markLoginProcessStarted();
        this.syncGlobalDataFromAppState();

        // #ifdef MP-WEIXIN
        if (!this.appState._mpBuiltinFontPreloadStarted) {
            this.applyAppState({ _mpBuiltinFontPreloadStarted: true });
            try { uni.setStorageSync('__builtin_font_huiwen_ready__', false); } catch (_) {}
        }
        // #endif

        this.$nextTick(() => {
            this.loginAndCheckUser();
        });
    },

    onShow() {
        // #ifdef APP-PLUS
        this.runWhenPlusReady((plusInstance) => {
            const args = this.getPlusRuntimeArguments(plusInstance);
            if (args && args.includes('github-callback')) {
                this.handleUrlScheme({ path: args });
            }

            if (!this._newintentListenerAdded && plusInstance.globalEvent && plusInstance.globalEvent.addEventListener) {
                plusInstance.globalEvent.addEventListener('newintent', () => {
                    const nextArgs = this.getPlusRuntimeArguments(plusInstance);
                    if (nextArgs) {
                        this.handleUrlScheme({ path: nextArgs });
                    }
                });
                this._newintentListenerAdded = true;
            }
        }, 'handle app show');
        // #endif
    },

    methods: {
        syncGlobalDataFromAppState() {
            this.appState = Object.assign({}, this.appState, getAppState());
        },

        applyAppState(partial = {}) {
            patchAppState(partial);
            this.syncGlobalDataFromAppState();
        },

        applyUserSession(userInfo, openid = null, extra = {}) {
            setUserSession(userInfo, openid);
            if (extra && Object.keys(extra).length > 0) {
                patchAppState(extra);
            }
            this.syncGlobalDataFromAppState();
        },

        finishLoginProcess(extra = {}) {
            markLoginProcessCompleted();
            if (extra && Object.keys(extra).length > 0) {
                patchAppState(extra);
            }
            this.syncGlobalDataFromAppState();
        },

        runWhenPlusReady(handler, taskLabel) {
            // #ifdef APP-PLUS
            const execute = (plusInstance) => {
                try {
                    handler && handler(plusInstance);
                } catch (error) {
                    console.warn(`[App] ${taskLabel || 'app-plus task'} failed: ${formatErrorForLog(error)}`);
                }
            };

            if (typeof plus !== 'undefined' && plus && plus.runtime) {
                execute(plus);
                return;
            }

            const start = Date.now();
            const timer = setInterval(() => {
                if (typeof plus !== 'undefined' && plus && plus.runtime) {
                    clearInterval(timer);
                    execute(plus);
                    return;
                }

                if (Date.now() - start >= 10000) {
                    clearInterval(timer);
                    console.warn(`[App] ${taskLabel || 'app-plus task'} skipped: plus not ready`);
                }
            }, 50);
            // #endif
        },

        getPlusRuntimeArguments(plusInstance) {
            try {
                return plusInstance && plusInstance.runtime ? (plusInstance.runtime.arguments || '') : '';
            } catch (error) {
                console.warn(`[App] read plus runtime arguments failed: ${formatErrorForLog(error)}`);
                return '';
            }
        },

        handleUrlScheme(options) {
            // #ifdef APP-PLUS
            if (!(options && options.path) || !options.path.includes('github-callback')) {
                return;
            }

            try {
                const params = {};
                const queryString = options.path.split('?')[1];
                if (queryString) {
                    queryString.split('&').forEach((pair) => {
                        const [key, value] = pair.split('=');
                        params[key] = decodeURIComponent(value || '');
                    });
                }

                const type = params.type;
                const data = params.data;

                if (type === 'register') {
                    try {
                        uni.setStorageSync('github_temp_data', JSON.parse(data));
                    } catch (error) {
                        console.warn(`[App] parse github register payload failed: ${formatErrorForLog(error)}`);
                    }

                    uni.showToast({ title: '欢迎！请完成注册', icon: 'none', duration: 2000 });
                    setTimeout(() => {
                        uni.reLaunch({
                            url: `/pages/register/register?fromGithub=true&githubData=${encodeURIComponent(data)}`
                        });
                    }, 500);
                    return;
                }

                if (type === 'login') {
                    const loginData = JSON.parse(data || '{}');
                    const userInfo = loginData.user;

                    this.applyUserSession(userInfo, userInfo && (userInfo._openid || userInfo.openid), {
                        _loginProcessCompleted: true,
                        isLoggedIn: true
                    });

                    uni.setStorageSync('userInfo', userInfo);
                    uni.setStorageSync('github_access_token', loginData.accessToken);

                    uni.showToast({ title: '登录成功！', icon: 'success', duration: 2000 });
                    setTimeout(() => {
                        uni.reLaunch({ url: '/pages/poem-square/poem-square' });
                    }, 500);
                    return;
                }

                if (type === 'error') {
                    const errorInfo = JSON.parse(data || '{}');
                    uni.showModal({
                        title: 'GitHub 登录失败',
                        content: errorInfo.message || 'GitHub 登录失败，请重试',
                        showCancel: false,
                        confirmText: '知道了',
                        success: () => {
                            uni.reLaunch({ url: '/pages/login/login' });
                        }
                    });
                }
            } catch (error) {
                console.error(`[App] handle github callback failed: ${formatErrorForLog(error)}`);
                uni.showToast({
                    title: '授权失败，请重试',
                    icon: 'none',
                    duration: 2000
                });
            }
            // #endif
        },

        getCurrentPagePath() {
            try {
                const pages = getCurrentPages();
                const currentPage = pages[pages.length - 1];
                if (currentPage) {
                    return currentPage.route || currentPage.$page?.fullPath || '';
                }
            } catch (error) {
                console.warn(`[App] get current page failed: ${formatErrorForLog(error)}`);
            }
            return '';
        },

        isAllowedPageForUnauthenticated() {
            return true;
        },

        async loginAndCheckUser() {
            installRuntimeBindings(this);

            if (!this.$tcb) {
                console.error('[App] runtime tcb unavailable');
                this.finishLoginProcess();
                return;
            }

            try {
                await ensureTcbAuthenticated(this.$tcb);
                const bootstrappedOpenid = await ensureRuntimeOpenid();
                if (bootstrappedOpenid) {
                    this.applyAppState({ openid: bootstrappedOpenid });
                }
            } catch (error) {
                console.warn(`[App] bootstrap openid failed: ${formatErrorForLog(error)}`);
            }

            const cachedUserInfo = uni.getStorageSync('userInfo');
            if (cachedUserInfo && cachedUserInfo._openid) {
                try {
                    await ensureTcbAuthenticated(this.$tcb);

                    const verifyRes = await this.$tcb.callFunction({
                        name: 'getUserProfile',
                        data: { userId: cachedUserInfo._openid }
                    });

                    if (verifyRes.result && verifyRes.result.success && verifyRes.result.userInfo) {
                        const latestUserInfo = verifyRes.result.userInfo;
                        this.applyUserSession(latestUserInfo, latestUserInfo._openid, {
                            _loginProcessCompleted: true,
                            isLoggedIn: true
                        });
                        uni.setStorageSync('userInfo', latestUserInfo);
                        return;
                    }

                    uni.removeStorageSync('userInfo');
                } catch (error) {
                    console.error(`[App] verify cached user failed: ${formatErrorForLog(error)}`);
                    uni.removeStorageSync('userInfo');
                }
            }

            try {
                await ensureTcbAuthenticated(this.$tcb);

                let openid = this.appState.openid;
                if (!openid) {
                    const loginRes = await this.$tcb.callFunction({
                        name: 'login',
                        __skipOpenidGuard: true
                    });

                    if (loginRes.result && loginRes.result.openid) {
                        openid = loginRes.result.openid;
                    } else if (loginRes.openid) {
                        openid = loginRes.openid;
                    } else if (loginRes.result && loginRes.result.uid) {
                        openid = loginRes.result.uid;
                    }
                }

                if (!openid) {
                    throw new Error('云函数 login 未返回 openid');
                }

                this.applyAppState({ openid });
                uni.setStorageSync('userOpenId', openid);

                const db = this.$tcb.database();
                const userRes = await db.collection('users').where({ _openid: openid }).get();

                if (Array.isArray(userRes.data) && userRes.data.length > 0) {
                    const userInfo = userRes.data[0];
                    this.applyAppState({ userInfo });
                    uni.setStorageSync('userInfo', userInfo);
                } else {
                    this.applyAppState({ userInfo: null });
                }

                this.finishLoginProcess({
                    userInfo: this.appState.userInfo,
                    openid: this.appState.openid,
                    isLoggedIn: !!this.appState.userInfo
                });
            } catch (error) {
                console.error(`[App] login bootstrap failed: ${formatErrorForLog(error)}`);
                this.finishLoginProcess();
                uni.showToast({
                    icon: 'none',
                    title: '登录失败，请稍后重试'
                });
            }
        }
    }
};
</script>

<style>
page,
body,
#app,
uni-page,
uni-page-body {
    background: var(--app-page-bg, #ffffff);
    color: var(--app-primary-text, #111111);
}

view,
text {
    box-sizing: border-box;
}

/* 全局字体预加载 - 仅用于诗歌内容 */
/* 小程序不支持 CSS @font-face 加载本地字体，只在 H5 和 APP 环境使用 */
/* #ifndef MP-WEIXIN */
@font-face {
  font-family: '汇文明朝';
  src: url('/static/fonts/Huiwen-mincho-compressed.woff2') format('woff2');
  font-weight: normal;
  font-style: normal;
  font-display: swap;
}
/* #endif */

/* 全局样式：修改下拉刷新的loading转圈圈颜色为黑色 */
/* #ifdef MP-WEIXIN */
.wx-pull-refresh {
    color: #000000 !important;
}

.wx-pull-refresh .wx-pull-refresh-spinner {
    color: #000000 !important;
}

.wx-pull-refresh .wx-pull-refresh-spinner::before {
    color: #000000 !important;
}
/* #endif */

/* #ifdef H5 */
.uni-pull-refresh {
    color: #000000 !important;
}

.uni-pull-refresh .uni-pull-refresh-spinner {
    color: #000000 !important;
}

.uni-pull-refresh .uni-pull-refresh-spinner::before {
    color: #000000 !important;
}
/* #endif */

/* #ifdef APP-PLUS */
.uni-pull-refresh {
    color: #000000 !important;
}

.uni-pull-refresh .uni-pull-refresh-spinner {
    color: #000000 !important;
}

.uni-pull-refresh .uni-pull-refresh-spinner::before {
    color: #000000 !important;
}
/* #endif */

.uni-pull-refresh,
.wx-pull-refresh,
.pull-refresh {
    color: #000000 !important;
}

.uni-pull-refresh .uni-pull-refresh-spinner,
.wx-pull-refresh .wx-pull-refresh-spinner,
.pull-refresh .pull-refresh-spinner {
    color: #000000 !important;
    border-color: #000000 !important;
}

.uni-pull-refresh .uni-pull-refresh-spinner::before,
.wx-pull-refresh .wx-pull-refresh-spinner::before,
.pull-refresh .pull-refresh-spinner::before {
    color: #000000 !important;
    border-color: #000000 !important;
}

.uni-pull-refresh-indicator,
.wx-pull-refresh-indicator {
    color: #000000 !important;
}

.uni-pull-refresh-indicator .uni-pull-refresh-spinner,
.wx-pull-refresh-indicator .wx-pull-refresh-spinner {
    color: #000000 !important;
    border-color: #000000 !important;
}

[data-app-theme="dark"] .uni-pull-refresh,
[data-app-theme="dark"] .wx-pull-refresh,
[data-app-theme="dark"] .pull-refresh,
[data-app-theme="dark"] .uni-pull-refresh-indicator,
[data-app-theme="dark"] .wx-pull-refresh-indicator {
    color: #f4f1ea !important;
    background: var(--app-page-bg, #0f1115) !important;
}

[data-app-theme="dark"] .uni-pull-refresh .uni-pull-refresh-spinner,
[data-app-theme="dark"] .wx-pull-refresh .wx-pull-refresh-spinner,
[data-app-theme="dark"] .pull-refresh .pull-refresh-spinner,
[data-app-theme="dark"] .uni-pull-refresh-indicator .uni-pull-refresh-spinner,
[data-app-theme="dark"] .wx-pull-refresh-indicator .wx-pull-refresh-spinner {
    color: #f4f1ea !important;
    border-color: #f4f1ea !important;
}

/* #ifdef H5 */
[data-app-theme="dark"] .uni-page-head {
    background: var(--app-page-bg, #0f1115) !important;
    border-bottom-color: var(--app-border-color, rgba(255,255,255,0.12)) !important;
    color: var(--app-primary-text, #f4f1ea) !important;
}

[data-app-theme="dark"] .uni-page-head__title,
[data-app-theme="dark"] .uni-page-head .uni-page-head__title {
    color: var(--app-primary-text, #f4f1ea) !important;
}

[data-app-theme="dark"] .uni-page-head-btn,
[data-app-theme="dark"] .uni-page-head-btn i,
[data-app-theme="dark"] .uni-page-head .uni-btn-icon {
    color: var(--app-primary-text, #f4f1ea) !important;
}

[data-app-theme="dark"] .uni-page-head svg,
[data-app-theme="dark"] .uni-page-head path {
    fill: var(--app-primary-text, #f4f1ea) !important;
    stroke: var(--app-primary-text, #f4f1ea) !important;
}

html[data-app-theme="dark"],
body[data-app-theme="dark"],
[data-app-theme="dark"] {
    scrollbar-color: rgba(255, 255, 255, 0.24) var(--app-page-bg, #0f1115);
}

html[data-app-theme="dark"]::-webkit-scrollbar,
body[data-app-theme="dark"]::-webkit-scrollbar,
[data-app-theme="dark"] ::-webkit-scrollbar {
    width: 10px;
    height: 10px;
}

html[data-app-theme="dark"]::-webkit-scrollbar-track,
body[data-app-theme="dark"]::-webkit-scrollbar-track,
[data-app-theme="dark"] ::-webkit-scrollbar-track {
    background: var(--app-page-bg, #0f1115);
}

html[data-app-theme="dark"]::-webkit-scrollbar-thumb,
body[data-app-theme="dark"]::-webkit-scrollbar-thumb,
[data-app-theme="dark"] ::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.24);
    border-radius: 999px;
}

html[data-app-theme="dark"]::-webkit-scrollbar-corner,
body[data-app-theme="dark"]::-webkit-scrollbar-corner,
[data-app-theme="dark"] ::-webkit-scrollbar-corner {
    background: var(--app-page-bg, #0f1115);
}

[data-app-theme="dark"] .uni-modal {
    background: var(--app-elevated-bg, rgba(24, 28, 36, 0.96)) !important;
    color: var(--app-primary-text, #f4f1ea) !important;
    border: 1rpx solid var(--app-border-color, rgba(255,255,255,0.12)) !important;
}

[data-app-theme="dark"] .uni-modal__title {
    color: var(--app-primary-text, #f4f1ea) !important;
}

[data-app-theme="dark"] .uni-modal__bd {
    color: var(--app-secondary-text, #c9ced8) !important;
}

[data-app-theme="dark"] .uni-modal__ft {
    border-top-color: var(--app-border-color, rgba(255,255,255,0.12)) !important;
}

[data-app-theme="dark"] .uni-modal__btn {
    color: var(--app-primary-text, #f4f1ea) !important;
}

[data-app-theme="dark"] .uni-modal__btn::after {
    border-color: var(--app-border-color, rgba(255,255,255,0.12)) !important;
}

[data-app-theme="dark"] .uni-modal__btn_primary {
    color: var(--app-accent-color, #c9ad73) !important;
}
/* #endif */
</style>
