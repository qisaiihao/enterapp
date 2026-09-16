// 云函数入口文件
const cloud = require('wx-server-sdk')
const { ensureDefaultPortfolio } = require('./_lib/ensure-default-portfolio')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

async function ensureUserPortfolio(openid) {
  try {
    await ensureDefaultPortfolio(db, openid)
  } catch (error) {
    // 保留创建账号成功的结果，首次打开列表时仍可重试补建。
    console.error('❌ [createUser] 初始化默认作品集失败:', error)
  }
}

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

  const { nickName, avatarFileID, poemId, password } = event

  try {
    // 检查用户是否已存在
    const userRecord = await db.collection('users').where({ _openid: openid }).get()

    if (userRecord.data.length > 0) {
      // 用户已存在，执行更新操作
      const updateData = {
        nickName: nickName,
        avatarUrl: avatarFileID,
        updateTime: new Date()
      };
      
      // 如果提供了poemId和password，则更新这些字段
      if (poemId) updateData.poemId = poemId;
      if (password) updateData.password = password;
      
      await db.collection('users').doc(userRecord.data[0]._id).update({
        data: updateData
      })
      await ensureUserPortfolio(openid)
      return { success: true, message: '用户信息更新成功' }
    } else {
      // 用户不存在，执行创建操作
      const createData = {
        _openid: openid,
        nickName: nickName,
        avatarUrl: avatarFileID,
        showGrowthStats: false,
        createTime: new Date()
      };
      
      // 如果提供了poemId和password，则添加到创建数据中
      if (poemId) createData.poemId = poemId;
      if (password) createData.password = password;
      
      await db.collection('users').add({
        data: createData
      })

      await ensureUserPortfolio(openid)

      return { success: true, message: '用户创建成功' }
    }
  } catch (e) {
    console.error(e)
    return { success: false, error: e }
  }
}
