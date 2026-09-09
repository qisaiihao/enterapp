const cloud = require('wx-server-sdk');
const { isAdminByPoemId } = require('./_lib/admin-auth');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const DEFAULT = { enabled: true, text: '来看看本期周刊', target: 'weekly' };
const TARGETS = ['weekly', 'activities', 'ranking', 'topics'];

exports.main = async (event = {}) => {
  try {
    const action = event.action || 'get';
    if (!['get', 'save'].includes(action)) return { success: false, error: '不支持的操作' };
    if (action === 'save') {
      const openid = cloud.getWXContext().OPENID || event.openid;
      if (!openid || !await isAdminByPoemId({ db, command: db.command, openid, loggerPrefix: 'squareBubbleConfig' })) {
        return { success: false, error: '仅管理员可修改广场气泡' };
      }
      const text = typeof event.text === 'string' ? event.text.trim() : '';
      if (typeof event.enabled !== 'boolean' || !TARGETS.includes(event.target) ||
          text.length > 32 || (event.enabled && !text)) {
        return { success: false, error: '请填写不超过32字的文案，并选择跳转页面' };
      }
      const config = { enabled: event.enabled, text, target: event.target };
      await db.collection('adminConfig').doc('square_bubble').set({ data: { ...config, updatedAt: new Date(), updatedBy: openid } });
      return { success: true, config };
    }
    let config = DEFAULT;
    try {
      const res = await db.collection('adminConfig').where({ _id: 'square_bubble' }).limit(1).get();
      const stored = (res.data || [])[0];
      if (stored) config = {
        enabled: stored.enabled === true,
        text: String(stored.text || '').trim().slice(0, 32),
        target: TARGETS.includes(stored.target) ? stored.target : DEFAULT.target
      };
    } catch (error) {
      if (error.errCode !== -502005 && !/collection not exist/i.test(error.message || error.errMsg || '')) throw error;
    }
    return { success: true, config };
  } catch (error) {
    console.error('[squareBubbleConfig]', error);
    return { success: false, error: '气泡配置操作失败，请稍后重试' };
  }
};
