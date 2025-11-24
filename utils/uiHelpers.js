/**
 * UI相关的工具函数
 * 提供常用的UI操作和样式生成功能
 */

/**
 * 生成随机背景色（避免连续重复）
 * @param {Array} colors - 可用的颜色数组
 * @param {number} lastUsedIndex - 上次使用的颜色索引
 * @returns {Object} 包含新颜色和索引的对象
 */
export function generateRandomBackgroundColor(colors, lastUsedIndex) {
  if (!colors || colors.length === 0) {
    return { color: '#f5f5f5', index: 0 };
  }

  if (lastUsedIndex === -1) {
    const idx = Math.floor(Math.random() * colors.length);
    return { color: colors[idx], index: idx };
  }

  const avail = colors.filter((_, i) => i !== lastUsedIndex);
  const pick = avail[Math.floor(Math.random() * avail.length)];
  const newIndex = colors.indexOf(pick);
  return { color: pick, index: newIndex };
}

/**
 * 切换数组的展开状态
 * @param {Array} array - 要处理的数组
 * @param {number} index - 要切换的索引
 * @returns {Array} 新的数组
 */
export function toggleArrayItemExpansion(array, index) {
  if (!array || index < 0 || index >= array.length) {
    return array;
  }

  const newArray = [...array];
  newArray[index] = {
    ...newArray[index],
    isExpanded: !newArray[index].isExpanded
  };

  return newArray;
}

/**
 * 从列表中提取可用的帖子ID
 * @param {Array} postList - 帖子列表
 * @returns {Array} 过滤后的ID数组
 */
export function extractValidPostIds(postList) {
  if (!Array.isArray(postList)) {
    return [];
  }

  return postList
    .map(p => p && p._id)
    .filter(Boolean);
}

/**
 * 过滤匿名帖子
 * @param {Array} postList - 帖子列表
 * @returns {Array} 过滤后的帖子列表
 */
export function filterAnonymousPosts(postList) {
  if (!Array.isArray(postList)) {
    return [];
  }

  return postList.filter(p => p && !p.isAnonymous);
}

/**
 * 批量更新帖子的UI属性
 * @param {Array} postList - 帖子列表
 * @param {Function} backgroundColorGenerator - 背景色生成函数
 * @param {Object} likeIconUtil - 点赞图标工具
 * @param {string} defaultTextColor - 默认文字颜色
 * @returns {Array} 更新后的帖子列表
 */
export function updatePostsUIProperties(postList, backgroundColorGenerator, likeIconUtil, defaultTextColor = '#222') {
  if (!Array.isArray(postList)) {
    return [];
  }

  return postList.map((post, index) => {
    if (!post) return post;

    // 生成背景色
    const bgResult = backgroundColorGenerator(post.backgroundColor);

    return {
      ...post,
      backgroundColor: post.backgroundColor || bgResult.color,
      textColor: post.textColor || defaultTextColor,
      isExpanded: false,
      authorSignature: post.authorSignature || '',
      likeIcon: likeIconUtil && likeIconUtil.getLikeIcon
        ? likeIconUtil.getLikeIcon(post.votes || 0, !!post.isVoted)
        : ''
    };
  });
}

/**
 * 合并帖子列表（避免重复）
 * @param {Array} existingList - 现有列表
 * @param {Array} newList - 新列表
 * @param {boolean} prepend - 是否将新列表放在前面（用于刷新）
 * @returns {Array} 合并后的列表
 */
export function mergePostLists(existingList, newList, prepend = false) {
  if (!Array.isArray(existingList) || !Array.isArray(newList)) {
    return [];
  }

  const existingIds = new Set(existingList.map(p => p._id).filter(Boolean));
  const uniqueNewPosts = newList.filter(p => p && p._id && !existingIds.has(p._id));

  if (prepend) {
    return [...uniqueNewPosts, ...existingList];
  } else {
    return [...existingList, ...uniqueNewPosts];
  }
}