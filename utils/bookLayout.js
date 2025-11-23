/**
 * 书籍布局相关工具函数
 */

/**
 * 计算书籍高度
 * @param {string} name - 书籍名称
 * @returns {string} CSS样式字符串
 */
export function calcBookHeight(name) {
  try {
    const min = 120; // 最小高度rpx
    const perChar = 40; // 每个字增加的高度rpx（字体22rpx + 间距18rpx）
    const gap = 24;     // 上下内边距
    const len = (name || '').length;
    let height = min + perChar * (len > 2 ? len - 2 : 0) + gap;

    // 移除最大高度限制，让标题可以完全显示
    return `height: ${height}rpx;`;
  } catch (error) {
    console.warn('【bookLayout】计算书籍高度失败:', error, name);
    return 'height: 120rpx;';
  }
}

/**
 * 生成书籍 spine 文本（垂直排列）
 * @param {string} name - 书籍名称
 * @param {number} maxLength - 最大显示长度
 * @returns {string[]} 字符数组
 */
export function generateSpineText(name, maxLength = 7) {
  try {
    if (!name || typeof name !== 'string') {
      return ['N', 'A', 'M', 'E'];
    }

    const chars = name.split('').slice(0, maxLength);
    return chars.length > 0 ? chars : ['N', 'A', 'M', 'E'];
  } catch (error) {
    console.warn('【bookLayout】生成 spine 文本失败:', error, name);
    return ['N', 'A', 'M', 'E'];
  }
}

/**
 * 获取书籍样式类名
 * @param {number} index - 书籍索引
 * @param {number} total - 书籍总数
 * @returns {string} 样式类名
 */
export function getBookClass(index, total = 5) {
  try {
    const bookIndex = (index % total) + 1;
    return `book-${bookIndex}`;
  } catch (error) {
    console.warn('【bookLayout】获取书籍样式类名失败:', error, index);
    return 'book-1';
  }
}

/**
 * 计算书架线的宽度
 * @param {number} bookCount - 书籍数量
 * @param {number} bookWidth - 单本书籍宽度 (rpx)
 * @param {number} extraWidth - 额外宽度 (rpx)
 * @returns {string} CSS宽度字符串
 */
export function calcShelfLineWidth(bookCount, bookWidth = 72, extraWidth = 50) {
  try {
    const count = Math.max(bookCount, 1);
    const width = count * bookWidth + extraWidth;
    return `${width}rpx`;
  } catch (error) {
    console.warn('【bookLayout】计算书架线宽度失败:', error, bookCount);
    return '122rpx';
  }
}