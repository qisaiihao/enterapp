/**
 * 统一缓存管理器（内存 LRU + 可选 uniStorage 持久化）
 * 
 * 功能：
 * - namespace 级别的 get/set/delete/clear
 * - getOrFetch 支持 SWR (stale-while-revalidate)
 * - 内存 LRU 淘汰策略
 * - 可选持久化到 uniStorage
 * 
 * 使用示例：
 * ```js
 * import cacheManager from '@/cache';
 * const ns = cacheManager.namespace('avatars', { persistent: true, maxItems: 2048 });
 * ns.set('user123', { url: '...' }, { ttlMs: 24 * 60 * 60 * 1000 });
 * const data = ns.get('user123');
 * ```
 */

const DEFAULT_MAX_ITEMS = 800;

function now() { return Date.now(); }

function hasUniStorage() {
  try {
    return typeof uni !== 'undefined' && typeof uni.getStorageSync === 'function' && typeof uni.setStorageSync === 'function';
  } catch (_) { return false; }
}

function tryLocalStorage() {
  try { return typeof localStorage !== 'undefined' ? localStorage : null; } catch (_) { return null; }
}

class NamespaceHandle {
  constructor(name, opts) {
    this.name = name;
    this.maxItems = (opts && opts.maxItems) || DEFAULT_MAX_ITEMS;
    this.persistent = !!(opts && opts.persistent);
    this.mem = new Map();
    this._useUni = hasUniStorage();
    this._ls = this._useUni ? null : tryLocalStorage();
    this.stats = { hits: 0, misses: 0, evictions: 0, gets: 0, sets: 0 };
  }

  _k(key) { return `__cm__:${this.name}:${key}`; }
  _idxKey() { return `__cm__:${this.name}:__keys__`; }

  _listPersistKeys() {
    if (!this.persistent) return [];
    try {
      if (this._useUni) {
        const raw = uni.getStorageSync(this._idxKey());
        return raw ? JSON.parse(raw) : [];
      } else if (this._ls) {
        const raw = this._ls.getItem(this._idxKey());
        return raw ? JSON.parse(raw) : [];
      }
    } catch (_) {}
    return [];
  }

  keys() {
    const memKeys = Array.from(this.mem.keys());
    const idxKeys = this._listPersistKeys();
    const set = new Set(memKeys.concat(idxKeys));
    return Array.from(set);
  }

  _readPersist(key) {
    if (!this.persistent) return null;
    try {
      if (this._useUni) {
        const raw = uni.getStorageSync(this._k(key));
        return raw ? JSON.parse(raw) : null;
      } else if (this._ls) {
        const raw = this._ls.getItem(this._k(key));
        return raw ? JSON.parse(raw) : null;
      }
    } catch (_) {}
    return null;
  }

  _writePersist(key, rec) {
    if (!this.persistent) return;
    try {
      const raw = JSON.stringify(rec);
      if (this._useUni) {
        uni.setStorageSync(this._k(key), raw);
        const idxRaw = uni.getStorageSync(this._idxKey());
        const idx = idxRaw ? JSON.parse(idxRaw) : [];
        if (!idx.includes(key)) idx.push(key);
        uni.setStorageSync(this._idxKey(), JSON.stringify(idx));
      } else if (this._ls) {
        this._ls.setItem(this._k(key), raw);
        const idxRaw = this._ls.getItem(this._idxKey());
        const idx = idxRaw ? JSON.parse(idxRaw) : [];
        if (!idx.includes(key)) idx.push(key);
        this._ls.setItem(this._idxKey(), JSON.stringify(idx));
      }
    } catch (_) {}
  }

  _removePersist(key) {
    if (!this.persistent) return;
    try {
      if (this._useUni) {
        uni.removeStorageSync(this._k(key));
        const idxRaw = uni.getStorageSync(this._idxKey());
        const idx = idxRaw ? JSON.parse(idxRaw) : [];
        const n = idx.filter(k => k !== key);
        uni.setStorageSync(this._idxKey(), JSON.stringify(n));
      } else if (this._ls) {
        this._ls.removeItem(this._k(key));
        const idxRaw = this._ls.getItem(this._idxKey());
        const idx = idxRaw ? JSON.parse(idxRaw) : [];
        const n = idx.filter(k => k !== key);
        this._ls.setItem(this._idxKey(), JSON.stringify(n));
      }
    } catch (_) {}
  }

  _trimLRU() {
    if (this.mem.size <= this.maxItems) return;
    const arr = Array.from(this.mem.entries());
    arr.sort((a, b) => (a[1].la || 0) - (b[1].la || 0));
    const need = this.mem.size - this.maxItems;
    for (let i = 0; i < need; i++) {
      const k = arr[i] && arr[i][0];
      if (k) { this.mem.delete(k); this.stats.evictions++; }
    }
  }

  get(key) {
    const nowTs = now();
    this.stats.gets++;
    let rec = this.mem.get(key);
    if (!rec) {
      rec = this._readPersist(key);
      if (rec) this.mem.set(key, rec);
    }
    if (!rec) { this.stats.misses++; return undefined; }
    if (typeof rec.e === 'number' && rec.e > 0 && rec.e <= nowTs) {
      this.mem.delete(key);
      this._removePersist(key);
      this.stats.misses++;
      return undefined;
    }
    rec.la = nowTs;
    this.stats.hits++;
    return rec.v;
  }

  set(key, val, opts) {
    const ttlMs = (opts && opts.ttlMs) || 0;
    const nowTs = now();
    const expireAt = ttlMs > 0 ? nowTs + ttlMs : 0;
    const rec = { v: val, e: expireAt, la: nowTs };
    this.mem.set(key, rec);
    this._trimLRU();
    this._writePersist(key, rec);
    this.stats.sets++;
  }

  update(key, updater) {
    try {
      const nowTs = now();
      let rec = this.mem.get(key);
      if (!rec && this.persistent) {
        rec = this._readPersist(key);
        if (rec) this.mem.set(key, rec);
      }
      if (!rec) return false;
      
      // 检查缓存是否已过期（除非永不过期）
      if (rec.e > 0 && rec.e <= nowTs) {
        this.mem.delete(key);
        this._removePersist(key);
        return false;
      }
      
      const cur = rec.v;
      const next = typeof updater === 'function' ? updater(cur) : cur;
      if (next !== undefined) {
        // 注意：这里传递的ttlMs应该是绝对值，不是相对值
        // 但update方法的语义应该是保持原有过期设置
        if (rec.e === 0) {
          // 永不过期的缓存，直接更新数据但不改变过期设置
          const newRec = { v: next, e: 0, la: nowTs };
          this.mem.set(key, newRec);
          this._writePersist(key, newRec);
        } else {
          // 有过期时间的缓存，使用绝对过期时间
          const newRec = { v: next, e: rec.e, la: nowTs };
          this.mem.set(key, newRec);
          this._writePersist(key, newRec);
        }
        return true;
      }
      return false;
    } catch (_) { return false; }
  }

  delete(key) {
    this.mem.delete(key);
    this._removePersist(key);
  }

  // 清除所有永不过期的缓存（用于修复旧的错误缓存）
  clearInfiniteCache() {
    let clearedCount = 0;
    // 清理内存缓存
    const keys = new Set(this.mem.keys());
    try {
      this._listPersistKeys().forEach((key) => keys.add(key));
    } catch (_) {}

    for (const key of keys) {
      const rec = this.mem.get(key) || this._readPersist(key);
      if (rec && rec.e === 0) {
        console.log(`🧹 [Cache-Cleanup] 清除永不过期缓存 - key: ${key.substring(0, 50)}...`);
        this.mem.delete(key);
        this._removePersist(key);
        clearedCount++;
      }
    }
    console.log(`✨ [Cache-Cleanup] 已清除 ${clearedCount} 个永不过期缓存`);
    return clearedCount;
  }

  clear() {
    this.mem.clear();
    if (!this.persistent) return;
    try {
      if (this._useUni) {
        const idxRaw = uni.getStorageSync(this._idxKey());
        const idx = idxRaw ? JSON.parse(idxRaw) : [];
        idx.forEach(k => uni.removeStorageSync(this._k(k)));
        uni.removeStorageSync(this._idxKey());
      } else if (this._ls) {
        const idxRaw = this._ls.getItem(this._idxKey());
        const idx = idxRaw ? JSON.parse(idxRaw) : [];
        idx.forEach(k => this._ls.removeItem(this._k(k)));
        this._ls.removeItem(this._idxKey());
      }
    } catch (_) {}
  }

  async getOrFetch(key, loader, opts) {
    const ttlMs = (opts && opts.ttlMs) || 0;
    const swrMs = (opts && opts.swrMs) || 0;
    const onBackgroundUpdate = opts && opts.onBackgroundUpdate;

    const nowTs = now();
    let rec = this.mem.get(key);
    if (!rec && this.persistent) {
      rec = this._readPersist(key);
      if (rec) this.mem.set(key, rec);
    }

    const isFresh = rec && (rec.e === 0 || rec.e > nowTs);
    const isStale = rec && rec.e > 0 && rec.e <= nowTs;
    const isInSWRWindow = isStale && swrMs > 0 && nowTs - rec.e <= swrMs;

    if (isFresh) {
      rec.la = nowTs;
      return rec.v;
    }

    if (isInSWRWindow) {
      rec.la = nowTs;
      // SWR: 先返回旧数据，后台更新
      loader().then((val) => {
        this.set(key, val, { ttlMs });
        if (onBackgroundUpdate && typeof onBackgroundUpdate === 'function') {
          try { onBackgroundUpdate(val); } catch (_) {}
        }
      }).catch(() => {});
      return rec.v;
    }

    const val = await loader();
    this.set(key, val, { ttlMs });
    return val;
  }
}

class CacheManager {
  constructor() { 
    this._nss = new Map(); 
    this._debug = false; 
  }

  namespace(name, opts) {
    if (!this._nss.has(name)) {
      this._nss.set(name, new NamespaceHandle(name, opts || {}));
    }
    return this._nss.get(name);
  }

  setDebug(enabled) { 
    this._debug = !!enabled; 
  }

  getStats() {
    const out = {};
    this._nss.forEach((ns, name) => {
      out[name] = { 
        ...ns.stats, 
        size: ns.mem.size, 
        persistent: ns.persistent, 
        maxItems: ns.maxItems 
      };
    });
    return out;
  }

  keys(name) { 
    const ns = this.namespace(name); 
    return ns && ns.keys ? ns.keys() : []; 
  }

  update(name, key, updater) { 
    const ns = this.namespace(name); 
    return ns && ns.update ? ns.update(key, updater) : false; 
  }

  // 清除所有命名空间
  clearAll() {
    this._nss.forEach((ns) => ns.clear());
    this._nss.clear();
  }
}

const singleton = new CacheManager();
export { singleton as cacheManager };
export default singleton;
