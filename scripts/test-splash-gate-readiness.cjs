const assert = require('node:assert/strict');
const { load, fakeTime } = require('./test-splash-startup.cjs');

function runtime() {
  const time = fakeTime(), events = [];
  let ready = true;
  let readinessError = null;
  let autoEnterAllowed = true;
  let autoEnterError = null;
  const { createSplashGate } = load('utils/splashGate.js', time.globals, ['createSplashGate']);
  const gate = createSplashGate({
    canAutoEnter: () => {
      if (autoEnterError) throw autoEnterError;
      return autoEnterAllowed;
    },
    onAutoEnterBlocked: () => events.push({ type: 'auto-blocked', elapsedMs: time.now() - 10000 }),
    isReady: () => {
      if (readinessError) throw readinessError;
      return ready;
    },
    onNotReady: () => events.push({ type: 'not-ready', elapsedMs: time.now() - 10000 }),
    onLeaving: event => events.push({ type: 'leave', ...event }),
    onNavigate: event => events.push({ type: 'navigate', ...event })
  });
  return { time, events, gate, setReady: value => { ready = value; },
    setReadinessError: value => { readinessError = value; },
    setAutoEnterAllowed: value => { autoEnterAllowed = value; },
    setAutoEnterError: value => { autoEnterError = value; } };
}

async function testInvalidatedWhileTyping() {
  const app = runtime();
  app.gate.settle();
  await app.time.tick(1000);
  app.setReady(false);
  await app.time.tick(500);
  assert.deepEqual(app.events, [{ type: 'not-ready', elapsedMs: 1500 }], '打字期间失效不得开始自动离场');
  await app.time.tick(500);
  app.setReady(true);
  app.gate.settle();
  await app.time.tick(200);
  assert.equal(app.events.at(-1).type, 'navigate');
  assert.equal(app.events.at(-1).reason, 'ready');
  assert.equal(app.events.at(-1).elapsedMs, 2200);
  await app.time.tick(10000);
  assert.equal(app.events.filter(event => event.type === 'navigate').length, 1);
  assert.equal(app.time.pending(), 0);
}

async function testInvalidatedWhileFading() {
  const app = runtime();
  app.gate.settle();
  await app.time.tick(1600);
  assert.equal(app.events[0].type, 'leave');
  app.setReady(false);
  await app.time.tick(100);
  assert.equal(app.events.at(-1).type, 'not-ready', '淡出期间失效不得继续 ready 导航');
  assert.equal(app.events.filter(event => event.type === 'navigate').length, 0);
  app.setReady(true);
  app.gate.settle();
  await app.time.tick(200);
  assert.equal(app.events.at(-1).reason, 'ready');
  assert.equal(app.events.at(-1).elapsedMs, 1900);
  assert.equal(app.time.pending(), 0);
}

async function testOriginalDeadlineSurvivesInvalidation() {
  for (const settledAt of [0, 5600, 5700, 5799]) {
    const app = runtime();
    await app.time.tick(settledAt);
    app.gate.settle();
    await app.time.tick(Math.max(1500 - settledAt, 0));
    app.setReady(false);
    await app.time.tick(10000);
    const navigations = app.events.filter(event => event.type === 'navigate');
    assert.equal(navigations.length, 1);
    assert.equal(navigations[0].reason, 'timeout');
    assert.equal(navigations[0].elapsedMs, 6000, '重新准备数据不能延长原来的 6 秒截止时间');
    assert.equal(app.time.pending(), 0);
  }
}

async function testExplicitExitsBypassReadiness() {
  for (const manual of [false, true]) {
    const app = runtime();
    app.setReady(false);
    if (manual) app.gate.skip();
    await app.time.tick(10000);
    assert.equal(app.events.some(event => event.type === 'not-ready'), false);
    const navigations = app.events.filter(event => event.type === 'navigate');
    assert.equal(navigations.length, 1);
    assert.equal(navigations[0].reason, manual ? 'manual' : 'timeout');
    assert.equal(navigations[0].elapsedMs, manual ? 0 : 6000);
  }
}

async function testDisposeAfterInvalidation() {
  for (const disposeAt of [1000, 1600, 1700]) {
    const app = runtime();
    app.gate.settle();
    if (disposeAt >= 1600) await app.time.tick(1500);
    app.setReady(false);
    await app.time.tick(disposeAt - (app.time.now() - 10000));
    app.gate.dispose();
    const count = app.events.length;
    app.setReady(true);
    app.gate.settle();
    app.gate.skip();
    await app.time.tick(10000);
    assert.equal(app.events.length, count, '卸载后不得重新检查、恢复或导航');
    assert.equal(app.time.pending(), 0);
  }
}

async function testRepeatedInvalidationKeepsDeadline() {
  const app = runtime();
  app.gate.settle();
  await app.time.tick(1500);
  for (let attempt = 0; attempt < 3; attempt += 1) {
    app.setReady(false);
    await app.time.tick(200);
    assert.equal(app.events.at(-1).type, 'not-ready');
    app.setReady(true);
    app.gate.settle();
    await app.time.tick(0);
  }
  app.setReady(false);
  await app.time.tick(10000);
  const navigations = app.events.filter(event => event.type === 'navigate');
  assert.equal(navigations.length, 1);
  assert.equal(navigations[0].elapsedMs, 6000, '连续失效也只能使用同一个启动预算');
  assert.equal(navigations[0].reason, 'timeout');
  assert.equal(app.time.pending(), 0);
}

async function testReadinessErrorDuringFade() {
  for (const readyAt of [0, 5700]) {
    const app = runtime();
    await app.time.tick(readyAt);
    app.gate.settle();
    await app.time.tick(Math.max(1500 - readyAt, 0));
    assert.equal(app.events.at(-1).type, 'leave');
    app.setReadinessError(new Error('storage unavailable'));
    await app.time.tick(200);
    assert.ok(app.events.some(event => event.type === 'not-ready'), '检查抛错也要释放 ready 离场状态');
    assert.equal(app.events.filter(event => event.type === 'navigate').length, 0);
    await app.time.tick(10000);
    const navigations = app.events.filter(event => event.type === 'navigate');
    assert.equal(navigations.length, 1);
    assert.equal(navigations[0].reason, 'timeout');
    assert.equal(navigations[0].elapsedMs, 6000, '淡出后检查抛错不能丢失原始 6 秒兜底');
    assert.equal(app.time.pending(), 0);
  }
}

async function testReadinessRecoversAfterError() {
  const app = runtime();
  app.gate.settle();
  await app.time.tick(1500);
  app.setReadinessError(new Error('storage unavailable'));
  await app.time.tick(200);
  app.setReadinessError(null);
  app.gate.settle();
  await app.time.tick(200);
  const navigations = app.events.filter(event => event.type === 'navigate');
  assert.equal(navigations.length, 1);
  assert.equal(navigations[0].reason, 'ready');
  assert.equal(navigations[0].elapsedMs, 1900, '检查恢复后继续正常 ready 出口');
  await app.time.tick(10000);
  assert.equal(app.events.filter(event => event.type === 'navigate').length, 1);
  assert.equal(app.time.pending(), 0);
}

async function testLoginPendingOnlyBlocksNormalEntry() {
  const app = runtime();
  app.setAutoEnterAllowed(false);
  app.gate.settle();
  await app.time.tick(5799);
  assert.deepEqual(app.events, [
    { type: 'auto-blocked', elapsedMs: 1500 }
  ], '首批已好但登录仍在恢复，正常入口必须等待');
  await app.time.tick(1);
  assert.equal(app.events.at(-1).type, 'leave');
  assert.equal(app.events.at(-1).reason, 'timeout');
  await app.time.tick(199);
  assert.equal(app.events.filter(event => event.type === 'navigate').length, 0);
  await app.time.tick(1);
  assert.equal(app.events.at(-1).type, 'navigate');
  assert.equal(app.events.at(-1).elapsedMs, 6000, '登录一直未完成也必须在原6秒强制进入');
  assert.equal(app.time.pending(), 0);
  await app.time.tick(1000);
  app.setAutoEnterAllowed(true);
  app.gate.settle();
  app.gate.skip();
  await app.time.tick(10000);
  assert.equal(app.events.filter(event => event.type === 'navigate').length, 1, '迟到登录或按钮不能再次导航');
}

async function testLoginReadyBeforeDeadline() {
  const app = runtime();
  app.setAutoEnterAllowed(false);
  app.gate.settle();
  await app.time.tick(2000);
  app.setAutoEnterAllowed(true);
  app.setReady(false);
  app.gate.settle();
  await app.time.tick(0);
  assert.equal(app.events.filter(event => event.type === 'leave').length, 0,
    '登录状态完成后，首批未就绪仍不能正常自动进入');
  assert.equal(app.events.at(-1).type, 'not-ready');
  app.setReady(true);
  app.gate.settle();
  await app.time.tick(200);
  assert.equal(app.events.at(-1).reason, 'ready');
  assert.equal(app.events.at(-1).elapsedMs, 2200);
}

async function testLoginRecoveryNearDeadline() {
  for (const readyAt of [5700, 5799, 5800, 5900, 6000, 7000]) {
    const app = runtime();
    app.setAutoEnterAllowed(false);
    app.gate.settle();
    await app.time.tick(readyAt);
    app.setAutoEnterAllowed(true);
    app.gate.settle();
    await app.time.tick(10000);
    const navigations = app.events.filter(event => event.type === 'navigate');
    assert.equal(navigations.length, 1);
    assert.equal(navigations[0].reason, readyAt < 5800 ? 'ready' : 'timeout');
    assert.equal(navigations[0].elapsedMs, readyAt < 5800 ? readyAt + 200 : 6000,
      '截止附近或迟到的登录结果不得将原6秒上限延后');
    assert.equal(app.time.pending(), 0);
  }
}

async function testLoginResetsDuringFade() {
  for (const firstExit of ['ready', 'timeout']) {
    const app = runtime();
    if (firstExit === 'ready') app.gate.settle();
    await app.time.tick(firstExit === 'ready' ? 1500 : 5800);
    assert.equal(app.events.at(-1).type, 'leave');
    app.setAutoEnterAllowed(false);
    await app.time.tick(200);
    if (firstExit === 'ready') {
      assert.equal(app.events.at(-1).type, 'auto-blocked', '正常离场期间登录重置必须取消ready导航');
      assert.equal(app.events.filter(event => event.type === 'navigate').length, 0);
    } else {
      assert.equal(app.events.at(-1).type, 'navigate', '强制进入的淡出期间登录重置也不能阻止导航');
      assert.equal(app.events.at(-1).elapsedMs, 6000);
      assert.equal(app.events.some(event => event.type === 'auto-blocked'), false);
    }
    app.setAutoEnterAllowed(true);
    app.gate.settle();
    await app.time.tick(200);
    const navigations = app.events.filter(event => event.type === 'navigate');
    assert.equal(navigations.length, 1);
    assert.equal(navigations[0].reason, firstExit);
    assert.equal(navigations[0].elapsedMs, firstExit === 'ready' ? 1900 : 6000);
    await app.time.tick(10000);
    assert.equal(app.events.filter(event => event.type === 'navigate').length, 1);
  }
}

async function testLateLoginResetKeepsHardDeadline() {
  for (const readyAt of [5600, 5700, 5799]) {
    const app = runtime();
    await app.time.tick(readyAt);
    app.gate.settle();
    await app.time.tick(0);
    assert.equal(app.events.at(-1).reason, 'ready');
    await app.time.tick(Math.min(5900 - readyAt, 199));
    app.setAutoEnterAllowed(false);
    await app.time.tick(6000 - (app.time.now() - 10000));
    const navigations = app.events.filter(event => event.type === 'navigate');
    assert.ok(app.events.some(event => event.type === 'auto-blocked'), '正常淡出末尾必须重新检查登录状态');
    assert.equal(navigations.length, 1, 'ready失败不能吞掉已经触发过的截止定时器');
    assert.equal(navigations[0].reason, 'timeout');
    assert.equal(navigations[0].elapsedMs, 6000);
    app.setAutoEnterAllowed(true);
    app.gate.settle();
    await app.time.tick(10000);
    assert.equal(app.events.filter(event => event.type === 'navigate').length, 1);
    assert.equal(app.time.pending(), 0);
  }
}

async function testResolvedGuestAndManualEntry() {
  const guest = runtime();
  guest.setAutoEnterAllowed(true); // 门禁只关心登录状态是否已确认，确认访客也允许。
  guest.gate.settle();
  await guest.time.tick(1700);
  assert.equal(guest.events.at(-1).reason, 'ready');
  const manual = runtime();
  manual.setAutoEnterAllowed(false);
  manual.setReady(false);
  await manual.time.tick(1500);
  manual.gate.skip();
  assert.equal(manual.events.at(-1).reason, 'manual');
  assert.equal(manual.events.at(-1).elapsedMs, 1500);
  assert.equal(manual.events.some(event => event.type === 'auto-blocked'), false);
  await manual.time.tick(10000);
  assert.equal(manual.events.filter(event => event.type === 'navigate').length, 1);
}

async function testBlockedAutoEntryDisposalAndError() {
  for (const dispose of [false, true]) {
    const app = runtime();
    app.setAutoEnterError(new Error('state unavailable'));
    app.gate.settle();
    await app.time.tick(1700);
    assert.equal(app.events.filter(event => event.type === 'navigate').length, 0,
      '登录状态检查异常不能当作已确认并正常自动进入');
    if (dispose) app.gate.dispose();
    const count = app.events.length;
    await app.time.tick(10000);
    if (dispose) {
      assert.equal(app.events.length, count, '卸载后恢复登录不得重启导航');
      assert.equal(app.time.pending(), 0);
    } else {
      assert.equal(app.events.at(-1).type, 'navigate');
      assert.equal(app.events.at(-1).reason, 'timeout');
      assert.equal(app.events.at(-1).elapsedMs, 6000, '登录检查持续抛错也不能阻止6秒强制进入');
      assert.equal(app.time.pending(), 0);
    }
    app.setAutoEnterError(null);
    app.gate.settle();
    app.gate.skip();
    await app.time.tick(10000);
    assert.equal(app.events.filter(event => event.type === 'navigate').length, dispose ? 0 : 1,
      '迟到状态恢复不重启已卸载或已完成的控制器');
  }
}

async function testTimeoutBypassesBothFailedChecks() {
  for (const throwError of [false, true]) {
    const app = runtime();
    app.setAutoEnterAllowed(false);
    app.setReady(false);
    if (throwError) {
      app.setAutoEnterError(new Error('login restoration failed'));
      app.setReadinessError(new Error('first page unavailable'));
    }
    await app.time.tick(6000);
    const navigations = app.events.filter(event => event.type === 'navigate');
    assert.equal(navigations.length, 1);
    assert.equal(navigations[0].reason, 'timeout');
    assert.equal(navigations[0].elapsedMs, 6000, '登录与首批都未完成/失败也必须强制进入');
    assert.equal(app.events.some(event => ['auto-blocked', 'not-ready'].includes(event.type)), false,
      'timeout不调用正常进入的登录与帖子检查');
    assert.equal(app.time.pending(), 0);
  }
}

(async () => {
  for (const test of [testInvalidatedWhileTyping, testInvalidatedWhileFading,
    testOriginalDeadlineSurvivesInvalidation, testExplicitExitsBypassReadiness,
    testDisposeAfterInvalidation, testRepeatedInvalidationKeepsDeadline,
    testReadinessErrorDuringFade, testReadinessRecoversAfterError,
    testLoginPendingOnlyBlocksNormalEntry, testLoginReadyBeforeDeadline, testLoginRecoveryNearDeadline,
    testLoginResetsDuringFade, testLateLoginResetKeepsHardDeadline, testResolvedGuestAndManualEntry,
    testBlockedAutoEntryDisposalAndError, testTimeoutBypassesBothFailedChecks]) {
    await test();
    console.log('PASS ' + test.name);
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
