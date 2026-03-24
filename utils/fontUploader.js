/**
 * 字体文件上传到腾讯云存储的工具
 * 用于开发阶段将字体文件上传到云端
 */

// 腾讯云存储配置
const CLOUD_CONFIG = {
    // 需要在腾讯云开发控制台获取
    secretId: 'YOUR_SECRET_ID',
    secretKey: 'YOUR_SECRET_KEY', 
    region: 'ap-shanghai', // 根据实际地域调整
    bucket: 'your-bucket-name', // 存储桶名称
    uploadPath: 'fonts/' // 上传路径前缀
};

/**
 * 上传字体文件到腾讯云存储
 * 注意：这个函数主要用于开发阶段批量上传字体文件
 * 实际生产环境中字体文件应该通过腾讯云控制台或CLI工具上传
 */
async function uploadFontFiles() {
    const fontFiles = [
        {
            localPath: '/static/fonts/Huiwen-mincho-compressed.woff2',
            cloudPath: 'fonts/Huiwen-mincho-compressed.woff2'
        },
        {
            localPath: '/static/fonts/文楷.ttf',
            cloudPath: 'fonts/文楷.ttf'
        },
        {
            localPath: '/static/fonts/蒲瓜正楷体.ttf',
            cloudPath: 'fonts/蒲瓜正楷体.ttf'
        },
        {
            localPath: '/static/fonts/龙藏体.ttf',
            cloudPath: 'fonts/龙藏体.ttf'
        },
        {
            localPath: '/static/fonts/小小皓体.ttf',
            cloudPath: 'fonts/小小皓体.ttf'
        },
        {
            localPath: '/static/fonts/南西雅致黑.ttf',
            cloudPath: 'fonts/南西雅致黑.ttf'
        },
        {
            localPath: '/static/fonts/字体圈欣意吉祥宋.ttf',
            cloudPath: 'fonts/字体圈欣意吉祥宋.ttf'
        },
        {
            localPath: '/static/fonts/汇文明朝-蒲瓜版.ttf',
            cloudPath: 'fonts/汇文明朝-蒲瓜版.ttf'
        }
    ];

    console.log('开始上传字体文件到腾讯云存储...');
    
    const results = [];
    
    for (const font of fontFiles) {
        try {
            console.log(`上传字体: ${font.cloudPath}`);
            
            // 这里需要使用腾讯云SDK或云开发API
            // 示例使用云开发存储API
            const result = await uniCloud.uploadFile({
                filePath: font.localPath,
                cloudPath: font.cloudPath
            });
            
            if (result.fileID) {
                console.log(`✅ ${font.cloudPath} 上传成功:`, result.fileID);
                results.push({
                    ...font,
                    success: true,
                    fileID: result.fileID,
                    downloadUrl: result.tempFileURL
                });
            } else {
                throw new Error('上传失败');
            }
            
        } catch (error) {
            console.error(`❌ ${font.cloudPath} 上传失败:`, error);
            results.push({
                ...font,
                success: false,
                error: error.message
            });
        }
        
        // 避免并发过多，添加延迟
        await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    console.log('字体文件上传完成，结果汇总:');
    console.table(results);
    
    return results;
}

/**
 * 生成字体文件的元数据配置
 */
function generateFontMetadata(uploadResults) {
    const metadata = {
        version: '1.0.0',
        updateTime: new Date().toISOString(),
        fonts: {}
    };
    
    uploadResults.forEach(result => {
        if (result.success) {
            const fontName = result.cloudPath.split('/').pop().replace(/\.(ttf|otf|woff|woff2)$/, '');
            metadata.fonts[fontName] = {
                url: result.downloadUrl,
                fileID: result.fileID,
                size: 0, // 需要手动填入文件大小
                version: '1.0.0'
            };
        }
    });
    
    console.log('生成的字体元数据配置:');
    console.log(JSON.stringify(metadata, null, 2));
    
    return metadata;
}

/**
 * 获取字体文件大小
 */
async function getFontFileSize(filePath) {
    try {
        const fs = uni.getFileSystemManager();
        const stats = await new Promise((resolve, reject) => {
            fs.stat({
                path: filePath,
                success: resolve,
                fail: reject
            });
        });
        return stats.size;
    } catch (error) {
        console.warn('获取文件大小失败:', filePath, error);
        return 0;
    }
}

/**
 * 主上传函数 - 在开发环境中调用
 */
async function uploadAllFonts() {
    try {
        console.log('🚀 开始批量上传字体文件...');
        
        // 上传字体文件
        const uploadResults = await uploadFontFiles();
        
        // 生成元数据配置
        const metadata = generateFontMetadata(uploadResults);
        
        // 保存元数据到本地（可选）
        try {
            uni.setStorageSync('font_metadata', metadata);
            console.log('✅ 元数据已保存到本地存储');
        } catch (e) {
            console.warn('保存元数据到本地失败:', e);
        }
        
        const successCount = uploadResults.filter(r => r.success).length;
        const totalCount = uploadResults.length;
        
        uni.showToast({
            title: `上传完成 ${successCount}/${totalCount}`,
            icon: successCount === totalCount ? 'success' : 'none',
            duration: 3000
        });
        
        return {
            success: true,
            uploadResults,
            metadata,
            summary: {
                total: totalCount,
                success: successCount,
                failed: totalCount - successCount
            }
        };
        
    } catch (error) {
        console.error('❌ 字体上传过程出错:', error);
        uni.showToast({
            title: '上传失败: ' + error.message,
            icon: 'none',
            duration: 3000
        });
        
        return {
            success: false,
            error: error.message
        };
    }
}

export {
    uploadFontFiles,
    generateFontMetadata,
    getFontFileSize,
    uploadAllFonts
};
