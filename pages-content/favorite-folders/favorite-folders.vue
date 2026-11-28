<template>
    <!-- pages/favorite-folders/favorite-folders.wxml -->
    <view class="favorite-folders-page" :class="{ 'favorite-folders-page--wide': isWideLayout }" :data-app-theme="appThemeMode" :style="appThemeVars">
        <!-- 顶部导航栏 -->
        <view class="favorite-folders-header" :style="{ paddingTop: safeAreaTop + 'px' }">
            <dual-action-top-bar
                title="我的收藏"
                :show-divider="true"
                @left-click="goBack"
                @right-click="showCreateFolder"
                @safe-area-ready="onSafeAreaReady"
            />
        </view>

        <!-- 收藏夹列表 -->
        <scroll-view class="folders-list" :scroll-y="true">
            <view class="folders-content">
                <view v-if="folders.length === 0" class="empty-state">
                    <image class="empty-icon-img" src="/static/images/newicons/collection.png" mode="aspectFit"></image>
                    <text class="empty-text">暂无收藏夹</text>
                    <text class="empty-subtext">创建您的第一个收藏夹吧</text>
                </view>

                <view v-else class="folder-grid" :class="{ 'folder-grid--two-max': folders.length <= 2 }">
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

                        <!-- 收藏夹内容 -->
                        <view :class="'folder-item-simple ' + (folder.isSwipeOpen ? ' swipe-open' : '')"
                              @tap="enterFolder(folder)"
                              @touchstart="onTouchStart"
                              @touchmove="onTouchMove"
                              @touchend="onTouchEnd"
                              :data-index="index">
                            <view class="folder-content">
                                <view class="folder-icon">
                                    <image v-if="folder.coverUrl" class="folder-cover-image" :src="folder.coverUrl" mode="aspectFill"></image>
                                    <image v-else class="folder-default-icon-img" src="/static/images/newicons/collection.png" mode="aspectFit"></image>
                                </view>
                                <view class="folder-info">
                                    <text class="folder-name">{{ folder.name }}</text>
                                    <text class="folder-count">{{ folder.itemCount }} 个收藏</text>
                                </view>
                            </view>
                            <view v-if="isSorting" class="folder-sort-actions">
                                <view
                                    class="folder-sort-btn"
                                    :class="{ disabled: index === 0 }"
                                    @tap.stop.prevent="moveFolder(index, -1)"
                                >
                                    <image
                                        class="folder-sort-icon"
                                        :class="{ 'folder-sort-icon--muted': index === 0 }"
                                        :src="index === 0 ? '/pages-content/static/images/up.png' : '/pages-content/static/images/up_black.png'"
                                        mode="aspectFit"
                                    />
                                </view>
                                <view
                                    class="folder-sort-btn"
                                    :class="{ disabled: index === folders.length - 1 }"
                                    @tap.stop.prevent="moveFolder(index, 1)"
                                >
                                    <image
                                        class="folder-sort-icon"
                                        :class="{ 'folder-sort-icon--muted': index === folders.length - 1 }"
                                        src="/pages-content/static/images/down.png"
                                        mode="aspectFit"
                                    />
                                </view>
                            </view>
                            <view class="folder-more-btn" @tap.stop.prevent="openFolderActionMenu(folder)">
                                <view class="more-menu-dots-small">
                                    <view class="dot-small"></view>
                                    <view class="dot-small"></view>
                                    <view class="dot-small"></view>
                                </view>
                            </view>
                        </view>
                    </view>
                </view>
            </view>
        </scroll-view>

        <!-- 创建收藏夹弹窗 -->
        <AppMotion :visible="showCreateModal" :busy="isCreatingFolder" ref="createMotion" @dismiss="hideCreateModal" mask-class="collection-create-dialog" :mask-dark="appThemeMode === 'dark'" close-on-mask>
            <view class="collection-create-panel app-motion-panel" @tap.stop>
                <view class="collection-create-header">
                    <text class="collection-create-title">新建收藏夹</text>
                </view>
                <view class="collection-create-body" @touchmove.stop>
                    <view class="create-folder-form">
                        <view class="form-item">
                            <view class="form-label">收藏夹名称</view>
                            <input
                                class="folder-name-input"
                                v-model="newFolderName"
                                placeholder="请输入收藏夹名称（最多7个字）"
                                maxlength="7"
                                :disabled="isCreatingFolder"
                            />
                        </view>
                        <view class="form-item">
                            <view class="form-label">收藏夹封面</view>
                            <view class="cover-upload-section">
                                <view v-if="!newFolderCover" class="cover-upload-btn" @tap="chooseNewCoverImage">
                                    <image class="upload-icon-img" src="/static/images/newicons/image.png" mode="aspectFit"></image>
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
                <view class="collection-create-footer">
                    <button class="collection-create-button create-cancel" @tap="$refs.createMotion.dismiss()" :disabled="isCreatingFolder">取消</button>
                    <button class="collection-create-button create-confirm" @tap="createFolder" :disabled="isCreatingFolder || !newFolderName.trim()">{{ isCreatingFolder ? '创建中…' : '创建' }}</button>
                </view>
            </view>
        </AppMotion>

        <!-- 编辑收藏夹弹窗 -->
        <AppMotion :visible="showEditModal" ref="editMotion" @dismiss="hideEditModal" mask-class="collection-create-dialog" :mask-dark="appThemeMode === 'dark'" close-on-mask>
            <view class="collection-create-panel app-motion-panel" @tap.stop>
                <view class="collection-create-header">
                    <text class="collection-create-title">修改收藏夹名字</text>
                </view>
                <view class="collection-create-body" @touchmove.stop>
                    <view class="edit-folder-form">
                        <view class="form-item">
                            <view class="form-label">收藏夹名称</view>
                            <input
                                class="folder-name-input"
                                v-model="editingFolderName"
                                placeholder="请输入收藏夹名称（最多7个字）"
                                maxlength="7"
                            />
                        </view>

                        <view class="form-item">
                            <view class="form-label">收藏夹封面</view>
                            <view class="cover-upload-section">
                                <view v-if="!editingFolderCover" class="cover-upload-btn" @tap="chooseEditCoverImage">
                                    <image class="upload-icon-img" src="/static/images/newicons/image.png" mode="aspectFit"></image>
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
                <view class="collection-create-footer">
                    <button class="collection-create-button create-cancel" @tap="$refs.editMotion.dismiss()">取消</button>
                    <button class="collection-create-button create-confirm" @tap="saveFolderName" :disabled="!editingFolderName.trim()">保存</button>
                </view>
            </view>
        </AppMotion>

        <!-- 底部操作菜单 -->
        <AppActionSheet
            :visible="!!actionMenuFolder"
            title="收藏夹操作"
            :items="actionMenuItems"
            variant="plain"
            @cancel="closeFolderActionMenu"
            @select="handleFolderActionSelect"
        />
    </view>
    <app-overlay-host />
</template>

<script>
import AppMotion from '@/components/overlay/AppMotion.vue';
import AppActionSheet from '@/components/overlay/AppActionSheet.vue';
// pages/favorite-folders/favorite-folders.js
import { captureFavoriteRead } from '@/cache/favorites.js';
import { getFavoriteFolders, createFavoriteFolder, updateFavoriteFolder, updateFavoriteFolderOrder, deleteFavoriteFolder, addFavorite } from '@/api-cache/favorite-actions.js';
import favoriteRefresh from '@/mixins/favoriteRefresh.js';
import { cloudCall } from '../../utils/cloudCall.js';
import { readFileAsBase64 } from '@/utils/fileReader.js';
import { checkLoginOrPrompt } from '@/utils/authHelper.js';
import dualActionTopBar from '@/components/dual-action-top-bar/dual-action-top-bar.vue';

export default {
    mixins: [favoriteRefresh],
    components: { AppMotion,
        AppActionSheet,
        dualActionTopBar
    },
    data() {
        return {
            safeAreaTop: 0,
            folders: [],
            actionMenuFolder: null,
            isSorting: false,
            isLoading: true,
            showCreateModal: false,
            newFolderName: '',
            newFolderCover: '',
            isCreatingFolder: false,
            editingFolder: null,
            showEditModal: false,
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
    computed: {
        actionMenuItems() {
            return this.isSorting ? ['编辑', '完成排序', '删除'] : ['编辑', '排序', '删除'];
        }
    },
    onHide() {
        this.isSorting = false;
        this.actionMenuFolder = null;
    },
    async onLoad() {
        console.log('=== 收藏夹列表页面 onLoad ===');
        
        // 检查登录状态
        const isLoggedIn = await checkLoginOrPrompt({
            content: '查看收藏夹需要登录，请先登录',
            onCancel: () => {
                uni.navigateBack();
            }
        });
        
        if (!isLoggedIn) {
            return;
        }
        
        this._favoriteFoldersReady = true;
        this.loadFolders().catch(() => {});
    },
    methods: {
        acceptFavoriteChange(event) {
            return !event || event.source !== 'favorite-folders:reorder';
        },
        refreshFavoritesAfterChange() {
            if (this._favoriteFoldersReady) return this.loadFolders();
        },
        onSafeAreaReady(height) {
            this.safeAreaTop = height || 0;
        },

        // 统一云函数调用方法
        callCloudFunction(name, data = {}, extraOptions = {}) {
            return cloudCall(name, data, Object.assign({ pageTag: 'favorite-folders', context: this, requireAuth: true }, extraOptions));
        },

        // 返回上一页
        goBack() {
            uni.navigateBack();
        },

        // 进入收藏夹
        enterFolder(folder) {
            // 如果是滑动模式，不处理点击
            if (this.isSwipeMode) {
                this.isSwipeMode = false;
                return;
            }

            if (this.isSorting) {
                this.isSorting = false;
                return;
            }

            if (folder && (folder.isSwipeOpen || this.folders.some(item => item && item.isSwipeOpen))) {
                this.closeAllSwipeActions();
                return;
            }

            // 关闭所有滑动操作
            this.closeAllSwipeActions();

            console.log('=== 点击收藏夹项 ===');
            console.log('folder对象:', folder);

            if (!folder || !folder._id) {
                console.error('错误：folder对象或_id为空');
                uni.showToast({
                    title: '收藏夹信息错误',
                    icon: 'none'
                });
                return;
            }

            const folderId = folder._id;
            const folderName = folder.name;

            console.log('folderId:', folderId);
            console.log('folderName:', folderName);

            const targetUrl = `/pages-content/favorite-content/favorite-content?folderId=${folderId}&folderName=${encodeURIComponent(folderName || '')}`;
            console.log('跳转URL:', targetUrl);

            uni.navigateTo({
                url: targetUrl,
                success: function () {
                    console.log('跳转成功');
                },
                fail: function (err) {
                    console.error('跳转失败:', err);
                    uni.showToast({
                        title: '跳转失败',
                        icon: 'none'
                    });
                }
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
            this.isSorting = false;
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

        // 打开收藏夹底部操作菜单
        openFolderActionMenu(folder) {
            if (!folder) return;
            if (this.isSwipeMode) {
                this.isSwipeMode = false;
                return;
            }
            this.closeAllSwipeActions();
            const latestFolder = this.folders.find(item => item && item._id === folder._id) || folder;
            this.actionMenuFolder = latestFolder;
        },

        // 关闭收藏夹底部操作菜单
        closeFolderActionMenu() {
            this.actionMenuFolder = null;
        },

        // 处理底部操作菜单选择
        handleFolderActionSelect(index) {
            const folder = this.actionMenuFolder;
            this.actionMenuFolder = null;
            if (!folder) return;
            if (index === 0) {
                this.editFolderName(folder);
            } else if (index === 1) {
                this.toggleSortMode();
            } else if (index === 2) {
                this.deleteFolder(folder);
            }
        },

        // 切换排序模式
        toggleSortMode() {
            this.closeAllSwipeActions();
            this.isSorting = !this.isSorting;
        },

        // 上移/下移收藏夹排序
        moveFolder(index, direction) {
            if (this.isSwipeMode) {
                this.isSwipeMode = false;
                return;
            }
            const list = Array.isArray(this.folders) ? this.folders.slice() : [];
            const targetIndex = index + direction;
            if (index < 0 || index >= list.length || targetIndex < 0 || targetIndex >= list.length) {
                return;
            }
            const [moved] = list.splice(index, 1);
            list.splice(targetIndex, 0, moved);
            this.folders = list.map((item, idx) => ({
                ...item,
                isSwipeOpen: false,
                sortOrder: idx
            }));
            const folderIds = this.folders.map(item => item && item._id).filter(Boolean);
            return updateFavoriteFolderOrder(folderIds, this, {
                source: 'favorite-folders:reorder'
            });
        },
        loadFolders() {
            if (this._folderTask && this._folderTask.current()) return this._folderTask.promise;
            const current = captureFavoriteRead(undefined, 'folders');
            const request = (this._folderRequest || 0) + 1;
            this._folderRequest = request;
            this.isLoading = true;
            const promise = getFavoriteFolders(this).then(folders => {
                if (request !== this._folderRequest || !current()) return;
                this.folders = folders.map(folder => ({ ...folder, isSwipeOpen: false }));
                this.favoriteRefreshDirty = false;
            }).catch(error => {
                if (request !== this._folderRequest) return;
                if (error.code === 'FAVORITE_STALE') { this.favoriteRefreshDirty = true; return; }
                uni.showToast({ title: error.message || '加载收藏夹失败', icon: 'none' });
                throw error;
            }).finally(() => {
                if (request === this._folderRequest) {
                    this._folderTask = null;
                    this.isLoading = false;
                }
            });
            this._folderTask = { current, promise };
            return promise;
        },

        // 显示创建收藏夹弹窗
        showCreateFolder() {
            if (this.isCreatingFolder) return;
            this.showCreateModal = true;
            this.newFolderName = '';
            this.newFolderCover = '';
        },

        // 隐藏创建收藏夹弹窗
        hideCreateModal() {
            if (this.isCreatingFolder) return;
            if (this.$refs?.createMotion?.rendered) {
                this.$refs.createMotion.dismiss(this.hideCreateModal);
                return;
            }
            this.showCreateModal = false;
            this.newFolderName = '';
            this.newFolderCover = '';
        },

        chooseNewCoverImage() {
            if (this.isCreatingFolder) return;
            uni.chooseImage({
                count: 1,
                sizeType: ['compressed'],
                sourceType: ['album', 'camera'],
                success: (res) => {
                    if (this.showCreateModal && !this.isCreatingFolder && res.tempFilePaths?.[0]) {
                        this.newFolderCover = res.tempFilePaths[0];
                    }
                },
                fail: (error) => {
                    if (!/cancel/i.test(error.errMsg || '')) {
                        uni.showToast({ title: '选择图片失败', icon: 'none' });
                    }
                }
            });
        },

        async uploadNewCoverImage() {
            if (!this.newFolderCover) return null;
            uni.showLoading({ title: '上传封面中...', mask: true });
            const fileContent = await readFileAsBase64(this.newFolderCover);
            if (!fileContent) throw new Error('封面读取失败，请重试');
            const response = await this.callCloudFunction('upload', {
                cloudPath: `folder_covers/${Date.now()}_new_cover.jpg`,
                fileContent
            });
            if (!response?.result?.success || !response.result.fileID) {
                throw new Error(response?.result?.message || '封面上传失败，请重试');
            }
            return response.result.fileID;
        },

        // 创建收藏夹
        async createFolder() {
            if (this.isCreatingFolder) return;
            const folderName = this.newFolderName.trim();
            if (!folderName) {
                uni.showToast({
                    title: '请输入收藏夹名称',
                    icon: 'none'
                });
                return;
            }

            this.isCreatingFolder = true;
            try {
                const coverUrl = await this.uploadNewCoverImage();
                uni.showLoading({ title: '创建中...', mask: true });
                const result = await createFavoriteFolder(folderName, coverUrl, this);

                if (result && result.success) {
                    uni.showToast({
                        title: '创建成功',
                        icon: 'success'
                    });
                    this.isCreatingFolder = false;
                    this.hideCreateModal();
                    this.loadFolders().catch(() => {});
                } else {
                    uni.showToast({
                        title: result?.message || '创建失败',
                        icon: 'none'
                    });
                }
            } catch (error) {
                if (error.code === 'FAVORITE_STALE') return;
                console.error('创建收藏夹失败:', error);
                uni.showToast({
                    title: error.message || '创建失败',
                    icon: 'none'
                });
            } finally {
                this.isCreatingFolder = false;
                uni.hideLoading();
            }
        },

        // 编辑收藏夹名称
        editFolderName(folder) {
            // 关闭滑动操作
            this.closeAllSwipeActions();

            this.showEditModal = true;
            this.editingFolder = folder;
            this.editingFolderName = folder.name;
            this.editingFolderCover = folder.coverUrl || '';
        },

        // 隐藏编辑弹窗
        hideEditModal() {
            if (this.$refs?.editMotion?.rendered) {
                this.$refs.editMotion.dismiss(this.hideEditModal);
                return;
            }
            this.setData({
                showEditModal: false,
                editingFolder: null,
                editingFolderName: '',
                editingFolderCover: ''
            });
        },

        // 选择编辑封面图片
        chooseEditCoverImage() {
            uni.chooseImage({
                count: 1,
                sizeType: ['compressed'],
                sourceType: ['album', 'camera'],
                success: (res) => {
                    const tempFilePath = res.tempFilePaths[0];
                    console.log('选择的编辑封面图片:', tempFilePath);
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

        // 上传编辑封面图片
        async uploadEditCoverImage() {
            if (!this.editingFolderCover) return null;
            // 只改名称时保留已有封面，不把云端 URL 当作本地文件读取。
            if (this.editingFolderCover === this.editingFolder?.coverUrl) return this.editingFolderCover;

            uni.showLoading({ title: '上传封面中...' });
            const fileContent = await readFileAsBase64(this.editingFolderCover);
            if (!fileContent) throw new Error('封面读取失败，请重试');
            const response = await this.callCloudFunction('upload', {
                cloudPath: `folder_covers/${Date.now()}_edit_cover.jpg`,
                fileContent
            });
            if (!response?.result?.success || !response.result.fileID) {
                throw new Error(response?.result?.message || '封面上传失败，请重试');
            }
            return response.result.fileID;
        },

        // 保存收藏夹名称
        async saveFolderName() {
            const folderName = this.editingFolderName.trim();
            if (!folderName) {
                uni.showToast({
                    title: '请输入收藏夹名称',
                    icon: 'none'
                });
                return;
            }

            if (!this.editingFolder) {
                uni.showToast({
                    title: '参数错误',
                    icon: 'none'
                });
                return;
            }

            try {
                uni.showLoading({ title: '修改中...' });
                
                // 先上传封面图片（如果有的话）
                const coverUrl = await this.uploadEditCoverImage();
                
                const result = await updateFavoriteFolder(this.editingFolder._id, folderName, coverUrl, this);

                if (result && result.success) {
                    uni.showToast({
                        title: '修改成功',
                        icon: 'success'
                    });
                    this.hideEditModal();
                    this.loadFolders().catch(() => {});
                } else {
                    uni.showToast({
                        title: result?.message || '修改失败',
                        icon: 'none'
                    });
                }
            } catch (error) {
                if (error.code === 'FAVORITE_STALE') return;
                console.error('修改收藏夹名称失败:', error);
                uni.showToast({
                    title: '修改失败',
                    icon: 'none'
                });
            } finally {
                uni.hideLoading();
            }
        },

        // 删除收藏夹
        async deleteFolder(folder) {
            // 关闭滑动操作
            this.closeAllSwipeActions();

            if (folder.isDefault) {
                uni.showToast({
                    title: '默认收藏夹不能删除',
                    icon: 'none'
                });
                return;
            }

            uni.showModal({
                title: '确认删除',
                content: `确定要删除收藏夹"${folder.name}"吗？该收藏夹内的收藏记录也会删除，其他收藏夹中的记录不受影响。`,
                success: async (res) => {
                    if (res.confirm) {
                        try {
                            uni.showLoading({ title: '删除中...' });
                            const result = await deleteFavoriteFolder(folder._id, this);

                            if (result && result.success) {
                                uni.showToast({
                                    title: '删除成功',
                                    icon: 'success'
                                });
                                this.loadFolders().catch(() => {});
                            } else {
                                uni.showToast({
                                    title: result?.message || '删除失败',
                                    icon: 'none'
                                });
                            }
                        } catch (error) {
                if (error.code === 'FAVORITE_STALE') return;
                            console.error('删除收藏夹失败:', error);
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
        },

        trueFun() {
            console.log('占位：函数 true 未声明');
        }
    }
};
</script>
<style>
/* pages/favorite-folders/favorite-folders.wxss */
.favorite-folders-page {
    height: 100vh;
    min-height: 100vh;
    box-sizing: border-box;
    background: var(--app-page-bg, #fff);
    color: var(--app-primary-text, #111111);
    display: flex;
    flex-direction: column;
}

.favorite-folders-header {
    height: 100rpx;
    flex-shrink: 0;
    box-sizing: content-box;
}

.folders-list {
    flex: 1;
    min-height: 0;
    height: 0;
}

.folders-content {
    padding: 30rpx;
}

.loading {
    text-align: center;
    padding: 60rpx 0;
    color: var(--app-secondary-text, #666);
    font-size: 28rpx;
}

.empty-state {
    text-align: center;
    padding: 120rpx 0;
}

.empty-icon-img {
    width: 120rpx;
    height: 120rpx;
    margin-bottom: 30rpx;
    opacity: 0.5;
    filter: var(--app-icon-filter, none);
}

.empty-text {
    font-size: 32rpx;
    color: var(--app-primary-text, #333);
    margin-bottom: 20rpx;
    display: block;
}

.empty-subtext {
    font-size: 28rpx;
    color: var(--app-secondary-text, #666);
    display: block;
}

.folder-grid {
    display: flex;
    flex-direction: column;
}

/* 收藏夹项包装器 */
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
    border-bottom: 1rpx solid var(--app-border-color, #f0f0f0);
    width: 100%;
    box-sizing: border-box;
    margin-right: 0;
    padding-right: 0;
    position: relative;
    background-color: var(--app-page-bg, #ffffff);
    z-index: 2;
    transition: transform 0.3s ease;
}

.folder-item-simple.swipe-open {
    transform: translateX(-240rpx);
}

.folder-content {
    flex: 1;
    min-width: 0;
    display: flex;
    align-items: center;
    gap: 20rpx;
}

.folder-icon {
    width: 88rpx;
    height: 88rpx;
    background: var(--app-subtle-surface-bg, #ffffff);
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

.folder-default-icon-img {
    width: 60rpx;
    height: 60rpx;
    filter: var(--app-icon-filter, none);
}

.folder-info {
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 8rpx;
}

.folder-name {
    font-size: 32rpx;
    font-weight: 600;
    color: var(--app-primary-text, #333);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.folder-count {
    font-size: 26rpx;
    color: var(--app-secondary-text, #666);
}

.folder-sort-actions {
    display: flex;
    align-items: center;
    gap: 14rpx;
    flex-shrink: 0;
    margin-right: 4rpx;
}

.folder-sort-btn {
    width: 60rpx;
    height: 60rpx;
    display: flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    border-radius: 14rpx;
}

.folder-sort-btn:not(.disabled):active {
    background: var(--app-control-press-bg, rgba(0, 0, 0, 0.06));
}

.folder-sort-icon {
    display: block;
    flex-shrink: 0;
    width: 44rpx;
    height: 22rpx;
    transform: translateY(-1rpx);
    filter: var(--app-add-action-icon-filter, none);
    opacity: var(--app-add-action-icon-opacity, 1);
}

.folder-sort-icon.folder-sort-icon--muted {
    opacity: 0.32;
}

.folder-more-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24rpx 16rpx 24rpx 28rpx;
    flex-shrink: 0;
    cursor: pointer;
    transition: all 0.2s ease;
}

.folder-more-btn:active {
    transform: scale(0.9);
    opacity: 0.7;
}

.more-menu-dots-small {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 4rpx;
}

.more-menu-dots-small .dot-small {
    width: 8rpx;
    height: 8rpx;
    border-radius: 50%;
    background-color: var(--app-post-menu-dot-color, #666);
}


.load-more {
    text-align: center;
    padding: 40rpx 0;
    color: var(--app-secondary-text, #666);
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
    max-height: 90vh;
    overflow-y: auto;
    box-sizing: border-box;
    background: var(--app-surface-bg, #fff);
    border-radius: 20rpx;
    width: 600rpx;
    padding: 0;
    border: 1rpx solid var(--app-border-color, transparent);
}

.modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 40rpx 40rpx 30rpx;
    border-bottom: 1rpx solid var(--app-border-color, #f0f0f0);
}

.modal-title {
    font-size: 32rpx;
    font-weight: 600;
    color: var(--app-primary-text, #333);
}

.close-btn {
    font-size: 40rpx;
    color: var(--app-muted-text, #999);
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
    border: 2rpx solid var(--app-border-color, #e9ecef);
    border-radius: 12rpx;
    padding: 0 20rpx;
    font-size: 28rpx;
    color: var(--app-primary-text, #333);
    background: var(--app-subtle-surface-bg, #ffffff);
    box-sizing: border-box;
}

.folder-name-input:focus {
    border-color: var(--app-link-color, #333333);
    box-shadow: var(--app-control-focus-ring, 0 0 0 4rpx rgba(0, 0, 0, 0.08));
}

/* 编辑表单样式 */
.edit-folder-form {
    padding: 0 40rpx;
}

.form-item {
    margin-bottom: 30rpx;
}

.form-label {
    font-size: 26rpx;
    color: var(--app-primary-text, #333333);
    margin-bottom: 16rpx;
    font-weight: 500;
}

/* 封面上传样式 */
.cover-upload-section {
    display: flex;
    justify-content: center;
    align-items: center;
}

.cover-upload-btn {
    width: 200rpx;
    height: 200rpx;
    border: 2rpx dashed var(--app-border-color, #e0e0e0);
    border-radius: 12rpx;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    background: var(--app-subtle-surface-bg, #f8f9fa);
}

.upload-icon {
    font-size: 48rpx;
    color: var(--app-muted-text, #999);
    margin-bottom: 8rpx;
}

.upload-text {
    font-size: 24rpx;
    color: var(--app-secondary-text, #666);
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

.cover-preview:hover .cover-overlay,
.cover-preview:active .cover-overlay {
    opacity: 1;
}

.change-text {
    color: #fff;
    font-size: 24rpx;
    font-weight: 500;
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
    background: var(--app-subtle-surface-bg, #f8f9fa);
    color: var(--app-secondary-text, #666);
}

.modal-btn.confirm {
    background: var(--app-control-accent-bg, #333333);
    color: var(--app-control-accent-text, #ffffff);
    border-radius: 44rpx;
    font-weight: 500;
    box-shadow: none;
    min-height: 88rpx;
    box-sizing: border-box;
}

.modal-btn.confirm[disabled] {
    background: var(--app-border-color, #ccc);
    color: var(--app-muted-text, #999);
}
.modal-btn.confirm:active { opacity: 0.65; }

@media screen and (min-width: 600px) {
    .folders-content {
        max-width: 960px;
        margin: 0 auto;
        padding: 24px 24px calc(32px + var(--app-safe-area-bottom, 0px));
        box-sizing: border-box;
    }

    .folder-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 16px;
    }

    .folder-item-wrapper {
        border-radius: 16px;
        border: 1px solid var(--app-border-color, rgba(0, 0, 0, 0.08));
        background: var(--app-elevated-bg, var(--app-surface-bg, #ffffff));
        box-shadow: var(--app-surface-shadow, 0 4px 14px rgba(0, 0, 0, 0.04));
        overflow: hidden;
    }

    .folder-item-simple {
        padding: 18px 14px 18px 18px;
        border-bottom: none;
        background-color: var(--app-elevated-bg, var(--app-surface-bg, #ffffff));
    }
}

@media screen and (min-width: 1024px) {
    .folders-content {
        max-width: 1080px;
    }

    .folder-grid:not(.folder-grid--two-max) {
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 18px;
    }
}

@media screen and (max-height: 500px) {
    .folders-content {
        padding-top: 16px;
        padding-bottom: calc(20px + var(--app-safe-area-bottom, 0px));
    }

    .empty-state {
        padding: 48rpx 0;
    }
}
</style>

<style src="@/styles/collection-create-dialog.css"></style>
