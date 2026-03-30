const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();

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

  console.log('🔍 [updateUserProfile] 用户ID获取详情:', {
    eventOpenid: event.openid,
    contextOpenid: context.OPENID,
    wxContextOpenid: wxContext.OPENID,
    wxClaimsOpenid: wxContext.claims && wxContext.claims.openid,
    finalOpenid: openid,
    platform: global.tcb ? 'TCB' : 'WeApp'
  });

  return openid;
}

// 更新用户资料
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();

  // 获取兼容的数据库实例和上下文
  const { db: database, isTCB } = getDatabaseAndContext();

  // 获取用户标识
  const openid = getUserId(wxContext, event, context);

  if (!openid) {
    return {
      success: false,
      message: '无法获取用户身份信息，请重新登录',
      code: 'NO_OPENID'
    };
  }

  const { avatarUrl, nickName, birthday, bio, signatureUrl, occupation, region, poemId, password } = event;

  console.log('🔍 [updateUserProfile] 收到的参数:', {
    nickName,
    avatarUrl,
    birthday,
    bio,
    occupation,
    region,
    poemId,
    password: password ? '***' : 'undefined',
    platform: isTCB ? 'TCB' : 'WeApp'
  });

  try {
    const updateData = {};

    // Only add fields to the update object if they are provided
    if (avatarUrl) {
      updateData.avatarUrl = avatarUrl; // This is the new fileID
      console.log('🔍 [updateUserProfile] 将更新avatarUrl');
    }
    if (nickName) {
      updateData.nickName = nickName;
      console.log('🔍 [updateUserProfile] 将更新nickName');
    }
    if (birthday) {
      updateData.birthday = birthday;
      console.log('🔍 [updateUserProfile] 将更新birthday');
    }
    if (bio) {
      updateData.bio = bio;
      console.log('🔍 [updateUserProfile] 将更新bio');
    }
    if (signatureUrl) {
      updateData.signatureUrl = signatureUrl;
      console.log('🔍 [updateUserProfile] 将更新signatureUrl');
    }
    if (occupation !== undefined) {
      updateData.occupation = occupation;
      console.log('🔍 [updateUserProfile] 将更新occupation');
    }
    if (region !== undefined) {
      updateData.region = region;
      console.log('🔍 [updateUserProfile] 将更新region');
    }

    // 添加对poemId和password字段的支持
    if (poemId) {
      updateData.poemId = poemId;
      console.log('🔍 [updateUserProfile] 将更新poemId:', poemId);
    }
    if (password) {
      updateData.password = password;
      console.log('🔍 [updateUserProfile] 将更新password');
    }

    // Check if there is anything to update
    if (Object.keys(updateData).length === 0) {
      console.log('🔍 [updateUserProfile] 没有需要更新的内容');
      return { success: false, message: '没有需要更新的内容' };
    }

    console.log('🔍 [updateUserProfile] 准备更新的数据:', updateData);

    const updateResult = await database.collection('users').where({ _openid: openid }).update({
      data: updateData
    });

    console.log('🔍 [updateUserProfile] 更新结果:', updateResult);

    // 如果更新了昵称、头像或签名，异步同步到历史帖子（不阻塞返回）
    // 只传递实际更新的字段，避免覆盖未修改的数据
    if (updateResult.stats && updateResult.stats.updated > 0) {
      const syncData = { openid: openid };
      
      // 只有在 updateData 中实际包含了这些字段时才传递
      if (updateData.nickName) {
        syncData.nickName = updateData.nickName;
      }
      if (updateData.avatarUrl) {
        syncData.avatarUrl = updateData.avatarUrl;
      }
      if (signatureUrl !== undefined) {
        // 注意：如果用户删除签名（传入空字符串），也需要同步更新
        syncData.signatureUrl = signatureUrl || '';
      }
      
      // 只有当至少有一个字段需要同步时才调用
      if (syncData.nickName || syncData.avatarUrl || signatureUrl !== undefined) {
        console.log('🔄 [updateUserProfile] 检测到昵称、头像或签名更新，开始异步同步历史帖子...', {
          hasNickName: !!syncData.nickName,
          hasAvatarUrl: !!syncData.avatarUrl,
          hasSignatureUrl: signatureUrl !== undefined
        });
        cloud.callFunction({
          name: 'syncUserPostsMetadata',
          data: syncData
        }).then((syncResult) => {
          console.log('✅ [updateUserProfile] 历史帖子同步完成:', syncResult);
        }).catch((syncError) => {
          console.error('❌ [updateUserProfile] 历史帖子同步失败（不影响主流程）:', syncError);
        });
      }
    }

    return {
      success: true,
      message: '用户资料更新成功',
      platform: isTCB ? 'TCB' : 'WeApp'
    };

  } catch (e) {
    console.error('❌ [updateUserProfile] 数据库操作失败:', e);
    console.error('❌ [updateUserProfile] 错误详情:', JSON.stringify(e, null, 2));
    console.error('❌ [updateUserProfile] 错误消息:', e.message);

    return {
      success: false,
      message: '数据库更新失败: ' + (e.message || '未知错误'),
      error: e.message || e.toString(),
      platform: isTCB ? 'TCB' : 'WeApp'
    };
  }
};
