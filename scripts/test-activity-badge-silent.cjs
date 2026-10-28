const assert = require('node:assert/strict');
const { load } = require('./test-splash-startup.cjs');

async function testActivityBadgeSilentRefresh() {
  const storage = new Map([
    ['activityBadge:lastSeenToken', 'id:old'],
    ['activityBadge:latestToken', 'id:new']
  ]);
  const toasts = [], calls = [], events = [], writes = [];
  let offline = true;
  const uni = {
    getStorageSync: key => storage.get(key),
    setStorageSync: (key, value) => { storage.set(key, value); writes.push(key); },
    removeStorageSync: key => storage.delete(key),
    showToast: options => toasts.push(options.title),
    $emit: (...args) => events.push(args),
    $tcb: {
      async callFunction() {
        if (offline) throw new Error('offline');
        return { result: { success: true, activities: [{ _id: 'new' }] } };
      }
    }
  };
  const cloud = load('utils/cloudCall.js', {
    uni, getCloudFunctionMethod: () => 'tcb',
    auth: { getOpenId: async () => 'viewer' },
    formatErrorForLog: String, prepareCloudPostImages() {},
    resolveCloudPostImages: async (_, response) => response,
    isLoginAuditRequest: () => false
  }, ['cloudCall']);
  const cacheManager = load('cache/core/manager.js', { uni });
  const activities = load('api-cache/activities.js', {
    cacheManager,
    cloudCall: (...args) => { calls.push(args); return cloud.cloudCall(...args); }
  }, ['getRecentActivities']);
  const badge = load('cache/stores/activity-badge.js', {
    uni, ...activities, formatErrorForLog: String
  });

  assert.equal(await badge.initActivityBadge(), true, '初始化失败保留本地已有红点');
  assert.equal(calls[0][2].silent, true, '红点后台请求透传 silent');
  assert.equal(toasts.length, 0, '后台失败不弹网络错误');
  assert.equal(storage.get('activityBadge:latestToken'), 'id:new');
  assert.equal(storage.get('activityBadge:lastSeenToken'), 'id:old');
  assert.equal(writes.length, 0, '失败不清空或覆盖已保存的活动状态');
  assert.equal(events.length, 0, '失败不广播错误的红点变化');

  await assert.rejects(activities.getRecentActivities(), error => error.code === 'CLOUD_CALL_FAILED');
  assert.equal(calls[1][2].silent, false, '活动页面正常加载保持默认错误提示');
  assert.equal(toasts.length, 1, '活动页面网络失败仍提示');

  await badge.refreshActivityBadge({ forceRefresh: true });
  assert.equal(calls[2][2].silent, true, '强制刷新红点仍为静默请求');
  assert.equal(badge.getHasNewActivity(), true);
  assert.equal(toasts.length, 1);

  offline = false;
  assert.equal(await badge.refreshActivityBadge(), true, '失败后允许正常重试');
  const totalCalls = calls.length;
  assert.equal(await badge.refreshActivityBadge(), true);
  assert.equal(calls.length, totalCalls, '成功结果继续复用活动缓存');
  badge.markActivitySeen();
  assert.equal(badge.getHasNewActivity(), false, '读取活动后仍可正常清除红点');
}

testActivityBadgeSilentRefresh().then(() => {
  console.log('PASS testActivityBadgeSilentRefresh');
}).catch(error => { console.error(error); process.exitCode = 1; });
