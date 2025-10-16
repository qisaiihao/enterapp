// 创建作品集的云函数
const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();

// 云函数入口函数
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID || event.openid;
  const { name, description } = event;

  console.log('【createPortfolio】开始执行，openid:', openid);
  console.log('【createPortfolio】作品集名称:', name);

  if (!openid) {
    console.log('【createPortfolio】获取openid失败');
    return {
      success: false,
      message: '无法获取用户 openid，请重新登录',
      code: 'NO_OPENID'
    };
  }

  if (!name || name.trim() === '') {
    console.log('【createPortfolio】作品集名称为空');
    return {
      success: false,
      message: '作品集名称不能为空',
      code: 'NO_NAME'
    };
  }

  try {
    // 检查用户是否已有同名作品集
    const existingResult = await db.collection('portfolios').where({
      _openid: openid,
      name: name.trim()
    }).get();

    if (existingResult.data.length > 0) {
      console.log('【createPortfolio】已存在同名作品集');
      return {
        success: false,
        message: '已存在同名作品集',
        code: 'DUPLICATE_NAME'
      };
    }

    // 创建新作品集
    console.log('【createPortfolio】创建新作品集');
    const result = await db.collection('portfolios').add({
      data: {
        _openid: openid,
        name: name.trim(),
        description: description ? description.trim() : '',
        itemCount: 0,
        items: [],
        createTime: new Date(),
        updateTime: new Date(),
        isPublic: false,
        coverImage: '',
        tags: []
      }
    });

    console.log('【createPortfolio】创建作品集成功，ID:', result._id);
    return {
      success: true,
      portfolio: {
        _id: result._id,
        _openid: openid,
        name: name.trim(),
        description: description ? description.trim() : '',
        itemCount: 0,
        items: [],
        createTime: new Date(),
        updateTime: new Date(),
        isPublic: false,
        coverImage: '',
        tags: []
      },
      message: '作品集创建成功'
    };

  } catch (error) {
    console.error('【createPortfolio】创建作品集失败:', error);
    return {
      success: false,
      message: '创建作品集失败',
      error: error.message
    };
  }
};