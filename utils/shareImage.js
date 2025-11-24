/**
 * 分享图片生成和处理工具函数
 */

/**
 * 生成分享图片的文件名
 * @param {string} postId - 帖子ID
 * @param {string} userId - 用户ID
 * @returns {string} 分享图片文件名
 */
function generateShareImageName(postId, userId) {
    const timestamp = Date.now();
    return `share_${postId}_${userId}_${timestamp}.jpg`;
}

/**
 * 验证图片数据URL是否有效
 * @param {string} dataUrl - 图片数据URL
 * @returns {boolean} 是否有效
 */
function isValidImageDataUrl(dataUrl) {
    if (!dataUrl || typeof dataUrl !== 'string') {
        return false;
    }

    // 检查数据URL格式
    const dataUrlRegex = /^data:image\/(jpeg|jpg|png);base64,([A-Za-z0-9+/=]+)$/;
    return dataUrlRegex.test(dataUrl);
}

/**
 * 将base64数据转换为ArrayBuffer
 * @param {string} base64Data - base64数据
 * @returns {ArrayBuffer} ArrayBuffer数据
 */
function base64ToArrayBuffer(base64Data) {
    // 移除data:image/...;base64,前缀
    const base64 = base64Data.replace(/^data:image\/[a-z]+;base64,/, '');

    // 解码base64
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);

    for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }

    return bytes.buffer;
}

/**
 * 保存图片到相册
 * @param {string} imagePath - 图片路径
 * @returns {Promise} 保存结果
 */
function saveImageToAlbum(imagePath) {
    return new Promise((resolve, reject) => {
        if (!imagePath) {
            reject(new Error('图片路径为空'));
            return;
        }

        uni.saveImageToPhotosAlbum({
            filePath: imagePath,
            success: (res) => {
                resolve(res);
            },
            fail: (err) => {
                console.error('保存图片到相册失败:', err);

                // 如果用户拒绝授权，提示用户打开权限
                if (err.errMsg.includes('auth deny') || err.errMsg.includes('auth denied')) {
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
                                            // 用户已授权，重新保存
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
                } else {
                    reject(err);
                }
            }
        });
    });
}

/**
 * 创建临时文件路径
 * @param {string} fileName - 文件名
 * @returns {string} 临时文件路径
 */
function createTempFilePath(fileName) {
    const timestamp = Date.now();
    const randomSuffix = Math.random().toString(36).substring(2, 8);
    const tempFileName = fileName || `share_${timestamp}_${randomSuffix}.jpg`;

    return `${uni.env.USER_DATA_PATH}/${tempFileName}`;
}

/**
 * 压缩图片
 * @param {string} imagePath - 原图片路径
 * @param {number} quality - 压缩质量 (0-100)
 * @param {number} maxWidth - 最大宽度
 * @param {number} maxHeight - 最大高度
 * @returns {Promise} 压缩后的图片路径
 */
function compressImage(imagePath, quality = 80, maxWidth = 1080, maxHeight = 1920) {
    return new Promise((resolve, reject) => {
        if (!imagePath) {
            reject(new Error('图片路径为空'));
            return;
        }

        uni.compressImage({
            src: imagePath,
            quality: quality,
            success: (res) => {
                resolve(res.tempFilePath);
            },
            fail: (err) => {
                console.error('压缩图片失败:', err);
                // 压缩失败则返回原图路径
                resolve(imagePath);
            }
        });
    });
}

/**
 * 获取图片信息
 * @param {string} imagePath - 图片路径
 * @returns {Promise} 图片信息
 */
function getImageInfo(imagePath) {
    return new Promise((resolve, reject) => {
        if (!imagePath) {
            reject(new Error('图片路径为空'));
            return;
        }

        uni.getImageInfo({
            src: imagePath,
            success: (res) => {
                resolve(res);
            },
            fail: (err) => {
                console.error('获取图片信息失败:', err);
                reject(err);
            }
        });
    });
}

module.exports = {
    generateShareImageName,
    isValidImageDataUrl,
    base64ToArrayBuffer,
    saveImageToAlbum,
    createTempFilePath,
    compressImage,
    getImageInfo
};