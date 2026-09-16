<script setup>
import { ref, watch, nextTick } from "vue";
const props = defineProps({
  open: Boolean,
  mode: String,
  busy: Boolean,
  error: String,
});
const emit = defineEmits(["close", "login", "demo"]);
const dialog = ref(null),
  poemId = ref(""),
  password = ref(""),
  reveal = ref(false);
watch(
  () => props.open,
  async (value) => {
    await nextTick();
    if (value && !dialog.value.open) {
      dialog.value.showModal();
      dialog.value.querySelector("input")?.focus();
    }
    if (!value && dialog.value.open) dialog.value.close();
    if (!value) {
      password.value = "";
      reveal.value = false;
    }
  },
);
function submit() {
  if (!props.busy && poemId.value.trim() && password.value)
    emit("login", { poemId: poemId.value, password: password.value });
}
</script>

<template>
  <dialog
    ref="dialog"
    class="login-dialog"
    aria-labelledby="login-title"
    @cancel.prevent="!busy && emit('close')"
    @click="
      (event) => {
        if (event.target === dialog && !busy) emit('close');
      }
    "
  >
    <button
      class="dialog-close icon-button"
      aria-label="关闭登录"
      :disabled="busy"
      @click="emit('close')"
    >
      ×
    </button>
    <span class="dialog-symbol" aria-hidden="true">↵</span>
    <p class="eyebrow">WELCOME BACK</p>
    <h2 id="login-title">回到你的诗里。</h2>
    <p class="dialog-intro">
      用回车键 App 账号登录，<br />让写过的每一行，在这里相遇。
    </p>
    <template v-if="mode === 'demo'"
      ><div class="demo-explanation">
        当前是示例书架。示例账号仅用于体验页面，<br />不代表真实用户或 App
        数据。
      </div>
      <button class="primary-button full-width" @click="emit('demo')">
        体验示例账号 <span>↵</span>
      </button></template
    >
    <form v-else @submit.prevent="submit">
      <label class="form-label" for="poem-id"
        >Poem ID<input
          id="poem-id"
          v-model="poemId"
          name="username"
          autocomplete="username"
          maxlength="64"
          placeholder="你的 Poem ID"
          required
          :disabled="busy" /></label
      ><label class="form-label" for="password"
        >密码<span class="password-wrap"
          ><input
            id="password"
            v-model="password"
            :type="reveal ? 'text' : 'password'"
            name="password"
            autocomplete="current-password"
            maxlength="128"
            placeholder="App 登录密码"
            required
            :disabled="busy"
          /><button
            type="button"
            :aria-label="reveal ? '隐藏密码' : '显示密码'"
            @click="reveal = !reveal"
          >
            {{ reveal ? "隐藏" : "显示" }}
          </button></span
        ></label
      >
      <p v-if="error" class="form-error" role="alert">{{ error }}</p>
      <button
        class="primary-button full-width"
        type="submit"
        :disabled="busy || !poemId.trim() || !password"
      >
        {{ busy ? "正在登录…" : "登录" }}<span aria-hidden="true">↵</span>
      </button>
      <p class="login-help">
        Poem ID 可在 App 的个人资料中查看。<br />尚未设置密码？请先在 App
        中设置。
      </p>
    </form>
    <div class="dialog-bottom">写诗在 App，读诗在这里。</div>
  </dialog>
</template>
