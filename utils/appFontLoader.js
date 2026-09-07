// App-vue only. Keep page registration separate from downloaded-file caching.
export const APP_BUILTIN_FONT = Object.freeze({
    name: '汇文明朝',
    family: 'Huiwen-mincho',
    path: '/static/fonts/Huiwen-mincho-compressed.woff2'
});

export function getCurrentAppPage() {
    if (typeof getCurrentPages !== 'function') return null;
    const pages = getCurrentPages();
    return pages[pages.length - 1] || null;
}

export function resolveAppFontSource(fontPath, plusInstance) {
    if (!fontPath || !plusInstance || !plusInstance.io) return null;
    let source = fontPath;
    if (fontPath.startsWith('/static/')) {
        try { source = plusInstance.io.convertLocalFileSystemURL(`_www${fontPath}`); }
        catch (_) { source = plusInstance.io.convertLocalFileSystemURL(fontPath); }
    } else if (!/^(https?:|file:)/i.test(fontPath)) {
        source = plusInstance.io.convertLocalFileSystemURL(fontPath);
    }
    if (!source) return null;
    if (/^(https?:|file:|data:)/i.test(source)) return source;
    source = source.replace(/^\/?apps\//, '/android_asset/apps/');
    // Do not let the view layer append an absolute filesystem path to _www again.
    return source.startsWith('/') ? `file://${source}` : null;
}

export class AppFontLoader {
    constructor({ getPage = getCurrentAppPage, getPlus, register, onBuiltinReady }) {
        this.getPage = getPage;
        this.getPlus = getPlus;
        this.register = register;
        this.onBuiltinReady = onBuiltinReady;
        this.pages = new WeakMap();
    }

    isLoaded(name) {
        const page = this.getPage();
        const state = page && this.pages.get(page);
        return !!(state && state.loaded.has(name));
    }

    async ensure(name, loadOther, onProgress) {
        const page = this.getPage();
        if (!page) throw new Error('App 页面尚未就绪，无法注册字体');
        let state = this.pages.get(page);
        if (!state) {
            state = { loaded: new Map(), loading: new Map() };
            this.pages.set(page, state);
        }
        if (state.loaded.has(name)) {
            if (onProgress) onProgress(100);
            return state.loaded.get(name);
        }
        if (state.loading.has(name)) return state.loading.get(name);
        const task = (async () => {
            let fontPath;
            if (name === APP_BUILTIN_FONT.name) {
                // Deliberately no cache/cloud resolver in the builtin branch.
                fontPath = APP_BUILTIN_FONT.path;
                const loaded = await this.load(APP_BUILTIN_FONT.family, [fontPath], page);
                if (!loaded) throw new Error('汇文明朝本地字体注册失败');
                if (onProgress) onProgress(100);
            } else {
                fontPath = await loadOther(page);
            }
            if (this.getPage() !== page) throw new Error('字体加载期间页面已切换');
            state.loaded.set(name, fontPath);
            if (name === APP_BUILTIN_FONT.name && this.onBuiltinReady) this.onBuiltinReady();
            return fontPath;
        })();
        state.loading.set(name, task);
        try { return await task; }
        finally { state.loading.delete(name); }
    }

    async load(family, sources, page) {
        const plusInstance = await this.getPlus();
        if (!plusInstance || !plusInstance.io || !page || this.getPage() !== page) return false;
        const paths = [...new Set(sources.map(source => resolveAppFontSource(source, plusInstance)).filter(Boolean))];
        for (const source of paths) {
            if (this.getPage() !== page) return false;
            const loaded = await this.register(family, source, 0, { maxRetries: 0, timeoutMs: 10000 });
            if (loaded) return true;
        }
        return false;
    }
}
