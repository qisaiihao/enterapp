// 一次性迁移脚本：为历史数据回填 user_id，并写入 identities；为 posts/comments/votes_log 回填 authorId/user_id
// 使用方式：云端手动调用，分批执行，例如：{ op: 'all', batchSize: 100 }
const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()
const _ = db.command
const { genUserId, upsertWeappIdentity } = require('./identity.js')

exports.main = async (event, context) => {
  const { op = 'all', batchSize = 100, appid } = event || {}
  const results = {}

  if (op === 'all' || op === 'users') {
    results.users = await backfillUsers({ batchSize, appid })
  }
  if (op === 'all' || op === 'posts') {
    results.posts = await backfillPosts({ batchSize })
  }
  if (op === 'all' || op === 'comments') {
    results.comments = await backfillCollectionUserRef({ coll: 'comments', field: 'authorId', batchSize })
  }
  if (op === 'all' || op === 'votes') {
    results.votes = await backfillCollectionUserRef({ coll: 'votes_log', field: 'user_id', batchSize })
  }

  return { success: true, results }
}

async function backfillUsers({ batchSize, appid }) {
  let processed = 0
  while (true) {
    const res = await db.collection('users')
      .where(_.or([ { user_id: _.exists(false) }, { user_id: _.eq(null) }, { user_id: '' } ]))
      .limit(batchSize)
      .get()
    if (!res.data.length) break
    for (const u of res.data) {
      const user_id = genUserId()
      try {
        await db.collection('users').doc(u._id).update({ data: { user_id } })
        if (u._openid && appid) await upsertWeappIdentity({ user_id, appid, openid: u._openid })
        processed++
      } catch (e) { /* continue */ }
    }
  }
  return { processed }
}

async function backfillPosts({ batchSize }) {
  let processed = 0
  while (true) {
    const res = await db.collection('posts')
      .where(_.and([
        _.or([{ authorId: _.exists(false) }, { authorId: _.eq(null) }, { authorId: '' }]),
        { _openid: _.neq(null) }
      ]))
      .limit(batchSize)
      .get()
    if (!res.data.length) break
    for (const p of res.data) {
      const uid = await userIdByOpenid(p._openid)
      if (uid) {
        try { await db.collection('posts').doc(p._id).update({ data: { authorId: uid } }); processed++ } catch (e) {}
      }
    }
  }
  return { processed }
}

async function backfillCollectionUserRef({ coll, field, batchSize }) {
  let processed = 0
  while (true) {
    const res = await db.collection(coll)
      .where(_.and([
        _.or([{ [field]: _.exists(false) }, { [field]: _.eq(null) }, { [field]: '' }]),
        { _openid: _.neq(null) }
      ]))
      .limit(batchSize)
      .get()
    if (!res.data.length) break
    for (const d of res.data) {
      const uid = await userIdByOpenid(d._openid)
      if (uid) {
        try { await db.collection(coll).doc(d._id).update({ data: { [field]: uid } }); processed++ } catch (e) {}
      }
    }
  }
  return { processed }
}

async function userIdByOpenid(openid) {
  if (!openid) return null
  const u = await db.collection('users').where({ _openid: openid }).limit(1).get()
  return u.data && u.data.length ? (u.data[0].user_id || null) : null
}
