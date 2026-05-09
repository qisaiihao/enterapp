<template>
    <view class="profile-card profile-card-center">
        <view v-if="showGrowthStats" class="profile-growth-stats">
            <view class="growth-item" v-for="(value, key) in displayGrowthStats" :key="key">
                <image class="growth-icon" :src="growthIcons[key]" mode="aspectFit" />
                <text class="growth-count">{{ value }}</text>
            </view>
        </view>

        <view class="profile-avatar-large">
            <image :src="avatarSrc" mode="aspectFill" @error="handleAvatarError" @tap.stop.prevent="onAvatarClick" />
        </view>

        <view class="profile-info-center">
            <text class="profile-name-center">{{ displayName }}</text>
            <text class="profile-poemid">poemid：{{ poemIdText }}</text>
            <text class="profile-bio-center" @tap.stop="$emit('edit-profile')">{{ bioText }}</text>
            <view class="profile-bottom-row">
                <text class="profile-followers" @tap.stop="$emit('navigate-fans')">
                    被关注数：{{ followerCountText }}
                </text>
                <view class="profile-buttons">
                    <view class="edit-profile-btn" @tap.stop="$emit('edit-profile')">
                        <text>编辑主页</text>
                    </view>
                    <image
                        src="/static/images/icons/menu-icon.svg"
                        class="menu-btn-small"
                        @tap.stop="$emit('toggle-sidebar')"
                    />
                </view>
            </view>
        </view>
    </view>
</template>

<script>
import { resolveUserObjectAvatar } from '@/utils/defaultAvatar.js';

export default {
    name: 'ProfileCard',
    emits: ['edit-profile', 'navigate-fans', 'toggle-sidebar', 'avatar-error', 'avatar-click'],
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
}

.profile-growth-stats {
    position: absolute;
    top: 120rpx;
    right: 40rpx;
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 18rpx;
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
}

.profile-avatar-large image {
    width: 175rpx;
    height: 175rpx;
    border-radius: 50%;
    display: block;
}

.profile-info-center {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    margin-top: 20rpx;
    width: 100%;
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
}

.profile-buttons {
    display: flex;
    align-items: center;
    gap: 20rpx;
}

.profile-followers {
    font-family: 'Inter', sans-serif;
    font-weight: 300;
    font-size: 24rpx;
    line-height: 30rpx;
    color: var(--profile-meta-color, #989090);
    margin: 0;
}

.edit-profile-btn {
    position: relative;
    width: 246rpx;
    height: 54rpx;
    background: var(--profile-button-bg, #d9d9d9);
    border-radius: 10rpx;
    border: var(--profile-button-border, none);
    box-shadow: var(--profile-button-shadow, none);
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: background-color 0.2s ease;
}

.edit-profile-btn:active {
    background-color: var(--profile-button-active-bg, #c0c0c0);
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
    cursor: pointer;
    transition: transform 0.2s ease;
    filter: var(--profile-menu-icon-filter, grayscale(1) brightness(0.5));
    opacity: var(--profile-menu-icon-opacity, 0.7);
}

.menu-btn-small:active {
    transform: scale(0.9);
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
