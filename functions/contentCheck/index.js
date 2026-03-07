// 云函数：contentCheck
// 功能：微信内容安全审核（文本和图片）
const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();

// 导入模块
const tokenManager = require('./tokenManager');
const wechatAPIClient = require('./wechatAPIClient');
const validator = require('./validator');
const moderationLogger = require('./moderationLogger');
const cacheManager = require('./cacheManager');

/**
 * 云函数入口
 * @param {object} event - 请求参数
 * @param {string} event.type - 审核类型：'text' | 'image' | 'batch'
 * @param {string} event.content - 文本内容（type=text时）
 * @param {string} event.imageUrl - 图片URL（type=image时）
 * @param {string[]} event.images - 图片URL数组（type=batch时）
 * @param {number} event.scene - 场景值（1-资料、2-评论、3-论坛、4-社交日志）
 * @param {string} event.title - 可选：标题
 * @param {string} event.nickname - 可选：昵称
 * @param {string} event.signature - 可选：个性签名（scene=1时）
 * @param {object} context - 云函数上下文
 * @returns {Promise<object>} 审核结果
 */
exports.main = async (event, context) => {
  console.log('🔍 [contentCheck] 开始处理内容审核请求');
  console.log('🔍 [contentCheck] 请求参数:', JSON.stringify(event, null, 2));
  console.log('🔍 [contentCheck] event.type 类型:', typeof event.type);
  console.log('🔍 [contentCheck] event.type 值:', event.type);
  console.log('🔍 [contentCheck] event 所有键:', Object.keys(event));
  
  const wxContext = cloud.getWXContext();
  const { OPENID } = wxContext;
  
  try {
    // 获取环境变量
    const WECHAT_APPID = process.env.WECHAT_APPID;
    const WECHAT_SECRET = process.env.WECHAT_SECRET;
    
    // 验证环境变量配置
    if (!WECHAT_APPID || !WECHAT_SECRET) {
      console.error('❌ [contentCheck] 环境变量未配置');
      return {
        success: false,
        passed: false,
        message: '系统配置错误',
        errorCode: 'CONFIG_ERROR'
      };
    }
    
    // 验证 openid
    if (!OPENID) {
      console.error('❌ [contentCheck] 无法获取用户 openid');
      return {
        success: false,
        passed: false,
        message: '请先登录',
        errorCode: 'AUTH_ERROR'
      };
    }
    
    // 提取请求参数
    const {
      type,
      content,
      imageUrl,
      images,
      scene = 2, // 默认场景值为2（评论）
      title,
      nickname,
      signature
    } = event;
    
    // 验证审核类型
    if (!type || !['text', 'image', 'batch'].includes(type)) {
      console.error('❌ [contentCheck] 无效的审核类型:', type);
      return {
        success: false,
        passed: false,
        message: '无效的审核类型',
        errorCode: 'INVALID_TYPE'
      };
    }
    
    console.log('✅ [contentCheck] 基础验证通过');
    console.log('🔍 [contentCheck] 审核类型:', type);
    console.log('🔍 [contentCheck] 场景值:', scene);
    console.log('🔍 [contentCheck] 用户 openid:', OPENID);
    
    // 根据类型调用相应的审核逻辑
    let result;
    
    if (type === 'text') {
      result = await checkTextContent({
        content,
        scene,
        title,
        nickname,
        signature,
        openid: OPENID
      });
    } else if (type === 'image') {
      result = await checkImageContent({
        imageUrl,
        scene,
        openid: OPENID
      });
    } else if (type === 'batch') {
      result = await checkBatchContent({
        content,
        images,
        scene,
        title,
        nickname,
        openid: OPENID
      });
    }
    
    return result;
    
  } catch (error) {
    console.error('❌ [contentCheck] 内容审核失败:', error);
    
    return {
      success: false,
      passed: false,
      message: error.message || '审核失败',
      errorCode: 'UNKNOWN_ERROR'
    };
  }
};


/**
 * 审核文本内容
 */
async function checkTextContent(params) {
  console.log('🔍 [contentCheck] 开始文本审核');
  
  const { content, scene, title, nickname, signature, openid } = params;
  
  // 验证输入
  const contentValidation = validator.validateTextContent(content);
  if (!contentValidation.valid) {
    return {
      success: false,
      passed: false,
      message: contentValidation.error,
      errorCode: 'VALIDATION_ERROR'
    };
  }
  
  const sceneValidation = validator.validateScene(scene);
  if (!sceneValidation.valid) {
    return {
      success: false,
      passed: false,
      message: sceneValidation.error,
      errorCode: 'VALIDATION_ERROR'
    };
  }
  
  const openidValidation = validator.validateOpenid(openid);
  if (!openidValidation.valid) {
    return {
      success: false,
      passed: false,
      message: openidValidation.error,
      errorCode: 'AUTH_ERROR'
    };
  }
  
  // 检查缓存
  const fingerprint = cacheManager.generateFingerprint(content, 'text');
  const cachedResult = await cacheManager.getCachedResult(fingerprint);
  
  if (cachedResult) {
    console.log('✅ [contentCheck] 使用缓存结果');
    return cachedResult;
  }
  
  // 获取 access_token
  let accessToken;
  try {
    accessToken = await tokenManager.getAccessToken();
  } catch (error) {
    console.error('❌ [contentCheck] 获取 access_token 失败:', error);
    return {
      success: false,
      passed: false,
      message: '系统繁忙，请稍后再试',
      errorCode: 'TOKEN_ERROR'
    };
  }
  
  // 调用微信 API（带重试机制）
  let apiResult;
  let retryCount = 0;
  const maxRetries = 3;
  
  while (retryCount < maxRetries) {
    try {
      apiResult = await wechatAPIClient.msgSecCheck(accessToken, {
        content,
        openid,
        scene,
        title,
        nickname,
        signature
      });
      
      // 检查错误码
      if (apiResult.errcode === 0) {
        // 成功
        break;
      } else if (apiResult.errcode === -1) {
        // 系统繁忙，重试
        console.log(`⚠️ [contentCheck] 系统繁忙，重试 ${retryCount + 1}/${maxRetries}`);
        retryCount++;
        await sleep(100 * Math.pow(2, retryCount)); // 指数退避
        continue;
      } else if (apiResult.errcode === 40001 || apiResult.errcode === 42001) {
        // Token 过期，刷新后重试
        console.log('⚠️ [contentCheck] Token 过期，刷新后重试');
        accessToken = await tokenManager.refreshAccessToken();
        retryCount++;
        continue;
      } else {
        // 其他错误，不重试
        break;
      }
    } catch (error) {
      console.error('❌ [contentCheck] 调用微信 API 失败:', error);
      retryCount++;
      if (retryCount >= maxRetries) {
        return {
          success: false,
          passed: false,
          message: '网络超时，请重试',
          errorCode: 'NETWORK_ERROR'
        };
      }
      await sleep(100 * Math.pow(2, retryCount));
    }
  }
  
  // 处理 API 响应
  const result = handleAPIResponse(apiResult, 'text');
  
  // 记录日志
  await moderationLogger.logModeration({
    openid,
    type: 'text',
    content,
    scene,
    result: apiResult.result,
    detail: apiResult.detail,
    passed: result.passed,
    errorCode: apiResult.errcode,
    errorMessage: apiResult.errmsg
  });
  
  // 写入缓存
  await cacheManager.setCachedResult(fingerprint, result);
  
  return result;
}

/**
 * 审核图片内容
 */
async function checkImageContent(params) {
  console.log('🔍 [contentCheck] 开始图片审核');
  
  const { imageUrl, scene, openid } = params;
  
  // 验证输入
  const urlValidation = validator.validateImageUrl(imageUrl);
  if (!urlValidation.valid) {
    return {
      success: false,
      passed: false,
      message: urlValidation.error,
      errorCode: 'VALIDATION_ERROR'
    };
  }
  
  const sceneValidation = validator.validateScene(scene);
  if (!sceneValidation.valid) {
    return {
      success: false,
      passed: false,
      message: sceneValidation.error,
      errorCode: 'VALIDATION_ERROR'
    };
  }
  
  const openidValidation = validator.validateOpenid(openid);
  if (!openidValidation.valid) {
    return {
      success: false,
      passed: false,
      message: openidValidation.error,
      errorCode: 'AUTH_ERROR'
    };
  }
  
  // 检查缓存
  const fingerprint = cacheManager.generateFingerprint(imageUrl, 'image');
  const cachedResult = await cacheManager.getCachedResult(fingerprint);
  
  if (cachedResult) {
    console.log('✅ [contentCheck] 使用缓存结果');
    return cachedResult;
  }
  
  // 获取 access_token
  let accessToken;
  try {
    accessToken = await tokenManager.getAccessToken();
  } catch (error) {
    console.error('❌ [contentCheck] 获取 access_token 失败:', error);
    return {
      success: false,
      passed: false,
      message: '系统繁忙，请稍后再试',
      errorCode: 'TOKEN_ERROR'
    };
  }
  
  // 调用微信 API（带重试机制）
  let apiResult;
  let retryCount = 0;
  const maxRetries = 3;
  
  while (retryCount < maxRetries) {
    try {
      apiResult = await wechatAPIClient.mediaCheckAsync(accessToken, {
        media_url: imageUrl,
        openid,
        scene
      });
      
      // 检查错误码
      if (apiResult.errcode === 0) {
        // 成功
        break;
      } else if (apiResult.errcode === -1) {
        // 系统繁忙，重试
        console.log(`⚠️ [contentCheck] 系统繁忙，重试 ${retryCount + 1}/${maxRetries}`);
        retryCount++;
        await sleep(100 * Math.pow(2, retryCount));
        continue;
      } else if (apiResult.errcode === 40001 || apiResult.errcode === 42001) {
        // Token 过期，刷新后重试
        console.log('⚠️ [contentCheck] Token 过期，刷新后重试');
        accessToken = await tokenManager.refreshAccessToken();
        retryCount++;
        continue;
      } else {
        // 其他错误，不重试
        break;
      }
    } catch (error) {
      console.error('❌ [contentCheck] 调用微信 API 失败:', error);
      retryCount++;
      if (retryCount >= maxRetries) {
        return {
          success: false,
          passed: false,
          message: '网络超时，请重试',
          errorCode: 'NETWORK_ERROR'
        };
      }
      await sleep(100 * Math.pow(2, retryCount));
    }
  }
  
  // 处理 API 响应
  const result = handleAPIResponse(apiResult, 'image');
  
  // 添加 trace_id
  if (apiResult.trace_id) {
    result.traceId = apiResult.trace_id;
  }
  
  // 记录日志
  await moderationLogger.logModeration({
    openid,
    type: 'image',
    imageUrl,
    scene,
    result: apiResult.result,
    detail: apiResult.detail,
    traceId: apiResult.trace_id,
    passed: result.passed,
    errorCode: apiResult.errcode,
    errorMessage: apiResult.errmsg
  });
  
  // 写入缓存
  await cacheManager.setCachedResult(fingerprint, result);
  
  return result;
}

/**
 * 批量审核内容
 */
async function checkBatchContent(params) {
  console.log('🔍 [contentCheck] 开始批量审核');
  
  const { content, images, scene, title, nickname, openid } = params;
  
  const results = [];
  
  // 审核文本
  if (content) {
    const textResult = await checkTextContent({
      content,
      scene,
      title,
      nickname,
      openid
    });
    
    if (!textResult.passed) {
      return {
        success: true,
        passed: false,
        message: '文本内容审核未通过',
        failedType: 'text'
      };
    }
    
    results.push(textResult);
  }
  
  // 审核图片
  if (images && images.length > 0) {
    const imagePromises = images.map(imageUrl => 
      checkImageContent({ imageUrl, scene, openid })
    );
    
    const imageResults = await Promise.all(imagePromises);
    
    for (const imageResult of imageResults) {
      if (!imageResult.passed) {
        return {
          success: true,
          passed: false,
          message: '图片内容审核未通过',
          failedType: 'image'
        };
      }
      results.push(imageResult);
    }
  }
  
  return {
    success: true,
    passed: true,
    message: '审核通过'
  };
}

/**
 * 处理微信 API 响应
 */
function handleAPIResponse(apiResult, type) {
  console.log('🔍 [contentCheck] 处理 API 响应');
  
  // 处理错误码
  if (apiResult.errcode && apiResult.errcode !== 0) {
    const errorMessage = getErrorMessage(apiResult.errcode);
    
    // 记录未知错误
    if (errorMessage === '系统繁忙，请稍后再试') {
      console.error('⚠️ [contentCheck] 未知错误码:', apiResult.errcode, apiResult.errmsg);
    }
    
    return {
      success: false,
      passed: false,
      message: errorMessage,
      errorCode: apiResult.errcode
    };
  }
  
  // 处理审核结果
  const suggest = apiResult.result?.suggest;
  
  if (suggest === 'pass') {
    return {
      success: true,
      passed: true,
      message: '审核通过'
    };
  } else if (suggest === 'risky' || suggest === 'review') {
    return {
      success: true,
      passed: false,
      message: '内容审核未通过'
    };
  }
  
  // 未知状态
  return {
    success: true,
    passed: true,
    message: '审核通过'
  };
}

/**
 * 获取错误消息
 */
function getErrorMessage(errcode) {
  const errorMessages = {
    '-1': '系统繁忙，请稍后再试',
    '40001': '请先登录',
    '40003': '请先登录',
    '40129': '场景参数无效',
    '44991': '调用频率超限，请稍后再试',
    '45009': '调用频率超限，请稍后再试',
    '61010': '请先登录'
  };
  
  return errorMessages[errcode] || '系统繁忙，请稍后再试';
}

/**
 * 延迟函数
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
