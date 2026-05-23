<template>
    <view class="side-toolbar" :class="[toolbarClassName, { 'side-toolbar--dark': isDark }]">
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
            <image class="side-tool-icon" src="/static/images/zushi_new.png" mode="aspectFit" />
        </view>

        <view v-if="publishMode === 'poem'" class="side-tool-btn" @tap.stop="$emit('toggle-highlight')">
            <image class="side-tool-icon" src="/static/images/newicons/highlight.png" mode="aspectFit" />
        </view>

        <view v-if="publishMode === 'poem'" class="side-tool-btn color-tool-btn" @tap.stop="$emit('select-color')">
            <view class="side-tool-icon color-tool-icon">
                <view class="color-swatch color-swatch--blue"></view>
                <view class="color-swatch color-swatch--brown"></view>
                <view class="color-swatch color-swatch--lime"></view>
                <view class="color-swatch color-swatch--green"></view>
                <view class="color-swatch color-swatch--red"></view>
                <view class="color-swatch color-swatch--cream"></view>
                <view class="color-swatch color-swatch--black">
                    <view class="color-dot"></view>
                    <view class="color-dot"></view>
                    <view class="color-dot"></view>
                </view>
            </view>
        </view>
    </view>
</template>

<script>
export default {
    name: 'SideToolbar',
    emits: ['toggle-tags', 'choose-image', 'switch-mode', 'toggle-series', 'toggle-highlight', 'select-color'],
    props: {
        publishMode: {
            type: String,
            default: 'normal'
        },
        isSeries: {
            type: Boolean,
            default: false
        },
        layoutVariant: {
            type: String,
            default: 'default'
        },
        isDark: {
            type: Boolean,
            default: false
        }
    },
    computed: {
        toolbarClassName() {
            return this.layoutVariant && this.layoutVariant !== 'default'
                ? `side-toolbar--${this.layoutVariant}`
                : '';
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
    background: var(--app-control-press-bg, transparent);
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
    color: var(--app-primary-text, #333);
    filter: var(--app-add-action-icon-filter, none);
    opacity: var(--app-add-action-icon-opacity, 1);
}

.series-toggle-btn .side-tool-icon {
    width: 60rpx;
    height: 60rpx;
}

.color-tool-icon {
    position: relative;
    width: 58rpx;
    height: 92rpx;
    display: block;
    filter: none;
    opacity: 1;
}

.color-swatch {
    position: absolute;
    left: 50%;
    width: 58rpx;
    height: 28rpx;
    border-radius: 999rpx 999rpx 18rpx 18rpx;
    transform: translateX(-50%);
    box-shadow: 0 0 0 2rpx var(--app-border-color, rgba(0, 0, 0, 0.08));
}

.color-swatch--blue {
    top: 0;
    background: #7fa7ed;
}

.color-swatch--brown {
    top: 10rpx;
    background: #403126;
}

.color-swatch--lime {
    top: 20rpx;
    background: #cfe977;
}

.color-swatch--green {
    top: 30rpx;
    background: #4f7f18;
}

.color-swatch--red {
    top: 40rpx;
    background: #8b1f18;
}

.color-swatch--cream {
    top: 50rpx;
    background: #fff1a8;
}

.color-swatch--black {
    top: 60rpx;
    height: 32rpx;
    background: #050505;
    border-radius: 999rpx;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8rpx;
    box-shadow: 0 0 0 2rpx rgba(255, 255, 255, 0.18);
}

.color-dot {
    width: 6rpx;
    height: 6rpx;
    border-radius: 50%;
    background: #ffffff;
}

.side-tool-text {
    font-size: 36rpx;
    font-weight: 700;
    color: #444;
    line-height: 90rpx;
}

.side-toolbar--series-compose {
    top: 8rpx;
    width: 96rpx;
    padding: 0;
}

.side-toolbar--series-compose .side-tool-btn {
    width: 76rpx;
    height: 76rpx;
    margin-bottom: 18rpx;
}

.side-toolbar--series-compose .side-tool-icon {
    width: 76rpx;
    height: 76rpx;
}

.side-toolbar--series-compose .series-toggle-btn .side-tool-icon {
    width: 56rpx;
    height: 56rpx;
}

.side-toolbar--dark .side-tool-btn:active {
    background: rgba(255, 255, 255, 0.10);
}

.side-toolbar--dark .side-tool-icon {
    color: #f4f1ea;
    filter: brightness(0) invert(1);
    opacity: 0.92;
}

.side-toolbar--dark .color-tool-icon {
    filter: none;
    opacity: 1;
}

.side-toolbar--dark .color-swatch {
    box-shadow: 0 0 0 2rpx rgba(255, 255, 255, 0.12);
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
