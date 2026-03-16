/**
 * 小程序分享工具
 * 提供统一的分享配置方法
 */

/**
 * 获取分享到好友/群聊的配置
 * @param {Object} options - 分享配置选项
 * @param {string} options.title - 分享标题，默认为 'poementer'
 * @param {string} options.path - 分享路径，默认为当前页面路径
 * @param {string} options.imageUrl - 分享图片URL（可选）
 * @returns {Object} 分享配置对象
 */
export function getShareAppMessageConfig(options = {}) {
  const {
    title = 'poementer',
    path,
    imageUrl
  } = options;

  // 如果没有指定路径，使用当前页面路径
  const sharePath = path || getCurrentPagePath();

  const config = {
    title,
    path: sharePath
  };

  if (imageUrl) {
    config.imageUrl = imageUrl;
  }

  return config;
}

/**
 * 获取分享到朋友圈的配置
 * @param {Object} options - 分享配置选项
 * @param {string} options.title - 分享标题，默认为 'poementer'
 * @param {string} options.query - 自定义参数（可选）
 * @param {string} options.imageUrl - 分享图片URL（可选）
 * @returns {Object} 分享配置对象
 */
export function getShareTimelineConfig(options = {}) {
  const {
    title = 'poementer',
    query,
    imageUrl
  } = options;

  const config = {
    title
  };

  if (query) {
    config.query = query;
  }

  if (imageUrl) {
    config.imageUrl = imageUrl;
  }

  return config;
}

/**
 * 获取当前页面路径（包含参数）
 * @returns {string} 当前页面完整路径
 */
function getCurrentPagePath() {
  const pages = getCurrentPages();
  if (pages.length === 0) return '/pages/poem-square/poem-square';
  
  const currentPage = pages[pages.length - 1];
  const route = currentPage.route;
  const options = currentPage.options;
  
  // 构建完整路径
  let path = `/${route}`;
  
  // 添加查询参数
  if (options && Object.keys(options).length > 0) {
    const queryString = Object.keys(options)
      .map(key => `${key}=${options[key]}`)
      .join('&');
    path += `?${queryString}`;
  }
  
  return path;
}

/**
 * 为页面添加分享功能的 mixin
 * 使用方式：在页面的 mixins 中引入
 * 
 * @example
 * import { sharePageMixin } from '@/utils/shareHelper';
 * export default {
 *   mixins: [sharePageMixin()],
 *   // 或自定义配置
 *   mixins: [sharePageMixin({ title: '自定义标题' })]
 * }
 */
export function sharePageMixin(options = {}) {
  return {
    onShareAppMessage(res) {
      return getShareAppMessageConfig(options);
    },
    onShareTimeline() {
      return getShareTimelineConfig(options);
    }
  };
}
