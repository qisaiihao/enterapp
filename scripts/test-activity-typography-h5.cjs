const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const puppeteer = require('puppeteer-core');

// Run after npm run dev:h5 -- --host 127.0.0.1 --port 8081.
// Real page templates and standalone cards use one local poem; all cloud IO is blocked.
async function main() {
  const base = new URL(process.env.H5_URL || 'http://127.0.0.1:8081/');
  const output = path.join(os.tmpdir(), 'enterkey-activity-typography-review');
  fs.mkdirSync(output, { recursive: true });
  const browser = await puppeteer.launch({
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    headless: true
  });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1, isMobile: true });
    await page.setRequestInterception(true);
    page.on('request', request => {
      const url = new URL(request.url());
      if (['data:', 'blob:', 'about:'].includes(url.protocol) ||
        (url.origin === base.origin && ['GET', 'HEAD'].includes(request.method()))) request.continue();
      else request.abort();
    });
    await page.goto(new URL('#/pages/login/login', base).href, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => typeof getCurrentPages === 'function' && getCurrentPages().at(-1)?.$vm);
    await page.evaluate(async () => {
      const source = await (await fetch('/components/poem/PoemCard.vue')).text();
      const runtime = source.match(/from "([^"\n]*vue\.runtime\.esm\.js[^"\n]*)"/);
      if (!runtime) throw new Error('Cannot find the application Vue runtime');
      const { h, render, nextTick } = await import(runtime[1]);
      const paths = {
        activity: '/pages-content/activity-detail/activity-detail.vue',
        square: '/pages/poem-square/poem-square.vue',
        mountain: '/pages/mountain/mountain.vue',
        ranking: '/pages-content/weekly-ranking/weekly-ranking.vue',
        tag: '/pages-tools/tag-filter/tag-filter.vue',
        standalone: '/components/poem/PoemCard.vue',
        legacy: '/components/activity/ActivityPoemCard.vue',
        postItem: '/components/PostItem.vue'
      };
      const fontSize = await import('/utils/fontSize.js');
      const names = Object.keys(fontSize.getReadFontVars('standard'));
      const context = getCurrentPages().at(-1).$vm.$.appContext;
      const container = document.createElement('div');
      container.id = 'activity-typography-review';
      container.style.cssText = 'position:fixed;inset:0;overflow:auto;z-index:2147480000;background:#fff;';
      document.body.appendChild(container);
      const review = window.__activityTypography = { entries: {}, standardVars: null };
      for (const [name, path] of Object.entries(paths)) {
        const original = (await import(path)).default;
        const host = document.createElement('div');
        host.dataset.reviewPage = name;
        host.style.cssText = 'width:390px;position:relative;';
        container.appendChild(host);
        const standalone = ['standalone', 'legacy', 'postItem'].includes(name);
        const component = standalone ? {
          data: () => ({ poem: {} }),
          render() {
            return h(original, { ref: 'card', [name === 'standalone' ? 'post' : 'item']: this.poem, enableSeries: true });
          }
        } : {
          ...original,
          data() {
            return { ...original.data.call(this), isLoading: false, hasMore: false, postList: [], rankingItems: [], rankingLoading: false };
          }
        };
        const vnode = h(component);
        vnode.appContext = context;
        render(vnode, host);
        review.entries[name] = { host, instance: vnode.component.proxy };
      }
      await nextTick();
      const fixture = state => {
        const blocks = state === 'series' ? [{ content: '组诗第一首\n第二行诗歌', subtitle: '第一首' }] : [];
        return {
          _id: 'typography-fixture', isPoem: true, publishMode: 'poem',
          content: '第一行诗歌\n第二行诗歌', displayContent: '第一行诗歌\n第二行诗歌',
          displayHighlightLines: state === 'highlighted' ? ['第一行诗歌', '第二行诗歌'] : [],
          backgroundColor: '#a4c4bd', textColor: '#222', imageUrls: [],
          isExpanded: state === 'expanded' || state === 'series',
          isSeries: state === 'series', seriesExpanded: state === 'series', currentSeriesIndex: 0,
          seriesPoems: blocks, seriesBlocks: blocks, seriesBlockCount: blocks.length
        };
      };
      const removeGlobalVars = () => {
        for (const target of [document.documentElement, document.body, document.getElementById('app')]) {
          if (target) names.forEach(name => target.style.removeProperty(name));
        }
      };
      const cardSelector = '.poem-card, .activity-poem-card, .post-item-wrapper';
      const read = () => Object.fromEntries(Object.entries(review.entries).map(([name, { host }]) => {
        const root = host.querySelector(cardSelector);
        if (!root) throw new Error(`Missing poem card in ${name}`);
        const css = getComputedStyle(root);
        return [name, {
          ownFont: root.style.getPropertyValue('--app-read-post-size').trim(),
          ownLine: root.style.getPropertyValue('--app-read-post-line').trim(),
          cardFont: css.getPropertyValue('--app-read-post-size').trim(),
          cardLine: css.getPropertyValue('--app-read-post-line').trim(),
          background: css.backgroundColor,
          series: !!root.querySelector('.series-single-card'),
          nodes: [...root.querySelectorAll('.post-content, .highlight-line')].map(node => {
            const textStyle = getComputedStyle(node);
            return { fontSize: textStyle.fontSize, lineHeight: textStyle.lineHeight };
          })
        }];
      }));
      review.measure = async (level, state) => {
        fontSize.setReadFontSize(level);
        for (const [name, { instance }] of Object.entries(review.entries)) {
          if (['standalone', 'legacy', 'postItem'].includes(name)) instance.poem = fixture(state);
          else if (name === 'ranking') instance.rankingItems = [fixture(state)];
          else instance.postList = [fixture(state)];
        }
        await nextTick();
        const legacy = review.entries.legacy.instance.$refs.card;
        legacy.expanded = state === 'expanded';
        legacy.seriesExpanded = state === 'series';
        legacy.currentSeriesIndex = 0;
        await nextTick();
        removeGlobalVars();
        await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        if (level === 'standard' && !review.standardVars) {
          const root = review.entries.standalone.host.querySelector(cardSelector);
          review.standardVars = Object.fromEntries(names.map(name => [name, getComputedStyle(root).getPropertyValue(name)]));
        }
        return { level, state, entries: read() };
      };
      review.isolateAncestors = wrongStandard => {
        removeGlobalVars();
        for (const { host } of Object.values(review.entries)) {
          const root = host.querySelector(cardSelector);
          for (let ancestor = root.parentElement; ancestor && ancestor !== container; ancestor = ancestor.parentElement) {
            names.forEach(name => {
              if (wrongStandard) ancestor.style.setProperty(name, review.standardVars[name]);
              else ancestor.style.removeProperty(name);
            });
          }
        }
        return read();
      };
      review.clear = () => {
        for (const { host } of Object.values(review.entries)) render(null, host);
        container.remove();
      };
    });

    const assertMatching = (entries, label, state) => {
      const reference = entries.square;
      for (const [name, entry] of Object.entries(entries)) {
        const expectedCount = state === 'highlighted' && !['tag', 'postItem'].includes(name) ? 3 : 1;
        assert.equal(entry.nodes.length, expectedCount, `${label}/${name}: expected text nodes`);
        assert.notEqual(entry.ownFont, '', `${label}/${name}: card owns its reading size`);
        assert.notEqual(entry.ownLine, '', `${label}/${name}: card owns its line height`);
        assert.equal(entry.cardFont, reference.cardFont, `${label}/${name}: same reading size`);
        assert.equal(entry.cardLine, reference.cardLine, `${label}/${name}: same reading line height`);
        if (!['tag', 'postItem'].includes(name)) assert.equal(entry.background, 'rgb(164, 196, 189)', `${label}/${name}: reading style retains the poem background`);
        for (const node of entry.nodes) assert.deepEqual(node, reference.nodes[0], `${label}/${name}: actual typography matches`);
      }
    };
    const rows = [];
    for (const level of ['standard', 'large', 'xlarge']) {
      for (const state of ['collapsed', 'highlighted', 'expanded', 'series']) {
        const row = await page.evaluate((level, state) => window.__activityTypography.measure(level, state), level, state);
        assertMatching(row.entries, `${level}/${state}`, state);
        if (state === 'series') {
          for (const name of ['activity', 'square', 'standalone', 'legacy']) assert.equal(row.entries[name].series, true, `${name}: actual series body is rendered`);
        }
        rows.push(row);
      }
    }
    for (let index = 1; index < 3; index++) {
      for (const name of Object.keys(rows[0].entries)) {
        const previous = rows[(index - 1) * 4].entries[name].nodes[0];
        const current = rows[index * 4].entries[name].nodes[0];
        assert.ok(parseFloat(current.fontSize) > parseFloat(previous.fontSize), `${name}: larger setting increases actual font size`);
        assert.ok(parseFloat(current.lineHeight) > parseFloat(previous.lineHeight), `${name}: larger setting increases actual line height`);
      }
    }
    const isolation = {};
    for (const wrongStandard of [false, true]) {
      const entries = await page.evaluate(wrong => window.__activityTypography.isolateAncestors(wrong), wrongStandard);
      assertMatching(entries, wrongStandard ? 'stale standard ancestors' : 'unbound ancestors', 'series');
      for (const name of Object.keys(entries)) assert.deepEqual(entries[name].nodes, rows.at(-1).entries[name].nodes, `${name}: xlarge survives missing or stale ancestor variables`);
      isolation[wrongStandard ? 'staleStandard' : 'unbound'] = entries;
    }
    const restoredStandard = await page.evaluate(() => window.__activityTypography.measure('standard', 'highlighted'));
    assertMatching(restoredStandard.entries, 'switch back to standard', 'highlighted');
    for (const name of Object.keys(restoredStandard.entries)) {
      assert.deepEqual(restoredStandard.entries[name].nodes, rows[1].entries[name].nodes, `${name}: mounted cards react when the setting returns to standard`);
    }
    fs.writeFileSync(path.join(output, 'computed-typography.json'), JSON.stringify({ rows, isolation, restoredStandard }, null, 2));
    await page.evaluate(() => window.__activityTypography.clear());
    console.log(`PASS Poem typography: five real entries and three standalone cards, three sizes, collapsed/highlighted/expanded/series, missing and stale ancestor variables. Evidence: ${output}`);
  } finally { await browser.close(); }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
