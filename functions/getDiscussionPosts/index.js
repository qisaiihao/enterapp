// 获取讨论帖子云函数
const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();
const _ = db.command;
const $ = _.aggregate;

// 云函数入口函数
exports.main = async (event, context) => {
  console.log('🔍 [getDiscussionPosts] 云函数开始执行');
  console.log('🔍 [getDiscussionPosts] 接收到的参数:', event);

  const wxContext = cloud.getWXContext();
  const wxCtxOpenid = wxContext.OPENID;
  const eventOpenid = event.openid;
  const openid = eventOpenid || wxCtxOpenid;
  const { skip = 0, limit = 10 } = event;

  console.log('🔍 [getDiscussionPosts] 解析参数:', {
    eventOpenid: eventOpenid ? '提供' : '未提供',
    wxCtxOpenid: wxCtxOpenid ? '提供' : '未提供',
    chosenOpenidSource: eventOpenid ? 'event.openid' : 'wxContext.OPENID',
    chosenOpenidExists: !!openid,
    skip,
    limit
  });

  if (!openid) {
    console.error('❌ [getDiscussionPosts] 无法获取用户 openid');
    return {
      success: false,
      message: '无法获取用户 openid，请重新登录',
      code: 'NO_OPENID'
    };
  }

  try {
    console.log('🔍 [getDiscussionPosts] 开始构建查询');

    let query = db.collection('posts').aggregate();

    // 只查询讨论帖子
    const matchConditions = {
      isDiscussion: true
    };

    console.log('🔍 [getDiscussionPosts] 最终筛选条件:', matchConditions);

    // 应用筛选条件
    query = query.match(matchConditions);
    console.log('🔍 [getDiscussionPosts] 应用讨论帖子筛选条件');

    // 在筛选后进行排序和分页
    query = query.sort({ createTime: -1 })
      .skip(skip)
      .limit(limit);

    console.log('🔍 [getDiscussionPosts] 查询参数 - skip:', skip, 'limit:', limit);

    const postsRes = await query
      // 关联当前用户的点赞记录
      .lookup({
        from: 'votes_log',
        let: {
          post_id: '$_id'
        },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ['$postId', '$$post_id'] },
                  { $eq: ['$_openid', openid] },
                  { $eq: ['$type', 'post'] }
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
        author: '$author',
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
        // 讨论帖子专用字段
        isDiscussion: '$isDiscussion',
        quotedPostId: '$quotedPostId',
        quotedPostTitle: '$quotedPostTitle',
        quotedPostAuthor: '$quotedPostAuthor',
        quotedPostAuthorId: '$quotedPostAuthorId',
        sentenceGroups: '$sentenceGroups',
        discussionSentences: '$discussionSentences',
        highlightLines: '$highlightLines',
        highlightSentence: '$highlightSentence',
      })
      .end();

    const posts = postsRes.list;
    console.log('✅ [getDiscussionPosts] 查询成功，获取到帖子数量:', posts.length);

    if (posts.length > 0) {
      console.log('🔍 [getDiscussionPosts] 讨论帖子详情:');
      posts.forEach((post, index) => {
        console.log(`📝 [getDiscussionPosts] 讨论帖子${index + 1}:`, {
          _id: post._id,
          title: post.title,
          isDiscussion: post.isDiscussion,
          authorName: post.authorName,
          quotedPostTitle: post.quotedPostTitle,
          createTime: post.createTime
        });
      });
    } else {
      console.log('⚠️ [getDiscussionPosts] 没有找到讨论帖子');
    }

    // --- 优化图片URL转换逻辑 ---
    const fileIDs = new Set(); // 使用Set避免重复fileID

    posts.forEach(post => {
      // 保证 imageUrls、originalImageUrls 一定为数组
      if (!Array.isArray(post.imageUrls)) post.imageUrls = post.imageUrls ? [post.imageUrls] : [];
      if (!Array.isArray(post.originalImageUrls)) post.originalImageUrls = post.originalImageUrls ? [post.originalImageUrls] : [];

      // 收集所有需要转换的fileID
      const urlsToCheck = (post.imageUrls || [])
        .concat(post.originalImageUrls || [])
        .concat([post.imageUrl, post.originalImageUrl, post.authorAvatar, post.poemBgImage])
        .filter(url => url && url.startsWith('cloud://'));

      urlsToCheck.forEach(url => fileIDs.add(url));
    });

    console.log('🔍 [getDiscussionPosts] 需要转换的图片数量:', fileIDs.size);

    if (fileIDs.size > 0) {
      try {
        console.log('🔍 [getDiscussionPosts] 开始转换图片URL');
        const fileListResult = await cloud.getTempFileURL({ fileList: Array.from(fileIDs) });
        const urlMap = new Map();

        fileListResult.fileList.forEach(item => {
          if (item.status === 0) {
            urlMap.set(item.fileID, item.tempFileURL);
          }
        });

        console.log('✅ [getDiscussionPosts] 图片URL转换完成，成功转换数量:', urlMap.size);

        // 批量转换所有帖子的图片URL
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
        console.error('❌ [getDiscussionPosts] 图片URL转换失败:', fileError);
      }
    }

    console.log('✅ [getDiscussionPosts] 云函数执行完成，返回讨论帖子数量:', posts.length);

    return {
      success: true,
      posts: posts
    };

  } catch (e) {
    console.error('❌ [getDiscussionPosts] 云函数执行失败:', e);
    console.error('❌ [getDiscussionPosts] 错误详情:', {
      message: e.message,
      stack: e.stack,
      name: e.name
    });
    return {
      success: false,
      error: {
        message: e.message,
        stack: e.stack
      }
    };
  }
};