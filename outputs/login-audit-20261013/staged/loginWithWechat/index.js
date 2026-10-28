const cloud = require('wx-server-sdk');
const { wechatLogin } = require('./_lib/wechat-auth');
const { recordSuccessfulLogin } = require('./_lib/login-audit');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database({ throwOnNotFound: false });

exports.main = async (event = {}, context) => {
  try {
    // Identity is supplied only by the trusted WeChat cloud context.
    const wxContext = cloud.getWXContext();
    const result = await wechatLogin(db, wxContext.OPENID, event);
    if (result.success) await recordSuccessfulLogin({ db, user: result.userInfo, event, context, wxContext, loginMethod: 'wechat' });
    return result;
  } catch (error) {
    if (error.code === 'LOGIN_AUDIT_UNAVAILABLE') return { success: false, code: error.code, message: error.message };
    console.error('[loginWithWechat] operation failed:', error.code || 'UNKNOWN');
    return { success: false, code: 'WECHAT_OPERATION_FAILED', message: '操作失败，请稍后重试' };
  }
};
