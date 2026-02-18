/**
 * 自定义更新工具
 * 
 * 流程：
 * 1. 先调用官方插件检查整包更新 (native_app)
 * 2. 不需要整包更新则检查热更新 (wgt)
 * 3. 弹窗让用户选择是否更新
 * 4. 更新或直接进入
 */

// #ifdef APP-PLUS
import checkOfficialUpdate from '@/uni_modules/uni-upgrade-center-app/utils/check-update';
// #endif

// 固定 appid，与 manifest.json 一致
const APP_ID = '__UNI__E0A1A41';

/**
 * 获取当前 App 版本信息
 * @returns {Promise<{wgtVersion: string, platform: string}>}
 */
function getAppVersionInfo() {
    return new Promise((resolve, reject) => {
        // #ifdef APP-PLUS
        console.log('📱 [hotUpdate] -------- 获取版本信息 --------');
        const systemInfo = uni.getSystemInfoSync();
        const platform = systemInfo.platform; // android 或 ios
        console.log('📱 [hotUpdate] 当前平台:', platform);
        
        const runtimeAppId = plus.runtime.appid;
        console.log('📱 [hotUpdate] plus.runtime.appid:', runtimeAppId);
        if (!runtimeAppId) {
            console.error('❌ [hotUpdate] plus.runtime.appid 为空');
            reject(new Error('plus.runtime.appid 为空'));
            return;
        }
        
        plus.runtime.getProperty(runtimeAppId, (widgetInfo) => {
            console.log('📱 [hotUpdate] widgetInfo 完整信息:', JSON.stringify(widgetInfo, null, 2));
            if (!widgetInfo) {
                console.error('❌ [hotUpdate] 获取版本信息失败');
                reject(new Error('获取版本信息失败'));
                return;
            }
            
            // 获取 wgt 版本号 (如 1.0.0)
            const wgtVersion = widgetInfo.version || '0.0.0';
            
            console.log('📱 [hotUpdate] ====== 本地版本信息汇总 ======');
            console.log('📱 [hotUpdate] wgtVersion (资源版本):', wgtVersion);
            console.log('📱 [hotUpdate] versionCode (整数版本):', widgetInfo.versionCode);
            console.log('📱 [hotUpdate] platform:', platform);
            console.log('📱 [hotUpdate] name:', widgetInfo.name);
            console.log('📱 [hotUpdate] appid:', widgetInfo.appid);
            console.log('📱 [hotUpdate] ================================');
            
            resolve({
                wgtVersion,
                platform
            });
        });
        // #endif
        
        // #ifndef APP-PLUS
        reject(new Error('仅支持 APP-PLUS 环境'));
        // #endif
    });
}

/**
 * 检查 WGT 热更新
 * @returns {Promise<Object>} 更新信息
 */
export async function checkWgtUpdate() {
    console.log('🔍 [hotUpdate] ======== 开始检查 WGT 热更新 ========');
    
    try {
        // 1. 获取本地版本信息
        const { wgtVersion, platform } = await getAppVersionInfo();
        
        // 2. 调用云函数检查更新
        console.log('📱 [hotUpdate] 准备调用云函数 checkWgtUpdate');
        console.log('📱 [hotUpdate] 请求参数:', JSON.stringify({
            appid: APP_ID,
            wgtVersion: wgtVersion,
            platform: platform
        }, null, 2));
        
        const result = await uniCloud.callFunction({
            name: 'checkWgtUpdate',
            data: {
                appid: APP_ID,
                wgtVersion: wgtVersion,
                platform: platform
            }
        });
        
        console.log('📱 [hotUpdate] 云函数返回结果:', JSON.stringify(result.result, null, 2));
        
        if (result.result.hasUpdate) {
            console.log('🎉 [hotUpdate] 发现新版本!');
            console.log('🎉 [hotUpdate] 当前版本:', wgtVersion);
            console.log('🎉 [hotUpdate] 最新版本:', result.result.version);
            console.log('🎉 [hotUpdate] 下载地址:', result.result.url);
        } else {
            console.log('📱 [hotUpdate] 无需更新，原因:', result.result.message);
        }
        
        return result.result;
        
    } catch (error) {
        console.error('❌ [hotUpdate] 检查热更新失败:', error);
        throw error;
    }
}

/**
 * 下载并安装 WGT 包
 * @param {Object} updateInfo 更新信息
 * @param {Object} options 选项
 * @param {Function} options.onProgress 下载进度回调
 * @param {boolean} options.showConfirm 是否显示确认弹窗
 * @returns {Promise<void>}
 */
export async function downloadAndInstallWgt(updateInfo, options = {}) {
    const { onProgress, showConfirm = true } = options;
    
    console.log('📥 [hotUpdate] ======== 开始下载安装流程 ========');
    console.log('📥 [hotUpdate] updateInfo:', JSON.stringify(updateInfo, null, 2));
    
    if (!updateInfo || !updateInfo.url) {
        console.error('❌ [hotUpdate] 无效的更新信息，缺少 url');
        throw new Error('无效的更新信息');
    }
    
    console.log('📥 [hotUpdate] 下载地址:', updateInfo.url);
    console.log('📥 [hotUpdate] 目标版本:', updateInfo.version);
    
    // 如果需要确认，显示弹窗
    if (showConfirm && !updateInfo.is_silently) {
        const confirmResult = await new Promise((resolve) => {
            uni.showModal({
                title: updateInfo.title || '发现新版本',
                content: updateInfo.contents || `新版本 ${updateInfo.version} 已发布，是否立即更新？`,
                showCancel: !updateInfo.is_mandatory, // 强制更新不显示取消按钮
                cancelText: '稍后更新',
                confirmText: '立即更新',
                success: (res) => {
                    resolve(res.confirm);
                },
                fail: () => {
                    resolve(false);
                }
            });
        });
        
        if (!confirmResult) {
            console.log('📱 [hotUpdate] 用户取消更新');
            return { cancelled: true };
        }
    }
    
    // 显示下载进度
    uni.showLoading({
        title: '正在下载更新...',
        mask: true
    });
    
    return new Promise((resolve, reject) => {
        // #ifdef APP-PLUS
        const downloadTask = plus.downloader.createDownload(
            updateInfo.url,
            {
                filename: '_doc/update/',
                timeout: 60 // 超时时间（秒）
            },
            (download, status) => {
                uni.hideLoading();
                
                if (status === 200) {
                    console.log('✅ [hotUpdate] 下载完成:', download.filename);
                    
                    // 安装 WGT 包
                    installWgt(download.filename)
                        .then(resolve)
                        .catch(reject);
                } else {
                    console.error('❌ [hotUpdate] 下载失败，状态码:', status);
                    uni.showToast({
                        title: '下载失败，请稍后重试',
                        icon: 'none'
                    });
                    reject(new Error(`下载失败，状态码: ${status}`));
                }
            }
        );
        
        // 监听下载进度
        downloadTask.addEventListener('statechanged', (task) => {
            if (task.downloadedSize && task.totalSize) {
                const progress = Math.round((task.downloadedSize / task.totalSize) * 100);
                console.log(`📥 [hotUpdate] 下载进度: ${progress}%`);
                
                if (onProgress) {
                    onProgress(progress, task.downloadedSize, task.totalSize);
                }
            }
        });
        
        // 开始下载
        downloadTask.start();
        // #endif
        
        // #ifndef APP-PLUS
        reject(new Error('仅支持 APP-PLUS 环境'));
        // #endif
    });
}

/**
 * 安装 WGT 包
 * @param {string} wgtPath WGT 文件路径
 * @returns {Promise<void>}
 */
function installWgt(wgtPath) {
    console.log('📦 [hotUpdate] ======== 开始安装 WGT 包 ========');
    console.log('📦 [hotUpdate] 文件路径:', wgtPath);
    
    return new Promise((resolve, reject) => {
        // #ifdef APP-PLUS
        plus.runtime.install(
            wgtPath,
            {
                force: false // 不强制安装，如果版本相同则不安装
            },
            () => {
                console.log('✅ [hotUpdate] WGT 安装成功');
                
                uni.showModal({
                    title: '更新完成',
                    content: '应用已更新，需要重启以应用新版本',
                    showCancel: false,
                    confirmText: '立即重启',
                    success: () => {
                        // 重启应用
                        plus.runtime.restart();
                    }
                });
                
                resolve({ success: true });
            },
            (error) => {
                console.error('❌ [hotUpdate] WGT 安装失败:', error);
                uni.showToast({
                    title: '安装失败: ' + (error.message || '未知错误'),
                    icon: 'none'
                });
                reject(error);
            }
        );
        // #endif
        
        // #ifndef APP-PLUS
        reject(new Error('仅支持 APP-PLUS 环境'));
        // #endif
    });
}

/**
 * 完整更新检查流程（推荐使用）
 * 
 * 流程：
 * 1. 检查缓存，如果在缓存时间内则跳过检查
 * 2. 先调用官方插件检查整包更新 (native_app)
 * 3. 不需要整包更新则检查自定义热更新 (wgt)
 * 4. 弹窗让用户选择是否更新
 * 5. 更新或直接进入
 * 
 * @param {Object} options 选项
 * @param {boolean} options.silent 是否静默检查（不显示"已是最新版本"提示）
 * @param {boolean} options.showConfirm 是否显示确认弹窗
 * @param {number} options.cacheTime 缓存时间（毫秒），默认30分钟
 * @returns {Promise<Object>}
 */
export async function checkAndUpdate(options = {}) {
    const { silent = true, showConfirm = true, cacheTime = 30 * 60 * 1000 } = options; // 默认30分钟
    
    console.log('🔍 [hotUpdate] ========== 开始完整更新检查流程 ==========');
    
    // #ifdef APP-PLUS
    try {
        // ============ 第零步：检查缓存 ============
        try {
            const lastCheckTime = uni.getStorageSync('lastUpdateCheckTime');
            const lastCheckResult = uni.getStorageSync('lastUpdateCheckResult');
            
            if (lastCheckTime && lastCheckResult) {
                const now = Date.now();
                const timeSinceLastCheck = now - lastCheckTime;
                
                if (timeSinceLastCheck < cacheTime) {
                    const remainingMinutes = Math.ceil((cacheTime - timeSinceLastCheck) / 60000);
                    console.log(`⏭️ [hotUpdate] 距离上次检查仅 ${Math.floor(timeSinceLastCheck / 60000)} 分钟，跳过本次检查（缓存有效期：${remainingMinutes} 分钟）`);
                    console.log('🔍 [hotUpdate] ========== 使用缓存结果，检查流程结束 ==========');
                    return lastCheckResult;
                }
            }
        } catch (e) {
            console.warn('⚠️ [hotUpdate] 读取缓存失败，继续正常检查:', e);
        }
        
        // ============ 第一步：检查整包更新（官方插件）============
        console.log('📦 [hotUpdate] 第一步：检查整包更新...');
        
        try {
            const officialResult = await checkOfficialUpdate();
            console.log('📦 [hotUpdate] 官方插件返回:', officialResult);
            
            // code > 0 表示有整包更新
            // 注意：官方插件检测到整包更新时会自动弹窗，这里只需要记录
            if (officialResult && officialResult.code > 0 && officialResult.type === 'native_app') {
                console.log('📦 [hotUpdate] 检测到整包更新，官方插件已处理');
                const result = {
                    type: 'native',
                    ...officialResult
                };
                // 有更新时不缓存结果，下次启动继续检查
                return result;
            }
            
            // code === 0 表示已是最新版本，继续检查热更新
            // code < 0 表示出错或未找到版本记录，也继续检查热更新
            console.log('📦 [hotUpdate] 无整包更新 (code=' + (officialResult?.code || 'null') + ')，继续检查热更新...');
            
        } catch (officialError) {
            // 官方插件出错（包括版本格式不匹配），不影响热更新检查
            console.warn('⚠️ [hotUpdate] 官方插件检查失败（忽略，继续热更新检查）:', officialError?.message || officialError);
        }
        
        // ============ 第二步：检查热更新（自定义逻辑）============
        console.log('🔥 [hotUpdate] 第二步：检查热更新...');
        
        const wgtUpdateInfo = await checkWgtUpdate();
        console.log('🔥 [hotUpdate] 热更新检查结果:', wgtUpdateInfo);
        
        let result;
        
        if (wgtUpdateInfo.code === 1 && wgtUpdateInfo.hasUpdate) {
            // 有热更新，下载并安装
            console.log('✅ [hotUpdate] 发现热更新版本:', wgtUpdateInfo.version);
            const installResult = await downloadAndInstallWgt(wgtUpdateInfo, { showConfirm });
            result = {
                type: 'wgt',
                ...installResult
            };
            // 有更新时不缓存结果，下次启动继续检查
            return result;
        } else if (wgtUpdateInfo.code === -10 && wgtUpdateInfo.needNativeUpdate) {
            // 需要更新原生包（热更新的 min_uni_version 要求）
            console.log('⚠️ [hotUpdate] 热更新要求更新原生包');
            if (!silent) {
                uni.showModal({
                    title: '需要更新',
                    content: `当前版本过低，请前往应用商店更新到最新版本`,
                    showCancel: false,
                    confirmText: '知道了'
                });
            }
            result = {
                type: 'need_native',
                ...wgtUpdateInfo
            };
        } else {
            // 已是最新版本
            console.log('📱 [hotUpdate] 当前已是最新版本，无需更新');
            if (!silent) {
                uni.showToast({
                    title: '已是最新版本',
                    icon: 'none'
                });
            }
            result = {
                type: 'latest',
                ...wgtUpdateInfo
            };
        }
        
        // ============ 缓存检查结果 ============
        try {
            uni.setStorageSync('lastUpdateCheckTime', Date.now());
            uni.setStorageSync('lastUpdateCheckResult', result);
            console.log('💾 [hotUpdate] 检查结果已缓存');
        } catch (e) {
            console.warn('⚠️ [hotUpdate] 缓存结果失败:', e);
        }
        
        return result;
        
    } catch (error) {
        console.error('❌ [hotUpdate] 更新流程失败:', error);
        if (!silent) {
            uni.showToast({
                title: '检查更新失败',
                icon: 'none'
            });
        }
        throw error;
    } finally {
        console.log('🔍 [hotUpdate] ========== 更新检查流程结束 ==========');
    }
    // #endif
    
    // #ifndef APP-PLUS
    console.log('📱 [hotUpdate] 非 APP-PLUS 环境，跳过更新检查');
    return { type: 'skip', message: '非 APP-PLUS 环境' };
    // #endif
}

export default {
    checkWgtUpdate,
    downloadAndInstallWgt,
    checkAndUpdate
};
