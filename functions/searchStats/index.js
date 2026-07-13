// 云函数入口文件
const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();
const _ = db.command;
const SEARCH_LOGS_COLLECTION = 'search_logs';
const SEARCH_STATS_COLLECTION = 'search_stats';
const ensuredCollections = new Set();

function getErrorText(error) {
  return String((error && (error.errMsg || error.message || error.code || error.errCode)) || '');
}

function isMissingCollectionError(error) {
  const text = getErrorText(error);
  return (
    (error && error.errCode === -502005) ||
    text.includes('DATABASE_COLLECTION_NOT_EXIST') ||
    text.includes('collection not exists') ||
    text.includes('Db or Table not exist') ||
    text.includes('ResourceNotFound')
  );
}

function isCollectionExistsError(error) {
  const text = getErrorText(error);
  return (
    (error && error.errCode === -501001) ||
    text.includes('already exists') ||
    text.includes('collection exists') ||
    text.includes('duplicate')
  );
}

async function ensureCollection(name) {
  if (ensuredCollections.has(name)) {
    return;
  }

  try {
    await db.collection(name).limit(1).get();
    ensuredCollections.add(name);
    return;
  } catch (error) {
    if (!isMissingCollectionError(error)) {
      throw error;
    }
  }

  try {
    await db.createCollection(name);
    console.log('[searchStats] created collection:', name);
  } catch (error) {
    if (!isCollectionExistsError(error)) {
      throw error;
    }
  }
  ensuredCollections.add(name);
}

async function ensureSearchCollections() {
  await ensureCollection(SEARCH_LOGS_COLLECTION);
  await ensureCollection(SEARCH_STATS_COLLECTION);
}

// 云函数入口函数
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const wxCtxOpenid = wxContext.OPENID;
  const eventOpenid = event.openid;
  const openid = eventOpenid || wxCtxOpenid;
  const { keyword = '', action = 'record' } = event;
  const requiresOpenid = action === 'record';

  if (requiresOpenid && !openid) {
    return {
      success: false,
      message: '无法获取用户 openid，请重新登录',
      code: 'NO_OPENID'
    };
  }

  try {
    if (action === 'record') {
      await ensureSearchCollections();

      // 记录搜索
      if (!keyword.trim()) {
        return {
          success: false,
          error: { message: '搜索关键词不能为空' }
        };
      }

      console.log('记录搜索:', keyword, '用户:', openid);

      // 记录搜索历史
      await db.collection(SEARCH_LOGS_COLLECTION).add({
        data: {
          keyword: keyword.trim(),
          openid: openid,
          timestamp: new Date(),
          createTime: new Date()
        }
      });

      // 更新搜索统计
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const searchStatsResult = await db.collection(SEARCH_STATS_COLLECTION)
        .where({
          keyword: keyword.trim(),
          date: today
        })
        .get();

      if (searchStatsResult.data.length > 0) {
        // 更新现有统计
        await db.collection(SEARCH_STATS_COLLECTION)
          .doc(searchStatsResult.data[0]._id)
          .update({
            data: {
              count: _.inc(1),
              lastSearchTime: new Date()
            }
          });
      } else {
        // 创建新统计
        await db.collection(SEARCH_STATS_COLLECTION).add({
          data: {
            keyword: keyword.trim(),
            count: 1,
            date: today,
            firstSearchTime: new Date(),
            lastSearchTime: new Date(),
            createTime: new Date()
          }
        });
      }

      return {
        success: true,
        message: '搜索记录成功'
      };

    } else if (action === 'getHotSearches') {
      await ensureCollection(SEARCH_STATS_COLLECTION);

      // 获取热门搜索词
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const hotSearchesResult = await db.collection(SEARCH_STATS_COLLECTION)
        .where({
          date: _.gte(today)
        })
        .orderBy('count', 'desc')
        .limit(event.limit || 20)
        .get();

      const hotSearches = hotSearchesResult.data.map(item => ({
        keyword: item.keyword,
        count: item.count
      }));

      return {
        success: true,
        hotSearches: hotSearches
      };

    } else if (action === 'getSearchTrends') {
      await ensureCollection(SEARCH_STATS_COLLECTION);

      // 获取搜索趋势
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      sevenDaysAgo.setHours(0, 0, 0, 0);

      const trendsResult = await db.collection(SEARCH_STATS_COLLECTION)
        .where({
          date: _.gte(sevenDaysAgo)
        })
        .orderBy('date', 'desc')
        .get();

      // 按日期分组统计
      const trendsByDate = {};
      trendsResult.data.forEach(item => {
        const dateStr = item.date.toISOString().split('T')[0];
        if (!trendsByDate[dateStr]) {
          trendsByDate[dateStr] = {
            date: dateStr,
            totalSearches: 0,
            uniqueKeywords: new Set()
          };
        }
        trendsByDate[dateStr].totalSearches += item.count;
        trendsByDate[dateStr].uniqueKeywords.add(item.keyword);
      });

      const trends = Object.values(trendsByDate).map(item => ({
        date: item.date,
        totalSearches: item.totalSearches,
        uniqueKeywords: item.uniqueKeywords.size
      }));

      return {
        success: true,
        trends: trends
      };

    } else if (action === 'ensureCollections') {
      await ensureSearchCollections();
      return {
        success: true,
        collections: [SEARCH_LOGS_COLLECTION, SEARCH_STATS_COLLECTION]
      };

    } else {
      return {
        success: false,
        error: { message: '未知的操作类型' }
      };
    }

  } catch (e) {
    console.error('搜索统计失败:', e);
    return {
      success: false,
      error: {
        message: e.message,
        stack: e.stack
      }
    };
  }
};
