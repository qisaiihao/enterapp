// 删除作品集的云函数
const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();

// 云函数入口函数
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID || event.openid;
  const { portfolioId } = event;

  console.log('🔍 [deletePortfolio] 开始执行，openid:', openid);
  console.log('🔍 [deletePortfolio] 作品集ID:', portfolioId);

  if (!openid) {
    console.log('❌ [deletePortfolio] 获取openid失败');
    return {
      success: false,
      message: '无法获取用户 openid，请重新登录',
      code: 'NO_OPENID'
    };
  }

  if (!portfolioId) {
    console.log('❌ [deletePortfolio] 作品集ID为空');
    return {
      success: false,
      message: '作品集ID不能为空',
      code: 'NO_PORTFOLIO_ID'
    };
  }

  try {
    // 检查作品集是否存在且属于当前用户
    const portfolioRes = await db.collection('portfolio_folders').where({
      _id: portfolioId,
      _openid: openid
    }).get();

    if (portfolioRes.data.length === 0) {
      console.log('❌ [deletePortfolio] 作品集不存在或不属于当前用户');
      return {
        success: false,
        message: '作品集不存在或无权限删除',
        code: 'PORTFOLIO_NOT_FOUND'
      };
    }

    const portfolio = portfolioRes.data[0];

    // 检查是否为默认作品集
    if (portfolio.isDefault) {
      console.log('❌ [deletePortfolio] 不能删除默认作品集');
      return {
        success: false,
        message: '默认作品集不能删除',
        code: 'CANNOT_DELETE_DEFAULT'
      };
    }

    // 删除作品集
    console.log('🔍 [deletePortfolio] 开始删除作品集');
    await db.collection('portfolio_folders').doc(portfolioId).remove();

    // 删除作品集中的所有作品关联
    console.log('🔍 [deletePortfolio] 开始删除作品集中的作品关联');
    const portfolioItemsRes = await db.collection('portfolio_items').where({
      folderId: portfolioId,
      _openid: openid
    }).get();

    if (portfolioItemsRes.data.length > 0) {
      const batch = db.batch();
      portfolioItemsRes.data.forEach(item => {
        batch.delete(db.collection('portfolio_items').doc(item._id));
      });
      await batch.commit();
      console.log(`✅ [deletePortfolio] 删除了 ${portfolioItemsRes.data.length} 个作品关联`);
    }

    console.log('✅ [deletePortfolio] 作品集删除成功');
    
    return {
      success: true,
      message: '作品集删除成功',
      deletedPortfolio: {
        _id: portfolioId,
        name: portfolio.name
      }
    };

  } catch (error) {
    console.error('❌ [deletePortfolio] 删除作品集失败:', error);
    return {
      success: false,
      message: '删除作品集失败',
      error: error.message
    };
  }
};
