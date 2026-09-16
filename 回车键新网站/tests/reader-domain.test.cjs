const test = require("node:test");
const assert = require("node:assert/strict");
const {
  safeUser,
  safePost,
  validateQuery,
  escapeRegex,
  digest,
} = require("../cloudfunctions/webReader/domain.js");

test("public profile is an allowlist without passwords, phone or owner identifiers", () => {
  const input = {
    nickName: "诗友",
    poemId: "123",
    password: "secret",
    phoneNumber: "private",
    _openid: "private",
    role: "admin",
  };
  const result = safeUser(input);
  assert.equal(result.nickName, "诗友");
  for (const key of ["password", "phoneNumber", "_openid", "role"])
    assert.equal(key in result, false);
});
test("anonymous poem strips owner, real author and nested identity fields", () => {
  const result = safePost({
    _id: "poem",
    isAnonymous: true,
    author: "private",
    authorName: "private",
    authorSignature: "https://example.com/private-signature.png",
    backgroundColor: "#906161",
    textColor: "#F8F4EA",
    _openid: "private",
    realAuthorOpenid: "private",
    seriesPoems: [{ content: "hello", realAuthorOpenid: "private" }],
  });
  assert.equal(result.authorName, "匿名诗人");
  assert.equal(result.authorSignature, "");
  assert.equal(result.backgroundColor, "#906161");
  assert.equal(result.textColor, "#F8F4EA");
  assert.equal(JSON.stringify(result).includes("private"), false);
});
test("pagination, scope and search input validation reject unbounded or object injection", () => {
  for (const event of [
    { skip: -1 },
    { limit: 10000 },
    { skip: 0.5 },
    { query: { $ne: "" } },
    { query: "x".repeat(81) },
    { scope: "private" },
    { kind: "drafts" },
    { day: "garbage" },
  ])
    assert.throws(() => validateQuery(event));
  assert.deepEqual(validateQuery({ query: " 月光 " }), {
    skip: 0,
    limit: 18,
    query: "月光",
  });
});
test("search is literal, and stored tokens are one-way digests", () => {
  const input = "x.*(y)[z]$";
  assert.equal(new RegExp(escapeRegex(input)).test(input), true);
  assert.equal(new RegExp(escapeRegex(input)).test("xxxxy"), false);
  assert.equal(digest("token").length, 64);
  assert.notEqual(digest("a"), digest("b"));
});
