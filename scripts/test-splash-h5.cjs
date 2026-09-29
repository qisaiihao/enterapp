// 本地 H5 集成验证：真实页面/路由/渲染，内存云接口夹具；不访问现网业务数据。
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const puppeteer = require('puppeteer-core');

(async () => {
  const browser = await puppeteer.launch({ executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
  const output = path.join(__dirname, '../output/splash-startup-20260929');
  fs.mkdirSync(output, { recursive: true });
  const results = [];
  try {
    for (const { delay, manual = false } of [{ delay: 0 }, { delay: 3000 }, { delay: 15000 }, { delay: 15000, manual: true }]) {
      const page = await browser.newPage();
      await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
      await page.setRequestInterception(true);
      page.on('request', request => {
        if (/^https?:/.test(request.url()) && !request.url().startsWith(process.env.H5_URL || 'http://127.0.0.1:8081/')) request.abort();
        else request.continue();
      });
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.evaluateOnNewDocument(delayMs => {
        localStorage.clear();
        window.__startupCalls = [];
        window.__startupStarted = 0;
        window.__startupButtonSeen = false;
        window.__startupTypingDone = null;
        const originalInfo = console.info;
        console.info = (...args) => {
          if (args[0] === '[splash] leaving') window.__startupLeaving = args[1];
          originalInfo(...args);
        };
        window.__tcbAppInstance = {
          __skipAuth: true,
          async callFunction({ name }) {
            window.__startupCalls.push(name);
            const userInfo = { _openid: 'startup-fixture', nickName: '启动测试', avatarUrl: '/static/images/avatar.png' };
            if (name === 'login') return { result: { openid: userInfo._openid } };
            if (name === 'getPostList') {
              await new Promise(resolve => setTimeout(resolve, delayMs));
              return { result: { success: true, posts: Array.from({ length: 10 }, (_, i) => ({
                _id: `fixture-${i}`, _openid: userInfo._openid, authorName: '启动测试',
                content: `首屏诗歌 ${i + 1}\n页面进入时已经准备好`, highlightLines: [`首屏诗歌 ${i + 1}`],
                authorSignature: '', backgroundColor: '#e5ebe7', textColor: '#222', votes: 0, isVoted: false,
                isPoem: true, isOriginal: true, createTime: new Date().toISOString()
              })) } };
            }
            return { result: { success: true, userInfo, config: { enabled: false, text: '', target: 'weekly' },
              activities: [], posts: [], unreadCount: 0, count: 0, isAdmin: false } };
          },
          async getTempFileURL() { return { fileList: [] }; }
        };
        const monitor = setInterval(() => {
          if (document.querySelector('.typing-phase-container') && !window.__startupStarted) window.__startupStarted = performance.now();
          if (document.querySelector('.enter-key-container')) window.__startupButtonSeen = true;
          if (document.querySelector('.typewriter-effect')?.textContent.trim() === 'poementer' && window.__startupTypingDone === null) {
            window.__startupTypingDone = Math.round(performance.now() - window.__startupStarted);
          }
          const square = document.querySelector('.poem-square');
          if (!square || window.__startupFirstSquare) return;
          window.__startupFirstSquare = {
            elapsedMs: Math.round(performance.now() - window.__startupStarted),
            cards: square.querySelectorAll('.poem-card').length,
            skeleton: !!square.querySelector('.skeleton-container, .skeleton')
          };
          clearInterval(monitor);
        }, 10);
      }, delay);
      await page.goto((process.env.H5_URL || 'http://127.0.0.1:8081/') + '#/pages/splash/splash', { waitUntil: 'domcontentloaded' });
      if (manual) {
        await page.waitForSelector('.enter-key-container', { visible: true, timeout: 10000 });
        // 按钮有滑入动画；等到实际可点击后走真实触屏事件。
        await page.waitForFunction(() => {
          const rect = document.querySelector('.enter-key-container')?.getBoundingClientRect();
          return rect && rect.bottom <= innerHeight;
        });
        await page.tap('.enter-key-container');
      }
      await page.waitForFunction(() => window.__startupFirstSquare, { timeout: 25000 });
      const result = await page.evaluate(() => ({
        firstSquare: window.__startupFirstSquare, leaving: window.__startupLeaving,
        buttonSeen: window.__startupButtonSeen, typingDoneMs: window.__startupTypingDone,
        listCalls: window.__startupCalls.filter(name => name === 'getPostList').length,
        loading: getCurrentPages().at(-1).$vm.isLoading
      }));
      assert.equal(errors.length, 0, errors.join('\n'));
      assert.ok(result.typingDoneMs >= 1350 && result.typingDoneMs <= 2000, '打字完整播放约 1.5 秒');
      assert.equal(result.buttonSeen, delay !== 0, '快速加载无按钮，慢速加载显示按钮');
      if (manual) {
        assert.equal(result.leaving.reason, 'manual');
        assert.ok(result.leaving.elapsedMs < 3500, '按钮可在网络未完成时跳过');
      } else if (delay === 15000) {
        assert.equal(result.leaving.reason, 'timeout', '预加载失败也等待 6 秒截止');
        assert.ok(result.leaving.elapsedMs >= 5800);
      }
      if (delay < 5000) {
        assert.equal(result.firstSquare.cards, 10, '进入广场首次 DOM 检查已有内容');
        assert.equal(result.loading, false);
        assert.equal(result.listCalls, 1, '进入后不重复获取列表');
      }
      assert.ok(result.leaving.elapsedMs <= 6300, '开屏时限不受网络影响');
      await page.screenshot({ path: path.join(output, `first-screen-${delay}${manual ? '-manual' : ''}.png`) });
      results.push({ cloudDelayMs: delay, manual, ...result });
      await page.close();
    }
    fs.writeFileSync(path.join(output, 'h5-results.json'), JSON.stringify(results, null, 2) + '\n');
    console.log(JSON.stringify(results, null, 2));
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
