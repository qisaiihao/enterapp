/**
 * 发布内容相关API缓存层
 */
const { cloudCall } = require('../utils/cloudCall.js');

/**
 * 检查重复诗歌
 * @param {string} title - 标题
 * @param {string} author - 作者
 * @param {boolean} isOriginal - 是否原创
 * @param {Object} options - 额外选项
 * @returns {Promise} 检查结果
 */
function checkDuplicatePoem(title, author, isOriginal, options = {}) {
    if (!title || !title.trim()) {
        return Promise.reject(new Error('标题不能为空'));
    }

    return cloudCall('checkDuplicatePoem', {
        title: title.trim(),
        author: author ? author.trim() : '',
        isOriginal: Boolean(isOriginal)
    }, Object.assign({
        pageTag: 'add',
        requireAuth: true,
        ...options
    }));
}

/**
 * 内容审核
 * @param {Object} auditData - 审核数据
 * @param {string} auditData.content - 内容
 * @param {string} auditData.title - 标题
 * @param {Array} auditData.images - 图片列表
 * @param {Object} options - 额外选项
 * @returns {Promise} 审核结果
 */
function contentAudit(auditData, options = {}) {
    if (!auditData) {
        return Promise.reject(new Error('审核数据不能为空'));
    }

    const { content, title, images } = auditData;

    const auditParams = {
        content: content || '',
        title: title || '',
        images: images || []
    };

    return cloudCall('contentCheck', auditParams, Object.assign({
        pageTag: 'add',
        requireAuth: true,
        ...options
    }));
}

/**
 * 上传文件到云存储
 * @param {string} cloudPath - 云端路径
 * @param {string} fileContent - 文件内容（base64）
 * @param {Object} options - 额外选项
 * @returns {Promise} 上传结果
 */
function uploadFile(cloudPath, fileContent, options = {}) {
    if (!cloudPath) {
        return Promise.reject(new Error('文件路径不能为空'));
    }

    if (!fileContent) {
        return Promise.reject(new Error('文件内容不能为空'));
    }

    return cloudCall('upload', {
        cloudPath: cloudPath,
        fileContent: fileContent
    }, Object.assign({
        pageTag: 'add',
        requireAuth: true,
        ...options
    }));
}

/**
 * 保存草稿
 * @param {Object} draftData - 草稿数据
 * @param {Object} options - 额外选项
 * @returns {Promise} 保存结果
 */
function saveDraft(draftData, options = {}) {
    if (!draftData) {
        return Promise.reject(new Error('草稿数据不能为空'));
    }

    return cloudCall('getMyProfileData', {
        action: 'saveDraft',
        draftData: draftData
    }, Object.assign({
        pageTag: 'add',
        requireAuth: true,
        ...options
    }));
}

/**
 * 获取草稿列表
 * @param {Object} options - 额外选项
 * @returns {Promise} 草稿列表
 */
function getDrafts(options = {}) {
    return cloudCall('getMyProfileData', {
        action: 'getDrafts'
    }, Object.assign({
        pageTag: 'add',
        requireAuth: true,
        ...options
    }));
}

/**
 * 删除草稿
 * @param {string} draftId - 草稿ID
 * @param {Object} options - 额外选项
 * @returns {Promise} 删除结果
 */
function deleteDraft(draftId, options = {}) {
    if (!draftId) {
        return Promise.reject(new Error('草稿ID不能为空'));
    }

    return cloudCall('getMyProfileData', {
        action: 'deleteDraft',
        draftId: draftId
    }, Object.assign({
        pageTag: 'add',
        requireAuth: true,
        ...options
    }));
}

/**
 * 发布帖子
 * @param {Object} postData - 帖子数据
 * @param {string} postData.title - 标题
 * @param {string} postData.content - 内容
 * @param {Array} postData.images - 图片列表
 * @param {Array} postData.tags - 标签列表
 * @param {string} postData.publishMode - 发布模式
 * @param {boolean} postData.isOriginal - 是否原创
 * @param {string} postData.author - 作者（非原创诗歌）
 * @param {Object} options - 额外选项
 * @returns {Promise} 发布结果
 */
function publishPost(postData, options = {}) {
    if (!postData) {
        return Promise.reject(new Error('帖子数据不能为空'));
    }

    const requiredFields = ['content'];
    for (const field of requiredFields) {
        if (!postData[field] || !postData[field].trim()) {
            return Promise.reject(new Error(`${field}不能为空`));
        }
    }

    // 如果是非原创诗歌，必须提供作者
    if (postData.publishMode === 'poem' && !postData.isOriginal && (!postData.author || !postData.author.trim())) {
        return Promise.reject(new Error('非原创诗歌必须提供作者信息'));
    }

    return cloudCall('submitPost', postData, Object.assign({
        pageTag: 'add',
        requireAuth: true,
        ...options
    }));
}

module.exports = {
    checkDuplicatePoem,
    contentAudit,
    uploadFile,
    saveDraft,
    getDrafts,
    deleteDraft,
    publishPost
};