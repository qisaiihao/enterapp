// 云函数入口文件
const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();
const _ = db.command;

const HOT_SUGGESTIONS = [
  '诗歌',
  '原创',
  '生活',
  '感悟',
  '旅行',
  '美食',
  '摄影',
  '读书',
  '音乐',
  '艺术'
];

const COMMON_SUGGESTIONS = [
  '诗歌',
  '原创',
  '生活',
  '感悟',
  '旅行',
  '美食',
  '摄影',
  '读书',
  '音乐',
  '艺术',
  '心情',
  '回忆',
  '梦想',
  '成长',
  '思考'
];

function normalizeKeyword(keyword) {
  return typeof keyword === 'string' ? keyword.trim() : '';
}

function collectTitleSuggestions(suggestions, title, keyword) {
  if (!title) {
    return;
  }

  const normalizedKeyword = keyword.toLowerCase();
  title.split(/\s+/).forEach((word) => {
    if (word.toLowerCase().includes(normalizedKeyword) && word.length > keyword.length) {
      suggestions.add(word);
    }
  });
}

// 云函数入口函数
exports.main = async (event) => {
  const keyword = normalizeKeyword(event.keyword);
  const limit = Math.max(1, parseInt(event.limit, 10) || 10);

  try {
    if (!keyword) {
      return {
        success: true,
        suggestions: HOT_SUGGESTIONS.slice(0, limit),
        type: 'hot'
      };
    }

    console.log('获取搜索建议，关键词:', keyword);

    const suggestions = new Set();
    const escapedKeyword = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const searchRegex = new RegExp(escapedKeyword, 'i');

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

      titleResult.data.forEach((post) => {
        collectTitleSuggestions(suggestions, post.title, keyword);
      });
    } catch (error) {
      console.error('获取标题建议失败:', error);
    }

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

      tagsResult.data.forEach((post) => {
        if (post.tags && Array.isArray(post.tags)) {
          post.tags.forEach((tag) => {
            if (typeof tag === 'string' && tag.toLowerCase().includes(keyword.toLowerCase())) {
              suggestions.add(tag);
            }
          });
        }
      });
    } catch (error) {
      console.error('获取标签建议失败:', error);
    }

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

      authorResult.data.forEach((post) => {
        if (post.authorName && post.authorName.toLowerCase().includes(keyword.toLowerCase())) {
          suggestions.add(post.authorName);
        }
      });
    } catch (error) {
      console.error('获取作者建议失败:', error);
    }

    let suggestionArray = Array.from(suggestions)
      .filter((item) => item.length > keyword.length)
      .sort((left, right) => {
        const leftStartsWith = left.toLowerCase().startsWith(keyword.toLowerCase());
        const rightStartsWith = right.toLowerCase().startsWith(keyword.toLowerCase());

        if (leftStartsWith && !rightStartsWith) return -1;
        if (!leftStartsWith && rightStartsWith) return 1;

        return left.length - right.length;
      })
      .slice(0, limit);

    if (suggestionArray.length < limit) {
      COMMON_SUGGESTIONS.forEach((suggestion) => {
        if (
          suggestion.toLowerCase().includes(keyword.toLowerCase()) &&
          !suggestionArray.includes(suggestion)
        ) {
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
  } catch (error) {
    console.error('获取搜索建议失败:', error);
    return {
      success: false,
      error: {
        message: error.message,
        stack: error.stack
      }
    };
  }
};
