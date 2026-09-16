<template>
    <!-- 颜色选择弹层 -->
    <AppActionSheet ref="sheet" :visible="show" title="选择配色" :is-dark="isDark"
        @cancel="$emit('close')" @select="$emit('select', $event)">
        <view class="color-picker">
            <!-- 色卡选择界面 -->
            <view v-if="step === 'palette'" class="color-palette-step">
                <view class="color-picker-title">选择色卡</view>
                <scroll-view class="palette-scroll" :scroll-y="true">
                    <view class="palette-grid">
                        <view 
                            v-for="(palette, index) in colorPalettes" 
                            :key="index" 
                            class="palette-card" 
                            :style="{ backgroundColor: palette.colors[0].backgroundColor }"
                            @tap="onSelectPalette(index)"
                        >
                            <view class="palette-name" :style="{ color: palette.colors[0].textColor }">{{ palette.name }}</view>
                            <view class="palette-preview">
                                <view 
                                    v-for="(color, colorIndex) in palette.colors.slice(0, 3)" 
                                    :key="colorIndex"
                                    class="mini-color"
                                    :style="{ backgroundColor: color.backgroundColor }"
                                ></view>
                            </view>
                        </view>
                    </view>
                </scroll-view>
            </view>

            <!-- 具体颜色选择界面 -->
            <view v-if="step === 'colors'" class="color-detail-step">
                <view class="color-picker-header">
                    <view class="color-picker-title">{{ currentPalette.name }}</view>
                    <view class="color-picker-back-btn" @tap="goBackToPalette">
                        <image class="color-picker-back-icon" src="/static/images/back_to_edit.png" mode="aspectFit"></image>
                    </view>
                </view>
                <scroll-view class="colors-scroll" :scroll-y="true">
                    <view class="colors-grid">
                        <view 
                            v-for="(color, index) in currentPalette.colors" 
                            :key="index" 
                            class="color-option"
                            :style="{ backgroundColor: color.backgroundColor, color: color.textColor }"
                            @tap="onChooseColor(color)"
                        >
                            <text class="color-text">{{ getPoemLine(index) }}</text>
                            <text v-if="isColorSelected(color)" class="color-check">✓</text>
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
    name: 'ColorPickerModal',
    components: { AppActionSheet },
    emits: ['close', 'select'],
    props: {
        show: {
            type: Boolean,
            default: false
        },
        colorPalettes: {
            type: Array,
            default: () => []
        },
        poemLines: {
            type: Array,
            default: () => []
        },
        selectedColorCombination: {
            type: Object,
            default: null
        },
        isDark: {
            type: Boolean,
            default: null
        }
    },
    data() {
        return {
            step: 'palette', // 'palette' 或 'colors'
            currentPalette: null,
            currentPaletteIndex: 0
        };
    },
    watch: {
        // 下次展开时重置，退出动画期间保留正在查看的色卡。
        show(val) {
            if (val) {
                this.step = 'palette';
                this.currentPalette = null;
                this.currentPaletteIndex = 0;
            }
        }
    },
    methods: {
        // 选择色卡
        onSelectPalette(index) {
            this.currentPaletteIndex = index;
            this.currentPalette = this.colorPalettes[index];
            this.step = 'colors';
        },

        // 返回色卡选择
        goBackToPalette() {
            this.step = 'palette';
            this.currentPalette = null;
        },

        // 选择颜色
        onChooseColor(color) {
            this.$refs.sheet.selectValue(color);
        },

        // 获取诗歌句子
        getPoemLine(index) {
            const globalIndex = this.getGlobalTextIndex(index);
            return this.poemLines[globalIndex] || '示例文字';
        },

        // 获取全局文案索引
        getGlobalTextIndex(localIndex) {
            const colorsBeforeCurrent = this.getColorsCountBeforeCurrent();
            return (colorsBeforeCurrent + localIndex) % this.poemLines.length;
        },

        // 获取当前色卡之前所有色卡的颜色总数
        getColorsCountBeforeCurrent() {
            let count = 0;
            for (let i = 0; i < this.currentPaletteIndex; i++) {
                count += this.colorPalettes[i].colors.length;
            }
            return count;
        },

        // 检查颜色是否被选中
        isColorSelected(color) {
            return this.selectedColorCombination && 
                   this.selectedColorCombination.backgroundColor === color.backgroundColor &&
                   this.selectedColorCombination.textColor === color.textColor;
        }
    }
};
</script>

<style scoped>
.color-picker {
    width: 100%;
    padding: 32rpx;
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    color: var(--overlay-text);
}

.color-picker-title {
    font-size: 32rpx;
    font-weight: 600;
    color: var(--overlay-text);
    flex: 1;
    text-align: center;
}

.color-picker-header {
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 24rpx;
    position: relative;
}

.color-picker-back-btn {
    position: absolute;
    top: 0;
    right: 0;
    width: 80rpx;
    height: 80rpx;
    display: flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    border-radius: 50%;
    z-index: 10;
}

.color-picker-back-icon {
    width: 60rpx;
    height: 60rpx;
    filter: var(--app-icon-filter, none);
}

/* 色卡选择界面 */
.color-palette-step {
    display: flex;
    flex-direction: column;
    height: 100%;
}

.color-palette-step .color-picker-title {
    margin-bottom: 32rpx;
}

.palette-scroll {
    height: 48vh;
}

.palette-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    grid-gap: 20rpx;
    padding: 0 10rpx;
}

.palette-card {
    height: 120rpx;
    border-radius: 16rpx;
    padding: 16rpx;
    position: relative;
    box-shadow: 0 4rpx 12rpx rgba(0,0,0,.1);
    transition: transform 0.2s ease;
}

.palette-card:active {
    transform: scale(0.98);
}

.palette-name {
    font-size: 24rpx;
    font-weight: 600;
    margin-bottom: 8rpx;
    text-shadow: 0 1rpx 2rpx rgba(0,0,0,0.3);
}

.palette-preview {
    display: flex;
    gap: 8rpx;
}

.mini-color {
    width: 20rpx;
    height: 20rpx;
    border-radius: 50%;
    border: 2rpx solid rgba(255,255,255,0.5);
}

/* 具体颜色选择界面 */
.colors-scroll {
    height: 48vh;
}

.colors-grid {
    display: grid;
    grid-template-columns: repeat(1, 1fr);
    grid-gap: 16rpx;
    padding: 0 10rpx;
}

.color-option {
    height: 100rpx;
    border-radius: 16rpx;
    padding: 20rpx;
    position: relative;
    box-shadow: 0 4rpx 12rpx rgba(0,0,0,.1);
    transition: transform 0.2s ease;
    display: flex;
    align-items: center;
    justify-content: space-between;
}

.color-option:active {
    transform: scale(0.98);
}

.color-text {
    font-size: 28rpx;
    font-weight: 500;
}

.color-check { 
    position: absolute; 
    right: 20rpx; 
    top: 50%;
    transform: translateY(-50%);
    font-size: 32rpx; 
    font-weight: bold;
    text-shadow: 0 1rpx 2rpx rgba(0,0,0,.3); 
}

</style>
