/**
 * 导航工具函数
 * 提供页面间导航的通用逻辑
 */

/**
 * 跳转到标签筛选页面
 * @param {string} tag - 标签名称
 * @param {Function} onSuccess - 成功回调
 * @param {Function} onFail - 失败回调
 */
export function navigateToTagFilter(tag, onSuccess, onFail) {
  console.log('点击标签:', tag);

  // 跳转到标签筛选页面
  uni.navigateTo({
    url: `/pages-tools/tag-filter/tag-filter?tag=${encodeURIComponent(tag)}`,
    success: () => {
      console.log('跳转到标签筛选页面成功');
      onSuccess && onSuccess();
    },
    fail: (err) => {
      console.error('跳转到标签筛选页面失败:', err);
      uni.showToast({
        title: '跳转失败',
        icon: 'none'
      });
      onFail && onFail(err);
    }
  });
}

/**
 * 跳转到帖子详情页面
 * @param {string} postId - 帖子ID
 * @param {Function} onSuccess - 成功回调
 * @param {Function} onFail - 失败回调
 */
export function navigateToPostDetail(postId, onSuccess, onFail) {
  console.log('点击评论，跳转到详情页:', postId);

  uni.navigateTo({
    url: `/pages/post-detail/post-detail?id=${postId}`,
    success: () => {
      console.log('跳转到详情页成功');
      onSuccess && onSuccess();
    },
    fail: (err) => {
      console.error('跳转到详情页失败:', err);
      uni.showToast({
        title: '跳转失败',
        icon: 'none'
      });
      onFail && onFail(err);
    }
  });
}

/**
 * 跳转到用户主页
 * @param {Object} options - 选项
 * @param {string} options.userId - 用户ID
 * @param {string} options.authorName - 作者名称
 * @param {boolean} options.isAnonymous - 是否匿名
 * @param {string} options.currentUserId - 当前用户ID
 * @param {Function} options.onSuccess - 成功回调
 * @param {Function} options.onFail - 失败回调
 */
export function navigateToUserProfile({
  userId,
  authorName = '未知用户',
  isAnonymous = false,
  currentUserId,
  onSuccess,
  onFail
}) {
  console.log('【头像点击】提取的信息:', { userId, authorName, isAnonymous, currentUserId });

  // 检查是否为匿名帖子
  if (isAnonymous || (authorName === '匿名用户' && userId.includes('anonymous'))) {
    console.log('【头像点击】匿名帖子，不跳转');
    uni.showToast({
      title: '匿名用户无法查看主页',
      icon: 'none'
    });
    return;
  }

  if (!userId) {
    console.error('【头像点击】userId为空');
    uni.showToast({
      title: '用户信息获取失败',
      icon: 'none'
    });
    return;
  }

  // 检查是否点击的是自己的头像
  if (userId === currentUserId) {
    console.log('【头像点击】点击的是自己头像，切换到我的页面');
    uni.switchTab({
      url: '/pages/profile/profile',
      success: function () {
        console.log('【头像点击】切换到我的页面成功');
        onSuccess && onSuccess();
      },
      fail: function (err) {
        console.error('【头像点击】切换到我的页面失败:', err);
        uni.showToast({
          title: '页面跳转失败',
          icon: 'none'
        });
        onFail && onFail(err);
      }
    });
  } else {
    console.log('【头像点击】点击的是他人头像，跳转到用户主页');
    uni.navigateTo({
      url: `/pages-user/user-profile/user-profile?userId=${encodeURIComponent(userId)}`,
      success: function () {
        console.log('【头像点击】跳转成功');
        onSuccess && onSuccess();
      },
      fail: function (err) {
        console.error('【头像点击】跳转失败:', err);
        uni.showToast({
          title: '跳转失败',
          icon: 'none'
        });
        onFail && onFail(err);
      }
    });
  }
}

/**
 * 从事件对象中安全提取dataset信息
 * @param {Object} e - 事件对象
 * @returns {Object} dataset信息
 */
export function extractDataset(e) {
  const currentTarget = e.currentTarget || e.target || {};
  return currentTarget.dataset || {};
}