// 获取用户作品集列表的云函数
const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();
const _ = db.command;

// 云函数入口函数
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID || event.openid;
  const { skip = 0, limit = 20, includeItemCount = true } = event;

  console.log('【getPortfolios】开始执行，openid:', openid);
  console.log('【getPortfolios】查询参数:', { skip, limit, includeItemCount });

  if (!openid) {
    console.log('【getPortfolios】获取openid失败');
    return {
      success: false,
      message: '无法获取用户 openid，请重新登录',
      code: 'NO_OPENID'
    };
  }

  try {
    console.log('【getPortfolios】查询portfolios集合...');

    // 构建查询条件
    const query = db.collection('portfolios').where({
      _openid: openid
    });

    // 执行查询
    const result = await query
      .orderBy('createTime', 'desc')
      .skip(skip)
      .limit(limit)
      .get();

    console.log('【getPortfolios】查询结果，数量:', result.data.length);

    let portfolios = result.data;

    // 如果需要包含作品数量统计
    if (includeItemCount) {
      console.log('【getPortfolios】统计每个作品集的项目数量...');
      portfolios = await Promise.all(portfolios.map(async (portfolio) => {
        try {
          // 统计该作品集中的项目数量
          const itemsCount = await db.collection('portfolio_items')
            .where({
              portfolioId: portfolio._id
            })
            .count();

          return {
            ...portfolio,
            itemCount: itemsCount.total || 0
          };
        } catch (countError) {
          console.error('【getPortfolios】统计作品数量失败:', portfolio._id, countError);
          return {
            ...portfolio,
            itemCount: 0
          };
        }
      }));
    }

    // 查询总数
    const totalCount = await db.collection('portfolios')
      .where({
        _openid: openid
      })
      .count();

    console.log('【getPortfolios】返回作品集列表，数量:', portfolios.length, '总数:', totalCount.total);

    return {
      success: true,
      portfolios: portfolios,
      total: totalCount.total,
      hasMore: (skip + portfolios.length) < totalCount.total,
      skip: skip,
      limit: limit
    };

  } catch (error) {
    console.error('【getPortfolios】数据库查询失败:', error);
    return {
      success: false,
      message: '获取作品集列表失败',
      error: error.message,
      portfolios: []
    };
  }
};