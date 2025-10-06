// 头像缓存工具类
const dataCache = require('./dataCache');
const cloudFunction = require('./cloudFunction');

class AvatarCache {
    constructor() {
        this.loadingAvatars = new Set(); // 正在加载的头像集合，避免重复请求
    }

    // 兼容性云函数调用方法
    callCloudFunction(name, data = {}) {
        console.log(`🔍 [AvatarCache] 调用云函数: ${name}`, data);
        
        return new Promise((resolve, reject) => {
            // 使用新的平台检测工具
            const { getCurrentPlatform, getCloudFunctionMethod, logPlatformInfo } = require('./platformDetector.js');
            const { debugEnvironmentDetection, testCloudFunctionCapability } = require('./debugPlatform.js');
            
            // 详细的环境检测调试
            debugEnvironmentDetection();
            
            const platform = getCurrentPlatform();
            const method = getCloudFunctionMethod();
            const capability = testCloudFunctionCapability();
            
            console.log(`🔍 [AvatarCache] 运行环境: ${platform}, 调用方式: ${method}, 实际能力: ${capability}`);
            
            // 打印详细的平台信息（调试用）
            logPlatformInfo();
            
            // 如果检测到的调用方式与实际能力不匹配，使用实际能力
            const actualMethod = capability !== 'none' ? capability : method;
            console.log(`🔍 [AvatarCache] 最终使用调用方式: ${actualMethod}`);
            
            if (actualMethod === 'tcb') {
                // 使用TCB调用云函数（H5和App环境）
                if (typeof getApp !== 'undefined' && getApp().$tcb && getApp().$tcb.callFunction) {
                    console.log(`🔍 [AvatarCache] 使用TCB调用云函数: ${name} (环境: ${platform})`);
                    getApp().$tcb.callFunction({
                        name: name,
                        data: data
                    }).then(resolve).catch(reject);
                } else {
                    console.error(`❌ [AvatarCache] ${platform}环境TCB不可用`);
                    console.error(`❌ [AvatarCache] getApp():`, typeof getApp);
                    console.error(`❌ [AvatarCache] getApp().$tcb:`, typeof (getApp && getApp().$tcb));
                    console.error(`❌ [AvatarCache] getApp().$tcb.callFunction:`, typeof (getApp && getApp().$tcb && getApp().$tcb.callFunction));
                    reject(new Error('TCB实例不可用'));
                }
            } else if (actualMethod === 'wx-cloud') {
                // 使用微信云开发调用云函数（小程序环境）
                if (wx.cloud && wx.cloud.callFunction) {
                    console.log(`🔍 [AvatarCache] 使用微信云开发调用云函数: ${name}`);
                    wx.cloud.callFunction({
                        name: name,
                        data: data,
                        success: (res) => {
                            console.log(`✅ [AvatarCache] 云函数调用成功: ${name}`, res);
                            resolve(res);
                        },
                        fail: (err) => {
                            console.error(`❌ [AvatarCache] 云函数调用失败: ${name}`, err);
                            reject(err);
                        }
                    });
                } else {
                    console.error(`❌ [AvatarCache] 小程序环境微信云开发不可用`);
                    console.error(`❌ [AvatarCache] wx.cloud:`, typeof wx.cloud);
                    console.error(`❌ [AvatarCache] wx.cloud.callFunction:`, typeof (wx.cloud && wx.cloud.callFunction));
                    reject(new Error('微信云开发不可用'));
                }
            } else {
                console.error(`❌ [AvatarCache] 不支持的云函数调用方式: ${actualMethod}`);
                reject(new Error(`不支持的云函数调用方式: ${actualMethod}`));
            }
        });
    }

    // 获取用户头像信息（优先从缓存获取）
    getUserAvatar(userId) {
        if (!userId) {
            return Promise.resolve(null);
        }

        // 先检查缓存
        const cached = dataCache.getAvatarCache(userId);
        if (cached) {
            console.log(`【头像缓存】命中缓存: ${userId}`);
            return Promise.resolve(cached);
        }

        // 如果正在加载中，等待加载完成
        if (this.loadingAvatars.has(userId)) {
            console.log(`【头像缓存】正在加载中，等待: ${userId}`);
            return this.waitForAvatarLoad(userId);
        }

        // 开始加载头像
        return this.loadUserAvatar(userId);
    }

    // 等待头像加载完成
    waitForAvatarLoad(userId) {
        return new Promise((resolve) => {
            const checkInterval = setInterval(() => {
                if (!this.loadingAvatars.has(userId)) {
                    clearInterval(checkInterval);
                    const cached = dataCache.getAvatarCache(userId);
                    resolve(cached);
                }
            }, 100);

            // 5秒超时
            setTimeout(() => {
                clearInterval(checkInterval);
                this.loadingAvatars.delete(userId);
                resolve(null);
            }, 5000);
        });
    }

    // 加载用户头像
    loadUserAvatar(userId) {
        this.loadingAvatars.add(userId);
        console.log(`【头像缓存】开始加载头像: ${userId}`);
        return new Promise((resolve) => {
            // 调用云函数获取用户信息
            this.callCloudFunction('getUserProfile', {
                userId: userId
            }).then((res) => {
                if (res.result && res.result.success && res.result.userInfo) {
                    const userInfo = res.result.userInfo;
                    const avatarData = {
                        avatarUrl: userInfo.avatarUrl,
                        nickName: userInfo.nickName,
                        bio: userInfo.bio,
                        lastUpdated: Date.now()
                    };

                    // 缓存头像信息
                    dataCache.setAvatarCache(userId, avatarData);
                    console.log(`【头像缓存】加载并缓存成功: ${userId}`);
                    resolve(avatarData);
                } else {
                    console.warn(`【头像缓存】获取用户信息失败: ${userId}`, res.result);
                    resolve(null);
                }
            }).catch((error) => {
                console.error(`【头像缓存】加载头像失败: ${userId}`, error);
                resolve(null);
            }).finally(() => {
                this.loadingAvatars.delete(userId);
            });
        });
    }

    // 批量获取用户头像
    getBatchUserAvatars(userIds) {
        if (!userIds || userIds.length === 0) {
            return Promise.resolve({});
        }
        const results = {};
        const needLoadUserIds = [];

        // 先检查缓存
        userIds.forEach((userId) => {
            const cached = dataCache.getAvatarCache(userId);
            if (cached) {
                results[userId] = cached;
            } else {
                needLoadUserIds.push(userId);
            }
        });

        // 批量加载未缓存的头像
        if (needLoadUserIds.length > 0) {
            console.log(`【头像缓存】批量加载头像: ${needLoadUserIds.length}个`);
            return new Promise((resolve) => {
                this.callCloudFunction('getBatchUserProfiles', {
                    userIds: needLoadUserIds
                }).then((res) => {
                    if (res.result && res.result.success && res.result.userProfiles) {
                        res.result.userProfiles.forEach((userInfo) => {
                            if (userInfo && userInfo._openid) {
                                const avatarData = {
                                    avatarUrl: userInfo.avatarUrl,
                                    nickName: userInfo.nickName,
                                    bio: userInfo.bio,
                                    lastUpdated: Date.now()
                                };
                                results[userInfo._openid] = avatarData;
                                dataCache.setAvatarCache(userInfo._openid, avatarData);
                            }
                        });
                    }
                    resolve(results);
                }).catch((error) => {
                    console.error('【头像缓存】批量加载失败:', error);
                    resolve(results);
                });
            });
        }
        return Promise.resolve(results);
    }

    // 预加载头像（在帖子列表中预加载）
    preloadAvatarsFromPosts(posts) {
        if (!posts || posts.length === 0) {
            return;
        }
        const userIds = [...new Set(posts.map((post) => post._openid).filter(Boolean))];
        if (userIds.length === 0) {
            return;
        }

        // 异步预加载，不阻塞UI
        setTimeout(() => {
            this.getBatchUserAvatars(userIds).then((avatars) => {
                console.log(`【头像缓存】预加载完成: ${Object.keys(avatars).length}个头像`);
            });
        }, 100);
    }

    // 更新用户头像缓存
    updateUserAvatar(userId, avatarData) {
        if (!userId || !avatarData) {
            return false;
        }
        const updatedData = {
            ...avatarData,
            lastUpdated: Date.now()
        };
        return dataCache.setAvatarCache(userId, updatedData);
    }

    // 清理用户头像缓存
    clearUserAvatar(userId) {
        if (!userId) {
            return false;
        }
        return dataCache.remove(`avatar_${userId}`);
    }

    // 获取默认头像
    getDefaultAvatar() {
        return '/static/images/avatar.png';
    }
}

// 创建单例
const avatarCache = new AvatarCache();
module.exports = avatarCache;
