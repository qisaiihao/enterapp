// 批量记录浏览事件（事件层：view_events）
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

function formatMinute(ts) {
  const d = new Date(ts)
  const pad = (n) => (n < 10 ? '0' + n : String(n))
  const y = d.getFullYear()
  const m = pad(d.getMonth() + 1)
  const dd = pad(d.getDate())
  const hh = pad(d.getHours())
  const mm = pad(d.getMinutes())
  return `${y}${m}${dd}${hh}${mm}`
}

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID || event.openid
  const events = Array.isArray(event.events) ? event.events.slice(0, 100) : []
  const envId = wxContext.ENV || process.env.TCB_ENV || process.env.SCF_NAMESPACE || 'unknown-env'
  const debugRead = !!event.debugRead

  if (!openid) {
    return { success: false, code: 'NO_OPENID', message: '缺少openid' }
  }
  if (!events.length) {
    return { success: true, message: '无事件' }
  }

  let accepted = 0
  let ok = 0
  let failed = 0
  const ids = []
  const tasks = []
  for (const e of events) {
    if (!e || !e.postId) continue
    accepted += 1
    const ts = e.ts ? new Date(e.ts) : new Date()
    const minute = formatMinute(ts)
    const sid = e.sessionId || 's'
    const id = `ev_${openid}_${e.postId}_${sid}_${minute}`
    ids.push(id)
    const doc = {
      _id: id,
      _openid: openid,
      postId: e.postId,
      ts,
      sessionId: sid,
      duration: Number(e.duration || 0) || 0
    }
    // 幂等：存在则更新最大时长
    tasks.push((async () => {
      try {
        await db.collection('view_events').doc(id).set({ data: doc })
        ok += 1
      } catch (err) {
        try {
          await db.collection('view_events').doc(id).update({ data: { duration: _.max(doc.duration) } })
          ok += 1
        } catch (e2) {
          failed += 1
          console.error('[recordEventBatch] write failed', { id, err: String(err), err2: String(e2) })
        }
      }
    })())
  }

  // 分批并发，避免超并发
  const concurrency = 20
  while (tasks.length) {
    const chunk = tasks.splice(0, concurrency)
    await Promise.all(chunk)
  }

  const result = { success: failed === 0 && ok > 0, accepted, ok, failed, totalInput: events.length, env: envId, ids }
  if (debugRead && ids.length) {
    try {
      const probeId = ids[0]
      const getRes = await db.collection('view_events').doc(probeId).get()
      result.readBack = { id: probeId, found: !!(getRes && getRes.data), data: getRes && getRes.data }
    } catch (e) {
      result.readBack = { id: ids[0], found: false, error: String(e) }
    }
  }
  console.log('[recordEventBatch] result', result)
  return result
}
