import test from "node:test";
import assert from "node:assert/strict";
import {
  readSitePreference,
  rememberSiteChoice,
  selectSite,
  SITE_PREFERENCE_KEY,
} from "../src/lib/siteEntry.js";

const desktop = {
  url: "https://poementer.com/",
  userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
  width: 1440,
  height: 900,
};
const phone = {
  ...desktop,
  userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Mobile",
  maxTouchPoints: 5,
  coarsePointer: true,
  width: 390,
  height: 844,
};

test("portrait phones/tablets enter classic; desktop and landscape enter reader", () => {
  assert.equal(selectSite(desktop), "reader");
  assert.equal(selectSite({ ...desktop, width: 390 }), "reader");
  assert.equal(
    selectSite({
      ...desktop,
      width: 768,
      height: 1024,
      maxTouchPoints: 10,
      coarsePointer: true,
    }),
    "reader",
  );
  assert.equal(selectSite(phone), "classic");
  assert.equal(selectSite({ ...phone, userAgent: "Android 15" }), "classic");
  assert.equal(
    selectSite({ ...phone, userAgent: "Macintosh", width: 1024, height: 1366 }),
    "classic",
  );
  assert.equal(selectSite({ ...phone, width: 844, height: 390 }), "reader");
});

test("manual choices and saved preferences override device detection", () => {
  assert.equal(selectSite({ ...desktop, preference: "classic" }), "classic");
  assert.equal(selectSite({ ...phone, preference: "reader" }), "reader");
  assert.equal(
    selectSite({
      ...phone,
      url: "https://poementer.com/?site=reader",
      preference: "classic",
    }),
    "reader",
  );
  assert.equal(
    selectSite({
      ...desktop,
      url: "https://poementer.com/?site=classic#/home",
      preference: "reader",
    }),
    "classic",
  );
  assert.equal(
    selectSite({
      ...phone,
      preference: "bad-value",
      url: "https://poementer.com/?site=bad-value",
    }),
    "classic",
  );
});

test("reader bookmarks and shared poem links bypass automatic landing and preferences", () => {
  for (const hash of [
    "#/home",
    "#/poems?id=abc",
    "#/mine?day=2026-09-22",
    "#/me",
    "#/about",
    "#/journal",
  ]) {
    assert.equal(
      selectSite({
        ...phone,
        url: `https://poementer.com/${hash}`,
        preference: "classic",
      }),
      "reader",
    );
  }
  assert.equal(
    selectSite({ ...phone, url: "https://poementer.com/#unknown" }),
    "classic",
  );
});

test("only explicit valid choices are remembered and disabled storage is supported", () => {
  const values = new Map();
  const storage = {
    getItem: (key) => values.get(key),
    setItem: (key, value) => values.set(key, value),
  };
  assert.equal(readSitePreference(storage), null);
  rememberSiteChoice("https://poementer.com/?site=reader", storage);
  assert.equal(values.get(SITE_PREFERENCE_KEY), "reader");
  rememberSiteChoice("https://poementer.com/?site=invalid", storage);
  assert.equal(readSitePreference(storage), "reader");
  const blocked = {
    getItem() {
      throw new Error("blocked");
    },
    setItem() {
      throw new Error("blocked");
    },
  };
  assert.equal(readSitePreference(blocked), null);
  assert.doesNotThrow(() =>
    rememberSiteChoice("https://poementer.com/?site=classic", blocked),
  );
  assert.equal(readSitePreference(null), null);
});
