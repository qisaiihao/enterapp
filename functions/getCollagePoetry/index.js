const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()

exports.main = async (event, context) => {
  const { page = 0, pageSize = 10 } = event
  
  try {
    // 查询拼贴诗数据（isFoundPoetry为true的帖子）
    const result = await db.collection('posts')
      .where({
        isFoundPoetry: true
      })
      .orderBy('createdAt', 'desc')
      .skip(page * pageSize)
      .limit(pageSize)
      .get()
    
    if (result.data.length === 0) {
      return {
        success: true,
        data: [],
        hasMore: false
      }
    }
    
    // 处理数据，确保格式正确
    const processedData = result.data.map(post => ({
      _id: post._id,
      _openid: post._openid,
      authorName: post.authorName || '匿名用户',
      authorAvatar: post.authorAvatar || '',
      imageUrls: post.imageUrls || [],
      votes: post.votes || 0,
      commentCount: post.commentCount || 0,
      isVoted: post.isVoted || false,
      likeIcon: getLikeIcon(post.votes || 0, post.isVoted || false),
      createdAt: post.createdAt,
      updatedAt: post.updatedAt
    }))
    
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
