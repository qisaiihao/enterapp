'use strict';
/**
 * 自定义 WGT 热更新检查云函数
 * 查询 opendb-app-versions 数据库
 * 
 * 返回条件：
 * 1. stable_publish === true
 * 2. type === 'wgt'
 * 3. uni_platform 匹配当前平台
 * 4. 客户端 wgtVersion >= min_uni_version（满足最低版本要求）
 * 5. 云端 version > 客户端 wgtVersion（有新版本）
 */

/**
 * 比较两个语义化版本号
 * @param {string} v1 版本1
 * @param {string} v2 版本2
 * @returns {number} 1: v1 > v2, -1: v1 < v2, 0: v1 === v2
 */
function compareVersion(v1, v2) {
    if (!v1 || !v2) return 0;
    
    const parts1 = String(v1).split('.').map(n => parseInt(n, 10) || 0);
    const parts2 = String(v2).split('.').map(n => parseInt(n, 10) || 0);
    
    const maxLen = Math.max(parts1.length, parts2.length);
    
    for (let i = 0; i < maxLen; i++) {
        const num1 = parts1[i] || 0;
        const num2 = parts2[i] || 0;
        
        if (num1 > num2) return 1;
        if (num1 < num2) return -1;
    }
    
    return 0;
}

exports.main = async (event, context) => {
    console.log('📱 [checkWgtUpdate] ======== 云函数开始执行 ========');
    console.log('📱 [checkWgtUpdate] 收到的完整 event:', JSON.stringify(event, null, 2));
    
    const db = uniCloud.database();
    const appVersionDBName = 'opendb-app-versions';
    
    const { appid, wgtVersion, platform } = event;
    
    console.log('📱 [checkWgtUpdate] 解析后的参数:');
    console.log('  - appid:', appid);
    console.log('  - wgtVersion (客户端版本):', wgtVersion);
    console.log('  - platform:', platform);
    
    // 参数校验
    if (!appid) {
        return {
            code: -1,
            message: '缺少 appid 参数'
        };
    }
    
    if (!wgtVersion) {
        return {
            code: -2,
            message: '缺少 wgtVersion 参数'
        };
    }
    
    if (!platform) {
        return {
            code: -3,
            message: '缺少 platform 参数'
        };
    }
    
    try {
        // 查询数据库：获取最新的稳定版 wgt 包
        // 条件：stable_publish=true, type=wgt, uni_platform 匹配
        const queryCondition = {
            appid: appid,
            type: 'wgt',
            stable_publish: true,
            uni_platform: platform.toLowerCase() // android 或 ios
        };
        console.log('📱 [checkWgtUpdate] 数据库查询条件:', JSON.stringify(queryCondition, null, 2));
        
        const queryResult = await db.collection(appVersionDBName)
            .where(queryCondition)
            .orderBy('create_date', 'desc')
            .limit(1)
            .get();
        
        console.log('📱 [checkWgtUpdate] 数据库查询结果:');
        console.log('  - 找到记录数:', queryResult.data ? queryResult.data.length : 0);
        if (queryResult.data && queryResult.data.length > 0) {
            console.log('  - 最新版本记录:', JSON.stringify(queryResult.data[0], null, 2));
        }
        
        if (!queryResult.data || queryResult.data.length === 0) {
            console.log('📱 [checkWgtUpdate] 未找到符合条件的 wgt 包');
            return {
                code: 0,
                message: '当前已是最新版本（未找到可用的 wgt 包）',
                hasUpdate: false
            };
        }
        
        const latestVersion = queryResult.data[0];
        console.log('📱 [checkWgtUpdate] 找到最新版本:', latestVersion);
        
        // 检查 min_uni_version 要求
        // 客户端版本必须 >= min_uni_version 才能安装此 wgt
        if (latestVersion.min_uni_version) {
            const minVersionCheck = compareVersion(wgtVersion, latestVersion.min_uni_version);
            console.log('📱 [checkWgtUpdate] 版本检查: 客户端版本', wgtVersion, 
                minVersionCheck >= 0 ? '>=' : '<', 'min_uni_version', latestVersion.min_uni_version);
            
            if (minVersionCheck < 0) {
                // 客户端版本低于最低要求，不能安装此 wgt
                return {
                    code: -10,
                    message: `当前版本 ${wgtVersion} 低于最低要求 ${latestVersion.min_uni_version}，请先更新原生包`,
                    hasUpdate: false,
                    needNativeUpdate: true,
                    minVersion: latestVersion.min_uni_version
                };
            }
        }
        
        // 检查是否有新版本
        // 云端版本必须 > 客户端版本
        const versionCheck = compareVersion(latestVersion.version, wgtVersion);
        console.log('📱 [checkWgtUpdate] 版本对比: 云端', latestVersion.version, 
            versionCheck > 0 ? '>' : (versionCheck < 0 ? '<' : '==='), '客户端', wgtVersion);
        
        if (versionCheck <= 0) {
            // 已是最新版本
            return {
                code: 0,
                message: '当前已是最新版本',
                hasUpdate: false,
                currentVersion: wgtVersion,
                latestVersion: latestVersion.version
            };
        }
        
        // 有新版本可用
        console.log('🎉 [checkWgtUpdate] ======== 检测到新版本! ========');
        console.log('🎉 [checkWgtUpdate] 客户端版本:', wgtVersion);
        console.log('🎉 [checkWgtUpdate] 服务端版本:', latestVersion.version);
        console.log('🎉 [checkWgtUpdate] 下载地址:', latestVersion.url);
        console.log('🎉 [checkWgtUpdate] 强制更新:', latestVersion.is_mandatory || false);
        console.log('🎉 [checkWgtUpdate] 静默更新:', latestVersion.is_silently || false);
        
        return {
            code: 1,
            message: '发现新版本',
            hasUpdate: true,
            // 版本信息
            version: latestVersion.version,
            currentVersion: wgtVersion,
            // 更新包信息
            url: latestVersion.url,
            // 更新说明
            title: latestVersion.title || '发现新版本',
            contents: latestVersion.contents || '',
            // 更新选项
            is_mandatory: latestVersion.is_mandatory || false,
            is_silently: latestVersion.is_silently || false,
            // 其他信息
            _id: latestVersion._id,
            create_date: latestVersion.create_date
        };
        
    } catch (error) {
        console.error('❌ [checkWgtUpdate] 查询失败:', error);
        return {
            code: -100,
            message: '查询更新失败: ' + (error.message || String(error)),
            hasUpdate: false
        };
    }
};
