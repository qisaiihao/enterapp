<script setup>
import { ref, watch, onMounted } from "vue";
import { formatDate } from "../lib/poems";
import { copyText } from "../lib/clipboard";
import AuthorSignature from "./AuthorSignature.vue";
const props = defineProps({
  poem: Object,
  compact: Boolean,
  demo: Boolean,
  active: Boolean,
});
const emit = defineEmits(["notify", "close"]);
function storedSize() {
  try {
    return localStorage.getItem("poementer:large-type") === "yes";
  } catch {
    return false;
  }
}
const large = ref(storedSize());
watch(large, (value) => {
  try {
    localStorage.setItem("poementer:large-type", value ? "yes" : "no");
  } catch {}
});
const body = ref(null);
function resetReadingPosition() {
  body.value?.scrollTo({ top: 0 });
  if (!window.matchMedia("(max-width: 800px)").matches) return;
  const column = body.value?.closest(".reader-column");
  const title = body.value?.querySelector("h2");
  if (column && title) {
    column.scrollTo({
      top:
        column.scrollTop +
        title.getBoundingClientRect().top -
        column.getBoundingClientRect().top -
        56,
      behavior: "instant",
    });
  }
}
watch([() => props.poem?.id, () => props.active], resetReadingPosition, {
  flush: "post",
});
onMounted(resetReadingPosition);
async function copyLink() {
  const url = new URL(window.location.href);
  url.hash = `/poems?id=${encodeURIComponent(props.poem.id)}`;
  try {
    await copyText(url.href);
    emit("notify", "诗歌链接已复制");
  } catch {
    emit("notify", "暂时无法复制，请复制浏览器地址栏中的链接");
  }
}
</script>

<template>
  <article
    v-if="poem"
    class="poem-reader"
    :class="{ compact }"
    aria-label="诗歌全文"
  >
    <header class="reader-toolbar">
      <span class="eyebrow">{{
        compact ? "A POEM FOR TODAY" : "正在阅读 / READING"
      }}</span>
      <div class="reader-actions">
        <button
          class="text-size"
          :aria-pressed="large"
          aria-label="切换诗歌字号"
          @click="large = !large"
        >
          A<span>A</span></button
        ><button
          class="mobile-reader-close icon-button"
          aria-label="返回诗歌卡片"
          @click="$emit('close')"
        >
          ×
        </button>
      </div>
    </header>
    <div class="reader-meta">
      <span
        >{{ poem.original ? "原创诗歌" : "诗歌转载"
        }}<template v-if="poem.series.length"> · 组诗</template></span
      ><time :datetime="poem.date">{{ formatDate(poem.date) }}</time>
    </div>
    <div ref="body" class="reader-scroll" :class="{ 'large-type': large }">
      <h2 :key="poem.id">{{ poem.title }}</h2>
      <p class="reader-author">{{ poem.author }}</p>
      <div v-if="poem.series.length" class="series-content">
        <section v-for="block in poem.series" :key="block.id">
          <h3 v-if="block.subtitle">{{ block.subtitle }}</h3>
          <p class="poem-text">{{ block.content }}</p>
        </section>
      </div>
      <p v-else class="poem-text">{{ poem.content }}</p>
      <img
        v-for="url in poem.images"
        :key="url"
        class="poem-image"
        :src="url"
        alt="诗歌配图"
        loading="lazy"
        referrerpolicy="no-referrer"
      />
      <AuthorSignature :src="poem.authorSignature" />
      <div class="poem-ending" aria-hidden="true">· &nbsp; · &nbsp; ·</div>
      <div v-if="poem.tags.length" class="poem-tags">
        <span v-for="tag in poem.tags" :key="tag"># {{ tag }}</span>
      </div>
    </div>
    <footer class="reader-footer">
      <span>{{ demo ? "示例诗歌 · 仅供体验" : "文字来自回车键 App" }}</span
      ><button class="text-link" @click="copyLink">
        复制链接 <span aria-hidden="true">↗</span>
      </button>
    </footer>
  </article>
</template>
