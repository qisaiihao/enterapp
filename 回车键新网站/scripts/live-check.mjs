import puppeteer from "puppeteer-core";
import fs from "node:fs/promises";
import assert from "node:assert/strict";
const executablePath =
  process.env.PUPPETEER_EXECUTABLE_PATH ||
  "C:/Program Files/Google/Chrome/Application/chrome.exe";
const browser = await puppeteer.launch({
  executablePath,
  headless: true,
  args: ["--no-sandbox"],
});
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 1000 });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("http://127.0.0.1:5173/#/poems", {
    waitUntil: "networkidle0",
  });
  const result = await page.evaluate(async () => {
    const api = await import("/src/lib/api.js");
    api.setMode("cloud");
    const results = {};
    try {
      const list = await api.listPoems({ limit: 3 });
      results.list = {
        returned: list.poems.length,
        total: list.total,
        hasMore: list.hasMore,
      };
      const next = await api.listPoems({ limit: 3, skip: 3 });
      results.pagination =
        next.poems.length === 3 &&
        next.poems.every((p) => !list.poems.some((first) => first.id === p.id));
      const originals = await api.listPoems({ limit: 3, kind: "original" });
      const reprints = await api.listPoems({ limit: 3, kind: "reprint" });
      results.filters =
        originals.poems.every((p) => p.original) &&
        reprints.poems.every((p) => !p.original);
      if (list.poems[0]) {
        const search = await api.listPoems({
          query: list.poems[0].title.slice(0, 20),
        });
        results.search = search.poems.some((p) => p.id === list.poems[0].id);
        const detail = await api.poemDetail(list.poems[0].id);
        results.detail = {
          sameId: detail.id === list.poems[0].id,
          hasText: Boolean(detail.fullText),
          date: detail.date,
        };
      }
    } catch (e) {
      results.listError = { code: e.code, message: e.message };
    }
    try {
      await api.profile();
      results.profile = "UNEXPECTED_ACCESS";
    } catch (e) {
      results.profile = e.code;
    }
    try {
      await api.login(
        "__web_reader_probe_nonexistent__",
        "not-a-real-password",
      );
      results.login = "UNEXPECTED_SUCCESS";
    } catch (e) {
      results.login = { code: e.code, message: e.message };
    }
    return results;
  });
  console.log(JSON.stringify({ ...result, browserErrors: errors }, null, 2));
  await fs.mkdir("artifacts", { recursive: true });
  await page.screenshot({
    path: "artifacts/live-desktop-poems.png",
    fullPage: true,
  });
  await page.waitForSelector(".load-more");
  await page.click(".load-more");
  await page.waitForFunction(
    () => document.querySelectorAll(".poem-grid .poem-card").length === 36,
  );
  const id = await page.$eval(".poem-grid .poem-card:nth-child(20)", (el) =>
    el.getAttribute("aria-label"),
  );
  await page.setViewport({ width: 390, height: 844 });
  await page.click(".poem-grid .poem-card:nth-child(20)");
  await page.waitForSelector(".mobile-reading");
  await page.click(".mobile-reader-close");
  await page.waitForFunction(() => !document.querySelector(".mobile-reading"));
  assert.equal(
    await page.$$eval(".poem-grid .poem-card", (elements) => elements.length),
    36,
  );
  assert.equal(
    await page.$eval(".poem-grid .poem-card:nth-child(20)", (el) =>
      el.getAttribute("aria-label"),
    ),
    id,
  );
  if (
    result.listError ||
    !result.pagination ||
    !result.filters ||
    !result.search ||
    result.profile !== "AUTH_REQUIRED" ||
    result.login?.code !== "INVALID_CREDENTIALS"
  )
    process.exitCode = 1;
} finally {
  await browser.close();
}
