// 从 user_post_day + posts 生成用户兴趣画像（作者/标签 Top-K）
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

function parseDay(dayStr) {
  const y = parseInt(dayStr.slice(0, 4), 10)
  const m = parseInt(dayStr.slice(4, 6), 10)
  const d = parseInt(dayStr.slice(6, 8), 10)
  return new Date(Date.UTC(y, m - 1, d))
}

function dayDiff(a, b) { // b - a in days
  const ms = b.getTime() - a.getTime()
  return Math.floor(ms / (24 * 3600 * 1000))
}

function rankTop(obj, topN) {
  const arr = Object.keys(obj).map(k => ({ key: k, ...obj[k] }))
  arr.sort((x, y) => (y.weight - x.weight) || ((y.viewCount||0) - (x.viewCount||0)))
  return arr.slice(0, topN)
}

async function listActiveUsers(days, limit) {
  const since = dayList(days)
  const set = new Set()
  const coll = db.collection('user_post_day')
  const pageSize = 100
  for (let i = 0; i < since.length; i += 10) {
    const slice = since.slice(i, i + 10)
    let skip = 0
    while (true) {
      const res = await coll.where({ day: _.in(slice) }).field({ _openid: true }).skip(skip).limit(pageSize).get()
      const list = res.data || []
      if (!list.length) break
      for (const r of list) {
        set.add(r._openid)
        if (set.size >= limit) return Array.from(set)
      }
      skip += pageSize
    }
  }
  return Array.from(set)
}

function dayList(days) {
  const list = []
  const now = new Date()
  for (let i = 0; i < days; i++) {
    const d = new Date(now.getTime() - i * 24 * 3600 * 1000)
    const y = d.getFullYear()
    const m = (d.getMonth() + 1).toString().padStart(2, '0')
    const dd = d.getDate().toString().padStart(2, '0')
    list.push(`${y}${m}${dd}`)
  }
  return list
}

exports.main = async (event, context) => {
  const windowDays = Math.min(90, Math.max(7, parseInt(event && event.days || 30)))
  const topAuthors = Math.min(100, Math.max(10, parseInt(event && event.topAuthors || 50)))
  const topTags = Math.min(200, Math.max(10, parseInt(event && event.topTags || 100)))

  let openids = Array.isArray(event && event.openids) ? event.openids.slice(0, 200) : null
  if (!openids || !openids.length) {
    openids = await listActiveUsers(7, 200)
  }
  if (!openids.length) return { success: true, processed: 0 }

  const days = dayList(windowDays)
  const postsColl = db.collection('posts')
  const updColl = db.collection('user_post_day')
  const now = new Date()

  let processed = 0
  for (const openid of openids) {
    // 1) 拉取该用户窗口内的 user_post_day
    let skip = 0
    const pageSize = 100
    const items = []
    while (true) {
      const res = await updColl.where({ _openid: openid, day: _.in(days) }).skip(skip).limit(pageSize).get()
      const list = res.data || []
      if (!list.length) break
      items.push(...list)
      skip += pageSize
    }
    if (!items.length) continue

    // 2) 批量查 posts 的标签/作者
    const postIds = Array.from(new Set(items.map(i => i.postId))).filter(Boolean)
    const meta = new Map()
    for (let i = 0; i < postIds.length; i += 100) {
      const slice = postIds.slice(i, i + 100)
      const res = await postsColl.where({ _id: _.in(slice) }).field({ _openid: true, tags: true }).get()
      const list = res.data || []
      for (const p of list) meta.set(p._id, p)
    }

    // 3) 累积权重（含时间衰减）
    const authorWeights = {}
    const tagWeights = {}
    let totalViews = 0
    let totalDuration = 0
    const activeDaySet = new Set()

    for (const it of items) {
      const post = meta.get(it.postId)
      if (!post) continue
      const views = Number(it.views || 0)
      const duration = Number(it.duration || 0)
      const d = parseDay(it.day)
      const daysAgo = dayDiff(d, now)
      const decay = Math.pow(0.9, daysAgo / 3)
      const w = views * 1.0 + duration / 30
      const wdec = w * decay

      const authorId = post._openid
      if (authorId) {
        const a = authorWeights[authorId] || { authorId, weight: 0, viewCount: 0, avgViewDuration: 0, lastInteractTime: null }
        a.weight += wdec
        a.viewCount += views
        a.avgViewDuration = a.viewCount > 0 ? (a.avgViewDuration * (a.viewCount - views) + duration) / a.viewCount : 0
        a.lastInteractTime = (!a.lastInteractTime || d > a.lastInteractTime) ? d : a.lastInteractTime
        authorWeights[authorId] = a
      }
      const tags = Array.isArray(post.tags) ? post.tags : []
      for (const tag of tags) {
        const t = tagWeights[tag] || { tag, weight: 0, viewCount: 0, avgViewDuration: 0, lastInteractTime: null }
        t.weight += wdec
        t.viewCount += views
        t.avgViewDuration = t.viewCount > 0 ? (t.avgViewDuration * (t.viewCount - views) + duration) / t.viewCount : 0
        t.lastInteractTime = (!t.lastInteractTime || d > t.lastInteractTime) ? d : t.lastInteractTime
        tagWeights[tag] = t
      }
      totalViews += views
      totalDuration += duration
      activeDaySet.add(it.day)
    }

    // 4) 写入 user_interests
    const docId = `ui_${openid}`
    const interestedAuthors = rankTop(authorWeights, topAuthors).map(x => ({
      authorId: x.authorId,
      weight: Math.round(x.weight * 100) / 100,
      viewCount: x.viewCount,
      avgViewDuration: Math.round((x.avgViewDuration || 0) * 10) / 10,
      lastInteractTime: x.lastInteractTime || null
    }))
    const interestedTags = rankTop(tagWeights, topTags).map(x => ({
      tag: x.tag,
      weight: Math.round(x.weight * 100) / 100,
      viewCount: x.viewCount,
      avgViewDuration: Math.round((x.avgViewDuration || 0) * 10) / 10,
      lastInteractTime: x.lastInteractTime || null
    }))

    try {
      const upd = await db.collection('user_interests').doc(docId).update({
        data: {
          _openid: openid,
          interestedAuthors,
          interestedTags,
          totalViews30d: totalViews,
          totalDuration30d: totalDuration,
          avgViewDuration30d: totalViews > 0 ? Math.round((totalDuration / totalViews) * 10) / 10 : 0,
          activeDays30d: activeDaySet.size,
          lastUpdatedAt: new Date()
        }
      })
      if (!upd.stats || !upd.stats.updated) {
        await db.collection('user_interests').doc(docId).set({ data: {
          _id: docId,
          _openid: openid,
          interestedAuthors,
          interestedTags,
          totalViews30d: totalViews,
          totalDuration30d: totalDuration,
          avgViewDuration30d: totalViews > 0 ? Math.round((totalDuration / totalViews) * 10) / 10 : 0,
          activeDays30d: activeDaySet.size,
          lastUpdatedAt: new Date()
        }})
      }
    } catch (e) {
      try {
        await db.collection('user_interests').doc(docId).set({ data: {
          _id: docId,
          _openid: openid,
          interestedAuthors,
          interestedTags,
          totalViews30d: totalViews,
          totalDuration30d: totalDuration,
          avgViewDuration30d: totalViews > 0 ? Math.round((totalDuration / totalViews) * 10) / 10 : 0,
          activeDays30d: activeDaySet.size,
          lastUpdatedAt: new Date()
        }})
      } catch (_) {}
    }

    processed += 1
  }

  return { success: true, processed, windowDays }
}

