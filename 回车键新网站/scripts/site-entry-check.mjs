import puppeteer from "puppeteer-core";
import fs from "node:fs/promises";
import assert from "node:assert/strict";

const base = process.env.WEB_URL || "http://127.0.0.1:4173";
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
assert.ok(executablePath, "Set PUPPETEER_EXECUTABLE_PATH to Chrome / Chromium");
const browser = await puppeteer.launch({
  executablePath,
  headless: true,
  args: ["--no-sandbox"],
});
await fs.mkdir("artifacts", { recursive: true });
const errors = [];
const phoneUA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";
async function pageFor({
  mobile = false,
  width = 1440,
  height = 1000,
  blockedStorage = false,
} = {}) {
  const context = await browser.createBrowserContext();
  const page = await context.newPage();
  page.on("pageerror", (error) => errors.push(error.message));
  await page.setViewport({ width, height, isMobile: mobile, hasTouch: mobile });
  if (mobile) await page.setUserAgent(phoneUA);
  await page.evaluateOnNewDocument((blocked) => {
    localStorage.setItem("poementer:mode", "demo");
    if (blocked)
      Object.defineProperty(window, "localStorage", {
        get() {
          throw new DOMException("Blocked", "SecurityError");
        },
      });
  }, blockedStorage);
  return page;
}
async function loadedPoster(page) {
  await page.waitForSelector(".poster");
  assert.ok(new URL(page.url()).pathname.startsWith("/classic/"));
  assert.ok(
    await page.$$eval(".poster img", (images) =>
      images.every((img) => img.complete && img.naturalWidth > 0),
    ),
  );
  assert.equal(await page.$(".more-link"), null);
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  );
  assert.equal(
    await page.$eval(".indicator-web", (link) => link.href),
    "https://cloud1-5gb0pbyl400845f5-1378788263.tcloudbaseapp.com/",
  );
  assert.equal(
    await page.$eval(
      ".indicator-download",
      (link) => new URL(link.href).pathname,
    ),
    "/app-release.apk",
  );
}
async function loadedReader(page) {
  await page.waitForSelector(".site-version-link");
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  );
}
try {
  const desktop = await pageFor();
  await desktop.goto(base, { waitUntil: "networkidle0" });
  await loadedReader(desktop);
  await desktop.screenshot({ path: "artifacts/unified-desktop.png" });
  await Promise.all([
    desktop.waitForNavigation({ waitUntil: "networkidle0" }),
    desktop.click(".site-version-link"),
  ]);
  await loadedPoster(desktop);
  await desktop.screenshot({ path: "artifacts/unified-classic-desktop.png" });
  await desktop.goto(base, { waitUntil: "networkidle0" });
  await loadedPoster(desktop);

  const narrowDesktop = await pageFor({ width: 390, height: 844 });
  await narrowDesktop.goto(base, { waitUntil: "networkidle0" });
  await loadedReader(narrowDesktop);

  const phone = await pageFor({ mobile: true, width: 390, height: 844 });
  const requests = [];
  phone.on("request", (request) => requests.push(request.url()));
  await phone.goto(base, { waitUntil: "networkidle0" });
  await loadedPoster(phone);
  assert.ok(
    !requests.some((url) => /assets\/(reader|cloudbase)-/.test(url)),
    "Classic entry should not download the reader bundle",
  );
  await phone.screenshot({ path: "artifacts/unified-classic-mobile.png" });
  await phone.setViewport({
    width: 844,
    height: 390,
    isMobile: true,
    hasTouch: true,
  });
  await loadedPoster(phone);
  await phone.screenshot({ path: "artifacts/unified-classic-landscape.png" });
  await phone.setViewport({
    width: 390,
    height: 844,
    isMobile: true,
    hasTouch: true,
  });
  await Promise.all([
    phone.waitForNavigation({ waitUntil: "networkidle0" }),
    phone.click(".reader-link"),
  ]);
  await loadedReader(phone);
  await phone.screenshot({ path: "artifacts/unified-reader-mobile.png" });
  await phone.goto(base, { waitUntil: "networkidle0" });
  await loadedReader(phone);
  await Promise.all([
    phone.waitForNavigation({ waitUntil: "networkidle0" }),
    phone.click(".site-version-link"),
  ]);
  await loadedPoster(phone);
  await phone.goto(`${base}/#/poems?id=sample-2`, {
    waitUntil: "networkidle0",
  });
  await loadedReader(phone);
  await phone.waitForFunction(
    () =>
      document.querySelector(".reader-scroll h2")?.textContent === "雨停以后",
  );

  const landscape = await pageFor({ mobile: true, width: 844, height: 390 });
  await landscape.goto(base, { waitUntil: "networkidle0" });
  await loadedReader(landscape);
  const smallPhone = await pageFor({ mobile: true, width: 320, height: 568 });
  await smallPhone.goto(base, { waitUntil: "networkidle0" });
  await loadedPoster(smallPhone);
  await smallPhone.screenshot({ path: "artifacts/unified-classic-small.png" });
  const blocked = await pageFor({
    mobile: true,
    width: 390,
    height: 844,
    blockedStorage: true,
  });
  await blocked.goto(base, { waitUntil: "networkidle0" });
  await loadedPoster(blocked);

  const apk = await fetch(`${base}/app-release.apk`);
  assert.equal(apk.status, 200);
  const apkBytes = Buffer.from(await apk.arrayBuffer());
  assert.ok(
    apkBytes.equals(await fs.readFile("public/app-release.apk")),
    "Deployed APK must match the imported file",
  );
  assert.equal(apkBytes.subarray(0, 2).toString(), "PK");
  for (const obsolete of ["more", "audio-viz", "linear-go"]) {
    await assert.rejects(fs.access(`dist/${obsolete}`));
  }
  assert.deepEqual(errors, []);
  console.log(
    "PASS: desktop/mobile entry, portrait/landscape, explicit switches, remembered choices, direct poem links, blocked storage, poster assets, APK bytes, removed plugins, no overflow or script errors.",
  );
} finally {
  await browser.close();
}
