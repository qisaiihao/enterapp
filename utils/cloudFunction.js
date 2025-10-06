/**
 * 云函数调用工具
 * 兼容H5、小程序和App环境
 */

// 引入平台检测工具
const { getCurrentPlatform, getCloudFunctionMethod, logPlatformInfo } = require('./platformDetector.js');

/**
 * 调用云函数
 * @param {string} name 云函数名称
 * @param {object} data 云函数参数
 * @returns {Promise} 返回Promise对象
 */
function callCloudFunction(name, data = {}) {
    console.log(`🔍 [CloudFunction] 调用云函数: ${name}`, data);
    
    return new Promise((resolve, reject) => {
        const platform = getCurrentPlatform();
        const method = getCloudFunctionMethod();
        
        console.log(`🔍 [CloudFunction] 运行环境: ${platform}, 调用方式: ${method}`);
        
        // 打印详细的平台信息（调试用）
        logPlatformInfo();
        
        if (method === 'tcb') {
            // 使用TCB调用云函数（H5和App环境）
            if (typeof getApp !== 'undefined' && getApp().$tcb && getApp().$tcb.callFunction) {
                console.log(`🔍 [CloudFunction] 使用TCB调用云函数: ${name} (环境: ${platform})`);
                getApp().$tcb.callFunction({
                    name: name,
                    data: data
                }).then(resolve).catch(reject);
            } else {
                console.error(`❌ [CloudFunction] ${platform}环境TCB不可用`);
                reject(new Error('TCB实例不可用'));
            }
        } else if (method === 'wx-cloud') {
            // 使用微信云开发调用云函数（小程序环境）
            if (wx.cloud && wx.cloud.callFunction) {
                console.log(`🔍 [CloudFunction] 使用微信云开发调用云函数: ${name}`);
                wx.cloud.callFunction({
                    name: name,
                    data: data,
                    success: (res) => {
                        console.log(`✅ [CloudFunction] 云函数调用成功: ${name}`, res);
                        resolve(res);
                    },
                    fail: (err) => {
                        console.error(`❌ [CloudFunction] 云函数调用失败: ${name}`, err);
                        reject(err);
                    }
                });
            } else {
                console.error(`❌ [CloudFunction] 小程序环境微信云开发不可用`);
                reject(new Error('微信云开发不可用'));
            }
        } else {
            console.error(`❌ [CloudFunction] 不支持的云函数调用方式: ${method}`);
            reject(new Error(`不支持的云函数调用方式: ${method}`));
        }
    });
}

/**
 * 在Vue组件中使用的云函数调用方法
 * @param {string} name 云函数名称
 * @param {object} data 云函数参数
 * @returns {Promise} 返回Promise对象
 */
function callCloudFunctionInVue(name, data = {}) {
    console.log(`🔍 [CloudFunction] Vue组件调用云函数: ${name}`, data);
    
    return new Promise((resolve, reject) => {
        const platform = getCurrentPlatform();
        const method = getCloudFunctionMethod();
        
        console.log(`🔍 [CloudFunction] Vue组件运行环境: ${platform}, 调用方式: ${method}`);
        
        if (method === 'tcb') {
            // 使用TCB调用云函数（H5和App环境）
            if (this.$tcb && this.$tcb.callFunction) {
                console.log(`🔍 [CloudFunction] Vue组件使用TCB调用云函数: ${name} (环境: ${platform})`);
                this.$tcb.callFunction({
                    name: name,
                    data: data
                }).then(resolve).catch(reject);
            } else {
                console.error(`❌ [CloudFunction] Vue组件${platform}环境TCB不可用`);
                reject(new Error('TCB实例不可用'));
            }
        } else if (method === 'wx-cloud') {
            // 使用微信云开发调用云函数（小程序环境）
            if (wx.cloud && wx.cloud.callFunction) {
                console.log(`🔍 [CloudFunction] Vue组件使用微信云开发调用云函数: ${name}`);
                wx.cloud.callFunction({
                    name: name,
                    data: data,
                    success: (res) => {
                        console.log(`✅ [CloudFunction] Vue组件云函数调用成功: ${name}`, res);
                        resolve(res);
                    },
                    fail: (err) => {
                        console.error(`❌ [CloudFunction] Vue组件云函数调用失败: ${name}`, err);
                        reject(err);
                    }
                });
            } else {
                console.error(`❌ [CloudFunction] Vue组件小程序环境微信云开发不可用`);
                reject(new Error('微信云开发不可用'));
            }
        } else {
            console.error(`❌ [CloudFunction] Vue组件不支持的云函数调用方式: ${method}`);
            reject(new Error(`不支持的云函数调用方式: ${method}`));
        }
    });
}

module.exports = {
    callCloudFunction,
    callCloudFunctionInVue,
    getCurrentPlatform
};
