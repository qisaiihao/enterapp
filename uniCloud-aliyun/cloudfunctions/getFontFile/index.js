'use strict';

const tcb = require('@cloudbase/node-sdk');

// 初始化tcb
const app = tcb.init({
    env: tcb.SYMBOL_CURRENT_ENV
});

// 字体文件配置
const FONT_CONFIG = {
    'Huiwen-mincho': {
        displayName: '汇文明朝',
        filename: '汇文明朝.otf',
        cloudPath: 'fonts/汇文明朝.otf'
    },
    '文楷': {
        displayName: '文楷',
        filename: '文楷.ttf',
        cloudPath: 'fonts/文楷.ttf'
    },
    '龙藏体': {
        displayName: '龙藏体',
        filename: '龙藏体.ttf',
        cloudPath: 'fonts/龙藏体.ttf'
    },
    '小小皓体': {
        displayName: '小小皓体',
        filename: '小小皓体.ttf',
        cloudPath: 'fonts/小小皓体.ttf'
    },
    '南西雅致黑': {
        displayName: '南西雅致黑',
        filename: '南西雅致黑.ttf',
        cloudPath: 'fonts/南西雅致黑.ttf'
    },
    '字体圈欣意吉祥宋': {
        displayName: '字体圈欣意吉祥宋',
        filename: '字体圈欣意吉祥宋.ttf',
        cloudPath: 'fonts/字体圈欣意吉祥宋.ttf'
    }
};

exports.main = async (event, context) => {
    console.log('getFontFile 云函数被调用:', event);
    
    try {
        const { fontFamily, action = 'download' } = event;
        
        if (!fontFamily) {
            return {
                success: false,
                error: 'fontFamily 参数必需'
            };
        }
        
        const config = FONT_CONFIG[fontFamily];
        if (!config) {
            return {
                success: false,
                error: `未知字体: ${fontFamily}`
            };
        }
        
        // 根据action处理不同请求
        if (action === 'getUrl') {
            // 获取临时下载链接
            return await getDownloadUrl(config, fontFamily);
        } else if (action === 'download') {
            // 直接返回字体文件内容（base64）
            return await getFileContent(config, fontFamily);
        } else {
            return {
                success: false,
                error: `不支持的操作: ${action}`
            };
        }
        
    } catch (error) {
        console.error('getFontFile 云函数执行错误:', error);
        return {
            success: false,
            error: error.message || '云函数执行失败'
        };
    }
};

/**
 * 获取字体文件的临时下载链接
 */
async function getDownloadUrl(config, fontFamily) {
    try {
        console.log('获取字体文件下载链接:', config.cloudPath);
        
        // 获取临时下载链接（有效期1小时）
        const result = await app.storage().getTempFileURL([config.cloudPath]);
        
        if (result.fileList && result.fileList.length > 0 && result.fileList[0].tempFileURL) {
            console.log('获取下载链接成功:', fontFamily);
            return {
                success: true,
                downloadUrl: result.fileList[0].tempFileURL,
                fontFamily: fontFamily,
                filename: config.filename
            };
        } else {
            throw new Error('获取下载链接失败');
        }
        
    } catch (error) {
        console.error('获取下载链接失败:', error);
        return {
            success: false,
            error: `获取下载链接失败: ${error.message}`
        };
    }
}

/**
 * 直接获取字体文件内容（适用于小文件）
 */
async function getFileContent(config, fontFamily) {
    try {
        console.log('获取字体文件内容:', config.cloudPath);
        
        // 下载文件内容
        const result = await app.storage().downloadFile({
            fileId: config.cloudPath
        });
        
        if (result.fileContent) {
            console.log('获取文件内容成功:', fontFamily);
            
            // 将Buffer转为base64
            const base64Content = result.fileContent.toString('base64');
            
            return {
                success: true,
                fontFamily: fontFamily,
                filename: config.filename,
                fileContent: base64Content,
                size: result.fileContent.length
            };
        } else {
            throw new Error('文件内容为空');
        }
        
    } catch (error) {
        console.error('获取文件内容失败:', error);
        return {
            success: false,
            error: `获取文件内容失败: ${error.message}`
        };
    }
}
