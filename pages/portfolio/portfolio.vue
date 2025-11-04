<template>
  <view class="portfolio-page">
    <!-- 顶部导航栏 -->
    <view class="header">
      <view class="header-left" @tap="goBack">
        <image class="back-icon-image" src="/static/images/back_to_edit.png" mode="aspectFit"></image>
      </view>
      <text class="header-title">作品集</text>
      <view class="header-right">
        <image class="create-btn-icon" src="/static/images/select_more.png" mode="aspectFit" @tap="openCreateModal"></image>
      </view>
    </view>

    <!-- 作品集列表 -->
    <scroll-view class="portfolio-list" scroll-y="true" @scrolltolower="loadMore">
      <view class="portfolio-content">
        <view v-if="folders.length === 0" class="empty-state">
          <text class="empty-icon">📁</text>
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
                  <view v-else class="folder-default-icon">📚</view>
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
                  <view class="upload-icon">📷</view>
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
          <button class="modal-btn cancel" @tap="hideCreateModal">取消</button>
          <button class="modal-btn confirm" @tap="createFolder" :disabled="!newFolderName.trim()">创建</button>
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
                  <view class="upload-icon">📷</view>
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
          <button class="modal-btn cancel" @tap="hideEditModal">取消</button>
          <button class="modal-btn confirm" @tap="saveFolderName" :disabled="!editingFolderName.trim()">保存</button>
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
      isSwipeMode: false
    };
  },

  onLoad() {
    this.loadFolders();
  },

  onPullDownRefresh() {
    console.log('【portfolio】下拉刷新开始');
    this.loadFolders(() => {
      console.log('【portfolio】下拉刷新完成，停止刷新动画');
      uni.stopPullDownRefresh();
    });
  },

  methods: {
    // 统一云函数调用方法
    callCloudFunction(name, data = {}, extraOptions = {}) {
      return cloudCall(name, data, Object.assign({ pageTag: 'portfolio', context: this, requireAuth: true }, extraOptions));
    },

    goBack() {
      uni.navigateBack();
    },

    async loadFolders(callback) {
      if (this.loading) {
        if (typeof callback === 'function') callback();
        return;
      }

      this.loading = true;
      try {
        const res = await this.callCloudFunction('getPortfolioFolders', {});
        if (res.result && res.result.success) {
          this.folders = res.result.folders || [];
          console.log('【portfolio】作品集加载成功，数量:', this.folders.length);
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
        // 执行回调函数（用于下拉刷新完成后停止动画）
        if (typeof callback === 'function') {
          callback();
        }
      }
    },

    loadMore() {
      // 暂时不实现分页，因为作品集通常不会很多
    },

    openCreateModal() {
      this.setData({
        showCreateModal: true,
        newFolderName: '',
        newFolderCover: ''
      });
    },

    hideCreateModal() {
      this.setData({
        showCreateModal: false,
        newFolderName: '',
        newFolderCover: ''
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
        
        const res = await this.callCloudFunction('createPortfolioFolder', {
          folderName: this.newFolderName.trim(),
          coverUrl: coverUrl
        });

        if (res.result && res.result.success) {
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
        } else {
          uni.showToast({
            title: res.result?.message || '创建失败',
            icon: 'none'
          });
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
              this.setData({
                newFolderCover: tempFilePath
              });
            },
            fail: (err) => {
              console.warn('获取文件信息失败，但仍继续使用:', err);
              // 即使获取文件信息失败，也继续使用该图片
              this.setData({
                newFolderCover: tempFilePath
              });
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
    uploadNewCoverImage() {
      return new Promise((resolve, reject) => {
        if (!this.newFolderCover) {
          resolve(null);
          return;
        }

        const timestamp = new Date().getTime();
        const cloudPath = `portfolio_covers/${timestamp}_new_cover.jpg`;
        
        uni.showLoading({
          title: '上传封面中...'
        });

        // 检查运行环境
        // #ifdef H5
        // H5环境：使用fetch获取blob，然后转换为base64
        fetch(this.newFolderCover)
          .then(response => response.blob())
          .then(blob => {
            return new Promise((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = () => resolve(reader.result);
              reader.onerror = reject;
              reader.readAsDataURL(blob);
            });
          })
          .then(base64 => {
            // 移除data:image/jpeg;base64,前缀
            const base64Data = base64.split(',')[1];
            console.log('H5环境新建作品集封面图片base64转换成功');
            
            // 调用云函数上传
            this.callCloudFunction('upload', {
              fileContent: base64Data,
              cloudPath: cloudPath
            }).then((uploadRes) => {
              uni.hideLoading();
              console.log('【portfolio】H5环境新建作品集封面图片上传结果:', uploadRes);
              if (uploadRes && uploadRes.result && uploadRes.result.success && uploadRes.result.fileID) {
                resolve(uploadRes.result.fileID);
              } else {
                const errorMsg = uploadRes?.result?.message || uploadRes?.result?.error || '上传失败';
                console.error('【portfolio】H5环境新建作品集封面图片上传失败:', uploadRes);
                reject(new Error(errorMsg));
              }
            }).catch((uploadErr) => {
              uni.hideLoading();
              console.error('【portfolio】H5环境新建作品集封面图片上传云函数调用失败:', uploadErr);
              reject(new Error(uploadErr.message || '上传失败'));
            });
          })
          .catch((err) => {
            uni.hideLoading();
            console.error('H5环境新建作品集封面图片base64转换失败:', err);
            reject(err);
          });
        // #endif

        // #ifndef H5
        // 非H5环境（如小程序）：使用uni.getFileSystemManager
        uni.getFileSystemManager().readFile({
          filePath: this.newFolderCover,
          encoding: 'base64',
          success: (readRes) => {
            console.log('非H5环境新建作品集封面图片base64读取成功');
            
            // 调用云函数上传
            this.callCloudFunction('upload', {
              fileContent: readRes.data,
              cloudPath: cloudPath
            }).then((uploadRes) => {
              uni.hideLoading();
              console.log('【portfolio】非H5环境新建作品集封面图片上传结果:', uploadRes);
              if (uploadRes && uploadRes.result && uploadRes.result.success && uploadRes.result.fileID) {
                resolve(uploadRes.result.fileID);
              } else {
                const errorMsg = uploadRes?.result?.message || uploadRes?.result?.error || '上传失败';
                console.error('【portfolio】非H5环境新建作品集封面图片上传失败:', uploadRes);
                reject(new Error(errorMsg));
              }
            }).catch((uploadErr) => {
              uni.hideLoading();
              console.error('【portfolio】非H5环境新建作品集封面图片上传云函数调用失败:', uploadErr);
              reject(new Error(uploadErr.message || '上传失败'));
            });
          },
          fail: (readErr) => {
            uni.hideLoading();
            console.error('非H5环境新建作品集封面图片base64读取失败:', readErr);
            reject(readErr);
          }
        });
        // #endif
      });
    },

    openFolder(folder) {
      // 如果是滑动模式，不处理点击
      if (this.isSwipeMode) {
        this.isSwipeMode = false;
        return;
      }

      // 关闭所有滑动操作
      this.closeAllSwipeActions();

      uni.navigateTo({
        url: `/pages/portfolio-detail/portfolio-detail?folderId=${folder._id}&folderName=${encodeURIComponent(folder.name)}`
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
      this.setData({
        showEditModal: true,
        editingFolder: folder,
        editingFolderName: folder.name,
        editingFolderCover: folder.coverUrl || ''
      });
    },

    // 隐藏编辑弹窗
    hideEditModal() {
      this.setData({
        showEditModal: false,
        editingFolder: null,
        editingFolderName: '',
        editingFolderCover: ''
      });
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
        
        const res = await this.callCloudFunction('updatePortfolioFolder', {
          folderId: this.editingFolder._id,
          name: this.editingFolderName.trim(),
          coverUrl: coverUrl
        });

        if (res.result && res.result.success) {
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
          
          this.setData({
            folders: updatedList
          });

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
        } else {
          uni.showToast({
            title: res.result.message || '修改失败',
            icon: 'none'
          });
        }
      } catch (error) {
        console.error('修改作品集失败:', error);
        uni.showToast({
          title: '修改失败',
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
          this.setData({
            editingFolderCover: tempFilePath
          });
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
    uploadEditCoverImage() {
      return new Promise((resolve, reject) => {
        if (!this.editingFolderCover) {
          resolve(null);
          return;
        }

        const timestamp = new Date().getTime();
        const cloudPath = `portfolio_covers/${timestamp}_edit_cover.jpg`;
        
        uni.showLoading({
          title: '上传封面中...'
        });

        // 检查运行环境
        // #ifdef H5
        // H5环境：使用fetch获取blob，然后转换为base64
        fetch(this.editingFolderCover)
          .then(response => response.blob())
          .then(blob => {
            return new Promise((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = () => resolve(reader.result);
              reader.onerror = reject;
              reader.readAsDataURL(blob);
            });
          })
          .then(base64 => {
            // 移除data:image/jpeg;base64,前缀
            const base64Data = base64.split(',')[1];
            console.log('H5环境编辑作品集封面图片base64转换成功');
            
            // 调用云函数上传
            this.callCloudFunction('upload', {
              fileContent: base64Data,
              cloudPath: cloudPath
            }).then((uploadRes) => {
              uni.hideLoading();
              console.log('H5环境编辑作品集封面图片上传结果:', uploadRes);
              if (uploadRes && uploadRes.result && uploadRes.result.fileID) {
                resolve(uploadRes.result.fileID);
              } else {
                console.error('H5环境编辑作品集封面图片上传失败:', uploadRes);
                reject(new Error('上传失败'));
              }
            }).catch((uploadErr) => {
              uni.hideLoading();
              console.error('H5环境编辑作品集封面图片上传云函数调用失败:', uploadErr);
              reject(uploadErr);
            });
          })
          .catch((err) => {
            uni.hideLoading();
            console.error('H5环境编辑作品集封面图片base64转换失败:', err);
            reject(err);
          });
        // #endif

        // #ifndef H5
        // 非H5环境（如小程序）：使用uni.getFileSystemManager
        uni.getFileSystemManager().readFile({
          filePath: this.editingFolderCover,
          encoding: 'base64',
          success: (readRes) => {
            console.log('非H5环境编辑作品集封面图片base64读取成功');
            
            // 调用云函数上传
            this.callCloudFunction('upload', {
              fileContent: readRes.data,
              cloudPath: cloudPath
            }).then((uploadRes) => {
              uni.hideLoading();
              console.log('非H5环境编辑作品集封面图片上传结果:', uploadRes);
              if (uploadRes && uploadRes.result && uploadRes.result.fileID) {
                resolve(uploadRes.result.fileID);
              } else {
                console.error('非H5环境编辑作品集封面图片上传失败:', uploadRes);
                reject(new Error('上传失败'));
              }
            }).catch((uploadErr) => {
              uni.hideLoading();
              console.error('非H5环境编辑作品集封面图片上传云函数调用失败:', uploadErr);
              reject(uploadErr);
            });
          },
          fail: (readErr) => {
            uni.hideLoading();
            console.error('非H5环境编辑作品集封面图片base64读取失败:', readErr);
            reject(readErr);
          }
        });
        // #endif
      });
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

      uni.showModal({
        title: '确认删除',
        content: `确定要删除作品集"${folder.name}"吗？里面的作品不会被删除。`,
        success: async (res) => {
          if (res.confirm) {
            try {
              uni.showLoading({ title: '删除中...' });
              const result = await this.callCloudFunction('deletePortfolio', {
                portfolioId: folder._id
              });

              if (result.result && result.result.success) {
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
              } else {
                uni.showToast({
                  title: result.result?.message || '删除失败',
                  icon: 'none'
                });
              }
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
  min-height: 100vh;
  background: #fff;
  display: flex;
  flex-direction: column;
  /* #ifdef APP-PLUS */
  padding-top: var(--status-bar-height);
  /* #endif */
}

.header {
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  padding: 20rpx 30rpx;
  background: #fff;
  border-bottom: 1rpx solid #e9ecef;
}

.header-left {
  position: absolute;
  left: 30rpx;
  width: 60rpx;
  height: 60rpx;
  display: flex;
  align-items: center;
  justify-content: center;
}

.back-icon-image {
  width: 72rpx;
  height: 72rpx;
  margin-top: 4rpx;
}

.header-title {
  font-size: 36rpx;
  font-weight: 600;
  color: #333;
}

.header-right {
  position: absolute;
  right: 30rpx;
  width: 100rpx;
  display: flex;
  justify-content: flex-end;
  align-items: center;
}

.create-btn-icon {
  width: 72rpx;
  height: 72rpx;
  margin-top: 4rpx;
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
  border-bottom: 1rpx solid #f0f0f0;
  width: 100%;
  box-sizing: border-box;
  margin-right: 0;
  padding-right: 0;
  position: relative;
  background-color: #ffffff;
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
  background: #D9D9D9;
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

.folder-default-icon {
  font-size: 40rpx;
}

.folder-info {
  display: flex;
  flex-direction: column;
  gap: 8rpx;
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
  color: #333333;
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
  border: 2rpx dashed #e0e0e0;
  border-radius: 12rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: #f8f9fa;
}

.upload-icon {
  font-size: 48rpx;
  color: #999;
  margin-bottom: 8rpx;
}

.upload-text {
  font-size: 24rpx;
  color: #666;
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