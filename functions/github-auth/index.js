const axios = require('axios');

// GitHub OAuth 配置
const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID;
const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET;
const GITHUB_REDIRECT_URI = process.env.GITHUB_REDIRECT_URI;
const FRONTEND_URL = process.env.FRONTEND_URL;

// 引入腾讯云开发Node.js SDK (正确的方式)
const cloud = require('@cloudbase/node-sdk');

// 初始化
const app = cloud.init({
  env: cloud.SYMBOL_CURRENT_ENV // 使用 Symbol 获取当前环境
});

const db = app.database();

exports.main = async (event, context) => {
  try {
    // 1. 优先检查是否是 GitHub 的 HTTP 回调（有 queryStringParameters 且包含 code）
    const query = event.queryStringParameters || {};
    if (query.code) {
      return await handleCallback(query.code, query.state, event);
    }

    // 2. 处理函数调用（区分 SDK 调用和 HTTP 调用）
    let action = null;
    let body = {};

    // 如果是 HTTP 触发（有 body 或 queryStringParameters）
    if (event.body || event.queryStringParameters) {
      // 解析 body（如果是 JSON 字符串）
      if (event.body) {
        try {
          body = typeof event.body === 'string' ? JSON.parse(event.body) : event.body;
        } catch (e) {
          console.warn('解析 body 失败，使用空对象:', e);
          body = {};
        }
      }
      action = body.action;
    } else {
      // 如果是 SDK 调用（直接通过 event 获取参数）
      action = event.action;
      body = event;
    }

    console.log(`[GitHub Auth] 收到请求，action: ${action}, 类型: ${event.body ? 'HTTP' : 'SDK'}`);

    // 根据 action 执行相应操作
    switch (action) {
      case 'getAuthUrl':
        return await getAuthUrl(body);

      case 'getUserInfo':
        return await getUserInfo(body.accessToken);

      default:
        return {
          success: false,
          message: '无效的操作'
        };
    }
  } catch (error) {
    console.error('GitHub Auth Error:', error);
    return {
      success: false,
      message: error.message
    };
  }
};

// 获取 GitHub 授权 URL
async function getAuthUrl(eventBody = {}) {
  // 从请求体中获取 platform 参数，默认为 'app'
  const platform = eventBody.platform || 'app';
  const randomStr = generateState();
  
  // 将平台信息嵌入 state，使用 :: 分隔符
  const state = `${platform}::${randomStr}`;
  
  console.log(`[GitHub Auth] 生成授权URL，平台: ${platform}`);
  
  // 修复：使用空格分隔多个 scope，并确保包含 user 和 user:email
  const authUrl = `https://github.com/login/oauth/authorize?client_id=${GITHUB_CLIENT_ID}&redirect_uri=${encodeURIComponent(GITHUB_REDIRECT_URI)}&scope=user%20user:email&state=${state}`;

  return {
    success: true,
    authUrl,
    state
  };
}

// 处理 GitHub 回调
async function handleCallback(code, state, event) {
  try {
    // 从 state 中解析出平台信息
    const platform = state && state.includes('::') ? state.split('::')[0] : 'app';
    console.log(`[GitHub Auth] 开始处理回调, code: ${code ? 'exists' : 'missing'}, 平台: ${platform}`);
    
    // 1. 用 code 换 access token
    console.log('[GitHub Auth] 步骤1: 获取 access token...');
    const tokenResponse = await axios.post('https://github.com/login/oauth/access_token', {
      client_id: GITHUB_CLIENT_ID,
      client_secret: GITHUB_CLIENT_SECRET,
      code: code,
      redirect_uri: GITHUB_REDIRECT_URI
    }, {
      headers: {
        'Accept': 'application/json'
      },
      timeout: 30000 // 30秒超时
    });

    const { access_token, error, error_description } = tokenResponse.data;

    if (error) {
      console.error('[GitHub Auth] 获取 access token 失败:', error_description);
      throw new Error(error_description || '获取 access token 失败');
    }
    
    console.log('[GitHub Auth] 步骤1完成: access token 获取成功');

    // 2. 获取用户信息
    console.log('[GitHub Auth] 步骤2: 获取用户信息...');
    const userResponse = await axios.get('https://api.github.com/user', {
      headers: {
        'Authorization': `token ${access_token}`,
        'Accept': 'application/json'
      }
    });

    const userInfo = userResponse.data;
    console.log('[GitHub Auth] 步骤2完成: 用户信息获取成功, login:', userInfo.login);

    // 3. 获取用户邮箱（可选，如果失败不影响登录）
    let primaryEmail = null;
    try {
      console.log('[GitHub Auth] 步骤3: 获取用户邮箱...');
      const emailResponse = await axios.get('https://api.github.com/user/emails', {
        headers: {
          'Authorization': `token ${access_token}`,
          'Accept': 'application/json'
        }
      });

      const emails = emailResponse.data;
      primaryEmail = emails.find(function(email) { return email.primary; }) ? emails.find(function(email) { return email.primary; }).email : (emails[0] ? emails[0].email : null);
      console.log('[GitHub Auth] 步骤3完成: 邮箱获取成功');
    } catch (emailError) {
      console.warn('[GitHub Auth] 步骤3失败: 无法获取邮箱（可能缺少 user:email scope），继续登录流程');
      // 邮箱获取失败不影响登录，使用 null
      primaryEmail = null;
    }

    // 4. 检查用户是否已存在
    const openid = `github_${userInfo.id}`;
    
    console.log('[GitHub Auth] 步骤4: 检查用户是否存在, openid:', openid);
    
    // 先通过 _openid 查询
    let userRecord = await db.collection('users').where({
      _openid: openid
    }).get();
    
    // 如果没找到，再通过 githubOpenid 查询（支持已绑定 GitHub 的账号）
    if (userRecord.data.length === 0) {
      console.log('[GitHub Auth] 通过 _openid 未找到，尝试通过 githubOpenid 查询...');
      userRecord = await db.collection('users').where({
        githubOpenid: openid
      }).get();
    }

    let user;
    let isNewUser = false;

    if (userRecord.data.length > 0) {
      // 已存在用户，更新信息
      user = userRecord.data[0];
      console.log('[GitHub Auth] 找到已存在用户:', user.poemId || user._openid);
      
      await db.collection('users').doc(user._id).update({
        data: {
          githubUsername: userInfo.login,
          githubAvatar: userInfo.avatar_url,
          githubEmail: primaryEmail,
          githubOpenid: openid,  // 确保 githubOpenid 字段存在
          lastLoginAt: new Date()
        }
      });
      
      // 确保返回的用户对象包含 openid 字段（兼容前端）
      user.openid = user._openid || openid;
    } else {
      // 新用户，不创建记录，而是重定向到注册页面
      console.log('[GitHub Auth] 未找到用户，标记为新用户');
      isNewUser = true;
    }

    // 5. 生成登录态并构建重定向URL
    const frontendUrl = FRONTEND_URL || 'https://cloud1-5gb0pbyl400845f5-1378788263.ap-shanghai.app.tcloudbase.com';
    
    // 准备数据
    const type = isNewUser ? 'register' : 'login';
    const data = isNewUser ? {
      openid: openid,
      githubUsername: userInfo.login,
      githubAvatar: userInfo.avatar_url,
      githubEmail: primaryEmail,
      githubName: userInfo.name || userInfo.login,
      accessToken: access_token
    } : {
      user: user,
      isNewUser: false,
      accessToken: access_token
    };
    const encodedData = encodeURIComponent(JSON.stringify(data));
    
    // 根据平台生成不同的重定向地址
    let redirectUrl;
    if (platform === 'h5') {
      // H5 平台：重定向到 H5 应用的回调页面
      // 注意：uni-app H5 使用 hash 路由，参数应该在 hash 后面
      redirectUrl = `${frontendUrl}/#/pages/auth/callback?type=${type}&data=${encodedData}`;
      console.log(`[GitHub Auth] ${isNewUser ? '新用户' : '已注册用户'}，重定向到 H5 回调页面`);
      console.log('[GitHub Auth] H5 重定向 URL:', redirectUrl);
      console.log('[GitHub Auth] type:', type);
      console.log('[GitHub Auth] encodedData 长度:', encodedData.length);
    } else {
      // App 平台：重定向到 URL Scheme
      redirectUrl = `poementer://github-callback?type=${type}&data=${encodedData}`;
      console.log(`[GitHub Auth] ${isNewUser ? '新用户' : '已注册用户'}，重定向到 App`);
    }
    
    console.log('[GitHub Auth] 最终重定向地址:', redirectUrl);
    
    return {
      statusCode: 302,
      headers: {
        'Location': redirectUrl
      },
      body: 'Redirecting...'
    };
  } catch (error) {
    console.error('GitHub OAuth Error:', error);

    // 从 state 中解析平台信息（错误处理时也需要）
    const platform = state && state.includes('::') ? state.split('::')[0] : 'app';
    
    // 错误处理：根据平台返回不同的重定向地址
    const errorData = encodeURIComponent(JSON.stringify({
      success: false,
      message: error.message || 'GitHub登录失败，请重试'
    }));

    let errorRedirectUrl;
    if (platform === 'h5') {
      // H5 平台
      const frontendUrl = FRONTEND_URL || 'https://cloud1-5gb0pbyl400845f5-1378788263.ap-shanghai.app.tcloudbase.com';
      errorRedirectUrl = `${frontendUrl}/#/pages/auth/callback?type=error&data=${errorData}`;
      console.log('[GitHub Auth] 发生错误，重定向到 H5 回调页面');
    } else {
      // App 平台
      errorRedirectUrl = `poementer://github-callback?type=error&data=${errorData}`;
      console.log('[GitHub Auth] 发生错误，重定向到 App');
    }
    
    console.log('[GitHub Auth] 错误重定向地址:', errorRedirectUrl);

    return {
      statusCode: 302,
      headers: {
        'Location': errorRedirectUrl
      },
      body: 'Redirecting with error...'
    };
  }
}

// 获取用户信息
async function getUserInfo(accessToken) {
  const response = await axios.get('https://api.github.com/user', {
    headers: {
      'Authorization': `token ${accessToken}`,
      'Accept': 'application/json'
    }
  });

  return {
    success: true,
    userInfo: response.data
  };
}

// 生成随机状态码
function generateState() {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}

// 生成 Poem ID（基于 GitHub 用户名）
function generatePoemId(githubUsername) {
  // 如果 GitHub 用户名符合要求，直接使用
  if (githubUsername && githubUsername.length >= 3 && githubUsername.length <= 20) {
    return githubUsername;
  }

  // 否则生成基于 GitHub 用户名的 ID
  return 'gh_' + githubUsername.substring(0, 10) + Math.random().toString(36).substring(2, 6);
}