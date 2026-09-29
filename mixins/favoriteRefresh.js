import { getOpenid } from '@/utils/app-state.js';

// 隐藏页只标脏；前台页合并同一轮变更，并等待原分页请求结束后刷新第一页。
export default {
  data() { return { favoriteRefreshDirty: false, favoritePageVisible: false }; },
  onLoad() {
    this._favoritePageUser = getOpenid();
    this._favoriteRefreshHandler = event => {
      if (event.userId !== getOpenid()) return;
      if (this.acceptFavoriteChange && !this.acceptFavoriteChange(event)) return;
      this.favoriteRefreshDirty = true;
      if (this.applyFavoriteChange) this.applyFavoriteChange(event);
      this.drainFavoriteRefresh();
    };
    uni.$on('favorite-changed', this._favoriteRefreshHandler);
  },
  onShow() {
    this.favoritePageVisible = true;
    if (this._favoritePageUser !== getOpenid()) {
      this._favoritePageUser = getOpenid();
      this.favoriteRefreshDirty = true;
    }
    this.drainFavoriteRefresh();
  },
  onHide() { this.favoritePageVisible = false; },
  onUnload() {
    this.favoritePageVisible = false;
    uni.$off('favorite-changed', this._favoriteRefreshHandler);
  },
  watch: {
    isLoading(value) { if (!value) this.drainFavoriteRefresh(); },
    isLoadingMore(value) { if (!value) this.drainFavoriteRefresh(); }
  },
  methods: {
    drainFavoriteRefresh() {
      if (this._favoriteRefreshScheduled) return;
      this._favoriteRefreshScheduled = true;
      Promise.resolve().then(async () => {
        this._favoriteRefreshScheduled = false;
        if (!this.favoritePageVisible || !this.favoriteRefreshDirty || this.isLoading || this.isLoadingMore) return;
        this.favoriteRefreshDirty = false;
        try { await this.refreshFavoritesAfterChange(); }
        catch (_) { this.favoriteRefreshDirty = true; }
      });
    }
  }
};
