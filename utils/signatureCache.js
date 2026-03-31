/**
 * 兼容层：重定向到新的缓存模块位置
 * @deprecated 请使用 @/cache 代替
 */
import signatureCache from '../cache/stores/signature.js';

export default signatureCache;

if (typeof module !== 'undefined' && module.exports) {
  module.exports = signatureCache;
  module.exports.default = signatureCache;
}
