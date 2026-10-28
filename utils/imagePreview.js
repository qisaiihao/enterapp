import fileUrlCache from '@/cache/core/file-url.js';

const isCloudUrl = url => typeof url === 'string' && url.startsWith('cloud://');

/**
 * 图片预览工具，兼容事件与显式参数调用
 * @param {Object|Event} input 事件对象或参数对象
 * @param {Object} [options]
 * @param {boolean} [options.fallbackToast=true] 是否在无法预览时给出提示
 * @returns {Promise|false} 返回 uni.previewImage 的 Promise，失败时返回 false
 */
function previewImage(input, options = {}) {
    const { fallbackToast = true } = options;
    const payload = normalizeInput(input);
    if (!payload.current && payload.urls.length === 0) {
        if (fallbackToast) {
            safeToast('图片数据缺失');
        }
        return false;
    }

    const urls = payload.urls.length ? payload.urls : [payload.current];
    const current = urls.includes(payload.current) ? payload.current : urls[0];

    if (!current || urls.length === 0) {
        if (fallbackToast) {
            safeToast('图片不可预览');
        }
        return false;
    }

    const fileIDs = urls.filter(isCloudUrl);
    if (!fileIDs.length) {
        return uni.previewImage({ current, urls });
    }

    // 旧个人主页快照可能保留云文件 ID，预览前通过统一缓存转换。
    const fail = () => {
        if (fallbackToast) safeToast('图片加载失败，请稍后重试');
        return false;
    };
    return fileUrlCache.getTempUrls(fileIDs).then(map => {
        const resolve = url => (map && map[url]) || url;
        const resolvedCurrent = resolve(current);
        if (isCloudUrl(resolvedCurrent)) return fail();
        return uni.previewImage({
            current: resolvedCurrent,
            urls: urls.map(resolve).filter(url => !isCloudUrl(url))
        });
    }, fail);
}

/**
 * 从事件/参数对象中抽取 current 与 urls
 * @param {Object|Event} input
 * @returns {{current: string, urls: string[]}}
 */
function normalizeInput(input) {
    if (!input) {
        return { current: '', urls: [] };
    }

    // 事件对象：读取 dataset
    if (input.currentTarget && input.currentTarget.dataset) {
        const { dataset } = input.currentTarget;
        const current =
            dataset.src ||
            dataset.current ||
            dataset.url ||
            (Array.isArray(dataset.urls) && dataset.urls[0]) ||
            '';

        const original = dataset.originalImageUrls || dataset.urls || dataset.urlList;
        const urls = Array.isArray(original)
            ? original.filter(Boolean)
            : (typeof original === 'string' && original ? [original] : []);

        return { current, urls };
    }

    // 参数对象
    const current =
        input.current ||
        input.src ||
        (Array.isArray(input.urls) && input.urls[0]) ||
        (Array.isArray(input.list) && input.list[0]) ||
        '';

    const urls = Array.isArray(input.urls)
        ? input.urls.filter(Boolean)
        : Array.isArray(input.list)
          ? input.list.filter(Boolean)
          : [];

    return { current, urls };
}

function safeToast(title) {
    if (typeof uni !== 'undefined' && uni.showToast) {
        uni.showToast({
            title,
            icon: 'none'
        });
    }
}

export { previewImage };

export default {
    previewImage
};

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        previewImage
    };
}
