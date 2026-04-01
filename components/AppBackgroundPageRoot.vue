<template>
    <view
        class="app-background-page-root"
        :class="{ 'has-app-background-page': hasAppBackground }"
        :style="appBackgroundPageStyle"
    >
        <view v-if="hasAppBackground" class="app-background-image"></view>
        <view v-if="hasAppBackground" class="app-background-overlay"></view>
        <slot />
    </view>
</template>

<script>
import appBackgroundPageMixin from '@/mixins/appBackgroundPage.js';

export default {
    name: 'AppBackgroundPageRoot',
    mixins: [appBackgroundPageMixin],
    data() {
        return {
            _pageShowHook: null
        };
    },
    mounted() {
        if (this.$parent && this.$parent.$on) {
            this._pageShowHook = () => {
                this.refreshAppBackground();
            };
            this.$parent.$on('hook:onShow', this._pageShowHook);
        }
    },
    beforeUnmount() {
        if (this._pageShowHook && this.$parent && this.$parent.$off) {
            this.$parent.$off('hook:onShow', this._pageShowHook);
        }
        this._pageShowHook = null;
    }
};
</script>

<style>
.app-background-image {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background-image: var(--app-background-image);
    background-size: cover;
    background-position: center top;
    z-index: 0;
    pointer-events: none;
}

.app-background-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(255, 255, 255, 0.45);
    z-index: 1;
    pointer-events: none;
}
</style>
