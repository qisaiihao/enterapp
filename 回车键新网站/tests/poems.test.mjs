import test from "node:test";
import assert from "node:assert/strict";
import {
  dayKey,
  asDate,
  normalizePoem,
  calendarDays,
  summarizeDays,
} from "../src/lib/poems.js";

test("CloudBase date variants use Beijing day boundaries", () => {
  assert.equal(dayKey("2026-09-15T16:01:00Z"), "2026-09-16");
  assert.equal(dayKey({ $date: "2026-09-15T15:59:00Z" }), "2026-09-15");
  assert.equal(asDate({ seconds: 100 }).getTime(), 100000);
  assert.equal(asDate({ _seconds: 100 }).getTime(), 100000);
  assert.equal(asDate("invalid"), null);
  assert.equal(dayKey(null), "");
});
test("series retain stanzas and anonymous content never displays real attribution", () => {
  const poem = normalizePoem({
    _id: "1",
    isAnonymous: true,
    author: "private author",
    authorName: "private name",
    authorSignature: "https://example.com/private-signature.png",
    seriesBlocks: [
      { subTitle: "一", content: "第一行\r\n\r\n第三行" },
      { subtitle: "二", content: "<script>alert(1)</script>" },
    ],
  });
  assert.equal(poem.author, "匿名诗人");
  assert.equal(poem.authorSignature, "");
  assert.equal(poem.series[0].content, "第一行\n\n第三行");
  assert.match(poem.fullText, /第三行\n\n二/);
  assert.ok(poem.fullText.includes("<script>"));
});
test("malformed remote fields and insecure image URLs have safe fallbacks", () => {
  const poem = normalizePoem({
    _id: "x",
    createTime: "bad",
    tags: ["诗", { name: "bad" }],
    imageUrls: ["javascript:alert(1)", "http://a.com/x", "https://a.com/x"],
  });
  assert.equal(poem.title, "无题");
  assert.equal(poem.date, "");
  assert.deepEqual(poem.tags, ["诗"]);
  assert.deepEqual(poem.images, ["https://a.com/x"]);
});
test("calendar handles leap days, Monday alignment, padding and future cells", () => {
  const cells = calendarDays(
    2024,
    { "2024-02-29": 5 },
    new Date("2024-03-01T00:00:00Z"),
  );
  assert.equal(cells.filter((c) => !c.outside).length, 366);
  assert.equal(cells.length % 7, 0);
  assert.equal(cells[0].key, "2024-01-01");
  assert.equal(cells.find((c) => c.key === "2024-02-29").level, 4);
  assert.equal(cells.find((c) => c.key === "2024-03-02").future, true);
  assert.equal(calendarDays(2026).filter((c) => !c.outside).length, 365);
});
test("creation summary counts real active days and longest consecutive streak", () => {
  assert.deepEqual(
    summarizeDays({
      "2026-01-01": 2,
      "2026-01-02": 1,
      "2026-01-03": 0,
      "2026-01-04": 3,
    }),
    { total: 6, days: 3, longest: 2 },
  );
  assert.deepEqual(summarizeDays({}), { total: 0, days: 0, longest: 0 });
});
