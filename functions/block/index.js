const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();
const _ = db.command;

// 引入屏蔽名单缓存工具
const blockedCache = require('../../utils/blocked-users-cache');

exports.main = async (event, context) => {
  console.log('🔍 [block] 云函数开始执行，event:', JSON.stringify(event));
  
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID || event.openid;
  console.log('🔍 [block] openid:', openid ? '已获取' : '未获取');

  if (!openid) {
    console.error('❌ [block] 无法获取用户 openid');
    return {
      success: false,
      message: '无法获取用户 openid，请重新登录',
      code: 'NO_OPENID'
    };
  }

  const { action } = event;
  console.log('🔍 [block] action:', action);

  if (!action) {
    console.error('❌ [block] 缺少 action 参数');
    return {
      success: false,
      message: '缺少操作类型'
    };
  }

  try {
    let result;
    switch (action) {
      case 'toggleBlock':
        result = await toggleBlock(openid, event.targetOpenid);
        break;
      case 'getBlockedList':
        result = await getBlockedList(openid, event.skip || 0, event.limit || 20);
        break;
      case 'checkBlock':
        result = await checkBlock(openid, event.targetOpenid);
        break;
      case 'getBlockedUserIds':
        result = await getBlockedUserIds(openid);
        break;
      default:
        console.error('❌ [block] 未知操作:', action);
        return {
          success: false,
          message: '未知操作'
        };
    }
    
    console.log('✅ [block] 操作成功，返回结果:', result);
    return result;
  } catch (error) {
    console.error('❌ [block] 模块执行失败:', error);
    console.error('❌ [block] 错误详情:', {
      message: error.message,
      code: error.errCode || error.code,
      errMsg: error.errMsg,
      stack: error.stack
    });
    
    // 返回更详细的错误信息
    const errorMessage = error.errMsg || error.message || '操作失败';
    return {
      success: false,
      message: errorMessage,
      error: error.message,
      code: error.errCode || error.code
    };
  }
};

// 切换屏蔽状态
async function toggleBlock(blockerId, targetOpenid) {
  console.log('🔍 [toggleBlock] 开始执行，blockerId:', blockerId, 'targetOpenid:', targetOpenid);
  
  if (!targetOpenid) {
    console.error('❌ [toggleBlock] 缺少目标用户');
    return {
      success: false,
      message: '缺少目标用户'
    };
  }

  if (targetOpenid === blockerId) {
    console.error('❌ [toggleBlock] 不能屏蔽自己');
    return {
      success: false,
      message: '不能屏蔽自己'
    };
  }

  try {
    const blocksCollection = db.collection('blocks');
    
    console.log('🔍 [toggleBlock] 查询现有屏蔽关系...');
    let existing;
    try {
      existing = await blocksCollection.where({
        blockerId,
        blockedId: targetOpenid
      }).limit(1).get();
    } catch (queryError) {
      // 如果集合不存在（错误码 -502005），尝试通过添加记录来创建集合
      if (queryError.errCode === -502005 || queryError.code === -502005) {
        console.log('🔍 [toggleBlock] 集合不存在，尝试通过添加记录创建集合...');
        try {
          // 直接添加屏蔽记录，这会自动创建集合（如果权限允许）
          const addResult = await blocksCollection.add({
            data: {
              blockerId,
              blockedId: targetOpenid,
              createTime: new Date()
            }
          });
          console.log('✅ [toggleBlock] 集合已创建并添加屏蔽记录，记录ID:', addResult._id);
          
          // 更新缓存：添加到缓存中
          blockedCache.updateCache(blockerId, targetOpenid, true);
          console.log('✅ [toggleBlock] 已更新缓存（添加屏蔽）');
          
          // 取消关注关系
          try {
            const followsCollection = db.collection('follows');
            const followRecord = await followsCollection.where({
              followerId: blockerId,
              followedId: targetOpenid
            }).limit(1).get();
            
            if (followRecord.data.length > 0) {
              await followsCollection.doc(followRecord.data[0]._id).remove();
              console.log('✅ [toggleBlock] 取消关注关系成功');
            }
          } catch (followError) {
            console.error('⚠️ [toggleBlock] 取消关注关系失败:', followError);
          }
          
          return {
            success: true,
            isBlocked: true
          };
        } catch (addError) {
          console.error('❌ [toggleBlock] 无法创建集合或添加记录:', addError);
          return {
            success: false,
            message: '数据库集合不存在，请在云开发控制台手动创建 blocks 集合',
            code: 'COLLECTION_NOT_EXIST'
          };
        }
      } else {
        // 其他错误直接抛出
        throw queryError;
      }
    }
    
    console.log('🔍 [toggleBlock] 查询结果:', existing.data.length > 0 ? '已存在' : '不存在');

    if (existing.data.length > 0) {
      // 取消屏蔽
      console.log('🔍 [toggleBlock] 取消屏蔽，记录ID:', existing.data[0]._id);
      await blocksCollection.doc(existing.data[0]._id).remove();
      console.log('✅ [toggleBlock] 取消屏蔽成功');
      
      // 更新缓存：从缓存中移除该用户
      blockedCache.updateCache(blockerId, targetOpenid, false);
      console.log('✅ [toggleBlock] 已更新缓存（移除屏蔽）');
      
      // 同时取消关注关系（如果存在）
      try {
        const followsCollection = db.collection('follows');
        const followRecord = await followsCollection.where({
          followerId: blockerId,
          followedId: targetOpenid
        }).limit(1).get();
        
        if (followRecord.data.length > 0) {
          await followsCollection.doc(followRecord.data[0]._id).remove();
          console.log('✅ [toggleBlock] 取消关注关系成功');
        }
      } catch (followError) {
        console.error('⚠️ [toggleBlock] 取消关注关系失败:', followError);
        // 不影响取消屏蔽操作
      }
      
      return {
        success: true,
        isBlocked: false
      };
    }

    // 添加屏蔽
    console.log('🔍 [toggleBlock] 添加屏蔽...');
    const addResult = await blocksCollection.add({
      data: {
        blockerId,
        blockedId: targetOpenid,
        createTime: new Date()
      }
    });
    console.log('✅ [toggleBlock] 添加屏蔽成功，记录ID:', addResult._id);

    // 更新缓存：添加到缓存中
    blockedCache.updateCache(blockerId, targetOpenid, true);
    console.log('✅ [toggleBlock] 已更新缓存（添加屏蔽）');

    // 屏蔽时自动取消关注关系（如果存在）
    try {
      const followsCollection = db.collection('follows');
      const followRecord = await followsCollection.where({
        followerId: blockerId,
        followedId: targetOpenid
      }).limit(1).get();
      
      if (followRecord.data.length > 0) {
        await followsCollection.doc(followRecord.data[0]._id).remove();
        console.log('✅ [toggleBlock] 取消关注关系成功');
      }
    } catch (followError) {
      console.error('⚠️ [toggleBlock] 取消关注关系失败:', followError);
      // 不影响屏蔽操作
    }

    console.log('✅ [toggleBlock] 操作完成，已屏蔽用户');
    return {
      success: true,
      isBlocked: true
    };
  } catch (error) {
    console.error('❌ [toggleBlock] 执行失败:', error);
    console.error('❌ [toggleBlock] 错误详情:', {
      message: error.message,
      code: error.errCode || error.code,
      stack: error.stack
    });
    throw error; // 重新抛出错误，让外层 catch 处理
  }
}

// 获取屏蔽列表
async function getBlockedList(blockerId, skip, limit) {
  const blocksCollection = db.collection('blocks');

  const [listRes, totalRes] = await Promise.all([
    blocksCollection.where({ blockerId })
      .orderBy('createTime', 'desc')
      .skip(skip)
      .limit(limit)
      .get(),
    blocksCollection.where({ blockerId }).count()
  ]);

  const blocks = listRes.data || [];
  const total = totalRes.total || 0;

  if (blocks.length === 0) {
    return {
      success: true,
      list: [],
      total,
      hasMore: false
    };
  }

  const blockedIds = blocks.map(item => item.blockedId);

  const usersRes = await db.collection('users')
    .where({ _openid: _.in(blockedIds) })
    .get();

  const userMap = new Map();
  usersRes.data.forEach(user => {
    userMap.set(user._openid, user);
  });

  const list = blocks.map(item => {
    const user = userMap.get(item.blockedId) || {};
    return {
      _openid: item.blockedId,
      nickName: user.nickName || '微信用户',
      avatarUrl: user.avatarUrl || '',
      bio: user.bio || '',
      blockedAt: item.createTime || null
    };
  });

  await enrichAvatarUrls(list);

  return {
    success: true,
    list,
    total,
    hasMore: skip + blocks.length < total
  };
}

// 检查是否屏蔽了某个用户
async function checkBlock(blockerId, targetOpenid) {
  if (!targetOpenid) {
    return {
      success: false,
      message: '缺少目标用户'
    };
  }

  if (targetOpenid === blockerId) {
    return {
      success: true,
      isBlocked: false
    };
  }

  const blocksCollection = db.collection('blocks');

  const blockRes = await blocksCollection.where({
    blockerId,
    blockedId: targetOpenid
  }).limit(1).get();

  const isBlocked = blockRes.data.length > 0;

  return {
    success: true,
    isBlocked
  };
}

// 获取被屏蔽的用户ID列表（用于过滤帖子）
// 使用缓存机制减少数据库查询
async function getBlockedUserIds(blockerId) {
  if (!blockerId) {
    return [];
  }

  // 先尝试从缓存获取
  const cached = blockedCache.getCachedBlockedIds(blockerId);
  if (cached !== null) {
    console.log('✅ [getBlockedUserIds] 从缓存获取，数量:', cached.length);
    return cached;
  }

  // 缓存未命中，从数据库查询
  try {
    const blocksCollection = db.collection('blocks');
    const blocksRes = await blocksCollection.where({
      blockerId
    }).field({ blockedId: true }).get();

    const blockedIds = blocksRes.data.map(item => item.blockedId);
    
    // 写入缓存
    blockedCache.setCachedBlockedIds(blockerId, blockedIds);
    console.log('✅ [getBlockedUserIds] 从数据库查询并缓存，数量:', blockedIds.length);
    
    return blockedIds;
  } catch (error) {
    console.error('❌ [getBlockedUserIds] 获取屏蔽用户列表失败:', error);
    return [];
  }
}

// 处理头像URL
async function enrichAvatarUrls(list) {
  const fileIDs = Array.from(new Set(
    list
      .filter(user => user.avatarUrl && user.avatarUrl.startsWith('cloud://'))
      .map(user => user.avatarUrl)
  ));

  if (fileIDs.length === 0) {
    return;
  }

  try {
    const tempUrls = await cloud.getTempFileURL({ fileList: fileIDs });
    const urlMap = new Map();

    tempUrls.fileList.forEach(file => {
      if (file.status === 0) {
        urlMap.set(file.fileID, file.tempFileURL);
      }
    });

    list.forEach(user => {
      if (user.avatarUrl && urlMap.has(user.avatarUrl)) {
        user.avatarUrl = urlMap.get(user.avatarUrl);
      }
    });
  } catch (error) {
    console.error('block 头像URL转换失败:', error);
  }
}

