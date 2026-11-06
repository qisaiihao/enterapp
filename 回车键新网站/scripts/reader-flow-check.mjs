import puppeteer from "puppeteer-core";
import assert from "node:assert/strict";
import fs from "node:fs/promises";

const base = process.env.WEB_URL || "http://127.0.0.1:5173";
const candidates = [process.env.PUPPETEER_EXECUTABLE_PATH,
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"].filter(Boolean);
let executablePath;
for (const candidate of candidates) {
  try { await fs.access(candidate); executablePath = candidate; break; } catch {}
}
const browser = await puppeteer.launch({ executablePath, headless: true });
const fixture = `
export * from "/src/lib/api.js?reader-flow-source=1";
import { normalizePoem } from "/src/lib/poems.js";
const poems = Array.from({ length: 54 }, (_, index) => normalizePoem({
  _id: "flow-" + (index + 1), title: "诗 " + (index + 1),
  content: Array.from({ length: 100 }, (_, line) =>
    "第" + String(line + 1).padStart(3, "0") + "行 春风经过河岸。").join("\\n"),
  seriesPoems: index === 1 ? [
    { subtitle: "第一辑", content: "河流经过这里。\\n".repeat(60) },
    { subtitle: "第二辑", content: "春风经过这里。\\n".repeat(60) },
  ] : [],
  authorName: "诗人", isOriginal: true, highlightLines: ["春风经过河岸。"],
}));
async function request(action, options, read) {
  const call = { action, ...options, done: false };
  window.readerCalls.push(call);
  try {
    await new Promise(resolve => setTimeout(resolve, window.readerDelay));
    return read();
  } finally { call.done = true; }
}
export function listPoems(options = {}) {
  return request("list", options, () => ({
    poems: poems.slice(options.skip || 0, (options.skip || 0) + (options.limit || 18)),
    total: poems.length, hasMore: (options.skip || 0) + (options.limit || 18) < poems.length,
  }));
}
export function poemDetail(id) {
  return request("detail", { id }, () => {
    if (window.failDetail === id) { window.failDetail = ""; throw new Error("暂时无法读取"); }
    const poem = poems.find(poem => poem.id === id);
    if (!poem) throw new Error("这首诗不存在");
    return poem;
  });
}
`;
async function open(hash, { width = 1440, delay = 250, fontDelay = 0, failDetail = "" } = {}) {
  const page = await browser.newPage();
  page.setDefaultTimeout(8000);
  await page.setViewport({ width, height: 800 });
  await page.evaluateOnNewDocument((delay, failDetail) => {
    if (!sessionStorage.getItem("reader-flow-initialized")) {
      localStorage.setItem("poementer:mode", "demo");
      localStorage.removeItem("poementer:large-type");
      localStorage.removeItem("poementer:collapsed-navigation");
      localStorage.removeItem("poementer:demo-login");
      sessionStorage.setItem("reader-flow-initialized", "yes");
    }
    window.readerCalls = [];
    window.readerDelay = delay;
    window.failDetail = failDetail;
  }, delay, failDetail);
  await page.setRequestInterception(true);
  page.on("request", async (request) => {
    const url = new URL(request.url());
    if (url.pathname === "/src/lib/api.js" && !url.searchParams.has("reader-flow-source")) {
      await request.respond({ status: 200, contentType: "text/javascript", body: fixture });
    } else {
      if (fontDelay && url.pathname.endsWith(".woff2")) await new Promise(resolve => setTimeout(resolve, fontDelay));
      await request.continue();
    }
  });
  await page.goto(`${base}/#/${hash}`, { waitUntil: "domcontentloaded" });
  return page;
}
const ready = async (page) => {
  await page.waitForSelector(".reader-scroll .poem-text", { visible: true });
  await page.evaluate(() => document.fonts.ready);
};
const title = (page) => page.$eval(".reader-scroll h2", el => el.textContent);
const calls = (page) => page.evaluate(() => window.readerCalls.map(({ done, ...call }) => call));
const typesetting = (page) => page.$eval(".reader-scroll", body => {
  const poem = body.querySelector(".poem-text");
  const style = getComputedStyle(poem);
  const range = document.createRange();
  range.selectNodeContents(poem);
  const top = poem.getBoundingClientRect().top;
  return { width: body.clientWidth, size: style.fontSize, lineHeight: style.lineHeight,
    lines: [...range.getClientRects()].map(rect => [Math.round(rect.width * 100), Math.round((rect.top - top) * 100)]) };
});
const visibleLine = (page) => page.$eval(".reader-scroll", body => {
  const node = body.querySelector(".poem-text").firstChild;
  const range = document.createRange();
  let offset = 0;
  for (const [index, line] of node.textContent.split("\n").entries()) {
    range.setStart(node, offset); range.setEnd(node, offset + line.length);
    if (range.getBoundingClientRect().bottom > body.getBoundingClientRect().top + 8) return index;
    offset += line.length + 1;
  }
});
const failures = [];
async function check(name, run) {
  try { await run(); console.log(`PASS: ${name}`); }
  catch (error) { failures.push(name); console.error(`FAIL: ${name}\n${error.stack}`); }
}
try {
  await check("the first visible poem uses the finished reading font", async () => {
    const page = await open("poems", { delay: 20, fontDelay: 1200 });
    await page.waitForSelector(".reader-scroll .poem-text", { visible: true });
    assert.equal(await page.evaluate(() => document.fonts.check("18px Huiwen-mincho")), true);
    await page.close();
  });
  await check("cold bookmark reuses the public list", async () => {
    const page = await open("poems?id=flow-2");
    await ready(page);
    assert.equal(await title(page), "诗 2");
    assert.deepEqual(await calls(page), [{ action: "list", scope: "all", limit: 36 }]);
    await page.close();
  });
  await check("cards, keyboard, history, directory and type size reuse loaded text", async () => {
    const page = await open("poems");
    await ready(page);
    const initialCalls = await calls(page);
    for (const width of [900, 1440, 2200]) {
      await page.setViewport({ width, height: 800 });
      await page.$eval(".reader-scroll", body => { body.scrollTop = 600; });
      const initial = await typesetting(page);
      const position = await page.$eval(".reader-scroll", body => body.scrollTop);
      await page.click(".sidebar-open");
      assert.deepEqual(await typesetting(page), initial);
      assert.equal(await page.$eval(".reader-scroll", body => body.scrollTop), position);
      await page.click(".sidebar-close");
      assert.deepEqual(await typesetting(page), initial);
      const line = await visibleLine(page);
      await page.click(".text-size");
      assert.equal(await visibleLine(page), line, "AA must preserve the visible source line");
      const large = await typesetting(page);
      await page.click(".sidebar-open");
      assert.deepEqual(await typesetting(page), large);
      await page.click(".sidebar-close");
      await page.click(".text-size");
      assert.equal(await visibleLine(page), line);
      await page.click(".poem-grid .poem-card:nth-child(2)");
      await page.waitForFunction(() => location.hash.endsWith("flow-2"));
      assert.equal(await title(page), "诗 2");
      assert.equal(await page.$eval(".reader-scroll", body => body.scrollTop), 0);
      await page.keyboard.press("ArrowRight");
      await page.waitForFunction(() => location.hash.endsWith("flow-3"));
      assert.equal(await title(page), "诗 3");
      await page.goBack();
      await page.waitForFunction(() => location.hash.endsWith("flow-2"));
      assert.equal(await title(page), "诗 2");
      await page.click(".poem-grid .poem-card:first-child");
    }
    assert.deepEqual(await calls(page), initialCalls);
    await page.close();
  });
  await check("pagination consumes prefetched poems before another request", async () => {
    const page = await open("poems");
    await ready(page);
    await page.click(".load-more");
    await page.waitForFunction(() => document.querySelectorAll(".poem-grid .poem-card").length === 36);
    assert.equal((await calls(page)).length, 1);
    await page.click(".load-more");
    await page.waitForFunction(() => document.querySelectorAll(".poem-grid .poem-card").length === 54);
    assert.deepEqual((await calls(page)).map(call => call.skip || 0), [0, 36]);
    await page.close();
  });
  await check("type size keeps a visible series heading in place", async () => {
    const page = await open("poems?id=flow-2");
    await ready(page);
    await page.$eval(".reader-scroll", body => {
      body.scrollTop += body.querySelectorAll(".series-content h3")[1].getBoundingClientRect().top - body.getBoundingClientRect().top - 50;
    });
    const headingTop = () => page.$eval(".series-content section:nth-child(2) h3", el => el.getBoundingClientRect().top);
    const before = await headingTop();
    await page.click(".text-size");
    assert.ok(Math.abs(await headingTop() - before) < 1);
    assert.equal((await calls(page)).length, 1);
    await page.close();
  });
  await check("returning to an opened bookmark reuses its detail", async () => {
    const page = await open("poems?id=flow-50");
    await ready(page);
    await page.click(".poem-grid .poem-card:nth-child(2)");
    await page.waitForFunction(() => location.hash.endsWith("flow-2"));
    await page.goBack();
    await page.waitForFunction(() => document.querySelector(".reader-scroll h2")?.textContent === "诗 50");
    assert.equal((await calls(page)).filter(call => call.action === "detail").length, 1);
    await page.evaluate(() => { location.hash = "/poems?id=flow-52"; });
    await page.waitForFunction(() => window.readerCalls.some(call => call.id === "flow-52"));
    await page.goBack();
    await page.waitForFunction(() => window.readerCalls.every(call => call.done));
    assert.equal(await title(page), "诗 50");
    await page.goForward();
    await page.waitForFunction(() => document.querySelector(".reader-scroll h2")?.textContent === "诗 52");
    assert.equal((await calls(page)).filter(call => call.id === "flow-52").length, 1);
    await page.close();
  });
  await check("leaving a pending reading entry keeps the chosen page", async () => {
    const page = await open("about", { delay: 1200 });
    await page.waitForSelector(".about-page .primary-button");
    await page.click(".about-page .primary-button");
    assert.equal(await page.$eval(".about-page .primary-button", el => el.disabled), true);
    await page.click('.main-nav a[href="#/home"]');
    await page.waitForFunction(() => window.readerCalls.every(call => call.done));
    await page.waitForSelector(".home-cards .poem-card");
    assert.ok(page.url().endsWith("#/home"));
    assert.equal((await calls(page)).length, 1);
    await page.close();
  });
  await check("failed detail retries once and then remains reusable", async () => {
    const page = await open("poems?id=flow-50", { failDetail: "flow-50" });
    await page.waitForSelector(".reader-error");
    await page.click(".reader-error button:first-of-type");
    await ready(page);
    assert.equal(await title(page), "诗 50");
    assert.equal((await calls(page)).filter(call => call.action === "detail").length, 2);
    await page.click(".poem-grid .poem-card:nth-child(2)");
    await page.waitForFunction(() => location.hash.endsWith("flow-2"));
    await page.goBack();
    await page.waitForFunction(() => document.querySelector(".reader-scroll h2")?.textContent === "诗 50");
    assert.equal((await calls(page)).filter(call => call.action === "detail").length, 2);
    await page.close();
  });
  await check("desktop to mobile reading locks the background and retains type choice", async () => {
    const page = await open("poems?id=flow-2");
    await ready(page);
    await page.click(".text-size");
    const initialCalls = await calls(page);
    await page.setViewport({ width: 390, height: 844 });
    assert.equal(await page.$eval("body", el => getComputedStyle(el).overflow), "hidden");
    await page.click(".mobile-reader-close");
    await page.click(".poem-grid .poem-card:nth-child(3)");
    await page.waitForFunction(() => location.hash.endsWith("flow-3"));
    assert.equal(await page.$eval(".text-size", el => el.getAttribute("aria-pressed")), "true");
    assert.deepEqual(await calls(page), initialCalls);
    await page.reload({ waitUntil: "domcontentloaded" });
    await ready(page);
    assert.equal(await page.$eval(".text-size", el => el.getAttribute("aria-pressed")), "true");
    assert.equal(await page.$eval(".poem-text", el => getComputedStyle(el).fontSize), "22px");
    await page.click(".mobile-reader-close");
    assert.equal(await page.$eval("body", el => getComputedStyle(el).overflow), "visible");
    assert.deepEqual(await calls(page), initialCalls);
    await page.close();
  });
  if (failures.length) throw new Error(`${failures.length} reader flow checks failed: ${failures.join(", ")}`);
} finally {
  await browser.close();
}
