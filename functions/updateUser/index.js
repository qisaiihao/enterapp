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
  let openid = event.openid || context.OPENID || wxContext.OPENID || (wxContext.claims && wxContext.claims.openid);

  console.log('🔍 [updateUser] 用户ID获取详情:', {
    eventOpenid: event.openid,
    contextOpenid: context.OPENID,
    wxContextOpenid: wxContext.OPENID,
    wxClaimsOpenid: wxContext.claims && wxContext.claims.openid,
    finalOpenid: openid,
    platform: global.tcb ? 'TCB' : 'WeApp'
  });

  return openid;
}

// 云函数入口函数
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const { nickName, avatarUrl, poemId, password, phoneNumber } = event;

  // 获取兼容的数据库实例和上下文
  const { db: database, isTCB } = getDatabaseAndContext();

  // 获取用户标识
  const openid = getUserId(wxContext, event, context);

  console.log('🔍 [updateUser] 最终使用的openid:', openid);
  console.log('🔍 [updateUser] 运行平台:', isTCB ? 'TCB' : 'WeApp');
  console.log('🔍 [updateUser] 收到的参数:', { nickName, avatarUrl, poemId, password: password ? '***' : 'undefined', phoneNumber: phoneNumber ? '***' : 'undefined' });

  if (!openid) {
    return {
      success: false,
      message: '无法获取用户身份信息，请重新登录',
      code: 'NO_OPENID'
    };
  }

  try {
    console.log('🔍 [updateUser] 开始查询用户，openid:', openid);

    // 使用统一的_openid字段，与项目其他云函数保持一致
    const userRecord = await database.collection('users').where({
      _openid: openid
    }).get();

    console.log('🔍 [updateUser] 查询结果:', userRecord);
    console.log('🔍 [updateUser] 查询到的用户数量:', userRecord.data.length);

    if (userRecord.data.length > 0) {
      // User exists, update it
      console.log('🔍 [updateUser] 用户已存在，执行更新');
      
      // 如果提供了手机号，先检查是否已被其他账号绑定
      if (phoneNumber && phoneNumber.trim()) {
        console.log('🔍 [updateUser] 检查手机号是否已被其他账号使用');
        // 先查询所有使用该手机号的用户
        const phoneCheckRes = await database.collection('users').where({
          phoneNumber: phoneNumber.trim()
        }).get();
        
        // 检查是否有其他用户（非当前用户）使用了该手机号
        const otherUser = phoneCheckRes.data.find(user => user._openid !== openid);
        
        if (otherUser) {
          console.log('❌ [updateUser] 手机号已被其他账号使用');
          return {
            success: false,
            message: '此手机号已被其他账号使用',
            code: 'PHONE_ALREADY_BOUND',
            platform: isTCB ? 'TCB' : 'WeApp'
          };
        }
        console.log('✅ [updateUser] 手机号可用');
      }
      
      const updateData = {
        nickName,
        avatarUrl,
        updatedAt: new Date()
      };

      // 如果提供了poemId和password，则更新这些字段
      if (poemId) {
        updateData.poemId = poemId;
        console.log('🔍 [updateUser] 将更新poemId:', poemId);
      }
      if (password) {
        updateData.password = password;
        console.log('🔍 [updateUser] 将更新password');
      }
      
      // 如果提供了手机号，更新手机号和验证状态
      if (phoneNumber && phoneNumber.trim()) {
        updateData.phoneNumber = phoneNumber.trim();
        updateData.isPhoneVerified = true;
        console.log('🔍 [updateUser] 将更新phoneNumber和isPhoneVerified');
      }

      console.log('🔍 [updateUser] 准备更新的数据:', updateData);

      const updateResult = await database.collection('users').where({
        _openid: openid
      }).update({
        data: updateData
      });

      console.log('🔍 [updateUser] 更新结果:', updateResult);
    } else {
      // User does not exist, add it
      console.log('🔍 [updateUser] 用户不存在，执行创建');
      const createData = {
        _openid: openid,
        nickName,
        avatarUrl,
        createdAt: new Date()
      };

      // 如果提供了poemId和password，则添加到创建数据中
      if (poemId) {
        createData.poemId = poemId;
        console.log('🔍 [updateUser] 将创建poemId:', poemId);
      }
      if (password) {
        createData.password = password;
        console.log('🔍 [updateUser] 将创建password');
      }

      console.log('🔍 [updateUser] 准备创建的数据:', createData);

      const createResult = await database.collection('users').add({
        data: createData
      });

      console.log('🔍 [updateUser] 创建结果:', createResult);
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