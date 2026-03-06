// 管理员功能云函数
const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()
const _ = db.command

// 验证管理员权限（通过poemId）
async function isAdmin(openid) {
  try {
    const result = await db.collection('users').where({
      _openid: openid,
      poemId: 'qisaihao'
    }).get()
    
    return result.data.length > 0
  } catch (error) {
    console.error('验证管理员权限失败:', error)
    return false
  }
}

// 云函数入口函数
exports.main = async (event, context) => {
  try {
    const action = event.action
    console.log('adminManager 云函数收到操作:', action)

    const wxContext = cloud.getWXContext()
    const openid = wxContext.OPENID || event.openid

    if (!openid) {
      return {
        success: false,
        error: '无法获取用户 openid，请重新登录'
      }
    }

    // 验证管理员权限
    const hasAdminPermission = await isAdmin(openid)
    if (!hasAdminPermission) {
      return {
        success: false,
        error: '权限不足，只有管理员可以执行此操作'
      }
    }

    switch (action) {
      case 'getAllPosts':
        return await getAllPosts(event)
      case 'updatePostType':
        return await updatePostType(event)
      case 'deletePost':
        return await deletePost(event)
      case 'getUserPassword':
        return await getUserPassword(event)
      case 'getPoetList':
        return await getPoetList(event)
      case 'deletePoet':
        return await deletePoet(event)
      default:
        return {
          success: false,
          error: `未知的操作类型: ${action}`
        }
    }
  } catch (error) {
    console.error('adminManager 云函数错误:', error)
    return {
      success: false,
      error: error.message
    }
  }
}

// 获取所有帖子
async function getAllPosts(data) {
  const { page = 0, pageSize = 20 } = data
  
  try {
    const result = await db.collection('posts')
      .orderBy('createTime', 'desc')
      .skip(page * pageSize)
      .limit(pageSize)
      .get()
    
    // 为每个帖子添加 postType 字段，方便前端显示
    const posts = result.data.map(post => {
      let postType = 'normal'
      
      if (post.isDiscussion) {
        postType = 'discussion'
      } else if (post.isPoem) {
        if (post.isOriginal) {
          postType = 'original'
        } else {
          postType = 'non-original'
        }
      }
      
      return {
        ...post,
        postType
      }
    })
    
    return {
      success: true,
      posts
    }
  } catch (error) {
    console.error('获取帖子列表失败:', error)
    return {
      success: false,
      error: '获取帖子列表失败'
    }
  }
}

// 更新帖子类型
async function updatePostType(data) {
  const { postId, postType } = data
  
  if (!postId || !postType) {
    return {
      success: false,
      error: '缺少必要参数'
    }
  }
  
  // 验证帖子类型
  const validTypes = ['normal', 'original', 'non-original', 'discussion']
  if (!validTypes.includes(postType)) {
    return {
      success: false,
      error: '无效的帖子类型'
    }
  }
  
  try {
    // 根据 postType 设置对应的字段
    let updateData = {
      updateTime: new Date()
    }
    
    if (postType === 'discussion') {
      updateData.isDiscussion = true
      updateData.isPoem = false
      updateData.isOriginal = false
    } else if (postType === 'original') {
      updateData.isDiscussion = false
      updateData.isPoem = true
      updateData.isOriginal = true
    } else if (postType === 'non-original') {
      updateData.isDiscussion = false
      updateData.isPoem = true
      updateData.isOriginal = false
    } else { // normal
      updateData.isDiscussion = false
      updateData.isPoem = false
      updateData.isOriginal = false
    }
    
    await db.collection('posts').doc(postId).update({
      data: updateData
    })
    
    return {
      success: true,
      message: '帖子类型更新成功'
    }
  } catch (error) {
    console.error('更新帖子类型失败:', error)
    return {
      success: false,
      error: '更新帖子类型失败'
    }
  }
}

// 删除帖子
async function deletePost(data) {
  const { postId } = data
  
  if (!postId) {
    return {
      success: false,
      error: '缺少帖子ID'
    }
  }
  
  try {
    // 删除帖子
    await db.collection('posts').doc(postId).remove()
    
    // 删除相关评论
    await db.collection('comments').where({
      postId: postId
    }).remove()
    
    // 删除相关收藏
    await db.collection('favorites').where({
      postId: postId
    }).remove()
    
    return {
      success: true,
      message: '帖子删除成功'
    }
  } catch (error) {
    console.error('删除帖子失败:', error)
    return {
      success: false,
      error: '删除帖子失败'
    }
  }
}

// 查询用户密码
async function getUserPassword(data) {
  const { query } = data
  
  if (!query) {
    return {
      success: false,
      error: '请输入昵称或poemid'
    }
  }
  
  try {
    // 先尝试按poemId查询
    let result = await db.collection('users').where({
      poemId: query
    }).get()
    
    // 如果没找到，再按昵称查询
    if (result.data.length === 0) {
      result = await db.collection('users').where({
        nickName: query
      }).get()
    }
    
    if (result.data.length === 0) {
      return {
        success: false,
        error: '未找到该用户'
      }
    }
    
    const user = result.data[0]
    
    return {
      success: true,
      user: {
        nickName: user.nickName,
        poemId: user.poemId,
        password: user.password || '未设置'
      }
    }
  } catch (error) {
    console.error('查询用户失败:', error)
    return {
      success: false,
      error: '查询用户失败'
    }
  }
}

// 获取诗人列表
async function getPoetList(data) {
  const { offset = 0, limit = 20 } = data
  
  try {
    const result = await db.collection('poets')
      .orderBy('updateTime', 'desc')
      .skip(offset)
      .limit(limit)
      .get()
    
    // 为每个诗人统计作品数量
    const poets = await Promise.all(result.data.map(async (poet) => {
      try {
        const countResult = await db.collection('posts')
          .where({
            author: poet.name,
            isPoem: true,
            isOriginal: false
          })
          .count()
        
        return {
          ...poet,
          postCount: countResult.total || 0
        }
      } catch (err) {
        console.error('统计诗人作品数失败:', err)
        return {
          ...poet,
          postCount: 0
        }
      }
    }))
    
    return {
      success: true,
      poets
    }
  } catch (error) {
    console.error('获取诗人列表失败:', error)
    return {
      success: false,
      error: '获取诗人列表失败'
    }
  }
}

// 删除诗人
async function deletePoet(data) {
  const { poetId } = data
  
  if (!poetId) {
    return {
      success: false,
      error: '缺少诗人ID'
    }
  }
  
  try {
    // 删除诗人记录
    await db.collection('poets').doc(poetId).remove()
    
    return {
      success: true,
      message: '诗人删除成功'
    }
  } catch (error) {
    console.error('删除诗人失败:', error)
    return {
      success: false,
      error: '删除诗人失败'
    }
  }
}
