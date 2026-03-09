/**
 * Mini-program getTabBar shim for uni-app pages.
 * Returns the real custom tabBar instance when available.
 */
export function getTabBar() {
	try {
		if (typeof this?.$mp?.page?.getTabBar === 'function') {
			const tabBar = this.$mp.page.getTabBar();
			if (tabBar) return tabBar;
		}
	} catch (e) {}

	return null;
}
