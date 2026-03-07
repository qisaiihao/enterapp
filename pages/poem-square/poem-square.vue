<template>
  <view class="poem-square white-bg" @touchstart="touchStart" @touchend="touchEnd">
    <!-- 顶部栏 -->
    <top-bar />

    <!-- 只看关注切换按钮 - 只在非关注模式下显示 -->
    <view v-if="!showFollowingOnly" class="filter-toggle-container" :style="{ top: (safeAreaTop * 2 + 160) + 'rpx' }">
      <view class="filter-toggle-btn" @tap="toggleFollowingFilter">
        <text class="filter-toggle-text">只看关注</text>
      </view>
    </view>

    <!-- 关注头像栏 - 只在关注模式下显示 -->
    <view v-if="showFollowingOnly" class="following-avatar-bar-wrapper" :style="{ top: (safeAreaTop * 2 + 140) + 'rpx' }">
      <following-avatar-bar
        ref="followingAvatarBar"
        mode="poem-square"
        :selected-user-id="followingSelectedUserId"
        @select-user="onFollowingUserSelect"
        @back="exitFollowingMode"
      />
    </view>

    <!-- 加载中骨架 -->
    <!-- 在存在关注组件时不显示骨架屏 -->
    <view v-if="isLoading && !showFollowingOnly">
      <skeleton
        pageType="poem"
        :hasFilterBar="false"
        filterBarType=""
      />
    </view>

    <!-- 内容列表 -->
    <view v-else :class="['square-mode-container', showFollowingOnly ? 'with-avatar-bar' : '']" :style="{ paddingTop: showFollowingOnly ? ((safeAreaTop * 2 + 360) + 'rpx') : ((safeAreaTop * 2 + 250) + 'rpx') }">
      <view v-if="postList.length === 0" class="empty-state">
        <view class="empty-icon">😶</view>
        <view class="empty-text">{{ showFollowingOnly ? '关注的人还没有发布诗歌哦～' : '还没刷出来，再等等~' }}</view>
        <view class="empty-subtext">{{ showFollowingOnly ? '去关注更多有趣的诗人吧！' : '去广场看看吧～' }}</view>
      </view>

      <view id="post-list-container">
        <view
          v-for="(item, index) in postList"
          v-if="item"
          :key="index"
          class="post-item-wrapper"
          :class="item.isSeries && !item.seriesExpanded ? 'stacked-series-card' : ''"
          :style="{ backgroundColor: item.backgroundColor }"
        >
          <!-- 组诗叠层的底层卡片（同色） - 未展开时显示 -->
          <view
            v-if="item.isSeries && !item.seriesExpanded"
            class="series-layer layer-1"
            :style="{ backgroundColor: item.backgroundColor }"
          ></view>

          <!-- 组诗展开态：单卡片显示，右侧显示翻页提示 -->
          <block v-if="item.isSeries && item.seriesExpanded && item.seriesPoems && item.seriesPoems.length > 0">
            <view class="series-expanded-wrapper">
              <view 
                class="series-single-card"
                @tap="onSeriesCardTap"
                :data-index="index"
              >
                <!-- 当前显示的诗 -->
                <view class="post-item">
                  <!-- 显示副标题（如果有） -->
                  <view v-if="item.seriesPoems[item.currentSeriesIndex || 0].subtitle" class="series-subtitle" :style="{ color: item.textColor }">
                    {{ item.seriesPoems[item.currentSeriesIndex || 0].subtitle }}
                  </view>
                  
                  <!-- 显示内容 -->
                  <view class="post-content expanded" :style="{ color: item.textColor, whiteSpace: 'pre-wrap' }">
                    {{ item.seriesPoems[item.currentSeriesIndex || 0].content }}
                  </view>
                  
                  <!-- 作者签名 -->
                  <view v-if="item.authorSignature && !item.isAnonymous" class="user-signature">
                    <image 
                      class="signature-image" 
                      :src="item.authorSignature" 
                      mode="aspectFit" 
                      :webp="true"
                      :show-menu-by-longpress="false"
                      @error="onSignatureError" 
                      @load="onSignatureLoad"
                    ></image>
                  </view>
                </view>
              </view>
              
              <!-- 组诗页码指示 -->
              <view class="series-page-indicator">
                {{ (item.currentSeriesIndex || 0) + 1 }} / {{ item.seriesPoems.length }}
              </view>
              
              <!-- 交互区 -->
              <view class="vote-section" :style="{ backgroundColor: item.backgroundColor }">
                <view class="actions-left"><!-- 预留左侧空间 --></view>
                <view class="button-group">
                  <view class="like-icon-container" @tap.stop.prevent="onVote" :data-postid="item._id" :data-index="index">
                    <image class="like-icon" :src="item.likeIcon || '/static/images/seed.png'" mode="aspectFit" @error="onLikeIconError" />
                  </view>
                  <view class="comment-count" @tap.stop.prevent="onCommentClick" :data-postid="item._id">
                    <image class="comment-icon" src="/static/images/newicons/comment.png" mode="aspectFit" />
                  </view>
                </view>
              </view>
            </view>
          </block>

          <!-- 普通卡片或组诗折叠态 -->
          <block v-if="!item.seriesExpanded">
            <view 
              class="post-content-navigator" 
              :class="{ 'has-vote-section': item.isExpanded && !item.isSeries }"
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
                    <block v-if="item.highlightLines && item.highlightLines.length > 0">
                      <text v-for="(highlightLine, hlIndex) in item.highlightLines" :key="hlIndex" style="font-weight: 700; display: block;">{{ highlightLine }}</text>
                    </block>
                    <block v-else>
                      {{ item.content }}
                    </block>
                  </block>
                </view>

                <!-- 作者签名 - 展开时显示大签名（匿名帖子不显示签名） -->
                <view v-if="item.isExpanded && item.authorSignature && !item.isAnonymous" class="user-signature">
                  <image 
                    class="signature-image" 
                    :src="item.authorSignature" 
                    mode="aspectFit" 
                    :webp="true"
                    :show-menu-by-longpress="false"
                    @error="onSignatureError" 
                    @load="onSignatureLoad"
                  ></image>
                </view>

                <!-- 作者签名 - 折叠时显示小签名（匿名帖子不显示签名） -->
                <view v-if="!item.isExpanded && item.authorSignature && !item.isAnonymous" class="user-signature-small">
                  <image 
                    class="signature-image-small" 
                    :src="item.authorSignature" 
                    mode="aspectFit" 
                    :webp="true"
                    :show-menu-by-longpress="false"
                    @error="onSignatureError" 
                    @load="onSignatureLoad"
                  ></image>
                </view>
              </view>
            </view>

            <!-- 交互区（展开时显示 - 仅非组诗） -->
            <view class="vote-section" v-if="item.isExpanded && !item.isSeries" :style="{ backgroundColor: item.backgroundColor }">
              <view class="actions-left"><!-- 预留左侧空间 --></view>
              <view class="button-group">
                <view class="like-icon-container" @tap.stop.prevent="onVote" :data-postid="item._id" :data-index="index">
                  <image class="like-icon" :src="item.likeIcon || '/static/images/seed.png'" mode="aspectFit" @error="onLikeIconError" />
                </view>
                <view class="comment-count" @tap.stop.prevent="onCommentClick" :data-postid="item._id">
                  <image class="comment-icon" src="/static/images/newicons/comment.png" mode="aspectFit" />
                </view>
              </view>
            </view>
          </block>
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
import FollowingAvatarBar from '@/components/following-avatar-bar/following-avatar-bar.vue';
import { cloudCall } from '@/utils/cloudCall.js';
import { getPostList as getPostListWithCache, invalidatePostList } from '@/api-cache/post-list.js';
import { getFollowingPoems, invalidateFollowingPoems, getOriginalPoems } from '@/api-cache/poems.js';
import likeIcon from '@/utils/likeIcon.js';
import {
  generateRandomBackgroundColor,
  toggleArrayItemExpansion,
  updatePostsUIProperties,
    mergePostLists
} from '@/utils/uiHelpers.js';
import { navigateToPostDetail } from '@/utils/navigation.js';
import { togglePostLike } from '@/utils/likeService.js';
import cacheManager from '@/_utils/cache-manager.js';
import { syncLikeStatusForPosts, getLatestLikeStatus } from '@/utils/likeStatusSync.js';
import fileUrlCache from '@/cache/core/file-url';

const PAGE_SIZE = 10;

export default {
  onShow() {
    // #ifndef MP-WEIXIN
    try { uni.hideTabBar({ animation: false }); } catch (e) {}
    try { this.$refs.customTabBar && this.$refs.customTabBar.syncSelected && this.$refs.customTabBar.syncSelected(); } catch (e) {}
    // #endif
    
    // #ifdef MP-WEIXIN
    // 更新小程序自定义tabBar的选中状态
    console.log('=== poem-square onShow ===');
    console.log('尝试获取 tabBar...');
    if (typeof this.getTabBar === 'function') {
      const tabBar = this.getTabBar();
      console.log('getTabBar() 返回:', tabBar);
      if (tabBar) {
        if (tabBar.updateSelected) {
          console.log('调用 tabBar.updateSelected(1)');
          tabBar.updateSelected(1);
        } else if (tabBar.setData) {
          console.log('调用 tabBar.setData({ selected: 1 })');
          tabBar.setData({ selected: 1 });
        } else {
          console.warn('tabBar 不可用或没有 updateSelected/setData 方法');
        }
      }
    } else {
      console.warn('this.getTabBar 不是函数');
    }
    // #endif
    
    // 检查缓存新鲜度：从其他页面返回时触发SWR检查
    try {
      if (this.hasEverLoaded && this.postList.length > 0) {
        if (this.showFollowingOnly) {
          getFollowingPoems({ page: 0, pageSize: PAGE_SIZE, context: this }).catch(() => {});
        } else {
          getOriginalPoems({ page: 0, pageSize: PAGE_SIZE, context: this }).catch(() => {});
        }
      }
    } catch (_) {}
    
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
    FollowingAvatarBar,
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
      // 关注头像栏选中的用户ID
      followingSelectedUserId: null,
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

        // 动态设置安全区域 - 优先使用safeAreaInsets.top，其次使用statusBarHeight
        let safeAreaTop = 0;

        // #ifdef APP-PLUS
        // 在app端，优先使用safeAreaInsets.top
        if (systemInfo.safeAreaInsets && systemInfo.safeAreaInsets.top > 0) {
          safeAreaTop = systemInfo.safeAreaInsets.top;
          console.log('【poem-square】使用safeAreaInsets.top作为安全区域:', safeAreaTop);
        } else if (systemInfo.statusBarHeight) {
          safeAreaTop = systemInfo.statusBarHeight;
          console.log('【poem-square】使用statusBarHeight作为安全区域:', safeAreaTop);
        }
        // #endif

        // #ifndef APP-PLUS
        // 在H5端，使用statusBarHeight
        if (systemInfo.statusBarHeight) {
          safeAreaTop = systemInfo.statusBarHeight;
          console.log('【poem-square】使用statusBarHeight作为安全区域:', safeAreaTop);
        }
        // #endif

        // 设置页面数据
        this.setData({
          safeAreaTop: safeAreaTop
        });

        // 设置CSS变量 - 适配不同平台
        try {
          // #ifdef H5
          if (typeof document !== 'undefined' && document.documentElement) {
            document.documentElement.style.setProperty('--safe-area-top', safeAreaTop + 'px');
            console.log('【poem-square】H5端CSS变量设置成功: --safe-area-top =', safeAreaTop + 'px');
          }
          // #endif

          // #ifdef APP-PLUS
          // 在app端，通过page的style设置CSS变量
          const pages = getCurrentPages();
          if (pages.length > 0) {
            const currentPage = pages[pages.length - 1];
            if (currentPage && currentPage.$el) {
              currentPage.$el.style.setProperty('--safe-area-top', safeAreaTop + 'px');
              console.log('【poem-square】APP端CSS变量设置成功: --safe-area-top =', safeAreaTop + 'px');
            }
          }
          // #endif
        } catch (cssError) {
          console.log('【poem-square】CSS变量设置失败，使用数据绑定方式:', cssError);
        }

        // 备用方案：直接修改页面根元素样式
        try {
          // #ifdef APP-PLUS
          const app = getApp();
          if (app.globalData) {
            app.globalData.safeAreaTop = safeAreaTop;
          }
          // #endif
        } catch (_) {}

      } catch (error) {
        console.error('【poem-square】安全区域调试失败:', error);
        // 使用默认值
        this.setData({
          safeAreaTop: 44
        });
      }
    },

        getIndexData(callback) {
      console.log('【poem-square】开始获取数据，callback:', typeof callback);

      // 判断是否是用户筛选操作
      const isUserFiltering = this.showFollowingOnly && this.followingSelectedUserId;

      if (isUserFiltering) {
        // 用户筛选时：立即清空列表，显示加载状态
        console.log('🔍 [poem-square] 用户筛选模式，立即清空列表');
        this.setData({
          postList: [],
          page: 0,
          hasMore: true,
          isLoading: true,
          isLoadingMore: false,
          _loadingLock: false
        });
        this.getPostList(() => {
          console.log('【poem-square】用户筛选 getPostList 完成，设置 isLoading: false');
          this.setData({ isLoading: false });
          if (typeof callback === 'function') {
            callback();
          }
        });
        return;
      }

      // 非筛选模式：先尝试从缓存获取第一页数据，立即显示给用户
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
          
          // 初始化组诗相关属性
          if (p.isSeries) {
            p.seriesExpanded = false;
            p.currentSeriesIndex = 0;
            // 将 seriesBlocks 转换为 seriesPoems 数组
            if (Array.isArray(p.seriesBlocks) && p.seriesBlocks.length > 0) {
              p.seriesPoems = p.seriesBlocks.map(block => ({
                content: block.content || '',
                subtitle: block.subtitle || ''
              }));
            } else {
              p.seriesPoems = [];
            }
          }
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
      console.log('【poem-square】进入只看关注模式');
      
      this.setData({
        showFollowingOnly: true,
        postList: [],
        page: 0,
        hasMore: true,
        isLoading: true,
        followingSelectedUserId: null
      });
      
      // 重新加载数据
      this.getIndexData();
    },

    // 退出关注模式（由头像栏的返回按钮触发）
    exitFollowingMode() {
      console.log('【poem-square】退出只看关注模式');
      
      this.setData({
        showFollowingOnly: false,
        postList: [],
        page: 0,
        hasMore: true,
        isLoading: true,
        followingSelectedUserId: null
      });
      
      // 重新加载数据
      this.getIndexData();
    },

    // 关注头像栏用户选择处理
    onFollowingUserSelect(userId) {
      console.log('【poem-square】选择关注用户:', userId);

      // 如果选择的用户没变，不做处理
      if (this.followingSelectedUserId === userId) {
        return;
      }

      // 更新选中状态并重新加载帖子
      this.setData({
        followingSelectedUserId: userId,
        page: 0,
        hasMore: true,
        isLoading: true
      }, () => {
        this.getIndexData();
      });
    },
    generateRandomBackgroundColor() {
      const result = generateRandomBackgroundColor(this.backgroundColors, this.lastUsedColorIndex);
      this.lastUsedColorIndex = result.index;
      return result.color;
    },
    async getPostList(cb) {
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
          console.log('【poem-square】准备调用关注诗歌API', this.followingSelectedUserId ? `(筛选用户: ${this.followingSelectedUserId})` : '');
          const list = await getFollowingPoems({
            page: this.page,
            pageSize: PAGE_SIZE,
            context: this,
            filterByUserId: this.followingSelectedUserId || undefined,
            // SWR后台更新回调：关注诗歌后台更新完成时调用
            onBackgroundUpdate: async (newPosts) => {
              console.log(' [SWR-PoemSquare-Following] 后台更新完成', newPosts?.length);
              if (Array.isArray(newPosts) && newPosts.length > 0 && this.showFollowingOnly && this.page === 0) {
                try {
                  const visibleList = newPosts.filter(p => p && !p.isAnonymous);
                  visibleList.forEach((p) => {
                    if (!p) return;
                    p.backgroundColor = p.backgroundColor || this.generateRandomBackgroundColor();
                    p.textColor = p.textColor || '#222';
                    p.isExpanded = false;
                    p.authorSignature = p.authorSignature || '';
                    p.likeIcon = likeIcon && likeIcon.getLikeIcon ? likeIcon.getLikeIcon(p.votes || 0, !!p.isVoted) : '';
                    
                    // 初始化组诗相关属性
                    if (p.isSeries) {
                      p.seriesExpanded = false;
                      p.currentSeriesIndex = 0;
                      // 将 seriesBlocks 转换为 seriesPoems 数组
                      if (Array.isArray(p.seriesBlocks) && p.seriesBlocks.length > 0) {
                        p.seriesPoems = p.seriesBlocks.map(block => ({
                          content: block.content || '',
                          subtitle: block.subtitle || ''
                        }));
                      } else {
                        p.seriesPoems = [];
                      }
                    }
                  });
                  
                  // 转换 cloud:// URLs
                  await this.convertCloudUrls(visibleList);
                  
                  // 只在数据有变化时更新
                  const currentPostIds = this.postList.slice(0, PAGE_SIZE).map(p => p._id).join(',');
                  const newPostIds = visibleList.map(p => p._id).join(',');
                  if (currentPostIds !== newPostIds) {
                    const existingLaterPosts = this.postList.slice(PAGE_SIZE);
                    this.setData({
                      postList: [...visibleList, ...existingLaterPosts]
                    });
                    console.log(' [SWR-PoemSquare-Following] 页面数据已后台更新');
                  }
                } catch (error) {
                  console.error(' [SWR-PoemSquare-Following] 处理后台更新数据失败:', error);
                }
              }
            }
          });
          await this.processPostList(list, cb);
          return;
        }

        // 全部模式使用原创诗歌API
        const list = await getOriginalPoems({
          page: this.page,
          pageSize: PAGE_SIZE,
          context: this,
          // SWR后台更新回调：原创诗歌后台更新完成时调用
          onBackgroundUpdate: async (newPosts) => {
            console.log(' [SWR-PoemSquare-Original] 后台更新完成', newPosts?.length);
            if (Array.isArray(newPosts) && newPosts.length > 0 && !this.showFollowingOnly && this.page === 0) {
              try {
                const visibleList = newPosts.filter(p => p && !p.isAnonymous);
                visibleList.forEach((p) => {
                  if (!p) return;
                  p.backgroundColor = p.backgroundColor || this.generateRandomBackgroundColor();
                  p.textColor = p.textColor || '#222';
                  p.isExpanded = false;
                  p.authorSignature = p.authorSignature || '';
                  p.likeIcon = likeIcon && likeIcon.getLikeIcon ? likeIcon.getLikeIcon(p.votes || 0, !!p.isVoted) : '';
                  
                  // 初始化组诗相关属性
                  if (p.isSeries) {
                    p.seriesExpanded = false;
                    p.currentSeriesIndex = 0;
                    // 将 seriesBlocks 转换为 seriesPoems 数组
                    if (Array.isArray(p.seriesBlocks) && p.seriesBlocks.length > 0) {
                      p.seriesPoems = p.seriesBlocks.map(block => ({
                        content: block.content || '',
                        subtitle: block.subtitle || ''
                      }));
                    } else {
                      p.seriesPoems = [];
                    }
                  }
                });
                
                // 转换 cloud:// URLs
                await this.convertCloudUrls(visibleList);
                
                // 只在数据有变化时更新
                const currentPostIds = this.postList.slice(0, PAGE_SIZE).map(p => p._id).join(',');
                const newPostIds = visibleList.map(p => p._id).join(',');
                if (currentPostIds !== newPostIds) {
                  const existingLaterPosts = this.postList.slice(PAGE_SIZE);
                  this.setData({
                    postList: [...visibleList, ...existingLaterPosts]
                  });
                  console.log(' [SWR-PoemSquare-Original] 页面数据已后台更新');
                }
              } catch (error) {
                console.error(' [SWR-PoemSquare-Original] 处理后台更新数据失败:', error);
              }
            }
          }
        });
        
        await this.processPostList(list, cb);
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
    
    async processPostList(list, cb) {
      const visibleList = list.filter(p => p && !p.isAnonymous);
      
      visibleList.forEach((p) => {
        if (!p) return;
        p.backgroundColor = p.backgroundColor || this.generateRandomBackgroundColor();
        p.textColor = p.textColor || '#222';
        p.isExpanded = false;
        // authorSignature已从云函数返回，保留原始值（如果没有则为空字符串）
        p.authorSignature = p.authorSignature || '';
        p.likeIcon = likeIcon && likeIcon.getLikeIcon ? likeIcon.getLikeIcon(p.votes || 0, !!p.isVoted) : '';
        
        // 初始化组诗相关属性
        if (p.isSeries) {
          p.seriesExpanded = false;
          p.currentSeriesIndex = 0;
          // 将 seriesBlocks 转换为 seriesPoems 数组
          if (Array.isArray(p.seriesBlocks) && p.seriesBlocks.length > 0) {
            p.seriesPoems = p.seriesBlocks.map(block => ({
              content: block.content || '',
              subtitle: block.subtitle || ''
            }));
          } else {
            p.seriesPoems = [];
          }
        }
      });
      
      // 客户端安全网：转换任何未转换的 cloud:// URLs
      await this.convertCloudUrls(visibleList);
      
      let newPostList;
      if (this.page === 0) {
        // 第一页：判断是否是用户筛选操作
        const isUserFiltering = this.showFollowingOnly && this.followingSelectedUserId;

        if (isUserFiltering) {
          // 用户筛选时直接替换列表
          newPostList = visibleList;
        } else if (this.postList.length > 0) {
          // 第一页刷新：合并缓存数据
          // 检查是否有新帖子
          const existingIds = new Set(this.postList.map(post => post._id).filter(Boolean));
          const newPosts = visibleList.filter(post => post && post._id && !existingIds.has(post._id));

          if (newPosts.length > 0) {
            // 有新帖子，补充到列表前面（最新的在前面）
            newPostList = [...newPosts, ...this.postList];
            console.log('✅ 【poem-square】合并后的列表长度:', newPostList.length);
          } else {
            // 没有新帖子，保持现有列表，但更新现有帖子的数据（可能有更新）
            const updatedList = this.postList.map(existingPost => {
              const updated = visibleList.find(p => p._id === existingPost._id);
              return updated || existingPost;
            });
            newPostList = updatedList;
          }
        } else {
          // 没有现有列表，直接使用新数据
          newPostList = visibleList;
        }
      } else {
        // 加载更多：合并并去重
        const existingIds = new Set(this.postList.map(post => post._id).filter(Boolean));
        const uniqueNewPosts = visibleList.filter(post => post && post._id && !existingIds.has(post._id));
        newPostList = this.postList.concat(uniqueNewPosts);
        console.log('【poem-square】去重：新帖子', visibleList.length, '去重后', uniqueNewPosts.length);
      }
      
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
      const item = this.postList[index];
      
      if (!item) return;
      
      console.log('【poem-square】点击卡片', { 
        index, 
        isSeries: item.isSeries, 
        seriesExpanded: item.seriesExpanded,
        seriesBlocks: item.seriesBlocks,
        seriesPoems: item.seriesPoems
      });
      
      // 如果是组诗且未展开，则展开组诗
      if (item.isSeries && !item.seriesExpanded) {
        // 确保 seriesPoems 存在
        let seriesPoems = item.seriesPoems;
        if (!seriesPoems || !Array.isArray(seriesPoems) || seriesPoems.length === 0) {
          // 从 seriesBlocks 转换
          if (Array.isArray(item.seriesBlocks) && item.seriesBlocks.length > 0) {
            seriesPoems = item.seriesBlocks.map(block => ({
              content: block.content || '',
              subtitle: block.subtitle || ''
            }));
          } else {
            seriesPoems = [];
          }
        }
        
        console.log('【poem-square】展开组诗', { seriesPoems });
        
        const newPostList = [...this.postList];
        newPostList[index] = {
          ...item,
          seriesExpanded: true,
          currentSeriesIndex: 0,
          seriesPoems: seriesPoems
        };
        this.setData({ postList: newPostList });
        return;
      }
      
      // 普通卡片的展开/折叠
      const newPostList = toggleArrayItemExpansion(this.postList, index);
      this.setData({ postList: newPostList });
    },
    
    // 组诗卡片点击处理
    onSeriesCardTap(e) {
      const index = e.currentTarget.dataset.index;
      const item = this.postList[index];
      
      if (!item || !item.isSeries || !item.seriesExpanded) return;
      
      const currentIndex = item.currentSeriesIndex || 0;
      const nextIndex = currentIndex + 1;
      
      console.log('【poem-square】组诗翻页', { currentIndex, nextIndex, total: item.seriesPoems.length });
      
      // 如果是最后一页，收起组诗
      if (nextIndex >= item.seriesPoems.length) {
        const newPostList = [...this.postList];
        newPostList[index] = {
          ...item,
          seriesExpanded: false,
          currentSeriesIndex: 0
        };
        this.setData({ postList: newPostList });
        return;
      }
      
      // 翻到下一页
      const newPostList = [...this.postList];
      newPostList[index] = {
        ...item,
        currentSeriesIndex: nextIndex
      };
      this.setData({ postList: newPostList });
    },
    
    // 计算组诗卡片的变换效果（已废弃，保留以防其他地方调用）
    getSeriesCardTransform(poemIndex, currentIndex) {
      return 'translateY(0) scale(1)';
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
    
    // 客户端转换 cloud:// URLs 为 HTTP URLs（安全网）
    async convertCloudUrls(posts) {
      if (!posts || posts.length === 0) return;
      
      // 收集所有需要转换的 cloud:// URLs
      const cloudUrls = [];
      posts.forEach(post => {
        if (post.authorSignature && post.authorSignature.startsWith('cloud://')) {
          cloudUrls.push(post.authorSignature);
        }
        if (post.authorAvatar && post.authorAvatar.startsWith('cloud://')) {
          cloudUrls.push(post.authorAvatar);
        }
      });
      
      if (cloudUrls.length === 0) return;
      
      console.log('【poem-square】客户端转换 cloud:// URLs，数量:', cloudUrls.length);
      
      try {
        // 使用 fileUrlCache 批量转换
        const urlMap = await fileUrlCache.getTempUrls(cloudUrls);
        
        // 更新帖子数据
        posts.forEach(post => {
          if (post.authorSignature && urlMap[post.authorSignature]) {
            post.authorSignature = urlMap[post.authorSignature];
          }
          if (post.authorAvatar && urlMap[post.authorAvatar]) {
            post.authorAvatar = urlMap[post.authorAvatar];
          }
        });
        
        console.log('【poem-square】cloud:// URLs 转换完成');
      } catch (error) {
        console.error('【poem-square】cloud:// URLs 转换失败:', error);
      }
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
      // 批量更新：标记投票进行中 + 乐观更新列表
      this.setData({ 
        [`votingInProgress.${postId}`]: true,
        postList: optimisticList 
      });

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
        try { syncLikeStatusForPosts(ids); } catch (_) {}
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
  padding-top: calc(var(--safe-area-top, 44px) + 250rpx); /* 动态计算：安全区域 + 基础间距 */
}

.square-mode-container.with-avatar-bar {
  padding-top: calc(var(--safe-area-top, 44px) + 360rpx); /* 动态计算：安全区域 + 头像栏高度 */
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
  overflow: visible; /* 允许叠层露出 */
  box-shadow: 0 8rpx 8rpx rgba(0, 0, 0, 0.25); /* 0px 4px 4px * 2 */
  transition: transform .3s ease;
  border: none;
  position: relative; /* 为叠层添加定位 */
  padding: 0; /* 避免额外占位 */
}



/* 背景颜色现在通过内联样式动态设置，不再使用固定的CSS类 */

.post-item-wrapper:active { transform: scale(0.98); }
.post-content-navigator { 
  display: block; 
  border-radius: 30rpx; /* 默认完整圆角（折叠态） */
  overflow: hidden;
}

/* 展开态时，post-content-navigator 只保留上方圆角 */
.post-content-navigator.has-vote-section {
  border-radius: 30rpx 30rpx 0 0;
}
.post-item { padding: 26rpx 50rpx 26rpx 60rpx; position: relative; } /* 缩小内边距匹配普通卡 */

/* 组诗外层叠层（同色卡片） - 两张卡片，后一张向左上平移12rpx */
.stacked-series-card { 
  position: relative;
}
.series-layer.layer-1 {
  position: absolute;
  top: -12rpx;
  left: -12rpx;
  right: 12rpx;
  bottom: 12rpx;
  border-radius: 30rpx;
  box-shadow: 0 6rpx 12rpx rgba(0,0,0,0.14);
  z-index: 1;
}
.stacked-series-card .post-content-navigator {
  position: relative;
  z-index: 2; /* 主卡片在最上层 */
}

/* 组诗展开态外层容器 */
.series-expanded-wrapper {
  width: 100%;
  display: flex;
  flex-direction: column;
}

/* 组诗单卡片 */
.series-single-card {
  position: relative;
  width: 100%;
  border-radius: 30rpx 30rpx 0 0; /* 只保留上方圆角 */
  overflow: visible;
  min-height: auto;
}

/* 组诗单卡片的 post-content-navigator 覆盖普通卡片的圆角设置 */
.series-single-card .post-content-navigator {
  border-radius: 30rpx 30rpx 0 0; /* 组诗卡片只保留上方圆角 */
}

/* 组诗展开态的 vote-section 添加下方圆角 */
.series-expanded-wrapper .vote-section {
  border-radius: 0 0 30rpx 30rpx; /* 只保留下方圆角 */
}

/* 组诗展开态的 post-item 调整上下边距 */
.series-single-card .post-item {
  padding: 60rpx 50rpx 60rpx 60rpx; /* 上下边距一致，都是60rpx */
}

/* 组诗页码指示器 */
.series-page-indicator {
  margin: 0 auto 10rpx;
  padding: 0;
  background: transparent;
  border: none;
  color: #333;
  font-size: 24rpx;
  text-align: center;
  width: fit-content;
  align-self: center;
  font-weight: 500;
}

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
  overflow-wrap: break-word; 
}

/* 组诗展开态的内容边距调整 */
.series-single-card .post-content {
  margin: 20rpx 0 20rpx 0; /* 上下边距一致 */
}

/* 组诗副标题样式 */
.series-subtitle {
  font-family: '汇文明朝', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif;
  font-size: 24rpx;
  font-weight: 600;
  margin-bottom: 20rpx;
  opacity: 0.8;
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
  padding: 25rpx 50rpx; 
  border-radius: 0 0 30rpx 30rpx; /* 添加下方圆角 */
}
.actions-left { flex: 1; display: flex; align-items: center; gap: 20rpx; }
.button-group { display: flex; align-items: center; gap: 30rpx; }
.comment-count { display: flex; align-items: center; gap: 8rpx; padding: 10rpx 15rpx; }
.vote-count { display: flex; align-items: center; gap: 8rpx; padding: 10rpx 15rpx; border-radius: 20rpx; background: rgba(255,255,255,.9); box-shadow: 0 2rpx 8rpx rgba(0,0,0,.1); }
.comment-icon { width: 60rpx; height: 60rpx; }
.like-icon { width: 60rpx; height: 60rpx; margin-top: 5px; }

/* 用户签名样式 */
.user-signature {
  position: absolute;
  bottom: 10rpx; /* 从-25rpx调整到10rpx，让签名在内容区域内 */
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
  /* #ifdef MP-WEIXIN */
  image-rendering: -webkit-optimize-contrast; /* 优化小程序图片渲染 */
  /* #endif */
}

/* 组诗展开态的签名位置调整 */
.series-single-card .user-signature {
  bottom: 20rpx; /* 组诗展开态签名位置 */
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
  /* #ifdef MP-WEIXIN */
  image-rendering: -webkit-optimize-contrast; /* 优化小程序图片渲染 */
  /* #endif */
}

.loading-footer { text-align: center; color: #666; padding: 30rpx 0 120rpx; }
.page-indicator { position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); background: rgba(0,0,0,.7); color: #fff; padding: 20rpx 40rpx; border-radius: 40rpx; z-index: 1000; font-size: 28rpx; }
.page-indicator-text { text-align: center; }

/* 只看关注切换按钮 - 在写作入口下方 */
.filter-toggle-container {
  position: absolute;
  top: calc(var(--safe-area-top, 44px) + 160rpx); /* 使用动态变量的安全区域高度，增加40rpx */
  right: 30rpx; /* 改为右对齐 */
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

/* 关注头像栏定位 */
.following-avatar-bar-wrapper {
  position: absolute;
  top: calc(var(--safe-area-top, 44px) + 140rpx); /* 使用动态变量的安全区域高度 */
  left: 0;
  right: 0;
  z-index: 10;
}
</style>






