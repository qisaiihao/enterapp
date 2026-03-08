// pages/add/useImages.js
// 图片选择、压缩、上传相关逻辑，保持与原 add.vue 行为一致
import { readFileAsBase64 } from '@/utils/fileReader.js';
import { getCurrentPlatform, getCloudFunctionMethod } from '@/utils/platformDetector.js';
import { uploadFile as uploadFileApi } from '@/api-cache/publish.js';

export function handleChooseImage(ctx) {
    const remainingCount = ctx.maxImageCount - ctx.imageList.length;
    if (remainingCount <= 0) {
        uni.showToast({ title: '最多只能上传9张图片', icon: 'none' });
        return;
    }

    // 设置临时隐藏标志，避免触发草稿保存
    ctx.setData({ isTemporaryHide: true });

    uni.chooseImage({
        count: remainingCount,
        sizeType: ['compressed'],
        sourceType: ['album', 'camera'],
        success: (res) => {
            uni.showLoading({ title: '处理中...' });

            const imagePromises = res.tempFiles.map((file) => {
                const tempFilePath = file.path;
                const sizeInBytes = file.size;
                const imageInfo = {
                    originalPath: tempFilePath,
                    imageSize: sizeInBytes,
                    needCompression: true,
                    previewUrl: tempFilePath,
                    compressedPath: tempFilePath,
                    originalCompressedPath: tempFilePath,
                    originalUrl: '',
                    compressedUrl: ''
                };
                return compressImage(ctx, imageInfo);
            });

            Promise.all(imagePromises)
                .then((newImages) => {
                    uni.hideLoading();
                    ctx.updateImageList(newImages);
                    ctx.checkCanPublish && ctx.checkCanPublish();
                })
                .catch((err) => {
                    uni.hideLoading();
                    console.error('图片处理失败:', err);
                    let errorMessage = '图片处理失败';
                    if (err.message && err.message.includes('图片文件过大')) {
                        errorMessage = err.message;
                    } else if (err.message) {
                        errorMessage = `图片处理失败: ${err.message}`;
                    }
                    uni.showModal({
                        title: '错误',
                        content: errorMessage,
                        showCancel: false,
                        confirmText: '确定'
                    });
                });
        },
        fail: (err) => {
            console.log('选择图片取消或失败:', err);
            ctx.setData({ isTemporaryHide: false });
        }
    });
}

export function compressImage(ctx, imageInfo) {
    return new Promise((resolve) => {
        const platform = getCurrentPlatform();

        if (platform === 'h5') {
            console.log('🔍 [Add页面] H5环境使用Canvas双重压缩图片');
            compressImageWithCanvasDual(imageInfo)
                .then(resolve)
                .catch(() => {
                    console.log('Canvas压缩失败，使用原图');
                    imageInfo.compressedPath = imageInfo.originalPath;
                    imageInfo.originalCompressedPath = imageInfo.originalPath;
                    imageInfo.previewUrl = imageInfo.originalPath;
                    resolve(imageInfo);
                });
        } else {
            console.log('🔍 [Add页面] 小程序/App环境双重压缩');
            // 第一步：80%质量压缩作为"原图"
            uni.compressImage({
                src: imageInfo.originalPath,
                quality: 80,
                success: (originalRes) => {
                    imageInfo.originalCompressedPath = originalRes.tempFilePath;
                    console.log('✅ 原图压缩完成(80%):', originalRes.tempFilePath);

                    // 第二步：50%质量压缩作为"压缩图"
                    uni.compressImage({
                        src: imageInfo.originalPath,
                        quality: 50,
                        success: (compressRes) => {
                            imageInfo.compressedPath = compressRes.tempFilePath;
                            imageInfo.previewUrl = compressRes.tempFilePath;
                            console.log('✅ 压缩图完成(50%):', compressRes.tempFilePath);
                            resolve(imageInfo);
                        },
                        fail: (err) => {
                            console.log('压缩图压缩失败，使用原图压缩版:', err);
                            imageInfo.compressedPath = imageInfo.originalCompressedPath;
                            imageInfo.previewUrl = imageInfo.originalCompressedPath;
                            resolve(imageInfo);
                        }
                    });
                },
                fail: (err) => {
                    console.log('原图压缩失败，使用原始文件:', err);
                    imageInfo.originalCompressedPath = imageInfo.originalPath;
                    imageInfo.compressedPath = imageInfo.originalPath;
                    imageInfo.previewUrl = imageInfo.originalPath;
                    resolve(imageInfo);
                }
            });
        }
    });
}

export function compressImageWithCanvasDual(imageInfo) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';

        img.onload = () => {
            try {
                const canvas = document.createElement('canvas');
                const ctx2d = canvas.getContext('2d');

                const maxWidth = 1200;
                const maxHeight = 1200;
                let { width, height } = img;

                if (width > height) {
                    if (width > maxWidth) {
                        height = (height * maxWidth) / width;
                        width = maxWidth;
                    }
                } else {
                    if (height > maxHeight) {
                        width = (width * maxHeight) / height;
                        height = maxHeight;
                    }
                }

                canvas.width = width;
                canvas.height = height;
                ctx2d.drawImage(img, 0, 0, width, height);

                canvas.toBlob((originalBlob) => {
                    if (originalBlob) {
                        const originalUrl = URL.createObjectURL(originalBlob);
                        imageInfo.originalCompressedPath = originalUrl;
                        console.log('✅ [Add页面] H5原图压缩完成(80%)');

                        canvas.toBlob((compressedBlob) => {
                            if (compressedBlob) {
                                const compressedUrl = URL.createObjectURL(compressedBlob);
                                imageInfo.compressedPath = compressedUrl;
                                imageInfo.previewUrl = compressedUrl;
                                console.log('✅ [Add页面] H5压缩图完成(50%)');
                                resolve(imageInfo);
                            } else {
                                imageInfo.compressedPath = originalUrl;
                                imageInfo.previewUrl = originalUrl;
                                resolve(imageInfo);
                            }
                        }, 'image/jpeg', 0.5);
                    } else {
                        reject(new Error('Canvas压缩失败'));
                    }
                }, 'image/jpeg', 0.8);
            } catch (error) {
                console.error('Canvas压缩过程出错:', error);
                reject(error);
            }
        };

        img.onerror = () => reject(new Error('图片加载失败'));
        img.src = imageInfo.originalPath;
    });
}

export function uploadFile(ctx, cloudPath, filePath) {
    return new Promise((resolve, reject) => {
        const method = getCloudFunctionMethod();
        if (method === 'tcb') {
            uploadFileViaCloudFunction(ctx, cloudPath, filePath).then(resolve).catch(reject);
        } else if (method === 'wx-cloud') {
            if (wx.cloud && wx.cloud.uploadFile) {
                wx.cloud.uploadFile({
                    cloudPath: cloudPath,
                    filePath: filePath,
                    success: (res) => resolve(res),
                    fail: (err) => reject(err)
                });
            } else {
                reject(new Error('微信云开发不可用'));
            }
        } else {
            reject(new Error(`不支持的云函数调用方式: ${method}`));
        }
    });
}

export function uploadFileViaCloudFunction(ctx, cloudPath, filePath, retryCount = 0) {
    return readFileAsBase64(filePath)
        .then((base64) => {
            if (!base64) {
                throw new Error('文件读取失败');
            }
            console.log(`🔍 [Add页面] 文件读取完成，base64长度: ${base64.length}`);
            if (base64.length > 6 * 1024 * 1024) {
                console.warn('🔍 [Add页面] base64文件较大，注意上传耗时');
            }
            return uploadFileApi(cloudPath, base64, {
                context: ctx,
                pageTag: 'add'
            });
        })
        .then((uploadRes) => {
            if (uploadRes && uploadRes.fileID) {
                return {
                    fileID: uploadRes.fileID,
                    cloudPath: uploadRes.cloudPath
                };
            }
            throw new Error('上传云函数返回格式异常');
        })
        .catch((err) => {
            const message = (err && err.errMsg) || (err && err.message) || '';
            const shouldRetry = retryCount < 2 && (message.includes('request:fail') || message.includes('timeout'));
            if (shouldRetry) {
                console.log(`🔍 [Add页面] 上传失败，准备重试 (${retryCount + 1}/2)`, err);
                return new Promise((resolve, reject) => {
                    setTimeout(() => {
                        uploadFileViaCloudFunction(ctx, cloudPath, filePath, retryCount + 1)
                            .then(resolve)
                            .catch(reject);
                    }, 1000 * (retryCount + 1));
                });
            }
            throw err;
        });
}

export function uploadImagesAndSubmit(ctx) {
    const timestamp = new Date().getTime();
    const imageList = ctx.imageList;
    console.log('开始上传图片:', imageList.length + '张');
    const uploadPromises = imageList.map((imageInfo, index) => {
        return new Promise((resolve, reject) => {
            // 编辑模式且图片来自编辑，不重新上传
            if (ctx.isEditMode && imageInfo.isFromEdit) {
                resolve({
                    compressedUrl: imageInfo.originalFileID || imageInfo.compressedPath,
                    originalUrl: imageInfo.originalOriginalFileID || imageInfo.originalPath
                });
                return;
            }

            const imageTimestamp = timestamp + index;
            const compressedCloudPath = `post_images/${imageTimestamp}_compressed.jpg`;

            uploadFile(ctx, compressedCloudPath, imageInfo.compressedPath)
                .then((compressedRes) => {
                    const compressedFileID = compressedRes.fileID;
                    const originalCloudPath = `post_images/${imageTimestamp}_original.jpg`;
                    const originalPath = imageInfo.originalCompressedPath || imageInfo.originalPath;
                    return uploadFile(ctx, originalCloudPath, originalPath)
                        .then((originalRes) => {
                            resolve({
                                compressedUrl: compressedFileID,
                                originalUrl: originalRes.fileID
                            });
                        })
                        .catch((err) => {
                            console.log('原图上传失败，使用压缩图:', err);
                            resolve({
                                compressedUrl: compressedFileID,
                                originalUrl: compressedFileID
                            });
                        });
                })
                .catch(reject);
        });
    });

    return Promise.all(uploadPromises)
        .then((uploadResults) => {
            console.log('所有图片上传完成:', uploadResults);
            return ctx.submitWithContentCheck(uploadResults);
        })
        .catch((err) => {
            console.error('上传失败:', err);
            ctx.publishFail(err);
        });
}
