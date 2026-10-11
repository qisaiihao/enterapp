<template>
  <view>
    <AppDialog v-if="!(updateState.update && !suppressUpdate) && request && request.kind === 'dialog'" :key="requestId" :visible="true" defer-answer
      :title="request.options.title || ''" :message="request.options.content || ''"
      :confirm-text="request.options.confirmText || '确定'" :cancel-text="request.options.cancelText || '取消'"
      :show-cancel="request.options.showCancel !== false" :danger="isDanger(request.options.confirmText) || isDanger(request.options.title)"
      :editable="!!request.options.editable" :placeholder="request.options.placeholderText || ''"
      @confirm="confirm" @cancel="cancel" />
    <AppActionSheet v-if="!(updateState.update && !suppressUpdate) && request && request.kind === 'sheet'" :key="requestId" :visible="true"
      :title="request.options.title || '选择操作'" :items="sheetItems" @select="select" @cancel="cancel" />
    <AppUpdateDialog v-if="updateState.update && !suppressUpdate" :state="updateState" />
  </view>
</template>

<script>
import AppDialog from '@/components/overlay/AppDialog.vue';
import AppActionSheet from '@/components/overlay/AppActionSheet.vue';
import AppUpdateDialog from '@/components/AppUpdateDialog.vue';
import { registerOverlayHost, resolveOverlayOwner, answerOverlay, isDangerousOverlayAction } from '@/utils/appOverlay.js';
import { subscribeUpdateDialog } from '@/utils/appUpdate.js';
export default {
  name: 'AppOverlayHost',
  components: { AppDialog, AppActionSheet, AppUpdateDialog },
  props: { suppressUpdate: { type: Boolean, default: false } },
  data() { return { request: null, requestId: 0, updateState: { update: null } }; },
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
    this.releaseUpdate = subscribeUpdateDialog(state => { this.updateState = state; });
  },
  beforeUnmount() { this.releaseUpdate?.(); this.releaseHost?.(); },
  methods: {
    isDanger: isDangerousOverlayAction,
    confirm(content) { answerOverlay(this.overlayOwner, this.activeRequest, 'confirm', content); },
    cancel() { answerOverlay(this.overlayOwner, this.activeRequest, 'cancel'); },
    select(index) { answerOverlay(this.overlayOwner, this.activeRequest, index); }
  }
};
</script>
