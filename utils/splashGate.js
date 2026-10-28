export const SPLASH_MIN_MS = 1500;
export const SPLASH_MAX_MS = 6000;
export const SPLASH_EXIT_MS = 200;

/** 动画与网络各自推进；所有出口共享一次性导航和独立的截止定时器。 */
export function createSplashGate({ onLeaving, onNavigate, minMs = SPLASH_MIN_MS,
  maxMs = SPLASH_MAX_MS, exitMs = SPLASH_EXIT_MS,
  isReady = () => true, onNotReady = () => {},
  canAutoEnter = () => true, onAutoEnterBlocked = () => {} }) {
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
  function checkAutoEnter(reason) {
    // 正常自动进入等待登录恢复，超时和手动入口始终可以放行。
    if (reason !== 'ready') return true;
    try {
      if (canAutoEnter()) return true;
    } catch (_) {
      // 状态读取失败不能当作正常就绪，仍保留独立的 6 秒出口。
    }
    settled = false;
    leaving = false;
    onAutoEnterBlocked();
    // ready 淡出可能跨过截止回调，恢复等待时不能吞掉超时出口。
    if (!disposed && Date.now() - startedAt >= maxMs - exitMs) leave('timeout');
    return false;
  }
  function checkReady(reason, navigating = false) {
    if (reason !== 'ready') return true;
    try {
      if (isReady({ navigating })) return true;
    } catch (_) {
      // 存储/缓存检查异常也视为未就绪，不能让淡出状态锁死超时出口。
    }
    // 首批数据在打字或淡出期间失效，允许页面重新准备，但不重置总截止时间。
    settled = false;
    leaving = false;
    onNotReady();
    // 截止回调可能已在 ready 淡出期间触发过，不能因此丢失 6 秒兜底。
    if (!disposed && Date.now() - startedAt >= maxMs - exitMs) leave('timeout');
    return false;
  }
  function leave(reason, immediate = false) {
    if (leaving || disposed) return;
    if (!checkAutoEnter(reason) || disposed) return;
    if (!checkReady(reason) || disposed) return;
    leaving = true;
    onLeaving({ reason, elapsedMs: Date.now() - startedAt });
    const navigate = () => {
      if (disposed || !checkAutoEnter(reason)) return;
      if (disposed || !checkReady(reason, true)) return;
      dispose();
      onNavigate({ reason, elapsedMs: Date.now() - startedAt });
    };
    if (disposed) return;
    if (immediate) navigate();
    else {
      const elapsedMs = Date.now() - startedAt;
      schedule(navigate, Math.min(exitMs, Math.max(0, maxMs - elapsedMs)));
    }
  }
  // 登录或首批请求无论是否完成，都由独立计时器在 6 秒内强制进入。
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
