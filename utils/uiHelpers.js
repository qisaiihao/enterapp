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

function parseColorValue(value) {
  if (!value) return null;
  const color = String(value).trim();
  const hex = color.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (hex) {
    let raw = hex[1];
    if (raw.length === 3) {
      raw = raw.split('').map(ch => ch + ch).join('');
    }
    return {
      r: parseInt(raw.slice(0, 2), 16),
      g: parseInt(raw.slice(2, 4), 16),
      b: parseInt(raw.slice(4, 6), 16)
    };
  }

  const rgb = color.match(/^rgba?\(([^)]+)\)$/i);
  if (rgb) {
    const parts = rgb[1].split(',').map(part => Number.parseFloat(part.trim()));
    if (parts.length >= 3 && parts.every((part, index) => index >= 3 || Number.isFinite(part))) {
      return { r: parts[0], g: parts[1], b: parts[2] };
    }
  }

  return null;
}

function relativeLuminance(color) {
  const channels = [color.r, color.g, color.b].map((value) => {
    const normalized = Math.max(0, Math.min(255, value)) / 255;
    return normalized <= 0.03928
      ? normalized / 12.92
      : Math.pow((normalized + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function contrastRatio(foreground, background) {
  const first = relativeLuminance(foreground);
  const second = relativeLuminance(background);
  return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
}

function colorToHex(color) {
  const toHex = (value) => {
    const clamped = Math.max(0, Math.min(255, Math.round(value)));
    return clamped.toString(16).padStart(2, '0');
  };

  return `#${toHex(color.r)}${toHex(color.g)}${toHex(color.b)}`;
}

function mixColors(color, target, amount) {
  const ratio = Math.max(0, Math.min(1, amount));
  return {
    r: color.r + (target.r - color.r) * ratio,
    g: color.g + (target.g - color.g) * ratio,
    b: color.b + (target.b - color.b) * ratio
  };
}

export function getThemedCardBackgroundColor(backgroundColor, mode = 'light') {
  if (mode !== 'dark') {
    return backgroundColor;
  }

  const background = parseColorValue(backgroundColor);
  if (!background) {
    return backgroundColor || '#171a20';
  }

  const luminance = relativeLuminance(background);
  const maxChannel = Math.max(background.r, background.g, background.b);
  let mixAmount = 0.08;

  if (luminance > 0.62 || maxChannel > 215) {
    mixAmount = 0.34;
  } else if (luminance > 0.38 || maxChannel > 175) {
    mixAmount = 0.26;
  } else if (luminance > 0.2 || maxChannel > 140) {
    mixAmount = 0.18;
  }

  return colorToHex(mixColors(background, { r: 23, g: 26, b: 32 }, mixAmount));
}

export function getReadableTextColor(backgroundColor, preferredTextColor = '#222', minimumRatio = 4.5) {
  const background = parseColorValue(backgroundColor);
  const preferred = parseColorValue(preferredTextColor);
  if (!background) {
    return preferredTextColor || '#222';
  }

  if (preferred && contrastRatio(preferred, background) >= minimumRatio) {
    return preferredTextColor;
  }

  const darkText = parseColorValue('#111A1B');
  const lightText = parseColorValue('#F8F4EA');
  return contrastRatio(darkText, background) >= contrastRatio(lightText, background)
    ? '#111A1B'
    : '#F8F4EA';
}
