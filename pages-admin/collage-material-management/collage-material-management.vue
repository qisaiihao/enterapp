<template>
  <view class="material-admin">
    <view class="tabs">
      <button v-for="tab in tabs" :key="tab.id" :class="{ active: activeTab === tab.id }" :disabled="busy" @tap="switchTab(tab.id)">{{ tab.name }}</button>
    </view>
    <view v-if="loading" class="state">加载中...</view>
    <view v-else-if="error" class="state">
      <text>{{ error }}</text>
      <button @tap="loadData">重新加载</button>
    </view>
    <template v-else-if="authorized">
      <view class="card">
        <text class="label">上传{{ activeTabLabel }}</text>
        <view class="upload-row">
          <view class="preview" :class="{ empty: !pendingPath }">
            <image v-if="pendingPath" :src="pendingPath" mode="aspectFit" />
            <text v-else>未选择图片</text>
          </view>
          <view class="upload-info">
            <input v-model="name" class="text-input" :maxlength="24" placeholder="素材名称（最多 24 字）" :disabled="busy" />
            <text v-if="pendingInfo" class="meta">{{ pendingInfo.width }} × {{ pendingInfo.height }} px</text>
            <button size="mini" :disabled="busy" @tap="chooseImage">选择图片</button>
          </view>
        </view>
        <view class="group-row">
          <text class="group-label">分组</text>
          <view class="chips">
            <button size="mini" :class="{ chosen: uploadGroupId === '' }" :disabled="busy" @tap="uploadGroupId = ''">未分组</button>
            <button v-for="group in groups" :key="group.id" size="mini" :class="{ chosen: uploadGroupId === group.id }" :disabled="busy" @tap="uploadGroupId = group.id">{{ group.name }}</button>
          </view>
        </view>
        <button class="primary upload-button" :disabled="busy || !pendingPath || !name.trim()" :loading="uploading" @tap="upload">{{ uploading ? '上传中...' : '上传素材' }}</button>
        <text class="hint">{{ activeTab === 'paper' ? '纸片建议使用透明背景的 PNG，最长边不超过 2560 px，文件不超过 5 MB。' : '背景支持 JPG/PNG/WebP，最长边不超过 2560 px，文件不超过 5 MB。' }}</text>
      </view>
      <view class="card">
        <text class="label">分组管理</text>
        <view class="group-create">
          <input v-model="groupName" class="text-input grow" :maxlength="16" :placeholder="editingGroupId ? '修改分组名称' : '新建分组名称（最多 16 字）'" :disabled="busy" />
          <button size="mini" :disabled="busy || !groupName.trim()" :loading="savingGroup" @tap="saveGroup">{{ editingGroupId ? '保存' : '新建' }}</button>
          <button v-if="editingGroupId" size="mini" :disabled="busy" @tap="cancelGroupEdit">取消</button>
        </view>
        <view v-if="!groups.length" class="placeholder">还没有分组，素材会放在“未分组”</view>
        <view v-for="group in groups" :key="group.id" class="group-item">
          <view class="group-info">
            <text class="group-name">{{ group.name }}</text>
            <text class="group-meta">{{ countOf(group) }} 个素材</text>
          </view>
          <view class="group-actions">
            <button size="mini" :disabled="busy" @tap="startRenameGroup(group)">重命名</button>
            <button class="delete" size="mini" :disabled="busy" @tap="removeGroup(group)">删除</button>
          </view>
        </view>
      </view>
      <view class="card">
        <view class="row spread">
          <text class="label">已有{{ activeTabLabel }} · {{ materials.length }}</text>
          <button size="mini" :disabled="busy" @tap="loadData">刷新</button>
        </view>
        <view class="chips filter-chips">
          <button size="mini" :class="{ chosen: filterGroupId === null }" :disabled="busy" @tap="filterGroupId = null">全部</button>
          <button v-if="ungroupedCount" size="mini" :class="{ chosen: filterGroupId === '' }" :disabled="busy" @tap="filterGroupId = ''">未分组</button>
          <button v-for="group in groups" :key="group.id" size="mini" :class="{ chosen: filterGroupId === group.id }" :disabled="busy" @tap="filterGroupId = group.id">{{ group.name }}</button>
        </view>
        <view v-if="!filteredMaterials.length" class="placeholder">{{ materials.length ? '这个分组还没有素材' : '还没有素材' }}</view>
        <view class="material-grid">
          <view v-for="material in filteredMaterials" :key="material.id" class="material-card">
            <image class="material-image" :src="material.previewUrl || material.fileID" mode="aspectFit" />
            <text class="material-name">{{ material.name }}</text>
            <text class="material-meta">{{ groupNameOf(material) }} · {{ material.width }} × {{ material.height }}</text>
            <view class="material-actions">
              <button size="mini" :disabled="busy" @tap="startRename(material)">重命名</button>
              <button size="mini" :disabled="busy" @tap="startMove(material)">移动</button>
              <button class="delete" size="mini" :disabled="busy" :loading="deletingId === material.id" @tap="remove(material)">删除</button>
            </view>
          </view>
        </view>
      </view>
    </template>
    <AppActionSheet :visible="moveSheetVisible" title="移动到分组" :items="moveSheetItems" @cancel="closeMoveSheet" @select="applyMove" />
    <AppDialog :visible="renameVisible" title="重命名素材" editable placeholder="素材名称（最多 24 字）" :initial-value="renameValue" :busy="renaming" confirm-text="保存" @cancel="cancelRename" @confirm="confirmRename" />
  </view>
  <app-overlay-host />
</template>

<script>
import { refreshAdminStatus } from '@/utils/admin.js';
import { uploadFile } from '@/utils/uploader.js';
import fileUrlCache from '@/cache/core/file-url.js';
import AppActionSheet from '@/components/overlay/AppActionSheet.vue';
import AppDialog from '@/components/overlay/AppDialog.vue';
import {
  listAdminCollageMaterials,
  createAdminCollageMaterial,
  updateAdminCollageMaterial,
  deleteAdminCollageMaterial,
  listAdminCollageMaterialGroups,
  createAdminCollageMaterialGroup,
  renameAdminCollageMaterialGroup,
  deleteAdminCollageMaterialGroup
} from '@/api-cache/admin-collage-materials.js';
import { invalidateOfficialMaterials } from '@/api-cache/collage-materials.js';

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const MAX_DIMENSION = 2560;
const ALLOWED_EXTENSIONS = ['jpg', 'png', 'webp'];

export default {
  components: { AppActionSheet, AppDialog },
  data() {
    return {
      tabs: [{ id: 'paper', name: '纸片素材' }, { id: 'background', name: '背景素材' }],
      activeTab: 'paper',
      loading: true, error: '', authorized: false,
      groups: [], materials: [],
      name: '', pendingPath: '', pendingInfo: null, uploading: false, deletingId: '',
      uploadGroupId: '', filterGroupId: null,
      groupName: '', editingGroupId: '', savingGroup: false,
      moveSheetVisible: false, moveTarget: null,
      renameVisible: false, renameTarget: null, renameValue: '', renaming: false
    };
  },
  computed: {
    activeTabLabel() { return this.activeTab === 'paper' ? '纸片' : '背景'; },
    busy() { return this.uploading || Boolean(this.deletingId) || this.savingGroup || this.renaming; },
    ungroupedCount() { return this.materials.filter(material => !material.groupId).length; },
    filteredMaterials() {
      if (this.filterGroupId === null) return this.materials;
      return this.materials.filter(material => (material.groupId || '') === this.filterGroupId);
    },
    moveSheetItems() {
      return [{ text: '未分组', value: '' }, ...this.groups.map(group => ({ text: group.name, value: group.id }))];
    }
  },
  onLoad() { this.loadData(); },
  methods: {
    async loadData() {
      this.loading = true;
      this.error = '';
      try {
        this.authorized = await refreshAdminStatus();
        if (!this.authorized) throw new Error('仅管理员可管理素材，请确认登录账号后重试');
        const [materialResult, groupResult] = await Promise.all([
          listAdminCollageMaterials({ type: this.activeTab, context: this }),
          listAdminCollageMaterialGroups({ type: this.activeTab, context: this })
        ]);
        this.groups = Array.isArray(groupResult.groups) ? groupResult.groups : [];
        if (this.uploadGroupId && !this.groups.some(group => group.id === this.uploadGroupId)) this.uploadGroupId = '';
        if (this.filterGroupId && !this.groups.some(group => group.id === this.filterGroupId)) this.filterGroupId = null;
        await this.resolvePreviews(Array.isArray(materialResult.materials) ? materialResult.materials : []);
      } catch (error) {
        this.error = error.message || '加载失败';
      } finally {
        this.loading = false;
      }
    },
    async resolvePreviews(materials) {
      const fileIDs = materials.map(item => item.fileID).filter(Boolean);
      let urls = {};
      if (fileIDs.length) {
        try { urls = await fileUrlCache.getTempUrls(fileIDs); } catch (_) { urls = {}; }
      }
      this.materials = materials.map(item => ({ ...item, previewUrl: urls[item.fileID] || '' }));
    },
    switchTab(tab) {
      if (this.busy || this.activeTab === tab) return;
      this.activeTab = tab;
      this.resetForm();
      this.filterGroupId = null;
      this.cancelGroupEdit();
      this.loadData();
    },
    resetForm() {
      this.name = '';
      this.pendingPath = '';
      this.pendingInfo = null;
      this.uploadGroupId = '';
    },
    groupNameOf(material) {
      const group = this.groups.find(item => item.id === material.groupId);
      return group ? group.name : '未分组';
    },
    countOf(group) {
      return this.materials.filter(material => material.groupId === group.id).length;
    },
    chooseImage() {
      if (this.busy) return;
      uni.chooseImage({
        count: 1, sizeType: ['original'], sourceType: ['album', 'camera'],
        success: async (result) => {
          const path = result.tempFilePaths && result.tempFilePaths[0];
          if (!path) return;
          const file = result.tempFiles && result.tempFiles[0];
          if (file && file.size > MAX_FILE_SIZE) {
            uni.showToast({ title: '图片不能超过 5 MB', icon: 'none' });
            return;
          }
          try {
            const info = await new Promise((resolve, reject) => uni.getImageInfo({ src: path, success: resolve, fail: reject }));
            const type = String(info.type || 'png').toLowerCase();
            const ext = type === 'jpeg' ? 'jpg' : type;
            if (!ALLOWED_EXTENSIONS.includes(ext)) throw new Error('请选择 JPG、PNG 或 WebP 图片');
            if (Math.max(info.width, info.height) > MAX_DIMENSION) throw new Error(`图片最长边不能超过 ${MAX_DIMENSION} px`);
            this.pendingPath = path;
            this.pendingInfo = { width: info.width, height: info.height, ext };
            if (!this.name.trim()) {
              const fileName = file && typeof file.name === 'string' ? file.name.replace(/\.[^.]+$/, '').trim() : '';
              this.name = (fileName || `${this.activeTabLabel}${this.materials.length + 1}`).slice(0, 24);
            }
          } catch (error) {
            uni.showToast({ title: error.message || '读取图片失败', icon: 'none' });
          }
        },
        fail: (error) => {
          if (!/cancel/i.test(error.errMsg || '')) uni.showToast({ title: '选择图片失败', icon: 'none' });
        }
      });
    },
    async upload() {
      if (this.busy || !this.authorized || !this.pendingPath || !this.pendingInfo) return;
      const name = this.name.trim();
      if (!name) {
        uni.showToast({ title: '请填写素材名称', icon: 'none' });
        return;
      }
      this.uploading = true;
      try {
        const { ext, width, height } = this.pendingInfo;
        const cloudPath = `collage-materials/${this.activeTab}/${Date.now()}_${Math.random().toString(36).slice(2, 10)}.${ext}`;
        const fileID = await uploadFile(cloudPath, this.pendingPath, { context: this });
        if (!fileID || !fileID.startsWith('cloud://')) throw new Error('上传失败，请重试');
        const result = await createAdminCollageMaterial({ type: this.activeTab, name, fileID, width, height, groupId: this.uploadGroupId, context: this });
        invalidateOfficialMaterials();
        this.materials.unshift({ id: result.id || `local-${Date.now()}`, type: this.activeTab, name, fileID, width, height, groupId: this.uploadGroupId, previewUrl: this.pendingPath });
        this.resetForm();
        uni.showToast({ title: '素材已上传', icon: 'success' });
      } catch (error) {
        uni.showToast({ title: error.message || '上传失败', icon: 'none' });
      } finally {
        this.uploading = false;
      }
    },
    async saveGroup() {
      if (this.busy || !this.authorized) return;
      const name = this.groupName.trim();
      if (!name) return;
      this.savingGroup = true;
      const renaming = Boolean(this.editingGroupId);
      try {
        if (renaming) {
          await renameAdminCollageMaterialGroup({ id: this.editingGroupId, name, context: this });
        } else {
          await createAdminCollageMaterialGroup({ type: this.activeTab, name, context: this });
        }
        invalidateOfficialMaterials();
        this.cancelGroupEdit();
        const groupResult = await listAdminCollageMaterialGroups({ type: this.activeTab, context: this });
        this.groups = Array.isArray(groupResult.groups) ? groupResult.groups : [];
        uni.showToast({ title: renaming ? '已重命名' : '分组已创建', icon: 'success' });
      } catch (error) {
        uni.showToast({ title: error.message || '保存分组失败', icon: 'none' });
      } finally {
        this.savingGroup = false;
      }
    },
    startRenameGroup(group) {
      if (this.busy) return;
      this.editingGroupId = group.id;
      this.groupName = group.name;
    },
    cancelGroupEdit() {
      this.editingGroupId = '';
      this.groupName = '';
    },
    async removeGroup(group) {
      if (this.busy || !group) return;
      const confirmed = await new Promise(resolve => uni.showModal({
        title: '删除分组',
        content: `删除分组「${group.name}」？分组下还有素材时不能删除。`,
        success: res => resolve(res.confirm),
        fail: () => resolve(false)
      }));
      if (!confirmed) return;
      this.savingGroup = true;
      try {
        await deleteAdminCollageMaterialGroup({ id: group.id, context: this });
        invalidateOfficialMaterials();
        this.groups = this.groups.filter(item => item.id !== group.id);
        if (this.uploadGroupId === group.id) this.uploadGroupId = '';
        if (this.filterGroupId === group.id) this.filterGroupId = null;
        if (this.editingGroupId === group.id) this.cancelGroupEdit();
        uni.showToast({ title: '已删除分组', icon: 'success' });
      } catch (error) {
        uni.showToast({ title: error.message || '删除分组失败', icon: 'none' });
      } finally {
        this.savingGroup = false;
      }
    },
    startRename(material) {
      if (this.busy || !material) return;
      this.renameTarget = material;
      this.renameValue = material.name;
      this.renameVisible = true;
    },
    cancelRename() {
      this.renameVisible = false;
      this.renameTarget = null;
    },
    async confirmRename(value) {
      const target = this.renameTarget;
      if (!target || this.renaming) return;
      const name = String(value || '').trim();
      if (!name) {
        uni.showToast({ title: '请填写素材名称', icon: 'none' });
        return;
      }
      if (name.length > 24) {
        uni.showToast({ title: '素材名称最多 24 个字', icon: 'none' });
        return;
      }
      if (name === target.name) {
        this.cancelRename();
        return;
      }
      this.renaming = true;
      try {
        await updateAdminCollageMaterial({ id: target.id, name, context: this });
        invalidateOfficialMaterials();
        this.materials = this.materials.map(material => material.id === target.id ? { ...material, name } : material);
        this.cancelRename();
        uni.showToast({ title: '已重命名', icon: 'success' });
      } catch (error) {
        uni.showToast({ title: error.message || '重命名失败', icon: 'none' });
      } finally {
        this.renaming = false;
      }
    },
    startMove(material) {
      if (this.busy || !material) return;
      this.moveTarget = material;
      this.moveSheetVisible = true;
    },
    closeMoveSheet() { this.moveSheetVisible = false; },
    async applyMove(index) {
      this.moveSheetVisible = false;
      const target = this.moveTarget;
      this.moveTarget = null;
      if (!target) return;
      const item = this.moveSheetItems[index];
      if (!item || (target.groupId || '') === item.value) return;
      try {
        await updateAdminCollageMaterial({ id: target.id, groupId: item.value, context: this });
        invalidateOfficialMaterials();
        this.materials = this.materials.map(material => material.id === target.id ? { ...material, groupId: item.value } : material);
        uni.showToast({ title: item.value ? `已移动到「${item.text}」` : '已移出分组', icon: 'success' });
      } catch (error) {
        uni.showToast({ title: error.message || '移动失败', icon: 'none' });
      }
    },
    async remove(material) {
      if (this.busy || !material || !material.id) return;
      const confirmed = await new Promise(resolve => uni.showModal({
        title: '删除素材',
        content: `删除「${material.name}」后，用户将不能再选择它，已导入本机的副本不受影响。`,
        success: res => resolve(res.confirm),
        fail: () => resolve(false)
      }));
      if (!confirmed) return;
      this.deletingId = material.id;
      try {
        await deleteAdminCollageMaterial({ id: material.id, context: this });
        invalidateOfficialMaterials();
        this.materials = this.materials.filter(item => item.id !== material.id);
        uni.showToast({ title: '已删除', icon: 'success' });
      } catch (error) {
        uni.showToast({ title: error.message || '删除失败', icon: 'none' });
      } finally {
        this.deletingId = '';
      }
    }
  }
};
</script>

<style scoped>
.material-admin { min-height: 100vh; box-sizing: border-box; padding: 24rpx; background: #f5f5f5; }
.tabs { display: flex; gap: 16rpx; margin-bottom: 24rpx; }
.tabs button { flex: 1; margin: 0; font-size: 28rpx; background: #fff; color: #555; border-radius: 12rpx; }
.tabs button.active { background: #667eea; color: #fff; }
.card { padding: 28rpx; margin-bottom: 24rpx; background: #fff; border-radius: 16rpx; }
.label { display: block; font-size: 30rpx; font-weight: 600; color: #333; margin-bottom: 20rpx; }
.row { display: flex; align-items: center; }
.spread { justify-content: space-between; }
.upload-row { display: flex; gap: 24rpx; }
.preview { display: flex; align-items: center; justify-content: center; width: 240rpx; height: 240rpx; flex-shrink: 0; background: #f8f8f8; border: 1rpx dashed #ddd; border-radius: 12rpx; color: #999; font-size: 24rpx; }
.preview image { width: 100%; height: 100%; }
.upload-info { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 16rpx; }
.text-input { box-sizing: border-box; width: 100%; height: 72rpx; padding: 0 20rpx; background: #f8f8f8; border-radius: 10rpx; font-size: 28rpx; }
.grow { flex: 1; min-width: 0; }
.meta { font-size: 24rpx; color: #888; }
.group-row { display: flex; align-items: flex-start; gap: 16rpx; margin-top: 24rpx; }
.group-label { flex-shrink: 0; font-size: 28rpx; color: #555; line-height: 60rpx; }
.chips { display: flex; flex-wrap: wrap; gap: 12rpx; }
.chips button { margin: 0; font-size: 26rpx; background: #f2f2f2; color: #555; }
.chips button.chosen { background: #667eea; color: #fff; }
.upload-button { margin-top: 28rpx; font-size: 28rpx; }
.primary { background: #667eea; color: #fff; }
.primary[disabled] { opacity: 0.5; }
.hint { display: block; margin-top: 20rpx; font-size: 24rpx; color: #888; line-height: 1.6; }
.group-create { display: flex; align-items: center; gap: 16rpx; margin-bottom: 20rpx; }
.group-create button { margin: 0; font-size: 26rpx; }
.group-item { display: flex; align-items: center; justify-content: space-between; gap: 16rpx; padding: 20rpx 0; border-bottom: 1rpx solid #f0f0f0; }
.group-item:last-child { border-bottom: none; }
.group-info { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 6rpx; }
.group-name { font-size: 28rpx; color: #333; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.group-meta { font-size: 22rpx; color: #999; }
.group-actions { display: flex; gap: 12rpx; flex-shrink: 0; }
.group-actions button { margin: 0; font-size: 24rpx; }
.delete { color: #c43d3d; background: #fff; }
.placeholder { padding: 40rpx 0; text-align: center; font-size: 28rpx; color: #999; }
.filter-chips { margin-bottom: 20rpx; }
.material-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20rpx; }
.material-card { display: flex; flex-direction: column; gap: 8rpx; padding: 16rpx; border: 1rpx solid #eee; border-radius: 12rpx; min-width: 0; }
.material-image { width: 100%; height: 220rpx; background: #fafafa; border-radius: 8rpx; }
.material-name { font-size: 26rpx; color: #333; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.material-meta { font-size: 22rpx; color: #999; }
.material-actions { display: flex; justify-content: flex-end; gap: 12rpx; margin-top: 4rpx; }
.material-actions button { margin: 0; font-size: 24rpx; }
.state { padding: 100rpx 20rpx; text-align: center; color: #888; }
.state button { margin-top: 30rpx; }
</style>
