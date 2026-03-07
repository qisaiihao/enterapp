// 输入验证模块
// 功能：验证审核请求的输入参数

/**
 * 验证文本内容
 * @param {string} content - 文本内容
 * @returns {object} { valid: boolean, error: string }
 */
function validateTextContent(content) {
  console.log('🔍 [Validator] 验证文本内容');
  
  // 检查是否为空
  if (!content) {
    return {
      valid: false,
      error: '内容不能为空'
    };
  }
  
  // 检查是否仅包含空白字符
  if (content.trim().length === 0) {
    return {
      valid: false,
      error: '内容不能为空'
    };
  }
  
  // 检查长度限制（2500字符）
  if (content.length > 2500) {
    return {
      valid: false,
      error: '内容长度超过限制（最多2500字符）'
    };
  }
  
  console.log('✅ [Validator] 文本内容验证通过');
  return { valid: true };
}

/**
 * 验证图片 URL
 * @param {string} imageUrl - 图片 URL
 * @returns {object} { valid: boolean, error: string }
 */
function validateImageUrl(imageUrl) {
  console.log('🔍 [Validator] 验证图片 URL');
  
  // 检查是否为空
  if (!imageUrl) {
    return {
      valid: false,
      error: '图片地址不能为空'
    };
  }
  
  // 检查 URL 格式
  try {
    const url = new URL(imageUrl);
    if (!url.protocol.startsWith('http')) {
      return {
        valid: false,
        error: '图片地址格式不正确'
      };
    }
  } catch (error) {
    return {
      valid: false,
      error: '图片地址无效'
    };
  }
  
  // 检查图片格式（支持的扩展名）
  const supportedFormats = ['.jpg', '.jpeg', '.png', '.bmp', '.gif'];
  const lowerUrl = imageUrl.toLowerCase();
  const hasValidFormat = supportedFormats.some(format => {
    return lowerUrl.includes(format);
  });
  
  if (!hasValidFormat) {
    return {
      valid: false,
      error: '图片格式不支持（仅支持 jpg、jpeg、png、bmp、gif）'
    };
  }
  
  console.log('✅ [Validator] 图片 URL 验证通过');
  return { valid: true };
}

/**
 * 验证场景参数
 * @param {number} scene - 场景值
 * @returns {object} { valid: boolean, error: string }
 */
function validateScene(scene) {
  console.log('🔍 [Validator] 验证场景参数:', scene);
  
  // 场景值必须在 1-4 范围内
  if (![1, 2, 3, 4].includes(scene)) {
    return {
      valid: false,
      error: '场景参数无效（必须为 1-4）'
    };
  }
  
  console.log('✅ [Validator] 场景参数验证通过');
  return { valid: true };
}

/**
 * 验证 openid
 * @param {string} openid - 用户 openid
 * @returns {object} { valid: boolean, error: string }
 */
function validateOpenid(openid) {
  console.log('🔍 [Validator] 验证 openid');
  
  if (!openid) {
    return {
      valid: false,
      error: '请先登录'
    };
  }
  
  console.log('✅ [Validator] openid 验证通过');
  return { valid: true };
}

module.exports = {
  validateTextContent,
  validateImageUrl,
  validateScene,
  validateOpenid
};
