/**
 * 作品集相关工具函数
 */

/**
 * 验证作品集名称
 * @param {string} folderName - 文件夹名称
 * @returns {Object} 验证结果 { isValid: boolean, message: string }
 */
function validateFolderName(folderName) {
    if (!folderName || !folderName.trim()) {
        return {
            isValid: false,
            message: '文件夹名称不能为空'
        };
    }

    const trimmedName = folderName.trim();

    if (trimmedName.length > 50) {
        return {
            isValid: false,
            message: '文件夹名称不能超过50字'
        };
    }

    // 检查是否包含特殊字符
    const invalidChars = /[<>:"/\\|?*]/;
    if (invalidChars.test(trimmedName)) {
        return {
            isValid: false,
            message: '文件夹名称不能包含特殊字符 < > : " / \\ | ? *'
        };
    }

    return {
        isValid: true,
        message: ''
    };
}

/**
 * 生成作品集封面图片的云端路径
 * @param {string} userId - 用户ID
 * @param {string} fileName - 文件名
 * @returns {string} 云端路径
 */
function generateCoverCloudPath(userId, fileName) {
    const timestamp = Date.now();
    const randomSuffix = Math.random().toString(36).substring(2, 8);
    const extension = fileName.includes('.') ? fileName.split('.').pop() : 'jpg';

    return `portfolio/covers/${userId}_${timestamp}_${randomSuffix}.${extension}`;
}

/**
 * 生成文件上传的云端路径
 * @param {string} userId - 用户ID
 * @param {string} fileName - 文件名
 * @param {string} folder - 文件夹类型
 * @returns {string} 云端路径
 */
function generateUploadCloudPath(userId, fileName, folder = 'portfolio') {
    const timestamp = Date.now();
    const randomSuffix = Math.random().toString(36).substring(2, 8);
    const extension = fileName.includes('.') ? fileName.split('.').pop() : 'jpg';

    return `${folder}/${userId}_${timestamp}_${randomSuffix}.${extension}`;
}

/**
 * 处理作品集数据，添加必要的UI属性
 * @param {Array} folders - 原始作品集数据
 * @returns {Array} 处理后的作品集数据
 */
function getFolderCount(folder = {}) {
    return Number(
        folder.itemCount !== undefined && folder.itemCount !== null
            ? folder.itemCount
            : folder.postCount
    ) || 0;
}

function processPortfolioFolders(folders) {
    if (!Array.isArray(folders)) {
        return [];
    }

    return folders.map(folder => {
        const count = getFolderCount(folder);
        return {
            ...folder,
            displayName: folder.name || '未命名作品集',
            itemCount: count,
            postCount: count,
            createdAt: folder.createTime || Date.now(),
            updatedAt: folder.updateTime || folder.createTime || Date.now(),
            coverUrl: folder.coverUrl || '',
            isDefault: folder.isDefault || false,
            // 添加UI相关属性
            formattedCreateTime: formatDate(folder.createTime),
            formattedUpdateTime: formatDate(folder.updateTime || folder.createTime)
        };
    });
}

/**
 * 格式化日期
 * @param {number|Date} date - 日期
 * @returns {string} 格式化后的日期字符串
 */
function formatDate(date) {
    if (!date) return '';

    const d = new Date(date);
    if (isNaN(d.getTime())) return '';

    const now = new Date();
    const diffTime = now.getTime() - d.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
        const diffHours = Math.floor(diffTime / (1000 * 60 * 60));
        if (diffHours === 0) {
            const diffMinutes = Math.floor(diffTime / (1000 * 60));
            return diffMinutes === 0 ? '刚刚' : `${diffMinutes}分钟前`;
        }
        return `${diffHours}小时前`;
    } else if (diffDays === 1) {
        return '昨天';
    } else if (diffDays < 7) {
        return `${diffDays}天前`;
    } else if (diffDays < 30) {
        const weeks = Math.floor(diffDays / 7);
        return `${weeks}周前`;
    } else if (diffDays < 365) {
        const months = Math.floor(diffDays / 30);
        return `${months}个月前`;
    } else {
        const years = Math.floor(diffDays / 365);
        return `${years}年前`;
    }
}

/**
 * 检查文件类型
 * @param {string} fileName - 文件名
 * @returns {string} 文件类型
 */
function getFileType(fileName) {
    if (!fileName) return 'unknown';

    const extension = fileName.split('.').pop().toLowerCase();

    const imageTypes = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'];
    const videoTypes = ['mp4', 'mov', 'avi', 'mkv', 'webm'];
    const audioTypes = ['mp3', 'wav', 'aac', 'flac', 'ogg'];

    if (imageTypes.includes(extension)) return 'image';
    if (videoTypes.includes(extension)) return 'video';
    if (audioTypes.includes(extension)) return 'audio';

    return 'other';
}

/**
 * 压缩图片（如果有必要）
 * @param {string} filePath - 文件路径
 * @param {number} maxSize - 最大尺寸（KB）
 * @param {number} quality - 压缩质量 (0-100)
 * @returns {Promise} 压缩后的文件路径
 */
function compressImageIfNeeded(filePath, maxSize = 2048, quality = 80) {
    return new Promise((resolve, reject) => {
        // 获取文件信息
        uni.getFileInfo({
            filePath: filePath,
            success: (res) => {
                const fileSizeKB = res.size / 1024;

                // 如果文件小于指定大小，直接返回原路径
                if (fileSizeKB <= maxSize) {
                    resolve(filePath);
                    return;
                }

                // 需要压缩
                uni.compressImage({
                    src: filePath,
                    quality: quality,
                    success: (compressRes) => {
                        resolve(compressRes.tempFilePath);
                    },
                    fail: (err) => {
                        console.error('图片压缩失败:', err);
                        // 压缩失败，返回原路径
                        resolve(filePath);
                    }
                });
            },
            fail: (err) => {
                console.error('获取文件信息失败:', err);
                reject(err);
            }
        });
    });
}

/**
 * 创建作品集的默认数据结构
 * @param {string} name - 作品名称
 * @param {string} coverUrl - 封面URL
 * @returns {Object} 默认作品集数据
 */
function createDefaultPortfolioData(name, coverUrl = '') {
    return {
        name: name || '新作品集',
        coverUrl: coverUrl,
        itemCount: 0,
        postCount: 0,
        isDefault: false,
        createTime: Date.now(),
        updateTime: Date.now(),
        description: ''
    };
}

/**
 * 检查是否可以删除作品集
 * @param {Object} folder - 作品集数据
 * @returns {Object} 检查结果 { canDelete: boolean, message: string }
 */
function canDeleteFolder(folder) {
    if (!folder) {
        return {
            canDelete: false,
            message: '作品集数据无效'
        };
    }

    if (folder.isDefault) {
        return {
            canDelete: false,
            message: '默认作品集不能删除'
        };
    }

    const count = getFolderCount(folder);

    if (count > 0) {
        return {
            canDelete: true,
            message: `删除后将同时删除作品集中的 ${count} 个帖子`
        };
    }

    return {
        canDelete: true,
        message: '确定要删除这个作品集吗？'
    };
}

module.exports = {
    validateFolderName,
    generateCoverCloudPath,
    generateUploadCloudPath,
    processPortfolioFolders,
    formatDate,
    getFileType,
    compressImageIfNeeded,
    createDefaultPortfolioData,
    canDeleteFolder
};
