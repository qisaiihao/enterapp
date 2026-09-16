const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()
const _ = db.command

// buckets for growth stats on user profile
// 统一阈值：与前端显示一致 (1-3/4-7/8-15/16+)
const BUCKETS = [
  { key: 'seed', min: 1, max: 3 },
  { key: 'leaf', min: 4, max: 7 },
  { key: 'flower', min: 8, max: 15 },
  { key: 'peach', min: 16, max: Infinity },
]
const bucketOf = (v) => {
  v = typeof v === 'number' ? v : 0
  if (v < 1) return null
  for (const b of BUCKETS) {
    if (v >= b.min && v <= b.max) return b.key
  }
  return null
}

function getAuthorOpenid(post) {
  if (post.isAnonymous && post.realAuthorOpenid) return post.realAuthorOpenid
  // 旧匿名帖可能没有真实作者，不能把通知和统计写到公共匿名账号。
  return post._openid === '123456' ? '' : post._openid
}

async function updateAuthorGrowthCounts(transaction, authorOpenid, oldVotes, newVotes) {
  const from = bucketOf(oldVotes)
  const to = bucketOf(newVotes)
  if (!authorOpenid || from === to) return

  // 事务不支持 where：先定位用户文档，再在事务内更新该文档。
  const authorResult = await db.collection('users').where({ _openid: authorOpenid }).limit(1).get()
  const author = authorResult.data[0]
  // 点赞不负责创建账号，缺失作者时也不能产生只有成长统计的用户记录。
  if (!author) return

  const data = { growthUpdatedAt: db.serverDate() }
  if (from) data[`growthCounts.${from}`] = _.inc(-1)
  if (to) data[`growthCounts.${to}`] = _.inc(1)
  await transaction.collection('users').doc(author._id).update({ data })
}

// 云函数入口函数
exports.main = async (event, context) => {
  
  try {
    const { postId } = event
    const wxContext = cloud.getWXContext()
    const wxCtxOpenid = wxContext.OPENID
    const eventOpenid = event.openid
    const openid = eventOpenid || wxCtxOpenid

    if (!openid) {
      console.error('❌ [vote] 无法获取用户 openid');
      return {
        success: false,
        message: '无法获取用户 openid，请重新登录',
        code: 'NO_OPENID'
      }
    }
    if (!postId) return { success: false, message: '缺少帖子ID' }

    const committed = await db.runTransaction(async transaction => {
      const postRef = transaction.collection('posts').doc(postId)
      const postResult = await postRef.get()
      const post = postResult.data
      if (!post) return { success: false, message: 'POST_NOT_FOUND' }

      // 必须先在事务中读帖子，再查询旧点赞记录；保留随机 ID 的历史记录兼容。
      // 所有点赞都更新同一帖子文档，并发冲突时整个回调重跑，重新读取点赞状态。
      const log = await db.collection('votes_log').where({
        _openid: openid,
        postId,
        type: 'post'
      }).limit(1).get()
      const isLiked = log.data.length === 0
      const oldVotes = Math.max(0, post.votes || 0)
      const votes = Math.max(0, oldVotes + (isLiked ? 1 : -1))
      const authorOpenid = getAuthorOpenid(post)

      if (isLiked) {
        await transaction.collection('votes_log').add({
          data: { _openid: openid, postId, type: 'post', createTime: new Date() }
        })
      } else {
        await transaction.collection('votes_log').doc(log.data[0]._id).remove()
      }
      await postRef.update({ data: { votes } })
      await updateAuthorGrowthCounts(transaction, authorOpenid, oldVotes, votes)
      return { success: true, post, authorOpenid, votes, isLiked }
    })
    if (!committed.success) return committed

    const { post, authorOpenid, votes, isLiked } = committed
    // 通知只在事务提交后发送，避免冲突重试产生重复通知。
    if (isLiked && authorOpenid && authorOpenid !== openid) {
      // === 新增：创建点赞消息通知 ===
      try {
        // 获取点赞者信息
        const userResult = await db.collection('users').where({
          _openid: openid
        }).limit(1).get()
        const user = userResult.data[0]
        
        // 根据帖子实际字段确定内容类型
        let contentType = 'post';
        let contentTypeText = '帖子';

        if (post.isDiscussion) {
          contentType = 'discussion';
          contentTypeText = '讨论';
        } else if (post.isPoem) {
          if (post.isOriginal) {
            contentType = 'original';
            contentTypeText = '原创诗歌';
          } else {
            contentType = 'non-original';
            contentTypeText = '诗歌';
          }
        }

        await db.collection('messages').add({
          data: {
            fromUserId: openid,
            fromUserName: user ? user.nickName : '微信用户',
            fromUserAvatar: user ? user.avatarUrl : '',
            toUserId: authorOpenid,
            type: 'like',
            postId: postId,
            postTitle: post.title || '无标题',
            contentType: contentType,
            content: `${user ? user.nickName : '微信用户'} 点赞了你的${contentTypeText}`,
            isRead: false,
            createTime: new Date()
          }
        })
      } catch (msgError) {
        console.error('创建点赞消息失败:', msgError)
        // 不影响主流程，只是记录错误
      }
    }

    const result = {
      success: true,
      votes, // 返回本次事务提交的点赞数
      isLiked: isLiked
    };

    return result;

  } catch (e) {
    console.error('云函数执行失败:', e);
    return {
      success: false,
      error: {
        message: e.message,
        stack: e.stack
      }
    }
  }
}
