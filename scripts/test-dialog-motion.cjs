const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createRenderer, nextTick } = require('vue');
const renderer = createRenderer({
  createElement: () => ({}), createText: () => ({}), createComment: () => ({}),
  insert() {}, remove() {}, setText() {}, setElementText() {}, patchProp() {}, parentNode() {}, nextSibling() {}
});
function fixture(file, initial, listeners) {
  const timers = new Map(), dismissers = new Set();
  let now = 0, id = 0;
  const context = {
    module: { exports: {} },
    setTimeout(callback, delay) { timers.set(++id, { callback, at: now + delay }); return id; },
    clearTimeout(id) { timers.delete(id); },
    resolveOverlayOwner: () => ({}),
    registerOverlayDismiss(owner, fn) { dismissers.add(fn); return () => dismissers.delete(fn); }
  };
  const source = fs.readFileSync(path.join(__dirname, '..', file), 'utf8').match(/<script>([\s\S]*?)<\/script>/)[1];
  vm.runInNewContext(source.replace(/^import .*;\r?$/gm, '').replace('export default', 'module.exports ='), context);
  const definition = context.module.exports;
  const app = renderer.createApp({ ...definition, props: undefined, render: () => null,
    data: () => ({ ...definition.data(), ...initial }) }, listeners);
  const instance = app.mount({});
  return { instance, app, timers, dismissers, advance(ms) {
    now += ms;
    for (const [key, timer] of [...timers]) if (timer.at <= now) { timers.delete(key); timer.callback(); }
  } };
}
async function verify(file, dialog) {
  let events = 0;
  const f = fixture(file, { visible: true, busy: false, showCancel: true, deferAnswer: true, initialValue: '保留输入' },
    dialog ? { onConfirm: () => { assert.equal(f.dismissers.size, 0); events++; } } :
      { onDismiss: () => { assert.equal(f.dismissers.size, 0); events++; } });
  const i = f.instance;
  const close = () => dialog ? i.answer('confirm') : i.dismiss();
  assert.equal(i.rendered, true);
  i.busy = true; await nextTick(); close();
  assert.equal(i.motion, 'enter', 'busy dialogs cannot start closing');
  i.busy = false; await nextTick(); close(); close();
  for (const dismiss of f.dismissers) dismiss();
  f.advance(119);
  assert.equal(events, 0);
  assert.equal(i.rendered, true);
  assert.equal(f.dismissers.size, 1, 'physical back is intercepted throughout exit');
  if (dialog) assert.equal(i.inputValue, '保留输入');
  f.advance(1);
  assert.equal(i.rendered, false);
  assert.equal(events, 1, 'duplicate taps/back submit exactly once after 120ms');
  i.visible = false; await nextTick(); i.visible = true; await nextTick();
  close(); i.visible = false; await nextTick(); f.advance(120);
  assert.equal(events, 1, 'external close cancels deferred callbacks');
  i.visible = true; await nextTick(); close();
  i.visible = false; await nextTick(); f.advance(60);
  i.visible = true; await nextTick(); f.advance(120);
  assert.equal(i.rendered, true, 'stale timer cannot hide a reopened form');
  assert.equal(i.motion, 'enter');
  assert.equal(events, 1);
  if (!dialog) {
    let skip = 0;
    i.dismiss(() => { skip++; }); f.advance(120);
    assert.equal(skip, 1, 'register skip runs only after form exit');
    assert.equal(events, 1, 'custom action does not also fire cancel');
    i.visible = false; await nextTick(); i.visible = true; await nextTick();
  }
  close(); f.app.unmount(); f.advance(500);
  assert.equal(events, 1, 'unmount cancels pending work');
  assert.equal(f.timers.size, 0);
  assert.equal(f.dismissers.size, 0);
}
async function main() {
  await verify('components/overlay/AppDialog.vue', true);
  await verify('components/overlay/AppMotion.vue', false);
  let confirms = 0;
  const f = fixture('components/overlay/AppDialog.vue', { visible: true, busy: false, deferAnswer: false }, { onConfirm: () => confirms++ });
  f.instance.answer('confirm');
  assert.equal(confirms, 1, 'controlled forms submit without an animation delay');
  f.instance.busy = true; await nextTick(); f.instance.busy = false; await nextTick();
  f.instance.answer('confirm'); assert.equal(confirms, 2, 'failed requests remain retryable');
  f.instance.visible = false; await nextTick();
  assert.equal(f.instance.rendered, true, 'controlled external close still animates');
  f.advance(120); assert.equal(f.instance.rendered, false); f.app.unmount();
  console.log('[test-dialog-motion] PASS: 120ms exit, busy/retry, deferred navigation, duplicate taps/back, input retention, skip, external cancellation, reopen and cleanup');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
