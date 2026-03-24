// 浜戝嚱鏁板叆鍙ｆ枃浠?
const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();
const _ = db.command;
const $ = _.aggregate;

// 棰戠巼闄愬埗閰嶇疆
const RATE_LIMITS = {
  perMinute: 20,    // 姣忓垎閽?0娆?
  perHour: 200,     // 姣忓皬鏃?00娆?
  perDay: 600       // 姣忓ぉ600娆?
};

// 棰戠巼闄愬埗妫€鏌ュ嚱鏁?
async function checkRateLimit(openid) {
  try {
    const now = Date.now();
    const minuteAgo = now - 60 * 1000;
    const hourAgo = now - 60 * 60 * 1000;
    const dayAgo = now - 24 * 60 * 60 * 1000;

    console.log('馃攳 [RateLimit] 寮€濮嬫鏌ラ鐜囬檺鍒?- openid:', openid.substring(0, 8) + '...');

    // 妫€鏌ュ垎閽熺骇闄愬埗
    const minuteCount = await db.collection('api_rate_limits')
      .where({
        openid: openid,
        api_name: 'getPostList',
        timestamp: _.gte(minuteAgo)
      })
      .count();

    if (minuteCount.total >= RATE_LIMITS.perMinute) {
      console.log('馃毇 [RateLimit] 鍒嗛挓绾ч檺鍒惰秴闄?', minuteCount.total, '/', RATE_LIMITS.perMinute);
      return {
        allowed: false,
        reason: 'RATE_LIMIT_MINUTE_EXCEEDED',
        resetTime: minuteAgo + 60000,
        limit: RATE_LIMITS.perMinute,
        current: minuteCount.total,
        waitSeconds: Math.ceil((minuteAgo + 60000 - now) / 1000)
      };
    }

    // 妫€鏌ュ皬鏃剁骇闄愬埗
    const hourCount = await db.collection('api_rate_limits')
      .where({
        openid: openid,
        api_name: 'getPostList',
        timestamp: _.gte(hourAgo)
      })
      .count();

    if (hourCount.total >= RATE_LIMITS.perHour) {
      console.log('馃毇 [RateLimit] 灏忔椂绾ч檺鍒惰秴闄?', hourCount.total, '/', RATE_LIMITS.perHour);
      return {
        allowed: false,
        reason: 'RATE_LIMIT_HOUR_EXCEEDED',
        resetTime: hourAgo + 3600000,
        limit: RATE_LIMITS.perHour,
        current: hourCount.total,
        waitSeconds: Math.ceil((hourAgo + 3600000 - now) / 1000)
      };
    }

    // 妫€鏌ユ棩绾ч檺鍒?
    const dayCount = await db.collection('api_rate_limits')
      .where({
        openid: openid,
        api_name: 'getPostList',
        timestamp: _.gte(dayAgo)
      })
      .count();

    if (dayCount.total >= RATE_LIMITS.perDay) {
      console.log('馃毇 [RateLimit] 鏃ョ骇闄愬埗瓒呴檺:', dayCount.total, '/', RATE_LIMITS.perDay);
      return {
        allowed: false,
        reason: 'RATE_LIMIT_DAY_EXCEEDED',
        resetTime: dayAgo + 86400000,
        limit: RATE_LIMITS.perDay,
        current: dayCount.total,
        waitSeconds: Math.ceil((dayAgo + 86400000 - now) / 1000)
      };
    }

    // 璁板綍鏈璇锋眰
    await db.collection('api_rate_limits').add({
      data: {
        openid: openid,
        api_name: 'getPostList',
        timestamp: now
      }
    });

    // 瀹氭湡娓呯悊杩囨湡璁板綍锛?%姒傜巼鎵ц锛?
    if (Math.random() < 0.01) {
      try {
        await db.collection('api_rate_limits')
          .where({
            timestamp: _.lt(dayAgo)
          })
          .remove();
        console.log('馃Ч [RateLimit] 娓呯悊杩囨湡璁板綍瀹屾垚');
      } catch (cleanupError) {
        console.warn('鈿狅笍 [RateLimit] 娓呯悊杩囨湡璁板綍澶辫触:', cleanupError);
      }
    }

    console.log('鉁?[RateLimit] 棰戠巼妫€鏌ラ€氳繃 - 褰撳墠鍒嗛挓:', minuteCount.total + 1, '灏忔椂:', hourCount.total + 1, '鏃?', dayCount.total + 1);
    return {
      allowed: true,
      currentCounts: {
        perMinute: minuteCount.total + 1,
        perHour: hourCount.total + 1,
        perDay: dayCount.total + 1
      }
    };

  } catch (error) {
    console.error('鉂?[RateLimit] 棰戠巼闄愬埗妫€鏌ュけ璐?', error);
    // 妫€鏌ュけ璐ユ椂鍏佽閫氳繃锛岄伩鍏嶅奖鍝嶆甯哥敤鎴?
    return { allowed: true };
  }
}

// 浜戝嚱鏁板叆鍙ｅ嚱鏁?
exports.main = async (event, context) => {
  console.log('馃攳 [getPostList] ========== 浜戝嚱鏁板紑濮嬫墽琛?==========');
  console.log('馃攳 [getPostList] 鎺ユ敹鍒扮殑鍙傛暟:', JSON.stringify(event, null, 2));
  
  const wxContext = cloud.getWXContext();
  const wxCtxOpenid = wxContext.OPENID;
  const eventOpenid = event.openid;
  const openid = eventOpenid || wxCtxOpenid;
  // 添加 author 参数用于诗人筛选
  const { skip = 0, limit = 10, isPoem, isOriginal, isDiscussion, tag = '', author = '', includeActivity = false, activityId = '' } = event;
  const safeActivityId = typeof activityId === 'string' ? activityId.trim() : '';
  const isActivityQuery = includeActivity === true && !!safeActivityId;

  console.log('馃攳 [getPostList] 瑙ｆ瀽鍙傛暟:', {
    eventOpenid: eventOpenid ? 'provided' : 'missing',
    wxCtxOpenid: wxCtxOpenid ? 'provided' : 'missing',
    chosenOpenidSource: eventOpenid ? 'event.openid' : 'wxContext.OPENID',
    chosenOpenidExists: !!openid,
    skip,
    limit,
    isPoem,
    isOriginal,
    isDiscussion,
    tag,
    author,
    includeActivity,
    activityId: safeActivityId
  });

  if (!openid) {
    console.error('鉂?[getPostList] 鏃犳硶鑾峰彇鐢ㄦ埛 openid');
    return {
      success: false,
      message: '无法获取用户 openid，请重新登录',
      code: 'NO_OPENID'
    };
  }

  if (includeActivity === true && !safeActivityId) {
    return {
      success: false,
      message: 'activityId 不能为空',
      code: 'INVALID_ACTIVITY_ID'
    };
  }

  // 妫€鏌ヨ姹傞鐜囬檺鍒讹紙涓存椂绂佺敤浠ユ帓鏌ヨ秴鏃堕棶棰橈級
  // TODO: 浼樺寲棰戠巼闄愬埗妫€鏌ラ€昏緫鍚庨噸鏂板惎鐢?
  /*
  const rateLimitResult = await checkRateLimit(openid);
  if (!rateLimitResult.allowed) {
    console.log('馃毇 [getPostList] 棰戠巼闄愬埗鎷︽埅:', rateLimitResult.reason);
    return {
      success: false,
      code: rateLimitResult.reason,
      message: `璇锋眰杩囦簬棰戠箒锛岃鍦?{rateLimitResult.waitSeconds}绉掑悗閲嶈瘯`,
      data: {
        limit: rateLimitResult.limit,
        current: rateLimitResult.current,
        resetTime: rateLimitResult.resetTime,
        waitSeconds: rateLimitResult.waitSeconds
      }
    };
  }
  */

  try {
    console.log('馃攳 [getPostList] 寮€濮嬫瀯寤烘煡璇?');

    // 鑾峰彇琚睆钄界殑鐢ㄦ埛ID鍒楄〃锛堜娇鐢ㄧ紦瀛橈級
    let blockedUserIds = [];
    try {
      const getBlockedUserIds = require('../_lib/get-blocked-user-ids');
      blockedUserIds = await getBlockedUserIds(openid, db);
      console.log('馃攳 [getPostList] 琚睆钄界殑鐢ㄦ埛鏁伴噺:', blockedUserIds.length);
    } catch (blockError) {
      console.error('鉂?[getPostList] 鑾峰彇灞忚斀鍒楄〃澶辫触:', blockError);
    }

    let query = db.collection('posts').aggregate();

    // 鏋勫缓绛涢€夋潯浠?
    const matchConditions = { isHidden: _.neq(true) };

    if (isActivityQuery) {
      matchConditions.$or = [
        {
          isActivityPost: true,
          activityId: safeActivityId
        },
        {
          joinedActivityId: safeActivityId
        }
      ];
    } else {
      // 甯歌鍒楄〃榛樿鎺掗櫎娲诲姩甯栧瓙
      matchConditions.isActivityPost = _.neq(true);
    }
    
    // 濡傛灉鎸囧畾浜唅sPoem鍙傛暟锛屾坊鍔犺瘲姝岀瓫閫夋潯浠?
    if (isPoem !== undefined) {
      if (isPoem === true) {
        // 鍙幏鍙栬瘲姝岋細isPoem 蹇呴』涓?true
        matchConditions.isPoem = true;
      } else {
        // 鍙幏鍙栭潪璇楁瓕锛歩sPoem 涓?false 鎴栦笉瀛樺湪锛?ne: true 浼氬尮閰?false銆乶ull 鍜屼笉瀛樺湪鐨勫瓧娈碉級
        matchConditions.isPoem = _.neq(true);
      }
      console.log('馃攳 [getPostList] 娣诲姞isPoem绛涢€夋潯浠?', isPoem);
    }

    // 濡傛灉鎸囧畾浜唅sOriginal鍙傛暟锛屾坊鍔犲師鍒涚瓫閫夋潯浠?
    if (isOriginal !== undefined) {
      if (isOriginal === true) {
        // 鍙幏鍙栧師鍒涳細isOriginal 蹇呴』涓?true
        matchConditions.isOriginal = true;
      } else {
        // 鍙幏鍙栭潪鍘熷垱锛歩sOriginal 涓?false 鎴栦笉瀛樺湪锛?ne: true 浼氬尮閰?false銆乶ull 鍜屼笉瀛樺湪鐨勫瓧娈碉級
        matchConditions.isOriginal = _.neq(true);
      }
      console.log('馃攳 [getPostList] 娣诲姞isOriginal绛涢€夋潯浠?', isOriginal);
    }

    // 濡傛灉鎸囧畾浜唗ag鍙傛暟锛屾坊鍔犳爣绛剧瓫閫夋潯浠?
    if (tag) {
      matchConditions.tags = tag;  // 鍖归厤鍖呭惈璇ユ爣绛剧殑鏂囨。
      matchConditions['tags.0'] = { $exists: true };  // 纭繚tags鏁扮粍鑷冲皯鏈変竴涓厓绱?
      console.log('馃攳 [getPostList] 娣诲姞tag绛涢€夋潯浠?', tag);
    }

    // 濡傛灉鎸囧畾浜唅sDiscussion鍙傛暟锛屾坊鍔犺璁虹瓫閫夋潯浠?
    if (isDiscussion !== undefined) {
      if (isDiscussion === true) {
        // 鍙幏鍙栬璁猴細isDiscussion 蹇呴』涓?true
        matchConditions.isDiscussion = true;
      } else {
        // 鍙幏鍙栭潪璁ㄨ锛歩sDiscussion 涓?false 鎴栦笉瀛樺湪锛?ne: true 浼氬尮閰?false銆乶ull 鍜屼笉瀛樺湪鐨勫瓧娈碉級
        matchConditions.isDiscussion = _.neq(true);
      }
      console.log('馃攳 [getPostList] 娣诲姞isDiscussion绛涢€夋潯浠?', isDiscussion);
    }
    
    // 鎸夎瘲浜猴紙浣滆€咃級绛涢€?
    if (author && author.trim()) {
      matchConditions.author = author.trim();
      console.log('馃攳 [getPostList] 娣诲姞author绛涢€夋潯浠?', author);
    }
    
    // 杩囨护琚睆钄界敤鎴风殑甯栧瓙锛堟煡璇㈤樁娈靛厛杩囨护 _openid锛岀粨鏋滃鐞嗛樁娈靛啀杩囨护 realAuthorOpenid锛?
    if (blockedUserIds.length > 0) {
      // 鍦ㄦ煡璇㈤樁娈佃繃婊ゆ櫘閫氬笘瀛愮殑 _openid
      matchConditions._openid = _.nin(blockedUserIds);
      console.log('馃攳 [getPostList] 娣诲姞灞忚斀鐢ㄦ埛杩囨护鏉′欢锛坃openid锛夛紝琚睆钄界敤鎴锋暟:', blockedUserIds.length);
    }

    console.log('馃攳 [getPostList] 鏈€缁堢瓫閫夋潯浠?', JSON.stringify(matchConditions, null, 2));

    // 濡傛灉鏈夌瓫閫夋潯浠讹紝搴旂敤match
    if (Object.keys(matchConditions).length > 0) {
      query = query.match(matchConditions);
    }

    if (isActivityQuery) {
      query = query.addFields({
        activityOrder: {
          $cond: [
            { $eq: ['$isActivityPost', true] },
            0,
            1
          ]
        },
        activitySortTime: {
          $cond: [
            { $eq: ['$isActivityPost', true] },
            { $ifNull: ['$activityPublishTime', '$createTime'] },
            { $ifNull: ['$joinedActivityAt', '$createTime'] }
          ]
        }
      });
    }

    // 鍒ゆ柇鏄惁鍚敤闅忔満娣峰悎閫昏緫
    // 鍙湁褰撴病鏈夌瓫閫夋潯浠舵椂锛堝箍鍦洪〉闈級锛屾墠鍚敤闅忔満娣峰悎
    // 鏈夌瓫閫夋潯浠舵椂锛堝北銆佽矾椤甸潰锛夛紝鍙繑鍥炴椂闂撮『搴忕殑甯栧瓙
    const hasFilter = isPoem !== undefined || isOriginal !== undefined || isDiscussion !== undefined || tag || author || includeActivity === true || !!safeActivityId;
    const enableRandomMix = !hasFilter;  // 娌℃湁绛涢€夋潯浠舵椂鍚敤闅忔満娣峰悎
    
    let posts = [];
    let timeOrderedPosts = []; // 鍦ㄥ灞傚０鏄庯紝浠ヤ究鍦ㄦ棩蹇楄緭鍑烘椂浣跨敤
    let randomPosts = []; // 鍦ㄥ灞傚０鏄庯紝浠ヤ究鍦ㄦ棩蹇楄緭鍑烘椂浣跨敤
    
    if (enableRandomMix) {
      // 骞垮満椤甸潰锛氫娇鐢ㄩ殢鏈烘贩鍚堥€昏緫锛?涓椂闂撮『搴?+ 4涓殢鏈猴級
      const TIME_ORDERED_COUNT = 6;  // 鎸夋椂闂撮『搴忕殑甯栧瓙鏁伴噺
      const RANDOM_COUNT = 4;        // 闅忔満甯栧瓙鐨勬暟閲?
      
      // 1. 鍏堣幏鍙栨寜鏃堕棿椤哄簭鐨勫笘瀛愶紙6涓級
      const timeOrderedQuery = query.sort(
        isActivityQuery
          ? { activityOrder: 1, activitySortTime: -1, createTime: -1 }
          : { createTime: -1 }
      )
        .skip(skip)
        .limit(TIME_ORDERED_COUNT);
      
      const timeOrderedRes = await timeOrderedQuery.end();
      timeOrderedPosts = timeOrderedRes.list || []; // 浣跨敤澶栧眰澹版槑鐨勫彉閲?
      
      // 2. 鑾峰彇闅忔満甯栧瓙锛?涓級
      randomPosts = []; // 閲嶇疆闅忔満甯栧瓙鏁扮粍
      const timeOrderedPostIds = timeOrderedPosts.map(p => p._id).filter(Boolean);
    
      // 鍗充娇娌℃湁鏃堕棿椤哄簭鐨勫笘瀛愶紝涔熷皾璇曡幏鍙栭殢鏈哄笘瀛?
      try {
        // 鏋勫缓闅忔満甯栧瓙鏌ヨ鏉′欢锛堟帓闄ゅ凡鑾峰彇鐨勬椂闂撮『搴忓笘瀛愶級
        const randomPostsMatchConditions = {
          isHidden: _.neq(true),
          isActivityPost: _.neq(true)
        };
        
        // 澶嶅埗鎵€鏈夌瓫閫夋潯浠讹紙铏界劧杩欓噷搴旇娌℃湁绛涢€夋潯浠讹紝浣嗕负浜嗕繚闄╄繕鏄鍒讹級
        // 濡傛灉鏈夋椂闂撮『搴忕殑甯栧瓙锛屾帓闄ゅ畠浠?
        if (timeOrderedPostIds.length > 0) {
          randomPostsMatchConditions._id = _.nin(timeOrderedPostIds);
        }
        
        // 鎺掗櫎琚睆钄界殑鐢ㄦ埛
        if (blockedUserIds.length > 0) {
          randomPostsMatchConditions._openid = _.nin(blockedUserIds);
        }
        
        // 鍏堢粺璁＄鍚堟潯浠剁殑甯栧瓙鎬绘暟
        const countRes = await db.collection('posts').aggregate()
          .match(randomPostsMatchConditions)
          .count('total')
          .end();
        const totalPosts = (countRes.list && countRes.list[0] && countRes.list[0].total) || 0;
        
        if (totalPosts > 0) {
          // 鏀硅繘鐨勯殢鏈虹瓥鐣ワ細澶氭闅忔満鏌ヨ浠ュ鍔犻殢鏈烘€?
          let candidatePosts = [];
          const targetCandidates = Math.min(totalPosts, RANDOM_COUNT * 5); // 鑾峰彇鏇村鍊欓€変互澧炲姞闅忔満鎬?
          
          // 濡傛灉鎬绘暟杈冨皯锛岀洿鎺ヨ幏鍙栨墍鏈?
          if (totalPosts <= targetCandidates) {
            const allQuery = db.collection('posts').aggregate()
              .match(randomPostsMatchConditions)
              .limit(totalPosts);
            const allRes = await allQuery.end();
            candidatePosts = allRes.list || [];
          } else {
            // 澶氭闅忔満鏌ヨ锛屾瘡娆′粠涓嶅悓浣嶇疆鑾峰彇
            const queriesPerBatch = 3; // 鍒嗘壒鏌ヨ
            const perBatchCount = Math.ceil(targetCandidates / queriesPerBatch);
            
            for (let i = 0; i < queriesPerBatch && candidatePosts.length < targetCandidates; i++) {
              // 姣忔闅忔満閫夋嫨涓€涓猻kip浣嶇疆
              const maxSkip = Math.max(0, totalPosts - perBatchCount);
              const randomSkip = Math.floor(Math.random() * (maxSkip + 1));
              
              const randomQuery = db.collection('posts').aggregate()
                .match(randomPostsMatchConditions)
                .sort({ createTime: -1 })  // 铏界劧鎸夋椂闂存帓搴忥紝浣唖kip鏄殢鏈虹殑
                .skip(randomSkip)
                .limit(perBatchCount);
              
              const randomRes = await randomQuery.end();
              const batchPosts = randomRes.list || [];
              
              // 娣诲姞鍒板€欓€夊垪琛紝骞跺幓閲?
              const existingIds = new Set(candidatePosts.map(p => p._id));
              const newPosts = batchPosts.filter(p => !existingIds.has(p._id));
              candidatePosts = candidatePosts.concat(newPosts);
            }
          }
          
          // 濡傛灉鍊欓€夊笘瀛愯繕涓嶅锛屼粠鎵€鏈夊笘瀛愪腑闅忔満閫夋嫨skip浣嶇疆鍐嶈幏鍙?
          if (candidatePosts.length < RANDOM_COUNT && totalPosts > candidatePosts.length) {
            const remainingNeeded = RANDOM_COUNT - candidatePosts.length;
            const existingIds = new Set(candidatePosts.map(p => p._id));
            
            // 鍐嶅皾璇曞嚑娆￠殢鏈烘煡璇?
            for (let attempt = 0; attempt < 5 && candidatePosts.length < targetCandidates; attempt++) {
              const maxSkip = Math.max(0, totalPosts - remainingNeeded * 2);
              const randomSkip = Math.floor(Math.random() * (maxSkip + 1));
              
              const randomQuery = db.collection('posts').aggregate()
                .match(randomPostsMatchConditions)
                .sort({ createTime: -1 })
                .skip(randomSkip)
                .limit(remainingNeeded * 2);
              
              const randomRes = await randomQuery.end();
              const batchPosts = randomRes.list || [];
              const newPosts = batchPosts.filter(p => !existingIds.has(p._id));
              candidatePosts = candidatePosts.concat(newPosts);
              newPosts.forEach(p => existingIds.add(p._id));
            }
          }
          
          // 浠庡€欓€夊笘瀛愪腑褰诲簳闅忔満鎵撲贡骞堕€夋嫨锛堜娇鐢?Fisher-Yates shuffle 绠楁硶锛?
          const shuffled = candidatePosts.slice();
          for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            const temp = shuffled[i];
            shuffled[i] = shuffled[j];
            shuffled[j] = temp;
          }
          randomPosts = shuffled.slice(0, Math.min(RANDOM_COUNT, shuffled.length));
        }
      } catch (randomError) {
        console.error('鉂?[getPostList] 鑾峰彇闅忔満甯栧瓙澶辫触:', randomError);
      }
      
      // 3. 娣峰悎甯栧瓙锛氱湡姝ｉ殢鏈烘贩鍚堟椂闂撮『搴忓拰闅忔満甯栧瓙
      if (randomPosts.length > 0) {
        // 鍒涘缓鎵€鏈夊笘瀛愮殑鍚堝苟鍒楄〃
        const allPosts = timeOrderedPosts.concat(randomPosts);
        
        // 浣跨敤 Fisher-Yates shuffle 绠楁硶鐪熸闅忔満鎵撲贡
        for (let i = allPosts.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          const temp = allPosts[i];
          allPosts[i] = allPosts[j];
          allPosts[j] = temp;
        }
        
        posts = allPosts;
      } else {
        posts = timeOrderedPosts.slice();
      }
    } else {
      // 灞卞拰璺〉闈細鍙繑鍥炴椂闂撮『搴忕殑甯栧瓙
      const timeOrderedQuery = query.sort(
        isActivityQuery
          ? { activityOrder: 1, activitySortTime: -1, createTime: -1 }
          : { createTime: -1 }
      )
        .skip(skip)
        .limit(limit);
      
      const timeOrderedRes = await timeOrderedQuery.end();
      posts = timeOrderedRes.list || [];
    }
    
    // 纭繚杩斿洖鐨勫笘瀛愭暟閲忎笉瓒呰繃limit
    posts = posts.slice(0, limit);
    
    // 鎵归噺鏌ヨ鐐硅禐鐘舵€?
    let voterMap = new Set();
    if (posts.length > 0) {
      try {
        const postIds = posts.map(post => post._id);
        const voteRes = await db.collection('votes_log')
          .where({
            _openid: openid,
            type: 'post',
            postId: _.in(postIds)
          })
          .field({ postId: true })
          .get();
        voterMap = new Set(voteRes.data.map(item => item.postId));
      } catch (voteError) {
        console.error('鉂?[getPostList] 鎵归噺鏌ヨ鐐硅禐璁板綍澶辫触:', voteError);
      }
    }
    
    // 澶勭悊甯栧瓙鏁版嵁锛屽苟鍐嶆杩囨护琚睆钄界敤鎴凤紙鍙岄噸淇濋櫓锛?
    let processedPosts = posts.map(post => {
      const authorName = post.authorName || post.authorNameSnapshot || '鍖垮悕鐢ㄦ埛';
      const authorAvatar = post.authorAvatar || post.authorAvatarSnapshot || '';
      const authorSignature = post.authorSignature || ''; // 绛惧悕URL锛堝尶鍚嶅笘瀛愬彲鑳戒负绌猴級
      const commentCount = post.commentCount || 0;
      const isVoted = voterMap.has(post._id);

      // 缁勮瘲瀛楁鍏滃簳锛氱‘淇濆垪琛ㄨ繑鍥炶嚦灏戝墠涓夋
      const seriesBlocksRaw = Array.isArray(post.seriesBlocks) ? post.seriesBlocks : [];
      const seriesBlocks = seriesBlocksRaw.slice(0, 3).map((b, idx) => ({
        id: b.id || `series-${idx}`,
        subtitle: b.subtitle || b.subTitle || '',
        content: b.content || '',
        highlightSentence: b.highlightSentence || (b.content ? String(b.content).split(/\r?\n/).find(l => l && l.trim()) || '' : ''),
        highlightLines: Array.isArray(b.highlightLines) ? b.highlightLines : []
      }));
      const seriesBlockCount = post.seriesBlockCount || seriesBlocksRaw.length || seriesBlocks.length;
      const isSeries = post.isSeries || seriesBlocks.length > 0;
      
      return {
        ...post,
        isSeries,
        seriesBlocks,
        seriesBlockCount,
        authorName,
        authorAvatar,
        authorSignature,
        commentCount,
        isVoted,
        tags: Array.isArray(post.tags) ? post.tags : []
      };
    });
    
    // 鍙岄噸淇濋櫓锛氬墠绔啀娆¤繃婊よ灞忚斀鐢ㄦ埛鐨勫笘瀛愶紙鍖呮嫭鍖垮悕甯栧瓙鐨剅ealAuthorOpenid锛?
    if (blockedUserIds.length > 0) {
      processedPosts = processedPosts.filter(post => {
        // 妫€鏌ユ櫘閫氬笘瀛愮殑 _openid
        if (blockedUserIds.includes(post._openid)) {
          return false;
        }
        // 妫€鏌ュ尶鍚嶅笘瀛愮殑 realAuthorOpenid
        if (post.realAuthorOpenid && blockedUserIds.includes(post.realAuthorOpenid)) {
          return false;
        }
        return true;
      });
    }
    
    // --- 浼樺寲鍥剧墖URL杞崲閫昏緫 ---
    const fileIDs = new Set(); // 浣跨敤Set閬垮厤閲嶅fileID
    
    processedPosts.forEach(post => {
      // 淇濊瘉 imageUrls銆乷riginalImageUrls 涓€瀹氫负鏁扮粍
      if (!Array.isArray(post.imageUrls)) post.imageUrls = post.imageUrls ? [post.imageUrls] : [];
      if (!Array.isArray(post.originalImageUrls)) post.originalImageUrls = post.originalImageUrls ? [post.originalImageUrls] : [];
      
      // 鏀堕泦鎵€鏈夐渶瑕佽浆鎹㈢殑fileID
      const urlsToCheck = [
        ...post.imageUrls,
        ...post.originalImageUrls,
        post.imageUrl,
        post.originalImageUrl,
        post.authorAvatar,
        post.authorSignature, // 娣诲姞绛惧悕URL
        post.poemBgImage
      ].filter(url => url && url.startsWith('cloud://'));
      
      urlsToCheck.forEach(url => fileIDs.add(url));
    });

    if (fileIDs.size > 0) {
      try {
        const fileListResult = await cloud.getTempFileURL({ fileList: Array.from(fileIDs) });
        const urlMap = new Map();
        
        fileListResult.fileList.forEach(item => {
          if (item.status === 0) {
            urlMap.set(item.fileID, item.tempFileURL);
          }
        });

        // 鎵归噺杞崲鎵€鏈夊笘瀛愮殑鍥剧墖URL
        processedPosts.forEach(post => {
          const convertUrl = (url) => urlMap.get(url) || url;
          
          if (post.imageUrl) post.imageUrl = convertUrl(post.imageUrl);
          if (post.originalImageUrl) post.originalImageUrl = convertUrl(post.originalImageUrl);
          if (post.authorAvatar) post.authorAvatar = convertUrl(post.authorAvatar);
          if (post.authorSignature) post.authorSignature = convertUrl(post.authorSignature); // 杞崲绛惧悕URL
          if (post.poemBgImage) post.poemBgImage = convertUrl(post.poemBgImage);
          
          if (Array.isArray(post.imageUrls)) {
            post.imageUrls = post.imageUrls.map(convertUrl);
          }
          if (Array.isArray(post.originalImageUrls)) {
            post.originalImageUrls = post.originalImageUrls.map(convertUrl);
          }
        });
      } catch (fileError) {
        console.error('鉂?[getPostList] 鍥剧墖URL杞崲澶辫触:', fileError);
      }
    }

    console.log('鉁?[getPostList] ========== 浜戝嚱鏁版墽琛屽畬鎴?==========');
    console.log('鉁?[getPostList] 杩斿洖甯栧瓙鏁伴噺:', processedPosts.length);
    if (processedPosts.length > 0) {
      console.log('鉁?[getPostList] 鍓?涓笘瀛愭椂闂?', processedPosts.slice(0, 3).map(p => ({
        id: p._id,
        createTime: p.createTime
      })));
    }

    return {
      success: true,
      posts: processedPosts
    };

  } catch (e) {
    console.error('鉂?[getPostList] 浜戝嚱鏁版墽琛屽け璐?', e);
    console.error('鉂?[getPostList] 閿欒璇︽儏:', {
      message: e.message,
      stack: e.stack,
      name: e.name
    });
    return {
      success: false,
      error: {
        message: e.message,
        stack: e.stack
      }
    };
  }
};
