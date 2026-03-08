const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()
const _ = db.command
const $ = _.aggregate
const { buildPublicActivityView } = require('../_lib/activity')

async function getActivityDetail(activityId) {
  if (!activityId) {
    return {
      success: false,
      message: '缺少活动ID'
    }
  }

  try {
    const res = await db.collection('activities').doc(activityId).get()
    const activity = res && res.data ? res.data : null
    if (!activity || activity.isDeleted === true || activity.status !== 'published') {
      return {
        success: false,
        message: '活动不存在或不可查看'
      }
    }

    return {
      success: true,
      activity: buildPublicActivityView(activity, { includeRules: true })
    }
  } catch (error) {
    console.error('获取活动详情失败:', error)
    return {
      success: false,
      message: '获取活动详情失败',
      error: error.message
    }
  }
}

exports.main = async (event, context) => {
  const activityId = typeof event.activityId === 'string' ? event.activityId.trim() : ''
  const skip = Math.max(0, Number(event.skip) || 0)
  const limit = Math.min(50, Math.max(1, Number(event.limit) || 10))
  const scene = typeof event.scene === 'string' ? event.scene.trim() : 'recent'
  const now = new Date()
  const recentCutoff = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

  try {
    if (activityId) {
      return await getActivityDetail(activityId)
    }

    const baseMatch = scene === 'join'
      ? {
          status: 'published',
          isDeleted: _.neq(true),
          startTime: _.lte(now),
          endTime: _.gte(now)
        }
      : {
          status: 'published',
          isDeleted: _.neq(true),
          startTime: _.lte(now),
          endTime: _.gte(recentCutoff)
        }

    const [countRes, listRes] = await Promise.all([
      db.collection('activities').where(baseMatch).count(),
      db.collection('activities').aggregate()
        .match(baseMatch)
        .addFields({
          isOngoing: $.and([
            $.lte(['$startTime', now]),
            $.gte(['$endTime', now])
          ])
        })
        .sort({
          sortWeight: -1,
          isOngoing: -1,
          startTime: -1
        })
        .skip(skip)
        .limit(limit)
        .project({
          _id: '$_id',
          title: '$title',
          summary: '$summary',
          coverImage: '$coverImage',
          startTime: '$startTime',
          endTime: '$endTime',
          status: '$status',
          sortWeight: '$sortWeight',
          postCount: '$postCount',
          lastPostTime: '$lastPostTime',
          createdBy: '$createdBy',
          createdAt: '$createdAt',
          updatedAt: '$updatedAt',
          isDeleted: '$isDeleted',
          isOngoing: '$isOngoing'
        })
        .end()
    ])

    const list = (listRes.list || []).map((activity) => buildPublicActivityView(activity))
    const total = countRes.total || 0

    return {
      success: true,
      activities: list,
      total,
      hasMore: skip + list.length < total
    }
  } catch (error) {
    console.error('获取近期活动失败:', error)
    return {
      success: false,
      message: '获取近期活动失败',
      error: error.message
    }
  }
}
