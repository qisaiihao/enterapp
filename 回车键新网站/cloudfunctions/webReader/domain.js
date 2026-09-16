const crypto = require("node:crypto");

const digest = (value) =>
  crypto.createHash("sha256").update(value).digest("hex");
function safeUser(user) {
  return {
    nickName: String(user.nickName || "诗友"),
    poemId: String(user.poemId || ""),
    bio: String(user.bio || ""),
    region: typeof user.region === "string" ? user.region : "",
    avatarUrl: String(user.avatarUrl || ""),
    signatureUrl: String(user.signatureUrl || ""),
  };
}
function safePost(post, author = {}) {
  // Never serialize the database document: anonymous owner IDs and moderation fields stay server-side.
  const anonymous = post.isAnonymous === true;
  return {
    _id: post._id,
    title: post.title || "",
    content: post.content || "",
    createTime: post.createTime,
    isOriginal: post.isOriginal === true,
    isAnonymous: anonymous,
    author: anonymous ? "" : post.author || "",
    authorName: anonymous
      ? "匿名诗人"
      : post.authorName ||
        post.authorNameSnapshot ||
        author.nickName ||
        "未署名",
    authorSignature: anonymous
      ? ""
      : (typeof post.authorSignature === "string" && post.authorSignature) ||
        (typeof author.signatureUrl === "string" && author.signatureUrl) ||
        "",
    tags: Array.isArray(post.tags) ? post.tags : [],
    highlightSentence: post.highlightSentence || "",
    highlightLines: post.highlightLines || [],
    backgroundColor:
      typeof post.backgroundColor === "string" ? post.backgroundColor : "",
    textColor: typeof post.textColor === "string" ? post.textColor : "",
    seriesPoems: (post.seriesPoems?.length
      ? post.seriesPoems
      : post.seriesBlocks || []
    ).map((b) => ({
      subtitle: b.subtitle || b.subTitle || "",
      content: b.content || "",
    })),
    imageUrls: Array.isArray(post.imageUrls)
      ? post.imageUrls
      : post.imageUrl
        ? [post.imageUrl]
        : [],
  };
}
function validateQuery(event) {
  const limit = event.limit === undefined ? 18 : event.limit;
  const skip = event.skip === undefined ? 0 : event.skip;
  if (
    !Number.isInteger(limit) ||
    limit < 1 ||
    limit > 36 ||
    !Number.isInteger(skip) ||
    skip < 0 ||
    skip > 100000
  )
    throw fault("INVALID_INPUT", "分页参数无效");
  if (
    event.query !== undefined &&
    (typeof event.query !== "string" || event.query.length > 80)
  )
    throw fault("INVALID_INPUT", "搜索内容请控制在 80 字以内");
  if (event.scope !== undefined && !["all", "mine"].includes(event.scope))
    throw fault("INVALID_INPUT", "无效的诗歌分类");
  if (
    event.kind !== undefined &&
    !["all", "original", "reprint"].includes(event.kind)
  )
    throw fault("INVALID_INPUT", "无效的作品类型");
  if (
    event.day &&
    (typeof event.day !== "string" ||
      !/^\d{4}-\d{2}-\d{2}$/.test(event.day) ||
      !Number.isFinite(Date.parse(`${event.day}T00:00:00Z`)) ||
      new Date(`${event.day}T00:00:00Z`).toISOString().slice(0, 10) !==
        event.day)
  )
    throw fault("INVALID_INPUT", "日期无效");
  return { limit, skip, query: (event.query || "").trim() };
}
function fault(code, message) {
  return Object.assign(new Error(message), { code, public: true });
}
const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
module.exports = {
  digest,
  safeUser,
  safePost,
  validateQuery,
  fault,
  escapeRegex,
};
