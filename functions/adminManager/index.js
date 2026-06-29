// 绠＄悊鍛樺姛鑳戒簯鍑芥暟
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()
const _ = db.command
const $ = _.aggregate
const ACTIVITY_SUMMARY_MAX_LENGTH = 200
const ACTIVITY_RULES_MAX_LENGTH = 5000
const ACTIVITY_NOTICE_TITLE_MAX_LENGTH = 32
const ACTIVITY_NOTICE_SUMMARY_MAX_LENGTH = 80
const ACTIVITY_NOTICE_KICKER_MAX_LENGTH = 12
const ACTIVITY_NOTICE_MARK_MAX_LENGTH = 2
const ACTIVITY_NOTICE_TONES = ['default', 'cooperation', 'weekly', 'market']
const WEEKLY_TITLE_MAX_LENGTH = 48
const WEEKLY_SHELF_TITLE_MAX_LENGTH = 8
const WEEKLY_SUMMARY_MAX_LENGTH = 200
const WEEKLY_HERO_TEXT_MAX_LENGTH = 120
const WEEKLY_STATUSES = ['draft', 'published', 'archived']
const WEEKLY_COLLECTION_ISSUES = 'weekly_issues'
const WEEKLY_COLLECTION_TOPICS = 'weekly_topics'
const WEEKLY_RANKING_LIMIT = 10
const WEEKLY_RANKING_CANDIDATE_LIMIT = 500
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
    label: 'custom collection',
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
const { isAdminByPoemId } = require('./_lib/admin-auth')

// 楠岃瘉绠＄悊鍛樻潈闄愶紙閫氳繃poemId锛?
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
  getActivityDetail: (event) => getActivityDetail(event),
  listActivityNotices: (event) => listActivityNotices(event),
  createActivityNotice: (event, openid) => createActivityNotice(event, openid),
  updateActivityNotice: (event, openid) => updateActivityNotice(event, openid),
  setActivityNoticeStatus: (event) => setActivityNoticeStatus(event),
  deleteActivityNotice: (event) => deleteActivityNotice(event),
  listWeeklyIssues: (event) => listWeeklyIssues(event),
  createWeeklyIssue: (event, openid) => createWeeklyIssue(event, openid),
  updateWeeklyIssue: (event, openid) => updateWeeklyIssue(event, openid),
  publishWeeklyIssue: (event, openid) => publishWeeklyIssue(event, openid),
  archiveWeeklyIssue: (event, openid) => setWeeklyIssueStatus(event, openid, 'archived'),
  deleteWeeklyIssue: (event, openid) => deleteWeeklyIssue(event, openid),
  generateWeeklyRanking: (event) => generateWeeklyRanking(event),
  listWeeklyCandidatePosts: (event) => listWeeklyCandidatePosts(event),
  listWeeklyTopics: (event) => listWeeklyTopics(event),
  createWeeklyTopic: (event, openid) => createWeeklyTopic(event, openid),
  updateWeeklyTopic: (event, openid) => updateWeeklyTopic(event, openid),
  publishWeeklyTopic: (event, openid) => publishWeeklyTopic(event, openid),
  archiveWeeklyTopic: (event, openid) => setWeeklyTopicStatus(event, openid, 'archived')
}

// Cloud function entry
exports.main = async (event, context) => {
  try {
    const action = event.action
    console.log('adminManager action:', action)

    // Get openid from context or event.
    const openid = (event.userInfo && event.userInfo.openId) || event.openid

    if (!openid) {
      return {
        success: false,
        error: 'unable to get user openid'
      }
    }

    // Verify admin permission.
    const hasAdminPermission = await isAdminByPoemId({ db, command: _, openid, loggerPrefix: 'adminManager' })
    if (!hasAdminPermission) {
      return {
        success: false,
        error: 'permission denied'
      }
    }
    const handler = actionHandlers[action]
    if (!handler) {
      return {
        success: false,
        error: `unknown action: ${action}`
      }
    }
    return await handler(event, openid)
  } catch (error) {
    console.error('adminManager error:', error)
    return {
      success: false,
      error: error.message
    }
  }
}

// Batch replacement config
function getBatchReplaceConfig() {
  return {
    success: true,
    collections: BATCH_REPLACE_COLLECTIONS,
    tips: [
      '浠呮敮鎸佸崟瀛楁绮剧‘鍖归厤鏇挎崲',
      '褰撳墠宸ュ叿鎸夊瓧绗︿覆鍊艰繘琛屾煡鎵句笌鏇挎崲',
      'preview before executing replacement'
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
      error: `棰勮澶辫触锛?{error.message}`
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
        message: 'no matching records'
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
      message: '鎵归噺鏇挎崲瀹屾垚'
    }
  } catch (error) {
    console.error('[adminManager] executeFieldReplace failed:', error)
    return {
      success: false,
      error: `鎵ц鏇挎崲澶辫触锛?{error.message}`
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
      error: '璇烽€夋嫨闆嗗悎鍚嶇О'
    }
  }

  if (!fieldName) {
    return {
      success: false,
      error: '璇烽€夋嫨瀛楁鍚嶇О'
    }
  }

  if (findValue === '') {
    return {
      success: false,
      error: 'search value cannot be empty'
    }
  }

  if (findValue === replaceValue) {
    return {
      success: false,
      error: 'search and replacement values cannot be the same'
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
    
    // Add postType for frontend display.
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
    console.error('鑾峰彇甯栧瓙鍒楄〃澶辫触:', error)
    return {
      success: false,
      error: '鑾峰彇甯栧瓙鍒楄〃澶辫触'
    }
  }
}

// 鏇存柊甯栧瓙绫诲瀷
async function updatePostType(data) {
  const { postId, postType } = data
  
  if (!postId || !postType) {
    return {
      success: false,
      error: '缂哄皯蹇呰鍙傛暟'
    }
  }
  
  // 楠岃瘉甯栧瓙绫诲瀷
  const validTypes = ['normal', 'original', 'non-original', 'discussion']
  if (!validTypes.includes(postType)) {
    return {
      success: false,
      error: 'invalid post type'
    }
  }
  
  try {
    // Build update payload from postType.
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
      message: '甯栧瓙绫诲瀷鏇存柊鎴愬姛'
    }
  } catch (error) {
    console.error('鏇存柊甯栧瓙绫诲瀷澶辫触:', error)
    return {
      success: false,
      error: '鏇存柊甯栧瓙绫诲瀷澶辫触'
    }
  }
}

// 鍒犻櫎甯栧瓙
async function deletePost(data) {
  const { postId } = data
  
  if (!postId) {
    return {
      success: false,
      error: '缂哄皯甯栧瓙ID'
    }
  }
  
  try {
    // 鍒犻櫎甯栧瓙
    await db.collection('posts').doc(postId).remove()
    
    // 鍒犻櫎鐩稿叧璇勮
    await db.collection('comments').where({
      postId: postId
    }).remove()
    
    // 鍒犻櫎鐩稿叧鏀惰棌
    await db.collection('favorites').where({
      postId: postId
    }).remove()
    
    return {
      success: true,
      message: '甯栧瓙鍒犻櫎鎴愬姛'
    }
  } catch (error) {
    console.error('鍒犻櫎甯栧瓙澶辫触:', error)
    return {
      success: false,
      error: '鍒犻櫎甯栧瓙澶辫触'
    }
  }
}

// 鏌ヨ鐢ㄦ埛瀵嗙爜
async function getUserPassword(data) {
  const { query } = data
  
  if (!query) {
    return {
      success: false,
      error: '璇疯緭鍏ユ樀绉版垨poemid'
    }
  }
  
  try {
    // 鍏堝皾璇曟寜poemId鏌ヨ
    let result = await db.collection('users').where({
      poemId: query
    }).get()
    
    // 濡傛灉娌℃壘鍒帮紝鍐嶆寜鏄电О鏌ヨ
    if (result.data.length === 0) {
      result = await db.collection('users').where({
        nickName: query
      }).get()
    }
    
    if (result.data.length === 0) {
      return {
        success: false,
        error: '鏈壘鍒拌鐢ㄦ埛'
      }
    }
    
    const user = result.data[0]
    
    return {
      success: true,
      user: {
        nickName: user.nickName,
        poemId: user.poemId,
        password: user.password || 'not set'
      }
    }
  } catch (error) {
    console.error('鏌ヨ鐢ㄦ埛澶辫触:', error)
    return {
      success: false,
      error: '鏌ヨ鐢ㄦ埛澶辫触'
    }
  }
}

// 鑾峰彇璇椾汉鍒楄〃
async function getPoetList(data) {
  const { offset = 0, limit = 20 } = data
  
  try {
    const result = await db.collection('poets')
      .orderBy('updateTime', 'desc')
      .skip(offset)
      .limit(limit)
      .get()
    
    // Count works for each poet.
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
        console.error('缁熻璇椾汉浣滃搧鏁板け璐?', err)
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
    console.error('鑾峰彇璇椾汉鍒楄〃澶辫触:', error)
    return {
      success: false,
      error: '鑾峰彇璇椾汉鍒楄〃澶辫触'
    }
  }
}

// 鍒犻櫎璇椾汉
async function deletePoet(data) {
  const { poetId } = data
  
  if (!poetId) {
    return {
      success: false,
      error: '缂哄皯璇椾汉ID'
    }
  }
  
  try {
    // 鍒犻櫎璇椾汉璁板綍
    await db.collection('poets').doc(poetId).remove()
    
    return {
      success: true,
      message: '璇椾汉鍒犻櫎鎴愬姛'
    }
  } catch (error) {
    console.error('鍒犻櫎璇椾汉澶辫触:', error)
    return {
      success: false,
      error: '鍒犻櫎璇椾汉澶辫触'
    }
  }
}

// List activities for admin.
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
        return { success: false, error: 'invalid activity status' }
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
    console.error('鑾峰彇娲诲姩鍒楄〃澶辫触:', error)
    return {
      success: false,
      error: '鑾峰彇娲诲姩鍒楄〃澶辫触'
    }
  }
}

// 鍒涘缓娲诲姩
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

  if (!safeTitle) return { success: false, error: '娲诲姩鏍囬涓嶈兘涓虹┖' }
  if (!safeStart || !safeEnd) return { success: false, error: '娲诲姩寮€濮?缁撴潫鏃堕棿鏃犳晥' }
  if (safeEnd.getTime() < safeStart.getTime()) {
    return { success: false, error: 'activity end time cannot be earlier than start time' }
  }
  if (!safeStatus) return { success: false, error: 'invalid activity status' }

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
    console.error('鍒涘缓娲诲姩澶辫触:', error)
    return {
      success: false,
      error: '鍒涘缓娲诲姩澶辫触'
    }
  }
}

// 鏇存柊娲诲姩
async function updateActivity(data, openid) {
  const { activityId } = data || {}
  if (!activityId) {
    return { success: false, error: '缂哄皯娲诲姩ID' }
  }

  try {
    const docRes = await db.collection('activities').doc(activityId).get()
    if (!docRes.data || docRes.data.isDeleted === true) {
      return { success: false, error: 'activity not found' }
    }
    const current = docRes.data

    const updateData = {}
    if (Object.prototype.hasOwnProperty.call(data, 'title')) {
      const safeTitle = String(data.title || '').trim()
      if (!safeTitle) return { success: false, error: '娲诲姩鏍囬涓嶈兘涓虹┖' }
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
      if (!safeStatus) return { success: false, error: 'invalid activity status' }
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
      return { success: false, error: '娲诲姩寮€濮?缁撴潫鏃堕棿鏃犳晥' }
    }
    if (nextEnd.getTime() < nextStart.getTime()) {
      return { success: false, error: 'activity end time cannot be earlier than start time' }
    }

    if (Object.prototype.hasOwnProperty.call(data, 'startTime')) updateData.startTime = nextStart
    if (Object.prototype.hasOwnProperty.call(data, 'endTime')) updateData.endTime = nextEnd

    if (Object.keys(updateData).length === 0) {
      return { success: false, error: '娌℃湁鍙洿鏂扮殑瀛楁' }
    }

    updateData.updatedAt = new Date()
    updateData.updatedBy = openid

    await db.collection('activities').doc(activityId).update({ data: updateData })
    return {
      success: true,
      message: '娲诲姩鏇存柊鎴愬姛'
    }
  } catch (error) {
    console.error('鏇存柊娲诲姩澶辫触:', error)
    return {
      success: false,
      error: '鏇存柊娲诲姩澶辫触'
    }
  }
}

// Update activity status.
async function setActivityStatus(data) {
  const { activityId, status } = data || {}
  if (!activityId) return { success: false, error: '缂哄皯娲诲姩ID' }
  const safeStatus = normalizeStatus(status)
  if (!safeStatus) return { success: false, error: 'invalid activity status' }

  try {
    await db.collection('activities').doc(activityId).update({
      data: {
        status: safeStatus,
        updatedAt: new Date()
      }
    })
    return {
      success: true,
      message: 'activity status updated'
    }
  } catch (error) {
    console.error('鏇存柊娲诲姩鐘舵€佸け璐?', error)
    return {
      success: false,
      error: 'failed to update activity status'
    }
  }
}

// 鍒犻櫎娲诲姩锛堣蒋鍒狅級
async function deleteActivity(data) {
  const { activityId } = data || {}
  if (!activityId) return { success: false, error: '缂哄皯娲诲姩ID' }

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
      message: '娲诲姩鍒犻櫎鎴愬姛'
    }
  } catch (error) {
    console.error('鍒犻櫎娲诲姩澶辫触:', error)
    return {
      success: false,
      error: '鍒犻櫎娲诲姩澶辫触'
    }
  }
}

// 鑾峰彇娲诲姩璇︽儏
async function getActivityDetail(data) {
  const { activityId } = data || {}
  if (!activityId) return { success: false, error: '缂哄皯娲诲姩ID' }

  try {
    const res = await db.collection('activities').doc(activityId).get()
    if (!res.data || res.data.isDeleted === true) {
      return { success: false, error: 'activity not found' }
    }
    return {
      success: true,
      activity: buildAdminActivityView(res.data)
    }
  } catch (error) {
    console.error('鑾峰彇娲诲姩璇︽儏澶辫触:', error)
    return {
      success: false,
      error: '鑾峰彇娲诲姩璇︽儏澶辫触'
    }
  }
}

function normalizeActivityNoticeTone(value) {
  const tone = String(value || 'default').trim()
  return ACTIVITY_NOTICE_TONES.includes(tone) ? tone : 'default'
}

function normalizeActivityNoticeStatus(value) {
  const status = String(value || 'draft').trim()
  return ['draft', 'published', 'archived'].includes(status) ? status : ''
}

function buildActivityNoticeView(notice = {}) {
  return {
    _id: notice._id,
    kicker: notice.kicker || '',
    title: notice.title || '',
    summary: notice.summary || '',
    mark: notice.mark || '',
    tone: normalizeActivityNoticeTone(notice.tone),
    status: notice.status || 'draft',
    sortWeight: Number(notice.sortWeight) || 0,
    createdBy: notice.createdBy || '',
    createdAt: notice.createdAt || null,
    updatedAt: notice.updatedAt || null,
    isDeleted: notice.isDeleted === true
  }
}

async function ensureActivityNoticeCollection() {
  try {
    await db.createCollection('activity_notices')
  } catch (error) {
    const message = String((error && (error.errMsg || error.message)) || '')
    if (
      (error && error.errCode === -501001) ||
      message.includes('already exists') ||
      message.includes('collection exists') ||
      message.includes('duplicate')
    ) {
      return
    }
    try {
      await db.collection('activity_notices').limit(1).get()
      return
    } catch (_) {}
    throw error
  }
}

function buildActivityNoticePayload(data = {}, current = {}) {
  const payload = {}

  if (Object.prototype.hasOwnProperty.call(data, 'kicker')) {
    payload.kicker = String(data.kicker || '').trim().slice(0, ACTIVITY_NOTICE_KICKER_MAX_LENGTH)
  }
  if (Object.prototype.hasOwnProperty.call(data, 'title')) {
    const title = String(data.title || '').trim().slice(0, ACTIVITY_NOTICE_TITLE_MAX_LENGTH)
    if (!title) return { error: '鍏憡鏍囬涓嶈兘涓虹┖' }
    payload.title = title
  }
  if (Object.prototype.hasOwnProperty.call(data, 'summary')) {
    payload.summary = String(data.summary || '').trim().slice(0, ACTIVITY_NOTICE_SUMMARY_MAX_LENGTH)
  }
  if (Object.prototype.hasOwnProperty.call(data, 'mark')) {
    payload.mark = String(data.mark || '').trim().slice(0, ACTIVITY_NOTICE_MARK_MAX_LENGTH)
  }
  if (Object.prototype.hasOwnProperty.call(data, 'tone')) {
    payload.tone = normalizeActivityNoticeTone(data.tone)
  }
  if (Object.prototype.hasOwnProperty.call(data, 'sortWeight')) {
    payload.sortWeight = normalizeSortWeight(data.sortWeight, current.sortWeight || 0)
  }
  if (Object.prototype.hasOwnProperty.call(data, 'status')) {
    const status = normalizeActivityNoticeStatus(data.status)
    if (!status) return { error: 'invalid notice status' }
    payload.status = status
  }

  return { payload }
}

async function listActivityNotices(data) {
  const {
    skip = 0,
    limit = 20,
    status = '',
    includeDeleted = false
  } = data || {}

  try {
    await ensureActivityNoticeCollection()
    const safeSkip = Math.max(0, Number(skip) || 0)
    const safeLimit = Math.min(50, Math.max(1, Number(limit) || 20))

    const where = {}
    if (!includeDeleted) where.isDeleted = _.neq(true)
    if (status) {
      const safeStatus = normalizeActivityNoticeStatus(status)
      if (!safeStatus) return { success: false, error: 'invalid notice status' }
      where.status = safeStatus
    }

    const [countRes, listRes] = await Promise.all([
      db.collection('activity_notices').where(where).count(),
      db.collection('activity_notices')
        .where(where)
        .orderBy('sortWeight', 'desc')
        .orderBy('updatedAt', 'desc')
        .skip(safeSkip)
        .limit(safeLimit)
        .get()
    ])

    const notices = (listRes.data || []).map((notice) => buildActivityNoticeView(notice))
    return {
      success: true,
      notices,
      total: countRes.total || 0,
      hasMore: safeSkip + notices.length < (countRes.total || 0)
    }
  } catch (error) {
    console.error('鑾峰彇娲诲姩鍏憡鍒楄〃澶辫触:', error)
    return {
      success: false,
      error: '鑾峰彇娲诲姩鍏憡鍒楄〃澶辫触'
    }
  }
}

async function createActivityNotice(data, openid) {
  const { payload, error } = buildActivityNoticePayload({
    kicker: data && data.kicker,
    title: data && data.title,
    summary: data && data.summary,
    mark: data && data.mark,
    tone: data && data.tone,
    sortWeight: data && data.sortWeight,
    status: data && (data.status || 'draft')
  })
  if (error) return { success: false, error }
  if (!payload.title) return { success: false, error: '鍏憡鏍囬涓嶈兘涓虹┖' }

  try {
    await ensureActivityNoticeCollection()
    const now = new Date()
    const doc = {
      kicker: payload.kicker || '鍏憡',
      title: payload.title,
      summary: payload.summary || '',
      mark: payload.mark || '',
      tone: payload.tone || 'default',
      status: payload.status || 'draft',
      sortWeight: Number(payload.sortWeight) || 0,
      createdBy: openid,
      createdAt: now,
      updatedAt: now,
      isDeleted: false
    }
    const addRes = await db.collection('activity_notices').add({ data: doc })
    return {
      success: true,
      noticeId: addRes._id,
      notice: buildActivityNoticeView({ _id: addRes._id, ...doc })
    }
  } catch (err) {
    console.error('鍒涘缓娲诲姩鍏憡澶辫触:', err)
    return {
      success: false,
      error: '鍒涘缓娲诲姩鍏憡澶辫触'
    }
  }
}

async function updateActivityNotice(data, openid) {
  const noticeId = data && data.noticeId
  if (!noticeId) return { success: false, error: '缂哄皯鍏憡ID' }

  try {
    await ensureActivityNoticeCollection()
    const docRes = await db.collection('activity_notices').doc(noticeId).get()
    if (!docRes.data || docRes.data.isDeleted === true) {
      return { success: false, error: 'notice not found' }
    }

    const { payload, error } = buildActivityNoticePayload(data, docRes.data)
    if (error) return { success: false, error }
    if (Object.keys(payload).length === 0) {
      return { success: false, error: '娌℃湁鍙洿鏂扮殑瀛楁' }
    }

    payload.updatedAt = new Date()
    payload.updatedBy = openid

    await db.collection('activity_notices').doc(noticeId).update({ data: payload })
    return {
      success: true,
      message: '鍏憡鏇存柊鎴愬姛'
    }
  } catch (err) {
    console.error('鏇存柊娲诲姩鍏憡澶辫触:', err)
    return {
      success: false,
      error: '鏇存柊娲诲姩鍏憡澶辫触'
    }
  }
}

async function setActivityNoticeStatus(data) {
  const noticeId = data && data.noticeId
  const safeStatus = normalizeActivityNoticeStatus(data && data.status)
  if (!noticeId) return { success: false, error: '缂哄皯鍏憡ID' }
  if (!safeStatus) return { success: false, error: 'invalid notice status' }

  try {
    await ensureActivityNoticeCollection()
    await db.collection('activity_notices').doc(noticeId).update({
      data: {
        status: safeStatus,
        updatedAt: new Date()
      }
    })
    return {
      success: true,
      message: 'notice status updated'
    }
  } catch (err) {
    console.error('鏇存柊娲诲姩鍏憡鐘舵€佸け璐?', err)
    return {
      success: false,
      error: 'failed to update notice status'
    }
  }
}

async function deleteActivityNotice(data) {
  const noticeId = data && data.noticeId
  if (!noticeId) return { success: false, error: '缂哄皯鍏憡ID' }

  try {
    await ensureActivityNoticeCollection()
    await db.collection('activity_notices').doc(noticeId).update({
      data: {
        isDeleted: true,
        status: 'archived',
        updatedAt: new Date()
      }
    })
    return {
      success: true,
      message: '鍏憡鍒犻櫎鎴愬姛'
    }
  } catch (err) {
    console.error('鍒犻櫎娲诲姩鍏憡澶辫触:', err)
    return {
      success: false,
      error: '鍒犻櫎娲诲姩鍏憡澶辫触'
    }
  }
}

function normalizeWeeklyStatus(value) {
  const status = String(value || 'draft').trim()
  return WEEKLY_STATUSES.includes(status) ? status : ''
}

function normalizeWeeklyDate(value) {
  return normalizeDateInput(value)
}

function getWeeklyPeriodBounds(periodStart, periodEnd) {
  const start = normalizeWeeklyDate(periodStart)
  const end = normalizeWeeklyDate(periodEnd)
  if (!start || !end) return null
  const safeStart = new Date(start)
  const safeEnd = new Date(end)
  safeStart.setHours(0, 0, 0, 0)
  safeEnd.setHours(23, 59, 59, 999)
  if (safeEnd.getTime() < safeStart.getTime()) return null
  return { start: safeStart, end: safeEnd }
}

function normalizeStringArray(value, max = 100) {
  const source = Array.isArray(value)
    ? value
    : String(value || '')
        .split(/[\n,锛孿s]+/)
        .filter(Boolean)
  return [...new Set(source.map(item => String(item || '').trim()).filter(Boolean))].slice(0, max)
}

function normalizeHeroItems(value) {
  const source = Array.isArray(value) ? value : []
  return source
    .map((item, index) => {
      const rawText = typeof item === 'string' ? item : (item && item.text)
      const text = String(rawText || '').trim().slice(0, WEEKLY_HERO_TEXT_MAX_LENGTH)
      return text
        ? {
            value: (item && item.value) || `hero-${index + 1}`,
            text
          }
        : null
    })
    .filter(Boolean)
    .slice(0, 6)
}

function formatDateRange(start, end) {
  const format = (value) => {
    const date = normalizeWeeklyDate(value)
    if (!date) return ''
    const y = date.getFullYear()
    const m = String(date.getMonth() + 1).padStart(2, '0')
    const d = String(date.getDate()).padStart(2, '0')
    return `${y}${m}${d}`
  }
  const s = format(start)
  const e = format(end)
  return s && e ? `${s}-${e}` : ''
}

function buildPostSnapshot(post = {}, rank = 0) {
  const content = String(post.content || '')
  const firstLines = content
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean)
    .slice(0, 4)
  const copy = firstLines.length ? firstLines.join('\n') : String(post.title || 'Untitled')
  const votes = Number(post.votes) || 0
  const comments = Number(post.commentCount || post.comments) || 0
  const viewScore = Number(post.viewScore) || 0
  const imageUrls = Array.isArray(post.imageUrls)
    ? post.imageUrls
    : (post.imageUrl ? [post.imageUrl] : [])
  const originalImageUrls = Array.isArray(post.originalImageUrls)
    ? post.originalImageUrls
    : (post.originalImageUrl ? [post.originalImageUrl] : [])
  return {
    postId: post._id || post.postId || '',
    rank,
    title: post.title || 'Untitled',
    content: post.content || '',
    copy,
    authorName: post.authorName || post.authorNameSnapshot || post.author || '鍖垮悕鐢ㄦ埛',
    authorAvatar: post.authorAvatar || post.authorAvatarSnapshot || '',
    authorSignature: post.authorSignature || '',
    backgroundColor: post.backgroundColor || '',
    textColor: post.textColor || '',
    imageUrl: post.imageUrl || post.poemBgImage || imageUrls[0] || '',
    imageUrls,
    originalImageUrl: post.originalImageUrl || originalImageUrls[0] || '',
    originalImageUrls,
    poemBgImage: post.poemBgImage || '',
    votes,
    comments,
    views: Number(post.views || post.viewCount || viewScore) || 0,
    score: Number(post.score) || votes * 3 + comments * 2 + viewScore,
    createTime: post.createTime || null
  }
}

async function fetchPostsByIds(postIds = []) {
  const ids = normalizeStringArray(postIds, 100)
  if (!ids.length) return []
  const result = await db.collection('posts')
    .where({
      _id: _.in(ids),
      isHidden: _.neq(true)
    })
    .get()
  const byId = new Map((result.data || []).map(post => [post._id, post]))
  return ids.map(id => byId.get(id)).filter(Boolean)
}

async function buildSelectedPostSnapshots(postIds = []) {
  const posts = await fetchPostsByIds(postIds)
  return posts.map((post, index) => buildPostSnapshot(post, index + 1))
}

function buildWeeklyIssueView(issue = {}) {
  return {
    _id: issue._id || '',
    title: issue.title || '',
    shelfTitle: issue.shelfTitle || '',
    periodStart: issue.periodStart || null,
    periodEnd: issue.periodEnd || null,
    dateRange: issue.dateRange || formatDateRange(issue.periodStart, issue.periodEnd),
    status: issue.status || 'draft',
    heroItems: Array.isArray(issue.heroItems) ? issue.heroItems : [],
    featuredPostIds: Array.isArray(issue.featuredPostIds) ? issue.featuredPostIds : [],
    featuredSnapshots: Array.isArray(issue.featuredSnapshots) ? issue.featuredSnapshots : [],
    topicIds: Array.isArray(issue.topicIds) ? issue.topicIds : [],
    rankingSnapshot: Array.isArray(issue.rankingSnapshot) ? issue.rankingSnapshot : [],
    sortWeight: Number(issue.sortWeight) || 0,
    createdAt: issue.createdAt || null,
    updatedAt: issue.updatedAt || null,
    publishedAt: issue.publishedAt || null,
    isDeleted: issue.isDeleted === true
  }
}

function buildWeeklyTopicView(topic = {}) {
  return {
    _id: topic._id || '',
    title: topic.title || '',
    summary: topic.summary || '',
    periodStart: topic.periodStart || null,
    periodEnd: topic.periodEnd || null,
    dateRange: topic.dateRange || formatDateRange(topic.periodStart, topic.periodEnd),
    selectedPostIds: Array.isArray(topic.selectedPostIds) ? topic.selectedPostIds : [],
    selectedSnapshots: Array.isArray(topic.selectedSnapshots) ? topic.selectedSnapshots : [],
    status: topic.status || 'draft',
    sortWeight: Number(topic.sortWeight) || 0,
    createdAt: topic.createdAt || null,
    updatedAt: topic.updatedAt || null,
    publishedAt: topic.publishedAt || null,
    isDeleted: topic.isDeleted === true
  }
}

async function ensureWeeklyCollections() {
  for (const name of [WEEKLY_COLLECTION_ISSUES, WEEKLY_COLLECTION_TOPICS]) {
    try {
      await db.createCollection(name)
    } catch (error) {
      const message = String((error && (error.errMsg || error.message)) || '')
      if (
        (error && error.errCode === -501001) ||
        message.includes('already exists') ||
        message.includes('collection exists') ||
        message.includes('duplicate')
      ) {
        continue
      }
      try {
        await db.collection(name).limit(1).get()
      } catch (_) {
        throw error
      }
    }
  }
}

async function listWeeklyIssues(data = {}) {
  try {
    await ensureWeeklyCollections()
    const skip = Math.max(0, Number(data.skip) || 0)
    const limit = Math.min(50, Math.max(1, Number(data.limit) || 20))
    const where = { isDeleted: _.neq(true) }
    const status = data.status ? normalizeWeeklyStatus(data.status) : ''
    if (status) where.status = status

    const [countRes, listRes] = await Promise.all([
      db.collection(WEEKLY_COLLECTION_ISSUES).where(where).count(),
      db.collection(WEEKLY_COLLECTION_ISSUES)
        .where(where)
        .orderBy('sortWeight', 'desc')
        .orderBy('periodEnd', 'desc')
        .skip(skip)
        .limit(limit)
        .get()
    ])

    const issues = (listRes.data || []).map(buildWeeklyIssueView)
    return {
      success: true,
      issues,
      total: countRes.total || 0,
      hasMore: skip + issues.length < (countRes.total || 0)
    }
  } catch (error) {
    console.error('[adminManager] listWeeklyIssues failed:', error)
    return { success: false, error: '鑾峰彇鍛ㄥ垔鍒楄〃澶辫触' }
  }
}

async function createWeeklyIssue(data = {}, openid) {
  const payload = await buildWeeklyIssuePayload(data, { requireTitle: true })
  if (payload.error) return { success: false, error: payload.error }

  try {
    await ensureWeeklyCollections()
    const now = new Date()
    const doc = {
      ...payload.data,
      status: payload.data.status || 'draft',
      createdBy: openid,
      createdAt: now,
      updatedAt: now,
      isDeleted: false
    }
    const addRes = await db.collection(WEEKLY_COLLECTION_ISSUES).add({ data: doc })
    return {
      success: true,
      issueId: addRes._id,
      issue: buildWeeklyIssueView({ _id: addRes._id, ...doc })
    }
  } catch (error) {
    console.error('[adminManager] createWeeklyIssue failed:', error)
    return { success: false, error: '鍒涘缓鍛ㄥ垔澶辫触' }
  }
}

async function updateWeeklyIssue(data = {}, openid) {
  const issueId = data.issueId || data._id
  if (!issueId) return { success: false, error: '缂哄皯鍛ㄥ垔ID' }

  try {
    await ensureWeeklyCollections()
    const currentRes = await db.collection(WEEKLY_COLLECTION_ISSUES).doc(issueId).get()
    if (!currentRes.data || currentRes.data.isDeleted === true) {
      return { success: false, error: 'weekly issue not found' }
    }
    const payload = await buildWeeklyIssuePayload(data, { current: currentRes.data })
    if (payload.error) return { success: false, error: payload.error }
    if (!Object.keys(payload.data).length) return { success: false, error: 'no updatable fields' }

    payload.data.updatedAt = new Date()
    payload.data.updatedBy = openid
    await db.collection(WEEKLY_COLLECTION_ISSUES).doc(issueId).update({ data: payload.data })
    return { success: true, message: 'weekly issue updated' }
  } catch (error) {
    console.error('[adminManager] updateWeeklyIssue failed:', error)
    return { success: false, error: '鏇存柊鍛ㄥ垔澶辫触' }
  }
}

async function publishWeeklyIssue(data = {}, openid) {
  const issueId = data.issueId || data._id
  if (!issueId) return { success: false, error: '缂哄皯鍛ㄥ垔ID' }
  try {
    const docRes = await db.collection(WEEKLY_COLLECTION_ISSUES).doc(issueId).get()
    if (!docRes.data || docRes.data.isDeleted === true) return { success: false, error: 'weekly issue not found' }
    const current = docRes.data
    const rankingSnapshot = await computeWeeklyRanking(current.periodStart, current.periodEnd)
    const featuredSnapshots = await buildSelectedPostSnapshots(current.featuredPostIds || [])
    await db.collection(WEEKLY_COLLECTION_ISSUES).doc(issueId).update({
      data: {
        status: 'published',
        rankingSnapshot,
        featuredSnapshots,
        publishedAt: new Date(),
        updatedAt: new Date(),
        updatedBy: openid
      }
    })
    return { success: true, message: 'weekly issue published', rankingSnapshot, featuredSnapshots }
  } catch (error) {
    console.error('[adminManager] publishWeeklyIssue failed:', error)
    return { success: false, error: '鍙戝竷鍛ㄥ垔澶辫触' }
  }
}

async function setWeeklyIssueStatus(data = {}, openid, status) {
  const issueId = data.issueId || data._id
  if (!issueId) return { success: false, error: '缂哄皯鍛ㄥ垔ID' }
  try {
    await db.collection(WEEKLY_COLLECTION_ISSUES).doc(issueId).update({
      data: {
        status,
        updatedAt: new Date(),
        updatedBy: openid
      }
    })
    return { success: true, message: '鐘舵€佸凡鏇存柊' }
  } catch (error) {
    console.error('[adminManager] setWeeklyIssueStatus failed:', error)
    return { success: false, error: 'failed to update weekly issue status' }
  }
}

async function deleteWeeklyIssue(data = {}, openid) {
  const issueId = data.issueId || data._id
  if (!issueId) return { success: false, error: '缂哄皯鍛ㄥ垔ID' }
  try {
    await db.collection(WEEKLY_COLLECTION_ISSUES).doc(issueId).update({
      data: {
        isDeleted: true,
        status: 'archived',
        updatedAt: new Date(),
        updatedBy: openid
      }
    })
    return { success: true, message: 'weekly issue deleted' }
  } catch (error) {
    console.error('[adminManager] deleteWeeklyIssue failed:', error)
    return { success: false, error: '鍒犻櫎鍛ㄥ垔澶辫触' }
  }
}

async function buildWeeklyIssuePayload(data = {}, { current = {}, requireTitle = false } = {}) {
  const payload = {}
  if (Object.prototype.hasOwnProperty.call(data, 'title') || requireTitle) {
    const title = String(data.title || '').trim().slice(0, WEEKLY_TITLE_MAX_LENGTH)
    if (!title) return { error: '鍛ㄥ垔鏍囬涓嶈兘涓虹┖' }
    payload.title = title
  }
  if (Object.prototype.hasOwnProperty.call(data, 'shelfTitle')) {
    payload.shelfTitle = String(data.shelfTitle || '').trim().slice(0, WEEKLY_SHELF_TITLE_MAX_LENGTH)
  }
  if (Object.prototype.hasOwnProperty.call(data, 'periodStart')) {
    const periodStart = normalizeWeeklyDate(data.periodStart)
    if (!periodStart) return { error: 'invalid start date' }
    payload.periodStart = periodStart
  }
  if (Object.prototype.hasOwnProperty.call(data, 'periodEnd')) {
    const periodEnd = normalizeWeeklyDate(data.periodEnd)
    if (!periodEnd) return { error: '缁撴潫鏃ユ湡鏃犳晥' }
    payload.periodEnd = periodEnd
  }
  const nextStart = payload.periodStart || normalizeWeeklyDate(current.periodStart)
  const nextEnd = payload.periodEnd || normalizeWeeklyDate(current.periodEnd)
  if ((payload.periodStart || payload.periodEnd || requireTitle) && (!nextStart || !nextEnd)) {
    return { error: '缁熻鍛ㄦ湡涓嶈兘涓虹┖' }
  }
  if (nextStart && nextEnd && nextEnd.getTime() < nextStart.getTime()) {
    return { error: 'end date cannot be earlier than start date' }
  }
  if (Object.prototype.hasOwnProperty.call(data, 'status')) {
    const status = normalizeWeeklyStatus(data.status)
    if (!status) return { error: 'invalid weekly issue status' }
    payload.status = status
  }
  if (Object.prototype.hasOwnProperty.call(data, 'heroItems')) {
    payload.heroItems = normalizeHeroItems(data.heroItems)
  }
  if (Object.prototype.hasOwnProperty.call(data, 'featuredPostIds')) {
    payload.featuredPostIds = normalizeStringArray(data.featuredPostIds, 30)
    payload.featuredSnapshots = await buildSelectedPostSnapshots(payload.featuredPostIds)
  }
  if (Object.prototype.hasOwnProperty.call(data, 'topicIds')) {
    payload.topicIds = normalizeStringArray(data.topicIds, 20)
  }
  if (Object.prototype.hasOwnProperty.call(data, 'rankingSnapshot')) {
    payload.rankingSnapshot = Array.isArray(data.rankingSnapshot) ? data.rankingSnapshot.slice(0, 20) : []
  }
  if (Object.prototype.hasOwnProperty.call(data, 'sortWeight')) {
    payload.sortWeight = normalizeSortWeight(data.sortWeight, current.sortWeight || 0)
  }
  if (payload.periodStart || payload.periodEnd) {
    payload.dateRange = formatDateRange(payload.periodStart || current.periodStart, payload.periodEnd || current.periodEnd)
  }
  return { data: payload }
}

async function listWeeklyCandidatePosts(data = {}) {
  const skip = Math.max(0, Number(data.skip) || 0)
  const limit = Math.min(50, Math.max(1, Number(data.limit) || 20))
  const keyword = String(data.keyword || '').trim()
  const where = {
    isPoem: true,
    isOriginal: true,
    isHidden: _.neq(true)
  }
  if (keyword) {
    where.title = db.RegExp({
      regexp: keyword,
      options: 'i'
    })
  }
  try {
    const [countRes, listRes] = await Promise.all([
      db.collection('posts').where(where).count(),
      db.collection('posts')
        .where(where)
        .orderBy('createTime', 'desc')
        .skip(skip)
        .limit(limit)
        .get()
    ])
    const posts = (listRes.data || []).map((post, index) => buildPostSnapshot(post, skip + index + 1))
    return {
      success: true,
      posts,
      total: countRes.total || 0,
      hasMore: skip + posts.length < (countRes.total || 0)
    }
  } catch (error) {
    console.error('[adminManager] listWeeklyCandidatePosts failed:', error)
    return { success: false, error: 'failed to fetch candidate posts' }
  }
}

async function computeWeeklyRanking(periodStart, periodEnd, limit = 10) {
  const bounds = getWeeklyPeriodBounds(periodStart, periodEnd)
  if (!bounds) return []

  const posts = await listWeeklyRankingCandidatePosts(bounds)
  const statsMap = await getWeeklyRankingStatsMap(posts)
  const rankingLimit = Math.min(20, Math.max(1, Number(limit) || WEEKLY_RANKING_LIMIT))

  return posts
    .map(post => {
      const stats = statsMap.get(post._id) || {}
      const votes = Number(stats.votes || post.votes) || 0
      const comments = Number(stats.comments || post.commentCount || post.comments) || 0
      const views = Number(stats.views || post.views || post.viewCount || post.viewScore) || 0
      return buildPostSnapshot({
        ...post,
        votes,
        comments,
        viewScore: views,
        score: votes * 3 + comments * 2 + views
      }, 0)
    })
    .sort((left, right) => {
      const scoreDiff = (Number(right.score) || 0) - (Number(left.score) || 0)
      if (scoreDiff !== 0) return scoreDiff
      return new Date(right.createTime || 0).getTime() - new Date(left.createTime || 0).getTime()
    })
    .slice(0, rankingLimit)
    .map((item, index) => ({ ...item, rank: index + 1 }))
}

async function listWeeklyRankingCandidatePosts(bounds = {}) {
  const posts = []
  const pageSize = 100
  const maxCount = WEEKLY_RANKING_CANDIDATE_LIMIT

  for (let skip = 0; posts.length < maxCount; skip += pageSize) {
    const res = await db.collection('posts')
      .where({
        isPoem: true,
        isOriginal: true,
        isHidden: _.neq(true),
        createTime: _.gte(bounds.start).and(_.lte(bounds.end))
      })
      .orderBy('createTime', 'desc')
      .skip(skip)
      .limit(Math.min(pageSize, maxCount - posts.length))
      .get()

    const batch = res.data || []
    posts.push(...batch)
    if (batch.length < pageSize) break
  }

  return posts
}

async function aggregateWeeklyPostCountMap(collectionName, postIds = [], extraMatch = {}) {
  const ids = normalizeStringArray(postIds, 500)
  const countMap = new Map()
  if (!ids.length) return countMap

  for (let index = 0; index < ids.length; index += 100) {
    const chunk = ids.slice(index, index + 100)
    const agg = await db.collection(collectionName).aggregate()
      .match({
        ...extraMatch,
        postId: _.in(chunk)
      })
      .group({
        _id: '$postId',
        count: $.sum(1)
      })
      .end()
    ;(agg.list || []).forEach(item => {
      if (item && item._id) {
        countMap.set(item._id, Number(item.count) || 0)
      }
    })
  }

  return countMap
}

async function safeAggregateWeeklyPostCountMap(collectionName, postIds = [], extraMatch = {}) {
  try {
    return await aggregateWeeklyPostCountMap(collectionName, postIds, extraMatch)
  } catch (error) {
    console.warn(`[adminManager] ${collectionName} ranking stats unavailable:`, error)
    return new Map()
  }
}

async function getWeeklyRankingStatsMap(posts = []) {
  const ids = posts.map(post => post && post._id).filter(Boolean)
  if (!ids.length) return new Map()

  const [voteMap, commentMap, viewMap] = await Promise.all([
    safeAggregateWeeklyPostCountMap('votes_log', ids, { type: 'post' }),
    safeAggregateWeeklyPostCountMap('comments', ids),
    safeAggregateWeeklyPostCountMap('view_events', ids)
  ])

  return new Map(posts.map(post => {
    const postId = post._id
    const votes = voteMap.has(postId) ? Number(voteMap.get(postId)) || 0 : Number(post.votes) || 0
    const comments = commentMap.has(postId) ? Number(commentMap.get(postId)) || 0 : Number(post.commentCount || post.comments) || 0
    const views = viewMap.has(postId) ? Number(viewMap.get(postId)) || 0 : Number(post.views || post.viewCount || post.viewScore) || 0
    return [postId, { votes, comments, views }]
  }))
}

async function generateWeeklyRanking(data = {}) {
  try {
    let periodStart = data.periodStart
    let periodEnd = data.periodEnd
    if ((!periodStart || !periodEnd) && data.issueId) {
      const docRes = await db.collection(WEEKLY_COLLECTION_ISSUES).doc(data.issueId).get()
      if (docRes.data) {
        periodStart = docRes.data.periodStart
        periodEnd = docRes.data.periodEnd
      }
    }
    const ranking = await computeWeeklyRanking(periodStart, periodEnd, data.limit || 10)
    if (data.issueId) {
      await db.collection(WEEKLY_COLLECTION_ISSUES).doc(data.issueId).update({
        data: {
          rankingSnapshot: ranking,
          updatedAt: new Date()
        }
      })
    }
    return { success: true, ranking }
  } catch (error) {
    console.error('[adminManager] generateWeeklyRanking failed:', error)
    return { success: false, error: '鐢熸垚鐑澶辫触' }
  }
}

async function listWeeklyTopics(data = {}) {
  try {
    await ensureWeeklyCollections()
    const skip = Math.max(0, Number(data.skip) || 0)
    const limit = Math.min(50, Math.max(1, Number(data.limit) || 20))
    const where = { isDeleted: _.neq(true) }
    const status = data.status ? normalizeWeeklyStatus(data.status) : ''
    if (status) where.status = status
    const [countRes, listRes] = await Promise.all([
      db.collection(WEEKLY_COLLECTION_TOPICS).where(where).count(),
      db.collection(WEEKLY_COLLECTION_TOPICS)
        .where(where)
        .orderBy('sortWeight', 'desc')
        .orderBy('periodEnd', 'desc')
        .skip(skip)
        .limit(limit)
        .get()
    ])
    const topics = (listRes.data || []).map(buildWeeklyTopicView)
    return {
      success: true,
      topics,
      total: countRes.total || 0,
      hasMore: skip + topics.length < (countRes.total || 0)
    }
  } catch (error) {
    console.error('[adminManager] listWeeklyTopics failed:', error)
    return { success: false, error: '鑾峰彇涓婚鍒楄〃澶辫触' }
  }
}

async function createWeeklyTopic(data = {}, openid) {
  const payload = await buildWeeklyTopicPayload(data, { requireTitle: true })
  if (payload.error) return { success: false, error: payload.error }
  try {
    await ensureWeeklyCollections()
    const now = new Date()
    const doc = {
      ...payload.data,
      status: payload.data.status || 'draft',
      createdBy: openid,
      createdAt: now,
      updatedAt: now,
      isDeleted: false
    }
    const addRes = await db.collection(WEEKLY_COLLECTION_TOPICS).add({ data: doc })
    return {
      success: true,
      topicId: addRes._id,
      topic: buildWeeklyTopicView({ _id: addRes._id, ...doc })
    }
  } catch (error) {
    console.error('[adminManager] createWeeklyTopic failed:', error)
    return { success: false, error: '鍒涘缓涓婚澶辫触' }
  }
}

async function updateWeeklyTopic(data = {}, openid) {
  const topicId = data.topicId || data._id
  if (!topicId) return { success: false, error: '缂哄皯涓婚ID' }
  try {
    const currentRes = await db.collection(WEEKLY_COLLECTION_TOPICS).doc(topicId).get()
    if (!currentRes.data || currentRes.data.isDeleted === true) return { success: false, error: 'topic not found' }
    const payload = await buildWeeklyTopicPayload(data, { current: currentRes.data })
    if (payload.error) return { success: false, error: payload.error }
    if (!Object.keys(payload.data).length) return { success: false, error: 'no updatable fields' }
    payload.data.updatedAt = new Date()
    payload.data.updatedBy = openid
    await db.collection(WEEKLY_COLLECTION_TOPICS).doc(topicId).update({ data: payload.data })
    return { success: true, message: 'topic updated' }
  } catch (error) {
    console.error('[adminManager] updateWeeklyTopic failed:', error)
    return { success: false, error: '鏇存柊涓婚澶辫触' }
  }
}

async function publishWeeklyTopic(data = {}, openid) {
  const topicId = data.topicId || data._id
  if (!topicId) return { success: false, error: '缂哄皯涓婚ID' }
  try {
    const docRes = await db.collection(WEEKLY_COLLECTION_TOPICS).doc(topicId).get()
    if (!docRes.data || docRes.data.isDeleted === true) return { success: false, error: 'topic not found' }
    const selectedSnapshots = await buildSelectedPostSnapshots(docRes.data.selectedPostIds || [])
    await db.collection(WEEKLY_COLLECTION_TOPICS).doc(topicId).update({
      data: {
        status: 'published',
        selectedSnapshots,
        publishedAt: new Date(),
        updatedAt: new Date(),
        updatedBy: openid
      }
    })
    return { success: true, message: 'topic published', selectedSnapshots }
  } catch (error) {
    console.error('[adminManager] publishWeeklyTopic failed:', error)
    return { success: false, error: '鍙戝竷涓婚澶辫触' }
  }
}

async function setWeeklyTopicStatus(data = {}, openid, status) {
  const topicId = data.topicId || data._id
  if (!topicId) return { success: false, error: '缂哄皯涓婚ID' }
  try {
    await db.collection(WEEKLY_COLLECTION_TOPICS).doc(topicId).update({
      data: {
        status,
        updatedAt: new Date(),
        updatedBy: openid
      }
    })
    return { success: true, message: '涓婚鐘舵€佸凡鏇存柊' }
  } catch (error) {
    console.error('[adminManager] setWeeklyTopicStatus failed:', error)
    return { success: false, error: 'failed to update topic status' }
  }
}

async function buildWeeklyTopicPayload(data = {}, { current = {}, requireTitle = false } = {}) {
  const payload = {}
  if (Object.prototype.hasOwnProperty.call(data, 'title') || requireTitle) {
    const title = String(data.title || '').trim().slice(0, WEEKLY_TITLE_MAX_LENGTH)
    if (!title) return { error: '涓婚鏍囬涓嶈兘涓虹┖' }
    payload.title = title
  }
  if (Object.prototype.hasOwnProperty.call(data, 'summary')) {
    payload.summary = String(data.summary || '').trim().slice(0, WEEKLY_SUMMARY_MAX_LENGTH)
  }
  if (Object.prototype.hasOwnProperty.call(data, 'periodStart')) {
    const periodStart = normalizeWeeklyDate(data.periodStart)
    if (!periodStart) return { error: 'invalid start date' }
    payload.periodStart = periodStart
  }
  if (Object.prototype.hasOwnProperty.call(data, 'periodEnd')) {
    const periodEnd = normalizeWeeklyDate(data.periodEnd)
    if (!periodEnd) return { error: '缁撴潫鏃ユ湡鏃犳晥' }
    payload.periodEnd = periodEnd
  }
  const nextStart = payload.periodStart || normalizeWeeklyDate(current.periodStart)
  const nextEnd = payload.periodEnd || normalizeWeeklyDate(current.periodEnd)
  if ((payload.periodStart || payload.periodEnd || requireTitle) && (!nextStart || !nextEnd)) {
    return { error: '涓婚鍛ㄦ湡涓嶈兘涓虹┖' }
  }
  if (nextStart && nextEnd && nextEnd.getTime() < nextStart.getTime()) {
    return { error: 'end date cannot be earlier than start date' }
  }
  if (Object.prototype.hasOwnProperty.call(data, 'status')) {
    const status = normalizeWeeklyStatus(data.status)
    if (!status) return { error: 'invalid topic status' }
    payload.status = status
  }
  if (Object.prototype.hasOwnProperty.call(data, 'selectedPostIds')) {
    payload.selectedPostIds = normalizeStringArray(data.selectedPostIds, 50)
    payload.selectedSnapshots = await buildSelectedPostSnapshots(payload.selectedPostIds)
  }
  if (Object.prototype.hasOwnProperty.call(data, 'sortWeight')) {
    payload.sortWeight = normalizeSortWeight(data.sortWeight, current.sortWeight || 0)
  }
  if (payload.periodStart || payload.periodEnd) {
    payload.dateRange = formatDateRange(payload.periodStart || current.periodStart, payload.periodEnd || current.periodEnd)
  }
  return { data: payload }
}

