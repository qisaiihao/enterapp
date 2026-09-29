const cloud = require('wx-server-sdk');
const { wechatLogin } = require('./_lib/wechat-auth');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database({ throwOnNotFound: false });

exports.main = async (event = {}) => {
  try {
    // Identity is supplied only by the trusted WeChat cloud context.
    return await wechatLogin(db, cloud.getWXContext().OPENID, event);
  } catch (error) {
    console.error('[loginWithWechat] operation failed:', error.code || 'UNKNOWN');
    return { success: false, code: 'WECHAT_OPERATION_FAILED', message: '操作失败，请稍后重试' };
  }
};
