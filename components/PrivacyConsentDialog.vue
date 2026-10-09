<template>
  <AppDialog
    :visible="visible"
    defer-answer
    title="隐私政策"
    confirm-text="同意并继续"
    cancel-text="不同意"
    @confirm="handleConfirm"
    @cancel="handleCancel"
  >
    <view class="privacy-consent-body">
      <text class="privacy-consent-text">欢迎使用回车键（Poementer）！我们非常重视您的个人信息保护，将按照《中华人民共和国个人信息保护法》等法律法规的要求处理您的个人信息。</text>
      <text class="privacy-consent-text">在使用本应用前，请您仔细阅读并充分理解<text class="privacy-consent-link" @tap.stop="openPolicy">《隐私政策》</text>。点击“同意并继续”即表示您已阅读并同意该政策。</text>
      <text class="privacy-consent-text">如您不同意，将无法使用本应用的完整功能。</text>
    </view>
  </AppDialog>
</template>

<script>
import AppDialog from '@/components/overlay/AppDialog.vue';
import { openPrivacyPolicy } from '@/utils/privacyConsent.js';

export default {
  name: 'PrivacyConsentDialog',
  components: { AppDialog },
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
    },
    openPolicy() {
      openPrivacyPolicy();
    }
  }
};
</script>

<style scoped>
.privacy-consent-body {
  padding-bottom: 4rpx;
}

.privacy-consent-text {
  display: block;
  font-size: 28rpx;
  line-height: 1.6;
  color: var(--overlay-muted, #666);
  overflow-wrap: anywhere;
}

.privacy-consent-text + .privacy-consent-text {
  margin-top: 16rpx;
}

.privacy-consent-link {
  color: var(--app-link-color, #333333);
  text-decoration: underline;
}
</style>
