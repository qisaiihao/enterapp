/**
 * TabBar compatibility helpers.
 */

function getNativeTabBar(pageInstance) {
    try {
        if (typeof pageInstance?.getTabBar === 'function') {
            const tabBar = pageInstance.getTabBar();
            if (tabBar) return tabBar;
        }
    } catch (e) {
        console.log('getTabBar unavailable:', e.message);
    }
    return null;
}

/**
 * Safely update TabBar selected index.
 * @param {Object} pageInstance
 * @param {number} selectedIndex
 * @returns {boolean}
 */
export function updateTabBarStatus(pageInstance, selectedIndex) {
    const normalizedIndex = typeof selectedIndex === 'number'
        ? selectedIndex
        : parseInt(selectedIndex, 10);

    if (Number.isNaN(normalizedIndex)) {
        console.warn('TabBar update ignored: invalid selected index', selectedIndex);
        return false;
    }

    const tabBar = getNativeTabBar(pageInstance);
    if (tabBar) {
        try {
            if (typeof tabBar.updateSelected === 'function') {
                tabBar.updateSelected(normalizedIndex);
                console.log(`TabBar updated by updateSelected: selected=${normalizedIndex}`);
                return true;
            }

            if (typeof tabBar.setData === 'function') {
                tabBar.setData({ selected: normalizedIndex });
                console.log(`TabBar updated by setData: selected=${normalizedIndex}`);
                return true;
            }

            console.warn('TabBar instance has no updateSelected/setData method');
        } catch (e) {
            console.log('Native TabBar update failed:', e.message);
        }
    }

    try {
        uni.setStorageSync('currentTabIndex', normalizedIndex);
        console.log(`TabBar state cached: selected=${normalizedIndex}`);
        return true;
    } catch (e) {
        console.log('TabBar cache fallback unavailable:', e.message);
    }

    return false;
}

/**
 * Read current selected index from tabBar or fallback cache.
 * @param {Object} pageInstance
 * @returns {number|null}
 */
export function getCurrentTabBarStatus(pageInstance) {
    try {
        const tabBar = getNativeTabBar(pageInstance);
        if (tabBar && typeof tabBar.data?.selected === 'number') {
            return tabBar.data.selected;
        }
    } catch (e) {
        console.log('Failed to read tabBar selected state');
    }

    try {
        const cached = uni.getStorageSync('currentTabIndex');
        return typeof cached === 'number' ? cached : null;
    } catch (e) {
        console.log('Failed to read tabBar cache');
    }

    return null;
}

/**
 * Whether current runtime may support custom tabBar APIs.
 * @returns {boolean}
 */
export function isTabBarSupported() {
    try {
        if (typeof wx !== 'undefined' && typeof wx.getTabBar === 'function') {
            return true;
        }

        if (typeof uni !== 'undefined' && typeof uni.getTabBar === 'function') {
            return true;
        }

        return false;
    } catch (e) {
        return false;
    }
}
