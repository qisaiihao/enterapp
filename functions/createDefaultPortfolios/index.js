// 云函数入口文件
const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();

// 云函数入口函数
exports.main = async (event, context) => {
  console.log('【createDefaultPortfolios】开始为所有用户创建默认作品集');

  try {
    // 获取所有用户
    const usersResult = await db.collection('users')
      .field({
        _openid: true,
        nickName: true
      })
      .get();

    const users = usersResult.data || [];
    console.log('【createDefaultPortfolios】找到用户数量:', users.length);

    let successCount = 0;
    let skipCount = 0;
    let errorCount = 0;
    const errors = [];

    for (let i = 0; i < users.length; i++) {
      const user = users[i];
      const userId = user._openid;

      try {
        console.log(`【createDefaultPortfolios】处理用户 ${i + 1}/${users.length}:`, userId);

        // 检查用户是否已有作品集
        const existingPortfolios = await db.collection('portfolio_folders')
          .where({
            _openid: userId
          })
          .get();

        if (existingPortfolios.data && existingPortfolios.data.length > 0) {
          console.log(`【createDefaultPortfolios】用户 ${userId} 已有作品集，跳过`);
          skipCount++;
          continue;
        }

        // 创建默认作品集
        const defaultPortfolio = {
          _openid: userId,
          name: '我的第一个作品集',
          description: '默认创建的作品集',
          coverImage: '',
          isPublic: true,
          isDeleted: false,
          itemCount: 0,
          createTime: new Date(),
          updateTime: new Date()
        };

        const result = await db.collection('portfolio_folders').add({
          data: defaultPortfolio
        });

        console.log(`【createDefaultPortfolios】为用户 ${userId} 创建默认作品集成功，ID:`, result._id);
        successCount++;

      } catch (error) {
        console.error(`【createDefaultPortfolios】处理用户 ${userId} 时出错:`, error);
        errorCount++;
        errors.push({
          userId,
          error: error.message
        });
      }
    }

    console.log('【createDefaultPortfolios】执行完成统计:');
    console.log('- 总用户数:', users.length);
    console.log('- 成功创建:', successCount);
    console.log('- 跳过已有:', skipCount);
    console.log('- 失败数量:', errorCount);

    if (errors.length > 0) {
      console.log('【createDefaultPortfolios】错误详情:', errors);
    }

    return {
      success: true,
      message: '批量创建默认作品集完成',
      statistics: {
        totalUsers: users.length,
        successCount,
        skipCount,
        errorCount
      },
      errors: errors
    };

  } catch (error) {
    console.error('【createDefaultPortfolios】执行失败:', error);
    return {
      success: false,
      message: '批量创建默认作品集失败',
      error: error.message
    };
  }
};