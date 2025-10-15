// 引入腾讯云SDK和云开发SDK
const tencentcloud = require("tencentcloud-sdk-nodejs");
const cloud = require('wx-server-sdk');

// 初始化云开发
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();

// 拿到内容安全（cms）的 client
const CmsClient = tencentcloud.cms.v20190321.Client;

// 云函数入口函数
// TODO: 此云函数已暂时禁用，因为腾讯云内容审核服务未续费
// 未来续费后可以重新启用此云函数
exports.main = async (event, context) => {
  console.log('=== 内容审核云函数开始执行 ===');
  console.log('⚠️ 注意：内容审核服务已暂时禁用，因为腾讯云内容审核服务未续费');
  console.log('接收到的参数:', JSON.stringify(event, null, 2));
  
  // 暂时跳过审核，直接执行帖子创建逻辑
  console.log('⚠️ 跳过内容审核，直接创建帖子');

  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID || event.openid;

  if (!openid) {
    return {
      success: false,
      message: '无法获取用户 openid，请重新登录',
      code: 'NO_OPENID'
    };
  }

  // 从 event 中获取要审查的文本和图片fileID
  const { text, fileIDs, originalFileIDs, title, content, publishMode, isOriginal, author, tags, backgroundColor, highlightSentence, highlightLines, isDiscussion, parentPostId } = event;
  
  console.log('接收到的fileIDs:', fileIDs);
  console.log('接收到的originalFileIDs:', originalFileIDs);
  console.log('fileIDs类型:', typeof fileIDs);
  console.log('fileIDs长度:', fileIDs ? fileIDs.length : 'undefined');
  console.log('originalFileIDs长度:', originalFileIDs ? originalFileIDs.length : 'undefined');
  
  /* 
  // 以下是原来的内容审核逻辑，暂时注释掉，未来续费后可以重新启用
  // 策略ID配置 - 使用默认策略ID（数字类型）
  // 注意：BizType 参数需要是数字类型，不是字符串
  const TEXT_BIZ_TYPE = 0; // 文本审核策略ID，使用默认策略
  const IMAGE_BIZ_TYPE = 0; // 图片审核策略ID，使用默认策略
  
  // 调试模式：设置为true可以跳过审核（仅用于测试）
  const DEBUG_SKIP_AUDIT = false;

  // 检查环境变量
  console.log('环境变量检查:');
  console.log('TENCENT_SECRET_ID:', process.env.TENCENT_SECRET_ID ? '已设置' : '未设置');
  console.log('TENCENT_SECRET_KEY:', process.env.TENCENT_SECRET_KEY ? '已设置' : '未设置');
  
  if (!process.env.TENCENT_SECRET_ID || !process.env.TENCENT_SECRET_KEY) {
    console.error('环境变量未正确设置');
    return { code: -4, msg: '环境变量未正确设置，请检查TENCENT_SECRET_ID和TENCENT_SECRET_KEY' };
  }

  // ------------------- 安全配置 -------------------
  // 从环境变量中安全地读取密钥
  const clientConfig = {
    credential: {
      secretId: process.env.TENCENT_SECRET_ID,
      secretKey: process.env.TENCENT_SECRET_KEY,
    },
    region: "ap-guangzhou", // 推荐使用广州地域，速度较快
    profile: {
      httpProfile: {
        endpoint: "cms.tencentcloudapi.com",
      },
    },
  };
  
  console.log('创建腾讯云客户端...');
  const client = new CmsClient(clientConfig);
  */

  /*
  // ------------------- 1. 文本审核 -------------------
  if (DEBUG_SKIP_AUDIT) {
    console.log('调试模式：跳过文本审核');
  } else if (text || title || content) {
    try {
      // 合并所有文本内容进行审核
      const fullText = [title, content, text].filter(t => t && t.trim()).join(' ');
      console.log('准备审核的文本内容:', fullText);
      
      const textParams = {
        Content: Buffer.from(fullText).toString('base64')
        // 移除BizType参数，使用默认策略
      };
      
      console.log('调用文本审核API...');
      console.log('审核参数:', { 
        Content: textParams.Content.substring(0, 50) + '...'
      });
      
      const { Data } = await client.TextModeration(textParams);
      console.log('文本审核结果:', Data);
      
      if (Data.Suggestion !== 'Pass') {
        // 文本审核不通过，记录详细信息
        console.log('文本审核不通过，详细信息:', {
          suggestion: Data.Suggestion,
          labels: Data.Labels || [],
          subLabel: Data.SubLabel || '',
          confidence: Data.Confidence || 0
        });
        
        return {
          code: -1,
          msg: '文本内容不合规',
          suggestion: Data.Suggestion,
          details: Data.Labels || []
        };
      }
      console.log('文本审核通过');
    } catch (error) {
      console.error("文本审核API调用失败:", error);
      console.error("错误详情:", {
        message: error.message,
        code: error.code,
        stack: error.stack
      });
      return { code: -2, msg: '文本审核服务异常: ' + error.message };
    }
  }

  // ------------------- 2. 图片审核 -------------------
  if (DEBUG_SKIP_AUDIT) {
    console.log('调试模式：跳过图片审核');
  } else if (fileIDs && fileIDs.length > 0) {
    try {
      // 1. 用 fileID 换取临时的图片下载链接
      const fileList = fileIDs;
      const result = await cloud.getTempFileURL({ fileList });
      
      // 2. 对每张图片进行审核
      for (let i = 0; i < result.fileList.length; i++) {
        const fileItem = result.fileList[i];
        if (fileItem.status === 0) { // 成功获取临时URL
          const imageParams = {
            FileUrl: fileItem.tempFileURL
            // 移除BizType参数，使用默认策略
          };
          const { Data } = await client.ImageModeration(imageParams);
          console.log('图片审核结果:', Data);
          
          // 图片审核的判断逻辑：检查各个检测模块的HitFlag
          const hasViolation = Data.PornDetect?.HitFlag > 0 || 
                              Data.HotDetect?.HitFlag > 0 || 
                              Data.PolityDetect?.HitFlag > 0 || 
                              Data.IllegalDetect?.HitFlag > 0 || 
                              Data.TerrorDetect?.HitFlag > 0;
          
          if (hasViolation) {
            // 图片审核不通过，记录详细信息
            console.log('图片审核不通过，详细信息:', {
              pornDetect: Data.PornDetect,
              hotDetect: Data.HotDetect,
              polityDetect: Data.PolityDetect,
              illegalDetect: Data.IllegalDetect,
              terrorDetect: Data.TerrorDetect
            });
            
            return {
              code: -1,
              msg: '图片内容不合规',
              details: {
                pornDetect: Data.PornDetect,
                hotDetect: Data.HotDetect,
                polityDetect: Data.PolityDetect,
                illegalDetect: Data.IllegalDetect,
                terrorDetect: Data.TerrorDetect
              }
            };
          }
        }
      }
    } catch (error) {
      console.error("图片审核API调用失败:", error);
      return { code: -2, msg: '图片审核服务异常' };
    }
  }
  */
  
  // ------------------- 3. 审核全部通过，写入数据库 -------------------
  try {
    // 获取当前用户信息
    const currentOpenid = cloud.getWXContext().OPENID || openid;
    console.log('当前用户openid:', currentOpenid);
    
    const userInfo = await db.collection('users').where({
      _openid: currentOpenid
    }).get();
    const userNickName = userInfo.data.length > 0 ? userInfo.data[0].nickName : '匿名用户';
    const userAvatar = userInfo.data.length > 0 ? (userInfo.data[0].avatarUrl || '') : '';
    console.log('用户昵称:', userNickName);
    
    // 确定作者信息
    let authorName = '';
    if (publishMode === 'poem') {
      if (isOriginal) {
        // 原创诗歌：如果填写了作者就用填写的，否则使用用户昵称
        authorName = author && author.trim() ? author.trim() : userNickName;
      } else {
        // 非原创诗歌：必须使用填写的作者
        authorName = author && author.trim() ? author.trim() : '';
      }
    } else {
      // 普通帖子：使用用户昵称
      authorName = userNickName;
    }

    const postData = {
      _openid: currentOpenid, // 添加openid字段
      title: title || '',
      content: content || '',
      createTime: new Date(),
      votes: 0,
      commentCount: 0,
      // 新增诗歌相关字段
      isPoem: publishMode === 'poem',
      isOriginal: isOriginal || false,
      // 新增讨论相关字段
      isDiscussion: isDiscussion || false,
      parentPostId: parentPostId || '',
      // 新增作者字段
      author: authorName,
      authorName: userNickName,
      authorAvatar: userAvatar,
      authorNameSnapshot: userNickName,
      authorAvatarSnapshot: userAvatar,
      // 新增标签字段
      tags: tags || [],
      // 审核状态
      // UI 定制：背景色 + 高光句（可选）
      backgroundColor: backgroundColor || \\u0027\\u0027,
      highlightSentence: highlightSentence || \\u0027\\u0027,
      auditStatus: 'approved', // 审核通过
      auditTime: new Date()
    };
    
    if (fileIDs && fileIDs.length > 0) {
      // 过滤掉无效的fileID
      const validFileIDs = fileIDs.filter(id => id && typeof id === 'string' && id.trim() !== '');
      const validOriginalFileIDs = originalFileIDs ? originalFileIDs.filter(id => id && typeof id === 'string' && id.trim() !== '') : [];
      
      console.log('设置图片URL到帖子数据:', {
        originalFileIDs: fileIDs,
        validFileIDs: validFileIDs,
        originalOriginalFileIDs: originalFileIDs,
        validOriginalFileIDs: validOriginalFileIDs,
        imageUrl: validFileIDs[0],
        imageUrls: validFileIDs,
        originalImageUrl: validOriginalFileIDs[0],
        originalImageUrls: validOriginalFileIDs,
        imageUrlType: typeof validFileIDs[0]
      });
      
      if (validFileIDs.length > 0) {
        postData.imageUrl = validFileIDs[0];
        postData.imageUrls = validFileIDs;
        
        // 设置原图URL
        if (validOriginalFileIDs.length > 0) {
          postData.originalImageUrl = validOriginalFileIDs[0];
          postData.originalImageUrls = validOriginalFileIDs;
        } else {
          // 如果没有原图，使用压缩图作为原图
          postData.originalImageUrl = validFileIDs[0];
          postData.originalImageUrls = validFileIDs;
        }
        
        // 如果是诗歌模式，第一张图片作为背景图
        if (publishMode === 'poem') {
          postData.poemBgImage = validFileIDs[0];
        }
      } else {
        console.warn('没有有效的图片URL，跳过图片字段设置');
      }
    }

    // 数据验证
    if (!postData.title && !postData.content) {
      throw new Error('标题和内容不能同时为空');
    }
    
    if (!postData._openid) {
      throw new Error('用户openid缺失');
    }
    
    console.log('准备写入数据库的帖子数据:', JSON.stringify(postData, null, 2));
    
    // 测试数据库连接
    try {
      console.log('测试数据库连接...');
      const testResult = await db.collection('posts').limit(1).get();
      console.log('数据库连接正常，测试查询结果:', testResult);
    } catch (testError) {
      console.error('数据库连接测试失败:', testError);
      throw new Error(`数据库连接失败: ${testError.message}`);
    }
    
    const result = await db.collection('posts').add({
      data: postData
    });

    // 追加写入：颜色/高光句（与现有字段解耦，避免旧版本对象结构影响）
    try {
      await db.collection('posts').doc(result._id).update({
        data: {
          backgroundColor: backgroundColor || postData.backgroundColor || '',
          highlightSentence: highlightSentence || postData.highlightSentence || ''
        }
      });
    // 兼容写入：高光行数组
    try {
      await db.collection('posts').doc(result._id).update({
        data: {
          highlightLines: Array.isArray(highlightLines) ? highlightLines : []
        }
      });
    } catch (e) {
      console.warn('[contentCheck] 写入 highlightLines 失败（忽略）:', e);
    }
    } catch (e) {
      console.warn('[contentCheck] 追加写入颜色/高光句失败，不影响发帖:', e);
    }

    console.log('数据库写入成功，返回结果:', {
      postId: result._id,
      insertedCount: result.stats?.inserted || 1
    });

    // 全部成功，返回成功状态
    return {
      code: 0,
      msg: '发布成功',
      postId: result._id
    };

  } catch (dbError) {
    console.error("数据库写入失败:", dbError);
    console.error("数据库错误详情:", {
      message: dbError.message,
      code: dbError.code,
      stack: dbError.stack
    });
    return { 
      code: -3, 
      msg: `数据存储失败: ${dbError.message || '未知错误'}`,
      error: dbError.message
    };
  }
};


