import { getOpenid } from '@/utils/app-state.js';

export default {
  onLoad() {
    this._detailFavoriteHandler = event => {
      if (event.userId !== getOpenid() || (event.postId && event.postId !== this.currentPostId)) return;
      if (event.kind === 'folder-created' || event.kind === 'folder-updated') return;
      // 删除记录后是否仍在其他夹中未知，不伪造“全部取消收藏”。
      this.isFavorited = typeof event.favored === 'boolean' ? event.favored : null;
      if (this.post) {
        const post = { ...this.post };
        if (typeof event.favored === 'boolean') post.isFavorited = event.favored;
        else delete post.isFavorited;
        this.post = post;
      }
      this.favoriteButtonText = this.isFavorited ? '已收藏' : '收藏';
      this.favoriteButtonClass = this.isFavorited ? 'favorite-button favorited' : 'favorite-button';
    };
    uni.$on('favorite-changed', this._detailFavoriteHandler);
  },
  onUnload() { uni.$off('favorite-changed', this._detailFavoriteHandler); }
};
