/**
 * 认证辅助工具
 * 提供统一的登录检查和提示功能
 */
import { applyUserInfoWithAppBackground } from '@/utils/appBackground.js';
import { getAppState, getOpenid, patchAppState } from '@/utils/app-state.js';

/**
 * 检查用户是否已登录
 * @returns {boolean} 是否已登录
 */
export function isUserLoggedIn() {
    try {
        const state = getAppState();
        const isLoggedIn = !!state.isLoggedIn;
        
        if (isLoggedIn) {
            return true;
        }
        
        // 检查本地缓存
        const cachedUserInfo = uni.getStorageSync('userInfo');
        if (cachedUserInfo && (cachedUserInfo.poemId || cachedUserInfo._openid)) {
            patchAppState({
                openid: cachedUserInfo._openid || getOpenid(),
                isLoggedIn: true
            });
            applyUserInfoWithAppBackground(cachedUserInfo, {
                emit: false,
                writeStorage: true,
                writeGlobal: true
            }).catch(() => {});
            return true;
        }
        
        return false;
    } catch (error) {
        console.error('检查登录状态失败:', error);
        return false;
    }
}

/**
 * 获取当前用户信息
 * @returns {Object|null} 用户信息对象或null
 */
export function getCurrentUser() {
    try {
        const state = getAppState();
        if (state.userInfo) {
            return state.userInfo;
        }
        
        // 从缓存获取
        const cachedUserInfo = uni.getStorageSync('userInfo');
        if (cachedUserInfo && (cachedUserInfo.poemId || cachedUserInfo._openid)) {
            return cachedUserInfo;
        }
        
        return null;
    } catch (error) {
        console.error('获取用户信息失败:', error);
        return null;
    }
}

/**
 * 要求用户登录的通用方法
 * @param {Object} options 配置选项
 * @param {string} options.title 弹窗标题，默认为"需要登录"
 * @param {string} options.content 弹窗内容，默认为"此操作需要登录，请先登录"
 * @param {string} options.confirmText 确认按钮文字，默认为"去登录"
 * @param {string} options.cancelText 取消按钮文字，默认为"取消"
 * @param {Function} options.onConfirm 确认登录后的回调
 * @param {Function} options.onCancel 取消登录后的回调
 * @returns {Promise<boolean>} 返回Promise，resolve(true)表示用户选择登录，resolve(false)表示取消
 */
export function requireLogin(options = {}) {
    const {
        title = '需要登录',
        content = '此操作需要登录，请先登录',
        confirmText = '去登录',
        cancelText = '取消',
        onConfirm,
        onCancel
    } = options;
    
    return new Promise((resolve) => {
        uni.showModal({
            title,
            content,
            confirmText,
            cancelText,
            success: (res) => {
                if (res.confirm) {
                    // 用户选择登录
                    uni.navigateTo({
                        url: '/pages/login/login'
                    });
                    if (typeof onConfirm === 'function') {
                        onConfirm();
                    }
                    resolve(true);
                } else {
                    // 用户取消
                    if (typeof onCancel === 'function') {
                        onCancel();
                    }
                    resolve(false);
                }
            },
            fail: () => {
                resolve(false);
            }
        });
    });
}

/**
 * 检查登录状态，如果未登录则提示登录
 * @param {Object} options 配置选项，同requireLogin
 * @returns {Promise<boolean>} 返回Promise，resolve(true)表示已登录或用户选择登录，resolve(false)表示未登录且用户取消
 */
export async function checkLoginOrPrompt(options = {}) {
    if (isUserLoggedIn()) {
        return true;
    }
    
    return await requireLogin(options);
}

/**
 * 装饰器函数：为需要登录的方法添加登录检查
 * @param {Function} fn 需要登录的方法
 * @param {Object} options 登录提示选项
 * @returns {Function} 包装后的方法
 */
export function requireLoginDecorator(fn, options = {}) {
    return async function(...args) {
        const isLoggedIn = await checkLoginOrPrompt(options);
        if (isLoggedIn) {
            return fn.apply(this, args);
        }
        return null;
    };
}
