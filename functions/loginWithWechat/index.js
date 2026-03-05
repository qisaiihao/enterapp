// 云函数：loginWithWechat
// 功能：处理微信小程序登录，未注册用户自动注册
const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();

exports.main = async (event, context) => {
  const { code } = event;
  const wxContext = cloud.getWXContext();
  
  console.log('🔍 [loginWithWechat] 开始处理微信登录');
  console.log('🔍 [loginWithWechat] wxContext:', wxContext);
  
  try {
    // 1. 通过 wxContext 获取 openid
    const { OPENID, UNIONID, APPID } = wxContext;
    
    console.log('🔍 [loginWithWechat] OPENID:', OPENID);
    
    if (!OPENID) {
      console.error('❌ [loginWithWechat] 获取微信用户标识失败');
      return {
        success: false,
        message: '获取微信用户标识失败'
      };
    }
    
    // 2. 查询用户是否已注册
    console.log('🔍 [loginWithWechat] 查询用户是否已注册...');
    const userRes = await db.collection('users')
      .where({
        _openid: OPENID
      })
      .get();
    
    console.log('🔍 [loginWithWechat] 查询结果:', userRes);
    
    if (userRes.data.length > 0) {
      // 用户已注册，直接返回用户信息
      const user = userRes.data[0];
      console.log('✅ [loginWithWechat] 用户已注册，返回用户信息');
      
      return {
        success: true,
        needRegister: false,
        userInfo: user,
        openid: user._openid,
        isPhoneVerified: user.isPhoneVerified || false
      };
    } else {
      // 用户未注册，自动创建账号
      console.log('⚠️ [loginWithWechat] 用户未注册，自动创建账号');
      
      // 生成默认的 Poem ID（使用微信 openid 的一部分）
      const defaultPoemId = `wx_${OPENID.substring(0, 8)}`;
      
      // 检查 Poem ID 是否已存在
      let poemId = defaultPoemId;
      let counter = 1;
      while (true) {
        const checkRes = await db.collection('users')
          .where({ poemId: poemId })
          .count();
        
        if (checkRes.total === 0) {
          break; // Poem ID 可用
        }
        
        // Poem ID 已存在，添加后缀
        poemId = `${defaultPoemId}_${counter}`;
        counter++;
      }
      
      // 创建新用户
      const newUser = {
        _openid: OPENID,
        poemId: poemId,
        nickName: '微信用户',
        avatarUrl: '',
        signature: '',
        isPhoneVerified: false,
        phoneNumber: '',
        createdAt: new Date(),
        updatedAt: new Date(),
        // 其他默认字段
        bio: '',
        occupation: '',
        region: '',
        followingCount: 0,
        fansCount: 0,
        likesCount: 0,
        postsCount: 0
      };
      
      const addRes = await db.collection('users').add({
        data: newUser
      });
      
      console.log('✅ [loginWithWechat] 用户创建成功:', addRes);
      
      // 查询刚创建的用户（获取完整信息）
      const createdUserRes = await db.collection('users')
        .where({ _openid: OPENID })
        .get();
      
      const createdUser = createdUserRes.data[0];
      
      return {
        success: true,
        needRegister: false,
        isNewUser: true, // 标记为新用户
        userInfo: createdUser,
        openid: createdUser._openid,
        isPhoneVerified: false,
        defaultPoemId: poemId // 返回生成的 Poem ID，供前端提示
      };
    }
  } catch (error) {
    console.error('❌ [loginWithWechat] 微信登录失败:', error);
    return {
      success: false,
      message: error.message || '登录失败'
    };
  }
};
