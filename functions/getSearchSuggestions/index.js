// 云函数入口文件
const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();
const _ = db.command;

// 云函数入口函数
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const wxCtxOpenid = wxContext.OPENID;
  const eventOpenid = event.openid;
  const openid = eventOpenid || wxCtxOpenid;
  const { keyword = '', limit = 10 } = event;

  if (!openid) {
    return {
      success: false,
      message: '无法获取用户 openid，请重新登录',
      code: 'NO_OPENID'
    };
  }

  try {
    if (!keyword.trim()) {
      // 返回热门搜索词
      return {
        success: true,
        suggestions: [
          '诗歌', '原创', '生活', '感悟', '旅行', 
          '美食', '摄影', '读书', '音乐', '艺术'
        ],
        type: 'hot'
      };
    }

    console.log('获取搜索建议，关键词:', keyword);

    const suggestions = new Set();
    const escapedKeyword = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const searchRegex = new RegExp(escapedKeyword, 'i');

    // 从标题中获取建议
    try {
      const titleResult = await db.collection('posts')
        .where({
          title: searchRegex,
          isActivityPost: _.neq(true)
        })
        .field({
          title: true
        })
        .limit(20)
        .get();

      titleResult.data.forEach(post => {
        if (post.title) {
          // 提取包含关键词的短语
          const words = post.title.split(/\s+/);
          words.forEach(word => {
            if (word.toLowerCase().includes(keyword.toLowerCase()) && word.length > keyword.length) {
              suggestions.add(word);
            }
          });
        }
      });
    } catch (error) {
      console.error('获取标题建议失败:', error);
    }

    // 从标签中获取建议
    try {
      const tagsResult = await db.collection('posts')
        .where({
          tags: searchRegex,
          isActivityPost: _.neq(true)
        })
        .field({
          tags: true
        })
        .limit(20)
        .get();

      tagsResult.data.forEach(post => {
        if (post.tags && Array.isArray(post.tags)) {
          post.tags.forEach(tag => {
            if (tag.toLowerCase().includes(keyword.toLowerCase())) {
              suggestions.add(tag);
            }
          });
        }
      });
    } catch (error) {
      console.error('获取标签建议失败:', error);
    }

    // 从作者名称中获取建议
    try {
      const authorResult = await db.collection('posts')
        .where({
          authorName: searchRegex,
          isActivityPost: _.neq(true)
        })
        .field({
          authorName: true
        })
        .limit(20)
        .get();

      authorResult.data.forEach(post => {
        if (post.authorName && post.authorName.toLowerCase().includes(keyword.toLowerCase())) {
          suggestions.add(post.authorName);
        }
      });
    } catch (error) {
      console.error('获取作者建议失败:', error);
    }

    // 转换为数组并排序
    let suggestionArray = Array.from(suggestions)
      .filter(s => s.length > keyword.length)
      .sort((a, b) => {
        // 优先显示以关键词开头的建议
        const aStartsWith = a.toLowerCase().startsWith(keyword.toLowerCase());
        const bStartsWith = b.toLowerCase().startsWith(keyword.toLowerCase());
        
        if (aStartsWith && !bStartsWith) return -1;
        if (!aStartsWith && bStartsWith) return 1;
        
        // 然后按长度排序
        return a.length - b.length;
      })
      .slice(0, limit);

    // 如果建议不够，添加一些通用建议
    if (suggestionArray.length < limit) {
      const commonSuggestions = [
        '诗歌', '原创', '生活', '感悟', '旅行', 
        '美食', '摄影', '读书', '音乐', '艺术',
        '心情', '回忆', '梦想', '成长', '思考'
      ];
      
      commonSuggestions.forEach(suggestion => {
        if (suggestion.toLowerCase().includes(keyword.toLowerCase()) && 
            !suggestionArray.includes(suggestion)) {
          suggestionArray.push(suggestion);
        }
      });
      
      suggestionArray = suggestionArray.slice(0, limit);
    }

    return {
      success: true,
      suggestions: suggestionArray,
      type: 'suggestions'
    };

  } catch (e) {
    console.error('获取搜索建议失败:', e);
    return {
      success: false,
      error: {
        message: e.message,
        stack: e.stack
      }
    };
  }
};
