Component({
  data: {
    selected: 0,
    color: '#999999',
    selectedColor: '#999999', // 改为灰色，与未选中状态一致
    lastTapTime: 0,
    lastTapIndex: -1,
    doubleTapThreshold: 300,
    list: [
      {
        pagePath: '/pages/index/index',
        text: '广场',
        iconPath: '/static/images/market.png',
        selectedIconPath: '/static/images/marketplus.png'
      },
      {
        pagePath: '/pages/poem-square/poem-square',
        text: '原创',
        iconPath: '/static/images/road.png',
        selectedIconPath: '/static/images/roadplus.png'
      },
      {
        pagePath: '/pages/mountain/mountain',
        text: '读诗',
        iconPath: '/static/images/mountain.png',
        selectedIconPath: '/static/images/mountainplus.png'
      },
      {
        pagePath: '/pages/profile/profile',
        text: '我',
        iconPath: '/static/images/pools.png',
        selectedIconPath: '/static/images/poolsplus.png'
      }
    ]
  },
  
  attached() {
    console.log('=== Custom TabBar attached ===');
    console.log('TabBar initial selected:', this.data.selected);
    // 初始化时同步当前页面
    this.syncSelectedFromCurrentPage();
  },
  
  pageLifetimes: {
    show() {
      // 页面显示时同步选中状态
      console.log('=== TabBar pageLifetimes.show ===');
      this.syncSelectedFromCurrentPage();
    }
  },
  
  methods: {
    // 根据当前页面路径同步选中状态
    syncSelectedFromCurrentPage() {
      const pages = getCurrentPages();
      if (pages.length === 0) return;
      
      const currentPage = pages[pages.length - 1];
      const currentRoute = currentPage.route;
      console.log('当前页面路由:', currentRoute);
      
      // 查找匹配的 tab 索引
      const index = this.data.list.findIndex(item => {
        const pagePath = item.pagePath.replace(/^\//, '');
        return pagePath === currentRoute;
      });
      
      if (index !== -1 && index !== this.data.selected) {
        console.log('同步 TabBar selected 从', this.data.selected, '到', index);
        this.setData({ selected: index });
      }
    },
    
    // 更新选中状态（由页面调用）
    updateSelected(index) {
      console.log('=== TabBar updateSelected 被调用 ===');
      console.log('参数 index:', index, '类型:', typeof index);
      console.log('当前 selected:', this.data.selected);
      
      // 确保 index 是数字类型
      const newIndex = typeof index === 'number' ? index : parseInt(index, 10);
      
      if (isNaN(newIndex)) {
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
      const index = data.index;
      const currentTime = Date.now();
      
      console.log('=== TabBar switchTab ===');
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
