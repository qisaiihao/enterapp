/**
 * TabBar compatibility helpers.
 */

function getTabBarFromPage(pageInstance) {
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

function getCurrentNativePage() {
    try {
        const pages = typeof getCurrentPages === 'function' ? getCurrentPages() : [];
        return pages && pages.length ? pages[pages.length - 1] : null;
    } catch (e) {
        return null;
    }
}

function getNativeTabBar(pageInstance) {
    const candidates = [
        pageInstance,
        pageInstance?.$scope,
        pageInstance?.$mp?.page,
        getCurrentNativePage()
    ];

    for (let i = 0; i < candidates.length; i += 1) {
        const tabBar = getTabBarFromPage(candidates[i]);
        if (tabBar) return tabBar;
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

    let updated = false;

    const tabBar = getNativeTabBar(pageInstance);
    if (tabBar) {
        try {
            if (typeof tabBar.updateSelected === 'function') {
                tabBar.updateSelected(normalizedIndex);
                console.log(`TabBar updated by updateSelected: selected=${normalizedIndex}`);
                updated = true;
            } else if (typeof tabBar.setData === 'function') {
                tabBar.setData({ selected: normalizedIndex });
                console.log(`TabBar updated by setData: selected=${normalizedIndex}`);
                updated = true;
            } else {
                console.warn('TabBar instance has no updateSelected/setData method');
            }
        } catch (e) {
            console.log('Native TabBar update failed:', e.message);
        }
    }

    try {
        const customTabBar = pageInstance?.$refs?.customTabBar;
        if (customTabBar) {
            if (typeof customTabBar.updateSelected === 'function') {
                customTabBar.updateSelected(normalizedIndex);
                console.log(`Custom TabBar ref updated by updateSelected: selected=${normalizedIndex}`);
                updated = true;
            } else if ('selected' in customTabBar) {
                customTabBar.selected = normalizedIndex;
                console.log(`Custom TabBar ref updated by assignment: selected=${normalizedIndex}`);
                updated = true;
            }
        }
    } catch (e) {
        console.log('Custom TabBar ref update failed:', e.message);
    }

    let cached = false;
    try {
        uni.setStorageSync('currentTabIndex', normalizedIndex);
        console.log(`TabBar state cached: selected=${normalizedIndex}`);
        cached = true;
    } catch (e) {
        console.log('TabBar cache fallback unavailable:', e.message);
    }

    return updated || cached;
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
