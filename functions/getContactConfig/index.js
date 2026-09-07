const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

exports.main = async () => {
  try {
    const result = await db.collection('adminConfig').where({ _id: 'contact' }).limit(1).get();
    const config = result.data[0] || {};
    // Only expose the public contact fields, never administrator configuration.
    return { success: true, qrCode: config.qrCode || '', contactText: config.contactText || '' };
  } catch (error) {
    if (error.errCode === -502005 || /collection not exist/i.test(error.message || error.errMsg || '')) {
      return { success: true, qrCode: '', contactText: '' };
    }
    console.error('[getContactConfig]', error);
    return { success: false, error: '联系方式加载失败，请稍后重试' };
  }
};
