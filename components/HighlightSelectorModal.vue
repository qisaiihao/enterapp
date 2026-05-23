<template>
    <!-- 高光选择全屏弹窗 -->
    <view v-if="show" class="highlight-selection-modal" 
          :class="{ 'highlight-selection-modal--dark': isDark }"
          @tap="onClose"
          @touchstart="onTouchStart"
          @touchmove="onTouchMove"
          @touchend="onTouchEnd">
        <view class="highlight-modal-content" @tap.stop>
            <!-- 自定义Toast提示（解决层级问题） -->
            <view v-if="showTip" class="custom-toast">
                <text class="custom-toast-text">{{ tipText }}</text>
            </view>
            <!-- 标题栏 -->
            <view class="highlight-modal-header">
                <text class="highlight-modal-title">选择高光句</text>
                <view class="highlight-modal-close" @tap="onClose">×</view>
            </view>
            
            <!-- 内容选择区域 -->
            <scroll-view class="highlight-content-wrapper" scroll-y="true" :show-scrollbar="false">
                <view class="highlight-content-display">
                    <view
                        v-for="(line, index) in contentLines"
                        :key="index"
                        class="highlight-content-line"
                        :class="{ 'selected-line': selectedIndices.includes(index) }"
                        @tap.stop="onToggleLine(index)"
                    >
                        <text class="highlight-content-line-text">{{ line || '\u00A0' }}</text>
                    </view>
                </view>
            </scroll-view>
            
            <!-- 底部操作栏 -->
            <view class="highlight-modal-actions">
                <view class="highlight-action-btn primary" 
                      @tap.stop="onConfirm" 
                      :class="{ 'disabled': selectedIndices.length === 0 }">
                    <image class="highlight-action-icon" src="/static/images/confirm_selection.png" mode="aspectFill"></image>
                </view>
            </view>
        </view>
    </view>
</template>

<script>
export default {
    name: 'HighlightSelectorModal',
    emits: ['close', 'update', 'confirm'],
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
        },
        isDark: {
            type: Boolean,
            default: false
        }
    },
    data() {
        return {
            // 内部维护选中状态
            selectedIndices: [],
            touchStartX: 0,
            touchStartY: 0,
            touchCurrentX: 0,
            touchCurrentY: 0,
            // 自定义提示
            showTip: false,
            tipText: '',
            tipTimer: null
        };
    },
    watch: {
        // 当弹窗打开时，同步外部的选中状态
        show(val) {
            if (val) {
                this.selectedIndices = [...this.selectedLineIndices];
            }
        },
        // 监听外部选中状态变化
        selectedLineIndices: {
            handler(val) {
                if (this.show) {
                    this.selectedIndices = [...val];
                }
            },
            deep: true
        }
    },
    methods: {
        onTouchStart(e) {
            const touch = e && e.touches && e.touches[0];
            if (!touch) return;

            this.touchStartX = touch.pageX || touch.clientX || 0;
            this.touchStartY = touch.pageY || touch.clientY || 0;
            this.touchCurrentX = this.touchStartX;
            this.touchCurrentY = this.touchStartY;
        },

        onTouchMove(e) {
            const touch = e && e.touches && e.touches[0];
            if (!touch) return;

            this.touchCurrentX = touch.pageX || touch.clientX || 0;
            this.touchCurrentY = touch.pageY || touch.clientY || 0;
        },

        onTouchEnd() {
            const deltaX = this.touchCurrentX - this.touchStartX;
            const deltaY = Math.abs(this.touchCurrentY - this.touchStartY);

            if (Math.abs(deltaX) > deltaY && Math.abs(deltaX) > 30) {
                this.onClose();
            }
        },

        // 关闭弹窗
        onClose() {
            this.$emit('close');
        },

        // 显示自定义提示
        showCustomTip(text, duration = 2000) {
            // 清除之前的定时器
            if (this.tipTimer) {
                clearTimeout(this.tipTimer);
            }
            this.tipText = text;
            this.showTip = true;
            this.tipTimer = setTimeout(() => {
                this.showTip = false;
            }, duration);
        },

        // 切换行选中状态
        onToggleLine(index) {
            const arr = [...this.selectedIndices];
            const pos = arr.indexOf(index);
            
            if (pos >= 0) {
                arr.splice(pos, 1);
            } else {
                // 限制最多选择三行
                if (arr.length >= 3) {
                    this.showCustomTip('最多只能选择三行高光');
                    return;
                }
                arr.push(index);
            }
            
            arr.sort((a, b) => a - b);
            this.selectedIndices = arr;
            this.$emit('update', arr);
        },

        // 确认选择
        onConfirm() {
            if (this.selectedIndices.length === 0) return;
            this.$emit('confirm', this.selectedIndices);
        }
    },
    beforeUnmount() {
        if (this.tipTimer) {
            clearTimeout(this.tipTimer);
            this.tipTimer = null;
        }
    }
};
</script>

<style scoped>
/* 高光选择全屏弹窗样式 */
.highlight-selection-modal {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: var(--app-page-bg, #fff);
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
    background: var(--app-surface-bg, #fff);
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
    border-bottom: var(--app-surface-border-line, 1rpx solid #f0f0f0);
    background: var(--app-surface-bg, #fff);
}

/* #ifdef MP-WEIXIN */
.highlight-modal-header {
    justify-content: flex-start;
}
/* #endif */

.highlight-modal-title {
    font-size: 32rpx;
    font-weight: 600;
    color: var(--app-primary-text, #333);
}

.highlight-modal-close {
    width: 60rpx;
    height: 60rpx;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 40rpx;
    color: var(--app-muted-text, #999);
    border-radius: 50%;
    background: var(--app-subtle-surface-bg, #f5f5f5);
}

/* #ifdef MP-WEIXIN */
.highlight-modal-close {
    margin-left: 20rpx;
}
/* #endif */

.highlight-content-wrapper {
    flex: 1;
    height: 0;
    padding: 40rpx;
    background: var(--app-surface-bg, #fff);
    box-sizing: border-box;
}

.highlight-content-display {
    display: flex;
    flex-direction: column;
    padding-bottom: 180rpx;
}

.highlight-content-line {
    margin-bottom: 16rpx;
    padding: 12rpx 16rpx;
    border-radius: 8rpx;
    color: var(--app-muted-text, #999);
    transition: all 0.2s ease;
}

.highlight-content-line-text {
    line-height: 1.8;
    font-size: 36rpx;
    white-space: pre-wrap;
    word-break: break-word;
    color: inherit;
}

.highlight-content-line.selected-line {
    color: #000;
    font-weight: 500;
    background: rgba(158, 215, 238, 0.14);
}

.highlight-content-line.selected-line .highlight-content-line-text {
    font-weight: 500;
}

/* #ifdef MP-WEIXIN */
.highlight-content-line.selected-line {
    background: #e6f7ff;
}
/* #endif */

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

/* 自定义Toast提示样式 */
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

.highlight-selection-modal--dark {
    background: #0f1115;
}

.highlight-selection-modal--dark .highlight-modal-content,
.highlight-selection-modal--dark .highlight-modal-header,
.highlight-selection-modal--dark .highlight-content-wrapper {
    background: #171a20;
}

.highlight-selection-modal--dark .highlight-modal-header {
    border-bottom: 1rpx solid rgba(255, 255, 255, 0.12);
}

.highlight-selection-modal--dark .highlight-modal-title {
    color: #f4f1ea;
}

.highlight-selection-modal--dark .highlight-modal-close {
    color: #c9ced8;
    background: rgba(255, 255, 255, 0.08);
}

.highlight-selection-modal--dark .highlight-content-line {
    color: #c9ced8;
}

.highlight-selection-modal--dark .highlight-content-line.selected-line {
    background: rgba(201, 173, 115, 0.18);
    color: #f4f1ea;
}

.highlight-selection-modal--dark .highlight-action-icon {
    filter: brightness(0) invert(1);
    opacity: 0.92;
}
</style>
