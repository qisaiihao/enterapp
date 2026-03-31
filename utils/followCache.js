/**
 * 兼容层：重定向到新的缓存模块位置
 * @deprecated 请使用 @/cache 代替
 */
import followCache from '../cache/stores/follow';

export default followCache;

if (typeof module !== 'undefined' && module.exports) {
    module.exports = followCache;
    module.exports.default = followCache;
}

