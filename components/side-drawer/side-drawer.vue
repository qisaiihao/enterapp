<template>
    <!-- components/side-drawer/side-drawer.wxml -->
    <view :class="'drawer-mask ' + (showClone ? 'show' : '')" @tap="closeDrawer" @touchmove.stop.prevent="doNothing">
        <view :class="'drawer-content ' + (showClone ? 'show' : '')" @tap.stop.prevent="doNothing">
            <!-- 抽屉内容插槽 -->
            <slot></slot>
        </view>
    </view>
</template>

<script>
// components/side-drawer/side-drawer.js
export default {
    data() {
        return {
            showClone: false
        };
    },
    props: {
        // 控制抽屉显示与隐藏
        show: {
            type: Boolean,
            default: false
        }
    },
    methods: {
        // 关闭抽屉
        closeDrawer() {
            this.setData({
                showClone: false
            });
        },
        // 防止触摸穿透
        doNothing() {
            return;
        }
    },
    created: function () {},
    watch: {
        show: {
            handler: function (newVal, oldVal) {
                this.showClone = newVal;
            },

            immediate: true
        }
    }
};
</script>
<style>
/* components/side-drawer/side-drawer.wxss */
.drawer-mask {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background-color: rgba(0, 0, 0, 0.4);
    opacity: 0;
    visibility: hidden;
    transition: opacity 0.3s ease;
    z-index: 999;
}

.drawer-mask.show {
    opacity: 1;
    visibility: visible;
}

.drawer-content {
    position: fixed;
    top: 0;
    left: 0;
    width: 70%;
    height: 100%;
    background-color: #ffffff;
    transform: translateX(-100%);
    transition: transform 0.3s ease;
    z-index: 1000;
    box-shadow: 2px 0 8px rgba(0, 0, 0, 0.15);
}

.drawer-content.show {
    transform: translateX(0);
}
</style>
