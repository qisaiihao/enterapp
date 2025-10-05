// 图片管理工具类
const cloudFunction = require('./cloudFunction');

class ImageManager {
    constructor() {
        this.cloudEnv = wx.cloud; // 云开发环境
    }

    // 兼容性云函数调用方法
    callCloudFunction(name, data = {}) {
        console.log(`🔍 [ImageManager] 调用云函数: ${name}`, data);
        
        return new Promise((resolve, reject) => {
            // 检查运行环境
            const isH5 = typeof window !== 'undefined';
            const isMiniProgram = typeof wx !== 'undefined';
            
            if (isH5) {
                // H5环境使用TCB
                if (typeof getApp !== 'undefined' && getApp().$tcb && getApp().$tcb.callFunction) {
                    console.log(`🔍 [ImageManager] H5环境使用TCB调用云函数: ${name}`);
                    getApp().$tcb.callFunction({
                        name: name,
                        data: data
                    }).then(resolve).catch(reject);
                } else {
                    console.error(`❌ [ImageManager] H5环境TCB不可用`);
                    reject(new Error('TCB实例不可用'));
                }
            } else if (isMiniProgram) {
                // 小程序环境使用微信云开发
                if (wx.cloud && wx.cloud.callFunction) {
                    console.log(`🔍 [ImageManager] 小程序环境使用微信云开发调用云函数: ${name}`);
                    wx.cloud.callFunction({
                        name: name,
                        data: data,
                        success: (res) => {
                            console.log(`✅ [ImageManager] 云函数调用成功: ${name}`, res);
                            resolve(res);
                        },
                        fail: (err) => {
                            console.error(`❌ [ImageManager] 云函数调用失败: ${name}`, err);
                            reject(err);
                        }
                    });
                } else {
                    console.error(`❌ [ImageManager] 小程序环境微信云开发不可用`);
                    reject(new Error('微信云开发不可用'));
                }
            } else {
                console.error(`❌ [ImageManager] 未知运行环境`);
                reject(new Error('未知运行环境'));
            }
        });
    }

    /**
     * 上传图片到云端
     * @param {string} filePath - 本地图片路径
     * @param {Object} options - 配置选项
     * @param {string} options.category - 图片分类（如：splash, avatar, post等）
     * @param {string} options.name - 图片名称
     * @param {Object} options.metadata - 额外元数据
     * @returns {Promise<Object>} 上传结果
     */
    async uploadImage(filePath, options = {}) {
        try {
            // 读取文件内容
            const fileSystem = uni.getFileSystemManager();
            const fileContent = fileSystem.readFileSync(filePath, 'base64');

            // 生成云端路径
            const timestamp = Date.now();
            const extension = filePath.split('.').pop() || 'png';
            const cloudPath = options.name ? `${options.name}_${timestamp}.${extension}` : `image_${timestamp}.${extension}`;

            // 调用云函数上传
            console.log('准备调用云函数上传，参数:', {
                action: 'uploadImage',
                cloudPath: cloudPath,
                category: options.category || 'general',
                fileContentLength: fileContent.length
            });
            const result = await this.callCloudFunction('imageManager', {
                action: 'uploadImage',
                fileContent: fileContent,
                cloudPath: cloudPath,
                category: options.category || 'general',
                metadata: {
                    name: options.name || '',
                    originalPath: filePath,
                    ...options.metadata
                }
            });
            console.log('云函数返回结果:', result);
            if (result.result.success) {
                return {
                    success: true,
                    fileID: result.result.fileID,
                    imageId: result.result.imageId,
                    url: result.result.url
                };
            } else {
                throw new Error(result.result.error || '上传失败');
            }
        } catch (error) {
            console.log('CatchClause', error);
            console.log('CatchClause', error);
            console.error('图片上传失败:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * 获取图片临时访问URL
     * @param {Object} options - 配置选项
     * @param {string} options.imageId - 图片数据库ID
     * @param {string} options.fileID - 云存储文件ID
     * @param {string} options.category - 图片分类
     * @param {string} options.name - 图片名称
     * @returns {Promise<Object>} 获取结果
     */
    async getImageUrl(options = {}) {
        try {
            const result = await this.callCloudFunction('imageManager', {
                action: 'getImageUrl',
                ...options
            });
            if (result.result.success) {
                return {
                    success: true,
                    url: result.result.url,
                    fileID: result.result.fileID,
                    expireTime: result.result.expireTime
                };
            } else {
                throw new Error(result.result.error || '获取URL失败');
            }
        } catch (error) {
            console.log('CatchClause', error);
            console.log('CatchClause', error);
            console.error('获取图片URL失败:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * 获取开屏图URL
     * @returns {Promise<string>} 开屏图URL
     */
    async getSplashImageUrl() {
        const result = await this.getImageUrl({
            category: 'splash',
            name: 'splash'
        });
        if (result.success) {
            return result.url;
        } else {
            // 如果云端没有，返回默认本地图片
            return '/static/images/splash.png';
        }
    }

    /**
     * 上传开屏图
     * @param {string} filePath - 本地图片路径
     * @returns {Promise<Object>} 上传结果
     */
    async uploadSplashImage(filePath) {
        return await this.uploadImage(filePath, {
            category: 'splash',
            name: 'splash',
            metadata: {
                description: '开屏图',
                usage: 'splash_screen'
            }
        });
    }

    /**
     * 批量预加载图片
     * @param {Array<string>} imageUrls - 图片URL数组
     * @returns {Promise<Array>} 预加载结果
     */
    async preloadImages(imageUrls) {
        const preloadPromises = imageUrls.map((url) => {
            return new Promise((resolve) => {
                uni.downloadFile({
                    url: url,
                    success: (res) => {
                        if (res.statusCode === 200) {
                            resolve({
                                success: true,
                                tempFilePath: res.tempFilePath,
                                url: url
                            });
                        } else {
                            resolve({
                                success: false,
                                error: '下载失败',
                                url: url
                            });
                        }
                    },
                    fail: (error) => {
                        resolve({
                            success: false,
                            error: error.errMsg,
                            url: url
                        });
                    }
                });
            });
        });
        return await Promise.all(preloadPromises);
    }

    /**
     * 删除图片
     * @param {Object} options - 配置选项
     * @param {string} options.imageId - 图片数据库ID
     * @param {string} options.fileID - 云存储文件ID
     * @returns {Promise<Object>} 删除结果
     */
    async deleteImage(options = {}) {
        try {
            const result = await this.callCloudFunction('imageManager', {
                action: 'deleteImage',
                ...options
            });
            return result.result;
        } catch (error) {
            console.log('CatchClause', error);
            console.log('CatchClause', error);
            console.error('删除图片失败:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * 获取图片列表
     * @param {Object} options - 配置选项
     * @param {string} options.category - 图片分类
     * @param {number} options.limit - 限制数量
     * @param {number} options.skip - 跳过数量
     * @returns {Promise<Object>} 获取结果
     */
    async getImageList(options = {}) {
        try {
            const result = await this.callCloudFunction('imageManager', {
                action: 'getImageList',
                ...options
            });
            return result.result;
        } catch (error) {
            console.log('CatchClause', error);
            console.log('CatchClause', error);
            console.error('获取图片列表失败:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }
}

// 创建全局实例
const imageManager = new ImageManager();

// 导出工具类供页面使用
module.exports = {
    ImageManager,
    imageManager
};
