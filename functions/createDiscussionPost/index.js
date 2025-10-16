const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();

// 创建讨论帖子
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID || event.openid;

  console.log('【createDiscussionPost】开始创建讨论，openid:', openid);

  if (!openid) {
    return {
      success: false,
      message: '无法获取用户信息，请重新登录',
      code: 'NO_OPENID'
    };
  }

  const { quotedPostId, content, imageUrls, publishMode, isDiscussion, sentenceGroups } = event;

  if (!quotedPostId) {
    return {
      success: false,
      message: '缺少引用帖子ID'
    };
  }

  if (!content || content.trim() === '') {
    return {
      success: false,
      message: '讨论内容不能为空'
    };
  }

  // 验证句子组数据
  if (!sentenceGroups || !Array.isArray(sentenceGroups) || sentenceGroups.length === 0) {
    return {
      success: false,
      message: '缺少句子组数据'
    };
  }

  // 验证每个句子组都有评论
  const hasValidComments = sentenceGroups.some(group =>
    group.comment && group.comment.trim().length > 0
  );

  if (!hasValidComments) {
    return {
      success: false,
      message: '请至少对其中一个句子输入评论'
    };
  }

  try {
    // 获取引用帖子的信息
    const quotedPostResult = await db.collection('posts').doc(quotedPostId).get();

    if (!quotedPostResult.data) {
      return {
        success: false,
        message: '引用的帖子不存在'
      };
    }

    const quotedPost = quotedPostResult.data;

    // 获取用户信息
    const userResult = await db.collection('users').where({
      _openid: openid
    }).get();

    if (userResult.data.length === 0) {
      return {
        success: false,
        message: '用户信息不存在'
      };
    }

    const user = userResult.data[0];

    // 生成讨论标题
    const discussionTitle = sentenceGroups.length > 1
      ? `关于「${quotedPost.title}」的多句讨论`
      : `关于「${quotedPost.title}」的讨论`;

    // 创建讨论帖子
    const postResult = await db.collection('posts').add({
      data: {
        _openid: openid,
        title: discussionTitle,
        content: content.trim(),
        quotedPostId: quotedPostId,
        quotedPostTitle: quotedPost.title,
        quotedPostAuthor: quotedPost.authorName,
        quotedPostAuthorId: quotedPost._openid,
        imageUrls: imageUrls || [],
        originalImageUrls: imageUrls || [],
        votes: 0,
        isVoted: false,
        commentCount: 0,
        tags: ['讨论'],
        isPoem: false,
        isOriginal: false,
        isDiscussion: true,
        publishMode: 'discussion',
        // 讨论专用字段
        sentenceGroups: sentenceGroups,
        discussionSentences: sentenceGroups.map(group => ({
          sentences: group.sentences,
          comment: group.comment.trim()
        })),
        // 从句子组中提取主要句子作为高光
        highlightLines: sentenceGroups.reduce((lines, group) => lines.concat(group.sentences || []), []),
        // 从句子组中提取主要句子作为高光句
        highlightSentence: (sentenceGroups[0] && sentenceGroups[0].sentences && sentenceGroups[0].sentences[0]) ? sentenceGroups[0].sentences[0] : '',
        createTime: new Date(),
        updateTime: new Date(),
        // 作者信息快照
        authorName: user.nickName || '匿名用户',
        authorAvatar: user.avatarUrl || '',
        authorNameSnapshot: user.nickName || '匿名用户',
        authorAvatarSnapshot: user.avatarUrl || ''
      }
    });

    console.log('【createDiscussionPost】创建讨论成功，ID:', postResult._id);

    // 更新引用帖子的讨论数量
    await db.collection('posts').doc(quotedPostId).update({
      data: {
        discussionCount: db.command.inc(1),
        updateTime: new Date()
      }
    });

    return {
      success: true,
      postId: postResult._id,
      message: '讨论发布成功'
    };

  } catch (error) {
    console.error('【createDiscussionPost】创建讨论失败:', error);
    return {
      success: false,
      message: '发布讨论失败',
      error: error.message
    };
  }
};