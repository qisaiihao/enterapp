<template>
  <view class="portfolio-detail-page" @touchstart="touchStart" @touchend="touchEnd">
    <dual-action-top-bar @left-click="goBack" @right-click="openAddModal" />
    
    <view class="container">
      <!-- 加载中骨架 -->
      <view v-if="isLoading">
        <skeleton />
      </view>

      <!-- 内容列表 -->
      <scroll-view v-else class="content-scroll" scroll-y="true" @scrolltolower="loadMore">
      <view class="content-container">
        <view v-if="postList.length === 0" class="empty-state">
          <view class="empty-icon">😶</view>
          <view class="empty-text">这里还没有内容</view>
          <view class="empty-subtext">添加你的诗歌吧～</view>
        </view>

        <view v-else id="post-list-container">
          <view v-for="(item, index) in postList" :key="index" class="post-item-wrapper" :style="{ backgroundColor: item.backgroundColor }">
            <view 
            class="post-content-navigator" 
            :class="{ 'has-vote-section': item.isExpanded }"
            @tap="togglePostExpansion" 
            @longpress="onLongPressCard" 
            :data-index="index" 
            :data-postid="item._id"
          >
              <view class="post-item">
                <view :class="'post-content ' + (item.isExpanded ? 'expanded' : 'collapsed') + (!item.isExpanded && (!item.highlightLines || item.highlightLines.length === 0) ? ' no-highlight' : '')" v-if="item.content" :style="{ color: item.textColor, whiteSpace: 'pre-wrap' }">
                  <block v-if="item.isExpanded">
                    {{ item.content }}
                  </block>
                  <block v-else>
                    <!-- 折叠状态下只显示高光行 -->
                    <block v-if="item.highlightLines && item.highlightLines.length > 0">
                      <text v-for="(highlightLine, index) in item.highlightLines" :key="index" style="font-weight: 700; display: block;">{{ highlightLine }}</text>
                    </block>
                    <block v-else>
                      {{ item.content }}
                    </block>
                  </block>
                </view>

                <!-- 作者签名 - 展开时显示大签名 -->
                <view v-if="item.isExpanded && item.authorSignature" class="user-signature">
                  <image class="signature-image" :src="item.authorSignature" mode="aspectFit" @error="onSignatureError" @load="onSignatureLoad"></image>
                </view>

                <!-- 作者签名 - 折叠时显示小签名 -->
                <view v-if="!item.isExpanded && item.authorSignature" class="user-signature-small">
                  <image class="signature-image-small" :src="item.authorSignature" mode="aspectFit" @error="onSignatureError" @load="onSignatureLoad"></image>
                </view>
              </view>
            </view>

            <!-- 交互区（展开时显示） -->
            <view class="vote-section" v-if="item.isExpanded" :style="{ backgroundColor: item.backgroundColor }">
              <view class="actions-left"><!-- 预留左侧空间 --></view>
              <view class="button-group">
                <view class="delete-icon-container" @tap.stop.prevent="onDeleteFromPortfolio" :data-portfolioid="item.portfolioId" :data-index="index">
                  <image class="delete-icon" src="/static/images/delete.png" mode="aspectFit" />
                </view>
              </view>
            </view>
          </view>
        </view>

        <!-- 底部加载/结束提示 -->
        <view class="loading-footer">
          <block v-if="!hasMore && postList.length > 0"><text>—— 到底啦 ——</text></block>
        </view>
      </view>
    </scroll-view>
    </view>

    <!-- 顶部提示（用于调试滑动预加载阈值） -->
    <view v-if="showPageIndicator" class="page-indicator"></view>

    <!-- 批量添加弹窗 -->
    <view v-if="showAddModal" class="modal-overlay" @tap="hideAddModal">
      <view class="modal-content" @tap.stop>
        <view class="modal-header">
          <text class="modal-title">批量添加作品</text>
          <text class="close-btn" @tap="hideAddModal">×</text>
        </view>
        <view class="modal-body">
          <text class="tip-text">从您的原创诗歌中选择要添加到作品集的内容</text>
          <view class="my-posts-section">
            <text class="section-title">我的原创诗歌</text>
            <scroll-view class="posts-list" scroll-y="true">
              <view v-if="myPostsLoading" class="loading-small">
                <text>加载中...</text>
              </view>
              <view v-else-if="myPosts.length === 0" class="empty-small">
                <text>暂无原创诗歌</text>
              </view>
              <view v-else class="posts-list-simple">
                <view
                  v-for="post in myPosts"
                  :key="post._id"
                  class="post-item-simple"
                  :class="{ selected: selectedPostIds.includes(post._id) }"
                  @tap="toggleSelectPost(post)"
                >
                  <view class="post-content-simple">
                    <text class="post-title-simple">{{ post.title || '无标题' }}</text>
                    <text class="post-date-simple">{{ formatDate(post.createTime) }}</text>
                  </view>
                  <view v-if="selectedPostIds.includes(post._id)" class="selected-check-simple">
                    <text>✓</text>
                  </view>
                </view>
              </view>
            </scroll-view>
          </view>
        </view>
        <view class="modal-footer">
          <button class="modal-btn cancel" @tap="hideAddModal">取消</button>
          <button class="modal-btn confirm" @tap="addToPortfolio" :disabled="selectedPostIds.length === 0">
            添加 ({{ selectedPostIds.length }})
          </button>
        </view>
      </view>
    </view>
  </view>

</template>

<script>
import skeleton from '@/components/skeleton/skeleton';
import dualActionTopBar from '@/components/dual-action-top-bar/dual-action-top-bar.vue';
const { cloudCall } = require('@/utils/cloudCall.js');
const likeIcon = require('@/utils/likeIcon.js');
const { togglePostLike } = require('../../utils/likeService.js');
// authorSignature已从云函数返回，不再需要signatureCache

const PAGE_SIZE = 10;

export default {
  components: {
    skeleton,
    dualActionTopBar
  },
  
  onUnload() {
    try { uni.$off && this.onGlobalLikeChanged && uni.$off('like-changed', this.onGlobalLikeChanged); } catch (_) {}
  },
  data() {
    return {
      postList: [],
      page: 0,
      hasMore: true,
      isLoading: true,
      isLoadingMore: false,
      lastUsedColorIndex: -1,
      backgroundColors: ['#a4c4bd', '#c9cfcf', '#906161', '#909388'],
      showPageIndicator: false,
      votingInProgress: {},
      // portfolio-detail 特有属性
      folderId: '',
      folderName: '',
      // 批量添加相关
      showAddModal: false,
      myPosts: [],
      myPostsLoading: false,
      selectedPostIds: [],
      // 当前作品集内已有的帖子ID（用于过滤批量添加列表，避免重复）
      existingPostIds: []
    };
  },
  onLoad(options) {
    // 注册全局点赞事件
    try { uni.$on && uni.$on('like-changed', this.onGlobalLikeChanged); } catch (_) {}
    // 获取传入的文件夹ID和名称
    this.folderId = options.folderId || '';
    this.folderName = decodeURIComponent(options.folderName || '作品集');
    
    this.getIndexData();
  },
  onShow() {
    // 回到页面时，用缓存对齐当前可见帖子的点赞状态
    try { this.syncLikeStatusFromCache && this.syncLikeStatusFromCache(); } catch (_) {}
  },
  onUnload() {
    // 取消全局点赞事件监听
    try { uni.$off && this.onGlobalLikeChanged && uni.$off('like-changed', this.onGlobalLikeChanged); } catch (_) {}
  },
  onPullDownRefresh() {
    console.log('【portfolio-detail】📱 下拉刷新，重新获取数据');
    this.getIndexData(() => {
      console.log('【portfolio-detail】✅ 下拉刷新完成，停止刷新动画');
      uni.stopPullDownRefresh();
    });
  },
  onPageScroll(e) {
    if (this._scrollTimer) clearTimeout(this._scrollTimer);
    this._scrollTimer = setTimeout(() => {
      if (!this.hasMore || this.isLoadingMore || this.isLoading) return;
      try {
        const info = uni.getSystemInfoSync();
        const winH = info.windowHeight;
        uni.createSelectorQuery().in(this).select('#post-list-container').boundingClientRect((rect) => {
          if (!rect || !rect.height) return;
          const distanceToBottom = rect.height - e.scrollTop - winH;
          const preloadThreshold = winH * 1.5;
          if (distanceToBottom < preloadThreshold) {
            this.showPageIndicator = true;
            this.getPostList(() => { this.showPageIndicator = false; });
          }
        }).exec();
      } catch (_) {}
    }, 100);
  },
  methods: {
    callCloudFunction(name, data = {}, extraOptions = {}) {
      return cloudCall(name, data, Object.assign({ pageTag: 'portfolio-detail', context: this, requireAuth: true }, extraOptions));
    },
    getIndexData(callback) {
      console.log('【portfolio-detail】开始获取数据，callback:', typeof callback);
      this.setData({
        isLoading: true, 
        postList: [], 
        page: 0, 
        hasMore: true 
      });
      this.getPostList(() => { 
        console.log('【portfolio-detail】getPostList 完成，设置 isLoading: false');
        this.setData({ isLoading: false });
        if (typeof callback === 'function') {
          console.log('【portfolio-detail】执行回调函数');
          callback();
        }
      });
    },
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
    async getPostList(cb) {
      console.log('【portfolio-detail】getPostList 开始，isLoadingMore:', this.isLoadingMore, 'callback:', typeof cb);
      if (this.isLoadingMore) {
        console.log('【portfolio-detail】正在加载更多，跳过请求');
        if (typeof cb === 'function') cb();
        return;
      }
      this.setData({ isLoadingMore: true });
      try {
        // 修改云函数调用，使用 getPortfolioItems 而不是 getPostList
        const res = await this.callCloudFunction('getPortfolioItems', {
          folderId: this.folderId,
          skip: this.page * PAGE_SIZE,
          limit: PAGE_SIZE
        });
        const list = (res && res.result && res.result.portfolioItems) ? res.result.portfolioItems : [];
        console.log('【portfolio-detail】获取到作品数量:', list.length);
        
        // 优先使用本地缓存中的点赞状态，如果没有缓存则使用云函数返回的状态
        const likeSync = require('../../utils/likeStatusSync.js');
        const getLatestLikeStatus = likeSync.getLatestLikeStatus;
        
        list.forEach((p) => {
          // 优先使用数据库中保存的背景颜色，如果没有则随机生成
          p.backgroundColor = p.backgroundColor || this.generateRandomBackgroundColor();
          p.textColor = p.textColor || '#222';
          p.isExpanded = false;
          // authorSignature已从云函数返回，保留原始值（如果没有则为空字符串）
          p.authorSignature = p.authorSignature || '';
          
          // 尝试从本地缓存获取点赞状态
          const cachedStatus = getLatestLikeStatus(p._id);
          if (cachedStatus) {
            p.votes = cachedStatus.votes;
            p.isVoted = cachedStatus.isVoted;
          }
          p.likeIcon = likeIcon && likeIcon.getLikeIcon ? likeIcon.getLikeIcon(p.votes || 0, !!p.isVoted) : '';
        });
        
        // 处理分页数据，避免重复
        const newPostList = this.page === 0 ? list : (() => {
          const existingIds = new Set(this.postList.map(p => p._id));
          const uniqueNewList = list.filter(p => p && p._id && !existingIds.has(p._id));
          return this.postList.concat(uniqueNewList);
        })();
        this.setData({
          postList: newPostList,
          page: this.page + 1,
          hasMore: list.length === PAGE_SIZE
        });
        
        // authorSignature已从云函数返回，无需额外获取
        console.log('【portfolio-detail】数据处理完成');
      } catch (e) {
        console.error('【portfolio-detail】获取作品列表失败:', e);
        uni.showToast({ title: '加载失败', icon: 'none' });
      } finally {
        console.log('【portfolio-detail】设置 isLoadingMore: false，执行回调');
        this.setData({ isLoadingMore: false });
        if (typeof cb === 'function') {
          console.log('【portfolio-detail】执行回调函数');
          cb();
        }
      }
    },
    togglePostExpansion(e) {
      const index = e.currentTarget.dataset.index;
      const post = this.postList[index];
      const next = !post.isExpanded;

      this.setData({ [`postList[${index}].isExpanded`]: next });
      // authorSignature已从云函数返回，无需额外获取
    },
    onCommentClick(e) {
      const postId = e.currentTarget.dataset.postid;
      uni.navigateTo({ url: `/pages/post-detail/post-detail?id=${postId}` });
    },
    onLikeIconError() {},

    // authorSignature已从云函数返回，不再需要fetchAuthorSignature函数

    // 签名图片加载成功
    onSignatureLoad(e) {
      console.log('【portfolio-detail】签名图片加载成功:', e);
    },

    // 签名图片加载失败
    onSignatureError(e) {
      console.error('【portfolio-detail】签名图片加载失败:', e);
    },
    async onVote(e) {
      const postId = e.currentTarget.dataset.postid;
      const index = e.currentTarget.dataset.index;
      if (this.votingInProgress[postId]) return;
      this.setData({ [`votingInProgress.${postId}`]: true });
      const list = this.postList;
      const originalVotes = Number(list[index].votes) || 0;
      const wasVoted = !!list[index].isVoted;

      // 乐观更新
      const optimisticVotes = wasVoted ? Math.max(0, originalVotes - 1) : originalVotes + 1;
      list[index].votes = optimisticVotes;
      list[index].isVoted = !wasVoted;
      list[index].likeIcon = likeIcon.getLikeIcon(list[index].votes, list[index].isVoted);
      this.setData({ postList: list });

      try {
        const result = await togglePostLike(postId, {
          pageTag: 'portfolio-detail',
          context: this,
          currentVotes: originalVotes,
          currentIsLiked: wasVoted,
          requireAuth: true
        });
        if (result && result.success) {
          const updates = {};
          updates[`postList[${index}].votes`] = result.votes;
          updates[`postList[${index}].isVoted`] = result.isLiked;
          updates[`postList[${index}].likeIcon`] = result.likeIcon;
          this.setData(updates);
        } else {
          // 回滚
          const updates = {};
          updates[`postList[${index}].votes`] = originalVotes;
          updates[`postList[${index}].isVoted`] = wasVoted;
          updates[`postList[${index}].likeIcon`] = likeIcon.getLikeIcon(originalVotes, wasVoted);
          this.setData(updates);
        }
      } catch (err) {
        const updates = {};
        updates[`postList[${index}].votes`] = originalVotes;
        updates[`postList[${index}].isVoted`] = wasVoted;
        updates[`postList[${index}].likeIcon`] = likeIcon.getLikeIcon(originalVotes, wasVoted);
        this.setData(updates);
        uni.showToast({ title: '操作失败', icon: 'none' });
      } finally {
        this.setData({ [`votingInProgress.${postId}`]: false });
      }
    },

    // 跨页同步：监听全局点赞变更
    onGlobalLikeChanged(e = {}) {
      try {
        const postId = e.postId;
        if (!postId) return;
        const list = this.postList || [];
        const idx = list.findIndex(p => p && (p._id === postId || p.id === postId));
        if (idx > -1) {
          const votes = typeof e.votes === 'number' ? e.votes : (list[idx].votes || 0);
          const isLiked = typeof e.isLiked === 'boolean' ? e.isLiked : !!list[idx].isVoted;
          const updates = {};
          updates[`postList[${idx}].votes`] = votes;
          updates[`postList[${idx}].isVoted`] = isLiked;
          updates[`postList[${idx}].likeIcon`] = likeIcon.getLikeIcon(votes, isLiked);
          this.setData(updates);
        }
      } catch (_) {}
    },

    // 从缓存同步点赞状态
    syncLikeStatusFromCache() {
      try {
        const list = Array.isArray(this.postList) ? this.postList : [];
        const ids = list.map(p => p && p._id).filter(Boolean);
        if (!ids.length) return;
        try { 
          const { syncLikeStatusForPosts } = require('../../utils/likeStatusSync.js'); 
          syncLikeStatusForPosts(ids); 
        } catch (_) {}
        const { getLatestLikeStatus } = require('../../utils/likeStatusSync.js');
        let changed = false;
        const next = list.slice();
        for (let i = 0; i < next.length; i += 1) {
          const p = next[i]; 
          if (!p || !p._id) continue;
          const s = getLatestLikeStatus(p._id);
          if (s && ((p.votes || 0) !== s.votes || !!p.isVoted !== !!s.isVoted)) {
            p.votes = s.votes; 
            p.isVoted = s.isVoted; 
            p.likeIcon = likeIcon.getLikeIcon(s.votes, s.isVoted);
            changed = true;
          }
        }
        if (changed) {
          const updates = {};
          next.forEach((p, idx) => {
            if (p && p._id) {
              updates[`postList[${idx}].votes`] = p.votes;
              updates[`postList[${idx}].isVoted`] = p.isVoted;
              updates[`postList[${idx}].likeIcon`] = p.likeIcon;
            }
          });
          this.setData(updates);
        }
      } catch (err) { 
        console.warn('[portfolio-detail] syncLikeStatusFromCache failed', err); 
      }
    },
    onLongPressCard(e) {
      const postId = e.currentTarget.dataset.postid;
      if (postId) {
        uni.navigateTo({ url: `/pages/post-detail/post-detail?id=${postId}` });
      }
    },
    touchStart() {},
    touchEnd() {},

    // 返回上一页
    goBack() {
      uni.navigateBack();
    },

    // 打开批量添加弹窗
    async openAddModal() {
      this.setData({
        showAddModal: true,
        selectedPostIds: []
      });
      // 先获取当前作品集内的所有帖子ID，过滤掉已经添加过的内容
      await this.fetchExistingPostIds();
      this.loadMyPosts();
    },

    // 隐藏批量添加弹窗
    hideAddModal() {
      this.setData({
        showAddModal: false,
        selectedPostIds: []
      });
    },

    // 获取当前作品集内的所有帖子ID，避免分页导致的重复展示
    async fetchExistingPostIds() {
      try {
        const res = await this.callCloudFunction('getPortfolioItems', {
          folderId: this.folderId,
          skip: 0,
          limit: 500, // 单次取足够多即可覆盖常见规模
          idsOnly: true
        });
        const postIds = (res && res.result && Array.isArray(res.result.postIds)) ? res.result.postIds : [];
        this.setData({ existingPostIds: postIds });
        return postIds;
      } catch (err) {
        console.error('获取作品集已有帖子ID失败，使用已加载列表兜底:', err);
        const fallbackIds = this.postList.map(item => item._id).filter(Boolean);
        this.setData({ existingPostIds: fallbackIds });
        return fallbackIds;
      }
    },

    // 加载我的原创诗歌
    async loadMyPosts() {
      this.setData({ myPostsLoading: true });
      try {
        const res = await this.callCloudFunction('getMyProfileData', {
          skip: 0,
          limit: 50
        });

        if (res.result && res.result.success && res.result.posts) {
          console.log('【作品集】获取到的我的帖子:', res.result.posts.length);
          
          // 过滤掉已经在作品集中的帖子（需要包含未加载分页的帖子ID）
          const existingPostIds = this.existingPostIds.length
            ? this.existingPostIds
            : this.postList.map(item => item._id).filter(Boolean);
          console.log('【作品集】已存在的帖子ID:', existingPostIds);
          
          // 只显示原创诗歌，使用isOriginal和isPoem字段
          const filteredPosts = res.result.posts.filter(post => {
            const isOriginalPoem = post.isOriginal === true && post.isPoem === true;
            const notInPortfolio = !existingPostIds.includes(post._id);
            
            console.log(`【作品集】帖子 ${post._id}: isOriginal=${post.isOriginal}, isPoem=${post.isPoem}, isOriginalPoem=${isOriginalPoem}, notInPortfolio=${notInPortfolio}`);
            
            return isOriginalPoem && notInPortfolio;
          });
          
          this.setData({
            myPosts: filteredPosts
          });
          
          console.log('【作品集】过滤后的我的原创诗歌数量:', filteredPosts.length);
        }
      } catch (error) {
        console.error('加载我的原创诗歌失败:', error);
        uni.showToast({
          title: '加载失败',
          icon: 'none'
        });
      } finally {
        this.setData({ myPostsLoading: false });
      }
    },

    // 切换选择帖子
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

    // 批量添加到作品集
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
          // 重新加载作品集内容
          this.getIndexData();
        } else {
          uni.showToast({
            title: '添加失败',
            icon: 'none'
          });
        }
      } catch (error) {
        console.error('批量添加失败:', error);
        uni.showToast({
          title: '添加失败',
          icon: 'none'
        });
      } finally {
        uni.hideLoading();
      }
    },

    // 格式化日期
    formatDate(dateString) {
      if (!dateString) return '';
      const date = new Date(dateString);
      const now = new Date();
      const diff = now - date;
      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      
      if (days === 0) {
        return '今天';
      } else if (days === 1) {
        return '昨天';
      } else if (days < 7) {
        return `${days}天前`;
      } else {
        return date.toLocaleDateString();
      }
    },

    // 加载更多
    loadMore() {
      if (!this.hasMore || this.isLoadingMore || this.isLoading) return;
      this.getPostList();
    },

    // 从作品集中删除帖子
    async onDeleteFromPortfolio(e) {
      const portfolioId = e.currentTarget.dataset.portfolioid;
      const index = e.currentTarget.dataset.index;
      
      // 确认对话框
      uni.showModal({
        title: '确认删除',
        content: '确定要从作品集中移除此诗歌吗？',
        success: async (res) => {
          if (res.confirm) {
            try {
              uni.showLoading({ title: '删除中...' });
              
              // 调用云函数删除
              const result = await this.callCloudFunction('removeFromPortfolio', {
                portfolioId: portfolioId
              });
              
              if (result && result.result && result.result.success) {
                // 从列表中移除
                const newPostList = this.postList.filter(item => item.portfolioId !== portfolioId);
                this.setData({ postList: newPostList });
                
                uni.showToast({
                  title: '删除成功',
                  icon: 'success'
                });
              } else {
                uni.showToast({
                  title: '删除失败',
                  icon: 'none'
                });
              }
            } catch (error) {
              console.error('删除失败:', error);
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
/* 诗歌内容使用汇文明朝字体，其他地方使用系统默认字体 */

.portfolio-detail-page {
  background: #fff;
  height: 100vh;
  display: flex;
  flex-direction: column;
  /* #ifdef APP-PLUS */
  padding-top: var(--status-bar-height);
  /* #endif */
}

.container {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.content-scroll {
  flex: 1;
  height: 0;
}

.content-container {
  width: 100vw;
  box-sizing: border-box;
  padding: 100rpx; /* 与 poem-square 保持一致的左右边距 */
  padding-top: 240rpx; /* 增加顶部留白，避免与更多按钮重叠 */
  padding-bottom: 32rpx;
  margin-bottom: 200rpx; /* 与 poem-square 保持一致的底部边距 */
  display: flex;
  flex-direction: column;
  align-items: stretch; /* 让卡片撑满容器 */
}
.empty-state { text-align: center; padding: 100rpx 0; color: #999; }
.empty-icon { font-size: 80rpx; margin-bottom: 20rpx; }
.empty-text { font-size: 32rpx; margin-bottom: 10rpx; color: #666; }
.empty-subtext { font-size: 24rpx; color: #999; }

/* poem.css inspired card styles */
.post-item-wrapper {
  width: 100%; /* 占满容器，消除左右空白 */
  margin-left: 0;
  margin-right: 0;
  border-radius: 30rpx; /* 15px * 2 */
  margin-bottom: 40rpx; /* 与 poem-square 保持一致的卡片间距 */
  overflow: hidden;
  box-shadow: 0 8rpx 8rpx rgba(0, 0, 0, 0.25); /* 0px 4px 4px * 2 */
  transition: transform .3s ease;
  border: none;
  position: relative; /* 为卷边效果添加定位 */
}



/* 背景颜色现在通过内联样式动态设置，不再使用固定的CSS类 */

.post-item-wrapper:active { transform: scale(0.98); }
.post-content-navigator { 
  display: block; 
  width: 100%;
  border-radius: 30rpx; /* 默认完整圆角（折叠态） */
  overflow: hidden;
}

/* 展开态时，post-content-navigator 只保留上方圆角 */
.post-content-navigator.has-vote-section {
  border-radius: 30rpx 30rpx 0 0;
}

.post-item { padding: 26rpx 50rpx 26rpx 60rpx; position: relative; width: 100%; box-sizing: border-box; } /* 与 poem-square 保持一致的内边距 */

/* Typography inspired by poem.css */
.post-content {
  font-family: '汇文明朝', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif;
  font-style: normal;
  font-weight: 500;
  font-size: 28rpx; /* 调小字体：14px * 2 */
  line-height: 38rpx; /* 调整行距：19px * 2 */
  margin: 30rpx 0;
  width: 100%;
  color: #FFFFFF;
}

/* 文字颜色现在通过内联样式动态设置 */
/* 折叠态：当没有高光行时显示前三行，有高光行时显示高光行 */
.post-content.collapsed {
  overflow: hidden;
  text-overflow: ellipsis;
}

/* 当没有高光行时，使用三行裁切 */
.post-content.collapsed.no-highlight {
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 3;
}
.post-content.expanded { display: block; overflow: visible; }
.comment-emoji{ font-size: 40rpx; }
.comment-icon { width: 60rpx; height: 60rpx; }
.vote-section { 
  display: flex; 
  justify-content: space-between; 
  align-items: center; 
  padding: 35rpx 50rpx;
  border-radius: 0 0 30rpx 30rpx; /* 只保留下方圆角，与 poem-square 保持一致 */
}
.actions-left { flex: 1; display: flex; align-items: center; gap: 20rpx; }
.button-group { display: flex; align-items: center; gap: 30rpx; }
.comment-count { display: flex; align-items: center; gap: 8rpx; padding: 10rpx 15rpx; }
.vote-count { display: flex; align-items: center; gap: 8rpx; padding: 10rpx 15rpx; border-radius: 20rpx; background: rgba(255,255,255,.9); box-shadow: 0 2rpx 8rpx rgba(0,0,0,.1); }
.comment-icon { width: 60rpx; height: 60rpx; }
.delete-icon { width: 80rpx; height: 80rpx; }

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

/* 小签名样式 - 折叠状态下显示 */
.user-signature-small {
  position: absolute;
  bottom: 30rpx;
  right: 60rpx;
  z-index: 10;
  pointer-events: none; /* 防止签名影响点击事件 */
}

.signature-image-small {
  width: 100rpx;
  height: 50rpx;
  opacity: 0.6; /* 更透明，不抢夺主要内容的注意力 */
  filter: drop-shadow(0 1rpx 2rpx rgba(0, 0, 0, 0.1)); /* 添加轻微阴影 */
  display: block; /* 确保图片正确显示 */
  background: transparent; /* 确保背景透明 */
}

.loading-footer { 
  text-align: center; 
  color: #666; 
  padding: 40rpx 0 60rpx; 
  font-size: 28rpx;
}
.page-indicator { position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); background: rgba(0,0,0,.7); color: #fff; padding: 20rpx 40rpx; border-radius: 40rpx; z-index: 1000; font-size: 28rpx; }
.page-indicator-text { text-align: center; }


/* 批量添加弹窗样式 */
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
  width: 90%;
  max-width: 600rpx;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
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
  flex: 1;
  padding: 40rpx;
  overflow: visible;
  display: flex;
  flex-direction: column;
}

.tip-text {
  font-size: 28rpx;
  color: #666;
  margin-bottom: 30rpx;
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
}

.posts-list {
  flex: 1;
  max-height: 400rpx;
  min-height: 200rpx;
  overflow-y: auto;
}

.loading-small, .empty-small {
  text-align: center;
  padding: 60rpx 0;
  color: #999;
  font-size: 28rpx;
}

/* 简化的作品选择列表样式 */
.posts-list-simple {
  display: flex;
  flex-direction: column;
  gap: 12rpx;
}

.post-item-simple {
  background: #f8f9fa;
  border-radius: 12rpx;
  padding: 24rpx;
  border: 2rpx solid transparent;
  transition: all 0.3s ease;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.post-item-simple.selected {
  border-color: #9ed7ee;
  background: rgba(158, 215, 238, 0.1);
}

.post-content-simple {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 6rpx;
}

.post-title-simple {
  font-size: 30rpx;
  color: #333;
  font-weight: 500;
  line-height: 1.4;
}

.post-date-simple {
  font-size: 24rpx;
  color: #999;
}

.selected-check-simple {
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
  flex-shrink: 0;
}

.modal-footer {
  display: flex;
  gap: 20rpx;
  padding: 30rpx 40rpx 40rpx;
  border-top: 1rpx solid #f0f0f0;
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
