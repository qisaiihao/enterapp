import { EVENTS } from '@/utils/events.js';
import {
    getCachedAppBackgroundUrl,
    getRawAppBackgroundUrl,
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
            appBackgroundResolvedUrl: ''
        };
    },
    computed: {
        hasAppBackground() {
            return !!this.appBackgroundResolvedUrl;
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
                if (!nextUrl && payload.cleared) {
                    this.appBackgroundResolvedUrl = '';
                    return;
                }
                if (nextUrl) {
                    this.appBackgroundResolvedUrl = nextUrl;
                    return;
                }
                this.refreshAppBackground();
            };
            uni.$on(EVENTS.APP_BACKGROUND_UPDATED, this._appBackgroundHandler);
        }
    },
    beforeDestroy() {
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

            if (!currentUserInfo || !(currentUserInfo._openid || currentUserInfo.openid)) {
                if (requestId === this._appBackgroundRequestId) {
                    setCachedAppBackgroundUrl('');
                    this.appBackgroundResolvedUrl = '';
                }
                return;
            }

            if (!rawUrl) {
                if (requestId === this._appBackgroundRequestId) {
                    setCachedAppBackgroundUrl('');
                    this.appBackgroundResolvedUrl = '';
                }
                return;
            }

            try {
                const resolvedUrl = await syncAppBackgroundFromUserInfo(currentUserInfo, { emit: false });
                if (requestId === this._appBackgroundRequestId) {
                    this.appBackgroundResolvedUrl = normalizeAppBackgroundUrl(resolvedUrl) || getCachedAppBackgroundUrl();
                }
            } catch (error) {
                console.warn('[appBackgroundPage] refresh failed', error);
                if (requestId === this._appBackgroundRequestId) {
                    this.appBackgroundResolvedUrl = getCachedAppBackgroundUrl();
                }
            }
        }
    }
};
