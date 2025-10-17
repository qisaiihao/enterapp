<template>
  <view class="portfolio-detail-page">
    <!-- 顶部导航栏 -->
    <view class="header">
      <view class="header-left" @tap="goBack">
        <text class="back-icon">←</text>
      </view>
      <text class="header-title">{{ folderName }}</text>
      <view class="header-right">
        <text class="add-btn" @tap="openAddModal">+ 添加</text>
      </view>
    </view>

    <!-- 作品列表 -->
    <scroll-view class="content-list" scroll-y="true" @scrolltolower="loadMore">

      <view v-if="portfolioItems.length === 0" class="empty-state">
        <text class="empty-icon">📝</text>
        <text class="empty-text">暂无作品</text>
        <text class="empty-subtext">点击右上角添加您的作品</text>
      </view>

      <view v-else id="post-list-container">
        <view v-for="(item, index) in portfolioItems" :key="'portfolio-' + index + '-' + (item._id || item.postId)" :class="'post-item-wrapper color-' + ((index % 4) + 1)" :style="{ backgroundColor: item.backgroundColor || '#FFE5E5' }">
          <view class="post-content-navigator" @tap="togglePostExpansion" :data-index="index">
            <view class="post-item">
              <view :class="'post-content ' + (item.isExpanded ? 'expanded' : 'collapsed')" v-if="item.content" :style="{ color: item.textColor, whiteSpace: 'pre-wrap' }">
                <block v-if="item.isExpanded">
                  {{ item.content }}
                </block>
                <block v-else>
                  <!-- 折叠状态下只显示高光行 -->
                  <block v-if="item.highlightLines && item.highlightLines.length > 0">
                    <text v-for="(highlightLine, index) in item.highlightLines" :key="'line-' + index" style="font-weight: 700; display: block;">{{ highlightLine }}</text>
                  </block>
                  <block v-else>
                    {{ item.content }}
                  </block>
                </block>
              </view>

              <!-- 作者签名 - 只在展开时显示 -->
              <view v-if="item.isExpanded && item.authorSignature" class="user-signature">
                <image class="signature-image" :src="item.authorSignature" mode="aspectFit" @error="onSignatureError" @load="onSignatureLoad"></image>
              </view>
            </view>
          </view>

          <!-- 交互区（展开时显示） -->
          <view class="vote-section" v-if="item.isExpanded" :style="{ backgroundColor: item.backgroundColor }">
            <view class="actions-left">
              <view class="like-icon-container" @tap.stop.prevent="onVote" :data-postid="item._id" :data-index="index">
                <image class="like-icon" :src="item.likeIcon || '/static/images/seed.png'" mode="aspectFit" @error="onLikeIconError" />
              </view>
              <view class="comment-count" @tap.stop.prevent="onCommentClick" :data-postid="item._id">
                <text class="comment-emoji">💬</text>
              </view>
            </view>
            <view class="button-group">
              <text class="remove-btn" @tap.stop="removeItem(item)">移除</text>
            </view>
          </view>
        </view>
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
          <text class="tip-text">从您的原创诗歌中选择要添加到作品集的内容</text>
          <view class="my-posts-section">
            <text class="section-title">我的原创诗歌</text>
            <scroll-view class="posts-list" scroll-y="true">
              <view v-if="myPosts.length === 0" class="empty-small">
                <text>暂无原创诗歌</text>
              </view>
              <view v-else class="posts-grid">
                <view
                  v-for="post in myPosts"
                  :key="post._id"
                  class="post-item"
                  :class="{ selected: selectedPostIds.includes(post._id) }"
                  @tap="toggleSelectPost(post)"
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
                  <view v-if="selectedPostIds.includes(post._id)" class="selected-check">
                    <text>✓</text>
                  </view>
                </view>
              </view>
            </scroll-view>
          </view>
        </view>
        <view class="modal-footer">
          <button class="modal-btn cancel" @tap="hideAddModal">取消</button>
          <button class="modal-btn confirm" @tap="addToPortfolio" :disabled="selectedPostIds.length === 0">添加</button>
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
      selectedPostIds: [],
      skip: 0,
      limit: 10,
      // 添加展开/折叠相关数据
      backgroundColors: [
        '#FFE5E5', '#E5F3FF', '#E5FFE5', '#FFF5E5'
      ],
      lastUsedColorIndex: -1
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
          const items = res.result.portfolioItems || [];
          // 为每个作品添加展开/折叠相关属性
          items.forEach((item, index) => {
            item.backgroundColor = this.generateRandomBackgroundColor();
            item.textColor = '#333';
            item.isExpanded = false;
            item.authorSignature = '';
            item.likeIcon = this.getLikeIcon(item.votes || 0, !!item.isVoted);
            console.log(`【作品集】项目${index}背景色:`, item.backgroundColor);
          });
          
          if (this.skip === 0) {
            this.portfolioItems = items;
          } else {
            this.portfolioItems = [...this.portfolioItems, ...items];
          }
          this.hasMore = items.length >= this.limit;
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
        // 使用和profile页面相同的云函数调用方式
        const res = await this.callCloudFunction('getMyProfileData', {
          skip: 0,
          limit: 50
        });

        if (res.result && res.result.success && res.result.posts) {
          console.log('【作品集】获取到的我的帖子:', res.result.posts.length);
          console.log('【作品集】帖子详情:', res.result.posts.map(p => ({
            id: p._id,
            title: p.title,
            isOriginal: p.isOriginal,
            isPoem: p.isPoem,
            content: p.content?.substring(0, 20) + '...'
          })));
          
          // 过滤掉已经在作品集中的帖子
          const existingPostIds = this.portfolioItems.map(item => item.postId);
          console.log('【作品集】已存在的帖子ID:', existingPostIds);
          
          // 只显示原创诗歌，使用isOriginal和isPoem字段
          this.myPosts = res.result.posts.filter(post => {
            const isOriginalPoem = post.isOriginal === true && post.isPoem === true;
            const notInPortfolio = !existingPostIds.includes(post._id);
            
            console.log(`【作品集】帖子 ${post._id}: isOriginal=${post.isOriginal}, isPoem=${post.isPoem}, isOriginalPoem=${isOriginalPoem}, notInPortfolio=${notInPortfolio}`);
            
            return isOriginalPoem && notInPortfolio;
          });
          
          console.log('【作品集】过滤后的我的原创诗歌数量:', this.myPosts.length);
        }
      } catch (error) {
        console.error('加载我的原创诗歌失败:', error);
      } finally {
        this.myPostsLoading = false;
      }
    },

    openAddModal() {
      this.setData({
        showAddModal: true,
        selectedPostIds: []
      });
      this.loadMyPosts();
    },

    hideAddModal() {
      this.setData({
        showAddModal: false,
        selectedPostIds: []
      });
    },

    toggleSelectPost(post) {
      const index = this.selectedPostIds.indexOf(post._id);
      if (index > -1) {
        // 如果已选中，则取消选中
        this.selectedPostIds.splice(index, 1);
      } else {
        // 如果未选中，则添加到选中列表
        this.selectedPostIds.push(post._id);
      }
      this.setData({
        selectedPostIds: this.selectedPostIds
      });
    },

    async addToPortfolio() {
      if (this.selectedPostIds.length === 0) {
        uni.showToast({
          title: '请选择要添加的诗歌',
          icon: 'none'
        });
        return;
      }

      try {
        uni.showLoading({ title: '添加中...' });
        
        // 批量添加选中的诗歌
        const promises = this.selectedPostIds.map(postId => 
          this.callCloudFunction('addToPortfolio', {
            folderId: this.folderId,
            postId: postId
          })
        );
        
        const results = await Promise.all(promises);
        const successCount = results.filter(res => res.result && res.result.success).length;
        
        if (successCount > 0) {
          uni.showToast({
            title: `成功添加 ${successCount} 首诗歌`,
            icon: 'success'
          });
          this.hideAddModal();
          this.skip = 0;
          this.loadPortfolioItems();
        } else {
          uni.showToast({
            title: '添加失败',
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

    // 生成随机背景颜色
    generateRandomBackgroundColor() {
      const colors = this.backgroundColors;
      const last = this.lastUsedColorIndex;
      if (last === -1) {
        const idx = Math.floor(Math.random() * colors.length);
        this.lastUsedColorIndex = idx;
        return colors[idx];
      }
      const avail = colors.filter((_, i) => i !== last);
      const pick = avail[Math.floor(Math.random() * avail.length)];
      this.lastUsedColorIndex = colors.indexOf(pick);
      return pick;
    },

    // 获取点赞图标
    getLikeIcon(votes, isVoted) {
      // 简单的点赞图标逻辑，可以根据需要调整
      if (votes >= 10) return '/static/images/seedplus.png';
      if (votes >= 5) return '/static/images/seed.png';
      return '/static/images/seed.png';
    },

    // 切换展开/折叠
    togglePostExpansion(e) {
      const index = e.currentTarget.dataset.index;
      const items = [...this.portfolioItems];
      items[index].isExpanded = !items[index].isExpanded;
      this.setData({
        portfolioItems: items
      });
    },

    // 点赞处理
    onVote(e) {
      const postId = e.currentTarget.dataset.postid;
      const index = e.currentTarget.dataset.index;
      console.log('点赞作品:', postId);
      // 这里可以添加点赞逻辑
    },

    // 评论点击
    onCommentClick(e) {
      const postId = e.currentTarget.dataset.postid;
      console.log('查看评论:', postId);
      // 这里可以添加跳转到评论页面的逻辑
    },

    // 签名图片错误处理
    onSignatureError() {
      console.log('签名图片加载失败');
    },

    // 签名图片加载成功
    onSignatureLoad() {
      console.log('签名图片加载成功');
    },

    // 点赞图标错误处理
    onLikeIconError() {
      console.log('点赞图标加载失败');
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

/* 作品集内容样式 - 参考poem-square */
#post-list-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 0 40rpx;
  width: 100%;
}

.post-item-wrapper {
  width: 100%;
  max-width: 600rpx;
  border-radius: 30rpx;
  margin-bottom: 40rpx;
  overflow: hidden;
  box-shadow: 0 8rpx 8rpx rgba(0, 0, 0, 0.25);
  transition: transform .3s ease;
  border: none;
  position: relative;
}

.post-item-wrapper.color-1 {
  background: #FFE5E5;
}
.post-item-wrapper.color-2 {
  background: #E5F3FF;
}
.post-item-wrapper.color-3 {
  background: #E5FFE5;
}
.post-item-wrapper.color-4 {
  background: #FFF5E5;
}

.post-item-wrapper:active { 
  transform: scale(0.98); 
}

.post-content-navigator { 
  display: block; 
}

.post-item { 
  padding: 30rpx 60rpx 30rpx 80rpx; 
  position: relative; 
}

.post-content {
  font-family: 'Inter', sans-serif;
  font-style: normal;
  font-weight: 500;
  font-size: 28rpx;
  line-height: 38rpx;
  margin: 30rpx 0;
  width: 100%;
  color: #333333;
}

.post-content.collapsed {
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 3;
  overflow: hidden;
  text-overflow: ellipsis;
}

.post-content.expanded { 
  display: block; 
  overflow: visible; 
}

.comment-emoji{ 
  font-size: 40rpx; 
}

.vote-section { 
  display: flex; 
  justify-content: space-between; 
  align-items: center; 
  padding: 25rpx 50rpx; 
}

.actions-left { 
  flex: 1; 
  display: flex; 
  align-items: center; 
  gap: 20rpx; 
}

.button-group { 
  display: flex; 
  align-items: center; 
  gap: 30rpx; 
}

.comment-count { 
  display: flex; 
  align-items: center; 
  gap: 8rpx; 
  padding: 10rpx 15rpx; 
}

.like-icon { 
  width: 60rpx; 
  height: 60rpx; 
  margin-top: 5px; 
}

.user-signature {
  position: absolute;
  bottom: 20rpx;
  right: 20rpx;
  width: 100rpx;
  height: 50rpx;
}

.signature-image {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.remove-btn {
  color: #ff4757;
  font-size: 24rpx;
  padding: 10rpx 20rpx;
  border-radius: 20rpx;
  background: rgba(255, 255, 255, 0.9);
  box-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.1);
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