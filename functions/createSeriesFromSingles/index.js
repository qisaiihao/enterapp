const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();
const _ = db.command;

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  // H5/App/uniCloud 场景下 wxContext.OPENID 可能为空，前端会注入 event.openid，也可从 context 获取
  const openid = wxContext.OPENID || (event && event.openid) || (context && context.OPENID);
  const { blocks = [], title = '组诗' } = event || {};

  if (!openid) return { code: -1, msg: '未登录' };
  if (!Array.isArray(blocks) || blocks.length === 0) return { code: -1, msg: '请选择要合成的诗歌' };

  // 取出源帖
  const ids = blocks.map(b => b.postId).filter(Boolean);
  const postsRes = await db.collection('posts').where({
    _id: _.in(ids),
    _openid: openid,
    isSeries: _.neq(true),
    mergedToSeriesId: _.exists(false)
  }).get();

  if (postsRes.data.length !== ids.length) {
    return { code: -1, msg: '部分诗歌不可用或已被合成' };
  }

  // 构造 seriesBlocks
  const postMap = new Map(postsRes.data.map(p => [p._id, p]));
  const seriesBlocks = blocks.map((b, order) => {
    const p = postMap.get(b.postId) || {};
    const content = p.content || '';
    const lines = content.split(/\r?\n/).filter(l => l.trim());
    const highlightSentence = p.highlightSentence || lines[0] || '';
    const highlightLines = Array.isArray(p.highlightLines) && p.highlightLines.length ? p.highlightLines : (highlightSentence ? [highlightSentence] : []);
    return {
      id: b.postId,
      order,
      subtitle: b.subtitle || p.title || `其${order + 1}`,
      content,
      highlightSentence,
      highlightLines,
      imageUrl: p.imageUrl || '',
      backgroundColor: p.backgroundColor || '',
      textColor: p.textColor || '#333'
    };
  });

  const mergedContent = seriesBlocks.map(b => b.content).join('\n\n');
  const allHighlights = seriesBlocks.reduce((acc, b) => {
    if (Array.isArray(b.highlightLines)) acc.push(...b.highlightLines);
    else if (b.highlightSentence) acc.push(b.highlightSentence);
    return acc;
  }, []).slice(0, 3);

  // 取用户信息
  const userRes = await db.collection('users').where({ _openid: openid }).limit(1).get();
  const userDoc = (userRes && userRes.data && userRes.data[0]) || {};
  const userNickName = userDoc.nickName || '匿名用户';
  const userAvatar = userDoc.avatarUrl || '';

  // 新组诗数据
  const now = new Date();
  const seriesDoc = {
    _openid: openid,
    title: title || '组诗',
    content: mergedContent,
    isPoem: true,
    isSeries: true,
    seriesBlocks,
    seriesBlockCount: seriesBlocks.length,
    publishMode: 'poem',
    isOriginal: true,
    highlightSentence: allHighlights[0] || '',
    highlightLines: allHighlights,
    backgroundColor: (seriesBlocks[0] && seriesBlocks[0].backgroundColor) || '',
    textColor: (seriesBlocks[0] && seriesBlocks[0].textColor) || '#333',
    authorName: userNickName,
    authorAvatar: userAvatar,
    createTime: now,
    votes: 0,
    commentCount: 0,
    isMergedFrom: ids
  };

  const addRes = await db.collection('posts').add({ data: seriesDoc });

  // 标记源诗
  await db.collection('posts').where({ _id: _.in(ids) }).update({
    data: {
      mergedToSeriesId: addRes._id,
      isHidden: true
    }
  });

  return { code: 0, postId: addRes._id };
};
