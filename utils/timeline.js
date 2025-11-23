/**
 * 时间轴相关工具函数
 */

/**
 * 按月份分组帖子
 * @param {Array} posts - 帖子列表
 * @returns {Object} 按月份分组的帖子对象
 */
export function groupPostsByMonth(posts) {
  const groups = {};
  if (!Array.isArray(posts)) return groups;

  posts.forEach(post => {
    if (!post.createTime) return;

    try {
      const date = new Date(post.createTime);
      if (isNaN(date.getTime())) return;

      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      if (!groups[monthKey]) {
        groups[monthKey] = [];
      }
      groups[monthKey].push(post);
    } catch (error) {
      console.warn('【timeline】处理帖子时间失败:', error, post);
    }
  });

  return groups;
}

/**
 * 处理时间轴帖子的日期显示
 * @param {Array} posts - 帖子列表
 * @returns {Array} 处理后的帖子列表
 */
export function processPostsForTimeline(posts) {
  if (!Array.isArray(posts) || posts.length === 0) return [];

  try {
    // 按日期排序（最新的在前）
    const sortedPosts = posts.sort((a, b) => {
      const timeA = new Date(a.createTime).getTime();
      const timeB = new Date(b.createTime).getTime();
      return timeB - timeA;
    });

    // 处理同一天帖子的日期显示
    const processedPosts = [];
    let lastDate = null;

    sortedPosts.forEach(post => {
      try {
        const postDate = new Date(post.createTime);
        if (isNaN(postDate.getTime())) return;

        const dateStr = `${postDate.getFullYear()}-${String(postDate.getMonth() + 1).padStart(2, '0')}-${String(postDate.getDate()).padStart(2, '0')}`;

        // 如果是同一天，不显示日期
        const showDate = lastDate !== dateStr;
        lastDate = dateStr;

        processedPosts.push({
          ...post,
          showDate: showDate,
          dateStr: dateStr
        });
      } catch (error) {
        console.warn('【timeline】处理单个帖子失败:', error, post);
      }
    });

    return processedPosts;
  } catch (error) {
    console.error('【timeline】处理帖子列表失败:', error);
    return posts;
  }
}

/**
 * 格式化日期标签（只显示日子）
 * @param {string} dateKey - 日期字符串 (yyyy-MM-dd)
 * @returns {string} 格式化后的日期标签
 */
export function formatDateLabel(dateKey) {
  if (!dateKey || typeof dateKey !== 'string') return '';

  try {
    const parts = dateKey.split('-');
    if (parts.length >= 3) {
      return `${parts[2]}日`;
    }
    return dateKey;
  } catch (error) {
    console.warn('【timeline】格式化日期标签失败:', error, dateKey);
    return dateKey;
  }
}

/**
 * 格式化月份标签
 * @param {string} monthKey - 月份字符串 (yyyy-MM)
 * @returns {string} 格式化后的月份标签
 */
export function formatMonthLabel(monthKey) {
  if (!monthKey || typeof monthKey !== 'string') return '';

  try {
    const parts = monthKey.split('-');
    if (parts.length >= 2) {
      const year = parts[0];
      const month = parseInt(parts[1], 10);
      return `${year}年${month}月`;
    }
    return monthKey;
  } catch (error) {
    console.warn('【timeline】格式化月份标签失败:', error, monthKey);
    return monthKey;
  }
}

/**
 * 切换月份折叠状态
 * @param {Object} collapsedMonths - 当前折叠状态对象
 * @param {string} monthKey - 月份键
 * @returns {Object} 新的折叠状态对象
 */
export function toggleMonthCollapse(collapsedMonths, monthKey) {
  if (!monthKey || typeof monthKey !== 'string') {
    return collapsedMonths || {};
  }

  const newCollapsed = { ...(collapsedMonths || {}) };
  if (newCollapsed[monthKey]) {
    delete newCollapsed[monthKey];
  } else {
    newCollapsed[monthKey] = true;
  }

  return newCollapsed;
}