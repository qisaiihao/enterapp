/**
 * 临时 URL 缓存与批处理工具
 * 适用端：H5 / App（@cloudbase/js-sdk），微信小程序（wx.cloud）
 *
 * 使用方式：
 * import fileUrlCache from '@/_utils/file-url-cache'
 * // 可选：在 main.js 初始化后注入 resolver（更可靠）
 * fileUrlCache.setResolver(async (ids) => {
 *   const app = getApp && getApp();
 *   const tcb = app && app.$tcb; // 在 main.js 已挂载
 *   const { fileList } = await tcb.getTempFileURL({ fileList: ids });
 *   const map = {};
 *   fileList.forEach((it) => { map[it.fileID] = { url: it.tempFileURL, maxAgeSec: it.maxAge || 3600 }; });
 *   return map;
 * });
 *
 * // 请求一批 fileID 对应的可访问 URL（自动缓存与去重、节流）
 * const map = await fileUrlCache.getTempUrls(fileIds);
 * const url = await fileUrlCache.getTempUrl(fileId);
 */

import cacheManager from './cache-manager';

const DEFAULT_BATCH_DELAY_MS = 200;        // 合并请求延迟
const DEFAULT_TTL_MS = 55 * 60 * 1000;     // 55 分钟，留出缓冲避免将近过期
const EXPIRY_SKEW_MS = 60 * 1000;          // 1 分钟安全裕量

function now() { return Date.now(); }
function isCloudId(str) { return typeof str === 'string' && str.startsWith('cloud://'); }

class FileUrlCache {
  constructor() {
    this._cache = new Map(); // fileID -> { url, expireAt }
    this._ns = null;
    this._pendingIds = new Set();
    this._waiters = [];     // { ids: Set<string>, resolve, reject }
    this._timer = null;
    this._resolver = null;  // async (ids) => ({ [id]: { url, maxAgeSec? } })
    this._batchDelay = DEFAULT_BATCH_DELAY_MS;
    this._defaultTtl = DEFAULT_TTL_MS;
    try {
      this._ns = cacheManager && cacheManager.namespace ? cacheManager.namespace('fileUrls', { persistent: false, maxItems: 2000 }) : null;
    } catch (_) { this._ns = null; }
  }
  setResolver(fn) { this._resolver = fn; }
  setBatchDelay(ms) { this._batchDelay = ms; }
  setDefaultTtl(ms) { this._defaultTtl = ms; }

  invalidate(ids) {
    if (!ids) { this._cache.clear(); return; }
    (Array.isArray(ids) ? ids : [ids]).forEach(id => this._cache.delete(id));
  }

  async getTempUrl(id) {
    const map = await this.getTempUrls([id]);
    return map[id] || id;
  }

  async getTempUrls(fileIds) {
    const ids = (fileIds || []).filter(Boolean);
    if (ids.length === 0) return {};

    // 非 cloud:// 直接回传
    const direct = {};
    const targets = [];
    const nowTs = now();
    ids.forEach(id => {
      if (!isCloudId(id)) { direct[id] = id; return; }
      let entry = this._cache.get(id);
      if (!entry && this._ns) {
        const val = this._ns.get(id);
        if (val && typeof val.url === 'string') { entry = val; this._cache.set(id, entry); }
      }
      if (entry && entry.url && entry.expireAt - EXPIRY_SKEW_MS > nowTs) {
        direct[id] = entry.url;
      } else {
        targets.push(id);
      }
    });

    if (targets.length === 0) return direct;

    targets.forEach(id => this._pendingIds.add(id));
    const p = new Promise((resolve, reject) => {
      this._waiters.push({ ids: new Set(ids), resolve, reject });
    });

    this._scheduleFlush();
    const batchResult = await p;
    return { ...direct, ...batchResult };
  }

  warm(fileIds) {
    const ids = (fileIds || []).filter(isCloudId);
    if (ids.length === 0) return;
    ids.forEach(id => this._pendingIds.add(id));
    this._scheduleFlush();
  }

  _scheduleFlush() {
    if (this._timer) return;
    this._timer = setTimeout(() => this._flush().catch(() => {}), this._batchDelay);
  }

  async _flush() {
    const ids = Array.from(this._pendingIds);
    this._pendingIds.clear();
    clearTimeout(this._timer); this._timer = null;
    if (ids.length === 0) return;

    let fetched = {};
    try {
      fetched = await this._resolve(ids);
    } catch (e) {
      // 保底返回空映射，避免打断调用链
      fetched = {};
    }

    const nowTs = now();
    // 写入缓存
    ids.forEach(id => {
      const rec = fetched[id];
      if (rec && rec.url) {
        const ttl = (typeof rec.maxAgeSec === 'number' ? rec.maxAgeSec * 1000 : this._defaultTtl);
        this._cache.set(id, { url: rec.url, expireAt: nowTs + Math.max(10_000, ttl) });
      }
    });

    // 逐个唤醒等待者
    const waiters = this._waiters;
    this._waiters = [];
    waiters.forEach(({ ids, resolve }) => {
      const out = {};
      ids.forEach(id => {
        let entry = this._cache.get(id);
      if (!entry && this._ns) {
        const val = this._ns.get(id);
        if (val && typeof val.url === 'string') { entry = val; this._cache.set(id, entry); }
      }
        if (entry && entry.url) out[id] = entry.url;
      });
      resolve(out);
    });
  }

  async _resolve(ids) {
    // 优先使用注入的 resolver（推荐在 main.js 注入 tcb 实例）
    if (typeof this._resolver === 'function') {
      return await this._resolver(ids);
    }

    // 尝试使用 @cloudbase/js-sdk（H5/App）
    try {
      const app = (typeof getApp === 'function') ? getApp() : null;
      const tcb = app && app.$tcb;
      if (tcb && typeof tcb.getTempFileURL === 'function') {
        const res = await tcb.getTempFileURL({ fileList: ids });
        const map = {};
        if (res && Array.isArray(res.fileList)) {
          res.fileList.forEach((it) => {
            if (it && it.tempFileURL) {
              map[it.fileID] = { url: it.tempFileURL, maxAgeSec: it.maxAge || 3600 };
            }
          });
        }
        return map;
      }
    } catch (_) {}

    // 尝试小程序原生 wx.cloud
    if (typeof wx !== 'undefined' && wx.cloud && typeof wx.cloud.getTempFileURL === 'function') {
      const res = await wx.cloud.getTempFileURL({ fileList: ids });
      const map = {};
      if (res && Array.isArray(res.fileList)) {
        res.fileList.forEach((it) => {
          if (it && it.tempFileURL) {
            map[it.fileID] = { url: it.tempFileURL, maxAgeSec: it.maxAge || 3600 };
          }
        });
      }
      return map;
    }

    // 兜底：调用云函数逐个换取（并发限制 3）
    const chunkSize = 3;
    const map = {};
    const runner = async (fileID) => {
      try {
        // 兼容 main.js 中对 callFunction 的封装（tcb 或 uniCloud）
        const call = (typeof uniCloud !== 'undefined' && uniCloud.callFunction)
          ? (opt) => uniCloud.callFunction(opt)
          : (opt) => {
              const app = (typeof getApp === 'function') ? getApp() : null;
              const tcb = app && app.$tcb;
              return tcb.callFunction(opt);
            };
        const { result } = await call({ name: 'imageManager', data: { action: 'getImageUrl', fileID } });
        if (result && result.success && result.url) {
          map[fileID] = { url: result.url, maxAgeSec: result.expireTime || 3600 };
        }
      } catch (_) {}
    };

    for (let i = 0; i < ids.length; i += chunkSize) {
      const slice = ids.slice(i, i + chunkSize);
      // eslint-disable-next-line no-await-in-loop
      await Promise.all(slice.map(runner));
    }
    return map;
  }
}

const singleton = new FileUrlCache();
export default singleton;


