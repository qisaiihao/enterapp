// 获取讨论帖子云函数
const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();

// 云函数入口函数
exports.main = async (event, context) => {
  console.log('=== 获取讨论帖子云函数开始执行 ===');
  console.log('接收到的参数:', JSON.stringify(event, null, 2));

  const { skip = 0, limit = 10 } = event;

  try {
    // 查询讨论帖子（isDiscussion 为 true 的帖子）
    const query = db.collection('posts')
      .where({
        isDiscussion: true
      })
      .orderBy('createTime', 'desc')
      .skip(skip)
      .limit(limit);

    console.log('执行查询，参数:', { skip, limit });

    const result = await query.get();

    console.log('查询结果:', {
      total: result.data.length,
      posts: result.data.map(post => ({
        id: post._id,
        title: post.title,
        authorName: post.authorName,
        createTime: post.createTime,
        isDiscussion: post.isDiscussion
      }))
    });

    // 格式化时间
    const posts = result.data.map(post => {
      const formattedPost = {
        ...post,
        formattedCreateTime: formatRelativeTime(post.createTime)
      };

      // 确保必要的字段存在
      if (!formattedPost.commentCount) {
        formattedPost.commentCount = 0;
      }

      return formattedPost;
    });

    return {
      success: true,
      posts: posts,
      hasMore: posts.length === limit,
      skip: skip,
      limit: limit
    };

  } catch (error) {
    console.error('获取讨论帖子失败:', error);
    return {
      success: false,
      error: error.message,
      posts: []
    };
  }
};

// 格式化相对时间的辅助函数
function formatRelativeTime(dateString) {
  if (!dateString) return '';

  const date = new Date(dateString);
  const now = new Date();
  const diff = now - date;

  if (diff < 60000) {
    return '刚刚';
  } else if (diff < 3600000) {
    return Math.floor(diff / 60000) + '分钟前';
  } else if (diff < 86400000) {
    return Math.floor(diff / 3600000) + '小时前';
  } else if (diff < 604800000) {
    return Math.floor(diff / 86400000) + '天前';
  } else {
    return date.toLocaleDateString();
  }
}