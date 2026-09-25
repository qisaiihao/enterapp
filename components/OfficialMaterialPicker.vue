<template>
    <!-- 官方素材选择弹层：先选分组，再选具体素材 -->
    <AppActionSheet ref="sheet" :visible="show" :title="title" @cancel="$emit('close')" @select="$emit('select', $event)">
        <view class="official-picker" :class="{ portrait }">
            <!-- 分组选择 -->
            <view v-if="step === 'groups'" class="picker-step">
                <view class="picker-title">选择分组</view>
                <scroll-view class="picker-scroll" :scroll-y="true">
                    <view v-if="loading" class="picker-state">正在加载官方素材…</view>
                    <view v-else-if="error" class="picker-state">{{ error }}</view>
                    <view v-else-if="!groupList.length" class="picker-state">{{ emptyText }}</view>
                    <view v-else class="group-grid">
                        <view v-for="(group, index) in groupList" :key="group.id || index" class="group-card" @tap="openGroup(index)">
                            <view class="group-name">{{ group.name }}</view>
                            <view class="group-preview">
                                <image v-for="item in group.materials.slice(0, 3)" :key="item.id" :src="item.url" mode="aspectFit" />
                                <text v-if="!group.materials.length" class="group-empty">空</text>
                            </view>
                            <text class="group-count">{{ group.materials.length }} 个素材</text>
                        </view>
                    </view>
                </scroll-view>
            </view>

            <!-- 素材选择 -->
            <view v-else class="picker-step">
                <view class="picker-header">
                    <view class="picker-title">{{ currentGroup.name }}</view>
                    <view class="picker-back" @tap="backToGroups">
                        <text class="picker-back-text">返回</text>
                    </view>
                </view>
                <scroll-view class="picker-scroll" :scroll-y="true">
                    <view v-if="!currentGroup.materials.length" class="picker-state">这个分组还没有素材</view>
                    <view v-else class="material-grid">
                        <view v-for="item in currentGroup.materials" :key="item.id" class="material-card" :class="{ selected: item.id === selectedId }" @tap="choose(item)">
                            <view class="material-image"><image :src="item.url" mode="aspectFit" /></view>
                            <text class="material-name">{{ item.name }}</text>
                            <text v-if="item.id === selectedId" class="material-check">✓</text>
                        </view>
                    </view>
                </scroll-view>
            </view>
        </view>
    </AppActionSheet>
</template>

<script>
import AppActionSheet from '@/components/overlay/AppActionSheet.vue';

export default {
    name: 'OfficialMaterialPicker',
    components: { AppActionSheet },
    emits: ['close', 'select'],
    props: {
        show: { type: Boolean, default: false },
        title: { type: String, default: '官方素材库' },
        groups: { type: Array, default: () => [] },
        loading: { type: Boolean, default: false },
        portrait: { type: Boolean, default: false },
        error: { type: String, default: '' },
        emptyText: { type: String, default: '官方素材库暂时没有素材' },
        selectedId: { type: String, default: '' }
    },
    data() {
        return { step: 'groups', currentGroupIndex: 0 };
    },
    computed: {
        groupList() {
            return this.groups.map(group => ({ ...group, materials: Array.isArray(group.materials) ? group.materials : [] }));
        },
        currentGroup() {
            return this.groupList[this.currentGroupIndex] || { name: '', materials: [] };
        }
    },
    watch: {
        // 下次展开时回到分组选择，退出动画期间保留正在查看的分组。
        show(value) {
            if (value) {
                this.step = 'groups';
                this.currentGroupIndex = 0;
            }
        }
    },
    methods: {
        openGroup(index) {
            this.currentGroupIndex = index;
            this.step = 'materials';
        },
        backToGroups() {
            this.step = 'groups';
        },
        choose(item) {
            this.$refs.sheet.selectValue(item);
        }
    }
};
</script>

<style scoped>
.official-picker {
    width: 100%;
    padding: 32rpx;
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    color: var(--overlay-text);
}

.picker-step {
    display: flex;
    flex-direction: column;
}

.picker-title {
    font-size: 32rpx;
    font-weight: 600;
    color: var(--overlay-text);
    flex: 1;
    text-align: center;
}

.picker-step > .picker-title {
    margin-bottom: 32rpx;
}

.picker-header {
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 24rpx;
    position: relative;
}

.picker-back {
    position: absolute;
    top: 0;
    right: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    min-width: 88rpx;
    height: 64rpx;
}

.picker-back-text {
    font-size: 26rpx;
    color: var(--overlay-muted, #777);
}

.picker-scroll {
    height: 48vh;
}

.picker-state {
    padding: 80rpx 0;
    text-align: center;
    font-size: 26rpx;
    color: var(--overlay-muted, #888);
}

.group-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    grid-gap: 20rpx;
    padding: 0 10rpx;
}

.group-card {
    padding: 20rpx;
    border-radius: 16rpx;
    background: var(--overlay-control-bg, #f5f5f5);
    border: 1px solid var(--overlay-divider, #e5e5e5);
    box-sizing: border-box;
    transition: transform 0.2s ease;
}

.group-card:active {
    transform: scale(0.98);
}

.group-name {
    font-size: 28rpx;
    font-weight: 600;
    color: var(--overlay-text);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.group-preview {
    display: flex;
    align-items: center;
    gap: 8rpx;
    height: 96rpx;
    margin: 16rpx 0 8rpx;
}

.group-preview image {
    flex: 1;
    min-width: 0;
    height: 96rpx;
    border-radius: 8rpx;
    background: repeating-conic-gradient(#e9e9e3 0% 25%, #fafaf7 0% 50%) 0 / 14px 14px;
}

.group-empty {
    font-size: 24rpx;
    color: var(--overlay-muted, #999);
}

.group-count {
    display: block;
    font-size: 22rpx;
    color: var(--overlay-muted, #888);
}

.material-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    grid-gap: 20rpx;
    padding: 0 10rpx;
}

.material-card {
    position: relative;
    padding: 16rpx;
    border-radius: 16rpx;
    background: var(--overlay-control-bg, #f5f5f5);
    border: 1px solid var(--overlay-divider, #e5e5e5);
    box-sizing: border-box;
    transition: transform 0.2s ease;
}

.material-card:active {
    transform: scale(0.98);
}

.material-card.selected {
    border-color: #547458;
    background: #e8eedf;
}

.material-image {
    height: 150rpx;
    border-radius: 10rpx;
    background: repeating-conic-gradient(#e9e9e3 0% 25%, #fafaf7 0% 50%) 0 / 14px 14px;
}

.material-image image {
    display: block;
    width: 100%;
    height: 100%;
}

.material-name {
    display: block;
    margin-top: 12rpx;
    font-size: 24rpx;
    color: var(--overlay-text);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.material-check {
    position: absolute;
    top: 8rpx;
    right: 16rpx;
    font-size: 32rpx;
    font-weight: bold;
    color: #304d3b;
}

.official-picker.portrait .group-preview {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 8rpx;
    height: auto;
}

.official-picker.portrait .group-preview image {
    width: 100%;
    height: auto;
    aspect-ratio: 3 / 4;
}

.official-picker.portrait .material-image {
    height: auto;
    aspect-ratio: 3 / 4;
}
</style>
