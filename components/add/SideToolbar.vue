<template>
    <view class="side-toolbar">
        <view class="side-tool-btn" @tap.stop="$emit('toggle-tags')">
            <image class="side-tool-icon" src="/static/images/newicons/tag.png" mode="aspectFit" />
        </view>

        <view class="side-tool-btn" @tap.stop="$emit('choose-image')">
            <image class="side-tool-icon" src="/static/images/newicons/image.png" mode="aspectFit" />
        </view>

        <view class="side-tool-btn mode-switch-btn" @tap.stop="$emit('switch-mode')">
            <image class="side-tool-icon mode-switch-icon" src="/static/images/newicons/switch_publish.png" mode="aspectFit" alt="切换发布模式" />
        </view>

        <view
            v-if="publishMode === 'poem'"
            class="side-tool-btn series-toggle-btn"
            @tap.stop="$emit('toggle-series')"
        >
            <text class="side-tool-text">组</text>
        </view>

        <view v-if="publishMode === 'poem'" class="side-tool-btn" @tap.stop="$emit('toggle-highlight')">
            <image class="side-tool-icon" src="/static/images/newicons/highlight.png" mode="aspectFit" />
        </view>

        <view v-if="publishMode === 'poem'" class="side-tool-btn" @tap.stop="$emit('select-color')">
            <image class="side-tool-icon" src="/static/images/select_color.png" mode="aspectFit" />
        </view>
    </view>
</template>

<script>
export default {
    name: 'SideToolbar',
    props: {
        publishMode: {
            type: String,
            default: 'normal'
        },
        isSeries: {
            type: Boolean,
            default: false
        }
    }
};
</script>

<style scoped>
.side-toolbar {
    position: absolute;
    top: 0;
    right: 0;
    bottom: 0;
    width: 90rpx;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: flex-start;
    gap: 0;
    z-index: 10;
    padding: 20rpx 0;
    background: transparent;
}

.side-tool-btn {
    width: 90rpx;
    height: 90rpx;
    border: none;
    background: transparent;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: none;
    transition: all 0.2s ease;
    flex-shrink: 0;
    margin-bottom: 20rpx;
    margin-right: 0rpx;
}

.side-tool-btn:active { 
    transform: scale(0.95);
}

.mode-switch-btn {
    position: relative;
}

.mode-switch-icon {
    border-radius: 50%;
    background: transparent;
    box-shadow: none;
}

.side-tool-icon { 
    width: 110rpx;
    height: 110rpx;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 30rpx;
    color: #333;
}

.side-tool-text {
    font-size: 36rpx;
    font-weight: 700;
    color: #444;
    line-height: 90rpx;
}

/* 移除组诗按钮的 active 状态样式 */

@media screen and (max-width: 750rpx) {
    .side-toolbar {
        width: 70rpx;
        gap: 15rpx;
    }

    .side-tool-btn {
        width: 70rpx;
        height: 70rpx;
    }

    .mode-switch-icon {
        width: 70rpx;
        height: 70rpx;
    }

    .side-tool-icon {
        font-size: 18rpx;
    }
}

@media screen and (min-width: 1200rpx) {
    .side-toolbar {
        width: 90rpx;
        gap: 25rpx;
    }

    .side-tool-btn {
        width: 80rpx;
        height: 80rpx;
    }

    .mode-switch-icon {
        width: 90rpx;
        height: 90rpx;
    }

    .side-tool-icon {
        font-size: 22rpx;
    }
}

@media screen and (max-width: 600rpx) {
    .side-toolbar {
        position: relative;
        top: auto;
        right: auto;
        bottom: auto;
        width: 100%;
        height: auto;
        flex-direction: row;
        justify-content: space-around;
        padding: 20rpx 0;
        gap: 10rpx;
    }
}
</style>
