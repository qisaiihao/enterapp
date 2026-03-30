// 云函数入口文件
const cloud = require('wx-server-sdk');
const { getUserDefaultAvatar, needsDefaultAvatar } = require('../_lib/default-avatar');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();

// 云函数入口函数
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const { poemId, password, nickName, avatarFileID, phoneNumber, openid: providedOpenid, githubUsername, githubAvatar, githubEmail } = event;

  console.log('🔍 [registerUser] 收到注册请求:', { poemId, nickName, password: password ? '***' : 'undefined', phoneNumber: phoneNumber ? '***' : 'undefined', providedOpenid: providedOpenid ? '***' : 'undefined' });

  if (!poemId || !password || !nickName) {
    return {
      success: false,
      message: 'Poem ID、密码和昵称不能为空',
      code: 'MISSING_FIELDS'
    };
  }

  try {
    // 如果提供了手机号，先检查手机号是否已存在
    if (phoneNumber && phoneNumber.trim()) {
      console.log('🔍 [registerUser] 检查手机号是否已存在');
      const phoneCheckRes = await db.collection('users').where({
        phoneNumber: phoneNumber.trim()
      }).get();
      
      if (phoneCheckRes.data.length > 0) {
        console.log('❌ [registerUser] 手机号已存在');
        return {
          success: false,
          message: '该手机号已注册，请直接登录',
          code: 'PHONE_ALREADY_EXISTS'
        };
      }
      console.log('✅ [registerUser] 手机号可用');
    }
    
    // 检查Poem ID是否已存在
    const existingUserRes = await db.collection('users').where({
      poemId: poemId
    }).get();

    console.log('🔍 [registerUser] 检查Poem ID是否存在:', existingUserRes);

    if (existingUserRes.data.length > 0) {
      return {
        success: false,
        message: '该Poem ID已被使用，请选择其他ID',
        code: 'POEM_ID_EXISTS'
      };
    }

    // 获取当前用户的openid（优先使用传入的 openid，用于 GitHub 登录）
    const openid = providedOpenid || wxContext.OPENID || event.openid;
    if (!openid) {
      return {
        success: false,
        message: '无法获取用户标识，请重新登录',
        code: 'NO_OPENID'
      };
    }

    // 检查openid是否已注册
    const existingOpenidRes = await db.collection('users').where({
      _openid: openid
    }).get();

    if (existingOpenidRes.data.length > 0) {
      // 用户已存在，更新信息
      console.log('🔍 [registerUser] 用户已存在，更新信息');
      const existingUser = existingOpenidRes.data[0] || {};
      const resolvedAvatarUrl = avatarFileID || (needsDefaultAvatar(existingUser.avatarUrl) ? getUserDefaultAvatar(openid) : existingUser.avatarUrl);
      const updateData = {
        poemId: poemId,
        password: password,
        nickName: nickName,
        avatarUrl: resolvedAvatarUrl,
        updateTime: new Date()
      };
      
      // 如果提供了手机号，添加到更新数据中
      if (phoneNumber && phoneNumber.trim()) {
        updateData.phoneNumber = phoneNumber.trim();
        updateData.isPhoneVerified = true;
      }
      
      // 如果提供了 GitHub 信息，添加到更新数据中
      if (githubUsername) updateData.githubUsername = githubUsername;
      if (githubAvatar) updateData.githubAvatar = githubAvatar;
      if (githubEmail) updateData.githubEmail = githubEmail;
      
      await db.collection('users').where({
        _openid: openid
      }).update({
        data: updateData
      });

      // 获取更新后的用户信息
      const updatedUserRes = await db.collection('users').where({
        _openid: openid
      }).get();

      const userInfo = updatedUserRes.data[0];
      const { password: _, ...safeUserInfo } = userInfo;

      return {
        success: true,
        message: '账号信息更新成功',
        userInfo: safeUserInfo,
        openid: openid
      };
    } else {
      // 创建新用户
      console.log('🔍 [registerUser] 创建新用户');
      const createData = {
        _openid: openid,
        poemId: poemId,
        password: password,
        nickName: nickName,
        avatarUrl: avatarFileID || getUserDefaultAvatar(openid),
        growthCounts: { seed: 0, leaf: 0, flower: 0 },
        growthUpdatedAt: db.serverDate(),
        createTime: new Date()
      };
      
      // 如果提供了手机号，添加到创建数据中
      if (phoneNumber && phoneNumber.trim()) {
        createData.phoneNumber = phoneNumber.trim();
        createData.isPhoneVerified = true;
      }
      
      // 如果提供了 GitHub 信息，添加到创建数据中
      if (githubUsername) createData.githubUsername = githubUsername;
      if (githubAvatar) createData.githubAvatar = githubAvatar;
      if (githubEmail) createData.githubEmail = githubEmail;
      
      await db.collection('users').add({
        data: createData
      });

      // 为新用户创建默认作品集
      console.log('🔍 [registerUser] 为新用户创建默认作品集');
      try {
        await db.collection('portfolios').add({
          data: {
            _openid: openid,
            name: '我的作品集',
            description: '这是我的默认作品集',
            itemCount: 0,
            items: [],
            createTime: new Date(),
            updateTime: new Date(),
            isPublic: false,
            coverImage: '',
            tags: [],
            isDefault: true // 标记为默认作品集
          }
        });
        console.log('✅ [registerUser] 默认作品集创建成功');
      } catch (portfolioError) {
        console.error('❌ [registerUser] 创建默认作品集失败:', portfolioError);
        // 即使创建默认作品集失败，也不影响用户注册流程
      }

      // 获取创建的用户信息
      const newUserRes = await db.collection('users').where({
        _openid: openid
      }).get();

      const userInfo = newUserRes.data[0];
      const { password: _, ...safeUserInfo } = userInfo;

      return {
        success: true,
        message: '注册成功',
        userInfo: safeUserInfo,
        openid: openid
      };
    }

  } catch (error) {
    console.error('❌ [registerUser] 注册失败:', error);
    return {
      success: false,
      message: '注册失败，请重试',
      code: 'REGISTER_ERROR',
      error: error.message
    };
  }
};
