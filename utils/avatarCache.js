/**
 * 鍏煎灞傦細閲嶅畾鍚戝埌鏂扮殑缂撳瓨妯″潡浣嶇疆
 * @deprecated 璇蜂娇鐢?@/cache 浠ｆ浛
 */
import avatarCache from '../cache/stores/avatar';

export default avatarCache;

if (typeof module !== 'undefined' && module.exports) {
    module.exports = avatarCache;
    module.exports.default = avatarCache;
}
