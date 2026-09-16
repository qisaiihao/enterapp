const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
process.env.NODE_ENV = 'production';
const { createRenderer, nextTick } = require('vue');
const timers = new Map();
const dismissers = new Set();
let now = 0;
let timerId = 0;
function advance(ms) {
  now += ms;
  for (const [id, timer] of [...timers]) {
    if (timer.at <= now) {
      timers.delete(id);
      timer.callback();
    }
  }
}
const source = fs.readFileSync(path.join(__dirname, '../components/overlay/AppActionSheet.vue'), 'utf8')
  .match(/<script>([\s\S]*?)<\/script>/)[1];
const context = {
  module: { exports: {} },
  setTimeout(callback, delay) { const id = ++timerId; timers.set(id, { callback, at: now + delay }); return id; },
  clearTimeout(id) { timers.delete(id); },
  resolveOverlayOwner: () => ({}),
  registerOverlayDismiss(owner, dismiss) { dismissers.add(dismiss); return () => dismissers.delete(dismiss); },
  isDangerousOverlayAction: () => false
};
vm.runInNewContext(source.replace(/^import .*;\r?$/gm, '').replace('export default', 'module.exports ='), context);
const sheet = context.module.exports;
const renderer = createRenderer({
  createElement: () => ({}), createText: () => ({}), createComment: () => ({}),
  insert() {}, remove() {}, setText() {}, setElementText() {}, patchProp() {},
  parentNode() {}, nextSibling() {}
});

async function main() {
  const events = [];
  const app = renderer.createApp({
    ...sheet, props: undefined, render: () => null,
    data: () => ({ ...sheet.data(), visible: true, variant: 'plain', items: ['编辑', '删除'] })
  }, {
    onSelect(index) {
      assert.equal(dismissers.size, 0, 'release back interception before callbacks can navigate');
      events.push(['select', index]);
    },
    onCancel() { events.push(['cancel']); }
  });
  const instance = app.mount({});
  assert.equal(instance.rendered, true);
  assert.equal(instance.motion, 'enter');
  instance.answer('select', 0);
  instance.answer('select', 1);
  for (const dismiss of dismissers) dismiss();
  assert.equal(instance.motion, 'leave');
  advance(179);
  assert.equal(instance.rendered, true, 'retain the sheet until slide-out completes');
  assert.equal(dismissers.size, 1, 'back cannot reach the underlying page mid-animation');
  assert.deepEqual(events, [], 'do not open the next panel while the old panel is closing');
  advance(1);
  assert.equal(instance.rendered, false);
  assert.deepEqual(events, [['select', 0]], 'repeated taps/back still execute only the first action');

  instance.visible = false;
  await nextTick();
  instance.visible = true;
  await nextTick();
  instance.visible = false;
  await nextTick();
  advance(90);
  instance.visible = true;
  await nextTick();
  advance(200);
  assert.equal(instance.rendered, true, 'old close timers cannot hide a reopened sheet');
  assert.equal(instance.motion, 'enter');
  assert.equal(timers.size, 0);

  instance.answer('select', 1);
  instance.visible = false;
  await nextTick();
  advance(180);
  assert.deepEqual(events, [['select', 0]], 'external close cancels a queued destructive action');

  instance.visible = true;
  await nextTick();
  instance.answer('cancel');
  advance(180);
  assert.deepEqual(events, [['select', 0], ['cancel']], 'cancel also waits for its close animation');
  instance.visible = false;
  await nextTick();
  instance.visible = true;
  await nextTick();
  instance.answer('select', 1);
  app.unmount();
  advance(500);
  assert.equal(timers.size, 0);
  assert.equal(dismissers.size, 0);
  assert.deepEqual(events, [['select', 0], ['cancel']], 'unmount cancels pending actions and timers');
  console.log('[test-sheet-motion] PASS: delayed actions, duplicate taps/back, quick reopen, external close and unmount cleanup');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
