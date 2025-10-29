// 聚合 view_events 到 user_post_day / post_day（分钟级滚动）
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

function dayStr(d) {
  const pad = (n) => (n < 10 ? '0' + n : String(n))
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`
}

async function getJobState(id) {
  try {
    const res = await db.collection('jobs_state').doc(id).get()
    return res.data || null
  } catch (_) { return null }
}

async function setJobState(id, data) {
  try {
    await db.collection('jobs_state').doc(id).set({ data: Object.assign({ _id: id }, data) })
  } catch (_) {
    await db.collection('jobs_state').doc(id).update({ data })
  }
}

exports.main = async (event, context) => {
  const jobId = 'aggregateUserPostDay'
  const now = Date.now()
  const state = await getJobState(jobId)
  const lastTs = state && state.lastProcessedTs ? new Date(state.lastProcessedTs) : new Date(now - 60 * 60 * 1000)
  const endTs = new Date(now - 60 * 1000) // 留1分钟缓冲

  if (endTs <= lastTs) {
    return { success: true, message: 'no window', lastProcessedTs: lastTs }
  }

  const where = { ts: _.gt(lastTs).and(_.lte(endTs)) }
  const coll = db.collection('view_events')

  // 统计映射
  const userPostDay = new Map() // key = openid|postId|day
  const postDay = new Map()     // key = postId|day

  // 分页读取
  const pageSize = 100
  let skip = 0
  while (true) {
    const res = await coll.where(where).skip(skip).limit(pageSize).get()
    const list = res.data || []
    if (!list.length) break
    for (const ev of list) {
      const openid = ev._openid
      const postId = ev.postId
      const ts = new Date(ev.ts)
      const d = dayStr(ts)
      const dur = Number(ev.duration || 0) || 0
      const k1 = `${openid}|${postId}|${d}`
      let a = userPostDay.get(k1)
      if (!a) { a = { openid, postId, day: d, views: 0, duration: 0, firstAt: ts, lastAt: ts }; userPostDay.set(k1, a) }
      a.views += 1
      a.duration += dur
      if (ts < a.firstAt) a.firstAt = ts
      if (ts > a.lastAt) a.lastAt = ts

      const k2 = `${postId}|${d}`
      let b = postDay.get(k2)
      if (!b) { b = { postId, day: d, views: 0, duration: 0, firstAt: ts, lastAt: ts }; postDay.set(k2, b) }
      b.views += 1
      b.duration += dur
      if (ts < b.firstAt) b.firstAt = ts
      if (ts > b.lastAt) b.lastAt = ts
    }
    skip += pageSize
  }

  // 写入 user_post_day
  for (const [, v] of userPostDay) {
    const id = `upd_${v.openid}_${v.postId}_${v.day}`
    try {
      const upd = await db.collection('user_post_day').doc(id).update({
        data: {
          views: _.inc(v.views),
          duration: _.inc(v.duration),
          firstAt: _.min(v.firstAt),
          lastAt: _.max(v.lastAt),
          _openid: v.openid,
          postId: v.postId,
          day: v.day
        }
      })
      if (!upd.stats || !upd.stats.updated) {
        await db.collection('user_post_day').doc(id).set({ data: {
          _id: id, _openid: v.openid, postId: v.postId, day: v.day,
          views: v.views, viewUsers: 1, duration: v.duration, firstAt: v.firstAt, lastAt: v.lastAt
        }})
      }
    } catch (e) {
      try {
        await db.collection('user_post_day').doc(id).set({ data: {
          _id: id, _openid: v.openid, postId: v.postId, day: v.day,
          views: v.views, viewUsers: 1, duration: v.duration, firstAt: v.firstAt, lastAt: v.lastAt
        }})
      } catch (_) {}
    }
  }

  // 写入 post_day（uniqueViewers 留待后续由 user_post_day 聚合）
  for (const [, v] of postDay) {
    const id = `pd_${v.postId}_${v.day}`
    try {
      const upd = await db.collection('post_day').doc(id).update({
        data: {
          views: _.inc(v.views),
          duration: _.inc(v.duration),
          firstAt: _.min(v.firstAt),
          lastAt: _.max(v.lastAt),
          postId: v.postId,
          day: v.day
        }
      })
      if (!upd.stats || !upd.stats.updated) {
        await db.collection('post_day').doc(id).set({ data: {
          _id: id, postId: v.postId, day: v.day,
          views: v.views, duration: v.duration, firstAt: v.firstAt, lastAt: v.lastAt
        }})
      }
    } catch (e) {
      try {
        await db.collection('post_day').doc(id).set({ data: {
          _id: id, postId: v.postId, day: v.day,
          views: v.views, duration: v.duration, firstAt: v.firstAt, lastAt: v.lastAt
        }})
      } catch (_) {}
    }
  }

  await setJobState(jobId, { lastProcessedTs: endTs })

  return { success: true, window: { from: lastTs, to: endTs }, counts: { userPostDay: userPostDay.size, postDay: postDay.size } }
}

