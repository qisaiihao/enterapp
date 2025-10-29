// 由 post_day / user_post_day 构建 post_statistics（30天窗口）
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

function toISODate(dayStr) {
  const y = parseInt(dayStr.slice(0, 4), 10)
  const m = parseInt(dayStr.slice(4, 6), 10)
  const d = parseInt(dayStr.slice(6, 8), 10)
  return new Date(Date.UTC(y, m - 1, d))
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
  const days = dayList(windowDays)

  // 拉取近N天的 post_day 作为候选帖子集合
  const postDayColl = db.collection('post_day')
  const posts = new Map() // postId -> { views, duration, daily: Map(day->{views}) }
  const pageSize = 100
  for (let i = 0; i < days.length; i += 10) {
    const slice = days.slice(i, i + 10)
    let skip = 0
    while (true) {
      const res = await postDayColl.where({ day: _.in(slice) }).skip(skip).limit(pageSize).get()
      const list = res.data || []
      if (!list.length) break
      for (const r of list) {
        const pid = r.postId
        let acc = posts.get(pid)
        if (!acc) { acc = { views: 0, duration: 0, daily: new Map() }; posts.set(pid, acc) }
        acc.views += Number(r.views || 0)
        acc.duration += Number(r.duration || 0)
        const d = r.day
        const dv = acc.daily.get(d) || { views: 0 }
        dv.views += Number(r.views || 0)
        acc.daily.set(d, dv)
      }
      skip += pageSize
    }
  }

  // 为每个 post 计算 uniqueViewers30d：扫描 user_post_day 获取唯一 openid 集合
  const updColl = db.collection('user_post_day')
  for (const [postId, acc] of posts) {
    const uniqueOpenids = new Set()
    for (let i = 0; i < days.length; i += 10) {
      const slice = days.slice(i, i + 10)
      let skip = 0
      while (true) {
        const res = await updColl.where({ postId, day: _.in(slice) }).field({ _openid: true }).skip(skip).limit(pageSize).get()
        const list = res.data || []
        if (!list.length) break
        for (const r of list) uniqueOpenids.add(r._openid)
        skip += pageSize
      }
    }

    const dailyViewsArr = Array.from(acc.daily.entries())
      .sort((a,b) => a[0].localeCompare(b[0]))
      .map(([d, v]) => ({ date: toISODate(d).toISOString().slice(0,10), views: v.views }))

    const docId = `ps_${postId}`
    const viewCount30d = acc.views
    const totalDuration30d = acc.duration
    const uniqueViewers30d = uniqueOpenids.size
    const avgDuration30d = viewCount30d > 0 ? Math.round((totalDuration30d / viewCount30d) * 10) / 10 : 0

    try {
      const upd = await db.collection('post_statistics').doc(docId).update({
        data: {
          postId,
          viewCount30d: viewCount30d,
          uniqueViewers30d: uniqueViewers30d,
          totalDuration30d: totalDuration30d,
          avgDuration30d: avgDuration30d,
          dailyViews: dailyViewsArr,
          lastUpdatedAt: new Date()
        }
      })
      if (!upd.stats || !upd.stats.updated) {
        await db.collection('post_statistics').doc(docId).set({ data: {
          _id: docId,
          postId,
          viewCount30d, uniqueViewers30d, totalDuration30d, avgDuration30d,
          dailyViews: dailyViewsArr,
          lastUpdatedAt: new Date()
        }})
      }
    } catch (e) {
      try {
        await db.collection('post_statistics').doc(docId).set({ data: {
          _id: docId,
          postId,
          viewCount30d, uniqueViewers30d, totalDuration30d, avgDuration30d,
          dailyViews: dailyViewsArr,
          lastUpdatedAt: new Date()
        }})
      } catch (_) {}
    }
  }

  return { success: true, posts: posts.size, windowDays }
}

