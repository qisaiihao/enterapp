/**
 * 成长统计相关工具函数
 */

/**
 * 根据帖子列表计算成长统计
 * @param {Array} postList - 帖子列表
 * @returns {Object} 成长统计数据
 */
export function computeGrowthStats(postList = []) {
    try {
        const stats = { seed: 0, leaf: 0, flower: 0, peach: 0 };

        (postList || []).forEach((post) => {
            const votes = Number(post && post.votes) || 0;
            if (votes <= 3) {
                stats.seed += 1;
            } else if (votes <= 7) {
                stats.leaf += 1;
            } else if (votes <= 15) {
                stats.flower += 1;
            } else {
                stats.peach += 1;
            }
        });

        return stats;
    } catch (err) {
        console.warn('【growthStats】计算成长统计失败:', err);
        return { seed: 0, leaf: 0, flower: 0, peach: 0 };
    }
}

/**
 * 从用户数据中提取成长统计
 * @param {Object} userInfo - 用户信息
 * @param {Array} postList - 帖子列表（备选计算方式）
 * @returns {Object} 成长统计数据
 */
export function extractGrowthStats(userInfo, postList = null) {
    try {
        // 优先使用用户信息中的growthCounts
        if (userInfo && userInfo.growthCounts) {
            return {
                seed: Number(userInfo.growthCounts.seed) || 0,
                leaf: Number(userInfo.growthCounts.leaf) || 0,
                flower: Number(userInfo.growthCounts.flower) || 0,
                peach: Number(userInfo.growthCounts.peach) || 0,
            };
        }

        // 如果没有growthCounts，根据帖子列表计算
        if (postList && postList.length > 0) {
            return computeGrowthStats(postList);
        }

        // 默认值
        return { seed: 0, leaf: 0, flower: 0, peach: 0 };
    } catch (err) {
        console.warn('【growthStats】提取成长统计失败:', err);
        return { seed: 0, leaf: 0, flower: 0, peach: 0 };
    }
}

/**
 * 更新成长统计（用于显示实时更新）
 * @param {Object} currentStats - 当前统计数据
 * @param {number} votes - 新的投票数
 * @param {number} oldVotes - 原来的投票数（可选）
 * @returns {Object} 更新后的统计数据
 */
export function updateGrowthStats(currentStats, votes, oldVotes = 0) {
    try {
        const stats = { ...currentStats };

        // 减去原来的统计
        if (oldVotes <= 3) {
            stats.seed = Math.max(0, stats.seed - 1);
        } else if (oldVotes <= 7) {
            stats.leaf = Math.max(0, stats.leaf - 1);
        } else if (oldVotes <= 15) {
            stats.flower = Math.max(0, stats.flower - 1);
        } else {
            stats.peach = Math.max(0, stats.peach - 1);
        }

        // 添加新的统计
        if (votes <= 3) {
            stats.seed += 1;
        } else if (votes <= 7) {
            stats.leaf += 1;
        } else if (votes <= 15) {
            stats.flower += 1;
        } else {
            stats.peach += 1;
        }

        return stats;
    } catch (err) {
        console.warn('【growthStats】更新成长统计失败:', err);
        return currentStats;
    }
}