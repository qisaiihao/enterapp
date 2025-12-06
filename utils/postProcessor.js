/**
 * 统一的帖子列表处理函数
 * 合并多处重复的数据处理逻辑，减少代码冗余
 */

import { normalizePostList } from '@/utils/postNormalizer.js';
import likeIcon from '@/utils/likeIcon';
import { hydrateTempUrls, warmTempUrlsFromPosts } from '@/_utils/hydrate-temp-urls';
import { getLatestLikeStatus } from '@/utils/likeStatusSync.js';

/**
 * 处理帖子列表：标准化 + 点赞图标 + URL转换 + 预热缓存
 * @param {Array} postsRaw - 原始帖子数组
 * @param {Object} options - 可选配置
 * @param {boolean} options.useCachedLikeStatus - 是否使用缓存的点赞状态（默认false）
 * @returns {Promise<Array>} 处理后的帖子数组
 */
export async function processPostList(postsRaw, options = {}) {
    const { useCachedLikeStatus = false } = options;
    
    // 1. 标准化并添加点赞图标
    let posts = normalizePostList(postsRaw).map((post) => {
        let votes = post.votes || 0;
        let isVoted = post.isVoted || false;
        
        // 如果需要，从缓存获取最新的点赞状态
        if (useCachedLikeStatus && post._id) {
            const cachedStatus = getLatestLikeStatus(post._id);
            if (cachedStatus) {
                votes = cachedStatus.votes;
                isVoted = cachedStatus.isVoted;
            }
        }
        
        return {
            ...post,
            votes,
            isVoted,
            likeIcon: likeIcon.getLikeIcon(votes, isVoted)
        };
    });
    
    // 2. 将 cloud:// 映射为可访问的临时URL
    posts = await hydrateTempUrls(posts);
    
    // 3. 预热URL缓存
    warmTempUrlsFromPosts(posts);
    
    return posts;
}

/**
 * 同步处理帖子列表（不包含异步URL转换）
 * 适用于已经有临时URL或不需要URL转换的场景
 * @param {Array} postsRaw - 原始帖子数组
 * @param {Object} options - 可选配置
 * @returns {Array} 处理后的帖子数组
 */
export function processPostListSync(postsRaw, options = {}) {
    const { useCachedLikeStatus = false } = options;
    
    return normalizePostList(postsRaw).map((post) => {
        let votes = post.votes || 0;
        let isVoted = post.isVoted || false;
        
        if (useCachedLikeStatus && post._id) {
            const cachedStatus = getLatestLikeStatus(post._id);
            if (cachedStatus) {
                votes = cachedStatus.votes;
                isVoted = cachedStatus.isVoted;
            }
        }
        
        return {
            ...post,
            votes,
            isVoted,
            likeIcon: likeIcon.getLikeIcon(votes, isVoted)
        };
    });
}
