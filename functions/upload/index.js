// 云函数入口文件
const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV }) // 使用当前云环境

// 云函数入口函数
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID || event.openid

  if (!openid) {
    return {
      success: false,
      message: '无法获取用户 openid，请重新登录',
      code: 'NO_OPENID'
    }
  }

  try {
    const res = await cloud.uploadFile({
      cloudPath: event.cloudPath, // 文件在云端的路径，由前端传过来
      fileContent: Buffer.from(event.fileContent, 'base64'), // 文件的二进制内容，由前端传过来
    })
    
    console.log('上传成功，返回结果:', {
      fileID: res.fileID,
      cloudPath: event.cloudPath,
      fileIDType: typeof res.fileID
    });
    
    return {
      success: true,
      fileID: res.fileID,
      cloudPath: event.cloudPath // 把前端传过来的cloudPath再传回去
    }
  } catch (e) {
    return {
      success: false,
      message: '上传失败',
      error: e.message
    }
  }
}
