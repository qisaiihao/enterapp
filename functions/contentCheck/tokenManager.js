// Token 管理模块
// 功能：管理微信 access_token 的获取、缓存和刷新

const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const https = require('https');

/**
 * 获取有效的 access_token
 * 优先从缓存（数据库）获取，如果不存在或已过期则刷新
 * @returns {Promise<string>} access_token
 */
async function getAccessToken() {
  console.log('🔍 [TokenManager] 开始获取 access_token');
  
  try {
    // 从数据库查询缓存的 token
    const tokenRes = await db.collection('access_tokens')
      .orderBy('updateTime', 'desc')
      .limit(1)
      .get();
    
    if (tokenRes.data.length > 0) {
      const tokenData = tokenRes.data[0];
      const now = new Date();
      
      console.log('🔍 [TokenManager] 找到缓存的 token');
      console.log('🔍 [TokenManager] 过期时间:', tokenData.expiresAt);
      console.log('🔍 [TokenManager] 当前时间:', now);
      
      // 检查 token 是否过期（提前5分钟刷新）
      const expiresAt = new Date(tokenData.expiresAt);
      const bufferTime = 5 * 60 * 1000; // 5分钟缓冲
      
      if (now.getTime() < expiresAt.getTime() - bufferTime) {
        console.log('✅ [TokenManager] 使用缓存的 token');
        return tokenData.token;
      }
      
      console.log('⚠️ [TokenManager] Token 已过期或即将过期，需要刷新');
    } else {
      console.log('⚠️ [TokenManager] 未找到缓存的 token');
    }
    
    // Token 不存在或已过期，刷新 token
    return await refreshAccessToken();
    
  } catch (error) {
    console.error('❌ [TokenManager] 获取 token 失败:', error);
    throw new Error('获取访问令牌失败');
  }
}

/**
 * 刷新 access_token
 * 调用微信 API 获取新的 token 并保存到数据库
 * @returns {Promise<string>} 新的 access_token
 */
async function refreshAccessToken() {
  console.log('🔍 [TokenManager] 开始刷新 access_token');
  
  const WECHAT_APPID = process.env.WECHAT_APPID;
  const WECHAT_SECRET = process.env.WECHAT_SECRET;
  
  console.log('🔍 [TokenManager] WECHAT_APPID:', WECHAT_APPID ? `${WECHAT_APPID.substring(0, 6)}...` : '未配置');
  console.log('🔍 [TokenManager] WECHAT_SECRET:', WECHAT_SECRET ? '已配置' : '未配置');
  
  if (!WECHAT_APPID || !WECHAT_SECRET) {
    console.error('❌ [TokenManager] 环境变量未配置');
    throw new Error('微信 AppID 或 Secret 未配置');
  }
  
  try {
    // 调用微信 API 获取 access_token
    const url = `https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=${WECHAT_APPID}&secret=${WECHAT_SECRET}`;
    
    console.log('🔍 [TokenManager] 请求 URL:', url.replace(WECHAT_SECRET, '***'));
    
    // 使用 https 模块发起请求
    const result = await new Promise((resolve, reject) => {
      https.get(url, (res) => {
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
      }).on('error', (error) => {
        reject(error);
      });
    });
    
    console.log('🔍 [TokenManager] 微信 API 响应:', JSON.stringify(result));
    
    if (result.errcode) {
      console.error('❌ [TokenManager] 获取 token 失败 - errcode:', result.errcode);
      console.error('❌ [TokenManager] 错误信息:', result.errmsg);
      throw new Error(`获取访问令牌失败: ${result.errmsg} (errcode: ${result.errcode})`);
    }
    
    const { access_token, expires_in } = result;
    
    if (!access_token) {
      throw new Error('微信 API 未返回 access_token');
    }
    
    // 计算过期时间
    const now = new Date();
    const expiresAt = new Date(now.getTime() + expires_in * 1000);
    
    console.log('✅ [TokenManager] 获取到新的 token');
    console.log('🔍 [TokenManager] 过期时间:', expiresAt);
    
    // 保存到数据库
    await db.collection('access_tokens').add({
      data: {
        token: access_token,
        expiresAt: expiresAt,
        updateTime: now
      }
    });
    
    console.log('✅ [TokenManager] Token 已保存到数据库');
    
    return access_token;
    
  } catch (error) {
    console.error('❌ [TokenManager] 刷新 token 失败:', error);
    throw error;
  }
}

/**
 * 验证 token 是否有效
 * @param {string} token - 要验证的 token
 * @returns {Promise<boolean>} token 是否有效
 */
async function validateToken(token) {
  console.log('🔍 [TokenManager] 验证 token 有效性');
  
  if (!token) {
    return false;
  }
  
  try {
    // 调用微信 API 验证 token（使用一个简单的 API 调用）
    const url = `https://api.weixin.qq.com/cgi-bin/get_api_domain_ip?access_token=${token}`;
    
    const result = await new Promise((resolve, reject) => {
      https.get(url, (res) => {
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
      }).on('error', (error) => {
        reject(error);
      });
    });
    
    // 如果返回 errcode 40001（token 无效）或 42001（token 过期），则无效
    if (result.errcode === 40001 || result.errcode === 42001) {
      console.log('⚠️ [TokenManager] Token 无效或已过期');
      return false;
    }
    
    // 如果没有 errcode 或 errcode 为 0，则有效
    if (!result.errcode || result.errcode === 0) {
      console.log('✅ [TokenManager] Token 有效');
      return true;
    }
    
    console.log('⚠️ [TokenManager] Token 验证返回未知状态:', result);
    return false;
    
  } catch (error) {
    console.error('❌ [TokenManager] 验证 token 失败:', error);
    return false;
  }
}

module.exports = {
  getAccessToken,
  refreshAccessToken,
  validateToken
};
