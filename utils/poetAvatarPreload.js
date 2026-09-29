import fileUrlCache from '@/cache/core/file-url.js';
import { withTimeout } from '@/utils/asyncTimeout.js';

// 临时图片路径只在本次运行内复用，不写入持久化诗人列表。
const warmed = new Map();
const MAX_AVATARS = 50;
const IMAGE_TIMEOUT_MS = 5000;

export function preparePoetAvatars(poets = []) {
  return poets.filter(Boolean).map(poet => ({
    ...poet,
    avatar: warmed.get(poet.avatar) || poet.avatar,
    sourceAvatar: poet.avatar
  }));
}

export function forgetPoetAvatar(source) {
  warmed.delete(source);
}

export async function warmPoetAvatars(poets, isCurrent = () => true) {
  if (typeof uni === 'undefined' || typeof uni.getImageInfo !== 'function') return;
  const sources = [...new Set(poets.filter(Boolean).map(poet => poet.avatar)
    .filter(source => typeof source === 'string' && /^(https?:\/\/|cloud:\/\/)/.test(source)))].slice(0, MAX_AVATARS);
  const cloudIds = sources.filter(source => source.startsWith('cloud://'));
  let urls = {};
  if (cloudIds.length) {
    try { urls = await withTimeout(fileUrlCache.getTempUrls(cloudIds), IMAGE_TIMEOUT_MS); } catch (_) {}
  }
  let next = 0;
  async function worker() {
    while (isCurrent() && next < sources.length) {
      const source = sources[next++];
      if (warmed.has(source)) continue;
      const url = urls[source] || source;
      if (!/^https?:\/\//.test(url)) continue;
      try {
        const result = await withTimeout(new Promise((resolve, reject) => {
          uni.getImageInfo({ src: url, success: resolve, fail: reject });
        }), IMAGE_TIMEOUT_MS);
        if (isCurrent() && result.path) {
          warmed.set(source, result.path);
          if (warmed.size > MAX_AVATARS) warmed.delete(warmed.keys().next().value);
        }
      } catch (error) {
        // 超时的底层图片任务可能仍在运行，停止此 worker，避免继续增加并发。
        if (error && error.code === 'TIMEOUT') return;
      }
    }
  }
  // 按头像栏顺序下载，先覆盖可见头像，最多同时加载两张。
  await Promise.all([worker(), worker()]);
}
