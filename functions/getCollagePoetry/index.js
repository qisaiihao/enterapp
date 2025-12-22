const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()

exports.main = async (event, context) => {
  console.log('=== getCollagePoetry 云函数开始执行 ===')
  console.log('event:', JSON.stringify(event, null, 2))
  console.log('context:', JSON.stringify(context, null, 2))
  
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID || event.openid;
  const { page = 0, pageSize = 10, mode } = event

  // ========== mode: words（返回拼贴词库）==========
  if (mode === 'words') {
    try {
      const {
        limit = 10,
        groups = ['nouns', 'verbs', 'imagery'],
        seed = Date.now()
      } = event;

      const limitPerGroup = Math.max(3, Math.min(20, Number(limit) || 10));
      const rng = mulberry32(seed);

      const pickWords = (arr) => shuffleWithRng(arr, rng).slice(0, limitPerGroup);

      const wordBank = getDefaultWordBank();
      const payload = {};
      groups.forEach((g) => {
        const key = g.toLowerCase();
        if (wordBank[key]) {
          payload[key] = pickWords(wordBank[key]);
        }
      });

      return {
        success: true,
        mode: 'words',
        seedUsed: seed,
        limit: limitPerGroup,
        data: payload
      };
    } catch (err) {
      console.error('获取拼贴词库失败:', err);
      return {
        success: false,
        mode: 'words',
        message: err.message || '获取拼贴词库失败'
      };
    }
  }

  try {
    // 获取被屏蔽的用户ID列表（使用缓存）
    let blockedUserIds = [];
    if (openid) {
      try {
        const getBlockedUserIds = require('../_lib/get-blocked-user-ids');
        blockedUserIds = await getBlockedUserIds(openid, db);
      } catch (blockError) {
        console.error('获取屏蔽列表失败:', blockError);
      }
    }

    // 构建查询条件
    const queryConditions = {
      isFoundPoetry: true
    };
    
    // 过滤被屏蔽用户的帖子
    if (blockedUserIds.length > 0) {
      queryConditions._openid = db.command.nin(blockedUserIds);
    }

    // 查询拼贴诗数据（isFoundPoetry为true的帖子）
    console.log('开始查询拼贴诗数据...')
    const result = await db.collection('posts')
      .where(queryConditions)
      .orderBy('createTime', 'desc')
      .skip(page * pageSize)
      .limit(pageSize)
      .get()
    
    console.log('查询结果:', {
      dataLength: result.data.length,
      firstItem: result.data[0] ? {
        _id: result.data[0]._id,
        imageUrls: result.data[0].imageUrls,
        authorAvatar: result.data[0].authorAvatar
      } : null
    })
    
    if (result.data.length === 0) {
      return {
        success: true,
        data: [],
        hasMore: false
      }
    }
    
    // 过滤被屏蔽用户的帖子（包括匿名帖子的realAuthorOpenid）
    const filteredData = result.data.filter(post => {
      if (blockedUserIds.length === 0) return true;
      // 检查普通帖子的 _openid
      if (blockedUserIds.includes(post._openid)) return false;
      // 检查匿名帖子的 realAuthorOpenid
      if (post.realAuthorOpenid && blockedUserIds.includes(post.realAuthorOpenid)) return false;
      return true;
    });
    
    // 处理数据，确保格式正确
    const processedData = filteredData.map(post => ({
      _id: post._id,
      _openid: post._openid,
      authorName: post.authorName || '匿名用户',
      authorAvatar: post.authorAvatar || '',
      imageUrls: post.imageUrls || [],
      votes: post.votes || 0,
      commentCount: post.commentCount || 0,
      isVoted: post.isVoted || false,
      likeIcon: getLikeIcon(post.votes || 0, post.isVoted || false),
      createTime: post.createTime || post.createdAt,
      createdAt: post.createdAt,
      updatedAt: post.updatedAt
    }))
    
    // 转换图片URL：将云存储fileID转换为临时访问URL
    const fileIDs = new Set()
    
    processedData.forEach(post => {
      // 确保 imageUrls 是数组
      if (!Array.isArray(post.imageUrls)) {
        post.imageUrls = post.imageUrls ? [post.imageUrls] : []
      }
      
      // 收集需要转换的fileID（以cloud://开头）
      post.imageUrls.forEach(url => {
        if (url && url.startsWith('cloud://')) {
          fileIDs.add(url)
        }
      })
      
      // 收集作者头像的fileID
      if (post.authorAvatar && post.authorAvatar.startsWith('cloud://')) {
        fileIDs.add(post.authorAvatar)
      }
    })
    
    // 批量转换fileID为临时URL
    if (fileIDs.size > 0) {
      console.log('开始转换图片URL，fileIDs数量:', fileIDs.size)
      console.log('fileIDs列表:', Array.from(fileIDs))
      
      try {
        const fileListResult = await cloud.getTempFileURL({ fileList: Array.from(fileIDs) })
        console.log('getTempFileURL 结果:', fileListResult)
        
        const urlMap = new Map()
        
        fileListResult.fileList.forEach(item => {
          if (item.status === 0) {
            urlMap.set(item.fileID, item.tempFileURL)
          }
        })
        
        console.log('URL映射表:', urlMap)
        
        // 转换所有帖子的图片URL和头像URL
        processedData.forEach(post => {
          const convertUrl = (url) => urlMap.get(url) || url
          
          if (post.imageUrls && Array.isArray(post.imageUrls)) {
            post.imageUrls = post.imageUrls.map(convertUrl)
          }
          if (post.authorAvatar) {
            post.authorAvatar = convertUrl(post.authorAvatar)
          }
        })
        
        console.log('图片URL转换完成')
      } catch (fileError) {
        console.error('图片URL转换失败:', fileError)
        console.error('fileError 详情:', {
          message: fileError.message,
          stack: fileError.stack,
          name: fileError.name
        })
      }
    } else {
      console.log('没有需要转换的图片URL')
    }
    
    return {
      success: true,
      data: processedData,
      hasMore: result.data.length === pageSize
    }
    
  } catch (error) {
    console.error('获取拼贴诗失败:', error)
    return {
      success: false,
      message: error.message || '获取拼贴诗失败'
    }
  }
}

// 获取点赞图标
function getLikeIcon(votes, isVoted) {
  if (votes >= 100) return '/static/images/peachplus.png'
  if (votes >= 50) return '/static/images/flowerplus.png'
  if (votes >= 20) return '/static/images/leafplus.png'
  if (votes >= 10) return '/static/images/seedplus.png'
  return '/static/images/seed.png'
}

// 默认词库
function getDefaultWordBank() {
  return {
    nouns: [
      '月光', '湖面', '纸船', '夜色', '微风', '街灯', '旅人', '雨巷', '旧书',
      '海岸', '青苔', '石阶', '山谷', '列车', '清晨', '晚钟', '雾霭', '野花',
      '行囊', '星河', '猫影', '琴弦', '屋檐', '灯塔', '旷野', '城墙'
    ],
    verbs: [
      '飘落', '游走', '折返', '靠近', '停泊', '潜行', '追逐', '凝望', '拾起',
      '回响', '叩问', '坠落', '闪烁', '栖息', '穿行', '搁浅', '拥抱', '折叠',
      '点燃', '晃动', '撕裂', '复苏'
    ],
    imagery: [
      '像黎明前的薄蓝', '像雨后的青石', '像擦肩而过的车尾灯', '像火车驶出隧道的白光',
      '像手心温热的糖纸', '像一封未寄出的信', '像风吹散的檐下风铃',
      '像月色落进井口', '像潮汐推开的门', '像旧电影的颗粒感', '像屋顶上的雪声',
      '像夏夜停电的屋子', '像落日余晖的橙', '像玻璃上未干的水迹'
    ]
  };
}

// 伪随机生成器（可重复，便于前端重现同一词序）
function mulberry32(a) {
  return function () {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// 使用给定 RNG 的洗牌
function shuffleWithRng(arr, rng) {
  const copy = arr.slice();
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}
