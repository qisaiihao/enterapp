import { groupPostsByMonth as groupPostsByMonthUtil, processPostsForTimeline as processPostsForTimelineUtil } from '@/utils/timeline.js';

export async function fetchTimelineData(tcbInstance, { openid, limit = 1000, formatTimeFn } = {}) {
    if (!tcbInstance || typeof tcbInstance.callFunction !== 'function') {
        throw new Error('tcbInstance.callFunction is required');
    }
    if (!openid) {
        throw new Error('openid is required to fetch timeline data');
    }

    const res = await tcbInstance.callFunction({
        name: 'getMyProfileData',
        data: {
            skip: 0,
            limit,
            openid
        }
    });

    if (!res.result || !res.result.success) {
        const error = new Error('获取时间轴数据失败');
        error.payload = res.result;
        throw error;
    }

    const allPosts = res.result.posts || [];
    const originalPoemPosts = allPosts.filter((post) => post.isPoem === true && post.isOriginal === true);

    if (typeof formatTimeFn === 'function') {
        originalPoemPosts.forEach((post) => {
            if (post.createTime) {
                post.formattedCreateTime = formatTimeFn(post.createTime);
            }
        });
    }

    const processedPosts = processPostsForTimelineUtil(originalPoemPosts);
    const timelineGroups = groupPostsByMonthUtil(processedPosts);

    return {
        posts: processedPosts,
        groups: timelineGroups
    };
}
