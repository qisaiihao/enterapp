// 确保用户有默认作品集的云函数（支持批量回填）
const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();

// 云函数入口函数
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID || event.openid;
  const { mode = 'single', batchSize = 100 } = event; // 新增批量处理参数

  console.log('🔍 [ensureDefaultPortfolio] 开始执行，模式:', mode, 'openid:', openid);

  // 批量回填模式
  if (mode === 'batch') {
    return await batchEnsureDefaultPortfolio(batchSize);
  }

  // 单个用户模式（原有逻辑）
  if (!openid) {
    console.log('❌ [ensureDefaultPortfolio] 获取openid失败');
    return {
      success: false,
      message: '无法获取用户 openid，请重新登录',
      code: 'NO_OPENID'
    };
  }

  try {
    // 检查用户是否已有作品集
    const existingPortfolios = await db.collection('portfolio_folders').where({
      _openid: openid
    }).get();

    console.log('🔍 [ensureDefaultPortfolio] 用户现有作品集数量:', existingPortfolios.data.length);

    if (existingPortfolios.data.length === 0) {
      // 用户没有作品集，创建默认作品集
      console.log('🔍 [ensureDefaultPortfolio] 用户没有作品集，创建默认作品集');
      
      const result = await db.collection('portfolio_folders').add({
        data: {
          _openid: openid,
          name: '我的作品集',
          description: '这是我的默认作品集',
          itemCount: 0,
          items: [],
          createTime: new Date(),
          updateTime: new Date(),
          isPublic: false,
          coverImage: '',
          tags: [],
          isDefault: true // 标记为默认作品集
        }
      });

      console.log('✅ [ensureDefaultPortfolio] 默认作品集创建成功，ID:', result._id);
      
      return {
        success: true,
        message: '已为您创建默认作品集',
        portfolio: {
          _id: result._id,
          _openid: openid,
          name: '我的作品集',
          description: '这是我的默认作品集',
          itemCount: 0,
          items: [],
          createTime: new Date(),
          updateTime: new Date(),
          isPublic: false,
          coverImage: '',
          tags: [],
          isDefault: true
        }
      };
    } else {
      // 用户已有作品集
      console.log('✅ [ensureDefaultPortfolio] 用户已有作品集，无需创建');
      
      return {
        success: true,
        message: '用户已有作品集',
        hasPortfolios: true,
        portfolioCount: existingPortfolios.data.length
      };
    }

  } catch (error) {
    console.error('❌ [ensureDefaultPortfolio] 执行失败:', error);
    return {
      success: false,
      message: '检查作品集失败',
      error: error.message
    };
  }
};

// 批量确保所有用户都有默认作品集
async function batchEnsureDefaultPortfolio(batchSize) {
  console.log('🔍 [batchEnsureDefaultPortfolio] 开始批量回填，批次大小:', batchSize);
  
  try {
    // 获取所有用户
    const usersResult = await db.collection('users').limit(batchSize).get();
    const users = usersResult.data;
    
    console.log('🔍 [batchEnsureDefaultPortfolio] 获取到用户数量:', users.length);
    
    if (users.length === 0) {
      return {
        success: true,
        message: '没有找到需要处理的用户',
        processed: 0,
        created: 0,
        alreadyHas: 0,
        errors: 0
      };
    }
    
    let processed = 0;
    let created = 0;
    let alreadyHas = 0;
    let errors = 0;
    const errorDetails = [];
    
    // 批量处理用户
    for (const user of users) {
      try {
        processed++;
        console.log(`🔍 [batchEnsureDefaultPortfolio] 处理用户 ${processed}/${users.length}:`, user._openid);
        
        // 检查用户是否已有作品集
        const existingPortfolios = await db.collection('portfolio_folders').where({
          _openid: user._openid
        }).get();
        
        if (existingPortfolios.data.length === 0) {
          // 创建默认作品集
          await db.collection('portfolio_folders').add({
            data: {
              _openid: user._openid,
              name: '我的作品集',
              description: '这是我的默认作品集',
              itemCount: 0,
              items: [],
              createTime: new Date(),
              updateTime: new Date(),
              isPublic: false,
              coverImage: '',
              tags: [],
              isDefault: true
            }
          });
          created++;
          console.log(`✅ [batchEnsureDefaultPortfolio] 为用户 ${user._openid} 创建默认作品集`);
        } else {
          alreadyHas++;
          console.log(`ℹ️ [batchEnsureDefaultPortfolio] 用户 ${user._openid} 已有作品集`);
        }
      } catch (userError) {
        errors++;
        errorDetails.push({
          openid: user._openid,
          error: userError.message
        });
        console.error(`❌ [batchEnsureDefaultPortfolio] 处理用户 ${user._openid} 失败:`, userError);
      }
    }
    
    const result = {
      success: true,
      message: `批量回填完成`,
      processed,
      created,
      alreadyHas,
      errors,
      errorDetails: errors > 0 ? errorDetails : undefined
    };
    
    console.log('✅ [batchEnsureDefaultPortfolio] 批量回填完成:', result);
    return result;
    
  } catch (error) {
    console.error('❌ [batchEnsureDefaultPortfolio] 批量回填失败:', error);
    return {
      success: false,
      message: '批量回填失败',
      error: error.message
    };
  }
}
