import test from "node:test";
import assert from "node:assert/strict";
import {
  dayKey,
  asDate,
  normalizePoem,
  randomHighlight,
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
test("card excerpts prefer all selected highlights while preserving full text", () => {
  const poem = normalizePoem({
    content: "正文开头\r\n正文结尾",
    highlightSentence: "旧的单句高光",
    highlightLines: [" 高光一\r\n高光二 ", "", null, "高光三"],
  });
  assert.equal(poem.excerpt, "高光一\n高光二\n高光三");
  assert.equal(poem.fullText, "正文开头\n正文结尾");
});

test("empty or malformed highlights fall back to a legacy sentence, then full text", () => {
  for (const highlightLines of [undefined, [], [" ", null, 3], "invalid"]) {
    assert.equal(
      normalizePoem({ highlightLines, highlightSentence: " 单句高光 " })
        .excerpt,
      "单句高光",
    );
    assert.equal(
      normalizePoem({
        highlightLines,
        highlightSentence: " \n",
        content: " 正文 ",
      }).excerpt,
      "正文",
    );
  }
  assert.equal(
    normalizePoem({
      highlightSentence: {},
      seriesBlocks: [{ subtitle: "一", content: "组诗正文" }],
    }).excerpt,
    "一\n组诗正文",
  );
});

test("footer randomly chooses saved highlights, excludes body fallbacks and duplicate lines", () => {
  const poems = [
    normalizePoem({
      _id: "poem-a",
      authorName: "甲",
      highlightLines: [" 高光一\r\n高光二 ", null, "高光一"],
      highlightSentence: "旧高光",
      content: "正文",
    }),
    normalizePoem({
      _id: "poem-b",
      authorName: "乙",
      highlightSentence: " 旧格式高光 ",
    }),
    normalizePoem({ content: "只有正文，不是高光" }),
  ];
  assert.deepEqual(poems[0].highlights, ["高光一", "高光二"]);
  assert.deepEqual(poems[2].highlights, []);
  assert.deepEqual(
    randomHighlight(poems, () => 0),
    { text: "高光一", author: "甲", poemId: "poem-a" },
  );
  assert.deepEqual(
    randomHighlight(poems, () => 0.5),
    { text: "高光二", author: "甲", poemId: "poem-a" },
  );
  assert.deepEqual(
    randomHighlight(poems, () => 0.999),
    { text: "旧格式高光", author: "乙", poemId: "poem-b" },
  );
  assert.equal(randomHighlight([poems[2]]), null);
  assert.equal(randomHighlight([]), null);
});

test("highlight attribution stays with its source even for identical lines and anonymous poems", () => {
  const poems = [
    normalizePoem({
      _id: "a",
      authorName: "甲",
      highlightLines: ["同一句高光"],
    }),
    normalizePoem({
      _id: "b",
      authorName: "真实姓名",
      isAnonymous: true,
      highlightLines: ["同一句高光"],
    }),
    normalizePoem({
      _id: "c",
      isOriginal: false,
      author: "原作者",
      authorName: "转载者",
      highlightLines: ["转载高光"],
    }),
  ];
  assert.deepEqual(
    randomHighlight(poems, () => 0.5),
    { text: "同一句高光", author: "匿名诗人", poemId: "b" },
  );
  assert.deepEqual(
    randomHighlight(poems, () => 0.999),
    { text: "转载高光", author: "原作者", poemId: "c" },
  );
});

test("footer removes trailing author descriptions from reprints without changing stored attribution or nicknames", () => {
  for (const author of [
    "Robert Frost（未选择的路作者",
    "Robert Frost（《未选择的路》作者）",
    "Robert Frost (未选择的路作者)",
  ]) {
    const poem = normalizePoem({
      isOriginal: false,
      author,
      highlightLines: ["高光"],
    });
    assert.equal(randomHighlight([poem]).author, "Robert Frost");
    assert.equal(poem.author, author);
  }
  for (const [raw, expected] of [
    [{ isOriginal: true, authorName: "林间（诗人）" }, "林间（诗人）"],
    [
      { isOriginal: false, author: "罗伯特（Robert Frost）" },
      "罗伯特（Robert Frost）",
    ],
    [{ isOriginal: false, author: "（佚名作者）" }, "（佚名作者）"],
    [{ isAnonymous: true, author: "Robert Frost（未选择的路作者" }, "匿名诗人"],
  ]) {
    assert.equal(
      randomHighlight([normalizePoem({ ...raw, highlightLines: ["高光"] })])
        .author,
      expected,
    );
  }
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
