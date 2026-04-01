const { getSystemInfoCompat } = require('./system-info.js');

function compressAvatar(filePath) {
    return new Promise((resolve, reject) => {
        console.log('start avatar compress, source:', filePath);

        const timeout = setTimeout(() => {
            console.warn('avatar compress timeout, returning original file');
            resolve(filePath);
        }, 10000);

        try {
            const { system } = getSystemInfoCompat();
            const isIOS = /(ios)/gi.test(String(system || ''));

            const avatarConfig = {
                maxWidth: 200,
                maxHeight: 200,
                quality: isIOS ? 0.5 : 0.4,
                maxSize: 102400
            };

            console.log('avatar compress config:', avatarConfig);

            if (typeof uni.compressImage === 'function') {
                console.log('using uni.compressImage for avatar compression');
                uni.compressImage({
                    src: filePath,
                    quality: avatarConfig.quality,
                    success: (compressRes) => {
                        clearTimeout(timeout);
                        console.log('direct avatar compression success:', compressRes.tempFilePath);

                        uni.getFileInfo({
                            filePath: compressRes.tempFilePath,
                            success: (fileInfo) => {
                                console.log('compressed avatar size KB:', (fileInfo.size / 1024).toFixed(2));

                                uni.getImageInfo({
                                    src: compressRes.tempFilePath,
                                    success: (imageInfo) => {
                                        console.log('compressed avatar dimensions:', {
                                            width: imageInfo.width,
                                            height: imageInfo.height
                                        });

                                        if (imageInfo.width > avatarConfig.maxWidth || imageInfo.height > avatarConfig.maxHeight) {
                                            console.log('avatar still too large, fallback to canvas compress');
                                            compressWithCanvas(filePath, avatarConfig, timeout, resolve, reject);
                                        } else {
                                            resolve(compressRes.tempFilePath);
                                        }
                                    },
                                    fail: () => {
                                        resolve(compressRes.tempFilePath);
                                    }
                                });
                            },
                            fail: () => {
                                resolve(compressRes.tempFilePath);
                            }
                        });
                    },
                    fail: (err) => {
                        console.error('direct avatar compression failed, fallback to canvas:', err);
                        compressWithCanvas(filePath, avatarConfig, timeout, resolve, reject);
                    }
                });
            } else {
                console.log('uni.compressImage unavailable, fallback to canvas');
                compressWithCanvas(filePath, avatarConfig, timeout, resolve, reject);
            }
        } catch (err) {
            clearTimeout(timeout);
            console.error('get system info failed, returning original avatar:', err);
            resolve(filePath);
        }
    });
}

function compressWithCanvas(filePath, avatarConfig, timeout, resolve, reject) {
    uni.getImageInfo({
        src: filePath,
        success: (imageInfo) => {
            console.log('canvas avatar source info:', {
                width: imageInfo.width,
                height: imageInfo.height
            });

            let { width, height } = imageInfo;
            const { maxWidth, maxHeight } = avatarConfig;

            if (width > maxWidth || height > maxHeight) {
                const ratio = Math.min(maxWidth / width, maxHeight / height);
                width = Math.floor(width * ratio);
                height = Math.floor(height * ratio);
            }

            console.log('canvas avatar target size:', { width, height });

            const query = uni.createSelectorQuery();
            query.select('#avatarCompressCanvas').fields({
                node: true,
                size: true
            }).exec((res) => {
                if (res && res[0] && res[0].node) {
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
                            const tempFilePath = dataUrl;
                            console.log('canvas avatar compression complete:', tempFilePath);
                            resolve(tempFilePath);
                        });
                    };

                    img.onerror = () => {
                        console.error('canvas avatar image load failed');
                        clearTimeout(timeout);
                        resolve(filePath);
                    };

                    img.src = filePath;
                } else {
                    compressWithOldCanvas(filePath, avatarConfig, timeout, resolve, reject);
                }
            });
        },
        fail: (err) => {
            console.error('canvas avatar getImageInfo failed:', err);
            clearTimeout(timeout);
            resolve(filePath);
        }
    });
}

function compressWithOldCanvas(filePath, avatarConfig, timeout, resolve, reject) {
    const canvas = uni.createCanvasContext('avatarCompressCanvas');

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

            setTimeout(() => {
                canvas.draw(false, () => {
                    setTimeout(() => {
                        uni.canvasToTempFilePath({
                            canvasId: 'avatarCompressCanvas',
                            x: 0,
                            y: 0,
                            width,
                            height,
                            destWidth: width,
                            destHeight: height,
                            fileType: 'jpg',
                            quality: avatarConfig.quality,
                            success: (canvasRes) => {
                                clearTimeout(timeout);
                                console.log('legacy canvas avatar compression complete:', canvasRes.tempFilePath);
                                resolve(canvasRes.tempFilePath);
                            },
                            fail: (err) => {
                                console.error('legacy canvas avatar compression failed:', err);
                                clearTimeout(timeout);
                                resolve(filePath);
                            }
                        });
                    }, 500);
                });
            }, 100);
        },
        fail: () => {
            clearTimeout(timeout);
            resolve(filePath);
        }
    });
}

function createAvatarCompressCanvas() {
    // The page needs to provide a hidden canvas with canvas-id="avatarCompressCanvas".
}

module.exports = {
    compressAvatar,
    compressWithCanvas,
    compressWithOldCanvas,
    createAvatarCompressCanvas
};
