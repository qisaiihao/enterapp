import puppeteer from "puppeteer-core";
import fs from "node:fs/promises";
import assert from "node:assert/strict";
import path from "node:path";

const base = process.env.WEB_URL || "http://127.0.0.1:5173";
const candidates = [
  process.env.PUPPETEER_EXECUTABLE_PATH,
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "/usr/bin/chromium",
  "/usr/bin/google-chrome",
].filter(Boolean);
let executablePath;
for (const candidate of candidates) {
  try {
    await fs.access(candidate);
    executablePath = candidate;
    break;
  } catch {}
}
if (!executablePath)
  throw new Error(
    "Set PUPPETEER_EXECUTABLE_PATH to an installed Chrome / Chromium.",
  );
await fs.mkdir("artifacts", { recursive: true });
const browser = await puppeteer.launch({
  executablePath,
  headless: true,
  args: ["--no-sandbox"],
});
const page = await browser.newPage();
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
const clickText = async (selector, text) => {
  const found = await page.evaluate(
    (selector, text) => {
      const element = [...document.querySelectorAll(selector)].find((el) =>
        el.textContent.includes(text),
      );
      if (element) element.click();
      return Boolean(element);
    },
    selector,
    text,
  );
  assert.ok(found, `Missing ${selector} with text ${text}`);
};
const screenshot = (name) =>
  page.screenshot({
    path: path.join("artifacts", `${name}.png`),
    fullPage: name !== "mobile-reader",
  });
const noOverflow = async () =>
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
    "Page must not overflow horizontally",
  );
const navigateTo = async (name) => {
  if (await page.$(".sidebar-open")) await page.click(".sidebar-open");
  await page.click(`.main-nav a[href="#/${name}"]`);
};
const footerAtPageEnd = async () => {
  assert.ok(await page.evaluate(() => {
    const footer = document.querySelector(".site-footer").getBoundingClientRect();
    const content = document.querySelector(".main-content > :nth-last-child(2)").getBoundingClientRect();
    return Math.abs(footer.bottom + scrollY - document.documentElement.scrollHeight) < 2 &&
      footer.top >= content.bottom && footer.bottom + scrollY >= innerHeight;
  }), "Footer must end at the page bottom without covering content");
};
const pinnedReaderNavigation = async () => {
  await page.waitForFunction(() => {
    const navigation = document.querySelector(".reader-navigation")?.getBoundingClientRect();
    const body = document.querySelector(".reader-scroll")?.getBoundingClientRect();
    return navigation && body && navigation.height > 0 &&
      Math.abs(navigation.bottom - (innerHeight - 24)) < 2 &&
      body.bottom <= navigation.top + 1;
  });
};
const readerTypesetting = () => page.$eval(".reader-scroll", (body) => {
  const title = body.querySelector("h2");
  return {
    width: body.clientWidth,
    titleOffset: Math.round(title.getBoundingClientRect().top - body.getBoundingClientRect().top + body.scrollTop),
    paragraphs: [...body.querySelectorAll(".poem-text")].map((paragraph) => {
      const style = getComputedStyle(paragraph);
      const range = document.createRange();
      range.selectNodeContents(paragraph);
      const top = paragraph.getBoundingClientRect().top;
      return {
        text: paragraph.textContent,
        font: style.fontFamily,
        size: style.fontSize,
        lineHeight: style.lineHeight,
        spacing: style.letterSpacing,
        whiteSpace: style.whiteSpace,
        lines: [...range.getClientRects()].map((rect) => [
          Math.round(rect.width * 100) / 100,
          Math.round((rect.top - top) * 100) / 100,
        ]),
      };
    }),
  };
});
try {
  await page.setViewport({ width: 1440, height: 1000, deviceScaleFactor: 1 });
  await page.goto(base, { waitUntil: "networkidle0" });
  await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem("poementer:mode", "demo");
  });
  await page.reload({ waitUntil: "networkidle0" });
  await page.waitForSelector(".home-cards .poem-card");
  await page.evaluate(() => document.fonts.ready);
  await screenshot("desktop-home");
  await page.click('.main-nav a[href="#/poems"]');
  await page.waitForSelector(".poem-grid .poem-card");
  assert.equal(
    await page.$$eval(".poem-grid .poem-card", (cards) => cards.length),
    18,
  );
  await page.waitForFunction(() => {
    const stage = document.querySelector(".poetry-stage");
    return stage && Math.abs(stage.getBoundingClientRect().top) < 2;
  });
  assert.equal(
    await page.$eval(".reader-toolbar", (el) => getComputedStyle(el).display),
    "flex",
  );
  assert.ok(
    await page.$eval(
      ".shelf-controls",
      (el) => el.getBoundingClientRect().bottom <= 0,
    ),
  );
  await pinnedReaderNavigation();
  await page.screenshot({ path: "artifacts/desktop-poems-clean.png" });
  assert.equal(
    await page.$eval(".sidebar", (el) => getComputedStyle(el).display),
    "none",
  );
  const readingTitle = await page.$eval(".reader-scroll h2", (el) => el.textContent);
  await page.waitForFunction(() => getComputedStyle(document.querySelector(".reader-scroll h2")).opacity === "1");
  const initialTypesetting = await readerTypesetting();
  await page.click(".sidebar-open");
  assert.equal(
    await page.$eval(".sidebar", (el) => getComputedStyle(el).display),
    "flex",
  );
  assert.equal(await page.$eval(".reader-scroll h2", (el) => el.textContent), readingTitle);
  assert.deepEqual(await readerTypesetting(), initialTypesetting);
  await pinnedReaderNavigation();
  await page.screenshot({ path: "artifacts/desktop-directory-open.png" });
  await page.click(".sidebar-close");
  assert.deepEqual(await readerTypesetting(), initialTypesetting);
  assert.equal(await page.$eval(".sidebar-open", (el) => el === document.activeElement), true);
  await noOverflow();
  const originalText = await page.$eval(".reader-scroll .poem-text", (el) => {
    const text = el.textContent;
    el.textContent = "  沿着河岸慢慢走，风把今天吹成很长的一行。".repeat(5) + "\n\n  天色渐暗。\n保留这一行。";
    return text;
  });
  const longLineTypesetting = await readerTypesetting();
  await page.click(".sidebar-open");
  assert.deepEqual(await readerTypesetting(), longLineTypesetting);
  await page.click(".sidebar-close");
  await page.evaluate(() => { window.scrollTo({ top: 0 }); });
  await pinnedReaderNavigation();
  assert.deepEqual(await readerTypesetting(), longLineTypesetting);
  await page.$eval(".reader-scroll .poem-text", (el, text) => { el.textContent = text; }, originalText);
  await page.reload({ waitUntil: "networkidle0" });
  await page.waitForSelector(".sidebar-open");
  await page.waitForFunction(() => {
    const stage = document.querySelector(".poetry-stage");
    return stage && Math.abs(stage.getBoundingClientRect().top) < 2;
  });
  await page.setViewport({ width: 1440, height: 640, deviceScaleFactor: 1 });
  await pinnedReaderNavigation();
  assert.ok(await page.$eval(".reader-scroll", (el) => {
    el.scrollTop = el.scrollHeight;
    return el.scrollTop > 0;
  }));
  await pinnedReaderNavigation();
  await page.screenshot({ path: "artifacts/desktop-reader-bottom.png" });
  await page.click(".reader-navigation button:last-child");
  await page.waitForFunction(() =>
    document.querySelector(".reader-scroll h2")?.textContent === "雨停以后",
  );
  assert.equal(await page.$eval(".reader-scroll", (el) => el.scrollTop), 0);
  await pinnedReaderNavigation();
  await page.click(".reader-navigation button:first-child");
  await page.waitForFunction(() =>
    document.querySelector(".reader-scroll h2")?.textContent === "把日子写成诗",
  );
  await page.setViewport({ width: 1440, height: 1000, deviceScaleFactor: 1 });
  await page.click(".poem-grid .poem-card:nth-child(2)");
  await page.waitForFunction(
    () =>
      document.querySelector(".reader-scroll h2")?.textContent === "雨停以后",
  );
  assert.ok(page.url().includes("id=sample-2"));
  await page.keyboard.press("ArrowRight");
  await page.waitForFunction(
    () => document.querySelector(".reader-scroll h2")?.textContent === "留白",
  );
  await page.mouse.move(1100, 300);
  await page.mouse.wheel({ deltaY: -700 });
  await page.waitForFunction(() => window.scrollY === 0);
  await page.waitForFunction(
    () =>
      getComputedStyle(document.querySelector(".reader-toolbar")).display !==
      "none",
  );
  await page.click(".text-size");
  assert.ok(await page.$(".large-type"));
  assert.equal(await page.$eval(".reader-scroll .poem-text", (el) => getComputedStyle(el).fontSize), "20px");
  const largeTypesetting = await readerTypesetting();
  await page.click(".sidebar-open");
  assert.deepEqual(await readerTypesetting(), largeTypesetting);
  await page.click(".sidebar-close");
  assert.deepEqual(await readerTypesetting(), largeTypesetting);
  await pinnedReaderNavigation();
  await screenshot("desktop-poems");
  await page.type(".search-form input", "月亮");
  await page.click(".search-form button");
  await page.waitForFunction(
    () => document.querySelectorAll(".poem-grid .poem-card").length === 1,
  );
  assert.equal(
    await page.$eval(".card-title", (el) => el.textContent),
    "晚风来信",
  );
  await page.click(".clear-filter");
  await page.waitForFunction(
    () => document.querySelectorAll(".poem-grid .poem-card").length === 18,
  );
  await clickText(".filter-tabs button", "转载");
  await page.waitForSelector(".empty-state");
  await navigateTo("mine");
  await page.waitForSelector(".locked-state");
  await page.click(".locked-state .primary-button");
  await page.waitForFunction(() => document.querySelector("dialog").open);
  await screenshot("desktop-login-demo");
  await clickText("dialog button", "体验示例账号");
  await page.waitForSelector(".poem-grid .poem-card");
  assert.equal(
    await page.$$eval(".poem-grid .poem-card", (elements) =>
      elements.length > 0 && elements.every((el) => el.getAttribute("aria-label").includes("林间")),
    ),
    true,
  );
  assert.equal(await page.$(".poem-card .card-author, .poem-card .card-arrow"), null);
  assert.equal(await page.$('.main-nav a[href="#/journal"]'), null);
  await page.waitForFunction(() => {
    const stage = document.querySelector(".poetry-stage");
    const calendar = document.querySelector(".mine-activity");
    return Math.abs(stage.getBoundingClientRect().top) < 2 &&
      calendar.getBoundingClientRect().bottom <= 0;
  });
  await page.waitForSelector(".heat-cell.level-1");
  await page.mouse.move(1100, 300);
  await page.mouse.wheel({ deltaY: -1000 });
  await page.waitForFunction(() => window.scrollY === 0);
  await screenshot("desktop-mine-activity");
  const day = await page.$eval(".heat-cell.level-1", (el) =>
    el.getAttribute("aria-label").slice(0, 10),
  );
  await page.click(".heat-cell.level-1");
  await page.waitForSelector(".poem-grid .poem-card");
  assert.ok(page.url().includes(`day=${day}`));
  await page.waitForFunction(() =>
    Math.abs(document.querySelector(".poetry-stage").getBoundingClientRect().top) < 2,
  );
  await navigateTo("me");
  await page.waitForSelector(".profile-card");
  await screenshot("desktop-profile");
  await page.waitForSelector(".library-portfolio .folder-card");
  await page.waitForSelector(".library-favorite .folder-card");
  assert.equal(
    await page.$$eval(
      ".library-portfolio .folder-card",
      (items) => items.length,
    ),
    2,
  );
  await page.click(".library-portfolio .folder-card:nth-child(2)");
  await page.waitForFunction(() =>
    document
      .querySelector(".library-portfolio .folder-content")
      ?.textContent.includes("这里暂时没有可阅读的诗歌"),
  );
  await page.click(".library-favorite .folder-card");
  await page.waitForSelector(".library-favorite .poem-card");
  assert.equal(
    await page.$$eval(".library-favorite .poem-card", (items) => items.length),
    3,
  );
  await screenshot("desktop-library");
  await page.click(".library-favorite .poem-card");
  await page.waitForFunction(
    () =>
      document.querySelector(".reader-scroll h2")?.textContent === "雨停以后",
  );
  assert.ok(page.url().includes("id=sample-2"));
  await navigateTo("me");
  await page.waitForSelector(".profile-card");
  await page.reload({ waitUntil: "networkidle0" });
  await page.waitForSelector(".profile-card");
  await noOverflow();
  await page.click(".sidebar-close");
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 });
  await page.waitForFunction(() => getComputedStyle(document.querySelector(".sidebar")).display === "block");
  await screenshot("mobile-profile");
  await page.waitForSelector(".library-portfolio .folder-card");
  await page.click(".library-portfolio .folder-card");
  await page.waitForSelector(".library-portfolio .poem-card");
  await screenshot("mobile-library");
  await noOverflow();
  assert.equal(
    await page.$eval(".mobile-calendar", (el) => getComputedStyle(el).display),
    "block",
  );
  await page.click(".month-grid button.level-1");
  await page.waitForSelector(".poem-grid .poem-card");
  assert.ok(page.url().includes("day="));
  await page.click('.main-nav a[href="#/mine"]');
  await page.waitForFunction(() => {
    const stage = document.querySelector(".poetry-stage");
    const calendar = document.querySelector(".mine-activity");
    return Math.abs(stage.getBoundingClientRect().top) < 2 &&
      calendar.getBoundingClientRect().bottom <= 0;
  });
  const calendarTouch = await page.createCDPSession();
  await calendarTouch.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x: 180, y: 180 }],
  });
  for (let y = 210; y <= 750; y += 30) {
    await calendarTouch.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ x: 180, y }],
    });
  }
  await calendarTouch.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  await page.waitForFunction(() => {
    const calendar = document.querySelector(".mine-activity .mobile-calendar").getBoundingClientRect();
    return calendar.bottom > 0 && calendar.top < innerHeight;
  });
  await calendarTouch.detach();
  await screenshot("mobile-mine-activity");
  await noOverflow();
  await page.click('.main-nav a[href="#/home"]');
  await page.waitForSelector(".home-cards .poem-card");
  await screenshot("mobile-home");
  await noOverflow();
  await page.click('.main-nav a[href="#/poems"]');
  await page.waitForSelector(".poem-grid .poem-card");
  await screenshot("mobile-poems");
  await noOverflow();
  await page.click(".poem-grid .poem-card:first-child");
  await page.waitForFunction(() => {
    const title = document
      .querySelector(".reader-scroll h2")
      .getBoundingClientRect();
    return title.top >= 50 && title.top <= 60;
  });
  await page.click(".mobile-reader-close");
  await page.click(".poem-grid .poem-card:nth-child(2)");
  await page.waitForSelector(".mobile-reading");
  assert.equal(
    await page.$eval("body", (el) => getComputedStyle(el).overflow),
    "hidden",
  );
  await screenshot("mobile-reader");
  await page.waitForFunction(() => {
    const title = document
      .querySelector(".reader-scroll h2")
      .getBoundingClientRect();
    const toolbar = document
      .querySelector(".reader-toolbar")
      .getBoundingClientRect();
    return title.top >= 50 && title.top <= 60 && toolbar.bottom <= 0;
  });
  const touch = await page.createCDPSession();
  await touch.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x: 180, y: 280 }],
  });
  for (let y = 310; y <= 580; y += 30) {
    await touch.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ x: 180, y }],
    });
  }
  await touch.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  await page.waitForFunction(() => {
    const size = document.querySelector(".text-size").getBoundingClientRect();
    return size.top >= 0 && size.bottom < innerHeight;
  });
  await touch.detach();
  assert.ok(
    await page.$eval(
      ".reader-column",
      (el) => getComputedStyle(el).position === "fixed",
    ),
  );
  await page.click(".mobile-reader-close");
  await page.waitForFunction(() => !document.querySelector(".mobile-reading"));
  assert.equal(
    await page.$$eval(".poem-grid .poem-card", (cards) => cards.length),
    18,
  );
  assert.equal(
    await page.$eval("body", (el) => getComputedStyle(el).overflow),
    "visible",
  );
  await page.click('.main-nav a[href="#/me"]');
  await page.waitForSelector(".profile-footer button");
  await clickText(".profile-footer button", "退出登录");
  await page.click('.main-nav a[href="#/mine"]');
  await page.waitForSelector(".locked-state");
  assert.equal(await page.$(".profile-card"), null);
  assert.equal(await page.$(".profile-library"), null);
  await page.goto(`${base}/#/poems?id=missing-sample`, {
    waitUntil: "networkidle0",
  });
  await page.waitForSelector(".reader-error");
  await noOverflow();
  await page.setViewport({ width: 360, height: 780, deviceScaleFactor: 1 });
  await page.goto(`${base}/#/home`, { waitUntil: "networkidle0" });
  await noOverflow();
  await page.setViewport({ width: 1440, height: 1400, deviceScaleFactor: 1 });
  await page.goto(`${base}/#/about`, { waitUntil: "networkidle0" });
  await footerAtPageEnd();
  assert.equal(await page.evaluate(() => document.documentElement.scrollHeight), 1400);
  await page.screenshot({ path: "artifacts/desktop-about-footer.png" });
  await page.setViewport({ width: 390, height: 1400, deviceScaleFactor: 1 });
  await footerAtPageEnd();
  assert.equal(await page.evaluate(() => document.documentElement.scrollHeight), 1400);
  await page.setViewport({ width: 390, height: 640, deviceScaleFactor: 1 });
  await footerAtPageEnd();
  assert.ok(await page.evaluate(() => document.documentElement.scrollHeight > innerHeight));
  await page.setViewport({ width: 1440, height: 1000, deviceScaleFactor: 1 });
  let previousEntryId = "";
  for (let attempt = 0; attempt < 4; attempt++) {
    await page.click(".about-page .primary-button");
    await page.waitForSelector(".reader-scroll h2");
    const poemId = new URL(page.url()).hash.split("id=")[1];
    assert.ok(poemId);
    assert.notEqual(poemId, previousEntryId);
    assert.equal(
      await page.$eval(".poem-card.selected .card-title", (el) => el.textContent),
      await page.$eval(".reader-scroll h2", (el) => el.textContent),
    );
    previousEntryId = poemId;
    await page.evaluate(() => { location.hash = "/about"; });
    await page.waitForSelector(".about-page .primary-button");
  }
  await navigateTo("home");
  await page.waitForSelector(".home-cards .poem-card");
  await footerAtPageEnd();
  await page.click(".enter-button");
  await page.waitForSelector(".reader-scroll h2");
  assert.notEqual(new URL(page.url()).hash.split("id=")[1], previousEntryId);
  assert.deepEqual(errors, []);
  console.log(
    "PASS: clean initial reading, wheel-up/touch-down controls, desktop/mobile navigation, cards, search, filters, keyboard, font size, demo login, session restoration, calendar drilldown, logout, missing detail, no horizontal overflow or browser exceptions.",
  );
} finally {
  await browser.close();
}
