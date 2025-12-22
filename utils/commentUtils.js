/**
 * 评论处理工具函数
 */
const { formatRelativeTime } = require('./time.js');
const { getLikeIcon } = require('./likeIcon.js');

/**
 * 处理评论数据，添加格式化时间和其他必要字段
 * @param {Object|Array} comments - 评论数据（单个评论或评论数组）
 * @returns {Object|Array} 处理后的评论数据
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
            // ensure reply folding flag is reactive on first render
            showAllReplies: false
        };

        // 处理回复
        if (comment.replies && Array.isArray(comment.replies)) {
            processedComment.replies = comment.replies.map(reply => processComment(reply));
        }

        return processedComment;
    };

    if (Array.isArray(comments)) {
        return comments.map(processComment);
    } else {
        return processComment(comments);
    }
}

/**
 * 验证评论输入内容
 * @param {string} content - 评论内容
 * @param {Array} images - 评论图片数组
 * @returns {Object} 验证结果 { isValid: boolean, message: string }
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
 * 处理评论图片，添加必要的属性
 * @param {Array} images - 图片数组
 * @param {string} openid - 用户ID
 * @returns {Array} 处理后的图片数组
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
 * @param {string} commentId - 要查找的评论ID
 * @returns {Object} 查找结果 { comment: Object, parentIndex: number, replyIndex: number }
 */
function findComment(comments, commentId) {
    if (!Array.isArray(comments) || !commentId) {
        return { comment: null, parentIndex: -1, replyIndex: -1 };
    }

    // 查找主评论
    for (let i = 0; i < comments.length; i++) {
        if (comments[i]._id === commentId) {
            return {
                comment: comments[i],
                parentIndex: i,
                replyIndex: -1
            };
        }

        // 查找回复
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
 * 计算评论的剩余字符数
 * @param {string} content - 当前内容
 * @param {number} maxLength - 最大长度
 * @returns {number} 剩余字符数
 */
function calculateRemainingChars(content, maxLength = 1000) {
    return maxLength - (content ? content.length : 0);
}

module.exports = {
    processComments,
    validateCommentInput,
    processCommentImages,
    findComment,
    calculateRemainingChars
};
