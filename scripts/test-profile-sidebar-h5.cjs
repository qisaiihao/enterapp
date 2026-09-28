const assert = require('node:assert/strict');
const puppeteer = require('puppeteer-core');

async function main() {
    const browser = await puppeteer.launch({
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe',
        headless: true
    });
    try {
        const page = await browser.newPage();
        await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
        await page.goto((process.env.H5_URL || 'http://127.0.0.1:8081/') + '#/pages/login/login', { waitUntil: 'networkidle2' });
        await page.waitForFunction(() => typeof getCurrentPages === 'function' && getCurrentPages().at(-1)?.$vm);
        await page.evaluate(async () => {
            const source = await (await fetch('/components/overlay/AppActionSheet.vue')).text();
            const { h, render, nextTick } = await import(source.match(/from "([^"\n]*vue\.runtime\.esm\.js[^"\n]*)"/)[1]);
            const original = (await import('/pages/profile/profile.vue')).default;
            const sidebar = (await import('/pages/profile/Sidebar.vue')).default;
            const container = document.createElement('div');
            container.id = 'profile-sidebar-review';
            document.body.appendChild(container);
            const context = getCurrentPages().at(-1).$vm.$.appContext;
            window.__sidebarReview = async (admin, background, theme) => {
                render(null, container);
                uni.hideToast();
                uni.setStorageSync('poementerThemeMode', theme);
                uni.$emit('theme:changed', { mode: theme });
                // Keep the real page layout, sidebar, tab bar and confirmation sheet.
                // Stub unrelated content and lifecycle hooks to avoid account/data requests.
                const fixture = { ...original, watch: {}, components: { ...original.components },
                    computed: { ...original.computed,
                        isFullBackground: () => background,
                        isHeaderBackground: () => false
                    },
                    methods: { ...original.methods,
                        performLogout() { throw new Error('The layout test must never log out'); }
                    }
                };
                for (const key of Object.keys(fixture)) {
                    if (/^on[A-Z]/.test(key) || ['created', 'mounted', 'beforeMount', 'beforeUnmount', 'unmounted'].includes(key)) delete fixture[key];
                }
                for (const key of Object.keys(fixture.components)) {
                    if (!['Sidebar', 'AppTabBar', 'AppActionSheet'].includes(key)) fixture.components[key] = { render: () => null };
                }
                fixture.components.Sidebar = { ...sidebar, computed: { ...sidebar.computed, isAdmin: () => admin } };
                const node = h(fixture);
                node.appContext = context;
                render(node, container);
                const vm = node.component.proxy;
                Object.assign(vm, {
                    isLoading: false, hasInitialSnapshot: true, isSidebarOpen: true,
                    userInfo: { nickName: '侧边栏布局检查', avatarUrl: '/static/images/avatar.png' },
                    myPosts: [], currentTab: 'posts'
                });
                await nextTick();
                window.__sidebarVm = vm;
                await Promise.all(container.getAnimations({ subtree: true }).filter(a => a.effect.getTiming().iterations !== Infinity).map(a => a.finished));
            };
        });
        let checked = 0;
        for (const [width, height] of [[320, 568], [390, 844], [844, 390]]) {
            await page.setViewport({ width, height, isMobile: true, hasTouch: true });
            for (const admin of [false, true]) {
                for (const background of [false, true]) {
                    for (const theme of ['light', 'dark']) {
                        await page.evaluate((...args) => window.__sidebarReview(...args), admin, background, theme);
                        const result = await page.$eval('#profile-sidebar-review .sidebar', el => {
                            el.scrollTop = el.scrollHeight;
                            const logout = el.querySelector('.logout-item');
                            const r = logout.getBoundingClientRect();
                            const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
                            const maskHit = document.elementFromPoint(innerWidth - 10, innerHeight - 10);
                            return {
                                reachable: r.top >= 0 && r.bottom <= innerHeight && logout.contains(hit),
                                maskCoversTabBar: !!maskHit?.closest('.sidebar-mask')
                            };
                        });
                        const label = `${width}x${height}, admin=${admin}, background=${background}, ${theme}`;
                        assert.equal(result.reachable, true, `Logout must be reachable: ${label}`);
                        assert.equal(result.maskCoversTabBar, true, `Mask must cover the bottom navigation: ${label}`);
                        await page.click('#profile-sidebar-review .logout-item');
                        await page.waitForFunction(() => !window.__sidebarVm.isSidebarOpen && window.__sidebarVm.isLogoutConfirmVisible);
                        // Cancel, without invoking the destructive logout action.
                        await page.waitForSelector('#profile-sidebar-review .app-sheet-cancel');
                        await page.$eval('#profile-sidebar-review .app-sheet-mask', async el => {
                            await Promise.all(el.getAnimations({ subtree: true }).map(a => a.finished));
                        });
                        await page.click('#profile-sidebar-review .app-sheet-cancel');
                        await page.waitForFunction(() => !window.__sidebarVm.isLogoutConfirmVisible);
                        checked++;
                    }
                }
            }
        }
        console.log(`[test-profile-sidebar-h5] PASS: ${checked} layouts; logout hit testing, navigation mask, confirmation and cancel`);
    } finally {
        await browser.close();
    }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
