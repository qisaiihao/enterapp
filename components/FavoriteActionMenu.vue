<template>
    <view>
        <AppActionSheet :visible="!!target && !isRemoving" title="收藏操作" variant="plain"
            :items="['放入收藏夹', '取消收藏']" @cancel="$emit('close')" @select="onSelect" />
        <FolderSelector v-if="folderPostId" :show="true" :post-id="folderPostId" @hide="folderPostId = ''" />
    </view>
</template>

<script>
import AppActionSheet from '@/components/overlay/AppActionSheet.vue';
import FolderSelector from '@/components/folder-selector/folder-selector.vue';
import { removeFavorite } from '@/api-cache/profile-actions.js';

export default {
    name: 'FavoriteActionMenu',
    components: { AppActionSheet, FolderSelector },
    emits: ['close', 'removed'],
    props: { target: { type: Object, default: null } },
    data() { return { folderPostId: '', isRemoving: false }; },
    methods: {
        async onSelect(index) {
            if (!this.target || this.isRemoving || (index !== 0 && index !== 1)) return;
            // 退出动画结束后执行；保留 ID 快照，避免列表刷新或父组件关闭菜单后取错条目。
            const target = { ...this.target };
            this.$emit('close');
            if (!target.postId || (index === 1 && !target.favoriteId)) {
                uni.showToast({ title: '收藏信息不完整，请刷新后重试', icon: 'none' });
                return;
            }
            if (index === 0) {
                this.folderPostId = target.postId;
                return;
            }
            this.isRemoving = true;
            uni.showLoading({ title: '取消收藏中...', mask: true });
            try {
                await removeFavorite(target.favoriteId, this, target);
                this.$emit('removed', target);
                uni.showToast({ title: '已取消收藏', icon: 'success' });
            } catch (error) {
                if (error.code === 'FAVORITE_STALE') return;
                uni.showToast({ title: error.message || '取消收藏失败，请重试', icon: 'none' });
            } finally {
                this.isRemoving = false;
                uni.hideLoading();
            }
        }
    }
};
</script>
