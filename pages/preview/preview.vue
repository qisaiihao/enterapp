<template>
  <view class="preview-page white-bg" @tap="onPageTap">
    <view class="square-mode-container">
      <view v-if="!post" class="empty-state">
        <view class="empty-icon">🕐</view>
        <view class="empty-text">正在准备预览…</view>
      </view>

      <view v-else id="post-list-container">
        <!-- 诗歌模式：使用折叠卡片样式（与poem-square完全一致） -->
        <view v-if="post.editData && post.editData.publishMode === 'poem'" class="post-item-wrapper" :style="{ backgroundColor: post.backgroundColor }">
          <view class="post-content-navigator" @tap="togglePostExpansion">
            <view class="post-item" :style="{ backgroundColor: post.backgroundColor }">
              <view :class="'post-content ' + (post.isExpanded ? 'expanded' : 'collapsed')" :style="{ color: post.textColor || '#222', whiteSpace: 'pre-wrap' }">
                <block v-if="post.isExpanded">
                  {{ post.content }}
                </block>
                <block v-else>
                  <!-- 折叠状态下只显示高光行 -->
                  <block v-if="post.highlightLines && post.highlightLines.length > 0">
                    <text v-for="(highlightLine, index) in post.highlightLines" :key="'line-' + index" style="font-weight: 700; display: block;">{{ highlightLine }}</text>
                  </block>
                  <block v-else>
                    {{ post.content }}
                  </block>
                </block>
              </view>

              <!-- 作者签名 - 只在展开时显示 -->
              <view v-if="post.isExpanded && post.authorSignature" class="user-signature">
                <image class="signature-image" :src="post.authorSignature" mode="aspectFit" @error="onSignatureError" @load="onSignatureLoad"></image>
              </view>
            </view>
          </view>

          <!-- 交互区（展开时显示） -->
          <view class="vote-section" v-if="post.isExpanded" :style="{ backgroundColor: post.backgroundColor }">
            <view class="actions-left">
              <view class="like-icon-container" @tap.stop.prevent="onVote">
                <image class="like-icon" :src="post.likeIcon || '/static/images/seed.png'" mode="aspectFit" @error="onLikeIconError" />
              </view>
              <view class="comment-count" @tap.stop.prevent="onCommentClick">
                <text class="comment-emoji">💬</text>
              </view>
            </view>
            <view class="button-group"><!-- 预留 --></view>
          </view>
        </view>

        <!-- 普通帖子和讨论帖子：使用index页面样式 -->
        <view v-else class="post-item-wrapper normal-mode">
          <!-- 作者信息 -->
          <view class="author-info-outside">
            <image
              class="author-avatar"
              src="/static/images/avatar.png"
              mode="aspectFill"
            ></image>
            <text class="author-name">{{ getCurrentUserName() }}</text>
          </view>

          <!-- 内容区域 -->
          <view class="post-item">
            <!-- 标题 -->
            <view class="post-title" v-if="post.title">{{ post.title }}</view>

            <!-- 诗歌作者信息（如果是诗歌模式但显示为普通帖子） -->
            <view v-if="post.editData && post.editData.publishMode === 'poem' && post.author" class="poem-author">{{ post.author }}</view>

            <!-- 图片显示 -->
            <view v-if="post.imageUrls && post.imageUrls.length > 0" class="image-container-wrapper">
              <block v-if="post.imageUrls.length === 1">
                <image
                  class="post-image"
                  :src="post.imageUrls[0]"
                  mode="aspectFill"
                />
              </block>
              <block v-else-if="post.imageUrls.length > 1">
                <swiper class="image-swiper" :indicator-dots="true" :circular="true">
                  <block v-for="(img, index) in post.imageUrls" :key="index">
                    <swiper-item>
                      <image
                        class="post-image"
                        :src="img"
                        mode="aspectFill"
                      />
                    </swiper-item>
                  </block>
                </swiper>
              </block>
            </view>

            <!-- 内容 -->
            <view class="post-content" v-if="post.content" style="white-space: pre-wrap">{{ post.content }}</view>

            <!-- 标签 -->
            <view v-if="post.editData && post.editData.selectedTags && post.editData.selectedTags.length > 0" class="post-tags">
              <text class="post-tag" v-for="(tag, index) in post.editData.selectedTags" :key="index">#{{ tag }}</text>
            </view>
          </view>

          <!-- 互动区域 -->
          <view class="vote-section">
            <view class="actions-left">
              <!-- 左侧留空 -->
            </view>
            <view class="button-group">
              <view class="comment-count">
                <text class="action-emoji">💬</text>
                <text class="action-text">0</text>
              </view>
              <view class="like-icon-container">
                <image class="like-icon" src="/static/images/seed.png" mode="aspectFit"></image>
              </view>
              <view class="vote-count">
                <text class="action-text">0</text>
              </view>
            </view>
          </view>
        </view>

        <!-- 标题输入区域 -->
        <view class="title-input-section" @tap.stop="noop">
          <view class="title-input-wrapper">
            <input
              class="title-input"
              placeholder="想个标题..."
              @input="onTitleInput"
              @tap.stop="noop"
              maxlength="50"
              :value="post.title"
            />
          </view>
        </view>

        <!-- 作者输入区域（诗歌模式显示） -->
        <view v-if="post.editData && post.editData.publishMode === 'poem'" class="author-input-section" @tap.stop="noop">
          <view class="author-input-wrapper">
            <input
              class="author-input"
              :placeholder="post.editData.isOriginal ? '作者（默认使用昵称）' : '作者（必填）'"
              @input="onAuthorInput"
              @tap.stop="noop"
              maxlength="20"
              :value="post.author"
            />
          </view>
        </view>
      </view>
    </view>

    <!-- 底部按钮组 -->
    <view class="bottom-buttons" style="border-top: none !important;">
      <view class="button-item" @tap.stop="goBack">
        <image class="button-icon" src="/static/images/back_to_edit.png" mode="aspectFit"></image>
      </view>
      <view class="button-item" @tap.stop="deletePost">
        <image class="button-icon" src="/static/images/delete.png" mode="aspectFit"></image>
      </view>
      <view class="button-item" @tap.stop="saveDraft">
        <image class="button-icon" src="/static/images/save_draft.png" mode="aspectFit"></image>
      </view>
      <view class="button-item" @tap.stop="goToPublish">
        <image class="button-icon" src="/static/images/publish.png" mode="aspectFit"></image>
      </view>
    </view>
  </view>
</template>

<script>
export default {
  data() {
    return {
      post: null,
      backgroundColors: ['#a4c4bd', '#c9cfcf', '#906161', '#909388'],
      lastUsedColorIndex: -1
    };
  },
  onLoad() {
    try {
      const eventChannel = this.getOpenerEventChannel && this.getOpenerEventChannel();
      if (eventChannel && eventChannel.on) {
        eventChannel.on('preview-data', ({ post }) => {
          this.post = post;
          console.log('【Preview】收到数据:', post);
          console.log('【Preview】publishMode:', post.editData?.publishMode);

          // 为诗歌模式设置背景色
          if (post.editData && post.editData.publishMode === 'poem') {
            // 使用add页面选择的背景色和文字颜色搭配
            if (post.editData.selectedColorCombination) {
              post.backgroundColor = post.editData.selectedColorCombination.backgroundColor;
              post.textColor = post.editData.selectedColorCombination.textColor;
              console.log('【Preview】使用选择的颜色搭配:', post.editData.selectedColorCombination);
            } else if (post.editData.selectedBackgroundColor) {
              // 兼容旧版本数据
              post.backgroundColor = post.editData.selectedBackgroundColor;
              post.textColor = post.editData.selectedTextColor || '#333333';
              console.log('【Preview】使用兼容模式背景色:', post.backgroundColor);
            } else {
              // 如果没有选择，使用默认色
              post.backgroundColor = '#a4c4bd';
              post.textColor = '#333333';
              console.log('【Preview】使用默认颜色');
            }
          }

          // 初始化折叠状态为false（默认折叠）
          this.post.isExpanded = false;
        });
      }
    } catch (e) {}
    if (!this.post) {
      try {
        const cached = uni.getStorageSync('preview_post');
        if (cached) {
          this.post = cached;
          console.log('【Preview】从缓存获取数据:', cached);
          console.log('【Preview】缓存publishMode:', cached.editData?.publishMode);

          // 为诗歌模式设置背景色
          if (cached.editData && cached.editData.publishMode === 'poem') {
            // 使用add页面选择的背景色和文字颜色搭配
            if (cached.editData.selectedColorCombination) {
              this.post.backgroundColor = cached.editData.selectedColorCombination.backgroundColor;
              this.post.textColor = cached.editData.selectedColorCombination.textColor;
              console.log('【Preview】缓存使用选择的颜色搭配:', cached.editData.selectedColorCombination);
            } else if (cached.editData.selectedBackgroundColor) {
              // 兼容旧版本数据
              this.post.backgroundColor = cached.editData.selectedBackgroundColor;
              this.post.textColor = cached.editData.selectedTextColor || '#333333';
              console.log('【Preview】缓存使用兼容模式背景色:', this.post.backgroundColor);
            } else {
              this.post.backgroundColor = '#a4c4bd';
              this.post.textColor = '#333333';
              console.log('【Preview】缓存使用默认颜色');
            }
          }
        }
      } catch (_) {}
    }
    if (!this.post) {
      this.post = { content: '（预览为空）', textColor: '#000', backgroundColor: '#fff' };
    }

    // 确保折叠状态被初始化
    if (this.post && typeof this.post.isExpanded === 'undefined') {
      this.post.isExpanded = false;
    }

    // 确保作者字段被初始化（用于诗歌模式）
    if (this.post && this.post.editData && this.post.editData.author) {
      this.post.author = this.post.editData.author;
    }

    // 调试：确保editData结构完整
    if (this.post && this.post.editData) {
      console.log('【Preview】最终editData:', this.post.editData);
      console.log('【Preview】publishMode最终值:', this.post.editData.publishMode);
      console.log('【Preview】是否应该显示诗歌模式:', this.post.editData.publishMode === 'poem');
      console.log('【Preview】最终背景色:', this.post.backgroundColor);
    }
  },
  methods: {
    // 页面点击事件 - 点击外部区域退出键盘
    onPageTap() {
      uni.hideKeyboard();
    },

    // 空函数，用于阻止事件冒泡
    noop() {},

    // 切换文章展开/折叠状态
    togglePostExpansion() {
      if (this.post) {
        this.post.isExpanded = !this.post.isExpanded;
      }
    },

    // 标题输入处理
    onTitleInput(event) {
      if (this.post) {
        this.post.title = event.detail.value;
      }
    },

    // 作者输入处理
    onAuthorInput(event) {
      if (this.post) {
        this.post.author = event.detail.value;
      }
    },

    // 获取当前用户名
    getCurrentUserName() {
      try {
        const userInfo = uni.getStorageSync('userInfo');
        return userInfo ? userInfo.nickName : '匿名用户';
      } catch (e) {
        return '匿名用户';
      }
    },
    goToPublish() {
      // 从发布页面获取数据并进行发布
      this.publishFromAddPage();
    },
    goBack() {
      // 返回编辑页面
      uni.navigateBack();
    },
    
    // 删除帖子
    deletePost() {
      uni.showModal({
        title: '确认删除',
        content: '确定要删除这个帖子吗？',
        confirmText: '删除',
        cancelText: '取消',
        confirmColor: '#ff4757',
        success: (res) => {
          if (res.confirm) {
            // 清除预览数据
            try {
              uni.removeStorageSync('preview_post');
            } catch (e) {
              console.error('清除预览数据失败:', e);
            }
            
            // 返回编辑页面
            uni.navigateBack();
            
            uni.showToast({
              title: '已删除',
              icon: 'success'
            });
          }
        }
      });
    },
    
    // 存草稿
    saveDraft() {
      if (!this.post) {
        uni.showToast({
          title: '没有内容可保存',
          icon: 'none'
        });
        return;
      }
      
      try {
        // 保存草稿到本地存储
        const draftData = {
          ...this.post,
          saveTime: new Date().getTime(),
          isDraft: true
        };
        
        // 获取现有草稿列表
        let drafts = [];
        try {
          const existingDrafts = uni.getStorageSync('drafts');
          if (existingDrafts && Array.isArray(existingDrafts)) {
            drafts = existingDrafts;
          }
        } catch (e) {
          console.log('获取草稿列表失败，创建新列表');
        }
        
        // 添加新草稿
        drafts.unshift(draftData);
        
        // 限制草稿数量（最多保存10个）
        if (drafts.length > 10) {
          drafts = drafts.slice(0, 10);
        }
        
        // 保存草稿列表
        uni.setStorageSync('drafts', drafts);
        
        uni.showToast({
          title: '草稿已保存',
          icon: 'success'
        });
        
        // 返回编辑页面
        setTimeout(() => {
          uni.navigateBack();
        }, 1500);
        
      } catch (e) {
        console.error('保存草稿失败:', e);
        uni.showToast({
          title: '保存失败',
          icon: 'none'
        });
      }
    },
    // 从发布页面获取数据并发布
    publishFromAddPage() {
      const pages = getCurrentPages();
      const addPage = pages[pages.length - 2]; // 获取发布页面

      if (!addPage || !addPage.$vm) {
        uni.showToast({
          title: '获取发布数据失败',
          icon: 'none'
        });
        return;
      }

      // 获取add页面的数据，Vue实例就是数据容器
      const addData = addPage.$vm;

      // 检查addData是否有效
      if (!addData) {
        console.error('【preview】addPage.$vm为空或undefined');
        uni.showToast({
          title: '发布数据获取失败',
          icon: 'none'
        });
        return;
      }

      // 调试：输出addData的关键信息
      console.log('【preview】获取到的addData信息:', {
        hasAddData: !!addData,
        content: addData.content,
        imageList: addData.imageList,
        publishMode: addData.publishMode,
        isOriginal: addData.isOriginal,
        selectedTags: addData.selectedTags,
        author: addData.author,
        highlightLines: addData.highlightLines,
        highlightSelectedLineIndices: addData.highlightSelectedLineIndices
      });

      const hasTitle = this.post && this.post.title && this.post.title.trim();
      const hasContent = addData.content && addData.content.trim();
      const hasImages = addData.imageList && Array.isArray(addData.imageList) && addData.imageList.length > 0;

      if (!hasTitle && !hasContent && !hasImages) {
        uni.showToast({
          title: '请至少上传图片或输入内容',
          icon: 'none'
        });
        return;
      }

      if (hasTitle && !hasContent) {
        uni.showToast({
          title: '请输入正文内容',
          icon: 'none'
        });
        return;
      }

      // 如果是非原创诗歌，必须填写作者
      if (addData.publishMode === 'poem' && !addData.isOriginal) {
        const hasAuthor = this.post && this.post.author && this.post.author.trim();
        if (!hasAuthor) {
          uni.showToast({
            title: '非原创诗歌必须填写作者',
            icon: 'none'
          });
          return;
        }
      }

      // 合并预览页面的标题和作者数据与add页面的其他数据
      const publishData = {
        ...addData,
        title: this.post.title || '',
        author: this.post.author || '',
        content: addData.content || '', // 确保content字段存在
        imageList: addData.imageList || [] // 确保imageList字段存在
      };

      // 执行发布逻辑
      this.executePublish(publishData);
    },

    // 执行发布逻辑
    executePublish(addData) {
      uni.showLoading({
        title: '发布中...'
      });

      // 如果是非原创诗歌，先检查重复
      if (addData.publishMode === 'poem' && !addData.isOriginal) {
        this.checkDuplicatePoem(addData);
      } else {
        // 直接发布
        const hasImages = addData.imageList && Array.isArray(addData.imageList) && addData.imageList.length > 0;
        if (hasImages) {
          this.uploadImagesAndSubmit(addData);
        } else {
          this.submitTextOnly(addData);
        }
      }
    },

    // 检查重复诗歌
    checkDuplicatePoem(addData) {
      const { cloudCall } = require('../../utils/cloudCall.js');

      cloudCall('checkDuplicatePoem', {
        title: addData.title.trim(),
        author: addData.author.trim(),
        isOriginal: addData.isOriginal
      }, { pageTag: 'preview', context: this, requireAuth: true }).then((res) => {
        uni.hideLoading();
        if (res.result && res.result.success) {
          if (res.result.isDuplicate) {
            // 发现重复，显示确认对话框
            this.showDuplicateConfirmDialog(res.result.duplicateCount, addData);
          } else {
            // 没有重复，直接发布
            this.proceedWithPublish(addData);
          }
        } else {
          uni.showToast({
            title: '检查失败，请重试',
            icon: 'none'
          });
        }
      }).catch((err) => {
        uni.hideLoading();
        console.error('检查重复失败:', err);
        uni.showToast({
          title: '网络错误，请重试',
          icon: 'none'
        });
      });
    },

    // 显示重复确认对话框
    showDuplicateConfirmDialog(duplicateCount, addData) {
      uni.showModal({
        title: '发现重复诗歌',
        content: `已有 ${duplicateCount} 篇相同的诗歌发布，是否继续发布？`,
        confirmText: '继续发布',
        cancelText: '取消发布',
        success: (res) => {
          if (res.confirm) {
            // 用户选择继续发布
            this.proceedWithPublish(addData);
          } else {
            // 用户选择取消发布
            console.log('用户取消发布重复诗歌');
          }
        }
      });
    },

    // 继续发布流程
    proceedWithPublish(addData) {
      uni.showLoading({
        title: '发布中...'
      });
      const hasImages = addData.imageList && Array.isArray(addData.imageList) && addData.imageList.length > 0;
      if (hasImages) {
        this.uploadImagesAndSubmit(addData);
      } else {
        this.submitTextOnly(addData);
      }
    },

    // 上传图片并提交
    uploadImagesAndSubmit(addData) {
      const { cloudCall } = require('../../utils/cloudCall.js');

      // 模拟上传过程（这里需要实际的文件上传逻辑）
      setTimeout(() => {
        this.submitToDatabase(addData, []);
      }, 1000);
    },

    // 仅提交文本
    submitTextOnly(addData) {
      this.submitToDatabase(addData, []);
    },

    // 提交到数据库
    submitToDatabase(addData, uploadResults) {
      const { cloudCall } = require('../../utils/cloudCall.js');

      // 确定作者信息
      let authorName = '';
      if (addData.publishMode === 'poem') {
        if (addData.isOriginal) {
          const userInfo = uni.getStorageSync('userInfo');
          const userNickName = userInfo ? userInfo.nickName : '匿名用户';
          authorName = addData.author && addData.author.trim() ? addData.author.trim() : userNickName;
        } else {
          authorName = addData.author && addData.author.trim() ? addData.author.trim() : '';
        }
      }

      // 准备提交数据
      const postData = {
        title: addData.title,
        content: addData.content,
        createTime: new Date(),
        votes: 0,
        isPoem: addData.publishMode === 'poem',
        isOriginal: addData.isOriginal,
        author: authorName,
        tags: addData.selectedTags || []
      };

      if (uploadResults.length > 0) {
        const imageUrls = uploadResults.map((result) => result.compressedUrl);
        const originalImageUrls = uploadResults.map((result) => result.originalUrl);

        postData.imageUrl = imageUrls[0];
        postData.imageUrls = imageUrls;
        postData.originalImageUrl = originalImageUrls[0];
        postData.originalImageUrls = originalImageUrls;
      }

      // 调用云函数提交数据
      cloudCall('contentCheck', {
        title: addData.title,
        content: addData.content,
        fileIDs: uploadResults.map(r => r.compressedUrl).filter(url => url),
        originalFileIDs: uploadResults.map(r => r.originalUrl).filter(url => url),
        publishMode: addData.publishMode,
        isOriginal: addData.isOriginal,
        isDiscussion: addData.isDiscussion || false,
        author: addData.author,
        tags: addData.selectedTags || [],
        // 添加颜色信息
        backgroundColor: addData.selectedBackgroundColor || '',
        textColor: addData.selectedTextColor || '#000000',
        // 添加高光行信息
        highlightLines: addData.highlightLines || []
      }, { pageTag: 'preview', context: this, requireAuth: true }).then((res) => {
        if (res && res.result && res.result.code === 0) {
          this.publishSuccess({
            _id: res.result.postId
          });
        } else {
          this.publishFail(new Error(res.result?.msg || '云函数返回失败'));
        }
      }).catch((err) => {
        console.error('数据库提交失败:', err);
        this.publishFail(err);
      });
    },

    // 发布成功
    publishSuccess(res) {
      uni.hideLoading();
      uni.showToast({
        title: '发布成功！'
      });

      // 触发全局事件，通知所有页面刷新缓存
      try {
        const { emitPostCreated } = require('../../utils/events.js');
        emitPostCreated(); // 触发新帖子创建事件，刷新所有相关缓存
        console.log('【Preview】已触发 POST_CREATED 事件');
      } catch (e) {
        console.error('触发POST_CREATED事件失败:', e);
      }

      // 设置各页面需要刷新标记（备用机制）
      try {
        uni.setStorageSync('shouldRefreshIndex', true);
        uni.setStorageSync('shouldRefreshProfile', true);
        uni.setStorageSync('shouldRefreshPoem', true);
        uni.setStorageSync('shouldRefreshMountain', true);
      } catch (e) {
        console.error('设置刷新标记失败:', e);
      }

      // 清除发布页面的草稿
      try {
        const pages = getCurrentPages();
        const addPage = pages[pages.length - 2];
        if (addPage && addPage.$vm && addPage.$vm.clearDraft) {
          addPage.$vm.clearDraft();
        }
      } catch (e) {
        console.error('清除草稿失败:', e);
      }

      // 返回首页
      uni.switchTab({
        url: '/pages/index/index'
      });
    },

    // 发布失败
    publishFail(err) {
      uni.hideLoading();
      console.error('发布失败:', err);

      let errorMessage = '发布失败';
      if (err && err.message) {
        errorMessage = `发布失败: ${err.message}`;
      } else if (err && err.errMsg) {
        errorMessage = `发布失败: ${err.errMsg}`;
      }

      uni.showModal({
        title: '发布失败',
        content: errorMessage,
        showCancel: false,
        confirmText: '确定'
      });
    }
  }
};
</script>

<style>
.white-bg {
  background: #fff;
  min-height: 100vh;
  position: relative;
  padding-bottom: 0; /* 确保没有底部padding影响固定按钮 */
}

.square-mode-container {
  padding: 40rpx;
  margin-bottom: 0; /* 移除margin-bottom，让固定按钮真正固定 */
  padding-top: 100rpx; /* 增加顶部边距，与屏幕顶部保持距离 */
  padding-bottom: 200rpx; /* 增加底部padding，为固定按钮留出足够空间 */
}

/* 底部按钮组 */
.preview-page .bottom-buttons {
  position: fixed !important;
  bottom: 0 !important;
  left: 0 !important;
  right: 0 !important;
  background: #fff !important;
  padding: 30rpx 40rpx calc(60rpx + env(safe-area-inset-bottom)) 40rpx !important;
  display: flex !important;
  justify-content: space-around !important;
  align-items: center !important;
  z-index: 9999 !important; /* 提高z-index确保在所有元素之上 */
  border-top: none !important; /* 强制移除上边框 */
  box-shadow: 0 -2rpx 10rpx rgba(0, 0, 0, 0.1) !important; /* 添加阴影效果 */
}

.bottom-buttons {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  background: #fff;
  padding: 30rpx 40rpx calc(60rpx + env(safe-area-inset-bottom)) 40rpx;
  display: flex;
  justify-content: space-around;
  align-items: center;
  z-index: 9999; /* 提高z-index确保在所有元素之上 */
  border-top: none !important; /* 强制移除上边框 */
  box-shadow: 0 -2rpx 10rpx rgba(0, 0, 0, 0.1); /* 添加阴影效果 */
}

.button-item {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20rpx;
  min-width: 120rpx;
  transition: all 0.2s ease;
}

.button-item:active {
  transform: scale(0.9);
  opacity: 0.8;
}

.preview-page .bottom-buttons .button-item .button-icon {
  width: 100rpx !important;
  height: 100rpx !important;
}

.bottom-buttons .button-icon {
  width: 100rpx !important;
  height: 100rpx !important;
}
.empty-state { text-align: center; padding: 100rpx 0; color: #999; }
.empty-icon { font-size: 80rpx; margin-bottom: 20rpx; }
.empty-text { font-size: 32rpx; color: #666; }
.post-item-wrapper { border-radius: 40rpx; overflow: hidden; border: 1rpx solid #e9ecef; box-shadow: 0 12rpx 15rpx rgba(0,0,0,0.20); transition: transform .3s ease; }
.post-item-wrapper:active { transform: scale(0.98); }
.post-content-navigator { display: block; cursor: pointer; }
.post-item { padding: 40rpx 50rpx; position: relative; }
.post-content { font-size: 32rpx; line-height: 1.6; margin: 30rpx 0; width: 100%; }
/* 折叠态：多端兼容的三行裁切 */
.post-content.collapsed {
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 3;
  overflow: hidden;
  text-overflow: ellipsis;
}
.post-content.expanded { display: block; overflow: visible; }
.user-signature { position: absolute; bottom: -25rpx; right: 60rpx; z-index: 10; pointer-events: none; }
.signature-image { width: 180rpx; height: 90rpx; opacity: 0.8; filter: drop-shadow(0 2rpx 4rpx rgba(0,0,0,0.1)); display: block; background: transparent; }

/* 标题输入区域样式 */
.title-input-section {
  margin-top: 30rpx;
  padding: 0 20rpx;
}

.title-input-wrapper {
  background: #fff;
  border-bottom: 2rpx solid #333;
  padding: 0 0 0rpx 0;
  position: relative;
  width: 80%;
  margin-right: auto;
}

.title-input {
  width: 100%;
  height: 60rpx;
  border: none;
  font-size: 28rpx;
  background: transparent;
  outline: none;
  color: #333;
  line-height: 1;
}

.title-input:focus {
  border-bottom: none;
}

/* 作者输入区域样式 */
.author-input-section {
  margin-top: 40rpx;
  padding: 0 20rpx;
}

.author-input-wrapper {
  background: #fff;
  border-bottom: 2rpx solid #333;
  padding: 0 0 8rpx 0;
  position: relative;
  width: 80%;
  margin-right: auto;
}

.author-input {
  width: 100%;
  height: 60rpx;
  border: none;
  font-size: 28rpx;
  background: transparent;
  outline: none;
  color: #333;
  line-height: 1;
}

.author-input:focus {
  border-bottom: none;
}

/* 适配从发布页浮动按钮的层级 */
.preview-page { position: relative; z-index: 1; }

/* 诗歌帖子的样式（与poem-square完全一致） */
.post-item-wrapper {
  border-radius: 40rpx;
  margin-bottom: 60rpx;
  overflow: hidden;
  border: 1rpx solid #e9ecef;
  box-shadow: 0 12rpx 15rpx rgba(0,0,0,0.20);
  transition: transform .3s ease;
}
.post-item-wrapper:active { transform: scale(0.98); }
.post-content-navigator { display: block; }
.post-item { padding: 40rpx 50rpx; position: relative; }
.post-content { font-size: 32rpx; line-height: 1.6; margin: 30rpx 0; width: 100%; }
/* 折叠态：多端兼容的三行裁切 */
.post-content.collapsed {
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 3;
  overflow: hidden;
  text-overflow: ellipsis;
}
.post-content.expanded { display: block; overflow: visible; }
.comment-emoji{ font-size: 40rpx; }
.vote-section { display: flex; justify-content: space-between; align-items: center; padding: 25rpx 50rpx; }
.actions-left { flex: 1; display: flex; align-items: center; gap: 20rpx; }
.button-group { display: flex; align-items: center; gap: 30rpx; }
.comment-count { display: flex; align-items: center; gap: 8rpx; padding: 10rpx 15rpx; }
.vote-count { display: flex; align-items: center; gap: 8rpx; padding: 10rpx 15rpx; border-radius: 20rpx; background: rgba(255,255,255,.9); box-shadow: 0 2rpx 8rpx rgba(0,0,0,.1); }
.comment-icon { width: 80rpx; height: 80rpx; }
.like-icon { width: 60rpx; height: 60rpx; margin-top: 5px; }

/* 用户签名样式 */
.user-signature {
  position: absolute;
  bottom: -25rpx; /* 从15rpx往下移动40rpx */
  right: 60rpx;
  z-index: 10;
  pointer-events: none; /* 防止签名影响点击事件 */
}

.signature-image {
  width: 180rpx;
  height: 90rpx;
  opacity: 0.8; /* 稍微透明，不抢夺主要内容的注意力 */
  filter: drop-shadow(0 2rpx 4rpx rgba(0, 0, 0, 0.1)); /* 添加轻微阴影 */
  display: block; /* 确保图片正确显示 */
  background: transparent; /* 确保背景透明 */
}

/* 普通帖子和讨论帖子的样式（从index页面复制） */
.post-item-wrapper.normal-mode {
  background: #fff;
  margin-bottom: 20rpx;
  padding: 0;
  box-shadow: none;
  border-radius: 0;
  border-bottom: 1rpx solid #f0f0f0;
}

.author-info-outside {
  display: flex;
  align-items: center;
  padding: 20rpx 40rpx 10rpx 40rpx;
  background: #fff;
}

.author-info-outside .author-avatar {
  width: 60rpx;
  height: 60rpx;
  border-radius: 50%;
  margin-right: 15rpx;
  background-color: #f5f5f5;
}

.author-info-outside .author-name {
  font-size: 28rpx;
  color: #333;
  font-weight: 500;
}

.post-item {
  width: 100%;
  background: #fff;
  box-shadow: none;
  box-sizing: border-box;
  padding: 20rpx 40rpx 30rpx 40rpx;
}

.post-title {
  font-size: 36rpx;
  font-weight: bold;
  color: #333333;
  margin-bottom: 15rpx;
  line-height: 1.4;
  word-break: break-word;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
}

.poem-author {
  font-size: 32rpx;
  color: #000;
  text-align: center;
  margin: 5rpx 0 15rpx 0;
  letter-spacing: 2rpx;
}

.post-content {
  font-size: 28rpx;
  color: #666666;
  line-height: 1.6;
  margin-top: 15rpx;
  word-break: break-word;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  line-clamp: 3;
  -webkit-box-orient: vertical;
}

.vote-section {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: -8rpx;
  padding: 0 60rpx 0 60rpx;
}

.actions-left {
  display: flex;
  align-items: center;
}

.button-group {
  display: flex;
  align-items: center;
}

.comment-count {
  display: flex;
  align-items: center;
  font-size: 28rpx;
  color: #999;
  margin-left: 10rpx;
  transition: color 0.2s ease;
}

.action-emoji {
  font-size: 28rpx;
  margin-right: 8rpx;
}

.action-text {
  font-size: 28rpx;
  color: inherit;
}

.like-icon-container {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 8rpx;
  border-radius: 8rpx;
  margin-left: 20rpx;
  transition: all 0.2s ease;
}

.like-icon-container:active {
  transform: scale(0.95);
}

.like-icon {
  width: 48rpx;
  height: 48rpx;
}

.vote-count {
  display: flex;
  align-items: center;
  font-size: 28rpx;
  color: #999;
  margin-left: 10rpx;
  transition: color 0.2s ease;
}

.image-container-wrapper {
  position: relative;
  width: 100%;
  background-color: #f0f0f0;
  overflow: hidden;
  border-radius: 8px;
  margin: 20rpx 0;
}

.image-container-wrapper .post-image,
.image-container-wrapper .image-swiper {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
}

.image-swiper {
  width: 100%;
  background-color: #fff;
}

.swiper-item {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.post-image {
  width: 100%;
  height: 100%;
  display: block;
  object-fit: contain;
}

.post-tags {
  margin-top: 30rpx;
  margin-bottom: 10rpx;
  line-height: 1.5;
}

.post-tag {
  color: #24375f;
  font-size: 26rpx;
  margin-right: 10rpx;
  transition: all 0.2s ease;
}

.post-tag:active {
  color: #1a2a4a;
  opacity: 0.8;
}

</style>
