<template>
    <view v-if="show" class="highlight-selection-modal">
        <view class="highlight-modal-content" @tap.stop>
            <view v-if="showTip" class="custom-toast">
                <text class="custom-toast-text">{{ tipText }}</text>
            </view>

            <view class="highlight-modal-header">
                <text class="highlight-modal-title">选择高光句</text>
                <view class="highlight-modal-close" @tap.stop="onClose">×</view>
            </view>

            <scroll-view class="highlight-content-wrapper" :scroll-y="true" enable-flex="true">
                <view class="highlight-content-display">
                    <view
                        v-for="(line, index) in contentLines"
                        :key="index"
                        class="highlight-content-line"
                        :class="{ 'selected-line': selectedIndices.includes(index) }"
                        @tap.stop="onToggleLine(index)"
                    >
                        <text class="highlight-content-line-text">{{ line || '' }}</text>
                    </view>
                </view>
            </scroll-view>

            <view class="highlight-modal-actions">
                <view
                    class="highlight-action-btn primary"
                    :class="{ 'disabled': selectedIndices.length === 0 }"
                    @tap.stop="onConfirm"
                >
                    <image class="highlight-action-icon" src="/static/images/confirm_selection.png" mode="aspectFill"></image>
                </view>
            </view>
        </view>
    </view>
</template>

<script>
export default {
    name: 'HighlightSelectorModal',
    props: {
        show: {
            type: Boolean,
            default: false
        },
        contentLines: {
            type: Array,
            default: () => []
        },
        selectedLineIndices: {
            type: Array,
            default: () => []
        }
    },
    data() {
        return {
            selectedIndices: [],
            showTip: false,
            tipText: '',
            tipTimer: null
        };
    },
    watch: {
        show(val) {
            if (val) {
                this.selectedIndices = [...this.selectedLineIndices];
            }
        },
        selectedLineIndices: {
            handler(val) {
                if (this.show) {
                    this.selectedIndices = [...val];
                }
            },
            deep: true
        }
    },
    beforeDestroy() {
        if (this.tipTimer) {
            clearTimeout(this.tipTimer);
            this.tipTimer = null;
        }
    },
    methods: {
        onClose() {
            this.$emit('close');
        },

        showCustomTip(text, duration = 2000) {
            if (this.tipTimer) {
                clearTimeout(this.tipTimer);
            }

            this.tipText = text;
            this.showTip = true;
            this.tipTimer = setTimeout(() => {
                this.showTip = false;
                this.tipTimer = null;
            }, duration);
        },

        onToggleLine(index) {
            const arr = [...this.selectedIndices];
            const pos = arr.indexOf(index);

            if (pos >= 0) {
                arr.splice(pos, 1);
            } else {
                if (arr.length >= 3) {
                    this.showCustomTip('最多只能选择三句高光');
                    return;
                }
                arr.push(index);
            }

            arr.sort((a, b) => a - b);
            this.selectedIndices = arr;
            this.$emit('update', arr);
        },

        onConfirm() {
            if (this.selectedIndices.length === 0) {
                return;
            }
            this.$emit('confirm', this.selectedIndices);
        }
    }
};
</script>

<style scoped>
.highlight-selection-modal {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: #fff;
    z-index: 99999;
    display: flex;
    flex-direction: column;
    padding-top: 60px;
    padding-top: calc(env(safe-area-inset-top) + 16px);
    padding-top: calc(constant(safe-area-inset-top) + 16px);
}

.highlight-modal-content {
    width: 100%;
    height: 100%;
    background: #fff;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    height: calc(100% - 60px);
    height: calc(100% - env(safe-area-inset-top) - 16px);
    height: calc(100% - constant(safe-area-inset-top) - 16px);
}

.highlight-modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 30rpx 40rpx;
    border-bottom: 1rpx solid #f0f0f0;
    background: #fff;
}

.highlight-modal-title {
    font-size: 32rpx;
    font-weight: 600;
    color: #333;
}

.highlight-modal-close {
    width: 60rpx;
    height: 60rpx;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 40rpx;
    color: #999;
    border-radius: 50%;
    background: #f5f5f5;
}

.highlight-content-wrapper {
    flex: 1;
    height: 0;
    padding: 40rpx;
    box-sizing: border-box;
    background: #fff;
}

.highlight-content-display {
    display: flex;
    flex-direction: column;
    padding-bottom: 220rpx;
}

.highlight-content-line {
    display: block;
    min-height: 72rpx;
    margin-bottom: 16rpx;
    padding: 12rpx 16rpx;
    border-radius: 8rpx;
    line-height: 1.8;
    font-size: 36rpx;
    color: #999;
    transition: all 0.2s ease;
}

.highlight-content-line-text {
    display: block;
    min-height: 48rpx;
    white-space: pre-wrap;
    word-break: break-word;
}

.highlight-content-line.selected-line {
    color: #000;
    font-weight: 500;
    background: rgba(158, 215, 238, 0.22);
}

.highlight-modal-actions {
    position: fixed;
    bottom: 60rpx;
    right: 30rpx;
    z-index: 1001;
}

.highlight-action-btn {
    width: 140rpx;
    height: 140rpx;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.3s ease;
}

.highlight-action-btn.primary {
    background: transparent;
}

.highlight-action-btn.primary.disabled {
    opacity: 0.5;
}

.highlight-action-btn:active {
    transform: scale(0.95);
}

.highlight-action-icon {
    width: 120rpx;
    height: 120rpx;
}

.custom-toast {
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background: rgba(0, 0, 0, 0.75);
    padding: 20rpx 40rpx;
    border-radius: 12rpx;
    z-index: 999999;
}

.custom-toast-text {
    color: #fff;
    font-size: 28rpx;
    white-space: nowrap;
}
</style>
