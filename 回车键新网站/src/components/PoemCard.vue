<script setup>
import AuthorSignature from "./AuthorSignature.vue";
defineProps({
  poem: { type: Object, required: true },
  selected: Boolean,
  index: { type: Number, default: 0 },
});
defineEmits(["select"]);
</script>

<template>
  <button
    class="poem-card"
    :class="{ selected }"
    :style="{ backgroundColor: poem.backgroundColor, color: poem.textColor }"
    :aria-pressed="selected"
    :aria-label="`阅读《${poem.title}》，${poem.author}`"
    @click="$emit('select', poem)"
  >
    <span class="card-top"
      ><span>{{ String(index + 1).padStart(2, "0") }}</span
      ><span v-if="selected" class="card-arrow" aria-hidden="true">↵</span
      ><span v-else-if="poem.series.length">组诗</span></span
    >
    <span class="card-title">{{ poem.title }}</span>
    <span class="card-excerpt">{{ poem.excerpt }}</span>
    <AuthorSignature :src="poem.authorSignature" compact />
    <span class="card-author"
      >{{ poem.author }}<span aria-hidden="true">↗</span></span
    >
  </button>
</template>
