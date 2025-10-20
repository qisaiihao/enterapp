// 更新作品集的云函数
const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();

// 云函数入口函数
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID || event.openid;
  const { portfolioId, name, description } = event;

  console.log('🔍 [updatePortfolio] 开始执行，openid:', openid);
  console.log('🔍 [updatePortfolio] 作品集ID:', portfolioId);
  console.log('🔍 [updatePortfolio] 新名称:', name);

  if (!openid) {
    console.log('❌ [updatePortfolio] 获取openid失败');
    return {
      success: false,
      message: '无法获取用户 openid，请重新登录',
      code: 'NO_OPENID'
    };
  }

  if (!portfolioId) {
    console.log('❌ [updatePortfolio] 作品集ID为空');
    return {
      success: false,
      message: '作品集ID不能为空',
      code: 'NO_PORTFOLIO_ID'
    };
  }

  if (!name || name.trim() === '') {
    console.log('❌ [updatePortfolio] 作品集名称为空');
    return {
      success: false,
      message: '作品集名称不能为空',
      code: 'NO_NAME'
    };
  }

  try {
    // 检查作品集是否存在且属于当前用户
    const portfolioRes = await db.collection('portfolio_folders').where({
      _id: portfolioId,
      _openid: openid
    }).get();

    if (portfolioRes.data.length === 0) {
      console.log('❌ [updatePortfolio] 作品集不存在或不属于当前用户');
      return {
        success: false,
        message: '作品集不存在或无权限修改',
        code: 'PORTFOLIO_NOT_FOUND'
      };
    }

    // 检查新名称是否与其他作品集重名
    const existingRes = await db.collection('portfolio_folders').where({
      _openid: openid,
      name: name.trim(),
      _id: db.command.neq(portfolioId) // 排除当前作品集
    }).get();

    if (existingRes.data.length > 0) {
      console.log('❌ [updatePortfolio] 已存在同名作品集');
      return {
        success: false,
        message: '已存在同名作品集',
        code: 'DUPLICATE_NAME'
      };
    }

    // 更新作品集
    console.log('🔍 [updatePortfolio] 开始更新作品集');
    const updateData = {
      name: name.trim(),
      updateTime: new Date()
    };

    // 如果提供了描述，也更新描述
    if (description !== undefined) {
      updateData.description = description.trim();
    }

    await db.collection('portfolio_folders').doc(portfolioId).update({
      data: updateData
    });

    console.log('✅ [updatePortfolio] 作品集更新成功');
    
    return {
      success: true,
      message: '作品集更新成功',
      portfolio: {
        _id: portfolioId,
        name: name.trim(),
        description: description ? description.trim() : portfolioRes.data[0].description,
        updateTime: new Date()
      }
    };

  } catch (error) {
    console.error('❌ [updatePortfolio] 更新作品集失败:', error);
    return {
      success: false,
      message: '更新作品集失败',
      error: error.message
    };
  }
};
