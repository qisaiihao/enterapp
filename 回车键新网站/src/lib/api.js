import { demoPosts, demoUser, demoActivity } from "./demo";
import { dayKey, normalizePoem } from "./poems";

const MODE_KEY = "poementer:mode";
const SESSION_KEY = "poementer:web-session";
const DEMO_KEY = "poementer:demo-login";
const storage = {
  get(key) {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(key, value);
    } catch {
      /* in-memory session still works */
    }
  },
  remove(key) {
    try {
      localStorage.removeItem(key);
    } catch {
      /* private browsing */
    }
  },
};
export const initialMode =
  storage.get(MODE_KEY) || import.meta.env.VITE_DATA_MODE || "cloud";
let mode = initialMode === "demo" ? "demo" : "cloud";
let demoLoggedIn = storage.get(DEMO_KEY) === "yes";
let token = storage.get(SESSION_KEY) || "";
let cloudPromise;

export function setMode(next) {
  mode = next === "demo" ? "demo" : "cloud";
  storage.set(MODE_KEY, mode);
}
export function clearSession() {
  token = "";
  storage.remove(SESSION_KEY);
}
export function hasSession() {
  return mode === "demo" ? demoLoggedIn : Boolean(token);
}
export function currentMode() {
  return mode;
}

async function client() {
  if (!cloudPromise)
    cloudPromise = (async () => {
      const { default: cloudbase } = await import("@cloudbase/js-sdk");
      const app = cloudbase.init({
        env: import.meta.env.VITE_CLOUDBASE_ENV || "cloud1-5gb0pbyl400845f5",
        region: import.meta.env.VITE_CLOUDBASE_REGION || "ap-shanghai",
        timeout: 18000,
        auth: { persistence: "local" },
      });
      const auth = app.auth();
      const loginState = await auth.getLoginState();
      if (!loginState) {
        const result = await auth.signInAnonymously();
        if (result?.error) throw new Error("云端连接未完成");
      }
      return app;
    })().catch((error) => {
      cloudPromise = null;
      throw error;
    });
  return cloudPromise;
}

async function call(action, data = {}) {
  try {
    const app = await client();
    const response = await app.callFunction({
      name: import.meta.env.VITE_READER_FUNCTION || "webReader",
      data: { ...data, action, ...(token ? { token } : {}) },
    });
    const result =
      typeof response.result === "string"
        ? JSON.parse(response.result)
        : response.result;
    if (!result?.success) {
      if (["AUTH_EXPIRED", "AUTH_REQUIRED"].includes(result?.code))
        clearSession();
      throw Object.assign(new Error(result?.message || "阅读服务暂时不可用"), {
        code: result?.code,
        friendly: true,
      });
    }
    return result;
  } catch (error) {
    if (error.friendly) throw error;
    throw Object.assign(new Error("暂时连接不上诗歌书架，请稍后重试。"), {
      code: "CONNECTION_ERROR",
    });
  }
}

export async function login(poemId, password) {
  if (mode === "demo")
    throw new Error("示例模式不接收账号密码，请使用“体验示例账号”");
  const result = await call("login", { poemId: poemId.trim(), password });
  token = result.token;
  storage.set(SESSION_KEY, token);
  return result.user;
}
export function loginDemo() {
  demoLoggedIn = true;
  storage.set(DEMO_KEY, "yes");
  return { ...demoUser };
}
export async function logout() {
  if (mode === "demo") {
    demoLoggedIn = false;
    storage.remove(DEMO_KEY);
    return;
  }
  try {
    if (token) await call("logout");
  } finally {
    clearSession();
  }
}
export async function profile() {
  if (mode === "demo") {
    if (!demoLoggedIn)
      throw Object.assign(new Error("请先登录"), { code: "AUTH_REQUIRED" });
    return { ...demoUser };
  }
  return (await call("profile")).user;
}

export async function listPoems({
  scope = "all",
  kind = "all",
  query = "",
  skip = 0,
  limit = 18,
  day = "",
} = {}) {
  if (mode === "demo") {
    if (scope === "mine" && !demoLoggedIn)
      throw Object.assign(new Error("请先登录"), { code: "AUTH_REQUIRED" });
    const filtered = demoPosts.filter(
      (p) =>
        (scope !== "mine" || p.authorName === demoUser.nickName) &&
        (kind === "all" ||
          (kind === "original" ? p.isOriginal : !p.isOriginal)) &&
        (!day || dayKey(p.createTime) === day) &&
        (!query ||
          [
            p.title,
            p.content,
            p.authorName,
            ...(p.seriesPoems || []).map((b) => b.content),
          ]
            .join("\n")
            .toLowerCase()
            .includes(query.toLowerCase())),
    );
    return {
      poems: filtered.slice(skip, skip + limit).map(normalizePoem),
      total: filtered.length,
      hasMore: skip + limit < filtered.length,
    };
  }
  const result = await call("list", { scope, kind, query, skip, limit, day });
  return {
    poems: (result.posts || []).map(normalizePoem),
    total: result.total || 0,
    hasMore: result.hasMore === true,
  };
}
export async function poemDetail(id) {
  if (mode === "demo") {
    const post = demoPosts.find((p) => p._id === id);
    if (!post) throw new Error("这首诗不存在或已不再公开");
    return normalizePoem(post);
  }
  return normalizePoem((await call("detail", { id })).post);
}
export async function activity(year) {
  if (mode === "demo") {
    if (!demoLoggedIn) throw new Error("请先登录");
    return demoActivity(year);
  }
  return (await call("activity", { year })).counts || {};
}

const demoFolders = {
  portfolio: [
    {
      id: "demo-portfolio",
      name: "日常的诗",
      coverUrl: "",
      postIds: demoPosts
        .filter((p) => p.authorName === demoUser.nickName)
        .map((p) => p._id),
    },
    { id: "demo-empty", name: "尚未落笔", coverUrl: "", postIds: [] },
  ],
  favorite: [
    {
      id: "demo-favorite",
      name: "值得重读",
      coverUrl: "",
      postIds: ["sample-2", "sample-4", "sample-7"],
    },
  ],
};

export async function listFolders(libraryKind, skip = 0) {
  if (mode === "demo") {
    if (!demoLoggedIn)
      throw Object.assign(new Error("请先登录"), { code: "AUTH_REQUIRED" });
    const folders = demoFolders[libraryKind] || [];
    return {
      folders: folders
        .slice(skip, skip + 12)
        .map((folder) => ({ ...folder, itemCount: folder.postIds.length })),
      total: folders.length,
      hasMore: skip + 12 < folders.length,
    };
  }
  return call("folders", { libraryKind, skip, limit: 12 });
}

export async function listFolderPoems(libraryKind, folderId, skip = 0) {
  if (mode === "demo") {
    if (!demoLoggedIn)
      throw Object.assign(new Error("请先登录"), { code: "AUTH_REQUIRED" });
    const folder = demoFolders[libraryKind]?.find(
      (item) => item.id === folderId,
    );
    if (!folder) throw new Error("文件夹不存在或不可访问");
    return {
      poems: folder.postIds
        .slice(skip, skip + 18)
        .map((id) => normalizePoem(demoPosts.find((p) => p._id === id))),
      nextSkip: Math.min(skip + 18, folder.postIds.length),
      hasMore: skip + 18 < folder.postIds.length,
    };
  }
  const result = await call("folderPoems", {
    libraryKind,
    folderId,
    skip,
    limit: 18,
  });
  return { ...result, poems: (result.posts || []).map(normalizePoem) };
}
