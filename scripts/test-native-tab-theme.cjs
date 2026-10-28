const assert = require('node:assert/strict');
const { load, fakeTime } = require('./test-splash-startup.cjs');

function runtime(initialMode = 'light') {
  const time = fakeTime();
  const storage = new Map([['poementerThemeMode', initialMode]]);
  const commits = [];
  let definition;
  let page = { route: 'pages/poem-square/poem-square' };
  load('custom-tab-bar/index.js', {
    ...time.globals,
    wx: { getStorageSync: key => storage.get(key) },
    getCurrentPages: () => page ? [page] : [],
    Component: component => { definition = component; }
  });
  const instance = {
    data: { ...definition.data },
    setData(values, callback) {
      commits.push({ ...values });
      Object.assign(this.data, values);
      if (callback) time.globals.setTimeout(callback, 16);
    }
  };
  for (const [name, method] of Object.entries(definition.methods)) {
    instance[name] = method.bind(instance);
  }
  return { time, storage, commits, instance, definition, setPage: next => { page = next; } };
}

async function main() {
  const cold = runtime('dark');
  assert.equal(cold.instance.data.isDark, true, '冷启动组件默认数据已使用保存的深色主题');
  assert.equal(cold.instance.data.tabBarStyle, 'background: rgba(15, 17, 21, 0.96);', '背景不能等 attached 的 setData 回调才变深');

  // 注册组件之后切换主题，再首次创建目标 Tab：新实例仍需读取最新主题。
  const app = runtime('light');
  app.storage.set('poementerThemeMode', 'dark');
  app.definition.attached.call(app.instance);
  assert.equal(app.commits.length, 1, '首次显示仅一次提交完整呈现状态');
  assert.equal(app.commits[0].selected, 1);
  assert.equal(app.commits[0].isDark, true);
  assert.equal(app.commits[0].tabBarStyle, 'background: rgba(15, 17, 21, 0.96);');
  assert.equal(app.commits[0].selectedColor, '#f4f1ea');
  assert.match(app.commits[0].iconInnerStyle, /rgba/);
  await app.time.tick(100);
  assert.equal(app.commits.length, 1, '不会通过异步回调再次更新背景');
  app.definition.pageLifetimes.show.call(app.instance);
  app.instance.updateTheme();
  assert.equal(app.commits.length, 1, 'attached/show/主题同步重叠时不重复提交相同数据');

  app.storage.set('poementerThemeMode', 'light');
  app.instance.updateTheme();
  assert.equal(app.commits.length, 2);
  assert.equal(app.commits[1].isDark, false);
  assert.equal(app.commits[1].tabBarStyle, 'background: #ffffff;');
  assert.equal(app.commits[1].selectedColor, '#000000');
  assert.equal(app.instance.data.selected, 1, '主题更新不覆盖当前选中页');

  const delayedRoute = runtime('dark');
  delayedRoute.setPage(null);
  delayedRoute.storage.set('currentTabIndex', 2);
  delayedRoute.definition.attached.call(delayedRoute.instance);
  assert.equal(delayedRoute.instance.data.selected, 2, '路由暂不可用时使用切换前保存的目标选中项');
  delayedRoute.setPage({ route: 'pages/profile/profile' });
  await delayedRoute.time.tick(0);
  assert.equal(delayedRoute.instance.data.selected, 3, '路由就绪后校正缓存选中项');
  assert.equal(delayedRoute.time.pending(), 0, '路由重试有界，不持续占用调度');

  console.log('Native tab first-frame theme tests passed.');
}

if (require.main === module) main().catch(error => { console.error(error); process.exitCode = 1; });
module.exports = { main };
