<template>
    <view class="recovery-container">
        <view class="recovery-header">
            <text class="recovery-title">找回密码</text>
        </view>

        <view class="search-section">
            <input 
                class="search-input" 
                v-model="searchQuery" 
                placeholder="输入昵称或poemid"
                @confirm="searchUser"
            />
            <button class="search-btn" @tap="searchUser">搜索</button>
        </view>

        <view v-if="userResult" class="result-section">
            <view class="result-card">
                <view class="result-row">
                    <text class="result-label">昵称：</text>
                    <text class="result-value">{{ userResult.nickName }}</text>
                </view>
                <view class="result-row">
                    <text class="result-label">poemid：</text>
                    <text class="result-value">{{ userResult.poemId }}</text>
                </view>
                <view class="result-row">
                    <text class="result-label">密码：</text>
                    <text class="result-value password">{{ userResult.password || '未设置' }}</text>
                </view>
                <button class="copy-btn" @tap="copyPassword">复制密码</button>
            </view>
        </view>

        <view v-else-if="searched && !userResult" class="empty-result">
            <text>未找到该用户</text>
        </view>
    </view>
</template>

<script>
const { cloudCall } = require('../../utils/cloudCall.js');

export default {
    data() {
        return {
            searchQuery: '',
            userResult: null,
            searched: false
        };
    },
    methods: {
        searchUser() {
            if (!this.searchQuery.trim()) {
                uni.showToast({
                    title: '请输入昵称或poemid',
                    icon: 'none'
                });
                return;
            }

            uni.showLoading({ title: '搜索中...' });

            cloudCall('adminManager', {
                action: 'getUserPassword',
                query: this.searchQuery.trim()
            }).then(res => {
                uni.hideLoading();
                this.searched = true;
                
                if (res.result && res.result.success) {
                    this.userResult = res.result.user;
                } else {
                    this.userResult = null;
                    uni.showToast({
                        title: res.result?.error || '未找到用户',
                        icon: 'none'
                    });
                }
            }).catch(err => {
                uni.hideLoading();
                this.searched = true;
                this.userResult = null;
                console.error('搜索用户失败:', err);
                uni.showToast({
                    title: '网络错误',
                    icon: 'none'
                });
            });
        },

        copyPassword() {
            if (!this.userResult || !this.userResult.password) {
                uni.showToast({
                    title: '该用户未设置密码',
                    icon: 'none'
                });
                return;
            }

            uni.setClipboardData({
                data: this.userResult.password,
                success: () => {
                    uni.showToast({
                        title: '密码已复制',
                        icon: 'success'
                    });
                }
            });
        }
    }
};
</script>

<style scoped>
.recovery-container {
    min-height: 100vh;
    background-color: #f5f5f5;
    padding: 20rpx;
}

.recovery-header {
    background: white;
    padding: 30rpx;
    margin-bottom: 20rpx;
    border-radius: 10rpx;
}

.recovery-title {
    font-size: 36rpx;
    font-weight: bold;
    color: #333;
}

.search-section {
    background: white;
    padding: 30rpx;
    border-radius: 10rpx;
    display: flex;
    gap: 20rpx;
    margin-bottom: 20rpx;
}

.search-input {
    flex: 1;
    height: 70rpx;
    padding: 0 20rpx;
    background-color: #f5f5f5;
    border-radius: 10rpx;
    font-size: 28rpx;
}

.search-btn {
    width: 150rpx;
    height: 70rpx;
    line-height: 70rpx;
    background-color: #409eff;
    color: white;
    border: none;
    border-radius: 10rpx;
    font-size: 28rpx;
}

.result-section {
    background: white;
    padding: 30rpx;
    border-radius: 10rpx;
}

.result-card {
    display: flex;
    flex-direction: column;
    gap: 30rpx;
}

.result-row {
    display: flex;
    align-items: center;
    padding: 20rpx 0;
    border-bottom: 1px solid #f0f0f0;
}

.result-label {
    font-size: 28rpx;
    color: #666;
    width: 150rpx;
}

.result-value {
    font-size: 28rpx;
    color: #333;
    flex: 1;
}

.result-value.password {
    font-family: monospace;
    font-weight: bold;
}

.copy-btn {
    width: 100%;
    height: 80rpx;
    line-height: 80rpx;
    background-color: #67c23a;
    color: white;
    border: none;
    border-radius: 10rpx;
    font-size: 28rpx;
}

.empty-result {
    background: white;
    padding: 60rpx;
    border-radius: 10rpx;
    text-align: center;
    color: #999;
}
</style>
