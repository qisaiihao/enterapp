import { EVENTS } from '@/utils/events.js';
import {
    getCachedAppBackgroundUrl,
    getRawAppBackgroundMode,
    getRawAppBackgroundUrl,
    normalizeAppBackgroundMode,
    normalizeAppBackgroundUrl,
    setCachedAppBackgroundUrl,
    syncAppBackgroundFromUserInfo
} from '@/utils/appBackground.js';

function escapeCssUrl(url) {
    return String(url || '').replace(/"/g, '\\"');
}

function readCurrentUserInfo() {
    try {
        const app = typeof getApp === 'function' ? getApp() : null;
        if (app && app.globalData && app.globalData.userInfo) {
            return app.globalData.userInfo;
        }
    } catch (_) {}

    try {
        const stored = uni.getStorageSync('userInfo');
        return stored && typeof stored === 'object' ? stored : null;
    } catch (_) {
        return null;
    }
}

export default {
    data() {
        return {
            appBackgroundResolvedUrl: '',
            appBackgroundMode: ''
        };
    },
    computed: {
        hasAppBackground() {
            return !!this.appBackgroundResolvedUrl && !!this.appBackgroundMode;
        },
        isFullBackground() {
            return this.hasAppBackground && this.appBackgroundMode === 'full';
        },
        isHeaderBackground() {
            return this.hasAppBackground && this.appBackgroundMode === 'header';
        },
        appBackgroundPageStyle() {
            if (!this.hasAppBackground) {
                return {};
            }
            return {
                '--app-background-image': `url("${escapeCssUrl(this.appBackgroundResolvedUrl)}")`
            };
        }
    },
    created() {
        this._appBackgroundHandler = null;
        this._appBackgroundRequestId = 0;
        this.refreshAppBackground();
    },
    onShow() {
        this.refreshAppBackground();
    },
    mounted() {
        if (typeof uni !== 'undefined' && typeof uni.$on === 'function') {
            this._appBackgroundHandler = (payload = {}) => {
                const nextUrl = normalizeAppBackgroundUrl(payload.url);
                const nextMode = normalizeAppBackgroundMode(payload.mode, nextUrl);
                if (!nextUrl && payload.cleared) {
                    this.appBackgroundResolvedUrl = '';
                    this.appBackgroundMode = '';
                    return;
                }
                if (nextUrl) {
                    this.appBackgroundResolvedUrl = nextUrl;
                    this.appBackgroundMode = nextMode;
                    return;
                }
                this.refreshAppBackground();
            };
            uni.$on(EVENTS.APP_BACKGROUND_UPDATED, this._appBackgroundHandler);
        }
    },
    beforeUnmount() {
        if (this._appBackgroundHandler && typeof uni !== 'undefined' && typeof uni.$off === 'function') {
            uni.$off(EVENTS.APP_BACKGROUND_UPDATED, this._appBackgroundHandler);
        }
        this._appBackgroundHandler = null;
    },
    methods: {
        async refreshAppBackground() {
            const requestId = ++this._appBackgroundRequestId;
            const currentUserInfo = readCurrentUserInfo();
            const rawUrl = getRawAppBackgroundUrl(currentUserInfo);
            const rawMode = getRawAppBackgroundMode(currentUserInfo);

            if (!currentUserInfo || !(currentUserInfo._openid || currentUserInfo.openid)) {
                if (requestId === this._appBackgroundRequestId) {
                    setCachedAppBackgroundUrl('');
                    this.appBackgroundResolvedUrl = '';
                    this.appBackgroundMode = '';
                }
                return;
            }

            if (!rawUrl) {
                if (requestId === this._appBackgroundRequestId) {
                    setCachedAppBackgroundUrl('');
                    this.appBackgroundResolvedUrl = '';
                    this.appBackgroundMode = '';
                }
                return;
            }

            try {
                const backgroundState = await syncAppBackgroundFromUserInfo(currentUserInfo, { emit: false });
                if (requestId === this._appBackgroundRequestId) {
                    const resolvedUrl = normalizeAppBackgroundUrl(backgroundState && backgroundState.url);
                    this.appBackgroundResolvedUrl = resolvedUrl || getCachedAppBackgroundUrl();
                    this.appBackgroundMode = normalizeAppBackgroundMode(
                        backgroundState && backgroundState.mode,
                        this.appBackgroundResolvedUrl
                    );
                }
            } catch (error) {
                console.warn('[appBackgroundPage] refresh failed', error);
                if (requestId === this._appBackgroundRequestId) {
                    this.appBackgroundResolvedUrl = getCachedAppBackgroundUrl();
                    this.appBackgroundMode = normalizeAppBackgroundMode(rawMode, this.appBackgroundResolvedUrl);
                }
            }
        }
    }
};
