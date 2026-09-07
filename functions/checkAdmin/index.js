// 统一管理员检测云函数：从 adminConfig 集合读取管理员名单并校验当前用户
const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();
const _ = db.command;
const { isAdminByPoemId } = require('./_lib/admin-auth');

exports.main = async (event, context) => {
  try {
    const wxContext = cloud.getWXContext();
    const openid = wxContext.OPENID || (event && event.openid) || null;

    if (!openid) {
      return {
        success: false,
        code: 'NO_OPENID',
        error: '无法获取用户标识',
        isAdmin: false
      };
    }

    const isAdmin = await isAdminByPoemId({ db, command: _, openid, loggerPrefix: 'checkAdmin' });

    return {
      success: true,
      isAdmin: !!isAdmin,
      openid
    };
  } catch (error) {
    console.error('[checkAdmin] error:', error);
    return {
      success: false,
      code: 'CHECK_FAILED',
      error: error && error.message ? error.message : String(error),
      isAdmin: false
    };
  }
};