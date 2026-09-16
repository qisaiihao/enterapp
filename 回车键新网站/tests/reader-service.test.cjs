const test = require("node:test");
const assert = require("node:assert/strict");
const vm = require("node:vm");
const fs = require("node:fs");
const domain = require("../cloudfunctions/webReader/domain.js");

function harness() {
  let caller = "browser-a";
  const now = new Date();
  const rows = {
    users: [
      {
        _id: "u1",
        _openid: "owner-a",
        poemId: "poet-a",
        password: "correct-password",
        nickName: "A",
        signatureUrl: "https://example.com/current-signature.png",
        phoneNumber: "secret",
      },
      {
        _id: "u2",
        _openid: "owner-b",
        poemId: "poet-b",
        password: "other-password",
        nickName: "B",
      },
    ],
    posts: [
      {
        _id: "public-a",
        _openid: "owner-a",
        isPoem: true,
        isOriginal: true,
        title: "月亮",
        content: "第一行\n\n第三行",
        createTime: now,
      },
      {
        _id: "hidden-a",
        _openid: "owner-a",
        isPoem: true,
        isHidden: true,
        createTime: now,
      },
      { _id: "deleted", isPoem: true, isDeleted: true, createTime: now },
      { _id: "private", isPoem: true, isPrivate: true, createTime: now },
      {
        _id: "discussion",
        isPoem: false,
        content: "a discussion",
        createTime: now,
      },
      {
        _id: "anonymous-a",
        _openid: "mask",
        realAuthorOpenid: "owner-a",
        isAnonymous: true,
        authorName: "secret name",
        authorSignature: "https://example.com/private-signature.png",
        isPoem: true,
        isOriginal: true,
        createTime: now,
      },
      {
        _id: "public-b",
        _openid: "owner-b",
        isPoem: true,
        isOriginal: false,
        createTime: now,
      },
    ],
    blocks: [],
    follows: [],
    web_reader_sessions: [],
    web_reader_limits: [],
  };
  const mutations = [];
  function op(predicate) {
    predicate.and = (other) => op((value) => predicate(value) && other(value));
    return predicate;
  }
  const getPath = (row, key) =>
    key.split(".").reduce((obj, part) => obj?.[part], row);
  function matches(row, condition) {
    if (typeof condition === "function") return condition(row);
    return Object.entries(condition).every(([key, value]) => {
      const actual = getPath(row, key);
      if (typeof value === "function") return value(actual);
      if (value instanceof RegExp) return value.test(String(actual || ""));
      return actual === value;
    });
  }
  const command = {
    neq: (target) => op((value) => value !== target),
    gte: (target) => op((value) => value >= target),
    lt: (target) => op((value) => value < target),
    in: (targets) => op((value) => targets.includes(value)),
    nin: (targets) => op((value) => !targets.includes(value)),
    and: (conditions) => (row) => conditions.every((c) => matches(row, c)),
    or: (conditions) => (row) => conditions.some((c) => matches(row, c)),
    inc: (value) => ({ $inc: value }),
    aggregate: { dateToString: (v) => v, sum: (v) => v },
  };
  const project = (row, fields) =>
    fields
      ? Object.fromEntries(
          Object.entries(row).filter(([key]) => key === "_id" || fields[key]),
        )
      : { ...row };
  function collection(name) {
    let condition = {},
      fields,
      skip = 0,
      limit = Infinity;
    const query = {
      where(value) {
        condition = value;
        return query;
      },
      field(value) {
        fields = value;
        return query;
      },
      orderBy() {
        return query;
      },
      skip(value) {
        skip = value;
        return query;
      },
      limit(value) {
        limit = value;
        return query;
      },
      async get() {
        return {
          data: rows[name]
            .filter((r) => matches(r, condition))
            .slice(skip, skip + limit)
            .map((r) => project(r, fields)),
        };
      },
      async count() {
        return {
          total: rows[name].filter((r) => matches(r, condition)).length,
        };
      },
      async remove() {
        mutations.push(name);
        rows[name] = rows[name].filter((r) => !matches(r, condition));
      },
      doc(id) {
        return {
          async get() {
            const data = rows[name].find((r) => r._id === id);
            if (!data) throw new Error("document does not exist");
            return { data };
          },
          async set({ data }) {
            mutations.push(name);
            rows[name] = rows[name].filter((r) => r._id !== id);
            rows[name].push({ ...data, _id: id });
          },
          async update({ data }) {
            mutations.push(name);
            const row = rows[name].find((r) => r._id === id);
            for (const [key, value] of Object.entries(data))
              row[key] = value.$inc ? row[key] + value.$inc : value;
          },
          async remove() {
            mutations.push(name);
            rows[name] = rows[name].filter((r) => r._id !== id);
          },
        };
      },
      aggregate() {
        return {
          match(value) {
            condition = value;
            return this;
          },
          group() {
            return this;
          },
          limit() {
            return this;
          },
          async end() {
            const counts = {};
            rows[name]
              .filter((r) => matches(r, condition))
              .forEach((r) => {
                const key = new Date(
                  new Date(r.createTime).getTime() + 8 * 3600000,
                )
                  .toISOString()
                  .slice(0, 10);
                counts[key] = (counts[key] || 0) + 1;
              });
            return {
              list: Object.entries(counts).map(([key, count]) => ({
                _id: key,
                count,
              })),
            };
          },
        };
      },
    };
    return query;
  }
  const db = {
    command,
    collection,
    RegExp: ({ regexp, options }) => new RegExp(regexp, options),
    runTransaction: (fn) => fn({ collection }),
  };
  const cloud = {
    init() {},
    database: () => db,
    getWXContext: () => ({ TCB_UUID: caller }),
    getTempFileURL: async () => ({ fileList: [] }),
  };
  const sandbox = {
    exports: {},
    require: (name) =>
      name === "wx-server-sdk"
        ? cloud
        : name === "./domain"
          ? domain
          : require(name),
    process: { env: {} },
    Buffer,
    console: { error() {} },
  };
  vm.runInNewContext(
    fs.readFileSync("cloudfunctions/webReader/index.js", "utf8"),
    sandbox,
  );
  return {
    main: sandbox.exports.main,
    rows,
    mutations,
    setCaller: (value) => {
      caller = value;
    },
  };
}

test("public listing and direct links never return hidden, deleted, private or non-poem documents", async () => {
  const h = harness();
  const result = await h.main({ action: "list" });
  assert.equal(result.success, true);
  assert.deepEqual(
    Array.from(result.posts, (p) => p._id),
    ["public-a", "anonymous-a", "public-b"],
  );
  for (const id of ["hidden-a", "deleted", "private", "discussion"])
    assert.equal((await h.main({ action: "detail", id })).code, "NOT_FOUND");
  assert.equal(JSON.stringify(result).includes("owner-a"), false);
  assert.equal(JSON.stringify(result).includes("secret name"), false);
  assert.equal(
    result.posts[0].authorSignature,
    "https://example.com/current-signature.png",
  );
  assert.equal(result.posts[1].authorSignature, "");
  assert.equal(result.posts[2].authorSignature, "");
  assert.equal(
    (await h.main({ action: "detail", id: "public-a" })).post.authorSignature,
    "https://example.com/current-signature.png",
  );
  h.rows.posts[0].authorSignature = "https://example.com/saved-signature.png";
  assert.equal(
    (await h.main({ action: "detail", id: "public-a" })).post.authorSignature,
    "https://example.com/saved-signature.png",
  );
  assert.equal(
    (await h.main({ action: "detail", id: "anonymous-a" })).post
      .authorSignature,
    "",
  );
  assert.equal(h.mutations.length, 0);
});
test("openid injection cannot access personal profile, poems or calendar", async () => {
  const h = harness();
  for (const event of [
    { action: "profile" },
    { action: "activity", year: 2026 },
    { action: "list", scope: "mine" },
  ]) {
    assert.equal(
      (await h.main({ ...event, openid: "owner-a" })).code,
      "AUTH_REQUIRED",
    );
    assert.equal(
      (await h.main({ ...event, token: "a".repeat(64), openid: "owner-a" }))
        .code,
      "AUTH_EXPIRED",
    );
  }
});
test("credential login creates a browser-bound session, own anonymous poems remain visible, logout revokes", async () => {
  const h = harness();
  assert.equal(
    (await h.main({ action: "login", poemId: "poet-a", password: "wrong" }))
      .code,
    "INVALID_CREDENTIALS",
  );
  const login = await h.main({
    action: "login",
    poemId: "poet-a",
    password: "correct-password",
  });
  assert.equal(login.success, true);
  assert.equal(login.token.length, 64);
  assert.equal("password" in login.user, false);
  assert.equal("phoneNumber" in login.user, false);
  assert.notEqual(h.rows.web_reader_sessions[0]._id, login.token);
  const mine = await h.main({
    action: "list",
    scope: "mine",
    token: login.token,
    openid: "owner-b",
  });
  assert.deepEqual(
    Array.from(mine.posts, (p) => p._id),
    ["public-a", "anonymous-a"],
  );
  h.setCaller("browser-b");
  assert.equal(
    (await h.main({ action: "profile", token: login.token })).code,
    "AUTH_EXPIRED",
  );
  h.setCaller("browser-a");
  assert.equal(
    (await h.main({ action: "profile", token: login.token })).user.nickName,
    "A",
  );
  assert.equal(
    (await h.main({ action: "logout", token: login.token })).success,
    true,
  );
  assert.equal(
    (await h.main({ action: "profile", token: login.token })).code,
    "AUTH_EXPIRED",
  );
  assert.ok(
    h.mutations.every((name) => name.startsWith("web_reader_")),
    "No App collection may be modified",
  );
});
test("login throttling persists between requests and expired sessions fail", async () => {
  const h = harness();
  for (let i = 0; i < 15; i++)
    assert.equal(
      (await h.main({ action: "login", poemId: "poet-a", password: "wrong" }))
        .code,
      "INVALID_CREDENTIALS",
    );
  assert.equal(
    (
      await h.main({
        action: "login",
        poemId: "poet-a",
        password: "correct-password",
      })
    ).code,
    "RATE_LIMIT",
  );
  h.rows.web_reader_sessions.push({
    _id: domain.digest("b".repeat(64)),
    owner: "owner-a",
    caller: "browser-a",
    expiresAt: new Date(0),
  });
  assert.equal(
    (await h.main({ action: "profile", token: "b".repeat(64) })).code,
    "AUTH_EXPIRED",
  );
});
test("blocking, literal search, date filtering and pagination stay server-side", async () => {
  const h = harness();
  const login = await h.main({
    action: "login",
    poemId: "poet-a",
    password: "correct-password",
  });
  h.rows.blocks.push({ blockerId: "owner-a", blockedId: "owner-b" });
  const list = await h.main({ action: "list", token: login.token, limit: 1 });
  assert.equal(list.total, 2);
  assert.equal(list.hasMore, true);
  assert.equal(
    (await h.main({ action: "detail", token: login.token, id: "public-b" }))
      .code,
    "NOT_FOUND",
  );
  assert.equal((await h.main({ action: "list", query: ".*" })).total, 0);
  assert.equal((await h.main({ action: "list", query: "月亮" })).total, 1);
  assert.equal(
    (await h.main({ action: "list", day: "2026-02-30" })).code,
    "INVALID_INPUT",
  );
  assert.equal(
    (await h.main({ action: "delete", id: "public-a" })).code,
    "INVALID_ACTION",
  );
});
