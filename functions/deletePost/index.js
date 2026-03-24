const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();
const _ = db.command;

const BUCKETS = [
  { key: 'seed', min: 1, max: 3 },
  { key: 'leaf', min: 4, max: 7 },
  { key: 'flower', min: 8, max: 15 },
  { key: 'peach', min: 16, max: Infinity }
];

const bucketOf = (value) => {
  const votes = typeof value === 'number' ? value : 0;
  if (votes < 1) return null;
  return BUCKETS.find(bucket => votes >= bucket.min && votes <= bucket.max)?.key || null;
};

async function syncPortfolioFolderCounts(ownerOpenid) {
  if (!ownerOpenid) return;

  const folderResult = await db.collection('portfolio_folders').where({
    _openid: ownerOpenid
  }).get();
  const folders = Array.isArray(folderResult.data) ? folderResult.data : [];

  await Promise.all(
    folders.map(async (folder) => {
      if (!folder || !folder._id) return;

      const countResult = await db.collection('portfolio_items').where({
        folderId: folder._id
      }).count();
      const exactCount = Number(countResult.total) || 0;

      await db.collection('portfolio_folders').doc(folder._id).update({
        data: {
          itemCount: exactCount,
          postCount: exactCount,
          updateTime: new Date()
        }
      });
    })
  );
}

exports.main = async (event) => {
  const { postId } = event;
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID || event.openid;

  if (!openid) {
    return {
      success: false,
      message: '无法获取用户 openid，请尝试重新登录',
      code: 'NO_OPENID'
    };
  }

  try {
    console.log('【deletePost】开始删除帖子', { postId, openid });

    const postResult = await db.collection('posts').doc(postId).get();
    const post = postResult.data;
    if (!post) {
      return { success: false, message: 'POST_NOT_FOUND' };
    }

    const isOwner = post._openid === openid || post.realAuthorOpenid === openid;
    if (!isOwner) {
      return {
        success: false,
        message: '权限不足，无法删除该内容'
      };
    }

    const authorOpenid = post.realAuthorOpenid || post._openid;
    const bucket = bucketOf(post.votes || 0);

    if (bucket) {
      await db.collection('users').where({ _openid: authorOpenid }).update({
        data: {
          [`growthCounts.${bucket}`]: _.inc(-1),
          growthUpdatedAt: db.serverDate()
        }
      });
    }

    await db.collection('portfolio_items').where({
      postId
    }).remove();
    await syncPortfolioFolderCounts(authorOpenid);

    const result = await db.collection('posts').doc(postId).remove();

    if (result.stats && result.stats.removed === 1) {
      return { success: true, message: '删除成功' };
    }

    return { success: false, message: '未找到对应记录，删除失败' };
  } catch (error) {
    console.error('【deletePost】删除帖子失败', error);
    return { success: false, error: error.message };
  }
};
