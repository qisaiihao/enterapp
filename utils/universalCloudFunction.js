/**
 * 通用云函数调用方法
 * 用于替换所有页面中的旧版云函数调用逻辑
 */

const { getCurrentPlatform, getCloudFunctionMethod, logPlatformInfo } = require('./platformDetector.js');
const { debugEnvironmentDetection, testCloudFunctionCapability } = require('./debugPlatform.js');

/**
 * 通用云函数调用方法
 * @param {string} name 云函数名称
 * @param {object} data 云函数参数
 * @param {object} context Vue组件上下文（this）
 * @param {string} pageName 页面名称（用于日志）
 * @returns {Promise} 返回Promise对象
 */
function callCloudFunction(name, data = {}, context = null, pageName = '页面') {
    console.log(`🔍 [${pageName}] 调用云函数: ${name}`, data);
    
    return new Promise((resolve, reject) => {
        // 详细的环境检测调试
        debugEnvironmentDetection();
        
        const platform = getCurrentPlatform();
        const method = getCloudFunctionMethod();
        const capability = testCloudFunctionCapability();
        
        console.log(`🔍 [${pageName}] 运行环境: ${platform}, 调用方式: ${method}, 实际能力: ${capability}`);
        
        // 打印详细的平台信息（调试用）
        logPlatformInfo();
        
        // 如果检测到的调用方式与实际能力不匹配，使用实际能力
        const actualMethod = capability !== 'none' ? capability : method;
        console.log(`🔍 [${pageName}] 最终使用调用方式: ${actualMethod}`);
        
        if (actualMethod === 'tcb') {
            // 使用TCB调用云函数（H5和App环境）
            if (context && context.$tcb && context.$tcb.callFunction) {
                console.log(`🔍 [${pageName}] 使用TCB调用云函数: ${name} (环境: ${platform})`);
                context.$tcb.callFunction({
                    name: name,
                    data: data
                }).then(resolve).catch(reject);
            } else {
                console.error(`❌ [${pageName}] ${platform}环境TCB不可用`);
                console.error(`❌ [${pageName}] context:`, !!context);
                console.error(`❌ [${pageName}] context.$tcb:`, context ? context.$tcb : 'undefined');
                console.error(`❌ [${pageName}] context.$tcb.callFunction:`, context ? typeof (context.$tcb && context.$tcb.callFunction) : 'undefined');
                reject(new Error('TCB实例不可用'));
            }
        } else if (actualMethod === 'wx-cloud') {
            // 使用微信云开发调用云函数（小程序环境）
            if (wx.cloud && wx.cloud.callFunction) {
                console.log(`🔍 [${pageName}] 使用微信云开发调用云函数: ${name}`);
                wx.cloud.callFunction({
                    name: name,
                    data: data,
                    success: (res) => {
                        console.log(`✅ [${pageName}] 云函数调用成功: ${name}`, res);
                        resolve(res);
                    },
                    fail: (err) => {
                        console.error(`❌ [${pageName}] 云函数调用失败: ${name}`, err);
                        reject(err);
                    }
                });
            } else {
                console.error(`❌ [${pageName}] 小程序环境微信云开发不可用`);
                console.error(`❌ [${pageName}] wx.cloud:`, typeof wx.cloud);
                console.error(`❌ [${pageName}] wx.cloud.callFunction:`, typeof (wx.cloud && wx.cloud.callFunction));
                reject(new Error('微信云开发不可用'));
            }
        } else {
            console.error(`❌ [${pageName}] 不支持的云函数调用方式: ${actualMethod}`);
            reject(new Error(`不支持的云函数调用方式: ${actualMethod}`));
        }
    });
}

/**
 * 为Vue组件创建云函数调用方法
 * @param {string} pageName 页面名称
 * @returns {function} 云函数调用方法
 */
function createCloudFunctionMethod(pageName) {
    return function(name, data = {}) {
        return callCloudFunction(name, data, this, pageName);
    };
}

module.exports = {
    callCloudFunction,
    createCloudFunctionMethod
};
