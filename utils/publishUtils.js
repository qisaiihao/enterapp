/**
 * 发布内容工具函数
 */

/**
 * 验证发布数据
 * @param {Object} publishData - 发布数据
 * @param {string} publishData.title - 标题
 * @param {string} publishData.content - 内容
 * @param {string} publishData.author - 作者（非原创诗歌）
 * @param {string} publishData.publishMode - 发布模式
 * @param {boolean} publishData.isOriginal - 是否原创
 * @param {Array} publishData.images - 图片列表
 * @returns {Object} 验证结果 { isValid: boolean, message: string }
 */
function validatePublishData(publishData) {
    if (!publishData) {
        return {
            isValid: false,
            message: '发布数据不能为空'
        };
    }

    const { title, content, author, publishMode, isOriginal, images } = publishData;

    // 检查是否有内容或图片
    const hasContent = content && content.trim().length > 0;
    const hasImages = images && images.length > 0;

    if (!hasContent && !hasImages) {
        return {
            isValid: false,
            message: '请输入内容或添加图片'
        };
    }

    // 检查标题长度（如果有）
    if (title && title.trim().length > 100) {
        return {
            isValid: false,
            message: '标题不能超过100字'
        };
    }

    // 检查内容长度
    if (content && content.length > 5000) {
        return {
            isValid: false,
            message: '内容不能超过5000字'
        };
    }

    // 如果是非原创诗歌，必须填写作者
    if (publishMode === 'poem' && !isOriginal) {
        if (!author || !author.trim()) {
            return {
                isValid: false,
                message: '非原创诗歌必须填写作者'
            };
        }
        if (author.trim().length > 50) {
            return {
                isValid: false,
                message: '作者名称不能超过50字'
            };
        }
    }

    // 检查图片数量
    if (images && images.length > 9) {
        return {
            isValid: false,
            message: '最多只能上传9张图片'
        };
    }

    return {
        isValid: true,
        message: ''
    };
}

/**
 * 检查是否可以发布
 * @param {Object} data - 数据对象
 * @param {string} data.content - 内容
 * @param {Array} data.images - 图片列表
 * @param {string} data.publishMode - 发布模式
 * @param {boolean} data.isOriginal - 是否原创
 * @param {string} data.author - 作者
 * @returns {boolean} 是否可以发布
 */
function canPublish(data) {
    const hasImages = data.images && data.images.length > 0;
    const hasContent = data.content && data.content.trim();
    let canPublish = hasImages || hasContent;

    // 如果是非原创诗歌，必须填写作者
    if (data.publishMode === 'poem' && !data.isOriginal) {
        const hasAuthor = data.author && data.author.trim();
        canPublish = canPublish && hasAuthor;
    }

    return canPublish;
}

/**
 * 生成草稿数据
 * @param {Object} formData - 表单数据
 * @returns {Object} 草稿数据
 */
function generateDraftData(formData) {
    const {
        title,
        content,
        author,
        publishMode,
        isOriginal,
        selectedTags,
        imageList,
        backgroundColor,
        textColor
    } = formData;

    return {
        title: title || '',
        content: content || '',
        author: author || '',
        publishMode: publishMode || 'normal',
        isOriginal: Boolean(isOriginal),
        selectedTags: selectedTags || [],
        imageList: imageList || [],
        backgroundColor: backgroundColor || '',
        textColor: textColor || '',
        timestamp: Date.now()
    };
}

/**
 * 清理草稿数据
 * @param {Object} draftData - 草稿数据
 * @returns {Object} 清理后的数据
 */
function cleanDraftData(draftData) {
    if (!draftData) return null;

    return {
        title: draftData.title || '',
        content: draftData.content || '',
        author: draftData.author || '',
        publishMode: draftData.publishMode || 'normal',
        isOriginal: Boolean(draftData.isOriginal),
        selectedTags: Array.isArray(draftData.selectedTags) ? draftData.selectedTags : [],
        imageList: Array.isArray(draftData.imageList) ? draftData.imageList : [],
        backgroundColor: draftData.backgroundColor || '',
        textColor: draftData.textColor || ''
    };
}

/**
 * 生成帖子发布数据
 * @param {Object} formData - 表单数据
 * @returns {Object} 发布数据
 */
function generatePublishData(formData) {
    const {
        title,
        content,
        author,
        publishMode,
        isOriginal,
        selectedTags,
        imageList,
        backgroundColor
    } = formData;

    const postData = {
        title: (title || '').trim(),
        content: (content || '').trim(),
        publishMode: publishMode || 'normal',
        isOriginal: Boolean(isOriginal),
        tags: Array.isArray(selectedTags) ? selectedTags : [],
        images: Array.isArray(imageList) ? imageList.map(img => img.url || img.path).filter(Boolean) : []
    };

    // 如果是非原创诗歌，添加作者信息
    if (postData.publishMode === 'poem' && !postData.isOriginal && author) {
        postData.author = (author || '').trim();
    }

    // 添加背景色
    if (backgroundColor) {
        postData.backgroundColor = backgroundColor;
    }

    return postData;
}

/**
 * 处理图片上传结果
 * @param {Array} uploadResults - 上传结果数组
 * @returns {Array} 处理后的图片列表
 */
function processUploadResults(uploadResults) {
    if (!Array.isArray(uploadResults)) {
        return [];
    }

    return uploadResults.map((result, index) => {
        return {
            id: result.fileID || `temp_${Date.now()}_${index}`,
            url: result.tempFileURL || result.url || '',
            path: result.tempFileURL || result.url || '',
            order: index
        };
    });
}

module.exports = {
    validatePublishData,
    canPublish,
    generateDraftData,
    cleanDraftData,
    generatePublishData,
    processUploadResults
};