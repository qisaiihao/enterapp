// 头像缓存工具（迁移至 CacheManager）
const cacheManager = require('../_utils/cache-manager').default;
const fileUrlCache = require('../_utils/file-url-cache').default || require('../_utils/file-url-cache');
const { cloudCall } = require('./cloudCall.js');

const NS_AVATAR = cacheManager.namespace('avatars', { persistent: true, maxItems: 2048 });
const AVATAR_TTL_MS = 24 * 60 * 60 * 1000; // 24h

class AvatarCache {
    constructor() {
        this.loadingAvatars = new Set(); // 正在加载的头像集合，避免重复请求
    }

    // 统一云函数调用方法
    callCloudFunction(name, data = {}) {
        return cloudCall(name, data, { pageTag: 'avatarCache' });
    }
    // 获取用户头像信息（优先从缓存获取）
    getUserAvatar(userId) {
        if (!userId) {
            return Promise.resolve(null);
        }

        // 先检查缓存
        const cached = NS_AVATAR.get(userId);
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
                    const cached = NS_AVATAR.get(userId);
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
            }).then(async (res) => {
                if (res.result && res.result.success && res.result.userInfo) {
                    const userInfo = res.result.userInfo;
                    let avatarUrl = userInfo.avatarUrl;
                    try {
                        if (typeof avatarUrl === 'string' && avatarUrl.startsWith('cloud://')) {
                            avatarUrl = fileUrlCache && fileUrlCache.getTempUrl ? await fileUrlCache.getTempUrl(avatarUrl) : avatarUrl;
                        }
                    } catch (_) {}
                    const avatarData = {
                        avatarUrl,
                        nickName: userInfo.nickName,
                        bio: userInfo.bio,
                        lastUpdated: Date.now()
                    };

                    // 缓存头像信息（持久化）
                    NS_AVATAR.set(userId, avatarData, { ttlMs: AVATAR_TTL_MS });
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
            const cached = NS_AVATAR.get(userId);
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
                }).then(async (res) => {
                    if (res.result && res.result.success && res.result.userProfiles) {
                        for (const userInfo of res.result.userProfiles) {
                            if (userInfo && userInfo._openid) {
                                let avatarUrl = userInfo.avatarUrl;
                                try {
                                    if (typeof avatarUrl === 'string' && avatarUrl.startsWith('cloud://')) {
                                        avatarUrl = fileUrlCache && fileUrlCache.getTempUrl ? await fileUrlCache.getTempUrl(avatarUrl) : avatarUrl;
                                    }
                                } catch (_) {}
                                const avatarData = {
                                    avatarUrl,
                                    nickName: userInfo.nickName,
                                    bio: userInfo.bio,
                                    lastUpdated: Date.now()
                                };
                                results[userInfo._openid] = avatarData;
                                NS_AVATAR.set(userInfo._openid, avatarData, { ttlMs: AVATAR_TTL_MS });
                            }
                        }
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
        try { NS_AVATAR.set(userId, updatedData, { ttlMs: AVATAR_TTL_MS }); return true; } catch (e) { return false; }
    }

    // 清理用户头像缓存
    clearUserAvatar(userId) {
        if (!userId) {
            return false;
        }
        try { NS_AVATAR.delete(userId); return true; } catch (e) { return false; }
    }

    // 获取默认头像
    getDefaultAvatar() {
        return '/static/images/avatar.png';
    }
}

// 创建单例
const avatarCache = new AvatarCache();
module.exports = avatarCache;

