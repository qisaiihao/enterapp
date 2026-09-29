export const SPLASH_MIN_MS = 1500;
export const SPLASH_MAX_MS = 6000;
export const SPLASH_EXIT_MS = 200;

/** 动画与网络各自推进；所有出口共享一次性导航和独立的截止定时器。 */
export function createSplashGate({ onLeaving, onNavigate, minMs = SPLASH_MIN_MS,
  maxMs = SPLASH_MAX_MS, exitMs = SPLASH_EXIT_MS }) {
  const startedAt = Date.now();
  let settled = false;
  let disposed = false;
  let leaving = false;
  const timers = new Set();
  function schedule(callback, delay) {
    const timer = setTimeout(() => {
      timers.delete(timer);
      if (!disposed) callback();
    }, Math.max(0, delay));
    timers.add(timer);
  }
  function dispose() {
    disposed = true;
    timers.forEach(clearTimeout);
    timers.clear();
  }
  function leave(reason, immediate = false) {
    if (leaving || disposed) return;
    leaving = true;
    onLeaving({ reason, elapsedMs: Date.now() - startedAt });
    const navigate = () => {
      dispose();
      onNavigate({ reason, elapsedMs: Date.now() - startedAt });
    };
    if (immediate) navigate();
    else schedule(navigate, Math.min(exitMs, Math.max(0, maxMs - (Date.now() - startedAt))));
  }
  // 不依赖认证、图片回调或 Promise 能否正常返回。
  schedule(() => leave('timeout'), maxMs - exitMs);
  return {
    settle(reason = 'ready') {
      if (settled || disposed || leaving) return;
      settled = true;
      schedule(() => leave(reason), minMs - (Date.now() - startedAt));
    },
    skip() { leave('manual', true); },
    dispose
  };
}
