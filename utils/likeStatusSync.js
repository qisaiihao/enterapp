/**
 * 点赞状态同步工具
 * 用于在不同页面间同步点赞状态
 */
const cacheManager = require('../_utils/cache-manager').default;
const likeIcon = require('./likeIcon');

/**
 * 从所有相关缓存中同步帖子的点赞状态
 * @param {Array} postIds - 需要同步的帖子ID数组
 * @returns {Object} - 同步结果 { success: boolean, updated: number, errors: Array }
 */
function syncLikeStatusForPosts(postIds = []) {
    if (!Array.isArray(postIds) || postIds.length === 0) {
        return { success: true, updated: 0, errors: [] };
    }

    const result = { success: true, updated: 0, errors: [] };

    try {
        // 获取所有相关的缓存命名空间
        const nsStats = cacheManager.getStats ? cacheManager.getStats() : {};
        const nsNames = Object.keys(nsStats);
        const targetNamespaces = nsNames.filter((n) => (
            n === 'posts:home' ||
            n === 'posts:discover' ||
            n.startsWith('posts:tag:') ||
            n.startsWith('me:posts') ||
            n.startsWith('userPosts:') ||
            n.startsWith('posts:')  // 覆盖所有posts开头的命名空间
        ));

        console.log(`[likeStatusSync] 开始同步 ${postIds.length} 个帖子的点赞状态，涉及 ${targetNamespaces.length} 个缓存空间`);

        targetNamespaces.forEach((nsName) => {
            try {
                const ns = cacheManager.namespace(nsName);
                const keys = (ns.keys && ns.keys()) || [];

                keys.forEach((key) => {
                    try {
                        ns.update(key, (list) => {
                            if (!Array.isArray(list)) return list;

                            let changed = false;
                            list.forEach((post, index) => {
                                if (post && postIds.includes(post._id || post.id)) {
                                    // 从数据库或缓存中获取最新的点赞状态
                                    const latestStatus = getLatestLikeStatus(post._id || post.id);
                                    if (latestStatus) {
                                        const oldVotes = post.votes || 0;
                                        const oldIsVoted = post.isVoted || false;

                                        post.votes = latestStatus.votes;
                                        post.isVoted = latestStatus.isVoted;
                                        post.likeIcon = likeIcon.getLikeIcon(latestStatus.votes, latestStatus.isVoted);

                                        // 检查是否真的发生了变化
                                        if (oldVotes !== latestStatus.votes || oldIsVoted !== latestStatus.isVoted) {
                                            changed = true;
                                            result.updated++;
                                            console.log(`[likeStatusSync] 更新帖子 ${post._id} 点赞状态: ${oldVotes}→${latestStatus.votes}, ${oldIsVoted}→${latestStatus.isVoted}`);
                                        }
                                    }
                                }
                            });

                            return changed ? list : list;
                        });
                    } catch (err) {
                        result.errors.push(`更新缓存键 ${key} 失败: ${err.message}`);
                    }
                });
            } catch (err) {
                result.errors.push(`处理缓存空间 ${nsName} 失败: ${err.message}`);
            }
        });

        console.log(`[likeStatusSync] 同步完成，更新了 ${result.updated} 个帖子的点赞状态`);

    } catch (err) {
        result.success = false;
        result.errors.push(`同步过程发生错误: ${err.message}`);
        console.error('[likeStatusSync] 同步失败', err);
    }

    return result;
}

/**
 * 获取帖子的最新点赞状态
 * 这里可以实现多种策略：从专用缓存获取、从本地存储获取等
 * @param {string} postId - 帖子ID
 * @returns {Object|null} - { votes: number, isVoted: boolean } 或 null
 */
function getLatestLikeStatus(postId) {
    if (!postId) return null;

    try {
        // 策略1: 从专门的点赞状态缓存获取
        const likeStatusNs = cacheManager.namespace('like:status');
        const cachedStatus = likeStatusNs.get(postId);
        if (cachedStatus) {
            return cachedStatus;
        }

        // 策略2: 从本地存储获取（如果有）
        try {
            const storageKey = `like_status_${postId}`;
            const storedStatus = uni.getStorageSync(storageKey);
            if (storedStatus) {
                const status = JSON.parse(storedStatus);
                // 检查是否过期（5分钟）
                if (status.timestamp && Date.now() - status.timestamp < 5 * 60 * 1000) {
                    return { votes: status.votes, isVoted: status.isVoted };
                }
            }
        } catch (e) {
            // 忽略本地存储错误
        }

        return null;
    } catch (err) {
        console.warn(`[likeStatusSync] 获取帖子 ${postId} 最新点赞状态失败`, err);
        return null;
    }
}

/**
 * 更新帖子的点赞状态到缓存
 * @param {string} postId - 帖子ID
 * @param {number} votes - 点赞数
 * @param {boolean} isVoted - 是否已点赞
 */
function updateLikeStatus(postId, votes, isVoted) {
    if (!postId) return;

    try {
        // 更新到专门的点赞状态缓存
        const likeStatusNs = cacheManager.namespace('like:status');
        likeStatusNs.set(postId, { votes, isVoted }, { ttlMs: 10 * 60 * 1000 }); // 10分钟TTL

        // 同时保存到本地存储作为备份
        try {
            const storageKey = `like_status_${postId}`;
            const statusData = {
                votes,
                isVoted,
                timestamp: Date.now()
            };
            uni.setStorageSync(storageKey, JSON.stringify(statusData));
        } catch (e) {
            // 忽略本地存储错误
        }

        console.log(`[likeStatusSync] 更新帖子 ${postId} 点赞状态到缓存: ${votes}, ${isVoted}`);
    } catch (err) {
        console.warn(`[likeStatusSync] 更新帖子 ${postId} 点赞状态到缓存失败`, err);
    }
}

/**
 * 清理过期的点赞状态缓存
 */
function cleanupExpiredLikeStatus() {
    try {
        const likeStatusNs = cacheManager.namespace('like:status');
        const keys = likeStatusNs.keys();
        const now = Date.now();

        keys.forEach(key => {
            try {
                // 这里可以添加更复杂的清理逻辑
                // 比如检查缓存项的时间戳等
            } catch (err) {
                // 清理失败的项
                likeStatusNs.delete(key);
            }
        });
    } catch (err) {
        console.warn('[likeStatusSync] 清理过期点赞状态缓存失败', err);
    }
}

module.exports = {
    syncLikeStatusForPosts,
    updateLikeStatus,
    getLatestLikeStatus,
    cleanupExpiredLikeStatus
};