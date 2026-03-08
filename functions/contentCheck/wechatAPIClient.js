// 微信 API 调用模块
// 功能：封装微信内容安全 API 的调用

const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const https = require('https');

/**
 * 调用文本安全检测 API
 * @param {string} accessToken - 微信 access_token
 * @param {object} params - 检测参数
 * @param {string} params.content - 文本内容（UTF-8编码）
 * @param {string} params.openid - 用户 openid
 * @param {number} params.scene - 场景值（1-4）
 * @param {string} params.title - 可选：标题
 * @param {string} params.nickname - 可选：昵称
 * @param {string} params.signature - 可选：个性签名
 * @returns {Promise<object>} 微信 API 响应
 */
async function msgSecCheck(accessToken, params) {
  console.log('🔍 [WechatAPIClient] 调用文本安全检测 API');
  
  const url = `https://api.weixin.qq.com/wxa/msg_sec_check?access_token=${accessToken}`;
  
  // 构建请求体（确保 UTF-8 编码）
  const requestBody = {
    content: params.content,
    version: 2,
    scene: params.scene,
    openid: params.openid
  };
  
  // 添加可选参数
  if (params.title) {
    requestBody.title = params.title;
  }
  if (params.nickname) {
    requestBody.nickname = params.nickname;
  }
  if (params.signature) {
    requestBody.signature = params.signature;
  }
  
  console.log('🔍 [WechatAPIClient] 请求参数:', {
    ...requestBody,
    content: requestBody.content.substring(0, 50) + '...' // 只打印前50个字符
  });
  
  try {
    const result = await new Promise((resolve, reject) => {
      const postData = JSON.stringify(requestBody);
      
      const options = {
        hostname: 'api.weixin.qq.com',
        port: 443,
        path: `/wxa/msg_sec_check?access_token=${accessToken}`,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json; charset=UTF-8',
          'Content-Length': Buffer.byteLength(postData)
        }
      };
      
      const req = https.request(options, (res) => {
        let data = '';
        
        res.on('data', (chunk) => {
          data += chunk;
        });
        
        res.on('end', () => {
          try {
            resolve(JSON.parse(data));
          } catch (error) {
            reject(new Error('解析响应失败'));
          }
        });
      });
      
      req.on('error', (error) => {
        reject(error);
      });
      
      req.write(postData);
      req.end();
    });
    
    console.log('🔍 [WechatAPIClient] 微信 API 响应:', result);
    
    return result;
    
  } catch (error) {
    console.error('❌ [WechatAPIClient] 调用文本检测 API 失败:', error);
    throw error;
  }
}

/**
 * 调用图片安全检测 API（异步）
 * @param {string} accessToken - 微信 access_token
 * @param {object} params - 检测参数
 * @param {string} params.media_url - 图片 URL
 * @param {string} params.openid - 用户 openid
 * @param {number} params.scene - 场景值（1-4）
 * @returns {Promise<object>} 微信 API 响应（包含 trace_id）
 */
async function mediaCheckAsync(accessToken, params) {
  console.log('🔍 [WechatAPIClient] 调用图片安全检测 API');
  
  const url = `https://api.weixin.qq.com/wxa/media_check_async?access_token=${accessToken}`;
  
  // 构建请求体
  const requestBody = {
    media_url: params.media_url,
    media_type: 2, // 2 表示图片
    version: 2,
    scene: params.scene,
    openid: params.openid
  };
  
  console.log('🔍 [WechatAPIClient] 请求参数:', requestBody);
  
  try {
    const result = await new Promise((resolve, reject) => {
      const postData = JSON.stringify(requestBody);
      
      const options = {
        hostname: 'api.weixin.qq.com',
        port: 443,
        path: `/wxa/media_check_async?access_token=${accessToken}`,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json; charset=UTF-8',
          'Content-Length': Buffer.byteLength(postData)
        }
      };
      
      const req = https.request(options, (res) => {
        let data = '';
        
        res.on('data', (chunk) => {
          data += chunk;
        });
        
        res.on('end', () => {
          try {
            resolve(JSON.parse(data));
          } catch (error) {
            reject(new Error('解析响应失败'));
          }
        });
      });
      
      req.on('error', (error) => {
        reject(error);
      });
      
      req.write(postData);
      req.end();
    });
    
    console.log('🔍 [WechatAPIClient] 微信 API 响应:', result);
    
    return result;
    
  } catch (error) {
    console.error('❌ [WechatAPIClient] 调用图片检测 API 失败:', error);
    throw error;
  }
}

module.exports = {
  msgSecCheck,
  mediaCheckAsync
};
