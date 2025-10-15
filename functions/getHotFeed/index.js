// 热门推荐云函数
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;
const $ = _.aggregate;

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID || event.openid;

  if (!openid) {
    return {
      success: false,
      message: '无法获取用户 openid，请重新登录',
      code: 'NO_OPENID'
    };
  }

  const { limit = 2, skip = 0, excludePostIds = [] } = event;

  try {
    // 1. 构建查询条件
    let matchConditions = {
      isOriginal: true // 只推荐原创内容
    };

    // 排除指定的帖子ID（避免重复推荐）
    if (excludePostIds && excludePostIds.length > 0) {
      matchConditions._id = _.nin(excludePostIds);
    }

    // 2. 计算热度分并排序
    // 热度分 = 点赞数 * 2 + 评论数 * 5 + 收藏数 * 3
    // 由于我们没有收藏功能，暂时只考虑点赞和评论
    const postsResult = await db.collection('posts').aggregate()
      .match(matchConditions)
      .addFields({
        hotScore: {
          $add: [
            { $multiply: [{ $ifNull: ['$votes', 0] }, 2] }, // 点赞数 * 2
            { $multiply: [{ $ifNull: ['$commentCount', 0] }, 5] } // 评论数 * 5
          ]
        }
      })
      .sort({ hotScore: -1, createTime: -1 }) // 按热度分降序，时间降序
      .skip(skip)
      .limit(limit)
      .lookup({
        from: 'votes_log',
        let: { post_id: '$_id' },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ['$postId', '$$post_id'] },
                  { $eq: ['$_openid', openid] },
                  { $eq: ['$type', 'post'] } // 只查询帖子点赞记录，排除评论点赞记录
                ]
              }
            }
          }
        ],
        as: 'userVote',
      })
      .project({
        _id: '$_id',
        _openid: '$_openid',
        title: '$title',
        content: '$content',
        createTime: '$createTime',
        imageUrl: '$imageUrl',
        imageUrls: '$imageUrls',
        originalImageUrl: '$originalImageUrl',
        originalImageUrls: '$originalImageUrls',
        votes: '$votes',
        isPoem: '$isPoem',
        isOriginal: '$isOriginal',
        poemBgImage: '$poemBgImage',
        tags: '$tags',
        hotScore: '$hotScore',
        authorName: $.ifNull([
          '$authorName',
          $.ifNull(['$authorNameSnapshot', '匿名用户'])
        ]),
        authorAvatar: $.ifNull([
          '$authorAvatar',
          $.ifNull(['$authorAvatarSnapshot', ''])
        ]),
        commentCount: $.ifNull(['$commentCount', 0]),
        isVoted: $.gt([$.size('$userVote'), 0]),
      })
      .end();

    const posts = postsResult.list || [];

    // 3. 处理图片URL转换
    const fileIDs = new Set();
    
    posts.forEach(post => {
      if (!Array.isArray(post.imageUrls)) post.imageUrls = post.imageUrls ? [post.imageUrls] : [];
      if (!Array.isArray(post.originalImageUrls)) post.originalImageUrls = post.originalImageUrls ? [post.originalImageUrls] : [];
      
      const urlsToCheck = [
        ...post.imageUrls,
        ...post.originalImageUrls,
        post.imageUrl,
        post.originalImageUrl,
        post.authorAvatar,
        post.poemBgImage
      ].filter(url => url && url.startsWith('cloud://'));
      
      urlsToCheck.forEach(url => fileIDs.add(url));
    });

    if (fileIDs.size > 0) {
      try {
        const fileListResult = await cloud.getTempFileURL({ fileList: Array.from(fileIDs) });
        const urlMap = new Map();
        
        fileListResult.fileList.forEach(item => {
          if (item.status === 0) {
            urlMap.set(item.fileID, item.tempFileURL);
          }
        });

        posts.forEach(post => {
          const convertUrl = (url) => urlMap.get(url) || url;
          
          if (post.imageUrl) post.imageUrl = convertUrl(post.imageUrl);
          if (post.originalImageUrl) post.originalImageUrl = convertUrl(post.originalImageUrl);
          if (post.authorAvatar) post.authorAvatar = convertUrl(post.authorAvatar);
          if (post.poemBgImage) post.poemBgImage = convertUrl(post.poemBgImage);
          
          if (Array.isArray(post.imageUrls)) {
            post.imageUrls = post.imageUrls.map(convertUrl);
          }
          if (Array.isArray(post.originalImageUrls)) {
            post.originalImageUrls = post.originalImageUrls.map(convertUrl);
          }
        });
      } catch (fileError) {
        console.error('图片URL转换失败:', fileError);
      }
    }

    return {
      success: true,
      posts: posts,
      total: posts.length
    };

  } catch (error) {
    console.error('热门推荐失败:', error);
    return {
      success: false,
      message: '热门推荐失败',
      error: error.message
    };
  }
};
