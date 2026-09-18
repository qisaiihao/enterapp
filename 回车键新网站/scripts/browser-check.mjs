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
    "none",
  );
  assert.ok(
    await page.$eval(
      ".shelf-controls",
      (el) => el.getBoundingClientRect().bottom <= 0,
    ),
  );
  await page.screenshot({ path: "artifacts/desktop-poems-clean.png" });
  await page.reload({ waitUntil: "networkidle0" });
  await page.waitForFunction(() => {
    const stage = document.querySelector(".poetry-stage");
    return stage && Math.abs(stage.getBoundingClientRect().top) < 2;
  });
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
  await page.click('.main-nav a[href="#/mine"]');
  await page.waitForSelector(".locked-state");
  await page.click(".locked-state .primary-button");
  await page.waitForFunction(() => document.querySelector("dialog").open);
  await screenshot("desktop-login-demo");
  await clickText("dialog button", "体验示例账号");
  await page.waitForSelector(".poem-grid .poem-card");
  assert.equal(
    await page.$$eval(".poem-grid .card-author", (elements) =>
      elements.every((el) => el.textContent.includes("林间")),
    ),
    true,
  );
  await page.click('.main-nav a[href="#/journal"]');
  await page.waitForSelector(".heat-cell.level-1");
  await screenshot("desktop-journal");
  const day = await page.$eval(".heat-cell.level-1", (el) =>
    el.getAttribute("aria-label").slice(0, 10),
  );
  await page.click(".heat-cell.level-1");
  await page.waitForSelector(".poem-grid .poem-card");
  assert.ok(page.url().includes(`day=${day}`));
  await page.click('.main-nav a[href="#/me"]');
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
  await page.click('.main-nav a[href="#/me"]');
  await page.waitForSelector(".profile-card");
  await page.reload({ waitUntil: "networkidle0" });
  await page.waitForSelector(".profile-card");
  await noOverflow();
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 });
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
  assert.deepEqual(errors, []);
  console.log(
    "PASS: clean initial reading, wheel-up/touch-down controls, desktop/mobile navigation, cards, search, filters, keyboard, font size, demo login, session restoration, calendar drilldown, logout, missing detail, no horizontal overflow or browser exceptions.",
  );
} finally {
  await browser.close();
}
