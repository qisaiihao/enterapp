<template>
  <AppDialog
    :visible="visible"
    defer-answer
    require-scroll-to-confirm
    title="用户协议与隐私政策"
    confirm-text="同意并继续"
    cancel-text="不同意"
    @confirm="handleConfirm"
    @cancel="handleCancel"
  >
    <view class="privacy-consent-body">
      <view class="privacy-consent-section">
        <text class="privacy-consent-section-title">用户协议</text>
        <LegalDocument is-user-agreement :selectable="false" />
      </view>
      <view class="privacy-consent-section">
        <text class="privacy-consent-section-title">隐私政策</text>
        <LegalDocument :selectable="false" />
      </view>
      <text class="privacy-consent-end">点击“同意并继续”即表示您同意以上两份文件。</text>
    </view>
  </AppDialog>
</template>

<script>
import AppDialog from '@/components/overlay/AppDialog.vue';
import LegalDocument from '@/components/LegalDocument.vue';

export default {
  name: 'PrivacyConsentDialog',
  components: { AppDialog, LegalDocument },
  emits: ['agree', 'decline'],
  props: {
    visible: Boolean
  },
  methods: {
    handleConfirm() {
      this.$emit('agree');
    },
    handleCancel() {
      this.$emit('decline');
    }
  }
};
</script>

<style scoped>
.privacy-consent-body {
  --legal-muted: var(--overlay-muted, #666);
}

.privacy-consent-section + .privacy-consent-section {
  margin-top: 48rpx;
  padding-top: 32rpx;
  border-top: 1rpx solid var(--app-border-color, #e8e8e8);
}

.privacy-consent-section-title {
  display: block;
  margin-bottom: 12rpx;
  font-size: 34rpx;
  line-height: 1.4;
  font-weight: 600;
}

.privacy-consent-end {
  display: block;
  margin-top: 32rpx;
  color: var(--legal-muted);
  font-size: 26rpx;
  line-height: 1.6;
}
</style>
