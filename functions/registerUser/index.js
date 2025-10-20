// 云函数入口文件
const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();

// 云函数入口函数
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const { poemId, password, nickName, avatarFileID } = event;

  console.log('🔍 [registerUser] 收到注册请求:', { poemId, nickName, password: password ? '***' : 'undefined' });

  if (!poemId || !password || !nickName) {
    return {
      success: false,
      message: 'Poem ID、密码和昵称不能为空',
      code: 'MISSING_FIELDS'
    };
  }

  try {
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

    // 获取当前用户的openid
    const openid = wxContext.OPENID || event.openid;
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
      await db.collection('users').where({
        _openid: openid
      }).update({
        data: {
          poemId: poemId,
          password: password,
          nickName: nickName,
          // 可选：注册时一并设置头像
          ...(avatarFileID ? { avatarUrl: avatarFileID } : {}),
          updateTime: new Date()
        }
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
      await db.collection('users').add({
        data: {
          _openid: openid,
          poemId: poemId,
          password: password,
          nickName: nickName,
          ...(avatarFileID ? { avatarUrl: avatarFileID } : {}),
          createTime: new Date()
        }
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
