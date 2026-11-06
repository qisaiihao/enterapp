<template>
    <view class="creation-editor" @tap.stop>
        <view class="creation-row">
            <input
                class="creation-input creation-date"
                :value="value.showCreationDate ? value.creationDate : ''"
                placeholder="创作时间（选填）"
                placeholder-class="creation-placeholder"
                aria-label="创作时间"
                maxlength="40"
                :adjust-position="true"
                @input="changeDate"
            />
        </view>
        <view class="creation-row">
            <input
                class="creation-input creation-location"
                :value="value.showCreationLocation ? value.creationLocation : ''"
                placeholder="创作地点（选填）"
                placeholder-class="creation-placeholder"
                aria-label="创作地点"
                maxlength="40"
                :adjust-position="true"
                @input="changeLocation"
            />
        </view>
    </view>
</template>

<script>
export default {
    name: 'PoemCreationEditor',
    props: { value: { type: Object, required: true } },
    emits: ['change'],
    methods: {
        changeDate(event) {
            const creationDate = event.detail.value;
            this.$emit('change', { creationDate, showCreationDate: !!creationDate.trim() });
        },
        changeLocation(event) {
            const creationLocation = event.detail.value;
            this.$emit('change', { creationLocation, showCreationLocation: !!creationLocation.trim() });
        }
    }
};
</script>

<style scoped>
.creation-row { padding-bottom: 8rpx; border-bottom: 2rpx solid var(--app-primary-text, #333); }
.creation-row + .creation-row { margin-top: 32rpx; }
.creation-input { width: 100%; height: 52rpx; border: none; background: transparent; outline: none; font-size: 24rpx; line-height: 1; text-align: right; color: var(--app-primary-text, #333); }
.creation-placeholder { color: var(--app-input-placeholder, #d0d0d0); font-size: 24rpx; text-align: right; }
</style>
