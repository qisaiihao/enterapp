/**
 * 微信小程序云开发初始化工具
 * 确保 wx.cloud 在使用前已经初始化
 */

let isInitialized = false;

/**
 * 初始化微信云开发
 * @returns {boolean} 是否初始化成功
 */
export function initWxCloud() {
  // 只在微信小程序环境下执行
  if (typeof wx === 'undefined' || !wx.cloud) {
    console.log('[wxCloudInit] 非微信小程序环境或 wx.cloud 不可用');
    return false;
  }

  // 如果已经初始化过，直接返回
  if (isInitialized) {
    console.log('[wxCloudInit] 云开发已初始化，跳过');
    return true;
  }

  try {
    console.log('☁️ [wxCloudInit] 开始初始化云开发...');
    
    wx.cloud.init({
      env: 'cloud1-5gb0pbyl400845f5',
      traceUser: true
    });
    
    isInitialized = true;
    console.log('✅ [wxCloudInit] 云开发初始化完成');
    
    // 挂载到全局
    if (typeof uni !== 'undefined') {
      uni.$wxCloudInitialized = true;
    }
    
    return true;
  } catch (error) {
    console.error('❌ [wxCloudInit] 云开发初始化失败:', error);
    return false;
  }
}

/**
 * 确保云开发已初始化（用于页面 onLoad）
 */
export function ensureWxCloudInit() {
  if (!isInitialized) {
    return initWxCloud();
  }
  return true;
}

/**
 * 检查是否已初始化
 */
export function isWxCloudInitialized() {
  return isInitialized;
}
