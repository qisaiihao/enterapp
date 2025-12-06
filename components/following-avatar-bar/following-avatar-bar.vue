<template>
    <view class="avatar-bar-container">
        <scroll-view 
            class="avatar-scroll" 
            scroll-x 
            :scroll-left="scrollLeft"
            :show-scrollbar="false"
            @touchstart.stop="onTouchStart"
            @touchmove.stop="onTouchMove"
            @touchend.stop="onTouchEnd"
        >
            <view class="avatar-list">
                <!-- 返回按钮 -->
                <view class="avatar-item back-item" @tap="onBackClick">
                    <view class="avatar-wrapper back-wrapper">
                        <image class="back-icon" src="/static/images/newicons/back.png" mode="aspectFit" />
                    </view>
                    <text class="avatar-name">全部</text>
                </view>

                <!-- 用户头像列表 -->
                <view 
                    v-for="user in users" 
                    :key="user._openid"
                    class="avatar-item"
                    :class="{ selected: selectedUserId === user._openid }"
                    @tap="selectUser(user._openid)"
                >
                    <view class="avatar-wrapper">
                        <image 
                            class="avatar-image" 
                            :src="user.avatarUrl || defaultAvatar"
                            mode="aspectFill"
                            lazy-load
                            @error="onAvatarError(user)"
                        />
                    </view>
                    <text 
                        class="avatar-name" 
                        :class="{ 'name-selected': selectedUserId === user._openid }"
                    >{{ formatName(user.nickName) }}</text>
                </view>
            </view>
        </scroll-view>
    </view>
</template>

<script>
import { getFollowingUsers, invalidateFollowingUsers } from '@/api-cache/following-users.js';

export default {
    name: 'FollowingAvatarBar',
    props: {
        // 当前选中的用户ID，null表示全部
        selectedUserId: {
            type: String,
            default: null
        }
    },
    data() {
        return {
            users: [],
            isLoading: false,
            scrollLeft: 0,
            defaultAvatar: '/static/images/avatar.png'
        };
    },
    mounted() {
        this.loadUsers();
    },
    methods: {
        // 加载关注用户列表
        async loadUsers(forceRefresh = false) {
            if (this.isLoading) return;
            
            this.isLoading = true;
            try {
                const users = await getFollowingUsers({
                    limit: 50,
                    context: this,
                    forceRefresh,
                    onBackgroundUpdate: (newUsers) => {
                        if (Array.isArray(newUsers) && newUsers.length > 0) {
                            this.users = newUsers;
                        }
                    }
                });
                this.users = users || [];
            } catch (error) {
                console.error('加载关注用户列表失败:', error);
            } finally {
                this.isLoading = false;
            }
        },

        // 刷新用户列表
        refresh() {
            invalidateFollowingUsers();
            this.loadUsers(true);
        },

        // 返回按钮点击（退出关注模式）
        onBackClick() {
            this.$emit('back');
        },

        // 选择用户（点击已选中的头像取消筛选）
        selectUser(userId) {
            if (this.selectedUserId === userId) {
                // 点击已选中的头像，取消筛选
                this.$emit('select-user', null);
            } else {
                this.$emit('select-user', userId);
            }
        },

        // 格式化用户名（截断过长的名字）
        formatName(name) {
            if (!name) return '用户';
            return name.length > 4 ? name.slice(0, 4) + '…' : name;
        },

        // 头像加载失败
        onAvatarError(user) {
            user.avatarUrl = this.defaultAvatar;
        },

        // 触摸事件（阻止冒泡到父级swiper）
        onTouchStart() {},
        onTouchMove() {},
        onTouchEnd() {}
    }
};
</script>

<style scoped>
.avatar-bar-container {
    background-color: #fff;
    padding: 20rpx 0 28rpx 0;
    margin-bottom: 24rpx;
    border-bottom: 1rpx solid #f0f0f0;
}

.avatar-scroll {
    width: 100%;
    white-space: nowrap;
}

/* 隐藏滚动条 */
.avatar-scroll ::-webkit-scrollbar {
    display: none;
    width: 0;
    height: 0;
}

.avatar-scroll {
    scrollbar-width: none;
    -ms-overflow-style: none;
}

.avatar-list {
    display: inline-flex;
    padding: 0 20rpx 0 32rpx;
    gap: 36rpx;
}

.avatar-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    width: 100rpx;
    flex-shrink: 0;
}

.avatar-wrapper {
    width: 88rpx;
    height: 88rpx;
    border-radius: 50%;
    overflow: hidden;
    background-color: #f5f5f5;
    display: flex;
    align-items: center;
    justify-content: center;
}

.back-wrapper {
    background-color: transparent;
}

.back-icon {
    width: 48rpx;
    height: 48rpx;
    opacity: 0.7;
}

.all-option {
    background-color: #f0f0f0;
    border: 2rpx solid #e0e0e0;
}

.all-icon {
    font-size: 24rpx;
    color: #666;
    font-weight: 500;
}

.avatar-image {
    width: 100%;
    height: 100%;
}

.avatar-name {
    margin-top: 16rpx;
    font-size: 22rpx;
    color: #999;
    text-align: center;
    width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    transition: color 0.2s ease;
}

.name-selected {
    color: #333;
    font-weight: 500;
}
</style>
