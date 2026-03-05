/**
 * 小程序 index 页面数据调试脚本
 * 
 * 使用方法：
 * 1. 在小程序开发者工具的 Console 中运行此脚本
 * 2. 查看输出的调试信息
 */

// 获取当前页面实例
const pages = getCurrentPages();
const currentPage = pages[pages.length - 1];

console.log('========== Index 页面数据调试 ==========');
console.log('1. 页面路径:', currentPage.route);
console.log('2. 页面数据状态:');
console.log('   - postList 长度:', currentPage.data.postList?.length || 0);
console.log('   - postList 内容:', currentPage.data.postList);
console.log('   - isLoading:', currentPage.data.isLoading);
console.log('   - isLoadingMore:', currentPage.data.isLoadingMore);
console.log('   - hasMore:', currentPage.data.hasMore);
console.log('   - homeHasEverLoaded:', currentPage.data.homeHasEverLoaded);
console.log('   - page:', currentPage.data.page);
console.log('   - currentTab:', currentPage.data.currentTab);
console.log('   - swiperCurrent:', currentPage.data.swiperCurrent);
console.log('   - currentPage:', currentPage.data.currentPage);

console.log('\n3. FeedList 组件接收的 props:');
console.log('   - homeFeedPosts:', currentPage.data.homeFeedPosts);
console.log('   - homeFeedIsLoading:', currentPage.data.homeFeedIsLoading);
console.log('   - homeFeedHasEverLoaded:', currentPage.data.homeFeedHasEverLoaded);

console.log('\n4. 云函数调用状态:');
console.log('   - openid:', currentPage.data.openid);
console.log('   - wx.cloud 是否可用:', typeof wx !== 'undefined' && wx.cloud ? '是' : '否');

console.log('\n5. 建议检查项:');
if (!currentPage.data.postList || currentPage.data.postList.length === 0) {
    console.warn('   ⚠️ postList 为空，可能原因：');
    console.warn('      - 云函数返回数据但未正确设置到 data');
    console.warn('      - getPostList 方法未被调用');
    console.warn('      - 数据处理过程中出错');
}

if (currentPage.data.isLoading) {
    console.warn('   ⚠️ isLoading 为 true，页面可能卡在加载状态');
}

if (!currentPage.data.homeHasEverLoaded) {
    console.warn('   ⚠️ homeHasEverLoaded 为 false，页面认为从未加载过数据');
}

console.log('\n========== 调试信息结束 ==========');
