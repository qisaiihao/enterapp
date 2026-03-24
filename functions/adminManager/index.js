// 管理员功能云函数
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()
const _ = db.command
const ADMIN_POEM_IDS = ['qisaihao', 'jingmikun', 'ZOUHE']
const ACTIVITY_SUMMARY_MAX_LENGTH = 200
const ACTIVITY_RULES_MAX_LENGTH = 5000
const BATCH_REPLACE_SAMPLE_LIMIT = 10
const BATCH_REPLACE_COLLECTIONS = [
  {
    value: 'users',
    label: 'users',
    fields: ['_openid', 'poemId', 'nickName', 'phoneNumber', 'githubUsername', 'avatarUrl']
  },
  {
    value: 'posts',
    label: 'posts',
    fields: ['_openid', 'authorName', 'authorAvatar', 'title', 'content', 'publishMode', 'activityId', 'joinActivityId']
  },
  {
    value: 'comments',
    label: 'comments',
    fields: ['_openid', 'postId', 'content', 'authorName', 'replyToCommentId', 'replyToUserId', 'parentCommentId']
  },
  {
    value: 'follows',
    label: 'follows',
    fields: ['followerId', 'followedId']
  },
  {
    value: 'favorites',
    label: 'favorites',
    fields: ['userId', 'postId', 'folderId', 'folderName']
  },
  {
    value: 'messages',
    label: 'messages',
    fields: ['userId', 'fromUserId', 'toUserId', 'postId', 'commentId', 'type']
  },
  {
    value: 'feedback',
    label: 'feedback',
    fields: ['openid', 'poemId', 'status', 'content']
  },
  {
    value: 'activities',
    label: 'activities',
    fields: ['title', 'status', 'creatorOpenid']
  },
  {
    value: '__custom__',
    label: '自定义集合',
    fields: ['__custom__']
  }
]
const {
  normalizeDateInput,
  normalizeStatus,
  normalizeSortWeight,
  normalizeActivityRules,
  normalizeAllowUserSubmission,
  buildAdminActivityView
} = require('./_lib/activity')

// 验证管理员权限（通过poemId）
async function isAdmin(openid) {
  try {
    const result = await db.collection('users').where({
      _openid: openid,
      poemId: _.in(ADMIN_POEM_IDS)
    }).get()
    
    return result.data.length > 0
  } catch (error) {
    console.error('验证管理员权限失败:', error)
    return false
  }
}

const actionHandlers = {
  getAllPosts: (event) => getAllPosts(event),
  updatePostType: (event) => updatePostType(event),
  deletePost: (event) => deletePost(event),
  getUserPassword: (event) => getUserPassword(event),
  getPoetList: (event) => getPoetList(event),
  deletePoet: (event) => deletePoet(event),
  getBatchReplaceConfig: () => getBatchReplaceConfig(),
  previewFieldReplace: (event) => previewFieldReplace(event),
  executeFieldReplace: (event) => executeFieldReplace(event),
  listActivities: (event) => listActivities(event),
  createActivity: (event, openid) => createActivity(event, openid),
  updateActivity: (event, openid) => updateActivity(event, openid),
  setActivityStatus: (event) => setActivityStatus(event),
  deleteActivity: (event) => deleteActivity(event),
  getActivityDetail: (event) => getActivityDetail(event)
}

// 云函数入口函数
exports.main = async (event, context) => {
  try {
    const action = event.action
    console.log('adminManager 云函数收到操作:', action)

    // 从 context 或 event 中获取 openid
    const openid = (event.userInfo && event.userInfo.openId) || event.openid

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
    const handler = actionHandlers[action]
    if (!handler) {
      return {
        success: false,
        error: `未知的操作类型: ${action}`
      }
    }
    return await handler(event, openid)
  } catch (error) {
    console.error('adminManager 云函数错误:', error)
    return {
      success: false,
      error: error.message
    }
  }
}

// 获取所有帖子
function getBatchReplaceConfig() {
  return {
    success: true,
    collections: BATCH_REPLACE_COLLECTIONS,
    tips: [
      '仅支持单字段精确匹配替换',
      '当前工具按字符串值进行查找与替换',
      '建议先预览，再执行正式替换'
    ]
  }
}

async function previewFieldReplace(event) {
  const params = normalizeBatchReplaceParams(event)
  if (!params.success) {
    return params
  }

  try {
    const collectionRef = db.collection(params.collectionName)
    const whereCondition = {
      [params.fieldName]: params.findValue
    }
    const [countRes, sampleRes] = await Promise.all([
      collectionRef.where(whereCondition).count(),
      collectionRef.where(whereCondition).limit(BATCH_REPLACE_SAMPLE_LIMIT).get()
    ])

    return {
      success: true,
      mode: 'preview',
      collectionName: params.collectionName,
      fieldName: params.fieldName,
      findValue: params.findValue,
      replaceValue: params.replaceValue,
      matchedCount: countRes.total || 0,
      sampleDocs: sampleRes.data || []
    }
  } catch (error) {
    console.error('[adminManager] previewFieldReplace failed:', error)
    return {
      success: false,
      error: `预览失败：${error.message}`
    }
  }
}

async function executeFieldReplace(event) {
  const params = normalizeBatchReplaceParams(event)
  if (!params.success) {
    return params
  }

  try {
    const collectionRef = db.collection(params.collectionName)
    const whereCondition = {
      [params.fieldName]: params.findValue
    }

    const [countRes, sampleRes] = await Promise.all([
      collectionRef.where(whereCondition).count(),
      collectionRef.where(whereCondition).limit(BATCH_REPLACE_SAMPLE_LIMIT).get()
    ])

    const matchedCount = countRes.total || 0
    if (!matchedCount) {
      return {
        success: true,
        mode: 'execute',
        collectionName: params.collectionName,
        fieldName: params.fieldName,
        findValue: params.findValue,
        replaceValue: params.replaceValue,
        matchedCount: 0,
        updatedCount: 0,
        sampleDocs: [],
        message: '未找到匹配记录'
      }
    }

    const updateRes = await collectionRef.where(whereCondition).update({
      data: {
        [params.fieldName]: params.replaceValue
      }
    })

    return {
      success: true,
      mode: 'execute',
      collectionName: params.collectionName,
      fieldName: params.fieldName,
      findValue: params.findValue,
      replaceValue: params.replaceValue,
      matchedCount,
      updatedCount: (updateRes && updateRes.stats && updateRes.stats.updated) || 0,
      sampleDocs: sampleRes.data || [],
      message: '批量替换完成'
    }
  } catch (error) {
    console.error('[adminManager] executeFieldReplace failed:', error)
    return {
      success: false,
      error: `执行替换失败：${error.message}`
    }
  }
}

function normalizeBatchReplaceParams(event = {}) {
  const collectionName = normalizeCollectionName(event.collectionName || event.collection)
  const fieldName = normalizeFieldName(event.fieldName || event.field)
  const findValue = normalizeReplaceValue(event.findValue)
  const replaceValue = normalizeReplaceValue(event.replaceValue, { allowEmpty: true })

  if (!collectionName) {
    return {
      success: false,
      error: '请选择集合名称'
    }
  }

  if (!fieldName) {
    return {
      success: false,
      error: '请选择字段名称'
    }
  }

  if (findValue === '') {
    return {
      success: false,
      error: '查找值不能为空'
    }
  }

  if (findValue === replaceValue) {
    return {
      success: false,
      error: '查找值与替换值不能相同'
    }
  }

  return {
    success: true,
    collectionName,
    fieldName,
    findValue,
    replaceValue
  }
}

function normalizeCollectionName(value) {
  const normalized = typeof value === 'string' ? value.trim() : ''
  if (!normalized) return ''
  return /^[A-Za-z0-9_-]+$/.test(normalized) ? normalized : ''
}

function normalizeFieldName(value) {
  const normalized = typeof value === 'string' ? value.trim() : ''
  if (!normalized) return ''
  return /^[A-Za-z0-9_]+(?:\.[A-Za-z0-9_]+)*$/.test(normalized) ? normalized : ''
}

function normalizeReplaceValue(value, { allowEmpty = false } = {}) {
  if (value === null || value === undefined) {
    return allowEmpty ? '' : ''
  }
  const normalized = String(value)
  if (!allowEmpty && normalized === '') {
    return ''
  }
  return normalized
}

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

// 获取活动列表（管理员）
async function listActivities(data) {
  const {
    skip = 0,
    limit = 20,
    status = '',
    includeDeleted = false
  } = data || {}

  try {
    const safeSkip = Math.max(0, Number(skip) || 0)
    const safeLimit = Math.min(50, Math.max(1, Number(limit) || 20))

    const where = {}
    if (!includeDeleted) where.isDeleted = _.neq(true)
    if (status) {
      const safeStatus = normalizeStatus(status)
      if (!safeStatus) {
        return { success: false, error: '无效的活动状态' }
      }
      where.status = safeStatus
    }

    const [countRes, listRes] = await Promise.all([
      db.collection('activities').where(where).count(),
      db.collection('activities')
        .where(where)
        .orderBy('sortWeight', 'desc')
        .orderBy('startTime', 'desc')
        .skip(safeSkip)
        .limit(safeLimit)
        .get()
    ])

    const activities = (listRes.data || []).map((activity) => buildAdminActivityView(activity))
    const total = countRes.total || 0

    return {
      success: true,
      activities,
      total,
      hasMore: safeSkip + activities.length < total
    }
  } catch (error) {
    console.error('获取活动列表失败:', error)
    return {
      success: false,
      error: '获取活动列表失败'
    }
  }
}

// 创建活动
async function createActivity(data, openid) {
  const {
    title = '',
    summary = '',
    rules = '',
    coverImage = '',
    startTime,
    endTime,
    status = 'draft',
    sortWeight = 0,
    allowUserSubmission = true
  } = data || {}

  const safeTitle = String(title || '').trim()
  const safeSummary = String(summary || '').trim().slice(0, ACTIVITY_SUMMARY_MAX_LENGTH)
  const safeRules = normalizeActivityRules(rules, ACTIVITY_RULES_MAX_LENGTH)
  const safeCover = String(coverImage || '').trim()
  const safeStart = normalizeDateInput(startTime)
  const safeEnd = normalizeDateInput(endTime)
  const safeStatus = normalizeStatus(status || 'draft')
  const safeSortWeight = normalizeSortWeight(sortWeight, 0)
  const safeAllowUserSubmission = normalizeAllowUserSubmission(allowUserSubmission, true)

  if (!safeTitle) return { success: false, error: '活动标题不能为空' }
  if (!safeStart || !safeEnd) return { success: false, error: '活动开始/结束时间无效' }
  if (safeEnd.getTime() < safeStart.getTime()) {
    return { success: false, error: '活动结束时间不能早于开始时间' }
  }
  if (!safeStatus) return { success: false, error: '活动状态无效' }

  try {
    const now = new Date()
    const payload = {
      title: safeTitle,
      summary: safeSummary,
      rules: safeRules,
      coverImage: safeCover,
      startTime: safeStart,
      endTime: safeEnd,
      status: safeStatus,
      sortWeight: safeSortWeight,
      allowUserSubmission: safeAllowUserSubmission,
      postCount: 0,
      lastPostTime: null,
      createdBy: openid,
      createdAt: now,
      updatedAt: now,
      isDeleted: false
    }

    const addRes = await db.collection('activities').add({ data: payload })
    return {
      success: true,
      activityId: addRes._id,
      activity: buildAdminActivityView({ _id: addRes._id, ...payload })
    }
  } catch (error) {
    console.error('创建活动失败:', error)
    return {
      success: false,
      error: '创建活动失败'
    }
  }
}

// 更新活动
async function updateActivity(data, openid) {
  const { activityId } = data || {}
  if (!activityId) {
    return { success: false, error: '缺少活动ID' }
  }

  try {
    const docRes = await db.collection('activities').doc(activityId).get()
    if (!docRes.data || docRes.data.isDeleted === true) {
      return { success: false, error: '活动不存在' }
    }
    const current = docRes.data

    const updateData = {}
    if (Object.prototype.hasOwnProperty.call(data, 'title')) {
      const safeTitle = String(data.title || '').trim()
      if (!safeTitle) return { success: false, error: '活动标题不能为空' }
      updateData.title = safeTitle
    }
    if (Object.prototype.hasOwnProperty.call(data, 'summary')) {
      updateData.summary = String(data.summary || '').trim().slice(0, ACTIVITY_SUMMARY_MAX_LENGTH)
    }
    if (Object.prototype.hasOwnProperty.call(data, 'rules')) {
      updateData.rules = normalizeActivityRules(data.rules, ACTIVITY_RULES_MAX_LENGTH)
    }
    if (Object.prototype.hasOwnProperty.call(data, 'coverImage')) {
      updateData.coverImage = String(data.coverImage || '').trim()
    }
    if (Object.prototype.hasOwnProperty.call(data, 'sortWeight')) {
      updateData.sortWeight = normalizeSortWeight(data.sortWeight, current.sortWeight || 0)
    }
    if (Object.prototype.hasOwnProperty.call(data, 'status')) {
      const safeStatus = normalizeStatus(data.status)
      if (!safeStatus) return { success: false, error: '活动状态无效' }
      updateData.status = safeStatus
    }
    if (Object.prototype.hasOwnProperty.call(data, 'allowUserSubmission')) {
      updateData.allowUserSubmission = normalizeAllowUserSubmission(
        data.allowUserSubmission,
        normalizeAllowUserSubmission(current.allowUserSubmission, true)
      )
    }

    const nextStart = Object.prototype.hasOwnProperty.call(data, 'startTime')
      ? normalizeDateInput(data.startTime)
      : normalizeDateInput(current.startTime)
    const nextEnd = Object.prototype.hasOwnProperty.call(data, 'endTime')
      ? normalizeDateInput(data.endTime)
      : normalizeDateInput(current.endTime)

    if (!nextStart || !nextEnd) {
      return { success: false, error: '活动开始/结束时间无效' }
    }
    if (nextEnd.getTime() < nextStart.getTime()) {
      return { success: false, error: '活动结束时间不能早于开始时间' }
    }

    if (Object.prototype.hasOwnProperty.call(data, 'startTime')) updateData.startTime = nextStart
    if (Object.prototype.hasOwnProperty.call(data, 'endTime')) updateData.endTime = nextEnd

    if (Object.keys(updateData).length === 0) {
      return { success: false, error: '没有可更新的字段' }
    }

    updateData.updatedAt = new Date()
    updateData.updatedBy = openid

    await db.collection('activities').doc(activityId).update({ data: updateData })
    return {
      success: true,
      message: '活动更新成功'
    }
  } catch (error) {
    console.error('更新活动失败:', error)
    return {
      success: false,
      error: '更新活动失败'
    }
  }
}

// 修改活动状态
async function setActivityStatus(data) {
  const { activityId, status } = data || {}
  if (!activityId) return { success: false, error: '缺少活动ID' }
  const safeStatus = normalizeStatus(status)
  if (!safeStatus) return { success: false, error: '活动状态无效' }

  try {
    await db.collection('activities').doc(activityId).update({
      data: {
        status: safeStatus,
        updatedAt: new Date()
      }
    })
    return {
      success: true,
      message: '活动状态更新成功'
    }
  } catch (error) {
    console.error('更新活动状态失败:', error)
    return {
      success: false,
      error: '更新活动状态失败'
    }
  }
}

// 删除活动（软删）
async function deleteActivity(data) {
  const { activityId } = data || {}
  if (!activityId) return { success: false, error: '缺少活动ID' }

  try {
    await db.collection('activities').doc(activityId).update({
      data: {
        isDeleted: true,
        status: 'archived',
        updatedAt: new Date()
      }
    })
    return {
      success: true,
      message: '活动删除成功'
    }
  } catch (error) {
    console.error('删除活动失败:', error)
    return {
      success: false,
      error: '删除活动失败'
    }
  }
}

// 获取活动详情
async function getActivityDetail(data) {
  const { activityId } = data || {}
  if (!activityId) return { success: false, error: '缺少活动ID' }

  try {
    const res = await db.collection('activities').doc(activityId).get()
    if (!res.data || res.data.isDeleted === true) {
      return { success: false, error: '活动不存在' }
    }
    return {
      success: true,
      activity: buildAdminActivityView(res.data)
    }
  } catch (error) {
    console.error('获取活动详情失败:', error)
    return {
      success: false,
      error: '获取活动详情失败'
    }
  }
}
