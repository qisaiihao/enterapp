const { cloudCall } = require('./cloudCall.js');

let queue = [];
let started = false;
let timer = null;

function getSessionId() {
  try {
    if (typeof uni !== 'undefined' && uni.getStorageSync) {
      let sid = uni.getStorageSync('sessionId');
      if (!sid) {
        sid = Math.random().toString(36).slice(2) + Date.now().toString(36);
        uni.setStorageSync('sessionId', sid);
      }
      return sid;
    }
  } catch (_) {}
  return 's';
}

function enqueueView(postId, duration) {
  if (!postId) return;
  const now = Date.now();
  queue.push({ postId, ts: now, sessionId: getSessionId(), duration: Number(duration || 0) || 0 });
  // 懒启动自动 flush
  if (!started) start();
}

async function flush() {
  if (!queue.length) return { success: true, count: 0 };
  const batch = queue.splice(0, 50);
  try {
    const res = await cloudCall('recordEventBatch', { events: batch }, { pageTag: 'viewEvents', retry: 1 });
    return res && res.result ? res.result : { success: true, count: batch.length };
  } catch (e) {
    // 失败回退：合并回队列前端重试
    queue = batch.concat(queue);
    return { success: false, error: e };
  }
}

function start() {
  started = true;
  if (typeof setInterval === 'function' && !timer) {
    timer = setInterval(() => { flush(); }, 10000);
  }
  try { if (typeof uni !== 'undefined' && typeof uni.onHide === 'function') { uni.onHide(() => { flush(); }); } } catch (_) {}
}

module.exports = {
  enqueueView,
  flushViewQueue: flush,
  startViewEventAutoFlush: start
};

