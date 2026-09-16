<script setup>
import {
  ref,
  computed,
  watch,
  onMounted,
  onBeforeUnmount,
  nextTick,
} from "vue";
import PoemCard from "./components/PoemCard.vue";
import PoemReader from "./components/PoemReader.vue";
import ActivityCalendar from "./components/ActivityCalendar.vue";
import LoginDialog from "./components/LoginDialog.vue";
import * as api from "./lib/api";
import { dayKey, summarizeDays } from "./lib/poems";

function readRoute() {
  const [path, search = ""] = location.hash.slice(1).split("?");
  const page = (path || "/home").replace(/^\//, "");
  const params = new URLSearchParams(search);
  return {
    page: ["home", "poems", "mine", "journal", "me", "about"].includes(page)
      ? page
      : "home",
    id: params.get("id") || "",
    day: params.get("day") || "",
  };
}
const route = ref(readRoute());
const mode = ref(api.currentMode());
const user = ref(null),
  restoring = ref(false);
const poems = ref([]),
  selected = ref(null),
  total = ref(0),
  hasMore = ref(false);
const loading = ref(false),
  moreLoading = ref(false),
  error = ref(""),
  detailError = ref("");
const queryInput = ref(""),
  query = ref(""),
  kind = ref("all");
const mobileReading = ref(Boolean(route.value.id));
const counts = ref({}),
  year = ref(Number(dayKey(new Date()).slice(0, 4))),
  activityLoading = ref(false),
  activityError = ref("");
const loginOpen = ref(false),
  loginBusy = ref(false),
  loginError = ref("");
const toast = ref("");
let toastTimer,
  listVersion = 0,
  activityVersion = 0,
  detailVersion = 0,
  accountVersion = 0;
let readerFocusOrigin = null;
const nav = [
  { page: "home", name: "Home", label: "首页" },
  { page: "poems", name: "Poems", label: "所有人的诗" },
  { page: "mine", name: "My poems", label: "我的诗歌" },
  { page: "journal", name: "Days", label: "创作历程" },
  { page: "me", name: "Me", label: "关于我" },
];
const privatePage = computed(() =>
  ["mine", "journal", "me"].includes(route.value.page),
);
const locked = computed(() => privatePage.value && !user.value);
const scope = computed(() => (route.value.page === "mine" ? "mine" : "all"));
const today = ref(dayKey(new Date()));
const dateParts = computed(() => today.value.split("-"));
const stats = computed(() => summarizeDays(counts.value));
const dailyPoem = computed(() =>
  poems.value.length
    ? poems.value[Number(today.value.replaceAll("-", "")) % poems.value.length]
    : null,
);
const pageTitle = computed(
  () =>
    ({
      home: "给日常，一个回车。",
      poems: "每个人，都是一座诗岛。",
      mine: "写下的，都是来过。",
      journal: "日子经过，文字留下。",
      me: "在文字里，认识自己。",
      about: "再一次，按下回车键。",
    })[route.value.page],
);
const listCaption = computed(() =>
  query.value
    ? `“${query.value}”的搜索结果`
    : route.value.day
      ? `${route.value.day.replaceAll("-", ".")} 的诗`
      : route.value.page === "mine"
        ? "我的诗歌书架"
        : "诗歌书架",
);

function notify(message) {
  toast.value = message;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.value = "";
  }, 3500);
}
function navigate(page, params = {}) {
  const search = new URLSearchParams(
    Object.entries(params).filter(([, v]) => v),
  );
  const hash = `#/${page}${search.size ? `?${search}` : ""}`;
  if (location.hash !== hash) location.hash = hash;
}
function handleHash() {
  route.value = readRoute();
}
function focusMain() {
  document.getElementById("main-content")?.focus();
}
function openLogin() {
  loginError.value = "";
  loginOpen.value = true;
}
function handleAuth(errorValue) {
  if (["AUTH_EXPIRED", "AUTH_REQUIRED"].includes(errorValue.code)) {
    ++listVersion;
    ++detailVersion;
    ++activityVersion;
    loading.value = false;
    moreLoading.value = false;
    activityLoading.value = false;
    mobileReading.value = false;
    user.value = null;
    poems.value = [];
    selected.value = null;
    counts.value = {};
    notify("登录已过期，请重新登录");
  }
}
async function loadPoems(append = false) {
  if (locked.value || ["journal", "me", "about"].includes(route.value.page))
    return;
  const version = ++listVersion;
  if (append) moreLoading.value = true;
  else {
    loading.value = true;
    moreLoading.value = false;
    poems.value = [];
    total.value = 0;
    hasMore.value = false;
    if (!route.value.id) selected.value = null;
  }
  error.value = "";
  try {
    const data = await api.listPoems({
      scope: scope.value,
      kind: kind.value,
      query: query.value,
      day: route.value.day,
      skip: append ? poems.value.length : 0,
      limit: 18,
    });
    if (version !== listVersion) return;
    const existing = append ? poems.value : [];
    poems.value = [
      ...existing,
      ...data.poems.filter((p) => !existing.some((e) => e.id === p.id)),
    ];
    total.value = data.total;
    hasMore.value = data.hasMore;
    if (!route.value.id && !append) selected.value = poems.value[0] || null;
  } catch (e) {
    if (version === listVersion) {
      error.value = e.message;
      handleAuth(e);
    }
  } finally {
    if (version === listVersion) {
      loading.value = false;
      moreLoading.value = false;
    }
  }
}
async function loadDetail(id) {
  const version = ++detailVersion;
  detailError.value = "";
  if (!id) return;
  const existing = poems.value.find((p) => p.id === id);
  if (existing) {
    selected.value = existing;
    return;
  }
  selected.value = null;
  try {
    const poem = await api.poemDetail(id);
    if (version === detailVersion) selected.value = poem;
  } catch (e) {
    if (version === detailVersion) {
      detailError.value = e.message;
      handleAuth(e);
    }
  }
}
async function loadActivity() {
  if (!user.value || !["journal", "me"].includes(route.value.page)) return;
  const version = ++activityVersion;
  counts.value = {};
  activityLoading.value = true;
  activityError.value = "";
  try {
    const data = await api.activity(year.value);
    if (version === activityVersion) counts.value = data;
  } catch (e) {
    if (version === activityVersion) {
      activityError.value = e.message;
      handleAuth(e);
    }
  } finally {
    if (version === activityVersion) activityLoading.value = false;
  }
}
function choosePoem(poem) {
  if (document.activeElement?.closest(".poem-card"))
    readerFocusOrigin = document.activeElement;
  selected.value = poem;
  mobileReading.value = true;
  detailError.value = "";
  const page = route.value.page === "mine" ? "mine" : "poems";
  navigate(page, { id: poem.id, day: route.value.day });
}
function closeReader() {
  mobileReading.value = false;
  navigate(route.value.page, { day: route.value.day });
  nextTick(() => readerFocusOrigin?.focus({ preventScroll: true }));
}
function search() {
  query.value = queryInput.value.trim();
  selected.value = null;
  if (route.value.id) navigate(route.value.page, { day: route.value.day });
  loadPoems();
}
function changeKind(next) {
  kind.value = next;
  selected.value = null;
  if (route.value.id) navigate(route.value.page, { day: route.value.day });
  loadPoems();
}
function resetFilters() {
  queryInput.value = "";
  query.value = "";
  kind.value = "all";
  if (route.value.day) navigate(route.value.page);
  else {
    if (route.value.id) navigate(route.value.page);
    loadPoems();
  }
}
function randomPoem() {
  const pool = poems.value.filter((p) => p.id !== selected.value?.id);
  if (pool.length) choosePoem(pool[Math.floor(Math.random() * pool.length)]);
}
function stepPoem(direction) {
  const index = poems.value.findIndex((p) => p.id === selected.value?.id);
  const next = poems.value[index + direction];
  if (next) choosePoem(next);
}
function keydown(event) {
  if (
    loginOpen.value ||
    event.altKey ||
    event.ctrlKey ||
    event.metaKey ||
    /INPUT|TEXTAREA|SELECT/.test(event.target.tagName)
  )
    return;
  if (event.key === "Escape" && mobileReading.value) closeReader();
  if (
    event.key === "Tab" &&
    mobileReading.value &&
    window.matchMedia("(max-width: 800px)").matches
  ) {
    const controls = [
      ...document.querySelectorAll(
        ".reader-column button:not(:disabled), .reader-column a[href]",
      ),
    ];
    if (
      controls.length &&
      event.shiftKey &&
      document.activeElement === controls[0]
    ) {
      event.preventDefault();
      controls.at(-1).focus();
    } else if (
      controls.length &&
      !event.shiftKey &&
      document.activeElement === controls.at(-1)
    ) {
      event.preventDefault();
      controls[0].focus();
    }
  }
  if (["poems", "mine"].includes(route.value.page)) {
    if (event.key === "ArrowLeft") stepPoem(-1);
    if (event.key === "ArrowRight") stepPoem(1);
  }
}
async function signIn(credentials) {
  loginBusy.value = true;
  loginError.value = "";
  try {
    user.value = await api.login(credentials.poemId, credentials.password);
    loginOpen.value = false;
    notify("欢迎回来");
    await Promise.all([loadPoems(), loadActivity()]);
  } catch (e) {
    loginError.value = e.message;
  } finally {
    loginBusy.value = false;
  }
}
function demoSignIn() {
  user.value = api.loginDemo();
  loginOpen.value = false;
  notify("已进入示例账号");
  loadPoems();
  loadActivity();
}
async function signOut() {
  ++accountVersion;
  ++listVersion;
  ++detailVersion;
  ++activityVersion;
  user.value = null;
  selected.value = null;
  poems.value = [];
  counts.value = {};
  loginOpen.value = false;
  loading.value = false;
  activityLoading.value = false;
  try {
    await api.logout();
    notify("已退出登录");
  } catch {
    notify("本机已退出；云端会话将在到期后失效");
  }
  navigate("home");
  if (route.value.page === "home") loadPoems();
}
async function changeMode() {
  if (loginBusy.value) return;
  ++listVersion;
  ++detailVersion;
  ++activityVersion;
  const version = ++accountVersion;
  mode.value = mode.value === "demo" ? "cloud" : "demo";
  api.setMode(mode.value);
  user.value = null;
  selected.value = null;
  poems.value = [];
  counts.value = {};
  error.value = "";
  detailError.value = "";
  activityError.value = "";
  loginOpen.value = false;
  query.value = "";
  queryInput.value = "";
  kind.value = "all";
  loading.value = false;
  activityLoading.value = false;
  if (api.hasSession()) {
    try {
      const profile = await api.profile();
      if (version === accountVersion) user.value = profile;
    } catch {
      /* the login action remains available */
    }
  }
  if (version !== accountVersion) return;
  if (route.value.id || route.value.day) navigate(route.value.page);
  else {
    loadPoems();
    loadActivity();
  }
  notify(
    mode.value === "demo"
      ? "已切换到示例书架，内容仅供体验"
      : "已切换到 App 诗歌书架",
  );
}

watch(
  () => route.value,
  (next, prev) => {
    const pageChanged = next.page !== prev.page;
    if (pageChanged) {
      ++listVersion;
      ++activityVersion;
      loading.value = false;
      moreLoading.value = false;
      activityLoading.value = false;
      query.value = "";
      queryInput.value = "";
      kind.value = "all";
      error.value = "";
      window.scrollTo({ top: 0 });
    }
    if (pageChanged || next.day !== prev.day) loadPoems();
    if (next.id !== prev.id || pageChanged) {
      ++detailVersion;
      if (next.id && !locked.value) {
        mobileReading.value = true;
        loadDetail(next.id);
      } else {
        mobileReading.value = false;
        detailError.value = "";
      }
    }
    if (pageChanged) loadActivity();
    document.title = `${nav.find((n) => n.page === next.page)?.label || "关于回车键"} · POEMENTER`;
  },
);
watch(year, loadActivity);
watch(
  [mobileReading, selected],
  async ([value]) => {
    const mobile = window.matchMedia("(max-width: 800px)").matches;
    document.body.classList.toggle("reading-open", value && mobile);
    if (value && mobile) {
      await nextTick();
      document.querySelector(".mobile-reader-close")?.focus();
    }
  },
  { immediate: true },
);
onMounted(async () => {
  window.addEventListener("hashchange", handleHash);
  window.addEventListener("keydown", keydown);
  const version = ++accountVersion;
  if (api.hasSession()) {
    restoring.value = true;
    try {
      const profile = await api.profile();
      if (version === accountVersion) user.value = profile;
    } catch (e) {
      handleAuth(e);
    } finally {
      restoring.value = false;
    }
  }
  if (version !== accountVersion) return;
  loadPoems();
  loadActivity();
  if (route.value.id && !locked.value) loadDetail(route.value.id);
});
onBeforeUnmount(() => {
  window.removeEventListener("hashchange", handleHash);
  window.removeEventListener("keydown", keydown);
  clearTimeout(toastTimer);
});
</script>

<template>
  <a class="skip-link" href="#main-content" @click.prevent="focusMain"
    >跳到正文</a
  >
  <div class="site-shell">
    <aside class="sidebar">
      <a class="brand" href="#/home" aria-label="回车键首页"
        ><span class="brand-mark" aria-hidden="true">↵</span
        ><span>POEMENTER<small>回 车 键</small></span></a
      >
      <nav class="main-nav" aria-label="主要导航">
        <a
          v-for="item in nav"
          :key="item.page"
          :href="`#/${item.page}`"
          :class="{ active: route.page === item.page }"
          :aria-current="route.page === item.page ? 'page' : undefined"
          ><span class="nav-en">{{ item.name }}</span
          ><span class="nav-cn">{{ item.label }}</span
          ><span class="nav-active-dot" aria-hidden="true"></span
        ></a>
      </nav>
      <div class="sidebar-bottom">
        <p class="sidebar-verse">在换行的地方，<br />遇见另一种可能。</p>
        <a class="about-link" href="#/about">关于回车键 <span>↗</span></a
        ><button
          class="account-button"
          @click="user ? navigate('me') : openLogin()"
        >
          <span class="avatar-small">{{
            user?.nickName?.slice(0, 1) || "↵"
          }}</span
          ><span
            >{{ user?.nickName || "登录，找回你的诗"
            }}<small>{{
              user ? `ID / ${user.poemId}` : "用 App 账号登录"
            }}</small></span
          ><span class="account-arrow">↗</span>
        </button>
      </div>
    </aside>
    <main
      id="main-content"
      tabindex="-1"
      class="main-content"
      :class="[`page-${route.page}`, { 'mobile-reading': mobileReading }]"
    >
      <header class="topbar">
        <span class="topbar-caption">一个写诗的地方，也是一处停留。</span>
        <div class="topbar-right">
          <span class="source-label" :class="{ demo: mode === 'demo' }"
            ><i></i>{{ mode === "demo" ? "示例书架" : "来自回车键 App" }}</span
          ><span class="topbar-date"
            >{{ dateParts[0] }}.{{ dateParts[1] }}.{{ dateParts[2] }}</span
          ><button
            v-if="!user"
            class="topbar-login text-link"
            @click="openLogin"
          >
            登录 ↗
          </button>
        </div>
      </header>

      <template v-if="route.page === 'home'">
        <section class="home-hero">
          <div class="hero-copy">
            <p class="eyebrow">PAUSE. READ. POEMENTER.</p>
            <h1>
              <span>生活很长，</span><br /><span>诗让我们</span><br /><span
                >停留片刻<span class="hero-period">。</span></span
              >
            </h1>
            <div class="hero-bottom">
              <p>
                再一次，按下回车键。<br /><span
                  >在别人的诗里相遇，在自己的诗里回来。</span
                >
              </p>
              <a href="#/poems" class="enter-button" aria-label="开始读诗"
                ><span>开始读诗</span><span aria-hidden="true">↵</span></a
              >
            </div>
          </div>
          <div class="hero-margin">
            <div class="large-date">
              <span>{{ dateParts[2] }}<i>/</i></span
              ><span>{{ dateParts[1] }}</span>
            </div>
            <p>READ A POEM.<br />TAKE YOUR TIME.</p>
            <div class="margin-line"></div>
          </div>
        </section>
        <section class="home-shelf">
          <div class="section-heading">
            <div>
              <span class="eyebrow">WORDS FIND THEIR WAY</span>
              <h2>偶然读到，也是一种相遇。</h2>
            </div>
            <a href="#/poems" class="text-link">去诗歌书架 <span>↗</span></a>
          </div>
          <div v-if="loading" class="skeleton-grid">
            <div v-for="n in 4" :key="n" class="skeleton-card"></div>
          </div>
          <div v-else-if="error" class="empty-state compact-empty" role="alert">
            <p>{{ error }}</p>
            <button class="text-link" @click="loadPoems()">重新连接 ↻</button
            ><button
              v-if="mode === 'cloud'"
              class="text-link"
              @click="changeMode"
            >
              先看看示例书架 ↗
            </button>
          </div>
          <div v-else-if="!poems.length" class="empty-state compact-empty">
            <p>书架还很安静，等第一首诗到来。</p>
          </div>
          <div v-else class="home-cards">
            <PoemCard
              v-for="(poem, index) in poems.slice(0, 4)"
              :key="poem.id"
              :poem="poem"
              :index="index"
              @select="choosePoem"
            />
          </div>
        </section>
        <section v-if="dailyPoem" class="daily-section">
          <div class="daily-intro">
            <span class="eyebrow">TODAY'S READING</span>
            <h2>今天，<br />留一首诗的时间。</h2>
            <p>不必匆忙读完。<br />有些句子，适合慢慢抵达。</p>
            <button class="text-link" @click="choosePoem(dailyPoem)">
              读这首诗 ↗
            </button>
          </div>
          <div class="daily-lines">
            <h3>{{ dailyPoem.title }}</h3>
            <p class="poem-text">
              {{ dailyPoem.excerpt.split("\n").slice(0, 7).join("\n") }}
            </p>
            <span>—— {{ dailyPoem.author }}</span>
          </div>
        </section>
      </template>

      <template v-else-if="route.page === 'about'"
        ><section class="about-page">
          <p class="eyebrow">ABOUT POEMENTER</p>
          <h1>再一次，<br />按下回车键。</h1>
          <div class="about-copy">
            <p>回车键，是一个写诗的地方。</p>
            <p>
              我们相信，诗不只在远方。它也在回家的路上，在一杯水凉下去的时间里，在一句没有说出口的话后面。
            </p>
            <p>
              这个书架把 App
              里公开发布的诗带到更宽的屏幕上。你可以读所有人的诗，也可以登录，重新走过自己的创作历程。
            </p>
            <p>这里留给阅读。创作、编辑和交流，请回到回车键 App。</p>
          </div>
          <a href="#/poems" class="primary-button"
            >现在，读一首诗 <span>↵</span></a
          ><span class="about-mark" aria-hidden="true">↵</span>
        </section></template
      >

      <template v-else>
        <header class="page-heading">
          <p class="eyebrow">
            {{
              {
                poems: "THE POETRY SHELF",
                mine: "MY WORDS, MY WORLD",
                journal: "A RECORD OF CREATING",
                me: "A PORTRAIT IN WORDS",
              }[route.page]
            }}
          </p>
          <h1>{{ pageTitle }}</h1>
          <p>
            {{
              route.page === "poems"
                ? "从一张卡片开始，走进一首诗。"
                : route.page === "mine"
                  ? "散落在日常里的句子，在这里重新相聚。"
                  : route.page === "journal"
                    ? "不必每天都写。每一次落笔，都值得被记住。"
                    : "你写的每一行，都在描摹你的模样。"
            }}
          </p>
        </header>
        <section v-if="locked" class="locked-state">
          <span class="locked-mark" aria-hidden="true">↵</span>
          <p class="eyebrow">YOUR WORDS ARE WAITING</p>
          <h2>{{ restoring ? "正在找回你的诗…" : "你的诗，在等你回来。" }}</h2>
          <p>登录回车键账号，阅读自己的诗歌，<br />也看看一路写来的足迹。</p>
          <button
            class="primary-button"
            :disabled="restoring"
            @click="openLogin"
          >
            {{ restoring ? "正在恢复登录…" : "登录回车键" }}
            <span>↵</span></button
          ><a class="text-link" href="#/poems">先读读大家的诗 ↗</a>
        </section>

        <template v-else-if="route.page === 'poems' || route.page === 'mine'">
          <div class="shelf-controls">
            <div class="filter-tabs" aria-label="诗歌类型">
              <button
                v-for="item in [
                  { key: 'all', label: '全部' },
                  { key: 'original', label: '原创' },
                  { key: 'reprint', label: '转载' },
                ]"
                :key="item.key"
                :class="{ active: kind === item.key }"
                :aria-pressed="kind === item.key"
                @click="changeKind(item.key)"
              >
                {{ item.label }}
              </button>
            </div>
            <form class="search-form" role="search" @submit.prevent="search">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <circle cx="10.5" cy="10.5" r="6.5" />
                <path d="m16 16 5 5" /></svg
              ><input
                v-model="queryInput"
                aria-label="搜索诗名、诗句或作者"
                placeholder="搜索诗名、诗句、作者"
                maxlength="80"
                type="search"
              /><button type="submit" aria-label="提交搜索">↵</button>
            </form>
          </div>
          <div class="shelf-status">
            <span
              >{{ listCaption
              }}<span class="count-label">{{
                loading ? "整理中…" : `${total} 首`
              }}</span
              ><button
                v-if="query || route.day || kind !== 'all'"
                class="clear-filter"
                @click="resetFilters"
              >
                清除筛选 ×
              </button></span
            ><button
              class="text-link"
              :disabled="poems.length < 2"
              @click="randomPoem"
            >
              偶遇一首 <span>↗</span>
            </button>
          </div>
          <div v-if="loading" class="shelf-loading" role="status">
            <div class="skeleton-reader">
              <span></span><span></span><span></span><span></span>
            </div>
            <div class="skeleton-grid">
              <div v-for="n in 9" :key="n" class="skeleton-card"></div>
            </div>
            <span class="sr-only">正在加载诗歌</span>
          </div>
          <div
            v-else-if="error && !poems.length"
            class="empty-state"
            role="alert"
          >
            <span class="empty-symbol">↵</span>
            <h2>书架暂时还没打开。</h2>
            <p>{{ error }}</p>
            <button class="primary-button" @click="loadPoems()">
              重新连接 <span>↻</span></button
            ><button
              v-if="mode === 'cloud'"
              class="text-link"
              @click="changeMode"
            >
              先看看示例书架 ↗
            </button>
          </div>
          <div
            v-else-if="!poems.length && !selected && !detailError"
            class="empty-state"
          >
            <span class="empty-symbol">⋯</span>
            <h2>
              {{
                query
                  ? "还没找到这句回声。"
                  : route.day
                    ? "这一天，留给了生活。"
                    : "这里还留着空白。"
              }}
            </h2>
            <p>
              {{
                query
                  ? "换一个词，或试着搜索作者的名字。"
                  : route.page === "mine"
                    ? "在 App 公开发布的诗歌，会在这里与你重逢。"
                    : "暂时没有这个分类的诗歌。"
              }}
            </p>
            <button
              v-if="query || route.day || kind !== 'all'"
              class="text-link"
              @click="resetFilters"
            >
              查看全部诗歌 ↗
            </button>
          </div>
          <div v-else class="poetry-workspace">
            <div class="reader-column">
              <div v-if="detailError" class="reader-error" role="alert">
                <h2>暂时读不到这首诗。</h2>
                <p>{{ detailError }}</p>
                <button class="text-link" @click="loadDetail(route.id)">
                  重试 ↻</button
                ><button class="text-link" @click="closeReader">
                  返回书架 ↗
                </button>
              </div>
              <PoemReader
                v-else-if="selected"
                :poem="selected"
                :demo="mode === 'demo'"
                @notify="notify"
                @close="closeReader"
              />
              <div v-else class="reader-placeholder">选一首诗，慢慢读。</div>
              <div class="reader-navigation" v-if="selected">
                <button
                  class="text-link"
                  :disabled="poems.findIndex((p) => p.id === selected.id) <= 0"
                  @click="stepPoem(-1)"
                >
                  ← 上一首</button
                ><span>← → 切换阅读</span
                ><button
                  class="text-link"
                  :disabled="
                    poems.findIndex((p) => p.id === selected.id) < 0 ||
                    poems.findIndex((p) => p.id === selected.id) >=
                      poems.length - 1
                  "
                  @click="stepPoem(1)"
                >
                  下一首 →
                </button>
              </div>
            </div>
            <section class="cards-column" aria-label="诗歌卡片">
              <div class="poem-grid">
                <PoemCard
                  v-for="(poem, index) in poems"
                  :key="poem.id"
                  :poem="poem"
                  :index="index"
                  :selected="selected?.id === poem.id"
                  @select="choosePoem"
                />
              </div>
              <div v-if="error" class="inline-error" role="alert">
                {{ error }}
                <button class="text-link" @click="loadPoems(true)">重试</button>
              </div>
              <button
                v-if="hasMore"
                class="load-more"
                :disabled="moreLoading"
                @click="loadPoems(true)"
              >
                {{ moreLoading ? "正在取来更多诗…" : "再读一些" }}
                <span>↓</span>
              </button>
              <div v-else class="shelf-end">
                <span></span>读到这里，也可以歇一会儿。<span></span>
              </div>
            </section>
          </div>
        </template>

        <template v-else-if="route.page === 'journal'"
          ><ActivityCalendar
            :counts="counts"
            :year="year"
            :loading="activityLoading"
            :error="activityError"
            @year="year = $event"
            @retry="loadActivity"
            @day="navigate('mine', { day: $event })"
          />
          <section class="journal-reflection">
            <div>
              <span class="eyebrow">THE SHAPE OF YOUR DAYS</span>
              <h2>慢慢写，<br />也慢慢成为自己。</h2>
            </div>
            <p>
              有些日子，写下一整首诗。<br />有些日子，只是在心里换了一行。<br /><br />这里记下你的创作，<br />也尊重那些没有写字的日子。
            </p>
            <a href="#/mine" class="text-link">重读我的诗 ↗</a>
          </section></template
        >

        <template v-else-if="route.page === 'me' && user"
          ><section class="profile-card">
            <div class="profile-avatar">
              <img
                v-if="/^https:\/\//.test(user.avatarUrl)"
                :src="user.avatarUrl"
                alt="我的头像"
                referrerpolicy="no-referrer"
                @error="$event.target.style.display = 'none'"
              /><span>{{ user.nickName.slice(0, 1) }}</span>
            </div>
            <div class="profile-copy">
              <span class="eyebrow">{{
                mode === "demo"
                  ? "示例账号 / DEMO PROFILE"
                  : "POEMENTER / POET PROFILE"
              }}</span>
              <h2>{{ user.nickName }}</h2>
              <p class="profile-id">
                Poem ID / {{ user.poemId
                }}<span v-if="user.region"> · {{ user.region }}</span>
              </p>
              <p class="profile-bio">
                {{ user.bio || "还没有写下自我介绍，诗歌已经替你说了许多。" }}
              </p>
              <div class="profile-social">
                <span
                  ><strong>{{ user.following ?? "—" }}</strong> 关注</span
                ><span
                  ><strong>{{ user.followers ?? "—" }}</strong> 被关注</span
                >
              </div>
            </div>
            <img
              v-if="/^https:\/\//.test(user.signatureUrl)"
              :src="user.signatureUrl"
              alt="我的手写签名"
              class="profile-signature"
            />
          </section>
          <div class="profile-stat-row">
            <div>
              <strong>{{
                activityLoading || activityError ? "—" : stats.total
              }}</strong
              ><span>{{ year }} 年原创诗歌</span>
            </div>
            <div>
              <strong>{{
                activityLoading || activityError ? "—" : stats.days
              }}</strong
              ><span>落笔的日子</span>
            </div>
            <div>
              <strong
                >{{ activityLoading || activityError ? "—" : stats.longest
                }}<small>天</small></strong
              ><span>最长连续创作</span>
            </div>
            <a href="#/mine" class="text-link">打开我的诗歌书架 ↗</a>
          </div>
          <ActivityCalendar
            :counts="counts"
            :year="year"
            :loading="activityLoading"
            :error="activityError"
            @year="year = $event"
            @retry="loadActivity"
            @day="navigate('mine', { day: $event })"
          />
          <div class="profile-footer">
            <p>
              个人资料与回车键 App 同步。<br /><span
                >修改资料、写诗和交流，可以回到 App 继续。</span
              >
            </p>
            <button class="text-link" @click="signOut">退出登录 ↗</button>
          </div></template
        >
      </template>
      <footer class="site-footer">
        <a href="#/home">POEMENTER <span>回车键</span></a
        ><span>让文字发生，让生活换行。</span
        ><button class="mode-switch" :disabled="loginBusy" @click="changeMode">
          {{
            mode === "demo" ? "示例内容 · 连接 App 数据 ↗" : "体验示例书架 ↗"
          }}
        </button>
      </footer>
    </main>
  </div>
  <LoginDialog
    :open="loginOpen"
    :mode="mode"
    :busy="loginBusy"
    :error="loginError"
    @close="loginOpen = false"
    @login="signIn"
    @demo="demoSignIn"
  />
  <Transition name="toast"
    ><div v-if="toast" class="toast-message" role="status">
      {{ toast }}
    </div></Transition
  >
</template>
