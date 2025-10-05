// 关注状态缓存工具类
const dataCache = require('./dataCache');
const cloudFunction = require('./cloudFunction');

class FollowCache {
    constructor() {
        this.loadingFollows = new Set(); // 正在加载的关注状态集合，避免重复请求
    }

    // 兼容性云函数调用方法
    callCloudFunction(name, data = {}) {
        console.log(`🔍 [FollowCache] 调用云函数: ${name}`, data);
        
        return new Promise((resolve, reject) => {
            // 检查运行环境
            const isH5 = typeof window !== 'undefined';
            const isMiniProgram = typeof wx !== 'undefined';
            
            if (isH5) {
                // H5环境使用TCB
                if (typeof getApp !== 'undefined' && getApp().$tcb && getApp().$tcb.callFunction) {
                    console.log(`🔍 [FollowCache] H5环境使用TCB调用云函数: ${name}`);
                    getApp().$tcb.callFunction({
                        name: name,
                        data: data
                    }).then(resolve).catch(reject);
                } else {
                    console.error(`❌ [FollowCache] H5环境TCB不可用`);
                    reject(new Error('TCB实例不可用'));
                }
            } else if (isMiniProgram) {
                // 小程序环境使用微信云开发
                if (wx.cloud && wx.cloud.callFunction) {
                    console.log(`🔍 [FollowCache] 小程序环境使用微信云开发调用云函数: ${name}`);
                    wx.cloud.callFunction({
                        name: name,
                        data: data,
                        success: (res) => {
                            console.log(`✅ [FollowCache] 云函数调用成功: ${name}`, res);
                            resolve(res);
                        },
                        fail: (err) => {
                            console.error(`❌ [FollowCache] 云函数调用失败: ${name}`, err);
                            reject(err);
                        }
                    });
                } else {
                    console.error(`❌ [FollowCache] 小程序环境微信云开发不可用`);
                    reject(new Error('微信云开发不可用'));
                }
            } else {
                console.error(`❌ [FollowCache] 未知运行环境`);
                reject(new Error('未知运行环境'));
            }
        });
    }

    // 获取关注状态（优先从缓存获取）
    getFollowStatus(currentUserId, targetUserId) {
        if (!currentUserId || !targetUserId || currentUserId === targetUserId) {
            return Promise.resolve(null);
        }

        // 先检查缓存
        const cached = dataCache.getFollowStatusCache(currentUserId, targetUserId);
        if (cached) {
            console.log(`【关注缓存】命中缓存: ${currentUserId} -> ${targetUserId}`);
            return Promise.resolve(cached);
        }

        // 如果正在加载中，等待加载完成
        if (this.loadingFollows.has(`${currentUserId}_${targetUserId}`)) {
            console.log(`【关注缓存】正在加载中，等待: ${currentUserId} -> ${targetUserId}`);
            return this.waitForFollowLoad(currentUserId, targetUserId);
        }

        // 开始加载关注状态
        return this.loadFollowStatus(currentUserId, targetUserId);
    }

    // 等待关注状态加载完成
    waitForFollowLoad(currentUserId, targetUserId) {
        return new Promise((resolve) => {
            const key = `${currentUserId}_${targetUserId}`;
            const checkInterval = setInterval(() => {
                if (!this.loadingFollows.has(key)) {
                    clearInterval(checkInterval);
                    const cached = dataCache.getFollowStatusCache(currentUserId, targetUserId);
                    resolve(cached);
                }
            }, 100);

            // 3秒超时
            setTimeout(() => {
                clearInterval(checkInterval);
                this.loadingFollows.delete(key);
                resolve(null);
            }, 3000);
        });
    }

    // 加载关注状态
    loadFollowStatus(currentUserId, targetUserId) {
        const key = `${currentUserId}_${targetUserId}`;
        this.loadingFollows.add(key);
        console.log(`【关注缓存】开始加载关注状态: ${currentUserId} -> ${targetUserId}`);
        return new Promise((resolve) => {
            // 调用云函数检查关注状态
            this.callCloudFunction('follow', {
                action: 'checkFollow',
                targetOpenid: targetUserId
            }).then((res) => {
                if (res.result && res.result.success) {
                    const followData = {
                        isFollowing: !!res.result.isFollowing,
                        isFollowedByAuthor: !!res.result.isFollower,
                        isMutualFollow: !!res.result.isMutual,
                        lastUpdated: Date.now()
                    };

                    // 缓存关注状态
                    dataCache.setFollowStatusCache(currentUserId, targetUserId, followData);
                    console.log(`【关注缓存】加载并缓存成功: ${currentUserId} -> ${targetUserId}`, followData);
                    resolve(followData);
                } else {
                    console.warn(`【关注缓存】获取关注状态失败: ${currentUserId} -> ${targetUserId}`, res.result);
                    resolve(null);
                }
            }).catch((error) => {
                console.error(`【关注缓存】加载关注状态失败: ${currentUserId} -> ${targetUserId}`, error);
                resolve(null);
            }).finally(() => {
                this.loadingFollows.delete(key);
            });
        });
    }

    // 批量获取关注状态
    getBatchFollowStatus(currentUserId, targetUserIds) {
        if (!currentUserId || !targetUserIds || targetUserIds.length === 0) {
            return Promise.resolve({});
        }
        const results = {};
        const needLoadUserIds = [];

        // 先检查缓存
        targetUserIds.forEach((targetUserId) => {
            if (targetUserId !== currentUserId) {
                const cached = dataCache.getFollowStatusCache(currentUserId, targetUserId);
                if (cached) {
                    results[targetUserId] = cached;
                } else {
                    needLoadUserIds.push(targetUserId);
                }
            }
        });

        // 批量加载未缓存的关注状态
        if (needLoadUserIds.length > 0) {
            console.log(`【关注缓存】批量加载关注状态: ${needLoadUserIds.length}个`);
            return new Promise((resolve) => {
                this.callCloudFunction('getBatchFollowStatus', {
                    currentUserId: currentUserId,
                    targetUserIds: needLoadUserIds
                }).then((res) => {
                    if (res.result && res.result.success && res.result.followStatuses) {
                        res.result.followStatuses.forEach((status) => {
                            if (status && status.targetUserId) {
                                const followData = {
                                    isFollowing: !!status.isFollowing,
                                    isFollowedByAuthor: !!status.isFollowedByAuthor,
                                    isMutualFollow: !!status.isMutualFollow,
                                    lastUpdated: Date.now()
                                };
                                results[status.targetUserId] = followData;
                                dataCache.setFollowStatusCache(currentUserId, status.targetUserId, followData);
                            }
                        });
                    }
                    resolve(results);
                }).catch((error) => {
                    console.error('【关注缓存】批量加载失败:', error);
                    resolve(results);
                });
            });
        }
        return Promise.resolve(results);
    }

    // 预加载关注状态（在帖子列表中预加载）
    preloadFollowStatusFromPosts(posts, currentUserId) {
        if (!posts || posts.length === 0 || !currentUserId) {
            return;
        }
        const targetUserIds = [...new Set(posts.map((post) => post._openid).filter((id) => id && id !== currentUserId))];
        if (targetUserIds.length === 0) {
            return;
        }

        // 异步预加载，不阻塞UI
        setTimeout(() => {
            this.getBatchFollowStatus(currentUserId, targetUserIds).then((statuses) => {
                console.log(`【关注缓存】预加载完成: ${Object.keys(statuses).length}个关注状态`);
            });
        }, 100);
    }

    // 更新关注状态缓存
    updateFollowStatus(currentUserId, targetUserId, followData) {
        if (!currentUserId || !targetUserId || !followData) {
            return false;
        }
        const updatedData = {
            ...followData,
            lastUpdated: Date.now()
        };
        return dataCache.setFollowStatusCache(currentUserId, targetUserId, updatedData);
    }

    // 切换关注状态并更新缓存
    toggleFollowStatus(currentUserId, targetUserId) {
        if (!currentUserId || !targetUserId || currentUserId === targetUserId) {
            return Promise.resolve(null);
        }
        return new Promise((resolve) => {
            // 调用云函数切换关注状态
            this.callCloudFunction('follow', {
                action: 'toggleFollow',
                targetOpenid: targetUserId
            }).then((res) => {
                if (res.result && res.result.success) {
                    const followData = {
                        isFollowing: !!res.result.isFollowing,
                        isFollowedByAuthor: !!res.result.isFollower,
                        isMutualFollow: !!res.result.isMutual,
                        lastUpdated: Date.now()
                    };

                    // 更新缓存
                    this.updateFollowStatus(currentUserId, targetUserId, followData);
                    console.log(`【关注缓存】切换关注状态成功: ${currentUserId} -> ${targetUserId}`, followData);
                    resolve(followData);
                } else {
                    console.warn(`【关注缓存】切换关注状态失败: ${currentUserId} -> ${targetUserId}`, res.result);
                    resolve(null);
                }
            }).catch((error) => {
                console.error(`【关注缓存】切换关注状态失败: ${currentUserId} -> ${targetUserId}`, error);
                resolve(null);
            });
        });
    }

    // 清理用户关注状态缓存
    clearUserFollowCache(userId) {
        if (!userId) {
            return false;
        }
        try {
            const keys = uni.getStorageInfoSync().keys;
            keys.forEach((key) => {
                if (key.startsWith(`follow_`) && key.includes(`_${userId}`)) {
                    dataCache.remove(key);
                }
            });
            return true;
        } catch (e) {
            console.log('CatchClause', e);
            console.log('CatchClause', e);
            console.error('清理用户关注缓存失败:', e);
            return false;
        }
    }

    // 清理所有关注状态缓存
    clearAllFollowCache() {
        try {
            const keys = uni.getStorageInfoSync().keys;
            keys.forEach((key) => {
                if (key.startsWith(`follow_`)) {
                    dataCache.remove(key);
                }
            });
            return true;
        } catch (e) {
            console.log('CatchClause', e);
            console.log('CatchClause', e);
            console.error('清理所有关注缓存失败:', e);
            return false;
        }
    }
}

// 创建单例
const followCache = new FollowCache();
module.exports = followCache;
