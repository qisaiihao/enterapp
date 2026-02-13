const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();
const _ = db.command;

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  // H5 / App 通过 uniCloud 调用时 wxContext.OPENID 可能为空，前端会注入 event.openid
  const openid = wxContext.OPENID || (event && event.openid);

  if (!openid) {
    return { code: -1, msg: '请先登录' };
  }

  try {
    // 同时匹配本人发布与匿名发布（realAuthorOpenid 记录真实作者）
    const cond = _.and([
      _.or([{ _openid: openid }, { realAuthorOpenid: openid }]),
      {
        // 只排除组诗本体
        isSeries: _.or([_.eq(false), _.exists(false)])
        // merged / isHidden 不再过滤，交给前端提示
      }
    ]);

    console.log('[listMySingles] 查询条件', cond);
    const res = await db
      .collection('posts')
      .where(cond)
      .orderBy('createTime', 'desc')
      .limit(200)
      .field({
        title: 1,
        content: 1,
        highlightSentence: 1,
        highlightLines: 1,
        isSeries: 1,
        mergedToSeriesId: 1,
        isHidden: 1,
        isPoem: 1,
        createTime: 1
      })
      .get();

    console.log('[listMySingles] 返回数量', res.data.length);
    return { code: 0, posts: res.data };
  } catch (e) {
    console.error('listMySingles error', e);
    return { code: -1, msg: e.message };
  }
};
