// 云函数入口文件
const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();
const _ = db.command;

// 平台检测和兼容性处理
function getDatabaseAndContext() {
  // 检查是否是TCB调用（H5/APP环境）
  if (global.tcb) {
    return {
      db: global.tcb.database(),
      isTCB: true
    };
  }

  // 微信小程序环境
  return {
    db: db,
    isTCB: false
  };
}

// 获取用户ID的兼容函数
function getUserId(wxContext, event, context) {
  // 优先级：event.openid > context.OPENID > wxContext.OPENID > wxContext.claims.openid
  return event.openid || context.OPENID || wxContext.OPENID || (wxContext.claims && wxContext.claims.openid);
}

// 云函数入口函数
exports.main = async (event, context) => {
  // ==================== 🚀 新增逻辑：兼容HTTP请求 ====================
  let params = event; // 默认参数来源是 event 本身 (小程序内部调用)
  let isHttpRequest = false;

  // 如果 event.body 存在，说明这很可能是一个 HTTP POST 请求
  if (event.body) {
    try {
      params = typeof event.body === 'string' ? JSON.parse(event.body) : event.body;
      isHttpRequest = true;
    } catch (e) {
      console.error('❌ [updateUser] HTTP body 解析失败:', e);
      return { 
        success: false, 
        message: '请求体格式错误',
        code: 'INVALID_BODY'
      };
    }
  }
  
  // 也可以通过 httpMethod 判断是否是 HTTP 请求
  if (event.httpMethod) {
    isHttpRequest = true;
  }

  // 推荐：为 HTTP 调用增加一个简单的安全校验
  // ⚠️ 建议将密钥存储在环境变量中，而不是硬编码在代码里
  const TCB_SECRET_KEY = process.env.TCB_SECRET_KEY || 'Your-Custom-Secret-Key-123'; // ⚠️ 请替换成您自己的、复杂的密钥
  if (isHttpRequest) {
    // 仅对HTTP请求进行密钥校验
    if (!params.secretKey || params.secretKey !== TCB_SECRET_KEY) {
      console.error('❌ [updateUser] HTTP 请求密钥无效');
      return { 
        success: false, 
        message: '无权访问',
        code: 'INVALID_SECRET_KEY'
      };
    }
    // 校验通过后，从参数中删除密钥，避免存入数据库
    delete params.secretKey;
  }
  // ====================================================================

  const wxContext = cloud.getWXContext();
  
  // 关键改动：所有参数都从 params 对象中解构（兼容两种调用方式）
  const { nickName, avatarUrl, poemId, password, phoneNumber, githubUsername, githubAvatar, githubEmail, githubOpenid } = params;

  // 获取兼容的数据库实例和上下文
  const { db: database, isTCB } = getDatabaseAndContext();

  // 关键改动：openid 优先从 params 中获取（HTTP调用时必需），否则使用原有逻辑
  const openid = params.openid || getUserId(wxContext, event, context);


  if (!openid) {
    return {
      success: false,
      message: '无法获取用户身份信息，请重新登录',
      code: 'NO_OPENID'
    };
  }

  try {

    // 使用统一的_openid字段，与项目其他云函数保持一致
    const userRecord = await database.collection('users').where({
      _openid: openid
    }).get();

    
    if (userRecord.data.length > 0) {
      // User exists, update it
      // 如果提供了手机号，先检查是否已被其他账号绑定
      if (phoneNumber && phoneNumber.trim()) {
        // 先查询所有使用该手机号的用户
        const phoneCheckRes = await database.collection('users').where({
          phoneNumber: phoneNumber.trim()
        }).get();
        
        // 检查是否有其他用户（非当前用户）使用了该手机号
        const otherUser = phoneCheckRes.data.find(user => user._openid !== openid);
        
        if (otherUser) {
          return {
            success: false,
            message: '此手机号已被其他账号使用',
            code: 'PHONE_ALREADY_BOUND',
            platform: isTCB ? 'TCB' : 'WeApp'
          };
        }
      }
      
      const updateData = {
        updatedAt: new Date()
      };

      // 只添加有值的字段，避免undefined覆盖原有数据
      if (nickName) {
        updateData.nickName = nickName;
      }
      if (avatarUrl) {
        updateData.avatarUrl = avatarUrl;
      }
      if (poemId) {
        updateData.poemId = poemId;
      }
      if (password) {
        updateData.password = password;
      }
      
      // 如果提供了手机号，更新手机号和验证状态
      if (phoneNumber && phoneNumber.trim()) {
        updateData.phoneNumber = phoneNumber.trim();
        updateData.isPhoneVerified = true;
      }
      
      // 如果提供了GitHub相关信息，更新这些字段
      if (githubUsername) {
        updateData.githubUsername = githubUsername;
      }
      if (githubAvatar) {
        updateData.githubAvatar = githubAvatar;
      }
      if (githubEmail !== undefined) {
        updateData.githubEmail = githubEmail;
      }
      if (githubOpenid) {
        updateData.githubOpenid = githubOpenid;
      }

      const updateResult = await database.collection('users').where({
        _openid: openid
      }).update({
        data: updateData
      });

    } else {
      // User does not exist, add it
      const createData = {
        _openid: openid,
        nickName,
        avatarUrl,
        createdAt: new Date()
      };

      // 如果提供了poemId和password，则添加到创建数据中
      if (poemId) {
        createData.poemId = poemId;
      }
      if (password) {
        createData.password = password;
      }

      const createResult = await database.collection('users').add({
        data: createData
      });

    }

    // On success, explicitly return a success object that the client expects
    return {
      success: true,
      message: '用户信息更新成功',
      platform: isTCB ? 'TCB' : 'WeApp'
    };

  } catch (e) {
    console.error('❌ [updateUser] 数据库操作失败:', e);
    console.error('❌ [updateUser] 错误详情:', JSON.stringify(e, null, 2));
    console.error('❌ [updateUser] 错误类型:', typeof e);
    console.error('❌ [updateUser] 错误消息:', e.message);
    console.error('❌ [updateUser] 错误堆栈:', e.stack);

    // On failure, explicitly return a failure object
    return {
      success: false,
      message: '数据库操作失败: ' + (e.message || '未知错误'),
      error: e.message || e.toString(),
      platform: isTCB ? 'TCB' : 'WeApp'
    };
  }
};