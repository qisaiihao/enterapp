/**
 * 临时 URL 缓存与批处理工具
 * 适用端：H5 / App（@cloudbase/js-sdk），微信小程序（wx.cloud）
 *
 * 使用方式：
 * ```js
 * import fileUrlCache from '@/cache';
 * const map = await fileUrlCache.getTempUrls(fileIds);
 * const url = await fileUrlCache.getTempUrl(fileId);
 * ```
 */

import cacheManager from './manager';

const DEFAULT_BATCH_DELAY_MS = 200;
const MAX_BATCH_SIZE = 50; // CloudBase 临时链接接口每次最多 50 个文件。
const DEFAULT_TTL_MS = 55 * 60 * 1000;  // 55 分钟
const EXPIRY_SKEW_MS = 60 * 1000;       // 1 分钟安全裕量

function now() { return Date.now(); }
function isCloudId(str) { return typeof str === 'string' && str.startsWith('cloud://'); }
async function ensureTcbAuthIfNeeded(tcb) {
  if (!tcb) return;
  try {
    const authEnsurer = typeof uni !== 'undefined' ? uni.$ensureTcbAuthenticated : null;
    if (typeof authEnsurer === 'function') {
      await authEnsurer(tcb);
    }
  } catch (_) {}
}

class FileUrlCache {
  constructor() {
    this._cache = new Map();
    this._ns = null;
    this._pending = new Map();
    this._queue = [];
    this._timer = null;
    this._resolver = null;
    this._batchDelay = DEFAULT_BATCH_DELAY_MS;
    this._defaultTtl = DEFAULT_TTL_MS;
    try {
      this._ns = cacheManager.namespace('fileUrls', { persistent: false, maxItems: 2000 });
    } catch (_) { this._ns = null; }
  }

  setResolver(fn) { this._resolver = fn; }
  setBatchDelay(ms) { this._batchDelay = ms; }
  setDefaultTtl(ms) { this._defaultTtl = ms; }

  invalidate(ids) {
    if (!ids) {
      this._pending.clear();
      this._cache.clear();
      if (this._ns) try { this._ns.clear(); } catch (_) {}
      return;
    }
    (Array.isArray(ids) ? ids : [ids]).forEach(id => {
      this._pending.delete(id);
      this._cache.delete(id);
      if (this._ns) try { this._ns.delete(id); } catch (_) {}
    });
  }

  async getTempUrl(id) {
    const map = await this.getTempUrls([id]);
    return map[id] || id;
  }

  _getEntry(id) {
    return this._ns ? this._ns.get(id) : this._cache.get(id);
  }

  async getTempUrls(fileIds) {
    const ids = [...new Set((Array.isArray(fileIds) ? fileIds : []).filter(Boolean))];
    const entries = await Promise.all(ids.map(async id => {
      if (!isCloudId(id)) return [id, id];
      const entry = this._getEntry(id);
      if (entry?.url && entry.expireAt - EXPIRY_SKEW_MS > now()) return [id, entry.url];
      let task = this._pending.get(id);
      if (!task) {
        task = { id };
        task.promise = new Promise(resolve => { task.resolve = resolve; });
        this._pending.set(id, task);
        this._queue.push(task);
        this._scheduleFlush();
      }
      return [id, await task.promise];
    }));
    return Object.fromEntries(entries.filter(([, url]) => !!url));
  }

  warm(fileIds) {
    // 预热和前台读取共享缓存、排队及进行中的请求。
    this.getTempUrls(fileIds).catch(() => {});
  }

  _scheduleFlush() {
    if (this._timer) return;
    this._timer = setTimeout(() => this._flush().catch(() => {}), this._batchDelay);
  }

  async _flush() {
    const tasks = this._queue;
    this._queue = [];
    clearTimeout(this._timer); this._timer = null;
    const ids = [...new Set(tasks.map(task => task.id))];
    for (let offset = 0; offset < ids.length; offset += MAX_BATCH_SIZE) {
      const chunk = ids.slice(offset, offset + MAX_BATCH_SIZE);
      let fetched = {};
      try { fetched = await this._resolve(chunk) || {}; } catch (_) {}
      const selected = new Set(chunk);
      for (const task of tasks.filter(item => selected.has(item.id))) {
        const rec = fetched[task.id];
        const ttl = Number.isFinite(rec?.maxAgeSec) && rec.maxAgeSec > 0 ? rec.maxAgeSec * 1000 : this._defaultTtl;
        // 显式失效后旧请求仍可结算原等待者，但不能回填缓存或删除新任务。
        if (this._pending.get(task.id) === task) {
          this._pending.delete(task.id);
          if (rec?.url) {
            const entry = { url: rec.url, expireAt: now() + ttl };
            if (this._ns) {
              try { this._ns.set(task.id, entry, { ttlMs: ttl }); } catch (_) {}
            } else {
              this._cache.set(task.id, entry);
              if (this._cache.size > 2000) this._cache.delete(this._cache.keys().next().value);
            }
          }
        }
        task.resolve(rec?.url);
      }
    }
  }

  async _resolve(ids) {
    if (typeof this._resolver === 'function') {
      return await this._resolver(ids);
    }

    // 尝试使用 @cloudbase/js-sdk（H5/App）
    try {
      const app = (typeof getApp === 'function') ? getApp() : null;
      const tcb = app && app.$tcb;
      if (tcb && typeof tcb.getTempFileURL === 'function') {
        await ensureTcbAuthIfNeeded(tcb);
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

    // 兜底：调用云函数逐个换取
    const chunkSize = 3;
    const map = {};
    const runner = async (fileID) => {
      try {
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
      await Promise.all(slice.map(runner));
    }
    return map;
  }
}

const singleton = new FileUrlCache();
export default singleton;
