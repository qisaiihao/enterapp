/**
 * 分享图片生成和处理工具函数
 */

function generateShareImageName(postId, userId) {
    const timestamp = Date.now();
    return `share_${postId}_${userId}_${timestamp}.jpg`;
}

function isValidImageDataUrl(dataUrl) {
    if (!dataUrl || typeof dataUrl !== 'string') {
        return false;
    }

    return /^data:image\/(jpeg|jpg|png);base64,([A-Za-z0-9+/=]+)$/.test(dataUrl);
}

function base64ToArrayBuffer(base64Data) {
    const base64 = String(base64Data || '').replace(/^data:image\/[a-z]+;base64,/, '');
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);

    for (let index = 0; index < binaryString.length; index += 1) {
        bytes[index] = binaryString.charCodeAt(index);
    }

    return bytes.buffer;
}

function saveImageToAlbum(imagePath) {
    return new Promise((resolve, reject) => {
        if (!imagePath) {
            reject(new Error('图片路径为空'));
            return;
        }

        uni.saveImageToPhotosAlbum({
            filePath: imagePath,
            success: (res) => resolve(res),
            fail: (err) => {
                console.error('保存图片到相册失败:', err);

                const errorMessage = (err && err.errMsg) || '';
                if (errorMessage.includes('auth deny') || errorMessage.includes('auth denied')) {
                    uni.showModal({
                        title: '提示',
                        content: '需要您授权保存图片到相册',
                        showCancel: true,
                        confirmText: '去授权',
                        success: (modalRes) => {
                            if (modalRes.confirm && uni.openSetting) {
                                uni.openSetting({
                                    success: (settingRes) => {
                                        if (settingRes.authSetting['scope.writePhotosAlbum']) {
                                            saveImageToAlbum(imagePath)
                                                .then(resolve)
                                                .catch(reject);
                                        } else {
                                            reject(new Error('用户未授权保存图片到相册'));
                                        }
                                    }
                                });
                            } else {
                                reject(new Error('用户未授权保存图片到相册'));
                            }
                        }
                    });
                    return;
                }

                reject(err);
            }
        });
    });
}

function createTempFilePath(fileName) {
    const timestamp = Date.now();
    const randomSuffix = Math.random().toString(36).substring(2, 8);
    const tempFileName = fileName || `share_${timestamp}_${randomSuffix}.jpg`;
    return `${uni.env.USER_DATA_PATH}/${tempFileName}`;
}

function compressImage(imagePath, quality = 80, maxWidth = 1080, maxHeight = 1920) { // eslint-disable-line no-unused-vars
    return new Promise((resolve, reject) => {
        if (!imagePath) {
            reject(new Error('图片路径为空'));
            return;
        }

        uni.compressImage({
            src: imagePath,
            quality,
            success: (res) => resolve(res.tempFilePath),
            fail: (err) => {
                console.error('压缩图片失败:', err);
                resolve(imagePath);
            }
        });
    });
}

function getImageInfo(imagePath) {
    return new Promise((resolve, reject) => {
        if (!imagePath) {
            reject(new Error('图片路径为空'));
            return;
        }

        uni.getImageInfo({
            src: imagePath,
            success: (res) => resolve(res),
            fail: (err) => {
                console.error('获取图片信息失败:', err);
                reject(err);
            }
        });
    });
}

function isBrowserEnv() {
    return typeof window !== 'undefined' && typeof document !== 'undefined';
}

function isLocalImagePath(path) {
    return /^(wxfile:|http:\/\/tmp\/|https:\/\/tmp\/|file:|_doc\/|\/storage\/|[A-Za-z]:\\|\/var\/)/i.test(String(path || ''));
}

function dataUrlToBlob(dataUrl) {
    const parts = String(dataUrl || '').split(',');
    const mimeMatch = parts[0] && parts[0].match(/:(.*?);/);
    const mime = (mimeMatch && mimeMatch[1]) || 'image/png';
    const binaryString = atob(parts[1] || '');
    const bytes = new Uint8Array(binaryString.length);

    for (let index = 0; index < binaryString.length; index += 1) {
        bytes[index] = binaryString.charCodeAt(index);
    }

    return new Blob([bytes], { type: mime });
}

function triggerBrowserDownload(url, fileName) {
    if (!isBrowserEnv()) {
        throw new Error('browser download unavailable');
    }

    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = fileName;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
}

function saveImageInBrowser(imagePath, fileName) {
    if (!isBrowserEnv()) {
        return Promise.reject(new Error('browser environment unavailable'));
    }

    return new Promise((resolve, reject) => {
        try {
            if (String(imagePath || '').startsWith('data:')) {
                const blob = dataUrlToBlob(imagePath);
                const url = URL.createObjectURL(blob);
                triggerBrowserDownload(url, fileName);
                setTimeout(() => URL.revokeObjectURL(url), 1000);
                resolve({ mode: 'browser-download' });
                return;
            }

            triggerBrowserDownload(imagePath, fileName);
            resolve({ mode: 'browser-download' });
        } catch (error) {
            reject(error);
        }
    });
}

function dataUrlToTempFilePath(dataUrl) {
    return new Promise((resolve, reject) => {
        if (typeof uni.base64ToTempFilePath !== 'function') {
            reject(new Error('base64ToTempFilePath unavailable'));
            return;
        }

        uni.base64ToTempFilePath({
            base64Data: dataUrl,
            success: (res) => resolve(res.filePath),
            fail: (err) => reject(err)
        });
    });
}

function downloadRemoteImage(url) {
    return new Promise((resolve, reject) => {
        uni.downloadFile({
            url,
            success: (res) => {
                if (res && res.statusCode === 200) {
                    resolve(res.tempFilePath || res.filePath || '');
                    return;
                }
                reject(new Error(`download failed: ${(res && res.statusCode) || 'unknown'}`));
            },
            fail: (err) => reject(err)
        });
    });
}

async function resolveSaveableImagePath(imagePath) {
    const safePath = String(imagePath || '').trim();
    if (!safePath) {
        throw new Error('图片路径为空');
    }

    if (safePath.startsWith('data:')) {
        return await dataUrlToTempFilePath(safePath);
    }

    if (/^https?:\/\//i.test(safePath)) {
        return await downloadRemoteImage(safePath);
    }

    return safePath;
}

function isPermissionError(error) {
    const message = error && error.errMsg ? error.errMsg : String(error || '');
    return /auth|authorize|denied|permission/i.test(message);
}

async function saveSingleImage(imagePath, fileName) {
    const safeFileName = fileName || `poementer_${Date.now()}.png`;

    if (isBrowserEnv()) {
        return await saveImageInBrowser(imagePath, safeFileName);
    }

    const localPath = await resolveSaveableImagePath(imagePath);
    await saveImageToAlbum(localPath);
    return {
        filePath: localPath
    };
}

async function saveImagesToAlbum(imagePaths, options = {}) {
    const {
        fileNamePrefix = 'poementer',
        showProgress = true,
        showResultToast = true
    } = options;

    const targets = (Array.isArray(imagePaths) ? imagePaths : [])
        .map((item) => String(item || '').trim())
        .filter(Boolean);

    if (!targets.length) {
        throw new Error('没有可保存的图片');
    }

    const results = [];

    for (let index = 0; index < targets.length; index += 1) {
        const imagePath = targets[index];

        if (showProgress && typeof uni.showLoading === 'function' && targets.length > 1 && !isBrowserEnv()) {
            uni.showLoading({
                title: `保存中 ${index + 1}/${targets.length}`,
                mask: true
            });
        }

        try {
            const extensionMatch = imagePath.match(/\.([a-zA-Z0-9]+)(?:$|\?)/);
            const extension = extensionMatch ? extensionMatch[1] : 'png';
            const fileName = `${fileNamePrefix}_${index + 1}.${extension}`;
            const result = await saveSingleImage(imagePath, fileName);
            results.push({
                index,
                imagePath,
                success: true,
                result
            });
        } catch (error) {
            results.push({
                index,
                imagePath,
                success: false,
                error
            });

            if (isPermissionError(error)) {
                break;
            }
        }
    }

    if (typeof uni.hideLoading === 'function') {
        uni.hideLoading();
    }

    const successCount = results.filter((item) => item.success).length;
    const failureCount = targets.length - successCount;
    const summary = {
        successCount,
        failureCount,
        totalCount: targets.length,
        results
    };

    if (showResultToast) {
        if (successCount > 0 && failureCount === 0) {
            uni.showToast({
                title: targets.length > 1 ? `已保存 ${successCount} 张` : '已保存到相册',
                icon: 'success'
            });
        } else if (successCount > 0) {
            uni.showToast({
                title: `已保存 ${successCount}/${targets.length} 张`,
                icon: 'none'
            });
        }
    }

    if (successCount === 0) {
        const firstError = (results[0] && results[0].error) || new Error('保存失败');
        throw firstError;
    }

    return summary;
}

module.exports = {
    generateShareImageName,
    isValidImageDataUrl,
    base64ToArrayBuffer,
    saveImageToAlbum,
    saveImagesToAlbum,
    createTempFilePath,
    compressImage,
    getImageInfo,
    isLocalImagePath
};
