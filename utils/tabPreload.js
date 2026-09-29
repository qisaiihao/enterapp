import { getPoetList } from '@/api-cache/poet.js';
import { getMountainPoems } from '@/api-cache/poems.js';
import { getHomePosts } from '@/api-cache/home-posts.js';
import { getOpenid } from '@/utils/app-state.js';
import { warmPoetAvatars } from '@/utils/poetAvatarPreload.js';
import { hydrateTempUrls } from '@/cache/core/hydrate.js';
import { withTimeout } from '@/utils/asyncTimeout.js';

let scheduled = false;
const REQUEST_TIMEOUT_MS = 8000;

async function runBackgroundPreload(account) {
  const isCurrent = () => getOpenid() === account;
  const options = { silent: true, timeoutMs: REQUEST_TIMEOUT_MS };
  if (!isCurrent()) return;
  // 优先准备诗人选择栏；图片与后续列表并行，互不等待。
  try {
    const poets = await withTimeout(getPoetList({ limit: 50, ...options }), REQUEST_TIMEOUT_MS);
    if (isCurrent()) warmPoetAvatars(poets, isCurrent).catch(() => {});
  } catch (_) {}

  for (const load of [
    () => getMountainPoems({ page: 0, pageSize: 10, ...options }),
    () => {
      let normalOnly = false;
      try {
        const saved = uni.getStorageSync('homeShowNormalPostsOnly');
        if (typeof saved === 'boolean') normalOnly = saved;
      } catch (_) {}
      return getHomePosts({ page: 0, pageSize: 10, ...options,
        ...(normalOnly ? { isPoem: false, isDiscussion: false } : {}) });
    }
  ]) {
    if (!isCurrent()) return;
    try {
      const posts = await withTimeout(load(), REQUEST_TIMEOUT_MS);
      if (!isCurrent()) return;
      // 仅预热地址缓存，不改写持久列表；页面后续处理可复用这些地址。
      withTimeout(hydrateTempUrls(posts.filter(Boolean).map(post => ({ ...post }))), REQUEST_TIMEOUT_MS).catch(() => {});
    } catch (_) {
      // 某一页失败不影响后续页，也不向用户弹出后台错误。
    }
  }
}

/** 广场首屏加载结束后调用。只调度，不返回需要页面等待的 Promise。 */
export function scheduleTabPreload() {
  if (scheduled) return;
  const account = getOpenid();
  if (!account) return;
  scheduled = true;
  // 留出首帧渲染时间；不持有页面实例，切换页面后仍可继续。
  setTimeout(() => { runBackgroundPreload(account).catch(() => {}); }, 800);
}
