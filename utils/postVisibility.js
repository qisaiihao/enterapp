export function isExpiredPost(post, now = Date.now()) {
    return post?.visibility === 'scheduled' && !(post.hideAt > now);
}

export function filterExpiredPublicPosts(posts) {
    const now = Date.now();
    if (!Array.isArray(posts) || !posts.some(post => isExpiredPost(post, now))) return posts;
    return posts.filter(post => !isExpiredPost(post, now));
}
