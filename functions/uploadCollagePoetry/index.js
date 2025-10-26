// 云函数入口文件
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

console.log('=== 云函数启动 ===')
console.log('云环境初始化完成，环境ID:', cloud.DYNAMIC_CURRENT_ENV)

const db = cloud.database()

// 平台检测和兼容性处理
function getDatabaseAndContext() {
  // 检查是否是TCB调用（H5/APP环境）
  if (global.tcb) {
    return {
      db: global.tcb.database(),
      isTCB: true
    }
  }

  // 微信小程序环境
  return {
    db: db,
    isTCB: false
  }
}

// 获取用户ID的兼容函数
function getUserId(wxContext, event, context) {
  // 优先级：event.openid > context.OPENID > wxContext.OPENID > wxContext.claims.openid
  return event.openid || 
         (context && context.OPENID) || 
         wxContext.OPENID || 
         (wxContext.claims && wxContext.claims.openid)
}

exports.main = async (event, context) => {
  console.log('=== 云函数开始执行 ===')
  console.log('event:', JSON.stringify(event, null, 2))
  console.log('context:', JSON.stringify(context, null, 2))
  
  const { fileContent, cloudPath } = event
  const wxContext = cloud.getWXContext()
  const openid = getUserId(wxContext, event, context)
  
  console.log('openid:', openid)
  
  if (!openid) {
    return {
      success: false,
      message: '无法获取用户 openid，请重新登录',
      code: 'NO_OPENID'
    }
  }
  
  try {
    console.log('开始上传拼贴诗，openid:', openid)
    console.log('fileContent 长度:', fileContent ? fileContent.length : 'undefined')
    console.log('cloudPath:', cloudPath)
    
    // 验证输入参数
    if (!fileContent) {
      throw new Error('fileContent 参数缺失')
    }
    
    if (!cloudPath) {
      cloudPath = `collage-poetry/${openid}_${Date.now()}.jpg`
    }
    
    console.log('准备上传到云存储，路径:', cloudPath)
    
    // 上传图片到云存储
    console.log('开始调用 cloud.uploadFile，参数:', {
      cloudPath: cloudPath,
      fileContentLength: fileContent.length,
      fileContentType: typeof fileContent
    })
    
    let uploadResult
    try {
      uploadResult = await cloud.uploadFile({
        cloudPath: cloudPath,
        fileContent: Buffer.from(fileContent, 'base64')
      })
      console.log('cloud.uploadFile 调用完成')
    } catch (uploadError) {
      console.error('cloud.uploadFile 调用失败:', uploadError)
      console.error('上传错误详情:', {
        message: uploadError.message,
        code: uploadError.code,
        errCode: uploadError.errCode,
        errMsg: uploadError.errMsg,
        stack: uploadError.stack
      })
      throw new Error(`云存储上传失败: ${uploadError.message || uploadError.errMsg || '未知错误'}`)
    }
    
    console.log('云存储上传结果:', JSON.stringify(uploadResult, null, 2))
    console.log('uploadResult.fileID:', uploadResult.fileID)
    console.log('uploadResult.fileID 类型:', typeof uploadResult.fileID)
    console.log('uploadResult 所有属性:', Object.keys(uploadResult))
    
    // 检查不同的可能返回格式
    let fileID = uploadResult.fileID || uploadResult.fileid || uploadResult.FileID || uploadResult.file_id
    console.log('提取的 fileID:', fileID)
    console.log('fileID 类型:', typeof fileID)
    
    if (!fileID) {
      console.error('上传结果中没有找到 fileID，完整结果:', uploadResult)
      console.error('尝试的所有字段:', {
        fileID: uploadResult.fileID,
        fileid: uploadResult.fileid,
        FileID: uploadResult.FileID,
        file_id: uploadResult.file_id
      })
      
      // 尝试从其他可能的字段中获取 fileID
      const allKeys = Object.keys(uploadResult)
      console.log('uploadResult 的所有键:', allKeys)
      
      // 查找包含 'file' 或 'id' 的键
      const fileKeys = allKeys.filter(key => 
        key.toLowerCase().includes('file') || 
        key.toLowerCase().includes('id')
      )
      console.log('可能的文件相关键:', fileKeys)
      
      for (const key of fileKeys) {
        console.log(`${key}:`, uploadResult[key], typeof uploadResult[key])
      }
      
      throw new Error('图片上传失败，未返回 fileID')
    }
    
    // 获取用户信息
    const userResult = await db.collection('users').where({
      _openid: openid
    }).get()
    
    if (userResult.data.length === 0) {
      throw new Error('用户不存在')
    }
    
    const userInfo = userResult.data[0]
    
    // 创建拼贴诗记录
    const currentTime = new Date()
    const postData = {
      _openid: openid,
      authorName: userInfo.nickName || '微信用户',
      authorAvatar: userInfo.avatarUrl || '',
      title: '拼贴诗', // 给拼贴诗一个标题
      content: '', // 拼贴诗不需要内容
      imageUrls: [fileID],
      originalImageUrls: [fileID],
      tags: ['拼贴诗'],
      votes: 0,
      commentCount: 0,
      isVoted: false,
      isAnonymous: false,
      isOriginal: false,
      isPoem: false,
      isFoundPoetry: true, // 标记为拼贴诗
      createTime: currentTime, // 添加 createTime 字段用于排序
      createdAt: currentTime,
      updatedAt: currentTime
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
      imageUrl: fileID,
      fileID: fileID
    }
    
  } catch (error) {
    console.error('上传拼贴诗失败:', error)
    console.error('错误堆栈:', error.stack)
    
    // 根据错误类型返回更具体的错误信息
    let errorMessage = '上传失败'
    if (error.message.includes('fileID')) {
      errorMessage = '图片上传失败，未获取到文件ID'
    } else if (error.message.includes('fileContent')) {
      errorMessage = '文件内容无效'
    } else if (error.message.includes('openid')) {
      errorMessage = '用户身份验证失败'
    } else if (error.message.includes('用户不存在')) {
      errorMessage = '用户不存在，请重新登录'
    } else {
      errorMessage = error.message || '上传失败'
    }
    
    return {
      success: false,
      message: errorMessage,
      error: error.message,
      code: error.code || 'UPLOAD_FAILED'
    }
  }
}