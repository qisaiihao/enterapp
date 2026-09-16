<script setup>
import { ref, watch } from "vue";

const props = defineProps({
  src: { type: String, default: "" },
  compact: Boolean,
});
const failed = ref(false);
watch(
  () => props.src,
  () => {
    failed.value = false;
  },
);
</script>

<template>
  <span
    v-if="src && !failed"
    class="author-signature"
    :class="{ 'signature-compact': compact }"
  >
    <img
      :key="src"
      :src="src"
      alt="发布者手写签名"
      loading="lazy"
      decoding="async"
      referrerpolicy="no-referrer"
      @error="failed = true"
    />
  </span>
</template>

<style scoped>
.author-signature {
  display: block;
  width: 160px;
  height: 64px;
  max-width: 100%;
  margin: 25px 0 0 auto;
  flex-shrink: 0;
}
.author-signature img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: contain;
  object-position: right center;
}
.signature-compact {
  width: 88px;
  height: 34px;
  margin: auto 0 12px auto;
}
</style>
