<template>
  <button class="studio-icon-button" :class="{ 'is-selected': selected, 'has-text': text }" :aria-label="label" :title="label" :disabled="disabled" :loading="loading" hover-class="studio-icon-button--pressed" @touchstart="beginGesture" @keydown="beginGesture" @tap.stop="activate" @longpress.stop="describe">
    <image v-if="!loading" class="studio-tool-icon" :src="icon" mode="aspectFit" />
    <text v-if="text">{{ text }}</text>
  </button>
</template>

<script>
export default {
  name: 'StudioIconButton',
  emits: ['action'],
  props: {
    icon: { type: String, required: true },
    label: { type: String, required: true },
    text: { type: String, default: '' },
    disabled: Boolean,
    selected: Boolean,
    loading: Boolean
  },
  data() { return { suppressTap: false }; },
  methods: {
    beginGesture() { this.suppressTap = false; },
    activate(event) {
      if (this.suppressTap) { this.suppressTap = false; return; }
      if (!this.disabled && !this.loading) this.$emit('action', event);
    },
    describe() {
      if (this.disabled || this.loading) return;
      this.suppressTap = true;
      uni.showToast({ title: this.label, icon: 'none' });
    }
  }
};
</script>

<style scoped>
.studio-icon-button { display: flex; align-items: center; justify-content: center; flex-shrink: 0; gap: 6px; width: 40px; height: 40px; margin: 0; padding: 0; box-sizing: border-box; border: 0; border-radius: 8px; background: transparent; color: #3e4b3e; font-size: 13px; line-height: 1; }
.studio-icon-button::after { border: 0; }
.studio-tool-icon { display: block; flex-shrink: 0; width: 24px; height: 24px; opacity: .85; }
.studio-icon-button.has-text { width: auto; padding: 0 8px; white-space: nowrap; }
.studio-icon-button.is-selected { background: #3d5547; color: #fff; }
.studio-icon-button.is-selected .studio-tool-icon { filter: brightness(0) invert(1); opacity: 1; }
.studio-icon-button[disabled] { background: transparent; opacity: .3; }
.studio-icon-button--pressed { opacity: .6; }
</style>
