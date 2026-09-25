const tcb = require('@cloudbase/node-sdk');
const { imageSize } = require('image-size');
const { createService } = require('./core');
const { createStore } = require('./store');
const { createTencentRecognizer } = require('./provider');

exports.main = async (event = {}, context = {}) => {
  try {
    const parsed = tcb.parseContext(context);
    const env = parsed.environment || parsed.environ || {};
    // Identity only comes from this invocation's trusted runtime context, never event.openid.
    const identity = env.WX_OPENID ? `wx:${env.WX_OPENID}` : env.TCB_UUID ? `tcb:${env.TCB_UUID}` : '';
    const app = tcb.init({ env: tcb.SYMBOL_CURRENT_ENV });
    const secretId = process.env.OCR_SECRET_ID || process.env.TENCENTCLOUD_SECRETID;
    const secretKey = process.env.OCR_SECRET_KEY || process.env.TENCENTCLOUD_SECRETKEY;
    const enabled = process.env.COLLAGE_OCR_ENABLED === 'true' && !!secretId && !!secretKey;
    const service = createService({
      enabled,
      limit: Math.min(1000, Math.max(0, Math.floor(Number(process.env.COLLAGE_OCR_MONTHLY_LIMIT ?? 1000) || 0))),
      dailyLimit: Math.max(1, Math.floor(Number(process.env.COLLAGE_OCR_DAILY_LIMIT || 20) || 20)),
      store: createStore(app.database()), dimensions: imageSize,
      download: async fileID => (await app.downloadFile({ fileID })).fileContent,
      fileForPath: async cloudPath => {
        const result = await app.getUploadMetadata({ cloudPath });
        if (result.code || !result.data?.fileId) throw new Error('UPLOAD_METADATA_FAILED');
        return result.data.fileId;
      },
      cleanup: async fileID => {
        const result = await app.deleteFile({ fileList: [fileID] });
        const file = result.fileList?.find(item => (item.fileID || item.fileId) === fileID);
        if (result.code || !file || !['SUCCESS', 'STORAGE_FILE_NONEXIST', 'FILE_NOT_EXIST'].includes(file.code)) throw new Error('CLOUD_FILE_DELETE_FAILED');
      },
      recognize: async ImageBase64 => createTencentRecognizer({
        secretId, secretKey, token: process.env.OCR_SECRET_ID ? process.env.OCR_SESSION_TOKEN : process.env.TENCENTCLOUD_SESSIONTOKEN
      })(ImageBase64)
    });
    return await service(event, identity);
  } catch (error) {
    console.error('[collageOcr]', error.code || 'SERVICE_ERROR');
    return { success: false, message: '文字识别服务暂未就绪，请先使用手动框选' };
  }
};
