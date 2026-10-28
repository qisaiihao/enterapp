const cloud = require("wx-server-sdk");
const crypto = require("node:crypto");
const {
  digest,
  safeUser,
  safePost,
  validateQuery,
  fault,
  escapeRegex,
} = require("./domain");
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;
const SESSION_MS = 7 * 86400000;

function callerId() {
  const ctx = cloud.getWXContext();
  return String(
    ctx.TCB_UUID ||
      ctx.CUSTOM_USER_ID ||
      ctx.OPENID ||
      process.env.TCB_UUID ||
      "",
  );
}

async function session(token) {
  if (typeof token !== "string" || !/^[a-f0-9]{64}$/.test(token))
    throw fault("AUTH_REQUIRED", "请先登录回车键账号");
  const result = await db
    .collection("web_reader_sessions")
    .where({ _id: digest(token) })
    .limit(1)
    .get();
  const row = result.data[0];
  if (
    !row ||
    new Date(row.expiresAt).getTime() <= Date.now() ||
    row.caller !== callerId()
  )
    throw fault("AUTH_EXPIRED", "登录已过期，请重新登录");
  return row;
}

async function limitLogin(poemId) {
  // Atomic, durable limits for both CloudBase identity and account; not per function instance.
  const window = Math.floor(Date.now() / (15 * 60000));
  for (const [type, value, max] of [
    ["caller", callerId(), 15],
    ["account", poemId, 30],
  ]) {
    const id = digest(`${type}:${value}:${window}`);
    await db.runTransaction(async (transaction) => {
      const ref = transaction.collection("web_reader_limits").doc(id);
      let data;
      try {
        data = (await ref.get()).data;
      } catch (error) {
        if (
          !/not exist|does not exist|not found|DATABASE_DOCUMENT_NOT_EXIST/i.test(
            error.errMsg || error.message || "",
          )
        )
          throw error;
      }
      if (data && data.count >= max)
        throw fault("RATE_LIMIT", "尝试次数较多，请在 15 分钟后重试");
      if (data) await ref.update({ data: { count: _.inc(1) } });
      else
        await ref.set({
          data: { count: 1, expiresAt: new Date((window + 2) * 15 * 60000) },
        });
    });
  }
}

async function cleanupExpiredSessions() {
  for (const name of ["web_reader_sessions", "web_reader_limits"]) {
    const expired = await db
      .collection(name)
      .where({ expiresAt: _.lt(new Date()) })
      .field({ _id: true })
      .limit(50)
      .get();
    if (expired.data.length)
      await db
        .collection(name)
        .where({ _id: _.in(expired.data.map((row) => row._id)) })
        .remove();
  }
}

async function resolveImages(value) {
  const ids = new Set();
  const collect = (obj) => {
    if (typeof obj === "string" && obj.startsWith("cloud://")) ids.add(obj);
    else if (Array.isArray(obj)) obj.forEach(collect);
    else if (obj && typeof obj === "object" && !(obj instanceof Date))
      Object.values(obj).forEach(collect);
  };
  collect(value);
  if (!ids.size) return value;
  const map = new Map();
  const fileIDs = [...ids];
  for (let offset = 0; offset < fileIDs.length; offset += 50) {
    try {
      const result = await cloud.getTempFileURL({
        fileList: fileIDs.slice(offset, offset + 50),
      });
      result.fileList.forEach((f) => {
        if (f.status === 0) map.set(f.fileID, f.tempFileURL);
      });
    } catch {
      /* Keep text readable and continue resolving later image batches. */
    }
  }
  const replace = (obj) => {
    if (typeof obj === "string" && obj.startsWith("cloud://"))
      return map.get(obj) || "";
    if (Array.isArray(obj)) return obj.map(replace);
    if (obj && typeof obj === "object" && !(obj instanceof Date))
      return Object.fromEntries(
        Object.entries(obj).map(([k, v]) => [k, replace(v)]),
      );
    return obj;
  };
  return replace(value);
}

async function ownerProfile(openid) {
  const results = await Promise.all([
    db
      .collection("users")
      .where({ _openid: openid })
      .field({
        nickName: true,
        poemId: true,
        bio: true,
        region: true,
        avatarUrl: true,
        signatureUrl: true,
      })
      .limit(1)
      .get(),
    db.collection("follows").where({ followerId: openid }).count(),
    db.collection("follows").where({ followedId: openid }).count(),
  ]);
  if (!results[0].data[0])
    throw fault("AUTH_EXPIRED", "账号不存在，请重新登录");
  return resolveImages({
    ...safeUser(results[0].data[0]),
    following: results[1].total,
    followers: results[2].total,
  });
}

async function filters(event, owner) {
  const clauses = [
    {
      isPoem: true,
      isHidden: _.neq(true),
      isDeleted: _.neq(true),
      isPrivate: _.neq(true),
      isActivityPost: _.neq(true),
    },
  ];
  if (event.scope === "mine") {
    clauses.push(_.or([{ _openid: owner }, { realAuthorOpenid: owner }]));
  }
  if (event.kind === "original") clauses.push({ isOriginal: true });
  if (event.kind === "reprint") clauses.push({ isOriginal: _.neq(true) });
  if (event.day) {
    const start = new Date(`${event.day}T00:00:00+08:00`);
    clauses.push({
      createTime: _.gte(start).and(_.lt(new Date(start.getTime() + 86400000))),
    });
  }
  if (event.query?.trim()) {
    const regex = db.RegExp({
      regexp: escapeRegex(event.query.trim()),
      options: "i",
    });
    clauses.push(
      _.or([
        { title: regex },
        { content: regex },
        { author: regex },
        { authorName: regex },
        { "seriesPoems.content": regex },
        { "seriesBlocks.content": regex },
      ]),
    );
  }
  if (owner) {
    // Honor the App's block list without returning any blocked/anonymous identity.
    const blocked = await db
      .collection("blocks")
      .where({ blockerId: owner })
      .field({ blockedId: true })
      .limit(1000)
      .get();
    const ids = blocked.data.map((b) => b.blockedId).filter(Boolean);
    if (ids.length && event.scope !== "mine")
      clauses.push({ _openid: _.nin(ids), realAuthorOpenid: _.nin(ids) });
  }
  return _.and(clauses);
}

async function list(event, owner) {
  const { skip, limit } = validateQuery(event);
  const where = await filters(event, owner);
  const [posts, count] = await Promise.all([
    db
      .collection("posts")
      .where(where)
      .orderBy("createTime", "desc")
      .orderBy("_id", "desc")
      .skip(skip)
      .limit(limit)
      .get(),
    db.collection("posts").where(where).count(),
  ]);
  return {
    posts: await publicPosts(posts.data),
    total: count.total,
    hasMore: skip + posts.data.length < count.total,
  };
}

async function publicPosts(posts) {
  const ids = [
    ...new Set(
      posts
        .filter((p) => !p.isAnonymous)
        .map((p) => p._openid)
        .filter(Boolean),
    ),
  ];
  const authors = ids.length
    ? (
        await db
          .collection("users")
          .where({ _openid: _.in(ids) })
          .field({ _openid: true, nickName: true, signatureUrl: true })
          .limit(100)
          .get()
      ).data
    : [];
  const names = new Map(authors.map((a) => [a._openid, a]));
  return resolveImages(posts.map((p) => safePost(p, names.get(p._openid))));
}

function libraryCollections(kind) {
  if (kind === "portfolio") return ["portfolio_folders", "portfolio_items"];
  if (kind === "favorite") return ["favorite_folders", "favorites"];
  throw fault("INVALID_INPUT", "无效的收藏分类");
}

async function folders(event, owner) {
  const { skip, limit } = validateQuery({
    skip: event.skip,
    limit: event.limit,
  });
  const [folderCollection, itemCollection] = libraryCollections(
    event.libraryKind,
  );
  const [result, count] = await Promise.all([
    db
      .collection(folderCollection)
      .where({ _openid: owner })
      .orderBy("createTime", "desc")
      .orderBy("_id", "desc")
      .skip(skip)
      .limit(limit)
      .get(),
    db.collection(folderCollection).where({ _openid: owner }).count(),
  ]);
  const data = await Promise.all(
    result.data.map(async (folder) => {
      const items = await db
        .collection(itemCollection)
        .where({ _openid: owner, folderId: folder._id })
        .count();
      return {
        id: folder._id,
        name: String(folder.name || "未命名"),
        coverUrl:
          typeof folder.coverUrl === "string" &&
          /^(https:\/\/|cloud:\/\/)/i.test(folder.coverUrl)
            ? folder.coverUrl
            : "",
        itemCount: items.total,
      };
    }),
  );
  return {
    folders: await resolveImages(data),
    total: count.total,
    hasMore: skip + data.length < count.total,
  };
}

async function folderPoems(event, owner) {
  const { skip, limit } = validateQuery({
    skip: event.skip,
    limit: event.limit,
  });
  const [folderCollection, itemCollection] = libraryCollections(
    event.libraryKind,
  );
  if (
    typeof event.folderId !== "string" ||
    !event.folderId ||
    event.folderId.length > 128
  )
    throw fault("INVALID_INPUT", "文件夹地址无效");
  const folder = await db
    .collection(folderCollection)
    .where({ _id: event.folderId, _openid: owner })
    .limit(1)
    .get();
  if (!folder.data.length) throw fault("NOT_FOUND", "文件夹不存在或不可访问");
  const where = { _openid: owner, folderId: event.folderId };
  const [items, count] = await Promise.all([
    db
      .collection(itemCollection)
      .where(where)
      .orderBy("createTime", "desc")
      .orderBy("_id", "desc")
      .skip(skip)
      .limit(limit)
      .get(),
    db.collection(itemCollection).where(where).count(),
  ]);
  const ids = [
    ...new Set(
      items.data
        .map((item) => item.postId)
        .filter((id) => typeof id === "string" && id),
    ),
  ];
  const visible = await filters({ scope: "all" }, owner);
  const posts = ids.length
    ? (
        await db
          .collection("posts")
          .where(_.and([visible, { _id: _.in(ids) }]))
          .limit(limit)
          .get()
      ).data
    : [];
  const positions = new Map(ids.map((id, index) => [id, index]));
  posts.sort((a, b) => positions.get(a._id) - positions.get(b._id));
  const nextSkip = skip + items.data.length;
  return {
    posts: await publicPosts(posts),
    nextSkip,
    hasMore: nextSkip < count.total,
  };
}

async function activity(event, owner) {
  const year = Number(event.year);
  if (
    !Number.isInteger(year) ||
    year < 2000 ||
    year > new Date().getUTCFullYear() + 1
  )
    throw fault("INVALID_INPUT", "年份无效");
  const where = await filters({ scope: "mine", kind: "original" }, owner);
  const result = await db
    .collection("posts")
    .aggregate()
    .match(
      _.and([
        where,
        {
          createTime: _.gte(new Date(`${year}-01-01T00:00:00+08:00`)).and(
            _.lt(new Date(`${year + 1}-01-01T00:00:00+08:00`)),
          ),
        },
      ]),
    )
    .group({
      _id: _.aggregate.dateToString({
        date: "$createTime",
        format: "%Y-%m-%d",
        timezone: "+08:00",
      }),
      count: _.aggregate.sum(1),
    })
    .limit(366)
    .end();
  return {
    counts: Object.fromEntries(result.list.map((r) => [r._id, r.count])),
  };
}

exports.main = async (event = {}) => {
  try {
    const action = event.action || "list";
    if (
      ![
        "list",
        "detail",
        "login",
        "logout",
        "profile",
        "activity",
        "folders",
        "folderPoems",
      ].includes(action)
    )
      throw fault("INVALID_ACTION", "此页面仅提供阅读功能");
    if (action === "login") {
      if (!callerId())
        throw fault("CLOUD_AUTH_REQUIRED", "阅读服务暂不可用，请刷新后再试");
      if (
        typeof event.poemId !== "string" ||
        !event.poemId.trim() ||
        event.poemId.length > 64 ||
        typeof event.password !== "string" ||
        !event.password ||
        event.password.length > 128
      )
        throw fault("INVALID_INPUT", "请输入 Poem ID 和密码");
      const poemId = event.poemId.trim();
      await limitLogin(poemId);
      await cleanupExpiredSessions();
      // Match the existing App credential schema without its legacy user-document logging.
      const account = (
        await db
          .collection("users")
          .where({ poemId })
          .field({ _openid: true, password: true })
          .limit(1)
          .get()
      ).data[0];
      const expected = digest(
        typeof account?.password === "string" ? account.password : "",
      );
      const actual = digest(event.password);
      if (
        !account?._openid ||
        !crypto.timingSafeEqual(
          Buffer.from(expected, "hex"),
          Buffer.from(actual, "hex"),
        )
      )
        throw fault("INVALID_CREDENTIALS", "Poem ID 或密码不正确");
      const token = crypto.randomBytes(32).toString("hex");
      const expiresAt = new Date(Date.now() + SESSION_MS);
      await db
        .collection("web_reader_sessions")
        .doc(digest(token))
        .set({
          data: { owner: account._openid, caller: callerId(), expiresAt },
        });
      return {
        success: true,
        token,
        expiresAt: expiresAt.toISOString(),
        user: await ownerProfile(account._openid),
      };
    }
    let owner = "";
    if (
      ["logout", "profile", "activity", "folders", "folderPoems"].includes(
        action,
      ) ||
      event.scope === "mine" ||
      event.token
    )
      owner = (await session(event.token)).owner;
    if (action === "logout") {
      await db
        .collection("web_reader_sessions")
        .doc(digest(event.token))
        .remove();
      return { success: true };
    }
    if (action === "profile")
      return { success: true, user: await ownerProfile(owner) };
    if (action === "folders")
      return { success: true, ...(await folders(event, owner)) };
    if (action === "folderPoems")
      return { success: true, ...(await folderPoems(event, owner)) };
    if (action === "activity")
      return { success: true, ...(await activity(event, owner)) };
    if (action === "detail") {
      if (typeof event.id !== "string" || !event.id || event.id.length > 128)
        throw fault("INVALID_INPUT", "诗歌地址无效");
      const where = await filters({ scope: "all" }, owner);
      const result = await db
        .collection("posts")
        .where(_.and([where, { _id: event.id }]))
        .limit(1)
        .get();
      if (!result.data[0])
        throw fault("NOT_FOUND", "这首诗不存在、已隐藏或暂不可见");
      const post = result.data[0];
      const authors = post.isAnonymous
        ? []
        : (
            await db
              .collection("users")
              .where({ _openid: post._openid })
              .field({ nickName: true, signatureUrl: true })
              .limit(1)
              .get()
          ).data;
      return {
        success: true,
        post: await resolveImages(safePost(post, authors[0])),
      };
    }
    return { success: true, ...(await list(event, owner)) };
  } catch (error) {
    // No event, credentials, access tokens, or user documents in logs/errors.
    if (!error.public)
      console.error(
        "[webReader]",
        error.code || error.errCode || "INTERNAL_ERROR",
      );
    return {
      success: false,
      code: error.public ? error.code : "SERVICE_ERROR",
      message: error.public ? error.message : "阅读服务暂时不可用，请稍后重试",
    };
  }
};
