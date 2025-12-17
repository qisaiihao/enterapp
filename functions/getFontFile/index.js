// 云函数入口文件 - 获取字体文件
const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

// 字体文件配置 - 只保留三个字体
const FONT_CONFIG = {
    'Huiwen-mincho': {
        displayName: '汇文明朝',
        filename: '汇文明朝.otf',
        cloudPath: 'cloud://cloud1-5gb0pbyl400845f5.636c-cloud1-5gb0pbyl400845f5-1378788263/fonts/汇文明朝-蒲瓜版.ttf'
    },
    '小小皓体': {
        displayName: '小小皓体',
        filename: '小小皓体.ttf',
        cloudPath: 'cloud://cloud1-5gb0pbyl400845f5.636c-cloud1-5gb0pbyl400845f5-1378788263/fonts/小小皓体.ttf'
    },
    '字体圈欣意吉祥宋': {
        displayName: '字体圈欣意吉祥宋',
        filename: '字体圈欣意吉祥宋.ttf',
        cloudPath: 'cloud://cloud1-5gb0pbyl400845f5.636c-cloud1-5gb0pbyl400845f5-1378788263/fonts/字体圈欣意吉祥宋.ttf'
    }
};

/**
 * 获取字体文件云函数
 */
exports.main = async (event, context) => {
    console.log('🔍 [getFontFile] 云函数被调用:', event);
    
    try {
        const { fontFamily, action = 'getUrl' } = event;
        
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
        
        console.log(`🔍 [getFontFile] 处理字体: ${fontFamily}, 操作: ${action}`);
        
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
        console.error('🔍 [getFontFile] 云函数执行错误:', error);
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
        console.log(`🔍 [getFontFile] 获取字体文件下载链接: ${fontFamily}, 路径: ${config.cloudPath}`);
        
        // 获取临时下载链接（有效期1小时）
        const result = await cloud.getTempFileURL({
            fileList: [config.cloudPath]
        });
        
        console.log(`🔍 [getFontFile] getTempFileURL返回结果:`, JSON.stringify(result, null, 2));
        
        if (result.fileList && result.fileList.length > 0) {
            const fileInfo = result.fileList[0];
            
            // 检查是否获取成功
            if (fileInfo.status === 0 && fileInfo.tempFileURL) {
                console.log(`🔍 [getFontFile] ✅ 获取下载链接成功: ${fontFamily}`);
                return {
                    success: true,
                    downloadUrl: fileInfo.tempFileURL,
                    fontFamily: fontFamily,
                    filename: config.filename
                };
            } else {
                console.error(`🔍 [getFontFile] 文件获取失败:`, fileInfo);
                throw new Error(`文件不存在或无权限访问: ${fileInfo.errMsg || '未知错误'}`);
            }
        } else {
            throw new Error('getTempFileURL返回结果为空');
        }
        
    } catch (error) {
        console.error('🔍 [getFontFile] 获取下载链接失败:', error);
        return {
            success: false,
            error: `获取下载链接失败: ${error.message}`
        };
    }
}

/**
 * 直接获取字体文件内容（H5环境base64格式）
 */
async function getFileContent(config, fontFamily) {
    try {
        console.log(`🔍 [getFontFile] 获取字体文件base64内容: ${fontFamily}, 路径: ${config.cloudPath}`);
        
        // 下载文件内容
        const result = await cloud.downloadFile({
            fileID: config.cloudPath
        });
        
        console.log(`🔍 [getFontFile] downloadFile返回结果:`, {
            hasFileContent: !!result.fileContent,
            fileContentType: typeof result.fileContent,
            fileSize: result.fileContent ? result.fileContent.length : 0
        });
        
        if (result.fileContent) {
            console.log(`🔍 [getFontFile] ✅ 获取文件内容成功: ${fontFamily}`);
            
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
        console.error(`🔍 [getFontFile] 获取文件内容失败:`, error);
        return {
            success: false,
            error: `获取文件内容失败: ${error.message}`
        };
    }
}
