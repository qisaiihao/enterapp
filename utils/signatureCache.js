// 签名缓存工具（参考 avatarCache.js）
const cacheManager = require('../_utils/cache-manager');
const fileUrlCache = require('../_utils/file-url-cache').default || require('../_utils/file-url-cache');
const { cloudCall } = require('./cloudCall.js');

const NS_SIGNATURE = cacheManager.namespace('signatures', { persistent: true, maxItems: 2048 });
const SIGNATURE_TTL_MS = 24 * 60 * 60 * 1000; // 24h

class SignatureCache {
    constructor() {
        this.loadingSignatures = new Set(); // 正在加载的签名集合，避免重复请求
    }

    // 统一云函数调用方法
    callCloudFunction(name, data = {}) {
        return cloudCall(name, data, { pageTag: 'signatureCache' });
    }

    // 获取用户签名信息（优先从缓存获取）
    getUserSignature(userId) {
        if (!userId) {
            return Promise.resolve(null);
        }

        // 先检查缓存
        const cached = NS_SIGNATURE.get(userId);
        if (cached) {
            console.log(`【签名缓存】命中缓存: ${userId}`);
            return Promise.resolve(cached);
        }

        // 如果正在加载中，等待加载完成
        if (this.loadingSignatures.has(userId)) {
            console.log(`【签名缓存】正在加载中，等待: ${userId}`);
            return this.waitForSignatureLoad(userId);
        }

        // 开始加载签名
        return this.loadUserSignature(userId);
    }

    // 等待签名加载完成
    waitForSignatureLoad(userId) {
        return new Promise((resolve) => {
            const checkInterval = setInterval(() => {
                if (!this.loadingSignatures.has(userId)) {
                    clearInterval(checkInterval);
                    const cached = NS_SIGNATURE.get(userId);
                    resolve(cached);
                }
            }, 100);

            // 5秒超时
            setTimeout(() => {
                clearInterval(checkInterval);
                this.loadingSignatures.delete(userId);
                resolve(null);
            }, 5000);
        });
    }

    // 加载用户签名
    loadUserSignature(userId) {
        this.loadingSignatures.add(userId);
        console.log(`【签名缓存】开始加载签名: ${userId}`);
        return new Promise((resolve) => {
            // 调用云函数获取用户信息（只获取签名）
            this.callCloudFunction('getUserProfile', {
                userId: userId,
                onlyProfile: true
            }).then(async (res) => {
                if (res.result && res.result.success && res.result.userInfo) {
                    const userInfo = res.result.userInfo;
                    let signatureUrl = userInfo.signatureUrl || '';
                    
                    // 处理云存储URL转换
                    try {
                        if (typeof signatureUrl === 'string' && signatureUrl.startsWith('cloud://')) {
                            signatureUrl = fileUrlCache && fileUrlCache.getTempUrl ? await fileUrlCache.getTempUrl(signatureUrl) : signatureUrl;
                        }
                    } catch (err) {
                        console.warn(`【签名缓存】URL转换失败: ${userId}`, err);
                    }

                    const signatureData = {
                        signatureUrl: signatureUrl || '',
                        lastUpdated: Date.now()
                    };

                    // 缓存签名信息（持久化）
                    NS_SIGNATURE.set(userId, signatureData, { ttlMs: SIGNATURE_TTL_MS });
                    console.log(`【签名缓存】加载并缓存成功: ${userId}`);
                    resolve(signatureData);
                } else {
                    // 用户没有签名或获取失败，也缓存空结果（避免重复请求）
                    const signatureData = {
                        signatureUrl: '',
                        lastUpdated: Date.now()
                    };
                    NS_SIGNATURE.set(userId, signatureData, { ttlMs: SIGNATURE_TTL_MS });
                    console.log(`【签名缓存】用户无签名或获取失败: ${userId}`);
                    resolve(signatureData);
                }
            }).catch((error) => {
                console.error(`【签名缓存】加载签名失败: ${userId}`, error);
                // 出错时也缓存空结果，避免频繁请求
                const signatureData = {
                    signatureUrl: '',
                    lastUpdated: Date.now()
                };
                NS_SIGNATURE.set(userId, signatureData, { ttlMs: 5 * 60 * 1000 }); // 错误时只缓存5分钟
                resolve(signatureData);
            }).finally(() => {
                this.loadingSignatures.delete(userId);
            });
        });
    }

    // 批量获取用户签名
    getBatchUserSignatures(userIds) {
        if (!userIds || userIds.length === 0) {
            return Promise.resolve({});
        }
        const results = {};
        const needLoadUserIds = [];

        // 先检查缓存
        userIds.forEach((userId) => {
            const cached = NS_SIGNATURE.get(userId);
            if (cached) {
                results[userId] = cached;
            } else {
                needLoadUserIds.push(userId);
            }
        });

        // 批量加载未缓存的签名（并发控制）
        if (needLoadUserIds.length > 0) {
            console.log(`【签名缓存】批量加载签名: ${needLoadUserIds.length}个`);
            const promises = needLoadUserIds.map(userId => this.loadUserSignature(userId));
            return Promise.all(promises).then(() => {
                needLoadUserIds.forEach((userId) => {
                    const cached = NS_SIGNATURE.get(userId);
                    if (cached) {
                        results[userId] = cached;
                    }
                });
                return results;
            }).catch((error) => {
                console.error('【签名缓存】批量加载失败:', error);
                return results;
            });
        }
        return Promise.resolve(results);
    }

    // 更新用户签名缓存
    updateUserSignature(userId, signatureUrl) {
        if (!userId) {
            return false;
        }
        const signatureData = {
            signatureUrl: signatureUrl || '',
            lastUpdated: Date.now()
        };
        try {
            NS_SIGNATURE.set(userId, signatureData, { ttlMs: SIGNATURE_TTL_MS });
            return true;
        } catch (e) {
            return false;
        }
    }

    // 清理用户签名缓存
    clearUserSignature(userId) {
        if (!userId) {
            return false;
        }
        try {
            NS_SIGNATURE.delete(userId);
            return true;
        } catch (e) {
            return false;
        }
    }
}

// 创建单例
const signatureCache = new SignatureCache();
module.exports = signatureCache;

