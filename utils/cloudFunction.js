/**
 * 云函数调用工具
 * 兼容H5和小程序环境
 */

/**
 * 调用云函数
 * @param {string} name 云函数名称
 * @param {object} data 云函数参数
 * @returns {Promise} 返回Promise对象
 */
function callCloudFunction(name, data = {}) {
    console.log(`🔍 [CloudFunction] 调用云函数: ${name}`, data);
    
    return new Promise((resolve, reject) => {
        // 检查运行环境
        const isH5 = typeof window !== 'undefined';
        const isMiniProgram = typeof wx !== 'undefined';
        
        console.log(`🔍 [CloudFunction] 运行环境检测 - H5: ${isH5}, 小程序: ${isMiniProgram}`);
        
        if (isH5) {
            // H5环境使用TCB
            if (typeof getApp !== 'undefined' && getApp().$tcb && getApp().$tcb.callFunction) {
                console.log(`🔍 [CloudFunction] 使用TCB调用云函数: ${name}`);
                getApp().$tcb.callFunction({
                    name: name,
                    data: data
                }).then(resolve).catch(reject);
            } else {
                console.error(`❌ [CloudFunction] H5环境TCB不可用`);
                reject(new Error('TCB实例不可用'));
            }
        } else if (isMiniProgram) {
            // 小程序环境使用微信云开发
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
            console.error(`❌ [CloudFunction] 未知运行环境`);
            reject(new Error('未知运行环境'));
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
        // 检查运行环境
        const isH5 = typeof window !== 'undefined';
        const isMiniProgram = typeof wx !== 'undefined';
        
        console.log(`🔍 [CloudFunction] Vue组件运行环境检测 - H5: ${isH5}, 小程序: ${isMiniProgram}`);
        
        if (isH5) {
            // H5环境使用TCB
            if (this.$tcb && this.$tcb.callFunction) {
                console.log(`🔍 [CloudFunction] Vue组件使用TCB调用云函数: ${name}`);
                this.$tcb.callFunction({
                    name: name,
                    data: data
                }).then(resolve).catch(reject);
            } else {
                console.error(`❌ [CloudFunction] Vue组件H5环境TCB不可用`);
                reject(new Error('TCB实例不可用'));
            }
        } else if (isMiniProgram) {
            // 小程序环境使用微信云开发
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
            console.error(`❌ [CloudFunction] Vue组件未知运行环境`);
            reject(new Error('未知运行环境'));
        }
    });
}

module.exports = {
    callCloudFunction,
    callCloudFunctionInVue
};
