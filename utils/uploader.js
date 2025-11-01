// utils/uploader.js
// 通用文件上传工具模块
// 提取自 profile-edit.vue，支持多端兼容（H5、App、小程序）和自动回退机制

const { cloudCall } = require('./cloudCall.js');
const { getCloudFunctionMethod, getCurrentPlatform } = require('./platformDetector.js');

/**
 * 通过云函数中转上传文件（作为备用方案）
 * @param {string} cloudPath - 云存储路径
 * @param {string} filePath - 本地文件临时路径
 * @param {number} [retryCount=0] - 当前重试次数
 * @returns {Promise<string>} - 返回文件FileID
 */
function uploadFileViaCloudFunction(cloudPath, filePath, retryCount = 0) {
    return new Promise((resolve, reject) => {
        const platform = getCurrentPlatform();

        const performUpload = (base64) => {
            cloudCall("upload", { cloudPath, fileContent: base64 }, { pageTag: 'uploader', requireAuth: false })
                .then((uploadRes) => {
                    if (uploadRes && uploadRes.result && uploadRes.result.success) {
                        resolve(uploadRes.result.fileID);
                    } else {
                        reject(new Error("云函数返回异常"));
                    }
                })
                .catch((err) => {
                    // 简单的重试机制
                    if (retryCount < 2) {
                        setTimeout(() => {
                            uploadFileViaCloudFunction(cloudPath, filePath, retryCount + 1)
                                .then(resolve).catch(reject);
                        }, 1000 * (retryCount + 1));
                    } else {
                        reject(err);
                    }
                });
        };

        if (platform === 'h5') {
            // H5环境：使用fetch获取blob，然后转换为base64
            console.log('🔍 [Uploader] H5环境使用fetch读取文件');
            fetch(filePath)
                .then(response => {
                    if (!response.ok) throw new Error("HTTP " + response.status);
                    return response.blob();
                })
                .then(blob => {
                    const reader = new FileReader();
                    reader.onload = () => {
                        const result = reader.result;
                        if (!result || typeof result !== "string") {
                            reject(new Error("文件读取失败"));
                            return;
                        }
                        const base64 = result.split(",")[1];
                        console.log(`🔍 [Uploader] H5环境文件读取完成，base64长度: ${base64.length}`);
                        performUpload(base64);
                    };
                    reader.onerror = () => reject(new Error("文件读取失败"));
                    reader.readAsDataURL(blob);
                })
                .catch(err => reject(err));

        } else if (platform === 'app') {
            // App环境使用 plus.io 读取为 base64
            console.log('🔍 [Uploader] App环境使用plus.io读取文件');
            if (typeof plus === 'undefined' || !plus.io) {
                reject(new Error('App端运行环境不可用'));
                return;
            }
            plus.io.resolveLocalFileSystemURL(filePath, (entry) => {
                entry.file((file) => {
                    const reader = new plus.io.FileReader();
                    reader.onload = (e) => {
                        try {
                            const dataUrl = e.target.result || '';
                            const base64 = dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl;
                            if (!base64) {
                                reject(new Error('文件读取失败或为空'));
                                return;
                            }
                            performUpload(base64);
                        } catch (ex) {
                            reject(new Error('读取转换失败: ' + ex.message));
                        }
                    };
                    reader.onerror = (err) => reject(new Error('文件读取失败: ' + (err && err.message || 'unknown')));
                    reader.readAsDataURL(file);
                }, (e) => reject(new Error('获取文件对象失败: ' + (e && e.message || 'unknown'))));
            }, (e) => reject(new Error('路径解析失败: ' + (e && e.message || 'unknown'))));

        } else {
            // 小程序等其他平台：使用 uni.getFileSystemManager
            console.log('🔍 [Uploader] 小程序环境使用uni.getFileSystemManager读取文件');
            const fs = uni.getFileSystemManager();
            if (!fs || !fs.readFile) {
                reject(new Error('文件系统管理器不可用'));
                return;
            }
            fs.readFile({
                filePath: filePath,
                encoding: 'base64',
                success: (readRes) => {
                    const base64 = readRes.data;
                    console.log(`🔍 [Uploader] 小程序环境文件读取完成，base64长度: ${base64.length}`);
                    performUpload(base64);
                },
                fail: (readErr) => {
                    console.error('❌ [Uploader] 小程序环境文件读取失败:', readErr);
                    reject(new Error('文件读取失败: ' + readErr.errMsg));
                }
            });
        }
    });
}

/**
 * 通用文件上传函数（主入口）
 * 优先尝试客户端直传，失败后自动回退到通过云函数中转。
 * @param {string} cloudPath - 云存储路径
 * @param {string} filePath - 本地文件临时路径
 * @returns {Promise<string>} - 返回文件FileID
 */
async function uploadFile(cloudPath, filePath) {
    const method = getCloudFunctionMethod();

    if (method === 'tcb') {
        const app = getApp();
        if (!(app && app.$tcb && typeof app.$tcb.uploadFile === 'function')) {
            console.warn('[Uploader] TCB实例不可用，回退到云函数上传');
            return await uploadFileViaCloudFunction(cloudPath, filePath);
        }
        let file = filePath;
        try {
            // H5/App环境，尝试将路径转为Blob对象直传，性能更优
            if (typeof filePath === "string" && typeof fetch === "function" && typeof Blob !== "undefined") {
                const resp = await fetch(filePath);
                file = await resp.blob();
            } else if (filePath && filePath.tempFilePath && typeof fetch === "function") {
                const resp = await fetch(filePath.tempFilePath);
                file = await resp.blob();
            }
        } catch (e) {
            console.warn('[Uploader] toBlob失败，改走云函数上传', e);
            return await uploadFileViaCloudFunction(cloudPath, filePath);
        }
        try {
            const res = await app.$tcb.uploadFile({ cloudPath, file });
            const fileID = (res && (res.fileID || res.fileId)) || (res && res.data && res.data.fileID);
            if (!fileID) {
                throw new Error('TCB直传成功但未返回fileID');
            }
            return fileID;
        } catch (e) {
            console.warn(`[Uploader] TCB直传失败 (${e.message})，回退到云函数上传...`);
            return await uploadFileViaCloudFunction(cloudPath, filePath);
        }

    } else if (method === "wx-cloud") {
        try {
            const res = await wx.cloud.uploadFile({ cloudPath, filePath });
            const fileID = res && res.fileID;
            if (!fileID) {
                throw new Error('小程序上传成功但未返回fileID');
            }
            return fileID;
        } catch (e) {
            console.warn(`[Uploader] 小程序直传失败 (${e.message})，回退到云函数上传...`);
            return await uploadFileViaCloudFunction(cloudPath, filePath);
        }
    }

    // 如果平台检测不到，直接使用云函数中转作为默认方案
    console.log('[Uploader] 未知上传环境，默认使用云函数上传');
    return await uploadFileViaCloudFunction(cloudPath, filePath);
}

module.exports = {
    uploadFile
};

