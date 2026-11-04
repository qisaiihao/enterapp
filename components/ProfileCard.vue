<template>
    <view class="profile-card profile-card-center" :class="{ 'profile-card--search': searchActive }">
        <view v-if="showGrowthStats" class="profile-growth-stats">
            <view class="growth-item" v-for="(value, key) in displayGrowthStats" :key="key">
                <image class="growth-icon" :src="growthIcons[key]" mode="aspectFit" :alt="growthLabels[key]" :title="growthLabels[key]" />
                <text class="growth-count">{{ value }}</text>
            </view>
        </view>

        <view class="profile-avatar-large">
            <image
                :key="avatarSrc"
                :src="avatarSrc"
                mode="aspectFill"
                :alt="displayName + '头像'"
                :title="displayName + '头像'"
                @error="handleAvatarError"
                @tap.stop.prevent="onAvatarClick"
            />
        </view>

        <view class="profile-info-center">
            <view class="profile-details">
            <text class="profile-name-center">{{ displayName }}</text>
            <text class="profile-poemid">poemid：{{ poemIdText }}</text>
            <text class="profile-bio-center" @tap.stop="$emit('edit-profile')">{{ bioText }}</text>
            </view>
            <view class="profile-bottom-row">
                <text class="profile-followers" @tap.stop="$emit('navigate-fans')">
                    被关注数：{{ followerCountText }}
                </text>
                <view class="profile-buttons">
                    <view class="edit-profile-btn" @tap.stop="$emit('edit-profile')">
                        <text>编辑主页</text>
                    </view>
                    <view class="profile-search-control" role="button" aria-label="搜索我的笔记和收藏" @tap.stop="!searchActive && $emit('open-search')">
                        <view class="profile-search-icon" aria-hidden="true"></view>
                        <input
                            v-if="searchActive"
                            class="profile-search-input"
                            type="text"
                            :value="searchKeyword"
                            :focus="searchFocused"
                            confirm-type="search"
                            placeholder="搜索我的笔记/收藏"
                            placeholder-class="profile-search-placeholder"
                            @input="$emit('search-input', $event.detail.value)"
                            @confirm="$emit('search-confirm')"
                            @tap.stop
                        />
                    </view>
                    <text v-if="searchActive" class="profile-search-cancel" @tap.stop="$emit('close-search')">取消</text>
                    <view class="menu-btn-small" role="button" aria-label="打开侧边栏" @tap.stop="$emit('toggle-sidebar')">
                        <view class="menu-line"></view>
                        <view class="menu-line"></view>
                        <view class="menu-line"></view>
                    </view>
                </view>
            </view>
        </view>
    </view>
</template>

<script>
import { resolveUserObjectAvatar } from '@/utils/defaultAvatar.js';

export default {
    name: 'ProfileCard',
    emits: ['edit-profile', 'navigate-fans', 'toggle-sidebar', 'avatar-error', 'avatar-click', 'open-search', 'close-search', 'search-input', 'search-confirm'],
    props: {
        userInfo: {
            type: Object,
            default: () => ({})
        },
        followerCount: {
            type: [Number, String],
            default: 0
        },
        growthStats: {
            type: Object,
            default: () => ({ seed: 0, leaf: 0, flower: 0, peach: 0 })
        },
        isSelf: {
            type: Boolean,
            default: false
        },
        showGrowthStats: {
            type: Boolean,
            default: false
        },
        searchActive: {
            type: Boolean,
            default: false
        },
        searchFocused: {
            type: Boolean,
            default: false
        },
        searchKeyword: {
            type: String,
            default: ''
        }
    },
    computed: {
        avatarSrc() {
            return resolveUserObjectAvatar(this.userInfo);
        },
        displayName() {
            return this.userInfo?.nickName || '微信用户';
        },
        poemIdText() {
            return this.userInfo?.poemId || '未知';
        },
        bioText() {
            return this.userInfo?.bio || '这个用户很懒，什么都没留下…';
        },
        followerCountText() {
            return this.followerCount ?? 0;
        },
        birthdayText() {
            const birthday = this.userInfo?.birthday;
            return birthday || '未设置';
        },
        ageText() {
            const age = this.userInfo?.age;
            return age ? `${age}岁` : '未知';
        },
        displayGrowthStats() {
            return {
                seed: this.growthStats?.seed ?? 0,
                leaf: this.growthStats?.leaf ?? 0,
                flower: this.growthStats?.flower ?? 0,
                peach: this.growthStats?.peach ?? 0
            };
        },
        growthIcons() {
            return {
                seed: '/static/images/seedplus.png',
                leaf: '/static/images/leafplus.png',
                flower: '/static/images/flowerplus.png',
                peach: '/static/images/peachplus.png'
            };
        },
        growthLabels() {
            return {
                seed: '种子',
                leaf: '叶子',
                flower: '花',
                peach: '桃子'
            };
        }
    },
    methods: {
        handleAvatarError(event) {
            this.$emit('avatar-error', event);
        },
        onAvatarClick() {
            this.$emit('avatar-click', this.userInfo?.avatarUrl || '');
        }
    }
};
</script>

<style scoped>
.profile-card {
    margin: 30rpx;
    padding: 40rpx;
    background-color: #fff;
    border-radius: 16rpx;
    box-shadow: 0 4rpx 12rpx rgba(0, 0, 0, 0.05);
}

.profile-card-center {
    position: relative;
    margin: 0;
    padding: 40rpx 40rpx 20rpx 40rpx;
    background-color: transparent;
    border-radius: 0;
    box-shadow: none;
    display: flex;
    flex-direction: column;
    align-items: center;
    overflow: visible;
    transition: padding 300ms ease;
}

.profile-card--search {
    padding: 12rpx 0 0;
}

.profile-growth-stats {
    position: absolute;
    top: 120rpx;
    right: 40rpx;
    z-index: 3;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 18rpx;
    transition: opacity 180ms ease;
}

.profile-card--search .profile-growth-stats {
    opacity: 0;
    pointer-events: none;
}

.growth-item {
    display: flex;
    align-items: center;
    gap: 12rpx;
}

.growth-icon {
    width: 48rpx;
    height: 48rpx;
}

.growth-count {
    font-size: 30rpx;
    font-weight: 600;
    color: var(--profile-meta-color, #333);
}

.profile-avatar-large {
    display: flex;
    justify-content: center;
    align-items: center;
    margin: 70rpx 0 40rpx 0;
    transition: margin 300ms ease;
}

.profile-card--search .profile-avatar-large {
    margin: 8rpx 0 26rpx;
}

.profile-avatar-large image {
    width: 175rpx;
    height: 175rpx;
    border-radius: 50%;
    display: block;
    transition: width 300ms ease, height 300ms ease;
}

.profile-card--search .profile-avatar-large image {
    width: 76rpx;
    height: 76rpx;
}

.profile-info-center {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    margin-top: 20rpx;
    width: 100%;
    transition: margin 300ms ease;
}

.profile-card--search .profile-info-center {
    margin-top: 0;
}

.profile-details {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    max-height: 240rpx;
    opacity: 1;
    overflow: hidden;
    transition: max-height 260ms ease, opacity 180ms ease;
}

.profile-card--search .profile-details {
    max-height: 0;
    opacity: 0;
}

.profile-name-center {
    font-family: 'Inter', sans-serif;
    font-weight: 600;
    font-size: 30rpx;
    line-height: 36rpx;
    color: var(--profile-name-color, #000000);
    margin-bottom: 20rpx;
    text-align: left;
}

.profile-poemid {
    font-family: 'Inter', sans-serif;
    font-weight: 300;
    font-size: 20rpx;
    line-height: 24rpx;
    color: var(--profile-poemid-color, #989090);
    margin-bottom: 20rpx;
}

.profile-bio-center {
    font-family: 'Inter', sans-serif;
    font-weight: 600;
    font-size: 24rpx;
    line-height: 30rpx;
    color: var(--profile-bio-color, #000000);
    text-align: left;
    margin-bottom: 20rpx;
    cursor: pointer;
    transition: opacity 0.2s ease;
}

.profile-bio-center:active {
    opacity: 0.7;
}

.profile-bottom-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    width: 100%;
    margin-bottom: 10rpx;
    transition: padding 300ms ease, background-color 300ms ease;
}

.profile-card--search .profile-bottom-row {
    --profile-meta-color: var(--app-surface-meta-color, #888);
    --profile-name-color: var(--app-surface-text-color, #222);
    --profile-search-bg: var(--app-subtle-surface-bg, #f3f3f3);
    box-sizing: border-box;
    padding: 30rpx 40rpx 24rpx;
    margin-bottom: 0;
    background: var(--app-page-bg, #fff);
    border-radius: 26rpx 26rpx 0 0;
}

.profile-buttons {
    display: flex;
    align-items: center;
    gap: 20rpx;
    transition: width 300ms ease;
}

.profile-card--search .profile-buttons {
    width: 100%;
    gap: 0;
}

.profile-followers {
    font-family: 'Inter', sans-serif;
    font-weight: 300;
    font-size: 24rpx;
    line-height: 30rpx;
    color: var(--profile-meta-color, #989090);
    margin: 0;
    white-space: nowrap;
    overflow: hidden;
    transition: max-width 260ms ease, opacity 180ms ease;
    max-width: 260rpx;
}

.profile-card--search .profile-followers {
    max-width: 0;
    opacity: 0;
}

.edit-profile-btn {
    position: relative;
    width: 246rpx;
    height: 54rpx;
    background: var(--profile-button-bg, #4c4c4c);
    border-radius: 10rpx;
    border: var(--profile-button-border, none);
    box-shadow: var(--profile-button-shadow, none);
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    overflow: hidden;
    flex-shrink: 0;
    transition: width 300ms ease, opacity 180ms ease, background-color 0.2s ease;
}

.profile-card--search .edit-profile-btn {
    width: 0;
    opacity: 0;
    border: 0;
}

.profile-search-control {
    width: 44rpx;
    height: 54rpx;
    flex-shrink: 0;
    box-sizing: border-box;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 18rpx;
    border-radius: 32rpx;
    color: var(--profile-menu-icon-color, #202020);
    cursor: pointer;
    transition: width 300ms ease, background-color 300ms ease, padding 300ms ease;
}

.profile-card--search .profile-search-control {
    flex: 1;
    min-width: 0;
    justify-content: flex-start;
    padding: 0 22rpx;
    background: var(--profile-search-bg, #f3f3f3);
    color: var(--profile-meta-color, #888);
}

.profile-search-icon {
    width: 25rpx;
    height: 25rpx;
    border: 3rpx solid currentColor;
    border-radius: 50%;
    position: relative;
    flex-shrink: 0;
    box-sizing: border-box;
}

.profile-search-icon::after {
    content: '';
    position: absolute;
    width: 12rpx;
    height: 3rpx;
    background: currentColor;
    border-radius: 2rpx;
    right: -9rpx;
    bottom: -5rpx;
    transform: rotate(45deg);
}

.profile-search-input {
    flex: 1;
    min-width: 0;
    height: 54rpx;
    font-size: 28rpx;
    color: var(--profile-name-color, #222);
}

.profile-search-placeholder {
    color: var(--profile-meta-color, #999);
}

.profile-search-cancel {
    flex-shrink: 0;
    margin-left: 24rpx;
    font-size: 28rpx;
    color: var(--profile-meta-color, #777);
}

.edit-profile-btn:active {
    background-color: var(--profile-button-active-bg, #000000);
}

.edit-profile-btn text {
    font-family: 'Inter', sans-serif;
    font-weight: 800;
    font-size: 28rpx;
    line-height: 34rpx;
    color: var(--profile-button-text-color, #ffffff);
}

.menu-btn-small {
    width: 40rpx;
    height: 40rpx;
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 5rpx;
    color: var(--profile-menu-icon-color, #202020);
    cursor: pointer;
    transition: color 0.2s ease;
    opacity: var(--profile-menu-icon-opacity, 1);
    overflow: hidden;
    transition: width 300ms ease, opacity 180ms ease;
}

.profile-card--search .menu-btn-small {
    width: 0;
    opacity: 0;
    pointer-events: none;
}

.menu-line {
    width: 30rpx;
    height: 3rpx;
    flex-shrink: 0;
    border-radius: 1rpx;
    background-color: currentColor;
}

.menu-btn-small:active {
    color: var(--profile-menu-icon-active-color, #000000);
    opacity: 1;
}

.profile-detail-card {
    margin: 0 30rpx 30rpx 30rpx;
    padding: 30rpx 40rpx;
    background-color: #fff;
    border-radius: 16rpx;
    box-shadow: 0 4rpx 12rpx rgba(0, 0, 0, 0.05);
    display: flex;
    flex-direction: row;
    align-items: center;
    justify-content: center;
    gap: 40rpx;
}

.detail-item-inline {
    font-size: 28rpx;
    color: #666;
    margin-right: 20rpx;
    white-space: nowrap;
}
</style>
