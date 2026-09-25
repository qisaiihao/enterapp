<script setup>
import AuthorSignature from "./AuthorSignature.vue";
defineProps({
  poem: { type: Object, required: true },
  selected: Boolean,
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
    <span v-if="poem.series.length" class="card-top">组诗</span>
    <span class="card-title">{{ poem.title }}</span>
    <span class="card-excerpt">{{ poem.excerpt }}</span>
    <AuthorSignature :src="poem.authorSignature" compact />
  </button>
</template>
