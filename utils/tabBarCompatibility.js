/**
 * TabBar 兼容性处理工具
 * 解决 getTabBar() 在不同平台不支持的问题
 */

/**
 * 安全地更新TabBar状态
 * @param {Object} pageInstance - 页面实例
 * @param {number} selectedIndex - 选中的tab索引
 */
export function updateTabBarStatus(pageInstance, selectedIndex) {
    try {
        // 只使用原生getTabBar API
        if (typeof pageInstance.getTabBar === 'function' && pageInstance.getTabBar()) {
            pageInstance.getTabBar().setData({
                selected: selectedIndex
            });
            console.log(`TabBar状态更新成功 (原生API): selected=${selectedIndex}`);
            return true;
        }
    } catch (e) {
        console.log('原生getTabBar API不可用:', e.message);
    }

    // 如果原生API不可用，使用存储机制作为备选
    try {
        uni.setStorageSync('currentTabIndex', selectedIndex);
        console.log(`TabBar状态已保存到存储: selected=${selectedIndex}`);
        return true;
    } catch (e) {
        console.log('存储机制不可用:', e.message);
    }

    console.warn('原生getTabBar API不可用，当前平台可能不支持getTabBar()');
    return false;
}

/**
 * 获取当前TabBar状态
 * @param {Object} pageInstance - 页面实例
 * @returns {number|null} 当前选中的tab索引
 */
export function getCurrentTabBarStatus(pageInstance) {
    try {
        // 方法1：从原生getTabBar获取
        if (typeof pageInstance.getTabBar === 'function' && pageInstance.getTabBar()) {
            const tabBar = pageInstance.getTabBar();
            return tabBar.data?.selected || null;
        }
    } catch (e) {
        console.log('无法从原生getTabBar获取状态');
    }

    try {
        // 方法2：从自定义组件获取
        const tabBar = pageInstance.$refs?.customTabBar;
        if (tabBar && tabBar.data) {
            return tabBar.data.selected || null;
        }
    } catch (e) {
        console.log('无法从自定义组件获取状态');
    }

    try {
        // 方法3：从存储获取
        return uni.getStorageSync('currentTabIndex') || null;
    } catch (e) {
        console.log('无法从存储获取状态');
    }

    return null;
}

/**
 * 检查当前平台是否支持getTabBar
 * @returns {boolean} 是否支持
 */
export function isTabBarSupported() {
    try {
        // 检查是否在小程序环境
        if (typeof wx !== 'undefined' && wx.getTabBar) {
            return true;
        }
        
        // 检查是否有自定义tabBar
        if (typeof uni !== 'undefined' && uni.getTabBar) {
            return true;
        }
        
        return false;
    } catch (e) {
        return false;
    }
}
