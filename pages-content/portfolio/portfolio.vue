<template>
  <view class="portfolio-page">
    <dual-action-top-bar
      title="作品集"
      :show-divider="true"
      @left-click="goBack"
      @right-click="openCreateModal"
      @safe-area-ready="onSafeAreaReady"
    />

    <!-- 作品集列表 -->
    <scroll-view class="portfolio-list" scroll-y="true" @scrolltolower="loadMore">
      <view class="portfolio-content" :style="{ paddingTop: contentTopPadding }">
        <view v-if="folders.length === 0" class="empty-state">
          <image class="empty-icon-img" src="/static/images/newicons/library.png" mode="aspectFit"></image>
          <text class="empty-text">暂无作品集</text>
          <text class="empty-subtext">创建您的第一个作品集吧</text>
        </view>

        <view v-else class="folder-grid">
          <view
            v-for="(folder, index) in folders"
            :key="folder._id"
            class="folder-item-wrapper"
          >
            <!-- 左滑操作按钮 -->
            <view class="swipe-actions" :class="{ 'swipe-actions-show': folder.isSwipeOpen }">
              <view class="action-btn edit-btn" @tap.stop="editFolderName(folder)">
                <text>编辑</text>
              </view>
              <view class="action-btn delete-btn" @tap.stop="deleteFolder(folder)">
                <text>删除</text>
              </view>
            </view>

            <!-- 作品集内容 -->
            <view :class="'folder-item-simple ' + (folder.isSwipeOpen ? ' swipe-open' : '')"
                  @tap="openFolder(folder)"
                  @touchstart="onTouchStart"
                  @touchmove="onTouchMove"
                  @touchend="onTouchEnd"
                  :data-index="index">
              <view class="folder-content">
                <view class="folder-icon">
                  <image v-if="folder.coverUrl" class="folder-cover-image" :src="folder.coverUrl" mode="aspectFill"></image>
                  <image v-else class="folder-default-icon-img" src="/static/images/newicons/library.png" mode="aspectFit"></image>
                </view>
                <view class="folder-info">
                  <text class="folder-name">{{ folder.name }}</text>
                  <text class="folder-count">{{ folder.itemCount }} 个作品</text>
                </view>
              </view>
            </view>
          </view>
        </view>
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
          <view class="create-folder-form">
            <view class="form-item">
              <view class="form-label">作品集名称</view>
              <input
                class="folder-name-input"
                v-model="newFolderName"
                placeholder="请输入作品集名称（最多7个字）"
                maxlength="7"
              />
            </view>

            <view class="form-item">
              <view class="form-label">作品集封面</view>
              <view class="cover-upload-section">
                <view v-if="!newFolderCover" class="cover-upload-btn" @tap="chooseNewCoverImage">
                  <image class="upload-icon-img" src="/static/images/newicons/image.png" mode="aspectFit"></image>
                  <view class="upload-text">选择封面</view>
                </view>
                <view v-else class="cover-preview" @tap="chooseNewCoverImage">
                  <image class="cover-image" :src="newFolderCover" mode="aspectFill"></image>
                  <view class="cover-overlay">
                    <view class="change-text">更换封面</view>
                  </view>
                </view>
              </view>
            </view>
          </view>
        </view>
        <view class="modal-footer">
          <button class="modal-btn outline" @tap="hideCreateModal">取消</button>
          <button class="modal-btn outline" @tap="createFolder" :disabled="!newFolderName.trim()">创建</button>
        </view>
      </view>
    </view>

    <!-- 编辑作品集弹窗 -->
    <view v-if="showEditModal" class="modal-overlay" @tap="hideEditModal">
      <view class="modal-content" @tap.stop>
        <view class="modal-header">
          <text class="modal-title">修改作品集名字</text>
          <text class="close-btn" @tap="hideEditModal">×</text>
        </view>
        <view class="modal-body">
          <view class="edit-folder-form">
            <view class="form-item">
              <view class="form-label">作品集名称</view>
              <input
                class="folder-name-input"
                v-model="editingFolderName"
                placeholder="请输入作品集名称（最多7个字）"
                maxlength="7"
              />
            </view>

            <view class="form-item">
              <view class="form-label">作品集封面</view>
              <view class="cover-upload-section">
                <view v-if="!editingFolderCover" class="cover-upload-btn" @tap="chooseEditCoverImage">
                  <image class="upload-icon-img" src="/static/images/newicons/image.png" mode="aspectFit"></image>
                  <view class="upload-text">选择封面</view>
                </view>
                <view v-else class="cover-preview" @tap="chooseEditCoverImage">
                  <image class="cover-image" :src="editingFolderCover" mode="aspectFill"></image>
                  <view class="cover-overlay">
                    <view class="change-text">更换封面</view>
                  </view>
                </view>
              </view>
            </view>
          </view>
        </view>
        <view class="modal-footer">
          <button class="modal-btn outline" @tap="hideEditModal">取消</button>
          <button class="modal-btn outline" @tap="saveFolderName" :disabled="!editingFolderName.trim()">保存</button>
        </view>
      </view>
    </view>
  </view>
</template>

<script>
import dualActionTopBar from '@/components/dual-action-top-bar/dual-action-top-bar.vue';
import {
  getPortfolioFolders,
  createPortfolioFolder,
  updatePortfolioFolder,
  deletePortfolio as deletePortfolioApi,
  uploadFile,
  invalidatePortfolioCache,
  normalizePortfolioFolder
} from '@/api-cache/portfolio.js';

export default {
  components: {
    dualActionTopBar
  },
  data() {
    return {
      folders: [],
      loading: false,
      hasMore: false,
      showCreateModal: false,
      newFolderName: '',
      newFolderCover: '',
      // 编辑相关
      showEditModal: false,
      editingFolder: null,
      editingFolderName: '',
      editingFolderCover: '',
      // 触摸相关数据
      touchStartX: 0,
      touchStartY: 0,
      touchCurrentX: 0,
      touchCurrentY: 0,
      isSwipeMode: false,
      safeAreaTop: 0
    };
  },

  computed: {
    contentTopPadding() {
      return `calc(${this.safeAreaTop}px + 100rpx)`;
    }
  },

  onLoad() {
    this.onPortfolioUpdated = this.handlePortfolioUpdated.bind(this);
    try {
      uni.$on('portfolio-updated', this.onPortfolioUpdated);
    } catch (error) {
      console.error('【portfolio】监听作品集更新事件失败:', error);
    }
  },

  onShow() {
    this.loadFolders(null, true);
  },

  onUnload() {
    try {
      if (this.onPortfolioUpdated) {
        uni.$off('portfolio-updated', this.onPortfolioUpdated);
      }
    } catch (error) {
      console.error('【portfolio】移除作品集更新监听失败:', error);
    }
  },

  onPullDownRefresh() {
    console.log('【portfolio】下拉刷新开始');
    this.loadFolders(() => {
      console.log('【portfolio】下拉刷新完成，停止刷新动画');
      uni.stopPullDownRefresh();
    }, true); // 强制刷新
  },

  methods: {
    onSafeAreaReady(height) {
      this.safeAreaTop = height || 0;
    },

    handlePortfolioUpdated(event = {}) {
      try {
        const folderId = event.folderId || '';
        const delta = Number(event.delta || 0);

        if (folderId && delta && Array.isArray(this.folders) && this.folders.length > 0) {
          this.folders = this.folders.map(folder => {
            if (!folder || folder._id !== folderId) return folder;
            const currentCount = Number(
              folder.itemCount !== undefined && folder.itemCount !== null
                ? folder.itemCount
                : folder.postCount
            ) || 0;
            const nextCount = Math.max(0, currentCount + delta);
            return {
              ...folder,
              itemCount: nextCount,
              postCount: nextCount
            };
          });
        }

        this.loadFolders(null, true);
      } catch (error) {
        console.error('【portfolio】处理作品集更新事件失败:', error);
      }
    },

    goBack() {
      uni.navigateBack();
    },

    _applyFolders(folders) {
      console.log('【portfolio】_applyFolders 原始数据:', JSON.stringify((folders || []).map(f => ({ _id: f._id, name: f.name, itemCount: f.itemCount, postCount: f.postCount }))));
      this.folders = (folders || []).map(f => {
        const normalizedFolder = normalizePortfolioFolder(f || {});
        return {
          ...normalizedFolder,
          isSwipeOpen: false,
          itemCount: normalizedFolder.itemCount,
          postCount: normalizedFolder.postCount
        };
      });
    },

    async loadFolders(callback, forceRefresh = false) {
      if (this.loading) {
        if (typeof callback === 'function') callback();
        return;
      }

      this.loading = true;
      try {
        const self = this;
        const folders = await getPortfolioFolders({
          forceRefresh: forceRefresh,
          context: this,
          onBackgroundUpdate(newFolders) {
            console.log('【portfolio】SWR后台更新完成，刷新UI');
            self._applyFolders(newFolders);
          }
        });

        this._applyFolders(folders);
        console.log('【portfolio】作品集加载成功，数量:', this.folders.length);
      } catch (error) {
        console.error('加载作品集失败:', error);
        uni.showToast({
          title: error.message || '加载失败',
          icon: 'none'
        });
      } finally {
        this.loading = false;
        if (typeof callback === 'function') {
          callback();
        }
      }
    },

    loadMore() {
      // 暂时不实现分页，因为作品集通常不会很多
    },

    openCreateModal() {
      // 修复：使用 Vue 赋值而不是 setData
      this.showCreateModal = true;
      this.newFolderName = '';
      this.newFolderCover = '';
    },

    hideCreateModal() {
      // 修复：使用 Vue 赋值
      this.showCreateModal = false;
      this.newFolderName = '';
      this.newFolderCover = '';
    },

    async createFolder() {
      if (!this.newFolderName.trim()) {
        uni.showToast({
          title: '请输入作品集名称',
          icon: 'none'
        });
        return;
      }

      if (this.newFolderName.trim().length > 7) {
        uni.showToast({
          title: '作品集名称最多7个字',
          icon: 'none'
        });
        return;
      }

      try {
        uni.showLoading({ title: '创建中...' });

        // 先上传封面图片（如果有的话）
        let coverUrl = null;
        if (this.newFolderCover) {
          try {
            coverUrl = await this.uploadNewCoverImage();
            console.log('【portfolio】封面图片上传成功，fileID:', coverUrl);
          } catch (uploadError) {
            console.error('【portfolio】封面图片上传失败:', uploadError);
            uni.hideLoading();
            // 询问用户是否继续创建不带封面的作品集
            const userChoice = await new Promise((resolve) => {
              uni.showModal({
                title: '封面上传失败',
                content: '封面图片上传失败，是否继续创建不带封面的作品集？',
                confirmText: '继续创建',
                cancelText: '取消',
                success: (res) => {
                  resolve(res.confirm);
                },
                fail: () => {
                  resolve(false);
                }
              });
            });

            if (!userChoice) {
              // 用户选择取消，直接返回
              return;
            }
            // 用户选择继续创建，coverUrl 保持为 null
          }
        }

        await createPortfolioFolder(this.newFolderName.trim(), coverUrl, { context: this });

        uni.showToast({
          title: '创建成功',
          icon: 'success'
        });
        this.hideCreateModal();
        this.loadFolders();

        // 发送全局事件通知其他页面作品集已更新
        try {
          uni.$emit('portfolio-updated', {
            type: 'create',
            timestamp: Date.now()
          });
          console.log('【portfolio】发送作品集更新事件');
        } catch (error) {
          console.error('【portfolio】发送事件失败:', error);
        }
      } catch (error) {
        console.error('创建作品集失败:', error);
        uni.showToast({
          title: error.message || '创建失败',
          icon: 'none',
          duration: 2000
        });
      } finally {
        uni.hideLoading();
      }
    },

    // 选择新建作品集封面图片
    chooseNewCoverImage() {
      uni.chooseImage({
        count: 1,
        sizeType: ['compressed'], // 强制使用压缩图片
        sourceType: ['album', 'camera'],
        success: (res) => {
          const tempFilePath = res.tempFilePaths[0];
          console.log('【portfolio】选择的新建作品集封面图片:', tempFilePath);
          // 验证图片大小（可选，限制最大5MB）
          uni.getFileInfo({
            filePath: tempFilePath,
            success: (fileInfo) => {
              const maxSize = 5 * 1024 * 1024; // 5MB
              if (fileInfo.size > maxSize) {
                uni.showToast({
                  title: '图片过大，请选择更小的图片',
                  icon: 'none'
                });
                return;
              }
              this.newFolderCover = tempFilePath;
            },
            fail: (err) => {
              console.warn('获取文件信息失败，但仍继续使用:', err);
              // 即使获取文件信息失败，也继续使用该图片
              this.newFolderCover = tempFilePath;
            }
          });
        },
        fail: (err) => {
          console.error('【portfolio】选择图片失败:', err);
          uni.showToast({
            title: err.errMsg || '选择图片失败',
            icon: 'none'
          });
        }
      });
    },

    // 上传新建作品集封面图片
    async uploadNewCoverImage() {
      if (!this.newFolderCover) {
        return null;
      }

      const timestamp = new Date().getTime();
      const cloudPath = `portfolio_covers/${timestamp}_new_cover.jpg`;

      try {
        uni.showLoading({
          title: '上传封面中...'
        });

        let fileContent;

        // 检查运行环境
        // #ifdef H5
        // H5环境：使用fetch获取blob，然后转换为base64
        const response = await fetch(this.newFolderCover);
        const blob = await response.blob();
        fileContent = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
        // 移除data:image/jpeg;base64,前缀
        fileContent = fileContent.split(',')[1];
        // #endif

        // #ifndef H5
        // 非H5环境（如小程序）：使用uni.getFileSystemManager
        fileContent = await new Promise((resolve, reject) => {
          uni.getFileSystemManager().readFile({
            filePath: this.newFolderCover,
            encoding: 'base64',
            success: (readRes) => resolve(readRes.data),
            fail: reject
          });
        });
        // #endif

        const uploadRes = await uploadFile(cloudPath, fileContent, { context: this });

        uni.hideLoading();
        return uploadRes.fileID || uploadRes;
      } catch (error) {
        uni.hideLoading();
        console.error('上传封面图片失败:', error);
        throw error;
      }
    },

    openFolder(folder) {
      if (!folder || !folder._id) {
        uni.showToast({
          title: '作品集信息缺失',
          icon: 'none'
        });
        return;
      }

      // 如果是滑动模式，不处理点击
      if (this.isSwipeMode) {
        this.isSwipeMode = false;
        return;
      }

      if (folder.isSwipeOpen || this.folders.some(item => item && item.isSwipeOpen)) {
        this.closeAllSwipeActions();
        return;
      }

      uni.navigateTo({
        url: `/pages-content/portfolio-detail/portfolio-detail?folderId=${folder._id}&folderName=${encodeURIComponent(folder.name)}`,
        fail: (error) => {
          console.error('【portfolio】打开作品集详情失败:', error);
          uni.showToast({
            title: '打开作品集失败',
            icon: 'none'
          });
        }
      });
    },

    // 触摸开始
    onTouchStart(e) {
      const touch = e.touches[0];
      this.touchStartX = touch.pageX || touch.clientX;
      this.touchStartY = touch.pageY || touch.clientY;
      this.touchCurrentX = touch.pageX || touch.clientX;
      this.touchCurrentY = touch.pageY || touch.clientY;
      this.isSwipeMode = false;
    },

    // 触摸移动
    onTouchMove(e) {
      const touch = e.touches[0];
      this.touchCurrentX = touch.pageX || touch.clientX;
      this.touchCurrentY = touch.pageY || touch.clientY;

      const deltaX = this.touchCurrentX - this.touchStartX;
      const deltaY = Math.abs(this.touchCurrentY - this.touchStartY);

      // 如果水平滑动距离大于垂直滑动距离，且向左滑动超过20px，则进入滑动模式
      if (Math.abs(deltaX) > deltaY && deltaX < -20) {
        this.isSwipeMode = true;
        e.preventDefault();
      }
    },

    // 触摸结束
    onTouchEnd(e) {
      const deltaX = this.touchCurrentX - this.touchStartX;
      const deltaY = Math.abs(this.touchCurrentY - this.touchStartY);

      // 如果水平滑动距离大于垂直滑动距离
      if (Math.abs(deltaX) > deltaY) {
        if (deltaX < -30) {
          // 向左滑动超过30px，显示操作按钮
          const index = parseInt(e.currentTarget.dataset.index);
          this.openSwipeActions(index);
        } else {
          // 滑动距离不够，关闭所有滑动操作
          this.closeAllSwipeActions();
        }
      }
    },

    // 打开滑动操作
    openSwipeActions(index) {
      const updatedFolders = this.folders.map((folder, i) => {
        if (i === index) {
          return { ...folder, isSwipeOpen: true };
        } else {
          return { ...folder, isSwipeOpen: false };
        }
      });
      this.folders = updatedFolders;
    },

    // 关闭所有滑动操作
    closeAllSwipeActions() {
      const updatedFolders = this.folders.map(folder => ({
        ...folder,
        isSwipeOpen: false
      }));
      this.folders = updatedFolders;
    },


    // 编辑作品集名字
    editFolderName(folder) {
      // 关闭滑动操作
      this.closeAllSwipeActions();

      console.log('编辑作品集:', folder);
      // 修复：使用 Vue 赋值
      this.showEditModal = true;
      this.editingFolder = folder;
      this.editingFolderName = folder.name;
      this.editingFolderCover = folder.coverUrl || '';
    },

    // 隐藏编辑弹窗
    hideEditModal() {
      // 修复：使用 Vue 赋值
      this.showEditModal = false;
      this.editingFolder = null;
      this.editingFolderName = '';
      this.editingFolderCover = '';
    },

    // 保存作品集名字
    async saveFolderName() {
      if (!this.editingFolderName.trim()) {
        uni.showToast({
          title: '请输入作品集名称',
          icon: 'none'
        });
        return;
      }

      if (this.editingFolderName.trim().length > 7) {
        uni.showToast({
          title: '作品集名称最多7个字',
          icon: 'none'
        });
        return;
      }

      try {
        uni.showLoading({ title: '保存中...' });

        // 先上传封面图片（如果有的话）
        const coverUrl = await this.uploadEditCoverImage();

        await updatePortfolioFolder(
          this.editingFolder._id,
          this.editingFolderName.trim(),
          coverUrl,
          { context: this }
        );

        uni.showToast({
          title: '修改成功',
          icon: 'success'
        });

        // 更新本地作品集列表
        const updatedList = this.folders.map(folder => {
          if (folder._id === this.editingFolder._id) {
            return {
              ...folder,
              name: this.editingFolderName.trim(),
              coverUrl: coverUrl || folder.coverUrl
            };
          }
          return folder;
        });

        // 修复：使用 Vue 赋值，这里需要使用 $set 强制更新数组
        this.folders = updatedList;

        this.hideEditModal();

        // 发送全局事件通知其他页面作品集已更新
        try {
          uni.$emit('portfolio-updated', {
            type: 'edit',
            timestamp: Date.now()
          });
          console.log('【portfolio】发送作品集编辑事件');
        } catch (error) {
          console.error('【portfolio】发送编辑事件失败:', error);
        }
      } catch (error) {
        console.error('修改作品集失败:', error);
        uni.showToast({
          title: error.message || '修改失败',
          icon: 'none'
        });
      } finally {
        uni.hideLoading();
      }
    },

    // 选择编辑作品集封面图片
    chooseEditCoverImage() {
      uni.chooseImage({
        count: 1,
        sizeType: ['compressed'],
        sourceType: ['album', 'camera'],
        success: (res) => {
          const tempFilePath = res.tempFilePaths[0];
          console.log('选择的编辑作品集封面图片:', tempFilePath);
          this.editingFolderCover = tempFilePath;
        },
        fail: (err) => {
          console.error('选择图片失败:', err);
          uni.showToast({
            title: '选择图片失败',
            icon: 'none'
          });
        }
      });
    },

    // 上传编辑作品集封面图片
    async uploadEditCoverImage() {
      if (!this.editingFolderCover) {
        return null;
      }

      const timestamp = new Date().getTime();
      const cloudPath = `portfolio_covers/${timestamp}_edit_cover.jpg`;

      try {
        uni.showLoading({
          title: '上传封面中...'
        });

        let fileContent;

        // 检查运行环境
        // #ifdef H5
        // H5环境：使用fetch获取blob，然后转换为base64
        const response = await fetch(this.editingFolderCover);
        const blob = await response.blob();
        fileContent = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
        // 移除data:image/jpeg;base64,前缀
        fileContent = fileContent.split(',')[1];
        // #endif

        // #ifndef H5
        // 非H5环境（如小程序）：使用uni.getFileSystemManager
        fileContent = await new Promise((resolve, reject) => {
          uni.getFileSystemManager().readFile({
            filePath: this.editingFolderCover,
            encoding: 'base64',
            success: (readRes) => resolve(readRes.data),
            fail: reject
          });
        });
        // #endif

        const uploadRes = await uploadFile(cloudPath, fileContent, { context: this });

        uni.hideLoading();
        return uploadRes.fileID || uploadRes;
      } catch (error) {
        uni.hideLoading();
        console.error('上传封面图片失败:', error);
        throw error;
      }
    },

    async deleteFolder(folder) {
      // 关闭滑动操作
      this.closeAllSwipeActions();

      if (folder.isDefault) {
        uni.showToast({
          title: '默认作品集不能删除',
          icon: 'none'
        });
        return;
      }

      return new Promise((resolve) => {
        uni.showModal({
          title: '确认删除',
          content: `确定要删除作品集"${folder.name}"吗？里面的作品不会被删除。`,
          success: async (res) => {
            if (res.confirm) {
              try {
                uni.showLoading({ title: '删除中...' });

                await deletePortfolioApi(folder._id, { context: this });

                uni.showToast({
                  title: '删除成功',
                  icon: 'success'
                });

                // 重新加载作品集列表
                this.loadFolders();

                // 发送全局事件通知其他页面作品集已更新
                try {
                  uni.$emit('portfolio-updated', {
                    type: 'delete',
                    timestamp: Date.now()
                  });
                  console.log('【portfolio】发送作品集删除事件');
                } catch (error) {
                  console.error('【portfolio】发送删除事件失败:', error);
                }
              } catch (error) {
                console.error('删除作品集失败:', error);
                uni.showToast({
                  title: error.message || '删除失败',
                  icon: 'none'
                });
              } finally {
                uni.hideLoading();
                resolve();
              }
            } else {
              resolve();
            }
          }
        });
      });
    }
  }
};
</script>

<style>
.portfolio-page {
  min-height: 100vh;
  background: var(--app-page-bg, #fff);
  color: var(--app-primary-text, #111111);
  display: flex;
  flex-direction: column;
  /* #ifdef APP-PLUS */
  padding-top: var(--status-bar-height);
  /* #endif */
}

.portfolio-list {
  flex: 1;
  height: 0;
  overflow: hidden;
}

.portfolio-content {
  padding: 30rpx;
}

.loading {
  text-align: center;
  padding: 60rpx 0;
  color: var(--app-muted-text, #666);
  font-size: 28rpx;
}

.empty-state {
  text-align: center;
  padding: 120rpx 0;
}

.empty-icon-img {
  width: 120rpx;
  height: 120rpx;
  margin-bottom: 30rpx;
  opacity: 0.5;
  filter: var(--app-icon-filter, none);
}

.empty-text {
  font-size: 32rpx;
  color: var(--app-primary-text, #333);
  margin-bottom: 20rpx;
  display: block;
}

.empty-subtext {
  font-size: 28rpx;
  color: var(--app-muted-text, #666);
  display: block;
}

.folder-grid {
  display: flex;
  flex-direction: column;
}

/* 作品集项包装器 */
.folder-item-wrapper {
  position: relative;
  overflow: hidden;
}

/* 左滑操作按钮 */
.swipe-actions {
  position: absolute;
  top: 0;
  right: 0;
  height: 100%;
  display: flex;
  z-index: 1;
  transform: translateX(100%);
  transition: transform 0.3s ease;
  width: 240rpx;
}

.swipe-actions.swipe-actions-show {
  transform: translateX(0);
}

.swipe-actions .action-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  color: #ffffff;
  font-size: 24rpx;
  min-width: 120rpx;
  flex: 1;
  height: 100%;
}

.swipe-actions .edit-btn {
  background-color: #999999;
}

.swipe-actions .delete-btn {
  background-color: #cc9090;
}

.folder-item-simple {
  padding: 30rpx 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1rpx solid var(--app-border-color, #f0f0f0);
  width: 100%;
  box-sizing: border-box;
  margin-right: 0;
  padding-right: 0;
  position: relative;
  background-color: var(--app-page-bg, #ffffff);
  z-index: 2;
  transition: transform 0.3s ease;
}

.folder-item-simple.swipe-open {
  transform: translateX(-240rpx);
}

.folder-content {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 20rpx;
}

.folder-icon {
  width: 88rpx;
  height: 88rpx;
  background: var(--app-subtle-surface-bg, #FFFFFF);
  border-radius: 20rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 40rpx;
  flex-shrink: 0;
}

.folder-cover-image {
  width: 100%;
  height: 100%;
  border-radius: 20rpx;
}

.folder-default-icon-img {
  width: 60rpx;
  height: 60rpx;
  filter: var(--app-icon-filter, none);
}

.folder-info {
  display: flex;
  flex-direction: column;
  gap: 8rpx;
}

.folder-name {
  font-size: 32rpx;
  font-weight: 600;
  color: var(--app-primary-text, #333);
}

.folder-count {
  font-size: 26rpx;
  color: var(--app-muted-text, #666);
}


.load-more {
  text-align: center;
  padding: 40rpx 0;
  color: var(--app-muted-text, #666);
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
  background: var(--app-elevated-bg, #fff);
  border: 1rpx solid var(--app-border-color, transparent);
  box-shadow: var(--app-surface-shadow, 0 10rpx 30rpx rgba(0, 0, 0, 0.12));
  border-radius: 20rpx;
  width: 600rpx;
  padding: 0;
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 40rpx 40rpx 30rpx;
  border-bottom: 1rpx solid var(--app-border-color, #f0f0f0);
}

.modal-title {
  font-size: 32rpx;
  font-weight: 600;
  color: var(--app-primary-text, #333);
}

.close-btn {
  font-size: 40rpx;
  color: var(--app-muted-text, #999);
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
  border: 2rpx solid var(--app-border-color, #e9ecef);
  border-radius: 12rpx;
  padding: 0 20rpx;
  font-size: 28rpx;
  color: var(--app-primary-text, #333);
  background: var(--app-subtle-surface-bg, #ffffff);
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

.modal-btn.outline {
  background: var(--app-elevated-bg, #FFFFFF);
  color: var(--app-primary-text, #000000);
  border: 2rpx solid var(--app-primary-text, #000000);
  font-weight: 400;
}

.modal-btn.outline[disabled] {
  background: var(--app-elevated-bg, #FFFFFF);
  color: var(--app-muted-text, #ccc);
  border: 2rpx solid var(--app-muted-text, #ccc);
}

/* 封面上传样式 */
.create-folder-form,
.edit-folder-form {
  display: flex;
  flex-direction: column;
  gap: 30rpx;
}

.form-item {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
}

.form-label {
  font-size: 26rpx;
  color: var(--app-primary-text, #333333);
  font-weight: 500;
}

.cover-upload-section {
  display: flex;
  justify-content: center;
  align-items: center;
}

.cover-upload-btn {
  width: 200rpx;
  height: 200rpx;
  border: 2rpx dashed var(--app-border-color, #e0e0e0);
  border-radius: 12rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: var(--app-subtle-surface-bg, #f8f9fa);
}

.upload-icon-img {
  width: 48rpx;
  height: 48rpx;
  margin-bottom: 8rpx;
  opacity: 0.6;
  filter: var(--app-icon-filter, none);
}

.upload-text {
  font-size: 24rpx;
  color: var(--app-secondary-text, #666);
}

.cover-preview {
  width: 200rpx;
  height: 200rpx;
  border-radius: 12rpx;
  overflow: hidden;
  position: relative;
}

.cover-image {
  width: 100%;
  height: 100%;
}

.cover-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: opacity 0.3s ease;
}

.cover-preview:active .cover-overlay {
  opacity: 1;
}

.change-text {
  color: #fff;
  font-size: 24rpx;
  font-weight: 500;
}
</style>
