// 内容审核工具类
// 功能：客户端调用内容审核云函数的封装

import { cloudCall } from './cloudCall.js';
import { getCurrentPlatform } from './platformDetector.js';

const MODERATION_SERVICE_ENABLED = false;
const MODERATION_DISABLED_MESSAGE = '审核服务暂未启用，已跳过审核';

function buildBypassResult(platform) {
  return {
    passed: true,
    message: platform === 'mp-weixin' ? MODERATION_DISABLED_MESSAGE : '审核通过'
  };
}

/**
 * 检查是否需要进行内容审核
 * 只有微信小程序端需要审核，H5和App端跳过
 * @returns {boolean} 是否需要审核
 */
export function shouldModerate() {
  const platform = getCurrentPlatform();
  const needModeration = platform === 'mp-weixin' && MODERATION_SERVICE_ENABLED;
  
  console.log(`🔍 [ContentModeration] 平台: ${platform}, 审核服务可用: ${MODERATION_SERVICE_ENABLED}, 需要审核: ${needModeration}`);
  
  return needModeration;
}

/**
 * 审核文本内容（带平台检测）
 * 只在小程序端执行审核，其他平台直接返回通过
 * @param {string} content - 要审核的文本内容
 * @param {object} options - 可选参数
 * @param {number} options.scene - 场景值（1-资料、2-评论、3-论坛、4-社交日志），默认2
 * @param {string} options.title - 文本标题
 * @param {string} options.nickname - 用户昵称
 * @param {string} options.signature - 个性签名（scene=1时）
 * @returns {Promise<{passed: boolean, message: string}>}
 */
export async function checkTextSafe(content, options = {}) {
  const platform = getCurrentPlatform();
  // 非小程序端直接返回通过
  if (!shouldModerate()) {
    console.log('🔍 [ContentModeration] 当前环境跳过文本审核');
    return buildBypassResult(platform);
  }
  
  return checkText(content, options);
}

/**
 * 审核图片内容（带平台检测）
 * 只在小程序端执行审核，其他平台直接返回通过
 * @param {string} imageUrl - 图片URL
 * @param {object} options - 可选参数
 * @param {number} options.scene - 场景值，默认2
 * @returns {Promise<{passed: boolean, message: string, traceId: string}>}
 */
export async function checkImageSafe(imageUrl, options = {}) {
  const platform = getCurrentPlatform();
  // 非小程序端直接返回通过
  if (!shouldModerate()) {
    console.log('🔍 [ContentModeration] 当前环境跳过图片审核');
    return buildBypassResult(platform);
  }
  
  return checkImage(imageUrl, options);
}

/**
 * 批量审核内容（带平台检测）
 * 只在小程序端执行审核，其他平台直接返回通过
 * @param {object} content - 内容对象
 * @param {string} content.text - 文本内容
 * @param {string[]} content.images - 图片URL数组
 * @param {object} options - 可选参数
 * @param {number} options.scene - 场景值，默认2
 * @param {string} options.title - 文本标题
 * @param {string} options.nickname - 用户昵称
 * @returns {Promise<{passed: boolean, message: string, failedType: string}>}
 */
export async function checkContentSafe(content, options = {}) {
  const platform = getCurrentPlatform();
  // 非小程序端直接返回通过
  if (!shouldModerate()) {
    console.log('🔍 [ContentModeration] 当前环境跳过批量审核');
    return buildBypassResult(platform);
  }
  
  return checkContent(content, options);
}

/**
 * 审核文本内容（内部方法，不带平台检测）
 * @param {string} content - 要审核的文本内容
 * @param {object} options - 可选参数
 * @param {number} options.scene - 场景值（1-资料、2-评论、3-论坛、4-社交日志），默认2
 * @param {string} options.title - 文本标题
 * @param {string} options.nickname - 用户昵称
 * @param {string} options.signature - 个性签名（scene=1时）
 * @returns {Promise<{passed: boolean, message: string}>}
 */
export async function checkText(content, options = {}) {
  console.log('🔍 [ContentModeration] 审核文本内容');
  
  try {
    const response = await cloudCall('contentCheck', {
      type: 'text',
      content: content,
      scene: options.scene || 2,
      title: options.title,
      nickname: options.nickname,
      signature: options.signature
    });
    
    // cloudCall 返回的数据在 result 字段中
    const result = response.result || response;
    
    if (!result.success) {
      return {
        passed: false,
        message: result.message || '审核失败'
      };
    }
    
    return {
      passed: result.passed,
      message: result.message
    };
    
  } catch (error) {
    console.error('❌ [ContentModeration] 文本审核失败:', error);
    return {
      passed: false,
      message: '审核失败，请重试'
    };
  }
}

/**
 * 审核图片内容
 * @param {string} imageUrl - 图片URL
 * @param {object} options - 可选参数
 * @param {number} options.scene - 场景值，默认2
 * @returns {Promise<{passed: boolean, message: string, traceId: string}>}
 */
export async function checkImage(imageUrl, options = {}) {
  console.log('🔍 [ContentModeration] 审核图片内容');
  
  try {
    const response = await cloudCall('contentCheck', {
      type: 'image',
      imageUrl: imageUrl,
      scene: options.scene || 2
    });
    
    // cloudCall 返回的数据在 result 字段中
    const result = response.result || response;
    
    if (!result.success) {
      return {
        passed: false,
        message: result.message || '审核失败',
        traceId: result.traceId
      };
    }
    
    return {
      passed: result.passed,
      message: result.message,
      traceId: result.traceId
    };
    
  } catch (error) {
    console.error('❌ [ContentModeration] 图片审核失败:', error);
    return {
      passed: false,
      message: '审核失败，请重试'
    };
  }
}

/**
 * 批量审核内容（文本+图片）
 * @param {object} content - 内容对象
 * @param {string} content.text - 文本内容
 * @param {string[]} content.images - 图片URL数组
 * @param {object} options - 可选参数
 * @param {number} options.scene - 场景值，默认2
 * @param {string} options.title - 文本标题
 * @param {string} options.nickname - 用户昵称
 * @returns {Promise<{passed: boolean, message: string, failedType: string}>}
 */
export async function checkContent(content, options = {}) {
  console.log('🔍 [ContentModeration] 批量审核内容');
  
  try {
    const params = {
      type: 'batch',
      content: content.text,
      images: content.images,
      scene: options.scene || 2,
      title: options.title,
      nickname: options.nickname
    };
    
    console.log('🔍 [ContentModeration] 调用云函数参数:', JSON.stringify(params, null, 2));
    
    const response = await cloudCall('contentCheck', params);
    
    console.log('🔍 [ContentModeration] 云函数响应:', JSON.stringify(response, null, 2));
    
    // cloudCall 返回的数据在 result 字段中
    const result = response.result || response;
    
    if (!result.success) {
      return {
        passed: false,
        message: result.message || '审核失败',
        failedType: result.failedType
      };
    }
    
    return {
      passed: result.passed,
      message: result.message,
      failedType: result.failedType
    };
    
  } catch (error) {
    console.error('❌ [ContentModeration] 批量审核失败:', error);
    return {
      passed: false,
      message: '审核失败，请重试'
    };
  }
}

/**
 * 带回调的审核方法
 * @param {string} content - 内容
 * @param {string} type - 类型（'text' 或 'image'）
 * @param {function} callback - 回调函数
 * @param {object} options - 可选参数
 * @returns {Promise<void>}
 */
export async function checkWithCallback(content, type, callback, options = {}) {
  console.log('🔍 [ContentModeration] 带回调的审核');
  
  let result;
  
  if (type === 'text') {
    result = await checkText(content, options);
  } else if (type === 'image') {
    result = await checkImage(content, options);
  } else {
    result = {
      passed: false,
      message: '无效的审核类型'
    };
  }
  
  if (callback && typeof callback === 'function') {
    callback(result);
  }
  
  return result;
}

export default {
  checkText,
  checkImage,
  checkContent,
  checkWithCallback,
  // 带平台检测的安全版本（推荐使用）
  checkTextSafe,
  checkImageSafe,
  checkContentSafe,
  shouldModerate
};
