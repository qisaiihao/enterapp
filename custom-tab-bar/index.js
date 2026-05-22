const THEME_STORAGE_KEY = 'poementerThemeMode';

const LIGHT_TAB_THEME = {
  color: '#999999',
  selectedColor: '#000000',
  backgroundColor: '#ffffff',
  iconWrapStyle: 'background: #f8f8f8; border-color: transparent; box-shadow: 0 18rpx 32rpx rgba(0, 0, 0, 0.16);',
  iconWrapActiveStyle: 'background: #f8f8f8; border-color: transparent; box-shadow: 0 12rpx 24rpx rgba(0, 0, 0, 0.14), 0 3rpx 8rpx rgba(0, 0, 0, 0.08);',
  iconInnerStyle: 'background: #ffffff;'
};

const DARK_TAB_THEME = {
  color: '#9ea6b2',
  selectedColor: '#f4f1ea',
  backgroundColor: 'rgba(15, 17, 21, 0.96)',
  iconWrapStyle: 'background: rgba(255, 255, 255, 0.07); border-color: rgba(255, 255, 255, 0.10); box-shadow: 0 7px 16px rgba(0, 0, 0, 0.45), 0 1px 4px rgba(255, 255, 255, 0.06);',
  iconWrapActiveStyle: 'background: rgba(255, 255, 255, 0.07); border-color: rgba(255, 255, 255, 0.34); box-shadow: 0 6px 14px rgba(0, 0, 0, 0.40), 0 1px 4px rgba(255, 255, 255, 0.05);',
  iconInnerStyle: 'background: rgba(255, 255, 255, 0.06);'
};

function normalizeRoutePath(path) {
  return String(path || '')
    .split('?')[0]
    .replace(/^\/+/, '')
    .replace(/\/+$/, '');
}

function normalizeTabIndex(index) {
  const nextIndex = typeof index === 'number' ? index : parseInt(index, 10);
  return Number.isNaN(nextIndex) ? null : nextIndex;
}

Component({
  data: {
    selected: 0,
    color: '#999999',
    selectedColor: '#000000',
    lastTapTime: 0,
    lastTapIndex: -1,
    doubleTapThreshold: 300,
    tabBarStyle: '',
    isDark: false,
    iconWrapStyle: LIGHT_TAB_THEME.iconWrapStyle,
    iconWrapActiveStyle: LIGHT_TAB_THEME.iconWrapActiveStyle,
    iconInnerStyle: LIGHT_TAB_THEME.iconInnerStyle,
    list: [
      {
        pagePath: '/pages/index/index',
        text: '广场',
        iconPath: '/static/images/market.png',
        selectedIconPath: '/static/images/marketplus.png',
        darkIconPath: '/static/images/tab-dark/market-dark.png',
        darkSelectedIconPath: '/static/images/tab-dark/marketplus-dark.png'
      },
      {
        pagePath: '/pages/poem-square/poem-square',
        text: '原创',
        iconPath: '/static/images/road.png',
        selectedIconPath: '/static/images/roadplus.png',
        darkIconPath: '/static/images/tab-dark/road-dark.png',
        darkSelectedIconPath: '/static/images/tab-dark/roadplus-dark.png'
      },
      {
        pagePath: '/pages/mountain/mountain',
        text: '读诗',
        iconPath: '/static/images/mountain.png',
        selectedIconPath: '/static/images/mountainplus.png',
        darkIconPath: '/static/images/tab-dark/mountain-dark.png',
        darkSelectedIconPath: '/static/images/tab-dark/mountainplus-dark.png'
      },
      {
        pagePath: '/pages/profile/profile',
        text: '我',
        iconPath: '/static/images/pools.png',
        selectedIconPath: '/static/images/poolsplus.png',
        darkIconPath: '/static/images/tab-dark/pools-dark.png',
        darkSelectedIconPath: '/static/images/tab-dark/poolsplus-dark.png'
      }
    ]
  },
  
  attached() {
    console.log('=== Custom TabBar attached ===');
    console.log('TabBar initial selected:', this.data.selected);
    this.updateTheme();
    this.updateSafeAreaBottom();
    // 初始化时同步当前页面
    this.syncSelectedFromCurrentPage();
  },
  
  pageLifetimes: {
    show() {
      // 页面显示时同步选中状态
      console.log('=== TabBar pageLifetimes.show ===');
      this.updateTheme();
      this.updateSafeAreaBottom();
      this.syncSelectedFromCurrentPage();
    }
  },
  
  methods: {
    getCachedSelected() {
      try {
        return normalizeTabIndex(wx.getStorageSync('currentTabIndex'));
      } catch (error) {
        return null;
      }
    },

    resolveSelectedFromCurrentPage() {
      try {
        const pages = typeof getCurrentPages === 'function' ? getCurrentPages() : [];
        if (!pages || pages.length === 0) return null;

        const currentPage = pages[pages.length - 1];
        const currentRoute = normalizeRoutePath(
          currentPage && (currentPage.route || currentPage.__route__ || (currentPage.$page && currentPage.$page.fullPath))
        );
        if (!currentRoute) return null;

        const index = this.data.list.findIndex(item => {
          const pagePath = normalizeRoutePath(item.pagePath);
          return pagePath === currentRoute || currentRoute.indexOf(pagePath) >= 0;
        });

        return index >= 0 ? index : null;
      } catch (error) {
        return null;
      }
    },

    updateTheme() {
      let mode = 'light';
      try {
        mode = wx.getStorageSync(THEME_STORAGE_KEY) || 'light';
      } catch (error) {}

      const isDark = mode === 'dark';
      const theme = isDark ? DARK_TAB_THEME : LIGHT_TAB_THEME;
      this.setData({
        isDark,
        color: theme.color,
        selectedColor: theme.selectedColor,
        iconWrapStyle: theme.iconWrapStyle,
        iconWrapActiveStyle: theme.iconWrapActiveStyle,
        iconInnerStyle: theme.iconInnerStyle
      }, () => {
        this.updateSafeAreaBottom();
      });
    },

    updateSafeAreaBottom() {
      try {
        const theme = this.data.isDark ? DARK_TAB_THEME : LIGHT_TAB_THEME;
        const tabBarStyle = `background: ${theme.backgroundColor};`;

        if (tabBarStyle !== this.data.tabBarStyle) {
          this.setData({ tabBarStyle });
        }
      } catch (error) {
        if (this.data.tabBarStyle) {
          this.setData({ tabBarStyle: '' });
        }
      }
    },

    // 根据当前页面路径同步选中状态
    syncSelectedFromCurrentPage(options = {}) {
      const routeIndex = this.resolveSelectedFromCurrentPage();
      const cachedIndex = this.getCachedSelected();
      const nextIndex = routeIndex !== null ? routeIndex : cachedIndex;

      if (nextIndex !== null && nextIndex !== this.data.selected) {
        this.setData({ selected: nextIndex });
      }

      if (routeIndex === null && !options.retry) {
        setTimeout(() => {
          this.syncSelectedFromCurrentPage({ retry: true });
        }, 0);
      }
    },
    
    // 更新选中状态（由页面调用）
    updateSelected(index) {
      console.log('=== TabBar updateSelected 被调用 ===');
      console.log('参数 index:', index, '类型:', typeof index);
      console.log('当前 selected:', this.data.selected);
      
      // 确保 index 是数字类型
      const newIndex = normalizeTabIndex(index);
      
      if (newIndex === null) {
        console.error('updateSelected 参数无效:', index);
        return;
      }
      
      if (this.data.selected !== newIndex) {
        console.log('更新 selected 从', this.data.selected, '到', newIndex);
        this.setData({ selected: newIndex }, () => {
          console.log('TabBar selected 已更新为:', this.data.selected);
        });
      } else {
        console.log('TabBar selected 已经是', newIndex, '，无需更新');
      }
    },
    
    switchTab(e) {
      const data = e.currentTarget.dataset;
      const url = data.path;
      const index = normalizeTabIndex(data.index);
      const currentTime = Date.now();
      
      console.log('=== TabBar switchTab ===');
      if (index === null) {
        console.error('TabBar switchTab index invalid:', data.index);
        return;
      }
      console.log('点击 index:', index, 'url:', url);
      
      // 【小程序审核优化】点击"我"时检查登录状态
      if (index === 3) { // "我"的索引是3
        const app = getApp();
        const isLoggedIn = app && app.globalData && app.globalData.isLoggedIn;
        
        if (!isLoggedIn) {
          console.log('⚠️ [TabBar] 用户未登录，提示登录');
          wx.showModal({
            title: '需要登录',
            content: '查看个人主页需要登录，请先登录',
            confirmText: '去登录',
            cancelText: '取消',
            success: (res) => {
              if (res.confirm) {
                // 使用 navigateTo 跳转到登录页
                wx.navigateTo({
                  url: '/pages/login/login'
                });
              }
            }
          });
          return;
        }
      }
      
      // 触觉反馈
      if (wx.vibrateShort) {
        wx.vibrateShort({ type: 'light' });
      }
      
      // 检测双击
      const isDoubleTap = 
        currentTime - this.data.lastTapTime < this.data.doubleTapThreshold && 
        this.data.lastTapIndex === index && 
        this.data.selected === index;
      
      this.setData({ 
        lastTapTime: currentTime, 
        lastTapIndex: index 
      });
      
      // 双击刷新当前页面
      if (isDoubleTap) {
        console.log('检测到双击，刷新页面');
        this.refreshCurrentPage();
        return;
      }
      
      // 立即更新选中状态（在切换前）
      console.log('立即更新 selected 为:', index);
      this.setData({ selected: index });
      try { wx.setStorageSync('currentTabIndex', index); } catch (error) {}
      
      // 切换tab
      wx.switchTab({ 
        url: url,
        success: () => {
          console.log('tabBar切换成功:', url, '当前 selected:', this.data.selected);
        },
        fail: (err) => {
          console.error('tabBar切换失败:', err);
        }
      });
    },
    
    refreshCurrentPage() {
      const pages = getCurrentPages();
      const currentPageInstance = pages[pages.length - 1];
      if (!currentPageInstance) return;
      
      const currentPage = this.data.list[this.data.selected];
      const pagePath = currentPage.pagePath.replace(/^\//, '');
      
      console.log('双击刷新页面:', pagePath);
      
      // 根据不同页面调用不同的刷新方法
      switch (pagePath) {
        case 'pages/index/index':
          if (currentPageInstance.refreshData) {
            currentPageInstance.refreshData();
          } else {
            wx.startPullDownRefresh();
          }
          break;
        case 'pages/poem-square/poem-square':
          if (currentPageInstance.refreshPoemData) {
            currentPageInstance.refreshPoemData();
          } else {
            wx.startPullDownRefresh();
          }
          break;
        case 'pages/mountain/mountain':
          if (currentPageInstance.refreshMountainData) {
            currentPageInstance.refreshMountainData();
          } else {
            wx.startPullDownRefresh();
          }
          break;
        case 'pages/profile/profile':
          wx.startPullDownRefresh();
          break;
        default:
          wx.startPullDownRefresh();
      }
    }
  }
});
