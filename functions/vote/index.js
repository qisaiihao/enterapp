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

async function updateAuthorGrowthCounts(authorOpenid, oldVotes, newVotes) {
  const from = bucketOf(oldVotes)
  const to = bucketOf(newVotes)
  if (from === to) return
  const data = { growthUpdatedAt: db.serverDate() }
  if (from) data[`growthCounts.${from}`] = _.inc(-1)
  if (to) data[`growthCounts.${to}`] = _.inc(1)
  const upd = await db.collection('users').where({ _openid: authorOpenid }).update({ data })
  if (!upd.stats || upd.stats.updated === 0) {
    try {
      await db.collection('users').add({
        data: {
          _openid: authorOpenid,
          growthCounts: {
            seed: to === 'seed' ? 1 : 0,
            leaf: to === 'leaf' ? 1 : 0,
            flower: to === 'flower' ? 1 : 0,
            peach: to === 'peach' ? 1 : 0,
          },
          showGrowthStats: false,
          growthUpdatedAt: db.serverDate(),
          createTime: new Date(),
          updateTime: new Date(),
        },
      })
    } catch (e) {
      // ignore race
    }
  }
}

// 云函数入口函数
exports.main = async (event, context) => {
  
  try {
    const { postId } = event
    const wxContext = cloud.getWXContext()
    const wxCtxOpenid = wxContext.OPENID
    const eventOpenid = event.openid
    const openid = eventOpenid || wxCtxOpenid

    // 读取帖子，拿作者与当前票数（用于分段迁移）
    const postSnapBefore = await db.collection('posts').doc(postId).get()
    const postBefore = postSnapBefore.data
    if (!postBefore) {
      return { success: false, message: 'POST_NOT_FOUND' }
    }
    const authorOpenid = postBefore._openid
    const oldVotes = postBefore.votes || 0

    if (!openid) {
      console.error('❌ [vote] 无法获取用户 openid');
      return {
        success: false,
        message: '无法获取用户 openid，请重新登录',
        code: 'NO_OPENID'
      }
    }

    // 1. 查找 votes_log 表，精确查找 type 为 'post' 的记录
    const log = await db.collection('votes_log').where({
      _openid: openid,
      postId: postId,
      type: 'post'
    }).get()


    let updatedPost;
    let isLiked = false;

    if (log.data.length > 0) {
      // 2. 如果找到了记录，说明是"取消点赞"
      await db.collection('votes_log').doc(log.data[0]._id).remove()
      await db.collection('posts').doc(postId).update({ data: { votes: _.inc(-1) } })
      const postSnapAfter = await db.collection('posts').doc(postId).get()
      const newVotes = (postSnapAfter.data && postSnapAfter.data.votes) || (oldVotes - 1)
      await updateAuthorGrowthCounts(authorOpenid, oldVotes, newVotes)
      isLiked = false
    } else {
      // 3. 如果没找到记录，说明是"点赞"
      await db.collection('votes_log').add({
        data: {
          _openid: openid,
          postId: postId,
          type: 'post',
          createTime: new Date()
        }
      })
      await db.collection('posts').doc(postId).update({ data: { votes: _.inc(1) } })
      const postSnapAfter = await db.collection('posts').doc(postId).get()
      const newVotes = (postSnapAfter.data && postSnapAfter.data.votes) || (oldVotes + 1)
      await updateAuthorGrowthCounts(authorOpenid, oldVotes, newVotes)
      isLiked = true

      // === 新增：创建点赞消息通知 ===
      try {
        // 获取帖子信息
        const postResult = await db.collection('posts').doc(postId).get()
        const post = postResult.data
        
        // 获取点赞者信息
        const userResult = await db.collection('users').where({
          _openid: openid
        }).limit(1).get()
        const user = userResult.data[0]
        
        // 如果给自己点赞，不发送通知
        if (post._openid !== openid) {
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
              toUserId: post._openid,
              type: 'like',
              postId: postId,
              postTitle: post.title || '无标题',
              contentType: contentType,
              content: `${user ? user.nickName : '微信用户'} 点赞了你的${contentTypeText}`,
              isRead: false,
              createTime: new Date()
            }
          })
        }
      } catch (msgError) {
        console.error('创建点赞消息失败:', msgError)
        // 不影响主流程，只是记录错误
      }
    }

    // 4. 无论点赞还是取消，都重新获取文章的最新数据
    updatedPost = await db.collection('posts').doc(postId).get();

    const finalVotes = updatedPost.data.votes || 0;

    const result = {
      success: true,
      votes: finalVotes, // 返回最新的点赞数
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
