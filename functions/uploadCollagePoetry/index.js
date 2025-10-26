const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()

exports.main = async (event, context) => {
  const { imagePath } = event
  const { OPENID } = cloud.getWXContext()
  
  try {
    // 上传图片到云存储
    const uploadResult = await cloud.uploadFile({
      cloudPath: `collage-poetry/${OPENID}_${Date.now()}.jpg`,
      fileContent: imagePath
    })
    
    if (!uploadResult.fileID) {
      throw new Error('图片上传失败')
    }
    
    // 获取用户信息
    const userResult = await db.collection('users').where({
      _openid: OPENID
    }).get()
    
    if (userResult.data.length === 0) {
      throw new Error('用户不存在')
    }
    
    const userInfo = userResult.data[0]
    
    // 创建拼贴诗记录
    const postData = {
      _openid: OPENID,
      authorName: userInfo.nickName || '微信用户',
      authorAvatar: userInfo.avatarUrl || '',
      title: '', // 拼贴诗不需要标题
      content: '', // 拼贴诗不需要内容
      imageUrls: [uploadResult.fileID],
      originalImageUrls: [uploadResult.fileID],
      tags: ['拼贴诗'],
      votes: 0,
      commentCount: 0,
      isVoted: false,
      isAnonymous: false,
      isOriginal: false,
      isPoem: false,
      isFoundPoetry: true, // 标记为拼贴诗
      createdAt: new Date(),
      updatedAt: new Date()
    }
    
    // 保存到数据库
    const insertResult = await db.collection('posts').add({
      data: postData
    })
    
    if (!insertResult._id) {
      throw new Error('保存失败')
    }
    
    return {
      success: true,
      message: '拼贴诗上传成功',
      postId: insertResult._id,
      imageUrl: uploadResult.fileID
    }
    
  } catch (error) {
    console.error('上传拼贴诗失败:', error)
    return {
      success: false,
      message: error.message || '上传失败'
    }
  }
}

