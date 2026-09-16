// 反馈管理云函数
const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()
const _ = db.command
const { createHash } = require('crypto')
const { isAdminByPoemId, listAdminUsersByPoemId } = require('./_lib/admin-auth')

const STATUS = ['pending', 'processing', 'waiting_user', 'closed']
function normalizeFeedback(feedback) {
  return { ...feedback, status: STATUS.includes(feedback.status) ? feedback.status : (feedback.isProcessed ? 'closed' : 'pending') }
}
function pagination({ skip = 0, limit = 20 } = {}) {
  return { skip: Math.max(0, Math.floor(Number(skip) || 0)), limit: Math.min(50, Math.max(1, Math.floor(Number(limit) || 20))) }
}
async function readDocument(ref) {
  try { return await ref.get() }
  catch (error) {
    // wx-server-sdk 默认对不存在的文档抛错；仅将这类错误视为空记录。
    const message = String(error.errMsg || error.message || error)
    if (/document with _id .+ does not exist/.test(message)) return { data: null }
    throw error
  }
}
function validateContent(content, images) {
  if (typeof content !== 'string' || !content.trim() || content.trim().length > 500) throw new Error('请输入1至500字的内容')
  if (!Array.isArray(images) || images.length > 3 || images.some(url => typeof url !== 'string' || !url.startsWith('cloud://') || url.length > 1000)) throw new Error('最多上传3张有效图片')
}
async function checkAdmin(openid) {
  return isAdminByPoemId({ db, command: _, openid, loggerPrefix: 'feedbackManager' })
}
async function getMyFeedbackList(openid, data) {
  const { skip, limit } = pagination(data)
  const result = await db.collection('feedback').where({ userOpenid: openid, deleted: _.neq(true) })
    .orderBy('createTime', 'desc').skip(skip).limit(limit).get()
  return { success: true, feedbackList: result.data.map(normalizeFeedback) }
}
async function getFeedbackDetail(openid, data) {
  if (typeof data.feedbackId !== 'string' || !data.feedbackId) throw new Error('反馈ID不能为空')
  const result = await readDocument(db.collection('feedback').doc(data.feedbackId))
  if (!result.data || result.data.deleted) throw new Error('反馈不存在或已删除')
  const isAdmin = await checkAdmin(openid)
  if (!isAdmin && result.data.userOpenid !== openid) throw new Error('无权查看此反馈')
  const { skip, limit } = pagination(data)
  const replies = await db.collection('feedbackReplies').where({ feedbackId: data.feedbackId })
    .orderBy('sequence', 'desc').skip(skip).limit(limit).get()
  return { success: true, feedback: normalizeFeedback(result.data), replies: replies.data, isAdmin, hasMore: replies.data.length === limit }
}

async function replyFeedback(openid, data) {
  const { feedbackId, content, imageUrls = [], requestId, status } = data
  if (typeof feedbackId !== 'string' || !feedbackId) throw new Error('反馈ID不能为空')
  validateContent(content, imageUrls)
  if (typeof requestId !== 'string' || !/^[a-zA-Z0-9_-]{8,100}$/.test(requestId)) throw new Error('发送标识无效，请重试')
  const isAdmin = await checkAdmin(openid)
  if (isAdmin && !['processing', 'waiting_user', 'closed'].includes(status)) throw new Error('处理状态无效')
  if (!isAdmin && status) throw new Error('只有管理员可以设置状态')
  const userResult = await db.collection('users').where({ _openid: openid }).limit(1).get()
  const sender = userResult.data[0] || {}
  const name = sender.nickName || (isAdmin ? '管理员' : '用户')
  const adminUsers = isAdmin ? [] : await listAdminUsersByPoemId({ db, command: _, loggerPrefix: 'feedbackManager' })
  const replyId = createHash('sha256').update(JSON.stringify([feedbackId, openid, requestId])).digest('hex')
  const payloadHash = createHash('sha256').update(JSON.stringify([content.trim(), imageUrls, status || ''])).digest('hex')
  return db.runTransaction(async transaction => {
    const ref = transaction.collection('feedback').doc(feedbackId)
    const result = await readDocument(ref)
    if (!result.data || result.data.deleted) throw new Error('反馈不存在或已删除')
    const feedback = normalizeFeedback(result.data)
    if (!isAdmin && feedback.userOpenid !== openid) throw new Error('无权补充此反馈')
    if (!feedback.userOpenid) throw new Error('反馈用户信息缺失')
    const replyRef = transaction.collection('feedbackReplies').doc(replyId)
    const existing = await readDocument(replyRef)
    if (existing.data) {
      if (existing.data.payloadHash !== payloadHash) throw new Error('发送内容已改变，请重新发送')
      return { success: true, alreadySent: true, status: feedback.status }
    }
    if (feedback.status === 'closed') throw new Error('反馈已办结，如有新问题请提交新的反馈')
    const recipients = isAdmin ? [feedback.userOpenid] : [...new Set(adminUsers.map(user => user._openid).filter(Boolean))]
    if (!recipients.length) throw new Error('暂时无法通知管理员，请稍后重试')
    const nextStatus = isAdmin ? status : 'processing'
    const now = new Date()
    const sequence = (feedback.replyCount || 0) + 1
    await replyRef.set({ data: {
      feedbackId, content: content.trim(), imageUrls, senderId: openid, senderName: name,
      role: isAdmin ? 'admin' : 'user', status: nextStatus, createTime: now, sequence, payloadHash
    } })
    await ref.update({ data: {
      status: nextStatus, isProcessed: nextStatus === 'closed', updatedAt: now, replyCount: sequence,
      lastReply: content.trim(), lastReplyRole: isAdmin ? 'admin' : 'user',
      ...(nextStatus === 'closed' ? { processedTime: now, processedBy: openid } : {})
    } })
    const type = !isAdmin ? 'feedback_reply' : nextStatus === 'closed' ? 'feedback_processed' : nextStatus === 'waiting_user' ? 'feedback_detail_requested' : 'feedback_reply'
    const actionText = !isAdmin ? '补充了反馈信息' : nextStatus === 'closed' ? '办结了您的反馈' : nextStatus === 'waiting_user' ? '请您补充反馈细节' : '回复了您的反馈'
    for (const recipient of recipients) {
      if (recipient === openid) continue
      await transaction.collection('messages').add({ data: {
        fromUserId: openid, fromUserName: name, fromUserAvatar: sender.avatarUrl || '', toUserId: recipient,
        type, feedbackId, replyId, feedbackContent: feedback.content || '', replyContent: content.trim(),
        feedbackRole: isAdmin ? 'admin' : 'user', content: `${name}${actionText}`, isRead: false, createTime: now
      } })
    }
    return { success: true, status: nextStatus }
  })
}

// 验证管理员权限（通过poemId）

// 云函数入口函数
exports.main = async (event, context) => {
  try {
    const action = event.action
    console.log('feedbackManager 云函数收到操作:', action)

    const wxContext = cloud.getWXContext()
    const openid = wxContext.OPENID || event.openid

    if (!openid) {
      return {
        success: false,
        message: '无法获取用户 openid，请重新登录',
        code: 'NO_OPENID'
      }
    }

    switch (action) {
      case 'submitFeedback':
        return await submitFeedback(openid, event)
      case 'getFeedbackList':
        return await getFeedbackList(openid, event)
      case 'getMyFeedbackList':
        return await getMyFeedbackList(openid, event)
      case 'getFeedbackDetail':
        return await getFeedbackDetail(openid, event)
      case 'replyFeedback':
        return await replyFeedback(openid, event)
      case 'deleteFeedback':
        return await deleteFeedback(openid, event)
      case 'markAsProcessed':
        return await markAsProcessed(openid, event)
      default:
        console.error('未知的操作类型:', action)
        return {
          success: false,
          error: `未知的操作类型: ${action}`
        }
    }
  } catch (error) {
    console.error('feedbackManager 云函数错误:', error)
    return {
      success: false,
      error: error.message
    }
  }
}

// 提交反馈
async function submitFeedback(openid, data) {
  const { content, imageUrls = [] } = data
  validateContent(content, imageUrls)
  
  try {
    // 获取用户资料
    const userResult = await db.collection('users').where({
      _openid: openid
    }).get()
    
    const userName = userResult.data.length > 0 ? userResult.data[0].nickName : '匿名用户'
    
    // 创建反馈记录
    const feedbackData = {
      content: content.trim(),
      imageUrls: imageUrls,
      userName: userName,
      userOpenid: openid,
      isProcessed: false,
      status: 'pending',
      createTime: new Date(),
      processedTime: null
    }
    
    const result = await db.collection('feedback').add({
      data: feedbackData
    })
    
    console.log('反馈提交成功:', result)
    
    // === 新增：通知管理员有新反馈 ===
    try {
      // 管理员名单统一从 adminConfig 数据库配置读取
      const adminUsers = await listAdminUsersByPoemId({ db, command: _, loggerPrefix: 'feedbackManager' })
      const adminOpenids = Array.from(new Set(
        adminUsers
          .map((user) => user && user._openid)
          .filter(Boolean)
      ))

      for (const adminOpenid of adminOpenids) {
        await db.collection('messages').add({
          data: {
            fromUserId: openid,
            fromUserName: userName,
            fromUserAvatar: userResult.data.length > 0 ? userResult.data[0].avatarUrl : '',
            toUserId: adminOpenid,
            type: 'feedback',
            feedbackId: result._id,
            feedbackContent: content.trim(),
            content: `${userName} 提交了新的意见反馈`,
            isRead: false,
            createTime: new Date()
          }
        })
      }
      console.log('反馈通知已发送给管理员')
    } catch (msgError) {
      console.error('发送反馈通知失败:', msgError)
      // 不影响主流程，只是记录错误
    }
    
    return {
      success: true,
      feedbackId: result._id,
      message: '反馈提交成功'
    }
  } catch (error) {
    console.error('提交反馈失败:', error)
    throw new Error(`提交反馈失败: ${error.message}`)
  }
}

// 获取反馈列表（管理员）
async function getFeedbackList(openid, data) {
  const { skip, limit } = pagination(data)
  
  try {
    // 检查管理员权限
    const hasAdminPermission = await isAdminByPoemId({ db, command: _, openid, loggerPrefix: 'feedbackManager' })
    if (!hasAdminPermission) {
      return {
        success: false,
        error: '权限不足，只有管理员可以查看反馈列表'
      }
    }
    
    const result = await db.collection('feedback')
      .where({ deleted: _.neq(true) })
      .orderBy('createTime', 'desc')
      .skip(skip)
      .limit(limit)
      .get()
    
    console.log('获取反馈列表成功:', result.data.length)
    
    return {
      success: true,
      feedbackList: result.data.map(normalizeFeedback),
      total: result.data.length
    }
  } catch (error) {
    console.error('获取反馈列表失败:', error)
    throw new Error(`获取反馈列表失败: ${error.message}`)
  }
}

// 删除反馈（管理员）
async function deleteFeedback(openid, data) {
  const { feedbackId } = data
  if (typeof feedbackId !== 'string' || !feedbackId) return { success: false, error: '反馈ID不能为空' }
  
  try {
    // 检查管理员权限
    const hasAdminPermission = await isAdminByPoemId({ db, command: _, openid, loggerPrefix: 'feedbackManager' })
    if (!hasAdminPermission) {
      return {
        success: false,
        error: '权限不足，只有管理员可以删除反馈'
      }
    }
    
    // 保留回复及图片的关联，删除后所有详情/回复接口均拒绝访问。
    await db.runTransaction(async transaction => {
      const ref = transaction.collection('feedback').doc(feedbackId)
      const result = await readDocument(ref)
      if (!result.data) throw new Error('反馈不存在')
      await ref.update({ data: { deleted: true, deletedAt: new Date(), deletedBy: openid } })
    })
    
    return {
      success: true,
      message: '反馈删除成功'
    }
  } catch (error) {
    console.error('删除反馈失败:', error)
    throw new Error(`删除反馈失败: ${error.message}`)
  }
}

// 标记反馈为已处理（管理员）
async function markAsProcessed(openid, data) {
  const { feedbackId } = data
  if (!feedbackId || typeof feedbackId !== 'string') {
    return { success: false, error: '反馈ID不能为空' }
  }
  
  try {
    // 检查管理员权限
    const hasAdminPermission = await isAdminByPoemId({ db, command: _, openid, loggerPrefix: 'feedbackManager' })
    if (!hasAdminPermission) {
      return {
        success: false,
        error: '权限不足，只有管理员可以处理反馈'
      }
    }
    
    const userResult = await db.collection('users').where({ _openid: openid }).limit(1).get()
    const admin = userResult.data[0] || {}
    const adminName = admin.nickName || '管理员'

    // 状态和通知一起提交；并发点击或请求重试不会重复发送通知。
    return await db.runTransaction(async transaction => {
      const feedbackRef = transaction.collection('feedback').doc(feedbackId)
      const feedbackResult = await readDocument(feedbackRef)
      const feedback = feedbackResult.data
      if (!feedback || feedback.deleted) {
        return { success: false, error: '反馈不存在' }
      }
      if (feedback.isProcessed) {
        return { success: true, alreadyProcessed: true, message: '反馈已解决' }
      }
      if (!feedback.userOpenid) {
        return { success: false, error: '反馈用户信息缺失，无法发送解决通知' }
      }

      const processedTime = new Date()
      await feedbackRef.update({
        data: { isProcessed: true, status: 'closed', processedTime, processedBy: openid, updatedAt: processedTime }
      })
      await transaction.collection('messages').add({
        data: {
          fromUserId: openid,
          fromUserName: adminName,
          fromUserAvatar: admin.avatarUrl || '',
          toUserId: feedback.userOpenid,
          type: 'feedback_processed',
          feedbackId,
          feedbackContent: feedback.content || '',
          content: `${adminName}解决了您反馈的问题`,
          isRead: false,
          createTime: processedTime
        }
      })
      return { success: true, message: '反馈已解决，已通知用户' }
    })
  } catch (error) {
    console.error('标记反馈处理失败:', error)
    throw new Error(`标记反馈处理失败: ${error.message}`)
  }
}
