<template>
  <view class="portfolio-detail-page">
    <!-- 顶部导航栏 -->
    <view class="header">
      <view class="header-left" @tap="goBack">
        <text class="back-icon">←</text>
      </view>
      <text class="header-title">{{ folderName }}</text>
      <view class="header-right">
        <text class="add-btn" @tap="showAddModal">+ 添加</text>
      </view>
    </view>

    <!-- 作品列表 -->
    <scroll-view class="content-list" scroll-y="true" @scrolltolower="loadMore">
      <view v-if="loading" class="loading">
        <text>加载中...</text>
      </view>

      <view v-else-if="portfolioItems.length === 0" class="empty-state">
        <text class="empty-icon">📝</text>
        <text class="empty-text">暂无作品</text>
        <text class="empty-subtext">点击右上角添加您的作品</text>
      </view>

      <view v-else class="items-grid">
        <view
          v-for="item in portfolioItems"
          :key="item._id"
          class="item-card"
          @tap="viewPost(item)"
        >
          <view class="item-cover">
            <image
              v-if="item.imageUrls && item.imageUrls.length > 0"
              :src="item.imageUrls[0]"
              mode="aspectFill"
              class="cover-image"
            ></image>
            <view v-else class="default-cover">
              <text class="content-preview">{{ item.content || item.title }}</text>
            </view>
          </view>
          <view class="item-info">
            <text class="item-title">{{ item.title || '无标题' }}</text>
            <text class="item-content">{{ item.content || '无内容' }}</text>
            <view class="item-meta">
              <text class="item-date">{{ formatDate(item.createTime) }}</text>
              <text class="item-actions">
                <text class="remove-btn" @tap.stop="removeItem(item)">移除</text>
              </text>
            </view>
          </view>
        </view>
      </view>

      <view v-if="hasMore && !loading" class="load-more">
        <text>加载更多...</text>
      </view>
    </scroll-view>

    <!-- 添加作品弹窗 -->
    <view v-if="showAddModal" class="modal-overlay" @tap="hideAddModal">
      <view class="modal-content add-modal" @tap.stop>
        <view class="modal-header">
          <text class="modal-title">添加作品</text>
          <text class="close-btn" @tap="hideAddModal">×</text>
        </view>
        <view class="modal-body">
          <text class="tip-text">从您的帖子中选择要添加到作品集的内容</text>
          <view class="my-posts-section">
            <text class="section-title">我的帖子</text>
            <scroll-view class="posts-list" scroll-y="true">
              <view v-if="myPostsLoading" class="loading-small">
                <text>加载中...</text>
              </view>
              <view v-else-if="myPosts.length === 0" class="empty-small">
                <text>暂无帖子</text>
              </view>
              <view v-else class="posts-grid">
                <view
                  v-for="post in myPosts"
                  :key="post._id"
                  class="post-item"
                  :class="{ selected: selectedPostId === post._id }"
                  @tap="selectPost(post)"
                >
                  <view class="post-cover">
                    <image
                      v-if="post.imageUrls && post.imageUrls.length > 0"
                      :src="post.imageUrls[0]"
                      mode="aspectFill"
                      class="post-image"
                    ></image>
                    <view v-else class="post-default">
                      <text class="post-text">{{ post.content || post.title }}</text>
                    </view>
                  </view>
                  <text class="post-title">{{ post.title || '无标题' }}</text>
                  <view v-if="selectedPostId === post._id" class="selected-check">
                    <text>✓</text>
                  </view>
                </view>
              </view>
            </scroll-view>
          </view>
        </view>
        <view class="modal-footer">
          <button class="modal-btn cancel" @tap="hideAddModal">取消</button>
          <button class="modal-btn confirm" @tap="addToPortfolio" :disabled="!selectedPostId">添加</button>
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
      folderId: '',
      folderName: '',
      portfolioItems: [],
      loading: false,
      hasMore: false,
      showAddModal: false,
      myPosts: [],
      myPostsLoading: false,
      selectedPostId: '',
      skip: 0,
      limit: 10
    };
  },

  onLoad(options) {
    this.folderId = options.folderId || '';
    this.folderName = decodeURIComponent(options.folderName || '作品集');
    this.loadPortfolioItems();
    this.loadMyPosts();
  },

  methods: {
    // 统一云函数调用方法
    callCloudFunction(name, data = {}, extraOptions = {}) {
      return cloudCall(name, data, Object.assign({ pageTag: 'portfolio-detail', context: this, requireAuth: true }, extraOptions));
    },

    goBack() {
      uni.navigateBack();
    },

    async loadPortfolioItems() {
      if (this.loading) return;

      this.loading = true;
      try {
        const res = await this.callCloudFunction('getPortfolioItems', {
          folderId: this.folderId,
          skip: this.skip,
          limit: this.limit
        });

        if (res.result && res.result.success) {
          if (this.skip === 0) {
            this.portfolioItems = res.result.portfolioItems || [];
          } else {
            this.portfolioItems = [...this.portfolioItems, ...(res.result.portfolioItems || [])];
          }
          this.hasMore = (res.result.portfolioItems || []).length >= this.limit;
        } else {
          uni.showToast({
            title: '获取作品失败',
            icon: 'none'
          });
        }
      } catch (error) {
        console.error('加载作品集内容失败:', error);
        uni.showToast({
          title: '加载失败',
          icon: 'none'
        });
      } finally {
        this.loading = false;
      }
    },

    loadMore() {
      if (!this.hasMore || this.loading) return;
      this.skip += this.limit;
      this.loadPortfolioItems();
    },

    async loadMyPosts() {
      this.myPostsLoading = true;
      try {
        const res = await this.callCloudFunction('getMyProfileData', {
          skip: 0,
          limit: 50 // 获取更多帖子供选择
        });

        if (res.result && res.result.success && res.result.posts) {
          // 过滤掉已经在作品集中的帖子
          const existingPostIds = this.portfolioItems.map(item => item.postId);
          this.myPosts = res.result.posts.filter(post => !existingPostIds.includes(post._id));
        }
      } catch (error) {
        console.error('加载我的帖子失败:', error);
      } finally {
        this.myPostsLoading = false;
      }
    },

    showAddModal() {
      this.showAddModal = true;
      this.selectedPostId = '';
      this.loadMyPosts();
    },

    hideAddModal() {
      this.showAddModal = false;
      this.selectedPostId = '';
    },

    selectPost(post) {
      this.selectedPostId = this.selectedPostId === post._id ? '' : post._id;
    },

    async addToPortfolio() {
      if (!this.selectedPostId) {
        uni.showToast({
          title: '请选择要添加的帖子',
          icon: 'none'
        });
        return;
      }

      try {
        uni.showLoading({ title: '添加中...' });
        const res = await this.callCloudFunction('addToPortfolio', {
          postId: this.selectedPostId,
          folderId: this.folderId
        });

        if (res.result && res.result.success) {
          uni.showToast({
            title: '添加成功',
            icon: 'success'
          });
          this.hideAddModal();
          this.skip = 0;
          this.loadPortfolioItems();
        } else {
          uni.showToast({
            title: res.result?.message || '添加失败',
            icon: 'none'
          });
        }
      } catch (error) {
        console.error('添加到作品集失败:', error);
        uni.showToast({
          title: '添加失败',
          icon: 'none'
        });
      } finally {
        uni.hideLoading();
      }
    },

    async removeItem(item) {
      uni.showModal({
        title: '确认移除',
        content: '确定要从作品集中移除这个作品吗？',
        success: async (res) => {
          if (res.confirm) {
            try {
              uni.showLoading({ title: '移除中...' });
              const removeRes = await this.callCloudFunction('removeFromPortfolio', {
                portfolioId: item.portfolioId
              });

              if (removeRes.result && removeRes.result.success) {
                uni.showToast({
                  title: '移除成功',
                  icon: 'success'
                });
                this.skip = 0;
                this.loadPortfolioItems();
              } else {
                uni.showToast({
                  title: '移除失败',
                  icon: 'none'
                });
              }
            } catch (error) {
              console.error('移除作品失败:', error);
              uni.showToast({
                title: '移除失败',
                icon: 'none'
              });
            } finally {
              uni.hideLoading();
            }
          }
        }
      });
    },

    viewPost(item) {
      uni.navigateTo({
        url: `/pages/post-detail/post-detail?id=${item.postId}`
      });
    },

    formatDate(dateString) {
      if (!dateString) return '';
      const date = new Date(dateString);
      const now = new Date();
      const diff = now - date;

      if (diff < 60000) {
        return '刚刚';
      } else if (diff < 3600000) {
        return Math.floor(diff / 60000) + '分钟前';
      } else if (diff < 86400000) {
        return Math.floor(diff / 3600000) + '小时前';
      } else if (diff < 604800000) {
        return Math.floor(diff / 86400000) + '天前';
      } else {
        return date.toLocaleDateString();
      }
    }
  }
};
</script>

<style>
.portfolio-detail-page {
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
  font-size: 32rpx;
  font-weight: 600;
  color: #333;
  max-width: 400rpx;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.header-right {
  width: 100rpx;
  display: flex;
  justify-content: flex-end;
}

.add-btn {
  font-size: 28rpx;
  color: #9ed7ee;
  font-weight: 500;
}

.content-list {
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

.items-grid {
  display: flex;
  flex-direction: column;
  gap: 30rpx;
}

.item-card {
  background: #fff;
  border-radius: 20rpx;
  overflow: hidden;
  box-shadow: 0 4rpx 20rpx rgba(0, 0, 0, 0.08);
}

.item-cover {
  width: 100%;
  height: 300rpx;
  position: relative;
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
  padding: 30rpx;
}

.content-preview {
  font-size: 28rpx;
  color: #fff;
  text-align: center;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
}

.item-info {
  padding: 30rpx;
}

.item-title {
  font-size: 32rpx;
  font-weight: 600;
  color: #333;
  margin-bottom: 15rpx;
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.item-content {
  font-size: 28rpx;
  color: #666;
  margin-bottom: 20rpx;
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.item-meta {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.item-date {
  font-size: 24rpx;
  color: #999;
}

.item-actions {
  display: flex;
  gap: 20rpx;
}

.remove-btn {
  font-size: 24rpx;
  color: #ff6b6b;
  padding: 8rpx 16rpx;
  border-radius: 8rpx;
  background: rgba(255, 107, 107, 0.1);
}

.load-more {
  text-align: center;
  padding: 40rpx 0;
  color: #666;
  font-size: 28rpx;
}

/* 添加作品弹窗样式 */
.add-modal {
  width: 90%;
  max-width: 700rpx;
  max-height: 80vh;
}

.modal-content {
  background: #fff;
  border-radius: 20rpx;
  display: flex;
  flex-direction: column;
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 40rpx 40rpx 30rpx;
  border-bottom: 1rpx solid #f0f0f0;
  flex-shrink: 0;
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
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.tip-text {
  font-size: 28rpx;
  color: #666;
  margin-bottom: 30rpx;
  display: block;
}

.my-posts-section {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.section-title {
  font-size: 30rpx;
  font-weight: 600;
  color: #333;
  margin-bottom: 20rpx;
  display: block;
}

.posts-list {
  flex: 1;
  max-height: 400rpx;
}

.loading-small, .empty-small {
  text-align: center;
  padding: 60rpx 0;
  color: #999;
  font-size: 28rpx;
}

.posts-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 20rpx;
}

.post-item {
  position: relative;
  background: #f8f9fa;
  border-radius: 16rpx;
  overflow: hidden;
  border: 3rpx solid transparent;
  transition: all 0.3s ease;
}

.post-item.selected {
  border-color: #9ed7ee;
  background: rgba(158, 215, 238, 0.1);
}

.post-cover {
  width: 100%;
  height: 150rpx;
  position: relative;
}

.post-image {
  width: 100%;
  height: 100%;
}

.post-default {
  width: 100%;
  height: 100%;
  background: linear-gradient(135deg, #e0e0e0 0%, #f5f5f5 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20rpx;
}

.post-text {
  font-size: 20rpx;
  color: #666;
  text-align: center;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.post-title {
  font-size: 24rpx;
  color: #333;
  padding: 15rpx;
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.selected-check {
  position: absolute;
  top: 10rpx;
  right: 10rpx;
  width: 40rpx;
  height: 40rpx;
  background: #9ed7ee;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-size: 24rpx;
  font-weight: bold;
}

.modal-footer {
  display: flex;
  gap: 20rpx;
  padding: 30rpx 40rpx 40rpx;
  flex-shrink: 0;
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

/* 弹窗遮罩 */
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
</style>