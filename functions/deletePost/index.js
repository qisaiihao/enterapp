const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();
const _ = db.command;

// Growth buckets for user.growthCounts (include hidden/discussion posts)
// 统一阈值：与前端显示一致 (1-3/4-7/8-15/16+)
const BUCKETS = [
  { key: 'seed', min: 1, max: 3 },
  { key: 'leaf', min: 4, max: 7 },
  { key: 'flower', min: 8, max: 15 },
  { key: 'peach', min: 16, max: Infinity },
];
const bucketOf = (v) => {
  v = typeof v === 'number' ? v : 0;
  if (v < 1) return null;
  for (const b of BUCKETS) {
    if (v >= b.min && v <= b.max) return b.key;
  }
  return null;
};

// 云函数入口函数
exports.main = async (event, context) => {
  const { postId } = event;
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID || event.openid;

  if (!openid) {
    return {
      success: false,
      message: '无法获取用户 openid，请尝试登录',
      code: 'NO_OPENID'
    };
  }

  try {
    // 1. 读取帖子
    const postResult = await db.collection('posts').doc(postId).get();
    const post = postResult.data;
    if (!post) {
      return { success: false, message: 'POST_NOT_FOUND' };
    }

    // 2. 权限校验
    if (post._openid !== openid) {
      return {
        success: false,
        message: '权限不足，无法删除该内容'
      };
    }

    // 3. 删除前更新作者分段计数（不排除隐藏/讨论）
    const votes = post.votes || 0;
    const bucket = bucketOf(votes);
    if (bucket) {
      await db.collection('users').where({ _openid: post._openid }).update({
        data: { [`growthCounts.${bucket}`]: _.inc(-1), growthUpdatedAt: db.serverDate() }
      });
    }

    // 4. 执行删除
    const result = await db.collection('posts').doc(postId).remove();

    if (result.stats && result.stats.removed === 1) {
      return { success: true, message: '删除成功' };
    } else {
      return { success: false, message: '未找到对应记录，删除失败' };
    }
  } catch (e) {
    console.error('删除帖子失败', e);
    return { success: false, error: e.message };
  }
};

