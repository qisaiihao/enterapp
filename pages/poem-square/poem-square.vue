<template>
  <view class="poem-square white-bg" @touchstart="touchStart" @touchend="touchEnd">
    <!-- 顶部栏 -->
    <top-bar />

    <!-- 只看关注切换按钮 - 在写作入口下方 -->
    <view class="filter-toggle-container">
      <view 
        :class="'filter-toggle-btn ' + (showFollowingOnly ? 'active' : '')" 
        @tap="toggleFollowingFilter"
      >
        <text class="filter-toggle-text">{{ showFollowingOnly ? '显示全部' : '只看关注' }}</text>
      </view>
    </view>

    <!-- 加载中骨架 -->
    <view v-if="isLoading">
      <skeleton pageType="poem" />
    </view>

    <!-- 内容列表 -->
    <view v-else class="square-mode-container">
      <view v-if="postList.length === 0" class="empty-state">
        <view class="empty-icon">😶</view>
        <view class="empty-text">{{ showFollowingOnly ? '关注的人还没有发布诗歌哦～' : '还没刷出来，再等等~' }}</view>
        <view class="empty-subtext">{{ showFollowingOnly ? '去关注更多有趣的诗人吧！' : '去广场看看吧～' }}</view>
      </view>

      <view id="post-list-container">
        <view v-for="(item, index) in postList" v-if="item" :key="item._id ? `post-${item._id}-${index}` : `post-index-${index}`" class="post-item-wrapper" :style="{ backgroundColor: item.backgroundColor }">
          <view class="post-content-navigator" @tap="togglePostExpansion" @longpress="onLongPressCard" :data-index="index" :data-postid="item._id">
            <view class="post-item">
              <view :class="'post-content ' + (item.isExpanded ? 'expanded' : 'collapsed') + (!item.isExpanded && (!item.highlightLines || item.highlightLines.length === 0) ? ' no-highlight' : '')" v-if="item.content" :style="{ color: item.textColor, whiteSpace: 'pre-wrap' }">
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

              <!-- 作者签名 - 展开时显示大签名（匿名帖子不显示签名） -->
              <view v-if="item.isExpanded && item.authorSignature && !item.isAnonymous" class="user-signature">
                <image class="signature-image" :src="item.authorSignature" mode="aspectFit" @error="onSignatureError" @load="onSignatureLoad"></image>
              </view>

              <!-- 作者签名 - 折叠时显示小签名（匿名帖子不显示签名） -->
              <view v-if="!item.isExpanded && item.authorSignature && !item.isAnonymous" class="user-signature-small">
                <image class="signature-image-small" :src="item.authorSignature" mode="aspectFit" @error="onSignatureError" @load="onSignatureLoad"></image>
              </view>
            </view>
          </view>

          <!-- 交互区（展开时显示） -->
          <view class="vote-section" v-if="item.isExpanded" :style="{ backgroundColor: item.backgroundColor }">
            <view class="actions-left"><!-- 预留左侧空间 --></view>
            <view class="button-group">
              <view class="like-icon-container" @tap.stop.prevent="onVote" :data-postid="item._id" :data-index="index">
                <image class="like-icon" :src="item.likeIcon || '/static/images/seed.png'" mode="aspectFit" @error="onLikeIconError" />
              </view>
              <view class="comment-count" @tap.stop.prevent="onCommentClick" :data-postid="item._id">
                <image class="comment-icon" src="/static/images/comment.png" mode="aspectFit" />
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

    <!-- 顶部提示（用于调试滑动预加载阈值） -->
    <view v-if="showPageIndicator" class="page-indicator"></view>

    <!-- #ifndef MP-WEIXIN -->
    <app-tab-bar ref="customTabBar" />
    <!-- #endif -->
  </view>

</template>

<script>
// #ifndef MP-WEIXIN
import AppTabBar from '@/custom-tab-bar/index.vue';
// #endif
import skeleton from '@/components/skeleton/skeleton';
import topBar from '@/components/top-bar/top-bar.vue';
const { cloudCall } = require('@/utils/cloudCall.js');
const { getPostList: getPostListWithCache, invalidatePostList } = require('@/api-cache/post-list.js');
const { getFollowingPoems, invalidateFollowingPoems, getOriginalPoems } = require('@/api-cache/poems.js');
const likeIcon = require('@/utils/likeIcon.js');
import {
  generateRandomBackgroundColor,
  toggleArrayItemExpansion,
  updatePostsUIProperties,
  mergePostLists
} from '@/utils/uiHelpers.js';
import { navigateToPostDetail } from '@/utils/navigation.js';
const { togglePostLike } = require('../../utils/likeService.js');
// authorSignature已从云函数返回，不再需要signatureCache

const PAGE_SIZE = 10;

export default {
  onShow() {
    // #ifndef MP-WEIXIN
    try { uni.hideTabBar({ animation: false }); } catch (e) {}
    try { this.$refs.customTabBar && this.$refs.customTabBar.syncSelected && this.$refs.customTabBar.syncSelected(); } catch (e) {}
    // #endif
    // 回到页面时，用缓存对齐当前可见帖子的点赞状态
    try { this.syncLikeStatusFromCache && this.syncLikeStatusFromCache(); } catch (_) {}
  },
  onReachBottom() {
    if (!this.hasMore || this.isLoadingMore || this.isLoading) return;
    this.showPageIndicator = true;
    this.getPostList(() => { this.showPageIndicator = false; });
  },
  components: {
    skeleton,
    topBar,
    // #ifndef MP-WEIXIN
    AppTabBar
    // #endif
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
      // 安全区域高度
      safeAreaTop: 0,
      // 只看关注模式
      showFollowingOnly: false,
      // 加载锁定标志，防止重复触发加载
      _loadingLock: false
    };
  },
    onLoad(options) {
    // 处理 GitHub 登录回调
    if (options.githubLogin === 'success' && options.loginData) {
      try {
        const loginData = JSON.parse(decodeURIComponent(options.loginData));
        console.log('✅ [poem-square] GitHub 登录成功，用户信息:', loginData.user);
        
        // 更新全局数据
        const app = getApp();
        app.globalData.userInfo = loginData.user;
        app.globalData.openid = loginData.user._openid || loginData.user.openid;
        app.globalData._loginProcessCompleted = true;
        
        // 缓存用户信息
        uni.setStorageSync('userInfo', loginData.user);
        uni.setStorageSync('userOpenId', loginData.user._openid || loginData.user.openid);
        
        uni.showToast({
          title: '登录成功',
          icon: 'success',
          duration: 2000
        });
      } catch (error) {
        console.error('❌ [poem-square] GitHub 登录数据解析失败:', error);
      }
    }
    
    // 注册全局点赞变更事件（跨页实时更新）
    // replaced invalid registration
    try { uni.$on && uni.$on('like-changed', this.onGlobalLikeChanged); } catch (_) {}
    // 设备安全区初始化
    this.debugSafeArea();
    // 首次加载数据
    this.getIndexData();
  },
  onPullDownRefresh() {
    console.log('【poem-square】📱 下拉刷新，重新获取数据');
    // 清除缓存并强制刷新
    invalidatePostList({ isPoem: true, isOriginal: true, excludeAnonymous: true });
    invalidateFollowingPoems();
    this.getIndexData(() => {
      console.log('【poem-square】✅ 下拉刷新完成，停止刷新动画');
      uni.stopPullDownRefresh();
    });
  },
  onPageScroll(e) {
    // 增加防抖时间到300ms，减少频繁触发
    if (this._scrollTimer) clearTimeout(this._scrollTimer);
    this._scrollTimer = setTimeout(() => {
      // 双重检查：防止在定时器期间状态已变化
      if (!this.hasMore || this.isLoadingMore || this.isLoading) return;
      
      // 增加加载锁定标志，防止重复触发
      if (this._loadingLock) {
        console.log('【poem-square】加载锁定中，跳过本次滚动检查');
        return;
      }
      
      try {
        const info = uni.getSystemInfoSync();
        const winH = info.windowHeight;
        uni.createSelectorQuery().in(this).select('#post-list-container').boundingClientRect((rect) => {
          if (!rect || !rect.height) return;
          const distanceToBottom = rect.height - e.scrollTop - winH;
          const preloadThreshold = winH * 1.5;
          if (distanceToBottom < preloadThreshold) {
            // 再次检查状态，防止在查询期间状态变化
            if (this._loadingLock || !this.hasMore || this.isLoadingMore || this.isLoading) {
              return;
            }
            this._loadingLock = true;
            this.showPageIndicator = true;
            this.getPostList(() => {
              this.showPageIndicator = false;
              this._loadingLock = false;
            });
          }
        }).exec();
      } catch (_) {}
    }, 300); // 增加防抖时间到300ms
  },
  methods: {
    // 调试安全区域
    debugSafeArea() {
      try {
        // 获取系统信息
        const systemInfo = uni.getSystemInfoSync();
        console.log('【poem-square】系统信息:', {
          statusBarHeight: systemInfo.statusBarHeight,
          safeAreaInsets: systemInfo.safeAreaInsets,
          safeArea: systemInfo.safeArea,
          windowHeight: systemInfo.windowHeight,
          screenHeight: systemInfo.screenHeight,
          platform: systemInfo.platform
        });

        // 动态设置安全区域 - 使用uni-app兼容方式
        if (systemInfo.statusBarHeight) {
          const safeAreaTop = systemInfo.statusBarHeight;
          console.log('【poem-square】使用状态栏高度作为安全区域:', safeAreaTop);
          
          // 在uni-app中，我们可以通过设置页面数据来动态调整样式
          this.setData({
            safeAreaTop: safeAreaTop
          });
          
          // 尝试设置CSS变量（仅在支持的环境中）
          try {
            if (typeof document !== 'undefined' && document.documentElement) {
              document.documentElement.style.setProperty('--safe-area-inset-top', safeAreaTop + 'px');
              console.log('【poem-square】CSS变量设置成功');
            }
          } catch (cssError) {
            console.log('【poem-square】CSS变量设置失败，使用数据绑定方式:', cssError);
          }
        }
      } catch (error) {
        console.error('【poem-square】安全区域调试失败:', error);
      }
    },

        getIndexData(callback) {
      console.log('【poem-square】开始获取数据，callback:', typeof callback);
      // 先尝试从缓存获取第一页数据，立即显示给用户
      const cacheManager = require('@/_utils/cache-manager.js');
      const ns = cacheManager.namespace('posts:list', { persistent: true, maxItems: 256 });
      const cacheKey = 'page:0:size:10:poem:true:orig:true:exclAnon:true';
      
      console.log('🔍 [poem-square-cache] 开始读取缓存，key:', cacheKey);
      
      // 直接读取持久化存储，不通过get方法（避免过期检查）
      let cachedData = null;
      let cacheSource = 'none';
      try {
        if (ns.persistent) {
          console.log('🔍 [poem-square-cache] 检查持久化存储');
          // 直接从持久化存储读取，不检查过期时间
          const keys = ns.keys();
          console.log('🔍 [poem-square-cache] 所有缓存键:', keys);
          const matchedKey = keys.find(k => k.includes('page:0:size:10:poem:true:orig:true:exclAnon:true'));
          console.log('🔍 [poem-square-cache] 匹配到的键:', matchedKey);
          
          if (matchedKey) {
            const rec = ns._readPersist(matchedKey);
            console.log('🔍 [poem-square-cache] 从持久化读取的记录:', rec ? { hasValue: !!rec.v, isArray: Array.isArray(rec.v), length: rec.v?.length, expireAt: rec.e } : null);
            if (rec && rec.v && Array.isArray(rec.v) && rec.v.length > 0) {
              cachedData = rec.v;
              cacheSource = 'persistent';
              console.log('✅ [poem-square-cache] 从持久化存储读取到缓存数据，数量:', cachedData.length);
              // 恢复到内存缓存
              ns.mem.set(matchedKey, rec);
              console.log('✅ [poem-square-cache] 已恢复到内存缓存');
            }
          }
        }
        // 如果持久化没找到，尝试从内存读取
        if (!cachedData) {
          console.log('🔍 [poem-square-cache] 从内存缓存读取');
          const rec = ns.mem.get(cacheKey);
          console.log('🔍 [poem-square-cache] 内存缓存记录:', rec ? { hasValue: !!rec.v, isArray: Array.isArray(rec.v), length: rec.v?.length, expireAt: rec.e } : null);
          if (rec && rec.v && Array.isArray(rec.v) && rec.v.length > 0) {
            cachedData = rec.v;
            cacheSource = 'memory';
            console.log('✅ [poem-square-cache] 从内存缓存读取到数据，数量:', cachedData.length);
          }
        }
      } catch (e) {
        console.error('❌ [poem-square-cache] 读取缓存失败:', e);
      }
      
      console.log('🔍 [poem-square-cache] 缓存读取结果:', { 
        found: !!cachedData, 
        source: cacheSource, 
        count: cachedData?.length || 0 
      });
      
      if (cachedData && Array.isArray(cachedData) && cachedData.length > 0) {
        console.log('✅ [poem-square-cache] 发现缓存数据，立即显示，数量:', cachedData.length);
        // 处理缓存数据
        const visibleList = cachedData.filter(p => p && !p.isAnonymous);
        console.log('🔍 [poem-square-cache] 过滤匿名后的数量:', visibleList.length);
        
        visibleList.forEach((p) => {
          if (!p) return;
          p.backgroundColor = p.backgroundColor || this.generateRandomBackgroundColor();
          p.textColor = p.textColor || '#222';
          p.isExpanded = false;
          p.authorSignature = '';
          p.likeIcon = likeIcon && likeIcon.getLikeIcon ? likeIcon.getLikeIcon(p.votes || 0, !!p.isVoted) : '';
        });
        
        // 立即显示缓存数据
        this.setData({ 
          postList: visibleList,
          page: 1,  // 缓存数据已经显示第一页，下一页是第1页
          hasMore: true,
          isLoading: false,  // 先显示缓存，不显示loading
          isLoadingMore: false,
          _loadingLock: false
        });
        console.log('✅ [poem-square-cache] 已显示缓存数据，准备后台刷新');
        
        // 然后异步刷新数据（会使用SWR策略，如果缓存未过期就不会调用云函数）
        setTimeout(() => {
          console.log('🔍 [poem-square-cache] 开始后台刷新，重置页码为0');
          this.setData({ page: 0 }); // 重置页码，让getPostList从第一页开始
          this.getPostList((newData) => { 
            console.log('🔍 [poem-square-cache] 后台刷新完成，新数据:', newData ? newData.length : 0);
            // processPostList 已经处理了合并逻辑，这里只需要执行回调
            if (typeof callback === 'function') {
              callback();
            }
          });
        }, 100);
      } else {
        // 没有缓存，正常加载
        console.log('⚠️ [poem-square-cache] 没有找到缓存数据，正常加载');
        this.setData({ 
          postList: [], 
          page: 0, 
          hasMore: true,
          isLoading: true,
          isLoadingMore: false,
          _loadingLock: false
        });
        this.getPostList(() => { 
          console.log('【poem-square】getPostList 完成，设置 isLoading: false');
          this.setData({ isLoading: false });
          if (typeof callback === 'function') {
            console.log('【poem-square】执行回调函数');
            callback();
          }
        });
      }
    },
    // 切换只看关注模式
    toggleFollowingFilter() {
      const newMode = !this.showFollowingOnly;
      console.log('【poem-square】切换只看关注模式:', newMode);
      
      this.setData({
        showFollowingOnly: newMode,
        postList: [],
        page: 0,
        hasMore: true,
        isLoading: true
      });
      
      // 重新加载数据
      this.getIndexData();
    },
    generateRandomBackgroundColor() {
      const result = generateRandomBackgroundColor(this.backgroundColors, this.lastUsedColorIndex);
      this.lastUsedColorIndex = result.index;
      return result.color;
    },
    async getPostList(cb) {
      console.log('🔍🔍🔍 【poem-square】getPostList 开始，isLoadingMore:', this.isLoadingMore, 'isLoading:', this.isLoading, 'callback:', typeof cb);
      console.log('🔍🔍🔍 【poem-square】当前页码:', this.page, 'PAGE_SIZE:', PAGE_SIZE);
      // 双重检查：防止重复调用（首次加载时isLoading为true是正常的）
      const isFirstLoad = this.page === 0;
      if (!isFirstLoad && (this.isLoadingMore || this._loadingLock)) {
        console.log('【poem-square】正在加载中或已锁定，跳过请求');
        if (typeof cb === 'function') cb();
        return;
      }
      // 设置加载锁定（首次加载时isLoading已经设置为true）
      if (!isFirstLoad) {
        this._loadingLock = true;
        this.setData({ isLoadingMore: true });
      }
      try {
        // 根据模式选择不同的云函数
        const isFollowingMode = this.showFollowingOnly;
        
        // 只看关注模式使用 getFollowingPoems（带缓存）
        if (isFollowingMode) {
          console.log('🔍🔍🔍 【poem-square】准备调用关注诗歌API');
          const list = await getFollowingPoems({
            page: this.page,
            pageSize: PAGE_SIZE,
            context: this
          });
          this.processPostList(list, cb);
          return;
        }

        // 全部模式使用原创诗歌API
        const list = await getOriginalPoems({
          page: this.page,
          pageSize: PAGE_SIZE,
          context: this
        });
        
        this.processPostList(list, cb);
      } catch (e) {
        console.error('【poem-square】获取帖子列表失败:', e);
        uni.showToast({ title: '加载失败', icon: 'none' });
        // 只有非首次加载时才设置isLoadingMore
        if (this.page !== 0) {
          this.setData({ isLoadingMore: false });
        }
        this._loadingLock = false;
        if (typeof cb === 'function') cb();
      }
    },
    
    processPostList(list, cb) {
      console.log('🔍🔍🔍 【poem-square】获取到帖子数量:', list.length);
      console.log('🔍🔍🔍 【poem-square】当前页码:', this.page, '现有列表长度:', this.postList.length);
      
      if (list.length > 0) {
        console.log('🔍🔍🔍 【poem-square】所有帖子的详细信息（用于验证随机性）:');
        list.forEach((p, idx) => {
          console.log(`  [${idx + 1}] ID: ${p._id}, 创建时间: ${p.createTime}, 标题: ${p.title || p.content?.substring(0, 20)}`);
        });
        console.log('🔍🔍🔍 【poem-square】前3个帖子的时间:', list.slice(0, 3).map(p => ({
          id: p._id,
          createTime: p.createTime,
          title: p.title || p.content?.substring(0, 20)
        })));
        if (list.length >= 10) {
          console.log('🔍🔍🔍 【poem-square】后4个帖子（应该是随机的）的创建时间:', list.slice(6, 10).map(p => ({
            id: p._id,
            createTime: p.createTime,
            title: p.title || p.content?.substring(0, 20)
          })));
        }
      }
      
      const visibleList = list.filter(p => p && !p.isAnonymous);
      console.log('🔍🔍🔍 【poem-square】过滤匿名后的数量:', visibleList.length);
      
      visibleList.forEach((p) => {
        if (!p) return;
        p.backgroundColor = p.backgroundColor || this.generateRandomBackgroundColor();
        p.textColor = p.textColor || '#222';
        p.isExpanded = false;
        // authorSignature已从云函数返回，保留原始值（如果没有则为空字符串）
        p.authorSignature = p.authorSignature || '';
        p.likeIcon = likeIcon && likeIcon.getLikeIcon ? likeIcon.getLikeIcon(p.votes || 0, !!p.isVoted) : '';
      });
      
      let newPostList;
      if (this.page === 0) {
        // 第一页：如果是刷新缓存数据，需要合并到现有列表
        if (this.postList.length > 0) {
          console.log('🔍🔍🔍 【poem-square】第一页刷新，现有列表:', this.postList.length, '新数据:', visibleList.length);
          // 检查是否有新帖子
          const existingIds = new Set(this.postList.map(post => post._id).filter(Boolean));
          const newPosts = visibleList.filter(post => post && post._id && !existingIds.has(post._id));
          console.log('🔍🔍🔍 【poem-square】真正的新帖子数量:', newPosts.length);
          
          if (newPosts.length > 0) {
            // 有新帖子，补充到列表前面（最新的在前面）
            newPostList = [...newPosts, ...this.postList];
            console.log('✅ 【poem-square】合并后的列表长度:', newPostList.length);
          } else {
            // 没有新帖子，保持现有列表，但更新现有帖子的数据（可能有更新）
            console.log('🔍🔍🔍 【poem-square】没有新帖子，更新现有帖子数据');
            const updatedList = this.postList.map(existingPost => {
              const updated = visibleList.find(p => p._id === existingPost._id);
              return updated || existingPost;
            });
            newPostList = updatedList;
          }
        } else {
          // 没有现有列表，直接使用新数据
          newPostList = visibleList;
          console.log('🔍🔍🔍 【poem-square】没有现有列表，直接使用新数据');
        }
      } else {
        // 加载更多：合并并去重
        const existingIds = new Set(this.postList.map(post => post._id).filter(Boolean));
        const uniqueNewPosts = visibleList.filter(post => post && post._id && !existingIds.has(post._id));
        newPostList = this.postList.concat(uniqueNewPosts);
        console.log('【poem-square】去重：新帖子', visibleList.length, '去重后', uniqueNewPosts.length);
      }
      
      console.log('🔍🔍🔍 【poem-square】最终列表长度:', newPostList.length, '页码:', this.page + 1);
      
      this.setData({
        postList: newPostList,
        page: this.page + 1,
        hasMore: list.length === PAGE_SIZE
      });
      
      // authorSignature已从云函数返回，无需额外获取
      console.log('【poem-square】数据处理完成');
      
      // 只有非首次加载时才设置isLoadingMore
      if (this.page !== 0) {
        this.setData({ isLoadingMore: false });
      }
      this._loadingLock = false;
      if (typeof cb === 'function') {
        console.log('【poem-square】执行回调函数');
        cb(newPostList); // 传递新列表数据给回调
      }
    },
    togglePostExpansion(e) {
      const index = e.currentTarget.dataset.index;
      const newPostList = toggleArrayItemExpansion(this.postList, index);
      this.setData({ postList: newPostList });
    },
    onCommentClick(e) {
      const postId = e.currentTarget.dataset.postid;
      navigateToPostDetail(postId);
    },
    onLikeIconError() {},

    // authorSignature已从云函数返回，不再需要fetchAuthorSignature函数

    // 签名图片加载成功
    onSignatureLoad(e) {
      console.log('【poem-square】签名图片加载成功:', e);
    },

    // 签名图片加载失败
    onSignatureError(e) {
      console.error('【poem-square】签名图片加载失败:', e);
    },
    onVote(e) {
      console.log('【poem-square】点赞事件触发', e.currentTarget.dataset);
      const postId = e.currentTarget.dataset.postid;
      const index = e.currentTarget.dataset.index;
      
      if (!postId) {
        console.error('【poem-square】点赞失败：postId为空');
        uni.showToast({ title: '点赞失败：帖子ID缺失', icon: 'none' });
        return;
      }
      
      if (this.votingInProgress[postId]) {
        console.log('【poem-square】正在点赞中，跳过重复请求');
        return;
      }
      
      this.setData({ [`votingInProgress.${postId}`]: true });
      const list = this.postList;
      const originalVotes = Number(list[index].votes) || 0;
      const wasVoted = !!list[index].isVoted;
      
      console.log('【poem-square】点赞参数', { postId, index, originalVotes, wasVoted });

      // 立即更新UI，提供即时反馈
      const optimisticVotes = wasVoted ? Math.max(0, originalVotes - 1) : originalVotes + 1;
      const optimisticItem = {
        ...list[index],
        votes: optimisticVotes,
        isVoted: !wasVoted,
        likeIcon: likeIcon.getLikeIcon(optimisticVotes, !wasVoted)
      };
      const optimisticList = list.slice();
      optimisticList[index] = optimisticItem;
      this.setData({ postList: optimisticList });

      togglePostLike(postId, {
        pageTag: 'poem-square',
        context: this,
        currentVotes: originalVotes,
        currentIsLiked: wasVoted,
        requireAuth: true
      }).then((result) => {
        console.log('【poem-square】服务返回结果:', result);
        if (result.success) {
          const currentList = this.postList || [];
          const currentIndex = currentList.findIndex((p) => p._id === postId);
          if (currentIndex > -1) {
            const updatedItem = {
              ...currentList[currentIndex],
              votes: result.votes,
              isVoted: result.isLiked,
              likeIcon: result.likeIcon
            };
            const newList = currentList.slice();
            newList[currentIndex] = updatedItem;
            this.setData({ postList: newList });
          }
          console.log('【poem-square】服务调用成功，数据已同步');
          return;
        }

        const rollback = result.rollback || {
          votes: originalVotes,
          isLiked: wasVoted,
          likeIcon: likeIcon.getLikeIcon(originalVotes, wasVoted)
        };
        console.warn('【poem-square】服务返回失败，回滚UI');
        const currentList = this.postList || [];
        const currentIndex = currentList.findIndex((p) => p._id === postId);
        if (currentIndex > -1) {
          const rollbackItem = {
            ...currentList[currentIndex],
            votes: rollback.votes,
            isVoted: rollback.isLiked,
            likeIcon: rollback.likeIcon
          };
          const rollbackList = currentList.slice();
          rollbackList[currentIndex] = rollbackItem;
          this.setData({ postList: rollbackList });
        }
        uni.showToast({ title: result?.message || '点赞失败', icon: 'none' });
      }).catch((err) => {
        console.error('【poem-square】点赞异常:', err);
        const currentList = this.postList || [];
        const currentIndex = currentList.findIndex((p) => p._id === postId);
        if (currentIndex > -1) {
          const rollbackItem = {
            ...currentList[currentIndex],
            votes: originalVotes,
            isVoted: wasVoted,
            likeIcon: likeIcon.getLikeIcon(originalVotes, wasVoted)
          };
          const rollbackList = currentList.slice();
          rollbackList[currentIndex] = rollbackItem;
          this.setData({ postList: rollbackList });
        }
        uni.showToast({ title: '操作失败', icon: 'none' });
      }).finally(() => {
        this.setData({ [`votingInProgress.${postId}`]: false });
      });
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
    onLongPressCard(e) {
      const postId = e.currentTarget.dataset.postid;
      if (postId) {
        uni.navigateTo({ url: `/pages/post-detail/post-detail?id=${postId}` });
      }
    },
    touchStart() {},
    touchEnd() {},
    // 从 like:status 缓存对齐当前列表的点赞状态（兜底：跨页返回时也能更新）
    syncLikeStatusFromCache() {
      try {
        const list = Array.isArray(this.postList) ? this.postList : [];
        const ids = list.map(p => p && p._id).filter(Boolean);
        if (!ids.length) return;
        try { const { syncLikeStatusForPosts } = require('../../utils/likeStatusSync.js'); syncLikeStatusForPosts(ids); } catch (_) {}
        const { getLatestLikeStatus } = require('../../utils/likeStatusSync.js');
        let changed = false;
        const next = list.slice();
        for (let i = 0; i < next.length; i += 1) {
          const p = next[i]; if (!p || !p._id) continue;
          const s = getLatestLikeStatus(p._id);
          if (s && ((p.votes || 0) !== s.votes || !!p.isVoted !== !!s.isVoted)) {
            p.votes = s.votes; p.isVoted = s.isVoted; p.likeIcon = likeIcon.getLikeIcon(s.votes, s.isVoted);
            changed = true;
          }
        }
        if (changed) this.setData({ postList: next });
      } catch (err) { console.warn('[poem-square] syncLikeStatusFromCache failed', err); }
    }
  }
};
</script>

<style>
/* 字体已在App.vue中全局预加载，这里不再需要重复定义 */

.white-bg { 
  background: #fff; 
  min-height: 100vh; 
  padding-top: env(safe-area-inset-top, var(--safe-area-inset-top, 44px)); /* 添加状态栏安全区域，备选方案 */
}
.square-mode-container {
  padding: 100rpx;
  margin-bottom: 200rpx;
  padding-top: 250rpx; /* 与山界面保持一致 */
  display: flex;
  flex-direction: column;
  align-items: stretch; 
}
.empty-state { text-align: center; padding: 100rpx 0; color: #999; }
.empty-icon { font-size: 80rpx; margin-bottom: 20rpx; }
.empty-text { font-size: 32rpx; margin-bottom: 10rpx; color: #666; }
.empty-subtext { font-size: 24rpx; color: #999; }

/* poem.css inspired card styles */
.post-item-wrapper {
  width: 100%;
  border-radius: 30rpx; /* 15px * 2 */
  margin-bottom: 40rpx; /* 减少间距，让卡片更紧凑 */
  overflow: hidden;
  box-shadow: 0 8rpx 8rpx rgba(0, 0, 0, 0.25); /* 0px 4px 4px * 2 */
  transition: transform .3s ease;
  border: none;
  position: relative; /* 为卷边效果添加定位 */
}



/* 背景颜色现在通过内联样式动态设置，不再使用固定的CSS类 */

.post-item-wrapper:active { transform: scale(0.98); }
.post-content-navigator { display: block; }
.post-item { padding: 30rpx 60rpx 30rpx 80rpx; position: relative; } /* 进一步减少上下padding，文字往左移动 */

/* Typography inspired by poem.css */
.post-content {
  font-family: 'Huiwen-mincho', sans-serif;
  font-style: normal;
  font-weight: 500;
  font-size: 28rpx; /* 调小字体：14px * 2 */
  line-height: 38rpx; /* 调整行距：19px * 2 */
  margin: 30rpx 0;
  width: 100%;
  color: #FFFFFF;
  overflow-wrap: break-word; 
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
.vote-section { display: flex; justify-content: space-between; align-items: center; padding: 25rpx 50rpx; }
.actions-left { flex: 1; display: flex; align-items: center; gap: 20rpx; }
.button-group { display: flex; align-items: center; gap: 30rpx; }
.comment-count { display: flex; align-items: center; gap: 8rpx; padding: 10rpx 15rpx; }
.vote-count { display: flex; align-items: center; gap: 8rpx; padding: 10rpx 15rpx; border-radius: 20rpx; background: rgba(255,255,255,.9); box-shadow: 0 2rpx 8rpx rgba(0,0,0,.1); }
.comment-icon { width: 60rpx; height: 60rpx; }
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

.loading-footer { text-align: center; color: #666; padding: 30rpx 0 120rpx; }
.page-indicator { position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); background: rgba(0,0,0,.7); color: #fff; padding: 20rpx 40rpx; border-radius: 40rpx; z-index: 1000; font-size: 28rpx; }
.page-indicator-text { text-align: center; }

/* 只看关注切换按钮 - 在写作入口下方 */
.filter-toggle-container {
  position: absolute;
  top: calc(env(safe-area-inset-top, 44px) + 120rpx); /* 状态栏高度 + 顶部栏高度 + 额外间距 */
  left: 30rpx;
  z-index: 1;
}

.filter-toggle-btn {
  padding: 12rpx 32rpx;
  border-radius: 50rpx;
  background: transparent;
  border: 2rpx solid #e0e0e0;
  transition: all 0.3s ease;
  cursor: pointer;
  box-shadow: none;
  min-width: 140rpx;
  text-align: center;
}

.filter-toggle-btn:active {
  transform: scale(0.95);
}

.filter-toggle-btn.active {
  background: transparent;
  border: 2rpx solid #e0e0e0;
  box-shadow: none;
}

.filter-toggle-text {
  font-size: 26rpx;
  color: #666;
  font-weight: 600;
  line-height: 1.2;
}

.filter-toggle-btn.active .filter-toggle-text {
  color: #666;
}
</style>






