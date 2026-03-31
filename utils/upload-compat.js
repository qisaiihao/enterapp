import { cloudCall } from './cloudCall.js';
import { getCloudFunctionMethod, getCurrentPlatform } from './platformDetector.js';
import { readFileAsBase64 } from './fileReader.js';

function getTcbInstance(context) {
  if (context && context.$tcb && typeof context.$tcb.uploadFile === 'function') {
    return context.$tcb;
  }
  if (typeof getApp === 'function') {
    const app = getApp();
    if (app && app.$tcb && typeof app.$tcb.uploadFile === 'function') {
      return app.$tcb;
    }
  }
  if (typeof uni !== 'undefined' && uni.$tcb && typeof uni.$tcb.uploadFile === 'function') {
    return uni.$tcb;
  }
  return null;
}

function shouldRetry(error, retryCount, maxRetries) {
  if (retryCount >= maxRetries) return false;
  const message = (error && (error.errMsg || error.message)) || '';
  return message.includes('request:fail') || message.includes('timeout') || message.includes('network');
}

async function uploadViaCloudFunction({
  cloudPath,
  filePath,
  context,
  pageTag = 'upload',
  requireAuth = true,
  retryCount = 0,
  maxRetries = 2
}) {
  try {
    const base64 = await readFileAsBase64(filePath);
    if (!base64) {
      throw new Error('文件读取失败');
    }

    const res = await cloudCall(
      'upload',
      { cloudPath, fileContent: base64 },
      { pageTag, context, requireAuth }
    );
    const result = (res && res.result) || {};
    if (!result.success || !result.fileID) {
      throw new Error(result.error || result.message || '上传失败');
    }
    return {
      fileID: result.fileID,
      cloudPath: result.cloudPath || cloudPath
    };
  } catch (error) {
    if (shouldRetry(error, retryCount, maxRetries)) {
      await new Promise((resolve) => setTimeout(resolve, 1000 * (retryCount + 1)));
      return uploadViaCloudFunction({
        cloudPath,
        filePath,
        context,
        pageTag,
        requireAuth,
        retryCount: retryCount + 1,
        maxRetries
      });
    }
    throw error;
  }
}

async function uploadWithTcb(instance, cloudPath, filePath) {
  if (getCurrentPlatform() === 'h5' && typeof fetch === 'function') {
    const response = await fetch(filePath);
    const file = await response.blob();
    const res = await instance.uploadFile({ cloudPath, file });
    return { fileID: res.fileID || res.fileId };
  }
  const res = await instance.uploadFile({ cloudPath, filePath });
  return { fileID: res.fileID || res.fileId };
}

async function uploadWithNative({
  cloudPath,
  filePath,
  context
}) {
  const method = getCloudFunctionMethod();
  if (method === 'tcb') {
    const instance = getTcbInstance(context);
    if (!instance) {
      throw new Error('TCB实例不可用');
    }
    return uploadWithTcb(instance, cloudPath, filePath);
  }

  if (method === 'wx-cloud') {
    if (typeof wx === 'undefined' || !wx.cloud || typeof wx.cloud.uploadFile !== 'function') {
      throw new Error('微信云开发不可用');
    }
    const res = await wx.cloud.uploadFile({ cloudPath, filePath });
    return { fileID: res.fileID };
  }

  throw new Error('不支持的上传方式');
}

async function uploadFileCompat({
  cloudPath,
  filePath,
  context,
  pageTag = 'upload',
  requireAuth = true,
  maxRetries = 2
}) {
  if (!cloudPath) {
    throw new Error('cloudPath不能为空');
  }
  if (!filePath) {
    throw new Error('filePath不能为空');
  }

  try {
    const nativeResult = await uploadWithNative({ cloudPath, filePath, context });
    if (!nativeResult.fileID) {
      throw new Error('上传成功但未返回fileID');
    }
    return {
      fileID: nativeResult.fileID,
      cloudPath
    };
  } catch (error) {
    return uploadViaCloudFunction({
      cloudPath,
      filePath,
      context,
      pageTag,
      requireAuth,
      maxRetries
    });
  }
}

const uploadCompat = {
  uploadFileCompat,
  uploadViaCloudFunction
};

export {
  uploadFileCompat,
  uploadViaCloudFunction
};

export default uploadCompat;

if (typeof module !== 'undefined' && module.exports) {
  module.exports = uploadCompat;
  module.exports.default = uploadCompat;
}
