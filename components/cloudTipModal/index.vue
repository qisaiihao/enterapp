<template>
    <AppActionSheet :visible="showTip" :title="title" cancel-text="知道了" @cancel="onClose">
        <view class="install-tip-content">
            <view class="install-tip-title">{{ title }}</view>
            <view class="install-tip-message">{{ content }}</view>
        </view>
    </AppActionSheet>
</template>

<script>
import AppActionSheet from '@/components/overlay/AppActionSheet.vue';

export default {
    components: { AppActionSheet },
    props: { showTipProps: Boolean, title: String, content: String },
    data() { return { showTip: false }; },
    watch: {
        showTipProps: {
            immediate: true,
            handler(value) { this.showTip = value; }
        }
    },
    methods: {
        onClose() { this.showTip = false; }
    }
};
</script>

<style scoped>
.install-tip-content { padding: 40rpx 32rpx; text-align: center; }
.install-tip-title { font-size: 30rpx; color: var(--overlay-text); }
.install-tip-message { margin-top: 16rpx; font-size: 26rpx; line-height: 1.6; color: var(--overlay-muted); white-space: pre-wrap; }
</style>
