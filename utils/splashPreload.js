import { getOriginalPoems, peekOriginalPoems, getOriginalPoemsVersion, invalidateFollowingPoems, ORIGINAL_POEMS_PAGE_SIZE } from '@/api-cache/poems.js';
import { invalidatePostList } from '@/api-cache/post-list.js';
import { FEED_REFRESH_KEYS, consumeFeedRefreshFlags } from '@/utils/refresh-flags.js';
import { ensureRuntimeOpenid } from '@/utils/runtime-bootstrap.js';
import { getOpenid } from '@/utils/app-state.js';
import fileUrlCache from '@/cache/core/file-url.js';
import { withTimeout } from '@/utils/asyncTimeout.js';

let active = null;
let snapshot = null;
const DATA_BUDGET_MS = 5000;
const IMAGE_BUDGET_MS = 800;
const HANDOFF_TTL_MS = 30000;

function clonePosts(posts) {
  return posts.filter(Boolean).map(post => ({ ...post }));
}

function hasPendingRefresh() {
  return FEED_REFRESH_KEYS.some(key => uni.getStorageSync(key));
}

/** 在请求之前消费刷新标记；请求期间新产生的标记留给下一轮处理。 */
export function consumePoemSquareRefresh() {
  const flags = consumeFeedRefreshFlags();
  if (!Object.values(flags).some(Boolean)) return false;
  snapshot = null;
  invalidatePostList({ isPoem: true, isOriginal: true });
  invalidateFollowingPoems();
  return true;
}

function isCurrent(entry) {
  return snapshot === entry && entry.openid === (getOpenid() || '') &&
    !hasPendingRefresh() && Date.now() - entry.createdAt < HANDOFF_TTL_MS &&
    getOriginalPoemsVersion() === entry.version && (entry.inTransit || peekOriginalPoems() === entry.source);
}

function invalidatedPreload() {
  const error = new Error('启动数据已失效，重新准备首屏');
  error.code = 'SPLASH_PRELOAD_INVALIDATED';
  return error;
}

function readSignatureImage(url) {
  return new Promise(resolve => {
    if (typeof uni === 'undefined' || typeof uni.getImageInfo !== 'function') return resolve(url);
    uni.getImageInfo({ src: url, success: result => resolve(result.path || url), fail: () => resolve(url) });
  });
}

async function warmVisibleSignatures(entry) {
  // 折叠诗卡首屏展示文字与签名，并不显示帖子背景图或作者头像。
  const signatures = entry.posts.filter(post => !post.isAnonymous && typeof post.authorSignature === 'string' && post.authorSignature);
  const visible = signatures.filter(post => entry.posts.indexOf(post) < 2);
  const cloudIds = [...new Set(signatures.map(post => post.authorSignature).filter(url => url.startsWith('cloud://')))];
  const urls = cloudIds.length ? await fileUrlCache.getTempUrls(cloudIds) : {};
  if (!isCurrent(entry) || entry.claimed) return;
  signatures.forEach(post => { post.authorSignature = urls[post.authorSignature] || post.authorSignature; });
  await Promise.all(visible.map(async post => {
    const url = post.authorSignature;
    if (!/^https?:\/\//.test(url)) return;
    const localPath = await readSignatureImage(url);
    // 跳转或账号切换后，不再修改已经交付给页面的对象。
    if (isCurrent(entry) && !entry.claimed) post.authorSignature = localPath;
  }));
}

export function preloadPoemSquare(context) {
  if (active) return active;
  const task = (async () => {
    consumePoemSquareRefresh();
    if (snapshot && snapshot.openid !== (getOpenid() || '')) {
      invalidatePostList({ isPoem: true, isOriginal: true });
      snapshot = null;
    }
    const deadline = Date.now() + DATA_BUDGET_MS;
    let source = peekOriginalPoems();
    if (!Array.isArray(source)) {
      if (!getOpenid()) await withTimeout(ensureRuntimeOpenid(), DATA_BUDGET_MS, '启动认证超时');
      if (!getOpenid()) throw new Error('启动身份尚未就绪');
      const account = getOpenid();
      source = await getOriginalPoems({ page: 0, pageSize: ORIGINAL_POEMS_PAGE_SIZE, context,
        silent: true, timeoutMs: Math.max(1, deadline - Date.now()) });
      if (account !== getOpenid()) {
        invalidatePostList({ isPoem: true, isOriginal: true });
        throw invalidatedPreload();
      }
    }
    if (!Array.isArray(source)) throw new Error('启动列表格式无效');
    const entry = { source, posts: clonePosts(source), version: getOriginalPoemsVersion(),
      openid: getOpenid() || '', createdAt: Date.now(), claimed: false, inTransit: false };
    snapshot = entry;
    // 数据先交接；图片失效/超时不阻止显示已有文字。
    try { await withTimeout(warmVisibleSignatures(entry), IMAGE_BUDGET_MS, '首屏签名预热超时'); } catch (_) {}
    if (!isCurrent(entry)) throw invalidatedPreload();
    return { count: entry.posts.length };
  })();
  active = task;
  task.then(() => { if (active === task) active = null; }, () => { if (active === task) active = null; });
  return task;
}

/** 自动进入前复核，不能把已经过期/失效的 ready 状态带到目标页。 */
export function hasPoemSquarePreload() {
  return !!snapshot && !snapshot.claimed && isCurrent(snapshot);
}

/** 原生路由异步打开目标页，已确认的交接在短期内不受普通缓存到期影响。 */
export function retainPoemSquarePreload() {
  try {
    if (!hasPoemSquarePreload()) return false;
    snapshot.inTransit = true;
    return true;
  } catch (_) {
    // 手动进入/超时兜底不能被存储读取异常阻断。
    return false;
  }
}

/** 目标页 onLoad 同步接收，避免进入后先显示骨架再等待一轮异步处理。 */
export function takePoemSquarePreload() {
  const entry = snapshot;
  if (!hasPoemSquarePreload()) return null;
  entry.claimed = true;
  return clonePosts(entry.posts);
}
