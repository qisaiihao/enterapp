// 云函数入口文件
const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();
const _ = db.command;
const $ = _.aggregate;

// 云函数入口函数
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const wxCtxOpenid = wxContext.OPENID;
  const eventOpenid = event.openid;
  const openid = eventOpenid || wxCtxOpenid;
  const { keyword = '', limit = 20, filter = 'all', sort = 'relevance', page = 1 } = event;

  if (!openid) {
    return {
      success: false,
      message: '无法获取用户 openid，请重新登录',
      code: 'NO_OPENID'
    };
  }

  console.log('🔍 [searchPosts] openid来源:', {
    eventOpenid: eventOpenid ? '提供' : '未提供',
    wxCtxOpenid: wxCtxOpenid ? '提供' : '未提供',
    chosenOpenidSource: eventOpenid ? 'event.openid' : 'wxContext.OPENID',
    chosenOpenidExists: !!openid
  });

  try {
    // 获取被屏蔽的用户ID列表（使用缓存）
    let blockedUserIds = [];
    try {
      const getBlockedUserIds = require('../_lib/get-blocked-user-ids');
      blockedUserIds = await getBlockedUserIds(openid, db);
      console.log('🔍 [searchPosts] 被屏蔽的用户数量:', blockedUserIds.length);
    } catch (blockError) {
      console.error('❌ [searchPosts] 获取屏蔽列表失败:', blockError);
    }

    if (!keyword.trim()) {
      return {
        success: false,
        error: {
          message: '搜索关键词不能为空'
        }
      };
    }

    console.log('搜索关键词:', keyword, '长度:', keyword.length);

    // 先进行一个简单的测试查询，检查数据库中是否有相关数据
    if (keyword.length === 1) {
      console.log('执行测试查询...');
      try {
        const testQuery = await db.collection('posts').where({
          content: keyword
        }).limit(5).get();
        console.log('直接匹配测试结果:', testQuery.data.length, '条记录');
        
        const testQuery2 = await db.collection('posts').where({
          title: keyword
        }).limit(5).get();
        console.log('标题匹配测试结果:', testQuery2.data.length, '条记录');
        
        const testQuery3 = await db.collection('posts').where({
          tags: keyword
        }).limit(5).get();
        console.log('标签匹配测试结果:', testQuery3.data.length, '条记录');
        
        // 检查一些实际的帖子内容
        const sampleQuery = await db.collection('posts').limit(5).get();
        console.log('样本帖子内容:');
        sampleQuery.data.forEach((post, index) => {
          console.log(`帖子${index + 1}:`, {
            title: post.title,
            content: post.content ? post.content.substring(0, 100) : '',
            tags: post.tags
          });
        });
        
        // 特别检查是否包含"以"字的内容
        console.log('检查包含"以"字的内容:');
        let foundYi = false;
        sampleQuery.data.forEach((post, index) => {
          const hasYi = (post.title && post.title.includes('以')) || 
                       (post.content && post.content.includes('以')) ||
                       (post.tags && post.tags.some(tag => tag.includes('以')));
          if (hasYi) {
            foundYi = true;
            console.log(`帖子${index + 1}包含"以"字:`, {
              title: post.title,
              content: post.content ? post.content.substring(0, 100) : '',
              tags: post.tags
            });
          }
        });
        
        if (!foundYi) {
          console.log('在前5个帖子中没有找到包含"以"字的内容');
          // 扩大搜索范围
          const moreQuery = await db.collection('posts').limit(20).get();
          console.log('扩大搜索范围到20个帖子...');
          moreQuery.data.forEach((post, index) => {
            const hasYi = (post.title && post.title.includes('以')) || 
                         (post.content && post.content.includes('以')) ||
                         (post.tags && post.tags.some(tag => tag.includes('以')));
            if (hasYi) {
              console.log(`帖子${index + 1}包含"以"字:`, {
                title: post.title,
                content: post.content ? post.content.substring(0, 100) : '',
                tags: post.tags
              });
            }
          });
          
          // 如果还是没有找到，检查数据库总数
          const totalCount = await db.collection('posts').count();
          console.log('数据库总帖子数:', totalCount.total);
          
          // 尝试搜索特定的标题
          const specificQuery = await db.collection('posts').where({
            title: '玫 瑰'
          }).get();
          console.log('搜索标题"玫 瑰"的结果:', specificQuery.data.length);
          
          if (specificQuery.data.length > 0) {
            const rosePost = specificQuery.data[0];
            console.log('玫瑰帖子的内容片段:', rosePost.content ? rosePost.content.substring(0, 200) : '');
            console.log('玫瑰帖子是否包含"以"字:', rosePost.content ? rosePost.content.includes('以') : false);
          }
        }
      } catch (testError) {
        console.error('测试查询失败:', testError);
      }
    }

    // 优化的搜索算法，支持模糊搜索和分词搜索
    console.log('开始搜索，关键词:', keyword);
    
    let posts = [];
    
    console.log('搜索参数:', { keyword, filter, sort, page, limit });
    
    // 分词处理 - 将关键词按空格分割
    const keywords = keyword.trim().split(/\s+/).filter(k => k.length > 0);
    console.log('分词结果:', keywords);
    
    if (keywords.length === 0 && filter === 'all') {
      return {
        success: true,
        posts: [],
        total: 0,
        message: '搜索关键词不能为空'
      };
    }
    
    // 构建搜索条件
    const searchConditions = [];
    
    // 为每个关键词构建搜索条件
    keywords.forEach(keyword => {
      const escapedKeyword = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const searchRegex = new RegExp(escapedKeyword, 'i');
      
      // 标题匹配（权重最高）
      searchConditions.push({
        title: searchRegex
      });
      
      // 内容匹配
      searchConditions.push({
        content: searchRegex
      });
      
      // 标签匹配
      searchConditions.push({
        tags: searchRegex
      });
      
      // 作者名称匹配
      searchConditions.push({
        authorName: searchRegex
      });
      
      // 标签数组包含匹配
      searchConditions.push({
        tags: _.in([keyword])
      });
    });
    
    // 添加过滤条件
    let filterConditions = {
      isActivityPost: _.neq(true)
    };
    
    if (filter === 'recent') {
      // 最近7天
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      filterConditions.createTime = _.gte(sevenDaysAgo);
      console.log('应用最近过滤条件:', sevenDaysAgo);
    } else if (filter === 'popular') {
      // 热门帖子（点赞数大于5）
      filterConditions.votes = _.gt(5);
      console.log('应用热门过滤条件: votes > 5');
    } else if (filter === 'poetry') {
      // 诗歌类型
      filterConditions.tags = _.in(['诗歌', '诗', 'poetry']);
      console.log('应用诗歌过滤条件:', ['诗歌', '诗', 'poetry']);
    }
    
    // 构建最终查询条件
    let finalConditions = {};
    
    // 添加屏蔽用户过滤条件
    if (blockedUserIds.length > 0) {
      filterConditions._openid = _.nin(blockedUserIds);
    }
    
    console.log('搜索条件数量:', searchConditions.length);
    console.log('过滤条件:', filterConditions);
    
    if (searchConditions.length > 0 && Object.keys(filterConditions).length > 0) {
      // 有搜索关键词且有过滤条件：搜索条件 OR 过滤条件
      finalConditions = _.and([
        _.or(searchConditions),
        filterConditions
      ]);
      console.log('使用组合条件: 搜索 + 过滤');
    } else if (searchConditions.length > 0) {
      // 只有搜索关键词，需要添加屏蔽过滤
      if (blockedUserIds.length > 0) {
        finalConditions = _.and([
          _.or(searchConditions),
          { _openid: _.nin(blockedUserIds) }
        ]);
      } else {
        finalConditions = _.or(searchConditions);
      }
      console.log('使用搜索条件');
    } else if (Object.keys(filterConditions).length > 0) {
      // 只有过滤条件
      finalConditions = filterConditions;
      console.log('使用过滤条件');
    } else {
      // 都没有，返回空结果
      console.log('没有搜索和过滤条件，返回空结果');
      return {
        success: true,
        posts: [],
        total: 0
      };
    }
    
    console.log('最终查询条件:', finalConditions);
    
    // 执行搜索查询
    console.log('执行搜索查询，条件数量:', searchConditions.length);
    
    try {
      // 使用合并后的条件进行搜索
      const searchResult = await db.collection('posts')
        .where(finalConditions)
        .orderBy('createTime', 'desc')
        .skip((page - 1) * limit)
        .limit(limit)
        .get();
      
      posts = searchResult.data;
      console.log('搜索结果数量:', posts.length);
      
      // 过滤隐藏的帖子和被屏蔽用户的帖子（包括匿名帖子的realAuthorOpenid）
      posts = posts.filter(p => {
        if (!p || p.isHidden === true) return false;
        if (p.isActivityPost === true) return false;
        if (blockedUserIds.length > 0) {
          // 检查普通帖子的 _openid
          if (blockedUserIds.includes(p._openid)) return false;
          // 检查匿名帖子的 realAuthorOpenid
          if (p.realAuthorOpenid && blockedUserIds.includes(p.realAuthorOpenid)) return false;
        }
        return true;
      });
      
      // 计算相关性分数并排序
      posts = posts.map(post => {
        let score = 0;
        const title = (post.title || '').toLowerCase();
        const content = (post.content || '').toLowerCase();
        const tags = (post.tags || []).join(' ').toLowerCase();
        const authorName = (post.authorName || '').toLowerCase();
        
        keywords.forEach(keyword => {
          const lowerKeyword = keyword.toLowerCase();
          
          // 标题完全匹配（最高分）
          if (title === lowerKeyword) {
            score += 100;
          }
          // 标题包含关键词
          else if (title.includes(lowerKeyword)) {
            score += 50;
          }
          
          // 内容包含关键词
          if (content.includes(lowerKeyword)) {
            score += 20;
          }
          
          // 标签匹配
          if (tags.includes(lowerKeyword)) {
            score += 30;
          }
          
          // 作者名称匹配
          if (authorName.includes(lowerKeyword)) {
            score += 10;
          }
        });
        
        return {
          ...post,
          relevanceScore: score
        };
      });
      
      // 按相关性分数和时间排序
      posts.sort((a, b) => {
        if (b.relevanceScore !== a.relevanceScore) {
          return b.relevanceScore - a.relevanceScore;
        }
        return new Date(b.createTime) - new Date(a.createTime);
      });
      
      // 限制结果数量
      posts = posts.slice(0, limit);
      
    } catch (searchError) {
      console.error('搜索查询失败:', searchError);
      
      // 降级到简单搜索
      console.log('降级到简单搜索模式');
      
      if (searchConditions.length > 0) {
        const escapedKeyword = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const searchRegex = new RegExp(escapedKeyword, 'i');
        
        const queries = [
          db.collection('posts').where({ title: searchRegex }).get(),
          db.collection('posts').where({ content: searchRegex }).get(),
          db.collection('posts').where({ tags: searchRegex }).get()
        ];
        
        const results = await Promise.all(queries);
        
        // 合并结果并去重
        const allPosts = [...results[0].data, ...results[1].data, ...results[2].data];
        const uniquePosts = allPosts.filter((post, index, self) => 
          index === self.findIndex(p => p._id === post._id)
        );
        
        posts = uniquePosts.filter(p => {
          if (!p || p.isHidden === true) return false;
          // 过滤被屏蔽用户的帖子（包括匿名帖子的realAuthorOpenid）
          if (blockedUserIds.length > 0) {
            if (blockedUserIds.includes(p._openid)) return false;
            // 检查匿名帖子的realAuthorOpenid
            if (p.realAuthorOpenid && blockedUserIds.includes(p.realAuthorOpenid)) return false;
          }
          return true;
        });
        
        // 应用过滤条件
        if (Object.keys(filterConditions).length > 0) {
          posts = posts.filter(post => {
            if (filter === 'recent') {
              const sevenDaysAgo = new Date();
              sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
              return new Date(post.createTime) >= sevenDaysAgo;
            } else if (filter === 'popular') {
              return (post.votes || 0) > 5;
            } else if (filter === 'poetry') {
              return post.tags && post.tags.some(tag => 
                ['诗歌', '诗', 'poetry'].includes(tag)
              );
            }
            return true;
          });
        }
        
        // 按时间排序
        posts.sort((a, b) => new Date(b.createTime) - new Date(a.createTime));
        posts = posts.slice(0, limit);
      } else if (Object.keys(filterConditions).length > 0) {
        // 只有过滤条件，没有搜索关键词
        console.log('执行纯过滤查询');
        const filterResult = await db.collection('posts')
          .where(filterConditions)
          .orderBy('createTime', 'desc')
          .skip((page - 1) * limit)
          .limit(limit)
          .get();
        
        posts = filterResult.data.filter(p => {
          if (!p || p.isHidden === true) return false;
          // 过滤被屏蔽用户的帖子（包括匿名帖子的realAuthorOpenid）
          if (blockedUserIds.length > 0) {
            if (blockedUserIds.includes(p._openid)) return false;
            // 检查匿名帖子的realAuthorOpenid
            if (p.realAuthorOpenid && blockedUserIds.includes(p.realAuthorOpenid)) return false;
          }
          return true;
        });
      } else {
        posts = [];
      }
    }
    
    console.log('最终结果数量:', posts.length);
    console.log('搜索结果详情:', posts.map(p => ({ 
      id: p._id, 
      title: p.title, 
      content: p.content ? p.content.substring(0, 50) + '...' : '',
      tags: p.tags 
    })));

    // 批量计算点赞与评论信息，使用帖子中缓存的作者快照
    const postIds = posts.map(post => post._id);
    let voterMap = new Set();
    if (postIds.length > 0) {
      try {
        const voteRes = await db.collection('votes_log')
          .where({
            _openid: openid,
            type: 'post',
            postId: _.in(postIds)
          })
          .field({ postId: true })
          .get();
        voterMap = new Set(voteRes.data.map(item => item.postId));
      } catch (voteError) {
        console.error('批量查询点赞记录失败:', voteError);
      }
    }

    const missingCommentIds = posts
      .filter(post => post.commentCount === undefined || post.commentCount === null)
      .map(post => post._id);
    const commentCountMap = new Map();
    if (missingCommentIds.length > 0) {
      try {
        const commentAgg = await db.collection('comments').aggregate()
          .match({ postId: _.in(missingCommentIds) })
          .group({ _id: '$postId', count: $.sum(1) })
          .end();
        commentAgg.list.forEach(item => commentCountMap.set(item._id, item.count));
      } catch (commentError) {
        console.error('批量统计评论数失败:', commentError);
      }
    }

    const enrichedPosts = posts.map((post) => {
      const authorName = post.authorName || post.authorNameSnapshot || '匿名用户';
      const authorAvatar = post.authorAvatar || post.authorAvatarSnapshot || '';
      const commentCount = post.commentCount !== undefined && post.commentCount !== null
        ? post.commentCount
        : (commentCountMap.get(post._id) || 0);
      const isVoted = voterMap.has(post._id);

      return {
        ...post,
        authorName,
        authorAvatar,
        commentCount,
        isVoted,
        tags: Array.isArray(post.tags) ? post.tags : []
      };
    });

    // 处理图片URL转换
    const fileIDs = new Set();
    
    enrichedPosts.forEach(post => {
      // 保证 imageUrls、originalImageUrls 一定为数组
      if (!Array.isArray(post.imageUrls)) post.imageUrls = post.imageUrls ? [post.imageUrls] : [];
      if (!Array.isArray(post.originalImageUrls)) post.originalImageUrls = post.originalImageUrls ? [post.originalImageUrls] : [];
      
      // 收集所有需要转换的fileID
      const urlsToCheck = [
        ...post.imageUrls,
        ...post.originalImageUrls,
        post.imageUrl,
        post.originalImageUrl,
        post.authorAvatar,
        post.poemBgImage
      ].filter(url => url && typeof url === 'string' && url.startsWith('cloud://'));
      
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

        // 批量转换所有帖子的图片URL
        enrichedPosts.forEach(post => {
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
      posts: enrichedPosts,
      total: enrichedPosts.length
    };

  } catch (e) {
    console.error('搜索失败:', e);
    return {
      success: false,
      error: {
        message: e.message,
        stack: e.stack
      }
    };
  }
};

