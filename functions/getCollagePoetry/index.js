const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()

exports.main = async (event, context) => {
  console.log('=== getCollagePoetry 云函数开始执行 ===')
  console.log('event:', JSON.stringify(event, null, 2))
  console.log('context:', JSON.stringify(context, null, 2))
  
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID || event.openid;
  const { page = 0, pageSize = 10 } = event
  
  try {
    // 获取被屏蔽的用户ID列表（使用缓存）
    let blockedUserIds = [];
    if (openid) {
      try {
        const getBlockedUserIds = require('../_lib/get-blocked-user-ids');
        blockedUserIds = await getBlockedUserIds(openid, db);
      } catch (blockError) {
        console.error('获取屏蔽列表失败:', blockError);
      }
    }

    // 构建查询条件
    const queryConditions = {
      isFoundPoetry: true
    };
    
    // 过滤被屏蔽用户的帖子
    if (blockedUserIds.length > 0) {
      queryConditions._openid = db.command.nin(blockedUserIds);
    }

    // 查询拼贴诗数据（isFoundPoetry为true的帖子）
    console.log('开始查询拼贴诗数据...')
    const result = await db.collection('posts')
      .where(queryConditions)
      .orderBy('createTime', 'desc')
      .skip(page * pageSize)
      .limit(pageSize)
      .get()
    
    console.log('查询结果:', {
      dataLength: result.data.length,
      firstItem: result.data[0] ? {
        _id: result.data[0]._id,
        imageUrls: result.data[0].imageUrls,
        authorAvatar: result.data[0].authorAvatar
      } : null
    })
    
    if (result.data.length === 0) {
      return {
        success: true,
        data: [],
        hasMore: false
      }
    }
    
    // 过滤被屏蔽用户的帖子（包括匿名帖子的realAuthorOpenid）
    const filteredData = result.data.filter(post => {
      if (blockedUserIds.length === 0) return true;
      // 检查普通帖子的 _openid
      if (blockedUserIds.includes(post._openid)) return false;
      // 检查匿名帖子的 realAuthorOpenid
      if (post.realAuthorOpenid && blockedUserIds.includes(post.realAuthorOpenid)) return false;
      return true;
    });
    
    // 处理数据，确保格式正确
    const processedData = filteredData.map(post => ({
      _id: post._id,
      _openid: post._openid,
      authorName: post.authorName || '匿名用户',
      authorAvatar: post.authorAvatar || '',
      imageUrls: post.imageUrls || [],
      votes: post.votes || 0,
      commentCount: post.commentCount || 0,
      isVoted: post.isVoted || false,
      likeIcon: getLikeIcon(post.votes || 0, post.isVoted || false),
      createTime: post.createTime || post.createdAt,
      createdAt: post.createdAt,
      updatedAt: post.updatedAt
    }))
    
    // 转换图片URL：将云存储fileID转换为临时访问URL
    const fileIDs = new Set()
    
    processedData.forEach(post => {
      // 确保 imageUrls 是数组
      if (!Array.isArray(post.imageUrls)) {
        post.imageUrls = post.imageUrls ? [post.imageUrls] : []
      }
      
      // 收集需要转换的fileID（以cloud://开头）
      post.imageUrls.forEach(url => {
        if (url && url.startsWith('cloud://')) {
          fileIDs.add(url)
        }
      })
      
      // 收集作者头像的fileID
      if (post.authorAvatar && post.authorAvatar.startsWith('cloud://')) {
        fileIDs.add(post.authorAvatar)
      }
    })
    
    // 批量转换fileID为临时URL
    if (fileIDs.size > 0) {
      console.log('开始转换图片URL，fileIDs数量:', fileIDs.size)
      console.log('fileIDs列表:', Array.from(fileIDs))
      
      try {
        const fileListResult = await cloud.getTempFileURL({ fileList: Array.from(fileIDs) })
        console.log('getTempFileURL 结果:', fileListResult)
        
        const urlMap = new Map()
        
        fileListResult.fileList.forEach(item => {
          if (item.status === 0) {
            urlMap.set(item.fileID, item.tempFileURL)
          }
        })
        
        console.log('URL映射表:', urlMap)
        
        // 转换所有帖子的图片URL和头像URL
        processedData.forEach(post => {
          const convertUrl = (url) => urlMap.get(url) || url
          
          if (post.imageUrls && Array.isArray(post.imageUrls)) {
            post.imageUrls = post.imageUrls.map(convertUrl)
          }
          if (post.authorAvatar) {
            post.authorAvatar = convertUrl(post.authorAvatar)
          }
        })
        
        console.log('图片URL转换完成')
      } catch (fileError) {
        console.error('图片URL转换失败:', fileError)
        console.error('fileError 详情:', {
          message: fileError.message,
          stack: fileError.stack,
          name: fileError.name
        })
      }
    } else {
      console.log('没有需要转换的图片URL')
    }
    
    return {
      success: true,
      data: processedData,
      hasMore: result.data.length === pageSize
    }
    
  } catch (error) {
    console.error('获取拼贴诗失败:', error)
    return {
      success: false,
      message: error.message || '获取拼贴诗失败'
    }
  }
}

// 获取点赞图标
function getLikeIcon(votes, isVoted) {
  if (votes >= 100) return '/static/images/peachplus.png'
  if (votes >= 50) return '/static/images/flowerplus.png'
  if (votes >= 20) return '/static/images/leafplus.png'
  if (votes >= 10) return '/static/images/seedplus.png'
  return '/static/images/seed.png'
}
