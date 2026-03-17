// 云函数：bindWechatOpenid
// 功能：将用户的旧 openid 批量更新为新的微信 openid

const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();
const MAX_LIMIT = 1000;

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const { oldOpenid, poemId } = event;
  const newOpenid = wxContext.OPENID;
  
  console.log('🔍 [bindWechatOpenid] 开始绑定微信 openid');
  console.log('🔍 [bindWechatOpenid] 参数:', { oldOpenid, newOpenid, poemId });
  
  if (!oldOpenid || !newOpenid) {
    return {
      success: false,
      message: '参数错误：缺少 openid'
    };
  }
  
  if (oldOpenid === newOpenid) {
    return {
      success: true,
      message: 'openid 相同，无需更新'
    };
  }
  
  try {
    // 验证用户身份：确保 poemId 对应的用户的 openid 是 oldOpenid
    const userRes = await db.collection('users').where({
      poemId: poemId,
      _openid: oldOpenid
    }).get();
    
    if (userRes.data.length === 0) {
      return {
        success: false,
        message: '用户验证失败'
      };
    }

    const userId = userRes.data[0]._id;
    const updateResults = {
      users: 0,
      posts: 0,
      comments: 0,
      favorites: 0,
      messages: 0,
      images: 0,
      votes_log: 0,
      follows: 0,
      portfolios: 0,
      blocks: 0
    };
    
    // 1. 更新 users 表
    console.log('📝 [bindWechatOpenid] 更新 users 表');
    const usersUpdate = await db.collection('users').doc(userId).update({
      data: {
        _openid: newOpenid,
        updateTime: new Date()
      }
    });
    updateResults.users = usersUpdate.stats.updated;
    
    // 2. 批量更新 posts 表
    console.log('📝 [bindWechatOpenid] 更新 posts 表');
    let postsUpdated = 0;
    let hasMorePosts = true;
    while (hasMorePosts) {
      const postsRes = await db.collection('posts')
        .where({ _openid: oldOpenid })
        .limit(MAX_LIMIT)
        .get();
      
      if (postsRes.data.length === 0) {
        hasMorePosts = false;
        break;
      }
      
      const updatePromises = postsRes.data.map(post => 
        db.collection('posts').doc(post._id).update({
          data: { _openid: newOpenid }
        })
      );
      
      await Promise.all(updatePromises);
      postsUpdated += postsRes.data.length;
      
      if (postsRes.data.length < MAX_LIMIT) {
        hasMorePosts = false;
      }
    }
    updateResults.posts = postsUpdated;
    
    // 3. 批量更新 comments 表
    console.log('📝 [bindWechatOpenid] 更新 comments 表');
    let commentsUpdated = 0;
    let hasMoreComments = true;
    while (hasMoreComments) {
      const commentsRes = await db.collection('comments')
        .where({ _openid: oldOpenid })
        .limit(MAX_LIMIT)
        .get();
      
      if (commentsRes.data.length === 0) {
        hasMoreComments = false;
        break;
      }
      
      const updatePromises = commentsRes.data.map(comment => 
        db.collection('comments').doc(comment._id).update({
          data: { _openid: newOpenid }
        })
      );
      
      await Promise.all(updatePromises);
      commentsUpdated += commentsRes.data.length;
      
      if (commentsRes.data.length < MAX_LIMIT) {
        hasMoreComments = false;
      }
    }
    updateResults.comments = commentsUpdated;

    // 4. 批量更新 favorites 表
    console.log('📝 [bindWechatOpenid] 更新 favorites 表');
    let favoritesUpdated = 0;
    let hasMoreFavorites = true;
    while (hasMoreFavorites) {
      const favoritesRes = await db.collection('favorites')
        .where({ _openid: oldOpenid })
        .limit(MAX_LIMIT)
        .get();
      
      if (favoritesRes.data.length === 0) {
        hasMoreFavorites = false;
        break;
      }
      
      const updatePromises = favoritesRes.data.map(favorite => 
        db.collection('favorites').doc(favorite._id).update({
          data: { _openid: newOpenid }
        })
      );
      
      await Promise.all(updatePromises);
      favoritesUpdated += favoritesRes.data.length;
      
      if (favoritesRes.data.length < MAX_LIMIT) {
        hasMoreFavorites = false;
      }
    }
    updateResults.favorites = favoritesUpdated;
    
    // 5. 批量更新 messages 表（发送者和接收者）
    console.log('📝 [bindWechatOpenid] 更新 messages 表');
    let messagesUpdated = 0;
    
    // 更新作为发送者的消息
    let hasMoreFromMessages = true;
    while (hasMoreFromMessages) {
      const fromMessagesRes = await db.collection('messages')
        .where({ fromUserId: oldOpenid })
        .limit(MAX_LIMIT)
        .get();
      
      if (fromMessagesRes.data.length === 0) {
        hasMoreFromMessages = false;
        break;
      }
      
      const updatePromises = fromMessagesRes.data.map(message => 
        db.collection('messages').doc(message._id).update({
          data: { fromUserId: newOpenid }
        })
      );
      
      await Promise.all(updatePromises);
      messagesUpdated += fromMessagesRes.data.length;
      
      if (fromMessagesRes.data.length < MAX_LIMIT) {
        hasMoreFromMessages = false;
      }
    }
    
    // 更新作为接收者的消息
    let hasMoreToMessages = true;
    while (hasMoreToMessages) {
      const toMessagesRes = await db.collection('messages')
        .where({ toUserId: oldOpenid })
        .limit(MAX_LIMIT)
        .get();
      
      if (toMessagesRes.data.length === 0) {
        hasMoreToMessages = false;
        break;
      }
      
      const updatePromises = toMessagesRes.data.map(message => 
        db.collection('messages').doc(message._id).update({
          data: { toUserId: newOpenid }
        })
      );
      
      await Promise.all(updatePromises);
      messagesUpdated += toMessagesRes.data.length;
      
      if (toMessagesRes.data.length < MAX_LIMIT) {
        hasMoreToMessages = false;
      }
    }
    updateResults.messages = messagesUpdated;

    // 6. 批量更新 images 表
    console.log('📝 [bindWechatOpenid] 更新 images 表');
    let imagesUpdated = 0;
    let hasMoreImages = true;
    while (hasMoreImages) {
      const imagesRes = await db.collection('images')
        .where({ _openid: oldOpenid })
        .limit(MAX_LIMIT)
        .get();
      
      if (imagesRes.data.length === 0) {
        hasMoreImages = false;
        break;
      }
      
      const updatePromises = imagesRes.data.map(image => 
        db.collection('images').doc(image._id).update({
          data: { _openid: newOpenid }
        })
      );
      
      await Promise.all(updatePromises);
      imagesUpdated += imagesRes.data.length;
      
      if (imagesRes.data.length < MAX_LIMIT) {
        hasMoreImages = false;
      }
    }
    updateResults.images = imagesUpdated;
    
    // 7. 批量更新 votes_log 表
    console.log('📝 [bindWechatOpenid] 更新 votes_log 表');
    let votesUpdated = 0;
    let hasMoreVotes = true;
    while (hasMoreVotes) {
      const votesRes = await db.collection('votes_log')
        .where({ _openid: oldOpenid })
        .limit(MAX_LIMIT)
        .get();
      
      if (votesRes.data.length === 0) {
        hasMoreVotes = false;
        break;
      }
      
      const updatePromises = votesRes.data.map(vote => 
        db.collection('votes_log').doc(vote._id).update({
          data: { _openid: newOpenid }
        })
      );
      
      await Promise.all(updatePromises);
      votesUpdated += votesRes.data.length;
      
      if (votesRes.data.length < MAX_LIMIT) {
        hasMoreVotes = false;
      }
    }
    updateResults.votes_log = votesUpdated;
    
    // 8. 批量更新 follows 表（作为关注者和被关注者）
    console.log('📝 [bindWechatOpenid] 更新 follows 表');
    let followsUpdated = 0;
    
    // 更新作为关注者的记录
    let hasMoreFollower = true;
    while (hasMoreFollower) {
      const followerRes = await db.collection('follows')
        .where({ followerId: oldOpenid })
        .limit(MAX_LIMIT)
        .get();
      
      if (followerRes.data.length === 0) {
        hasMoreFollower = false;
        break;
      }
      
      const updatePromises = followerRes.data.map(follow => 
        db.collection('follows').doc(follow._id).update({
          data: { followerId: newOpenid }
        })
      );
      
      await Promise.all(updatePromises);
      followsUpdated += followerRes.data.length;
      
      if (followerRes.data.length < MAX_LIMIT) {
        hasMoreFollower = false;
      }
    }
    
    // 更新作为被关注者的记录
    let hasMoreFollowed = true;
    while (hasMoreFollowed) {
      const followedRes = await db.collection('follows')
        .where({ followedId: oldOpenid })
        .limit(MAX_LIMIT)
        .get();
      
      if (followedRes.data.length === 0) {
        hasMoreFollowed = false;
        break;
      }
      
      const updatePromises = followedRes.data.map(follow => 
        db.collection('follows').doc(follow._id).update({
          data: { followedId: newOpenid }
        })
      );
      
      await Promise.all(updatePromises);
      followsUpdated += followedRes.data.length;
      
      if (followedRes.data.length < MAX_LIMIT) {
        hasMoreFollowed = false;
      }
    }
    updateResults.follows = followsUpdated;
    
    // 9. 批量更新 portfolios 表
    console.log('📝 [bindWechatOpenid] 更新 portfolios 表');
    let portfoliosUpdated = 0;
    let hasMorePortfolios = true;
    while (hasMorePortfolios) {
      const portfoliosRes = await db.collection('portfolios')
        .where({ _openid: oldOpenid })
        .limit(MAX_LIMIT)
        .get();
      
      if (portfoliosRes.data.length === 0) {
        hasMorePortfolios = false;
        break;
      }
      
      const updatePromises = portfoliosRes.data.map(portfolio => 
        db.collection('portfolios').doc(portfolio._id).update({
          data: { _openid: newOpenid }
        })
      );
      
      await Promise.all(updatePromises);
      portfoliosUpdated += portfoliosRes.data.length;
      
      if (portfoliosRes.data.length < MAX_LIMIT) {
        hasMorePortfolios = false;
      }
    }
    updateResults.portfolios = portfoliosUpdated;
    
    // 10. 批量更新 blocks 表（作为屏蔽者和被屏蔽者）
    console.log('📝 [bindWechatOpenid] 更新 blocks 表');
    let blocksUpdated = 0;
    
    // 更新作为屏蔽者的记录
    let hasMoreBlocker = true;
    while (hasMoreBlocker) {
      const blockerRes = await db.collection('blocks')
        .where({ blockerId: oldOpenid })
        .limit(MAX_LIMIT)
        .get();
      
      if (blockerRes.data.length === 0) {
        hasMoreBlocker = false;
        break;
      }
      
      const updatePromises = blockerRes.data.map(block => 
        db.collection('blocks').doc(block._id).update({
          data: { blockerId: newOpenid }
        })
      );
      
      await Promise.all(updatePromises);
      blocksUpdated += blockerRes.data.length;
      
      if (blockerRes.data.length < MAX_LIMIT) {
        hasMoreBlocker = false;
      }
    }
    
    // 更新作为被屏蔽者的记录
    let hasMoreBlocked = true;
    while (hasMoreBlocked) {
      const blockedRes = await db.collection('blocks')
        .where({ blockedId: oldOpenid })
        .limit(MAX_LIMIT)
        .get();
      
      if (blockedRes.data.length === 0) {
        hasMoreBlocked = false;
        break;
      }
      
      const updatePromises = blockedRes.data.map(block => 
        db.collection('blocks').doc(block._id).update({
          data: { blockedId: newOpenid }
        })
      );
      
      await Promise.all(updatePromises);
      blocksUpdated += blockedRes.data.length;
      
      if (blockedRes.data.length < MAX_LIMIT) {
        hasMoreBlocked = false;
      }
    }
    updateResults.blocks = blocksUpdated;
    
    console.log('✅ [bindWechatOpenid] 绑定完成，更新统计:', updateResults);
    
    return {
      success: true,
      message: '绑定成功',
      updateResults: updateResults
    };
    
  } catch (error) {
    console.error('❌ [bindWechatOpenid] 绑定失败:', error);
    return {
      success: false,
      message: error.message || '绑定失败'
    };
  }
};
