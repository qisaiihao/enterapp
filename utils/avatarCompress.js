// avatarCompress.js - 专门用于头像压缩的工具函数
/**
 * 头像压缩函数 - 简化压缩策略，避免卡顿
 * @param {string} filePath 原始图片路径
 * @returns {Promise<string>} 返回压缩后的图片路径
 */
function compressAvatar(filePath) {
    return new Promise((resolve, reject) => {
        console.log('开始压缩头像，原始路径:', filePath);

        // 设置超时保护，避免卡顿
        const timeout = setTimeout(() => {
            console.warn('压缩超时，直接返回原图');
            resolve(filePath);
        }, 10000); // 10秒超时

        // 获取系统信息
        uni.getSystemInfo({
            success: (res) => {
                const { system } = res;
                const isIOS = /(ios)/gi.test(system);

                // 头像压缩参数
                const avatarConfig = {
                    maxWidth: 200,
                    maxHeight: 200,
                    quality: isIOS ? 0.5 : 0.4, // 提高质量，减少压缩卡顿风险
                    maxSize: 102400 // 100KB限制，避免过度压缩
                };

                console.log('压缩配置:', avatarConfig);

                // 检查compressImage API是否可用
                if (typeof uni.compressImage === 'function') {
                    console.log('使用uni.compressImage进行压缩');
                    uni.compressImage({
                        src: filePath,
                        quality: avatarConfig.quality,
                        success: (compressRes) => {
                        clearTimeout(timeout);
                        console.log('直接压缩成功:', compressRes.tempFilePath);

                        // 检查压缩后的文件大小
                        uni.getFileInfo({
                            filePath: compressRes.tempFilePath,
                            success: (fileInfo) => {
                                console.log('压缩后文件大小:', (fileInfo.size / 1024).toFixed(2), 'KB');

                                // 获取图片信息检查尺寸
                                uni.getImageInfo({
                                    src: compressRes.tempFilePath,
                                    success: (imageInfo) => {
                                        console.log('压缩后图片尺寸:', {
                                            width: imageInfo.width,
                                            height: imageInfo.height
                                        });

                                        // 如果尺寸过大，才使用canvas压缩
                                        if (imageInfo.width > avatarConfig.maxWidth || imageInfo.height > avatarConfig.maxHeight) {
                                            console.log('尺寸仍然过大，使用canvas进一步压缩');
                                            compressWithCanvas(filePath, avatarConfig, timeout, resolve, reject);
                                        } else {
                                            resolve(compressRes.tempFilePath);
                                        }
                                    },
                                    fail: () => {
                                        // 获取信息失败，直接返回压缩结果
                                        resolve(compressRes.tempFilePath);
                                    }
                                });
                            },
                            fail: () => {
                                // 获取文件信息失败，直接返回压缩结果
                                resolve(compressRes.tempFilePath);
                            }
                        });
                    },
                        fail: (err) => {
                            console.error('直接压缩失败，尝试canvas压缩:', err);
                            // 直接压缩失败，尝试canvas压缩
                            compressWithCanvas(filePath, avatarConfig, timeout, resolve, reject);
                        }
                    });
                } else {
                    console.log('uni.compressImage不可用，直接使用canvas压缩');
                    // compressImage不可用，直接使用canvas压缩
                    compressWithCanvas(filePath, avatarConfig, timeout, resolve, reject);
                }
            },
            fail: (err) => {
                clearTimeout(timeout);
                console.error('获取系统信息失败，返回原图:', err);
                resolve(filePath);
            }
        });
    });
}

/**
 * 使用Canvas进行压缩
 * @param {string} filePath 图片路径
 * @param {object} avatarConfig 压缩配置
 * @param {number} timeout 超时定时器
 * @param {function} resolve Promise resolve
 * @param {function} reject Promise reject
 */
function compressWithCanvas(filePath, avatarConfig, timeout, resolve, reject) {
    // 先获取图片信息
    uni.getImageInfo({
        src: filePath,
        success: (imageInfo) => {
            console.log('Canvas压缩 - 原始图片信息:', {
                width: imageInfo.width,
                height: imageInfo.height
            });

            // 计算压缩后的尺寸
            let { width, height } = imageInfo;
            const { maxWidth, maxHeight } = avatarConfig;

            // 按比例缩放
            if (width > maxWidth || height > maxHeight) {
                const ratio = Math.min(maxWidth / width, maxHeight / height);
                width = Math.floor(width * ratio);
                height = Math.floor(height * ratio);
            }

            console.log('Canvas压缩 - 目标尺寸:', { width, height });

            // 使用新版Canvas API
            const query = uni.createSelectorQuery();
            query.select('#avatarCompressCanvas').fields({
                node: true,
                size: true
            }).exec((res) => {
                if (res && res[0] && res[0].node) {
                    // 新版Canvas API
                    const canvas = res[0].node;
                    const ctx = canvas.getContext('2d');

                    canvas.width = width;
                    canvas.height = height;

                    const img = canvas.createImage();
                    img.onload = () => {
                        ctx.clearRect(0, 0, width, height);
                        ctx.drawImage(img, 0, 0, width, height);

                        canvas.toDataURL('image/jpeg', avatarConfig.quality, (dataUrl) => {
                            clearTimeout(timeout);
                            // 将dataUrl转换为临时文件路径
                            const tempFilePath = dataUrl; // 简化处理
                            console.log('Canvas压缩完成:', tempFilePath);
                            resolve(tempFilePath);
                        });
                    };

                    img.onerror = () => {
                        console.error('Canvas图片加载失败');
                        clearTimeout(timeout);
                        resolve(filePath);
                    };

                    img.src = filePath;
                } else {
                    // 降级到旧版API
                    compressWithOldCanvas(filePath, avatarConfig, timeout, resolve, reject);
                }
            });
        },
        fail: (err) => {
            console.error('Canvas压缩 - 获取图片信息失败:', err);
            clearTimeout(timeout);
            resolve(filePath);
        }
    });
}

/**
 * 使用旧版Canvas API压缩
 */
function compressWithOldCanvas(filePath, avatarConfig, timeout, resolve, reject) {
    const canvas = uni.createCanvasContext('avatarCompressCanvas');

    // 获取图片信息后绘制
    uni.getImageInfo({
        src: filePath,
        success: (imageInfo) => {
            let { width, height } = imageInfo;
            const { maxWidth, maxHeight } = avatarConfig;

            if (width > maxWidth || height > maxHeight) {
                const ratio = Math.min(maxWidth / width, maxHeight / height);
                width = Math.floor(width * ratio);
                height = Math.floor(height * ratio);
            }

            canvas.drawImage(filePath, 0, 0, width, height);

            // 设置延迟确保绘制完成
            setTimeout(() => {
                canvas.draw(false, () => {
                    setTimeout(() => {
                        uni.canvasToTempFilePath({
                            canvasId: 'avatarCompressCanvas',
                            x: 0,
                            y: 0,
                            width: width,
                            height: height,
                            destWidth: width,
                            destHeight: height,
                            fileType: 'jpg',
                            quality: avatarConfig.quality,
                            success: (canvasRes) => {
                                clearTimeout(timeout);
                                console.log('旧版Canvas压缩完成:', canvasRes.tempFilePath);
                                resolve(canvasRes.tempFilePath);
                            },
                            fail: (err) => {
                                console.error('旧版Canvas压缩失败:', err);
                                clearTimeout(timeout);
                                resolve(filePath);
                            }
                        });
                    }, 500); // 增加延迟确保绘制完成
                });
            }, 100);
        },
        fail: () => {
            clearTimeout(timeout);
            resolve(filePath);
        }
    });
}

/**
 * 创建隐藏的canvas用于头像压缩
 * 这个函数需要在页面中调用，创建隐藏的canvas元素
 */
function createAvatarCompressCanvas() {
    // 这个函数需要在页面的wxml中添加隐藏的canvas
    // <canvas canvas-id="avatarCompressCanvas" style="position: fixed; top: -9999px; left: -9999px; width: 200px; height: 200px;"></canvas>
}

module.exports = {
    compressAvatar,
    compressWithCanvas,
    compressWithOldCanvas,
    createAvatarCompressCanvas
};
