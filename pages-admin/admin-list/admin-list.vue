<template>
    <view class="admin-list-container">
        <view class="admin-header">
            <text class="admin-title">管理员管理</text>
        </view>

        <!-- 添加管理员 -->
        <view class="add-section">
            <text class="section-title">添加管理员</text>
            <view class="add-row">
                <input
                    class="add-input"
                    v-model="newAdminPoemId"
                    placeholder="输入用户的 poemId"
                    placeholder-class="add-input-placeholder"
                    confirm-type="done"
                    @confirm="handleAdd"
                />
                <button class="add-btn" @tap="handleAdd" :disabled="adding">添加</button>
            </view>
            <text class="add-tip">添加后，该用户在下次刷新时会获得管理权限（最长 30 分钟内生效）</text>
        </view>

        <!-- 管理员列表 -->
        <view class="list-section">
            <text class="section-title">当前管理员（{{ adminList.length }}）</text>

            <view class="admin-list" v-if="adminList.length > 0">
                <view class="admin-item" v-for="item in adminList" :key="item.poemId">
                    <image
                        v-if="item.avatarUrl"
                        class="admin-avatar"
                        :src="item.avatarUrl"
                        mode="aspectFill"
                    />
                    <view v-else class="admin-avatar admin-avatar-placeholder">
                        <text class="admin-avatar-text">{{ getAvatarText(item) }}</text>
                    </view>
                    <view class="admin-info">
                        <view class="admin-name-row">
                            <text class="admin-name">{{ item.nickName || item.poemId }}</text>
                            <text v-if="item.poemId === currentPoemId" class="self-badge">我</text>
                        </view>
                        <text class="admin-poem-id">{{ item.poemId }}</text>
                    </view>
                    <button
                        class="remove-btn"
                        @tap="handleRemove"
                        :data-poem-id="item.poemId"
                        :data-name="item.nickName || item.poemId"
                    >
                        移除
                    </button>
                </view>
            </view>

            <view v-else-if="loading" class="loading-tip">
                <text>加载中...</text>
            </view>

            <view v-else class="empty-tip">
                <text>暂无管理员</text>
            </view>
        </view>
    </view>
</template>

<script>
import { getAdminConfig, updateAdminConfig } from '../../api-cache/admin-manager.js';
import { getCurrentUserInfo } from '../../utils/admin.js';

export default {
    data() {
        return {
            adminList: [],
            loading: false,
            adding: false,
            newAdminPoemId: '',
            currentPoemId: ''
        };
    },
    onLoad() {
        const userInfo = getCurrentUserInfo();
        this.currentPoemId = (userInfo && userInfo.poemId) || '';
        this.loadAdminList();
    },
    onPullDownRefresh() {
        this.loadAdminList(() => {
            uni.stopPullDownRefresh();
        });
    },
    methods: {
        async loadAdminList(callback) {
            if (this.loading) return;

            this.loading = true;
            try {
                const result = await getAdminConfig({ context: this });
                this.adminList = result.admins || [];
            } catch (err) {
                console.error('加载管理员列表失败:', err);
                uni.showToast({
                    title: err.message || '加载失败',
                    icon: 'none'
                });
            } finally {
                this.loading = false;
                if (callback) callback();
            }
        },

        getAvatarText(item) {
            const name = item.nickName || item.poemId || '?';
            return name.slice(0, 1);
        },

        async handleAdd() {
            const poemId = (this.newAdminPoemId || '').trim();
            if (!poemId) {
                uni.showToast({
                    title: '请输入要添加的 poemId',
                    icon: 'none'
                });
                return;
            }

            if (this.adminList.some((item) => item.poemId === poemId)) {
                uni.showToast({
                    title: '该用户已经是管理员',
                    icon: 'none'
                });
                return;
            }

            this.adding = true;
            uni.showLoading({ title: '添加中...' });
            try {
                const adminPoemIds = [...this.adminList.map((item) => item.poemId), poemId];
                await updateAdminConfig({ adminPoemIds, context: this });
                uni.showToast({
                    title: '添加成功',
                    icon: 'success'
                });
                this.newAdminPoemId = '';
                await this.loadAdminList();
            } catch (err) {
                console.error('添加管理员失败:', err);
                uni.showToast({
                    title: err.message || '添加失败',
                    icon: 'none'
                });
            } finally {
                uni.hideLoading();
                this.adding = false;
            }
        },

        handleRemove(e) {
            const poemId = e.currentTarget.dataset.poemId;
            const name = e.currentTarget.dataset.name;
            const isSelf = poemId === this.currentPoemId;

            uni.showModal({
                title: '确认移除',
                content: isSelf
                    ? `确定要移除「${name}」的管理员权限吗？移除后你将失去管理权限。`
                    : `确定要移除「${name}」的管理员权限吗？`,
                confirmText: '移除',
                cancelText: '取消',
                confirmColor: '#f56c6c',
                success: (res) => {
                    if (res.confirm) {
                        this.removeAdmin(poemId);
                    }
                }
            });
        },

        async removeAdmin(poemId) {
            uni.showLoading({ title: '移除中...' });
            try {
                const adminPoemIds = this.adminList
                    .map((item) => item.poemId)
                    .filter((id) => id !== poemId);
                await updateAdminConfig({ adminPoemIds, context: this });
                uni.showToast({
                    title: '移除成功',
                    icon: 'success'
                });
                await this.loadAdminList();
            } catch (err) {
                console.error('移除管理员失败:', err);
                uni.showToast({
                    title: err.message || '移除失败',
                    icon: 'none'
                });
            } finally {
                uni.hideLoading();
            }
        }
    }
};
</script>

<style scoped>
.admin-list-container {
    min-height: 100vh;
    background-color: #f5f5f5;
    padding: 20rpx;
}

.admin-header {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    padding: 40rpx 30rpx;
    margin-bottom: 20rpx;
    border-radius: 10rpx;
}

.admin-title {
    font-size: 40rpx;
    font-weight: bold;
    color: white;
}

.add-section,
.list-section {
    background: white;
    border-radius: 10rpx;
    padding: 30rpx;
    margin-bottom: 20rpx;
}

.section-title {
    display: block;
    font-size: 28rpx;
    font-weight: bold;
    color: #333;
    margin-bottom: 20rpx;
}

.add-row {
    display: flex;
    align-items: center;
    gap: 20rpx;
}

.add-input {
    flex: 1;
    height: 72rpx;
    background-color: #f5f5f5;
    border-radius: 8rpx;
    padding: 0 20rpx;
    font-size: 28rpx;
    color: #333;
}

.add-input-placeholder {
    color: #bbb;
}

.add-btn {
    width: 160rpx;
    height: 72rpx;
    line-height: 72rpx;
    font-size: 28rpx;
    border-radius: 8rpx;
    border: none;
    background-color: #667eea;
    color: white;
    margin: 0;
    padding: 0;
}

.add-btn[disabled] {
    opacity: 0.6;
}

.add-tip {
    display: block;
    font-size: 22rpx;
    color: #999;
    margin-top: 16rpx;
}

.admin-list {
    display: flex;
    flex-direction: column;
    gap: 16rpx;
}

.admin-item {
    display: flex;
    align-items: center;
    gap: 20rpx;
    padding: 20rpx;
    background-color: #fafafa;
    border-radius: 10rpx;
}

.admin-avatar {
    width: 80rpx;
    height: 80rpx;
    border-radius: 50%;
    flex-shrink: 0;
}

.admin-avatar-placeholder {
    display: flex;
    align-items: center;
    justify-content: center;
    background-color: #667eea;
}

.admin-avatar-text {
    font-size: 32rpx;
    font-weight: bold;
    color: white;
}

.admin-info {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 6rpx;
    min-width: 0;
}

.admin-name-row {
    display: flex;
    align-items: center;
    gap: 12rpx;
}

.admin-name {
    font-size: 30rpx;
    font-weight: bold;
    color: #333;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.self-badge {
    font-size: 20rpx;
    color: #667eea;
    background-color: rgba(102, 126, 234, 0.12);
    padding: 2rpx 10rpx;
    border-radius: 8rpx;
}

.admin-poem-id {
    font-size: 24rpx;
    color: #999;
}

.remove-btn {
    flex-shrink: 0;
    width: 120rpx;
    height: 56rpx;
    line-height: 56rpx;
    font-size: 24rpx;
    border-radius: 8rpx;
    border: none;
    background-color: #f56c6c;
    color: white;
    margin: 0;
    padding: 0;
}

.loading-tip,
.empty-tip {
    text-align: center;
    padding: 60rpx;
    color: #999;
}
</style>