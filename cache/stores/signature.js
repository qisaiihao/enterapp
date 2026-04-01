/**
 * 签名缓存存储
 * 
 * 命名空间: signatures
 * TTL: 24小时
 * 持久化: 是
 */
import cacheManager from '../core/manager.js';
import fileUrlCache from '../core/file-url.js';
import { cloudCall } from '@/utils/cloudCall.js';

const NS_SIGNATURE = cacheManager.namespace('signatures', { persistent: true, maxItems: 2048 });
const SIGNATURE_TTL_MS = 6 * 60 * 60 * 1000; // 6h（平衡实时性和性能）

class SignatureCache {
  constructor() {
    this.loadingSignatures = new Set();
  }

  callCloudFunction(name, data = {}) {
    return cloudCall(name, data, { pageTag: 'signatureCache' });
  }

  getUserSignature(userId) {
    if (!userId) return Promise.resolve(null);

    const cached = NS_SIGNATURE.get(userId);
    if (cached) {
      console.log(`【签名缓存】命中缓存: ${userId}`);
      return Promise.resolve(cached);
    }

    if (this.loadingSignatures.has(userId)) {
      return this.waitForSignatureLoad(userId);
    }

    return this.loadUserSignature(userId);
  }

  waitForSignatureLoad(userId) {
    return new Promise((resolve) => {
      const checkInterval = setInterval(() => {
        if (!this.loadingSignatures.has(userId)) {
          clearInterval(checkInterval);
          resolve(NS_SIGNATURE.get(userId));
        }
      }, 100);
      setTimeout(() => {
        clearInterval(checkInterval);
        this.loadingSignatures.delete(userId);
        resolve(null);
      }, 5000);
    });
  }

  loadUserSignature(userId) {
    this.loadingSignatures.add(userId);
    return new Promise((resolve) => {
      this.callCloudFunction('getUserProfile', { userId, onlyProfile: true })
        .then(async (res) => {
          if (res.result?.success && res.result.userInfo) {
            let signatureUrl = res.result.userInfo.signatureUrl || '';
            try {
              if (typeof signatureUrl === 'string' && signatureUrl.startsWith('cloud://')) {
                signatureUrl = await fileUrlCache.getTempUrl(signatureUrl);
              }
            } catch (_) {}
            const signatureData = { signatureUrl, lastUpdated: Date.now() };
            NS_SIGNATURE.set(userId, signatureData, { ttlMs: SIGNATURE_TTL_MS });
            resolve(signatureData);
          } else {
            const signatureData = { signatureUrl: '', lastUpdated: Date.now() };
            NS_SIGNATURE.set(userId, signatureData, { ttlMs: SIGNATURE_TTL_MS });
            resolve(signatureData);
          }
        })
        .catch(() => {
          const signatureData = { signatureUrl: '', lastUpdated: Date.now() };
          NS_SIGNATURE.set(userId, signatureData, { ttlMs: 5 * 60 * 1000 });
          resolve(signatureData);
        })
        .finally(() => this.loadingSignatures.delete(userId));
    });
  }

  getBatchUserSignatures(userIds) {
    if (!userIds || userIds.length === 0) return Promise.resolve({});
    
    const results = {};
    const needLoadUserIds = [];

    userIds.forEach((userId) => {
      const cached = NS_SIGNATURE.get(userId);
      if (cached) {
        results[userId] = cached;
      } else {
        needLoadUserIds.push(userId);
      }
    });

    if (needLoadUserIds.length > 0) {
      const promises = needLoadUserIds.map(userId => this.loadUserSignature(userId));
      return Promise.all(promises).then(() => {
        needLoadUserIds.forEach((userId) => {
          const cached = NS_SIGNATURE.get(userId);
          if (cached) results[userId] = cached;
        });
        return results;
      }).catch(() => results);
    }
    return Promise.resolve(results);
  }

  updateUserSignature(userId, signatureUrl) {
    if (!userId) return false;
    const signatureData = { signatureUrl: signatureUrl || '', lastUpdated: Date.now() };
    try {
      NS_SIGNATURE.set(userId, signatureData, { ttlMs: SIGNATURE_TTL_MS });
      return true;
    } catch (e) {
      return false;
    }
  }

  clearUserSignature(userId) {
    if (!userId) return false;
    try {
      NS_SIGNATURE.delete(userId);
      return true;
    } catch (e) {
      return false;
    }
  }
}

const signatureCache = new SignatureCache();

export { signatureCache };
export default signatureCache;
