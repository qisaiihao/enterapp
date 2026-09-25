<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { listFolders, listFolderPoems } from "../lib/api";
import PoemCard from "./PoemCard.vue";

const props = defineProps({ kind: { type: String, required: true } });
const emit = defineEmits(["error"]);
const title = computed(() =>
  props.kind === "portfolio" ? "作品集" : "收藏夹",
);
const folders = ref([]),
  total = ref(0),
  hasMore = ref(false);
const loading = ref(false),
  error = ref("");
const selected = ref(null),
  poems = ref([]),
  nextSkip = ref(0);
const poemsLoading = ref(false),
  poemsError = ref(""),
  morePoems = ref(false);
const failedCovers = ref(new Set());
let active = true,
  requestVersion = 0;

async function loadFolders() {
  if (loading.value) return;
  loading.value = true;
  error.value = "";
  try {
    const result = await listFolders(props.kind, folders.value.length);
    if (!active) return;
    folders.value.push(...result.folders);
    total.value = result.total;
    hasMore.value = result.hasMore;
  } catch (e) {
    if (!active) return;
    error.value = e.message;
    emit("error", e);
  } finally {
    if (active) loading.value = false;
  }
}
async function loadPoems() {
  if (!selected.value || poemsLoading.value) return;
  const version = ++requestVersion;
  poemsLoading.value = true;
  poemsError.value = "";
  try {
    const result = await listFolderPoems(
      props.kind,
      selected.value.id,
      nextSkip.value,
    );
    if (!active || version !== requestVersion) return;
    const existing = new Set(poems.value.map((poem) => poem.id));
    poems.value.push(...result.poems.filter((poem) => !existing.has(poem.id)));
    nextSkip.value = result.nextSkip;
    morePoems.value = result.hasMore;
  } catch (e) {
    if (!active || version !== requestVersion) return;
    poemsError.value = e.message;
    emit("error", e);
  } finally {
    if (active && version === requestVersion) poemsLoading.value = false;
  }
}
function openFolder(folder) {
  ++requestVersion;
  selected.value = selected.value?.id === folder.id ? null : folder;
  poems.value = [];
  poemsError.value = "";
  poemsLoading.value = false;
  nextSkip.value = 0;
  morePoems.value = false;
  if (selected.value) loadPoems();
}
function readPoem(poem) {
  location.hash = `/poems?id=${encodeURIComponent(poem.id)}`;
}
onMounted(loadFolders);
onBeforeUnmount(() => {
  active = false;
  ++requestVersion;
});
</script>

<template>
  <section
    class="profile-library"
    :class="`library-${kind}`"
    :aria-labelledby="`library-title-${kind}`"
  >
    <div class="section-heading">
      <div>
        <p class="eyebrow">
          {{ kind === "portfolio" ? "MY COLLECTIONS" : "SAVED WORDS" }}
        </p>
        <h2 :id="`library-title-${kind}`">{{ title }}</h2>
      </div>
      <span v-if="folders.length" class="library-count"
        >{{ total }} 个{{ title }}</span
      >
    </div>
    <div v-if="folders.length" class="folder-grid">
      <button
        v-for="folder in folders"
        :key="folder.id"
        class="folder-card"
        :class="{ 'is-open': selected?.id === folder.id }"
        :aria-expanded="selected?.id === folder.id"
        :aria-controls="`folder-content-${kind}`"
        @click="openFolder(folder)"
      >
        <span class="folder-cover" aria-hidden="true">
          <img
            v-if="
              /^https:\/\//i.test(folder.coverUrl) &&
              !failedCovers.has(folder.id)
            "
            :src="folder.coverUrl"
            alt=""
            loading="lazy"
            referrerpolicy="no-referrer"
            @error="failedCovers.add(folder.id)"
          />
          <span v-else>{{ kind === "portfolio" ? "诗" : "藏" }}</span>
        </span>
        <span class="folder-copy"
          ><span class="folder-name">{{ folder.name }}</span>
          <span class="folder-count">{{ folder.itemCount }} 项</span></span
        >
        <span class="folder-arrow" aria-hidden="true">{{
          selected?.id === folder.id ? "−" : "↗"
        }}</span>
      </button>
    </div>
    <p v-if="loading" class="library-note" role="status">
      正在读取{{ title }}…
    </p>
    <div v-else-if="error" class="inline-error" role="alert">
      {{ error }}
      <button class="text-link" @click="loadFolders">重试 ↗</button>
    </div>
    <p v-else-if="!folders.length" class="library-note">
      还没有{{ title }}，可以在 App 中整理喜欢的诗。
    </p>
    <button v-else-if="hasMore" class="load-more" @click="loadFolders">
      更多{{ title }} ↓
    </button>

    <div :id="`folder-content-${kind}`">
      <div v-if="selected" class="folder-content" :aria-busy="poemsLoading">
        <div class="folder-heading">
          <h3>{{ selected.name }}</h3>
          <button class="text-link" @click="openFolder(selected)">
            收起 ↑
          </button>
        </div>
        <p class="library-note">显示仍可公开阅读的诗歌。</p>
        <div v-if="poems.length" class="library-poems">
          <PoemCard
            v-for="poem in poems"
            :key="poem.id"
            :poem="poem"
            @select="readPoem"
          />
        </div>
        <p v-if="poemsLoading" class="library-note" role="status">
          正在读取诗歌…
        </p>
        <div v-else-if="poemsError" class="inline-error" role="alert">
          {{ poemsError }}
          <button class="text-link" @click="loadPoems">重试 ↗</button>
        </div>
        <template v-else>
          <p v-if="!poems.length" class="library-note">
            {{
              morePoems
                ? "这一页暂无可阅读的诗歌，可继续查看。"
                : "这里暂时没有可阅读的诗歌。"
            }}
          </p>
          <button v-if="morePoems" class="load-more" @click="loadPoems">
            继续查看 ↓
          </button>
        </template>
      </div>
    </div>
  </section>
</template>

<style scoped>
.profile-library {
  margin-top: 38px;
  padding-top: 28px;
  border-top: 1px solid var(--line);
}
.library-count,
.library-note,
.folder-count {
  font-size: 11px;
  color: #78816e;
  line-height: 1.9;
}
.library-note {
  margin: 16px 0;
}
.folder-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 14px;
}
.folder-card {
  display: flex;
  align-items: center;
  gap: 16px;
  min-width: 0;
  padding: 16px;
  text-align: left;
  border: 1px solid var(--line);
  border-radius: 8px;
}
.folder-card:hover,
.folder-card.is-open {
  background: #eef0e7;
  border-color: #9aa58d;
}
.folder-cover {
  display: grid;
  place-items: center;
  flex-shrink: 0;
  width: 54px;
  height: 70px;
  background: #e2e7d8;
  border-radius: 3px;
  overflow: hidden;
  color: #68765b;
  font: 27px var(--serif);
}
.library-favorite .folder-cover {
  background: #e9e3d8;
  color: #88765e;
}
.folder-cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.folder-copy {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 9px;
  min-width: 0;
}
.folder-name {
  font-family: var(--serif);
  font-size: 17px;
  overflow-wrap: anywhere;
}
.folder-arrow {
  font-size: 18px;
  color: #7e8874;
}
.folder-content {
  margin-top: 22px;
  padding-top: 22px;
  border-top: 1px solid var(--line);
}
.folder-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}
.folder-heading h3 {
  font-family: var(--serif);
  font-weight: 400;
  font-size: 20px;
  overflow-wrap: anywhere;
}
.library-poems {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 13px;
}
@media (max-width: 1150px) {
  .folder-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .library-poems {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
@media (max-width: 520px) {
  .folder-grid {
    grid-template-columns: 1fr;
  }
  .folder-card {
    padding: 14px;
  }
  .profile-library {
    margin-top: 28px;
  }
}
</style>
