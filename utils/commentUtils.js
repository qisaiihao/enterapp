/**
 * 评论处理工具函数
 */
import { formatRelativeTime } from './time.js';
import { getLikeIcon } from './likeIcon.js';

/**
 * 处理评论数据，补齐时间、点赞图标和响应式字段
 * @param {Object|Array} comments - 评论数据
 * @returns {Object|Array}
 */
function processComments(comments) {
    if (!comments) return comments;

    const processComment = (comment) => {
        if (!comment) return comment;

        const processedComment = {
            ...comment,
            formattedCreateTime: formatRelativeTime(comment.createTime),
            likeIcon: getLikeIcon(comment.likes || 0, comment.liked || false),
            imageUrls: Array.isArray(comment.imageUrls) ? comment.imageUrls : [],
            originalImageUrls: Array.isArray(comment.originalImageUrls) ? comment.originalImageUrls : [],
            _openid: comment._openid || '',
            showAllReplies: typeof comment.showAllReplies === 'boolean' ? comment.showAllReplies : false
        };

        if (comment.replies && Array.isArray(comment.replies)) {
            processedComment.replies = comment.replies.map(reply => processComment(reply));
        }

        return processedComment;
    };

    if (Array.isArray(comments)) {
        return comments.map(processComment);
    }
    return processComment(comments);
}

function buildCommentUiStateMap(comments, stateMap = new Map()) {
    if (!Array.isArray(comments)) {
        return stateMap;
    }

    comments.forEach((comment) => {
        if (!comment) return;

        if (comment._id) {
            stateMap.set(comment._id, {
                showAllReplies: typeof comment.showAllReplies === 'boolean' ? comment.showAllReplies : false
            });
        }

        if (Array.isArray(comment.replies) && comment.replies.length > 0) {
            buildCommentUiStateMap(comment.replies, stateMap);
        }
    });

    return stateMap;
}

function mergeCommentUiState(comments, previousComments = []) {
    if (!Array.isArray(comments)) {
        return comments;
    }

    const stateMap = buildCommentUiStateMap(previousComments);

    const applyUiState = (comment) => {
        if (!comment) return comment;

        const nextComment = { ...comment };
        const savedState = nextComment._id ? stateMap.get(nextComment._id) : null;

        if (savedState && typeof savedState.showAllReplies === 'boolean') {
            nextComment.showAllReplies = savedState.showAllReplies;
        }

        if (Array.isArray(nextComment.replies) && nextComment.replies.length > 0) {
            nextComment.replies = nextComment.replies.map(applyUiState);
        }

        return nextComment;
    };

    return comments.map(applyUiState);
}

/**
 * 验证评论输入内容
 * @param {string} content - 评论内容
 * @param {Array} images - 评论图片数组
 * @returns {Object}
 */
function validateCommentInput(content, images = []) {
    const hasContent = content && content.trim().length > 0;
    const hasImages = images && images.length > 0;

    if (!hasContent && !hasImages) {
        return {
            isValid: false,
            message: '请输入评论内容或上传图片'
        };
    }

    if (content && content.length > 1000) {
        return {
            isValid: false,
            message: '评论内容不能超过1000字'
        };
    }

    if (images && images.length > 3) {
        return {
            isValid: false,
            message: '最多只能上传3张图片'
        };
    }

    return {
        isValid: true,
        message: ''
    };
}

/**
 * 处理评论图片，添加必要属性
 * @param {Array} images - 图片数组
 * @param {string} openid - 用户ID
 * @returns {Array}
 */
function processCommentImages(images, openid) {
    if (!Array.isArray(images) || !openid) {
        return [];
    }

    const timestamp = Date.now();

    return images.map((image, index) => {
        return {
            path: image.path || image,
            needCompression: image.needCompression !== false,
            order: image.order || index,
            tempName: `comment_${openid}_${timestamp}_${index}`
        };
    });
}

/**
 * 在评论列表中查找指定评论
 * @param {Array} comments - 评论列表
 * @param {string} commentId - 评论ID
 * @returns {Object}
 */
function findComment(comments, commentId) {
    if (!Array.isArray(comments) || !commentId) {
        return { comment: null, parentIndex: -1, replyIndex: -1 };
    }

    for (let i = 0; i < comments.length; i++) {
        if (comments[i]._id === commentId) {
            return {
                comment: comments[i],
                parentIndex: i,
                replyIndex: -1
            };
        }

        if (comments[i].replies && Array.isArray(comments[i].replies)) {
            for (let j = 0; j < comments[i].replies.length; j++) {
                if (comments[i].replies[j]._id === commentId) {
                    return {
                        comment: comments[i].replies[j],
                        parentIndex: i,
                        replyIndex: j
                    };
                }
            }
        }
    }

    return { comment: null, parentIndex: -1, replyIndex: -1 };
}

/**
 * 计算评论剩余字符数
 * @param {string} content - 当前内容
 * @param {number} maxLength - 最大长度
 * @returns {number}
 */
function calculateRemainingChars(content, maxLength = 1000) {
    return maxLength - (content ? content.length : 0);
}

const commentUtils = {
    processComments,
    mergeCommentUiState,
    validateCommentInput,
    processCommentImages,
    findComment,
    calculateRemainingChars
};

export {
    processComments,
    mergeCommentUiState,
    validateCommentInput,
    processCommentImages,
    findComment,
    calculateRemainingChars
};

export default commentUtils;

if (typeof module !== 'undefined' && module.exports) {
    module.exports = commentUtils;
    module.exports.default = commentUtils;
}
