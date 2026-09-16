<template>
  <view>
    <AppDialog v-if="request && request.kind === 'dialog'" :key="requestId" :visible="true"
      :title="request.options.title || ''" :message="request.options.content || ''"
      :confirm-text="request.options.confirmText || '确定'" :cancel-text="request.options.cancelText || '取消'"
      :show-cancel="request.options.showCancel !== false" :danger="isDanger(request.options.confirmText) || isDanger(request.options.title)"
      :editable="!!request.options.editable" :placeholder="request.options.placeholderText || ''"
      @confirm="confirm" @cancel="cancel" />
    <AppActionSheet v-if="request && request.kind === 'sheet'" :key="requestId" :visible="true"
      :title="request.options.title || '选择操作'" :items="sheetItems" @select="select" @cancel="cancel" />
  </view>
</template>

<script>
import AppDialog from '@/components/overlay/AppDialog.vue';
import AppActionSheet from '@/components/overlay/AppActionSheet.vue';
import { registerOverlayHost, resolveOverlayOwner, answerOverlay, isDangerousOverlayAction } from '@/utils/appOverlay.js';
export default {
  components: { AppDialog, AppActionSheet },
  data() { return { request: null, requestId: 0 }; },
  computed: {
    sheetItems() {
      return (this.request?.options.itemList || []).map(text => ({ text, danger: this.isDanger(text) }));
    }
  },
  mounted() {
    this.overlayOwner = resolveOverlayOwner(this);
    this.releaseHost = registerOverlayHost(this.overlayOwner, request => {
      this.activeRequest = request;
      this.request = request ? { kind: request.kind, options: request.options } : null;
      this.requestId += 1;
    });
  },
  beforeUnmount() { this.releaseHost?.(); },
  methods: {
    isDanger: isDangerousOverlayAction,
    confirm(content) { answerOverlay(this.overlayOwner, this.activeRequest, 'confirm', content); },
    cancel() { answerOverlay(this.overlayOwner, this.activeRequest, 'cancel'); },
    select(index) { answerOverlay(this.overlayOwner, this.activeRequest, index); }
  }
};
</script>
