<template>
  <view class="portfolio-page">
    <!-- 顶部导航栏 -->
    <view class="header">
      <view class="header-left" @tap="goBack">
        <text class="back-icon">←</text>
      </view>
      <text class="header-title">作品集</text>
      <view class="header-right">
        <text class="create-btn" @tap="openCreateModal">+ 新建</text>
      </view>
    </view>

    <!-- 作品集列表 -->
    <scroll-view class="portfolio-list" scroll-y="true" @scrolltolower="loadMore">
      <view v-if="loading" class="loading">
        <text>加载中...</text>
      </view>

      <view v-else-if="folders.length === 0" class="empty-state">
        <text class="empty-icon">📁</text>
        <text class="empty-text">暂无作品集</text>
        <text class="empty-subtext">创建您的第一个作品集吧</text>
      </view>

      <view v-else class="folder-grid">
        <view
          v-for="folder in folders"
          :key="folder._id"
          class="folder-item"
          @tap="openFolder(folder)"
        >
          <view class="folder-cover">
            <image
              v-if="folder.coverUrl"
              :src="folder.coverUrl"
              mode="aspectFill"
              class="cover-image"
            ></image>
            <view v-else class="default-cover">
              <text class="folder-icon">📚</text>
            </view>
          </view>
          <view class="folder-info">
            <text class="folder-name">{{ folder.name }}</text>
            <text class="folder-count">{{ folder.itemCount }} 个作品</text>
          </view>
          <view class="folder-actions">
            <text class="action-btn delete" @tap.stop="deleteFolder(folder)">删除</text>
          </view>
        </view>
      </view>

      <view v-if="hasMore && !loading" class="load-more">
        <text>加载更多...</text>
      </view>
    </scroll-view>

    <!-- 创建作品集弹窗 -->
    <view v-if="showCreateModal" class="modal-overlay" @tap="hideCreateModal">
      <view class="modal-content" @tap.stop>
        <view class="modal-header">
          <text class="modal-title">新建作品集</text>
          <text class="close-btn" @tap="hideCreateModal">×</text>
        </view>
        <view class="modal-body">
          <input
            class="folder-name-input"
            v-model="newFolderName"
            placeholder="请输入作品集名称"
            maxlength="20"
          />
        </view>
        <view class="modal-footer">
          <button class="modal-btn cancel" @tap="hideCreateModal">取消</button>
          <button class="modal-btn confirm" @tap="createFolder" :disabled="!newFolderName.trim()">创建</button>
        </view>
      </view>
    </view>
  </view>
</template>

<script>
const { cloudCall } = require('../../utils/cloudCall.js');

export default {
  data() {
    return {
      folders: [],
      loading: false,
      hasMore: false,
      showCreateModal: false,
      newFolderName: ''
    };
  },

  onLoad() {
    this.loadFolders();
  },

  methods: {
    // 统一云函数调用方法
    callCloudFunction(name, data = {}, extraOptions = {}) {
      return cloudCall(name, data, Object.assign({ pageTag: 'portfolio', context: this, requireAuth: true }, extraOptions));
    },

    goBack() {
      uni.navigateBack();
    },

    async loadFolders() {
      if (this.loading) return;

      this.loading = true;
      try {
        const res = await this.callCloudFunction('getPortfolioFolders', {});
        if (res.result && res.result.success) {
          this.folders = res.result.folders || [];
        } else {
          uni.showToast({
            title: '获取作品集失败',
            icon: 'none'
          });
        }
      } catch (error) {
        console.error('加载作品集失败:', error);
        uni.showToast({
          title: '加载失败',
          icon: 'none'
        });
      } finally {
        this.loading = false;
      }
    },

    loadMore() {
      // 暂时不实现分页，因为作品集通常不会很多
    },

    openCreateModal() {
      this.setData({
        showCreateModal: true,
        newFolderName: ''
      });
    },

    hideCreateModal() {
      this.setData({
        showCreateModal: false,
        newFolderName: ''
      });
    },

    async createFolder() {
      if (!this.newFolderName.trim()) {
        uni.showToast({
          title: '请输入作品集名称',
          icon: 'none'
        });
        return;
      }

      try {
        uni.showLoading({ title: '创建中...' });
        const res = await this.callCloudFunction('createPortfolioFolder', {
          folderName: this.newFolderName.trim()
        });

        if (res.result && res.result.success) {
          uni.showToast({
            title: '创建成功',
            icon: 'success'
          });
          this.hideCreateModal();
          this.loadFolders();
        } else {
          uni.showToast({
            title: res.result?.message || '创建失败',
            icon: 'none'
          });
        }
      } catch (error) {
        console.error('创建作品集失败:', error);
        uni.showToast({
          title: '创建失败',
          icon: 'none'
        });
      } finally {
        uni.hideLoading();
      }
    },

    openFolder(folder) {
      uni.navigateTo({
        url: `/pages/portfolio-detail/portfolio-detail?folderId=${folder._id}&folderName=${encodeURIComponent(folder.name)}`
      });
    },


    async deleteFolder(folder) {
      if (folder.isDefault) {
        uni.showToast({
          title: '默认作品集不能删除',
          icon: 'none'
        });
        return;
      }

      uni.showModal({
        title: '确认删除',
        content: `确定要删除作品集"${folder.name}"吗？里面的作品不会被删除。`,
        success: async (res) => {
          if (res.confirm) {
            try {
              uni.showLoading({ title: '删除中...' });
              // TODO: 实现删除作品集的云函数
              uni.showToast({
                title: '删除功能开发中',
                icon: 'none'
              });
            } catch (error) {
              console.error('删除作品集失败:', error);
              uni.showToast({
                title: '删除失败',
                icon: 'none'
              });
            } finally {
              uni.hideLoading();
            }
          }
        }
      });
    }
  }
};
</script>

<style>
.portfolio-page {
  height: 100vh;
  background: #f8f9fa;
  display: flex;
  flex-direction: column;
}

.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20rpx 30rpx;
  background: #fff;
  border-bottom: 1rpx solid #e9ecef;
}

.header-left {
  width: 60rpx;
  height: 60rpx;
  display: flex;
  align-items: center;
  justify-content: center;
}

.back-icon {
  font-size: 36rpx;
  color: #333;
  font-weight: bold;
}

.header-title {
  font-size: 36rpx;
  font-weight: 600;
  color: #333;
}

.header-right {
  width: 100rpx;
  display: flex;
  justify-content: flex-end;
}

.create-btn {
  font-size: 28rpx;
  color: #9ed7ee;
  font-weight: 500;
}

.portfolio-list {
  flex: 1;
  padding: 30rpx;
}

.loading {
  text-align: center;
  padding: 60rpx 0;
  color: #666;
  font-size: 28rpx;
}

.empty-state {
  text-align: center;
  padding: 120rpx 0;
}

.empty-icon {
  font-size: 120rpx;
  margin-bottom: 30rpx;
  display: block;
}

.empty-text {
  font-size: 32rpx;
  color: #333;
  margin-bottom: 20rpx;
  display: block;
}

.empty-subtext {
  font-size: 28rpx;
  color: #666;
  display: block;
}

.folder-grid {
  display: flex;
  flex-direction: column;
  gap: 30rpx;
}

.folder-item {
  background: #fff;
  border-radius: 20rpx;
  padding: 30rpx;
  box-shadow: 0 4rpx 20rpx rgba(0, 0, 0, 0.08);
  display: flex;
  align-items: center;
  gap: 30rpx;
}

.folder-cover {
  width: 120rpx;
  height: 120rpx;
  border-radius: 16rpx;
  overflow: hidden;
  flex-shrink: 0;
}

.cover-image {
  width: 100%;
  height: 100%;
}

.default-cover {
  width: 100%;
  height: 100%;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  display: flex;
  align-items: center;
  justify-content: center;
}

.folder-icon {
  font-size: 60rpx;
  color: #fff;
}

.folder-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 10rpx;
}

.folder-name {
  font-size: 32rpx;
  font-weight: 600;
  color: #333;
}

.folder-count {
  font-size: 26rpx;
  color: #666;
}

.folder-actions {
  display: flex;
  gap: 20rpx;
}

.action-btn {
  font-size: 26rpx;
  color: #9ed7ee;
  padding: 10rpx 20rpx;
  border-radius: 12rpx;
  background: rgba(158, 215, 238, 0.1);
}

.action-btn.delete {
  color: #ff6b6b;
  background: rgba(255, 107, 107, 0.1);
}

.load-more {
  text-align: center;
  padding: 40rpx 0;
  color: #666;
  font-size: 28rpx;
}

/* 弹窗样式 */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  background: #fff;
  border-radius: 20rpx;
  width: 600rpx;
  padding: 0;
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 40rpx 40rpx 30rpx;
  border-bottom: 1rpx solid #f0f0f0;
}

.modal-title {
  font-size: 32rpx;
  font-weight: 600;
  color: #333;
}

.close-btn {
  font-size: 40rpx;
  color: #999;
  width: 60rpx;
  height: 60rpx;
  display: flex;
  align-items: center;
  justify-content: center;
}

.modal-body {
  padding: 40rpx;
}

.folder-name-input {
  width: 100%;
  height: 80rpx;
  border: 2rpx solid #e9ecef;
  border-radius: 12rpx;
  padding: 0 20rpx;
  font-size: 28rpx;
  color: #333;
  box-sizing: border-box;
}

.folder-name-input:focus {
  border-color: #9ed7ee;
}

.modal-footer {
  display: flex;
  gap: 20rpx;
  padding: 30rpx 40rpx 40rpx;
}

.modal-btn {
  flex: 1;
  height: 80rpx;
  border-radius: 12rpx;
  font-size: 28rpx;
  font-weight: 500;
  border: none;
}

.modal-btn.cancel {
  background: #f8f9fa;
  color: #666;
}

.modal-btn.confirm {
  background: #9ed7ee;
  color: #fff;
}

.modal-btn.confirm[disabled] {
  background: #ccc;
  color: #999;
}
</style>