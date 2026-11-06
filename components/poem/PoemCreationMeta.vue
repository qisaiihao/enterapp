<template>
    <view v-if="label" class="poem-creation-meta" :style="color ? { color } : {}">
        <text selectable :user-select="true">{{ label }}</text>
    </view>
</template>

<script>
import { getCreationLabel } from '@/utils/poemCreation.js';

export default {
    name: 'PoemCreationMeta',
    props: {
        post: { type: Object, required: true },
        color: { type: String, default: '' }
    },
    computed: {
        label() { return getCreationLabel(this.post); }
    }
};
</script>

<style scoped>
.poem-creation-meta {
    margin-top: 32rpx;
    padding-bottom: 8rpx;
    font-family: 'Huiwen-mincho', '汇文明朝', serif;
    font-size: 22rpx;
    line-height: 1.8;
    letter-spacing: 2rpx;
    text-align: right;
    overflow-wrap: anywhere;
    color: var(--app-secondary-text, #777);
    opacity: 0.65;
}
</style>
