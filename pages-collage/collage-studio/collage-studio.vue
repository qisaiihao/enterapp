<template>
  <view class="studio" :class="{ 'cut-screen': activeTab === 'cut' }" :style="mpNavStyle">
    <view class="studio-nav">
      <button class="back" aria-label="返回" @tap="goBack">‹</button>
      <view class="tabs">
        <button v-for="tab in tabs" :key="tab.id" :class="{ active: activeTab === tab.id }" :disabled="isBusy" @tap="switchTab(tab.id)">{{ tab.name }}</button>
      </view>
    </view>
    <view v-if="error" class="notice" role="alert">{{ error }}</view>
    <view v-if="savingError" class="notice">{{ savingError }}<button size="mini" @tap="persist">重试保存</button></view>

    <view v-show="activeTab === 'cut'" class="section cut-section">
      <scroll-view class="source-strip" scroll-x>
        <view class="source-thumbs">
          <view v-for="source in workspace.sources" :key="source.id" class="source-thumb-wrap">
            <image class="source-thumb" :class="{ chosen: source.id === sourceId }" :src="urls[source.id]" mode="aspectFill" @tap="selectSource(source.id)" />
            <button class="source-remove" :disabled="isBusy" hover-class="none" aria-label="删除这张原图" @tap.stop="deleteSource(source)">×</button>
          </view>
          <button class="source-add" :disabled="isBusy" aria-label="导入图片" @tap="importImage">＋</button>
        </view>
      </scroll-view>
      <view v-if="!currentSource" class="empty" @tap="importImage"><text class="empty-mark">＋</text><text>导入一页书、一张试卷或一张照片</text><text class="muted">框选喜欢的文字和图案，存成自己的纸片</text></view>
      <template v-else>
        <view class="row mode-row">
          <button size="mini" :class="{ selected: mode === 'manual' }" :disabled="isBusy" @tap="setMode('manual')">手动框选</button>
          <button size="mini" :class="{ selected: mode === 'ocr' }" :disabled="isBusy" @tap="setMode('ocr')">识字选取</button>
        </view>
        <template v-if="mode === 'manual'">
        <text class="hint">{{ pan ? '滑动查看图片，双指缩放；关闭移动后可以框选' : '单指框选、移动选框或拖动四角；双指缩放、移动图片' }}</text>
        <view class="image-scroll" @touchstart.stop.prevent="startSourceTouch" @touchmove.stop.prevent="moveSourceTouch" @touchend.stop="endSourceTouch" @touchcancel.stop="cancelSourceTouch"
          @mousedown="startCrop($event, 'draw')" @mousemove="moveCrop" @mouseup="endCrop" @mouseleave="endCrop">
          <view id="collage-source-stage" class="source-stage" :style="sourceStageStyle">
            <image class="source-image" :src="urls[sourceId]" mode="scaleToFill" @load="measureSource" />
          </view>
          <view v-if="crop && !pan" class="crop-box" :style="cropStyle" @touchstart.stop.prevent="startSourceTouch($event, 'move')" @mousedown.stop="startCrop($event, 'move')">
            <view v-for="corner in corners" :key="corner" :class="['handle', corner]" @touchstart.stop.prevent="startSourceTouch($event, corner)" @mousedown.stop="startCrop($event, corner)" />
          </view>
        </view>
        <view class="row"><text class="muted">放大 {{ zoom }}%</text><slider class="grow zoom-slider" :min="100" :max="300" :value="zoom" :disabled="isBusy" activeColor="#3d5547" @changing="changeZoom($event, true)" @change="changeZoom" @touchcancel="zoomGesture = null"/><button size="mini" :class="{ selected: pan }" @tap="togglePan">{{ pan ? '框选' : '移动' }}</button><button size="mini" :disabled="isBusy" @tap="rotateSource">旋转</button></view>
        </template>

        <view v-if="mode === 'ocr'" class="ocr-panel">
          <button v-if="!currentOcr && !isBusy" size="mini" @tap="recognize">重试识别</button>
          <scroll-view class="ocr-lines" scroll-y>
          <template v-if="currentOcr">
            <text v-if="!currentOcr.lines.length" class="hint">没有识别到文字，可以改用手动框选。</text>
            <view v-for="line in currentOcr.lines" :key="line.id" class="ocr-line">
              <view class="characters" v-if="line.chars.length">
                <text v-for="(char, index) in line.chars" :key="index" class="character" :class="{ picked: isPicked(line.id, index), unavailable: !char.polygon }" @tap="pickCharacter(line, index)">{{ char.text }}</text>
              </view>
              <text v-else class="line-text">{{ line.text }}</text>
              <button size="mini" :disabled="isBusy || !line.polygon" @tap="pickLine(line)">整行</button>
            </view>
          </template>
          </scroll-view>
            <view v-if="currentOcr && ocrSelections.length" class="ocr-selections">
              <view class="row spread"><text class="muted">已选 {{ ocrSelections.length }} 段</text><button size="mini" class="text-button" :disabled="isBusy" @tap="clearOcrSelections">清空</button></view>
              <scroll-view class="selection-scroll" scroll-x>
              <view class="selection-chips">
                <view v-for="part in ocrSelections" :key="part.id" class="selection-chip" :class="{ active: selection && selection.id === part.id }">
                  <button class="selection-label" :disabled="isBusy" @tap="activateOcrSelection(part)">{{ part.text || '框选区域' }}</button>
                  <button class="selection-remove" :disabled="isBusy" aria-label="取消这段文字" @tap="removeOcrSelection(part.id)">×</button>
                </view>
              </view>
              </scroll-view>
            </view>
        </view>

        <view class="cut-settings">
          <view class="edge-controls">
            <view class="row edge-options"><button v-for="edge in edges" :key="edge.id" size="mini" :disabled="isBusy" :class="{ selected: edgeStyle === edge.id }" @tap="setEdge(edge.id)">{{ edge.name }}</button></view>
            <view v-if="mode === 'ocr'" class="row padding-row"><text class="muted">留白 {{ padding }} px</text><slider class="grow padding-slider" :min="0" :max="48" :value="padding" :disabled="isBusy" activeColor="#3d5547" @changing="setPadding" @change="setPadding"/></view>
          </view>
          <view class="cut-preview" :class="{ 'preview-empty': !cutPreview }"><image v-if="cutPreview" :src="cutPreview" mode="aspectFit" /></view>
          <view class="row cut-actions">
            <button v-if="edgeStyle === 'torn'" class="grow" :disabled="isBusy || !crop" @tap="rerollTornEdge">换一种撕边</button>
            <button class="primary grow" :disabled="isBusy || (!crop && !(mode === 'ocr' && ocrSelections.length))" :loading="busy === 'save-cut'" @tap="saveCut">{{ mode === 'ocr' && ocrSelections.length > 1 ? '一次制作 ' + ocrSelections.length + ' 张' : '加入素材库' }}</button>
          </view>
        </view>
      </template>
    </view>

    <view v-show="activeTab === 'library'" class="section">
      <view class="row spread"><text class="section-title">我的纸片 · {{ workspace.materials.length }}</text><button size="mini" @tap="switchTab('cut')">继续裁切</button></view>
      <text class="hint">素材保存在当前设备，清理应用数据会移除素材和草稿。</text>
      <view v-if="!workspace.materials.length" class="empty"><text>还没有纸片</text><text class="muted">先从一张图片里剪下喜欢的部分</text></view>
      <view class="material-grid">
        <view v-for="material in workspace.materials" :key="material.id" class="material-card">
          <view class="material-image"><image :src="urls[material.id]" mode="aspectFit" @tap="addToBoard(material)" /></view>
          <view class="material-actions">
            <button class="material-action" aria-label="放到画布" :disabled="isBusy || !urls[material.id]" hover-class="none" @tap="addToBoard(material)"><image src="/static/images/newicons/add.png" mode="aspectFit" /></button>
            <button class="material-action" aria-label="删除" :disabled="isBusy" hover-class="none" @tap="deleteMaterial(material)"><image src="/static/images/newicons/delete.png" mode="aspectFit" /></button>
          </view>
        </view>
      </view>
      <view class="official-section">
        <view class="row spread">
          <text class="section-title">官方纸片</text>
          <button size="mini" :disabled="isBusy || officialLibraries.paper.loading" @tap="openOfficialPicker('paper')">{{ officialLibraries.paper.loading ? '加载中…' : '打开素材库' }}</button>
        </view>
        <text class="hint">按分组挑选官方纸片，加入画布后会保存到本机素材库，可继续移动和缩放。</text>
        <text v-if="officialLibraries.paper.error" class="official-error">{{ officialLibraries.paper.error }}</text>
      </view>
    </view>

    <view v-show="activeTab === 'board'" class="section">
      <view id="collage-board" class="board" :style="boardStyle" @tap.self="selectedItemId = ''">
        <image v-if="backgroundImageUrl" class="board-background" :src="backgroundImageUrl" mode="aspectFill" />
        <view class="row history-actions" @tap.stop>
          <button class="history-button" aria-label="后退" :disabled="isBusy || !history.length" @tap.stop="undo"><image src="/static/images/newicons/back.png" mode="aspectFit" /></button>
          <button class="history-button" aria-label="前进" :disabled="isBusy || !redoHistory.length" @tap.stop="redo"><image class="forward-icon" src="/static/images/newicons/back.png" mode="aspectFit" /></button>
        </view>
        <view v-for="item in workspace.items" :key="item.id" class="board-piece" :class="{ focused: selectedItemId === item.id }" :style="itemStyle(item)"
          @tap.stop="selectedItemId = item.id" @touchstart.stop="startItem($event, item)" @touchmove.stop.prevent="moveItem" @touchend="endItem" @touchcancel="endItem"
          @mousedown.stop.prevent="startItem($event, item)" @mousemove.stop="moveItem" @mouseup="endItem" @mouseleave="endItem">
          <image :src="urls[item.materialId]" mode="scaleToFill" />
        </view>
        <text v-if="!workspace.items.length" class="board-empty">将收藏的纸片放在这里</text>
        <button class="board-background-add" aria-label="更换画布背景" :disabled="isBusy" hover-class="none" @tap.stop="openBackgroundSheet">
          <image src="/static/images/newicons/add.png" mode="aspectFit" />
        </button>
      </view>
      <view v-if="selectedItem" class="item-controls">
        <view class="row"><text class="muted">大小</text><slider class="grow size-slider" :min="40" :max="850" :value="Math.round(selectedItem.width)" :disabled="isBusy" activeColor="#3d5547" @changing="resizeItem($event, true)" @change="resizeItem" @touchcancel="endItemAdjustment"/></view>
        <view class="row"><text class="muted">角度 {{ Math.round(selectedItem.rotation) }}°</text><slider class="grow rotation-slider" :min="-180" :max="180" :value="selectedItem.rotation" :disabled="isBusy" activeColor="#3d5547" @changing="rotateItem($event, true)" @change="rotateItem" @touchcancel="endItemAdjustment"/></view>
      </view>
      <view class="row background-row">
        <view class="row background-colors"><text class="muted">底纸</text><view v-for="color in backgrounds" :key="color" class="swatch" :class="{ chosen: !workspace.backgroundImage && workspace.background === color }" :style="{ background: color }" @tap="setBackground(color)"/></view>
        <view class="row layer-actions">
          <button size="mini" :disabled="isBusy || !selectedItem" @tap="layerItem(true)">置顶</button>
          <button size="mini" :disabled="isBusy || !selectedItem" @tap="layerItem(false)">置底</button>
          <button size="mini" :disabled="isBusy || !selectedItem" @tap="removeItem">删除</button>
        </view>
      </view>
      <scroll-view scroll-x class="board-tray"><view class="source-thumbs"><image v-for="material in workspace.materials" :key="material.id" :src="urls[material.id]" mode="aspectFit" @tap="addToBoard(material, false)" /></view></scroll-view>
      <view class="row"><button class="grow" :disabled="isBusy || !workspace.items.length" :loading="busy === 'export'" @tap="downloadImage">下载</button><button class="primary grow" :disabled="isBusy || !workspace.items.length" :loading="busy === 'export'" @tap="publishImage">发布</button></view>
      <view v-if="exportedImage" class="export-panel"><image :src="exportedImage" mode="widthFix" @tap="previewExport"/><text class="hint">作品图片 900 × 1200，下载和发布都会按当前画布重新生成</text></view>
    </view>
    <view v-if="busy" class="busy">{{ busyText }}</view>
    <canvas canvas-id="collage-render" id="collage-render" class="render-canvas" :width="renderWidth" :height="renderHeight" :style="{ width: renderWidth + 'px', height: renderHeight + 'px' }" />
    <AppActionSheet :visible="backgroundSheetVisible" title="更换画布背景" :items="backgroundSheetItems" @cancel="closeBackgroundSheet" @select="selectBackgroundAction" />
    <OfficialMaterialPicker :show="officialPickerVisible" :title="officialPickerTitle" :groups="officialPickerLibrary.groups" :loading="officialPickerLibrary.loading" :portrait="officialPickerType === 'background'" :error="officialPickerLibrary.error" :empty-text="officialPickerEmptyText" :selected-id="officialPickerSelectedId" @close="closeOfficialPicker" @select="applyOfficialMaterial" />
    <app-overlay-host />
  </view>
</template>

<script>
import { BOARD, bounds, clamp, clipRect, dragRect, randomEdgeSeed, selectionRect, uid } from '@/utils/collage/geometry.js';
import { emptyWorkspace, workspaceKey, loadWorkspace, saveWorkspace, persistFile, resolveFile, removeFile, releaseFiles } from '@/utils/collage/storage.js';
import { normalizeImage, rotateImage, renderCut, renderBoard, renderOcrRegion } from '@/utils/collage/renderer.js';
import { ocrRegionKey, placeRegionOcr } from '@/utils/collage/ocrRegion.js';
import { recognizeCollageSource, deleteCollageSource } from '@/api-cache/collage-ocr.js';
import { getOfficialMaterials } from '@/api-cache/collage-materials.js';
import { importOfficialImage } from '@/utils/collage/official.js';
import { createCollageLogger } from '@/utils/collage/debug.js';
import { getCollageNavStyle } from '@/utils/collage/nav.js';
import AppActionSheet from '@/components/overlay/AppActionSheet.vue';
import OfficialMaterialPicker from '@/components/OfficialMaterialPicker.vue';

const log = createCollageLogger('studio');

export default {
  components: { AppActionSheet, OfficialMaterialPicker },
  data() {
    return {
      tabs: [{ id: 'cut', name: '裁切' }, { id: 'library', name: '素材库' }, { id: 'board', name: '拼贴' }],
      edges: [{ id: 'straight', name: '直切' }, { id: 'scissors', name: '剪纸' }, { id: 'torn', name: '撕纸' }],
      corners: ['nw', 'ne', 'sw', 'se'], backgrounds: ['#f5f0e6', '#ffffff', '#dfdfd6', '#d9e2dc', '#292b29'],
      backgroundSheetItems: [
        { text: '上传自己的图片', description: '从相册或相机选择一张图片' },
        { text: '使用素材库', description: '从官方背景素材中选择' }
      ],
      backgroundSheetVisible: false, staleBackgroundFiles: [],
      officialLibraries: {
        paper: { groups: [], loading: false, error: '', loaded: false },
        background: { groups: [], loading: false, error: '', loaded: false }
      },
      officialPickerVisible: false, officialPickerType: 'paper',
      activeTab: 'cut', mode: 'manual', workspace: emptyWorkspace(), storageKey: '', urls: {}, sourceId: '',
      crop: null, manualCrop: null, ocrRegion: null, cropGesture: null, sourceRect: null, zoom: 100, pan: false, viewWidth: 340,
      sourceScroll: { x: 0, y: 0 }, sourceViewportHeight: 360, sourceGesture: null, zoomGesture: null,
      edgeStyle: 'torn', padding: 6, edgeSeed: 1, edgeVersion: 2, lastSavedEdgeSeed: null, materialName: '', cutPreview: '', selection: null, ocrSelections: [], batchProgress: null,
      previewTimer: null, previewTask: null, previewRevision: 0, previewQueued: false,
      busy: '', error: '', savingError: '', renderWidth: 1, renderHeight: 1, history: [], redoHistory: [],
      selectedItemId: '', itemGesture: null, itemAdjustment: null, exportedImage: '', disposed: false,
      mpNavStyle: null
    };
  },
  computed: {
    // uni Boolean props treat an empty string as true; keep task names separate.
    isBusy() { return Boolean(this.busy); },
    currentSource() { return this.workspace.sources.find(source => source.id === this.sourceId); },
    ocrSource() { return this.ocrRegion ? this.currentSource?.ocrRegions?.find(region => region.regionKey === ocrRegionKey(this.ocrRegion)) : this.currentSource; },
    currentOcr() { return this.ocrSource?.ocr; },
    sourceScale() { return this.currentSource ? this.viewWidth * this.zoom / 100 / this.currentSource.width : 1; },
    // Pan and zoom use transforms on a fixed layout so the bitmap and native views are never
    // resized during a gesture; resizing them per frame makes mini-program devices flicker.
    sourceStageStyle() { return this.currentSource ? {
      width: this.viewWidth + 'px',
      height: this.currentSource.height * this.viewWidth / this.currentSource.width + 'px',
      transform: `translate(${-this.sourceScroll.x}px, ${-this.sourceScroll.y}px) scale(${this.zoom / 100})`
    } : {}; },
    cropStyle() { return this.crop ? { left: this.crop.x * this.sourceScale - this.sourceScroll.x + 'px', top: this.crop.y * this.sourceScale - this.sourceScroll.y + 'px', width: this.crop.width * this.sourceScale + 'px', height: this.crop.height * this.sourceScale + 'px' } : {}; },
    effectivePadding() { return this.mode === 'ocr' ? this.padding : 0; },
    cutBounds() { return this.crop && this.currentSource ? clipRect(this.crop, this.currentSource.width, this.currentSource.height, this.effectivePadding) : null; },
    previewKey() { return this.cutBounds && !this.cropGesture ? JSON.stringify([this.sourceId, this.mode, this.cutBounds, this.edgeStyle, this.edgeSeed, this.edgeVersion]) : ''; },
    boardScale() { return this.viewWidth / BOARD.width; },
    boardStyle() { return { width: this.viewWidth + 'px', height: BOARD.height * this.boardScale + 'px', background: this.workspace.background }; },
    backgroundImageUrl() { const background = this.workspace.backgroundImage; return background ? this.urls[background.id] || '' : ''; },
    officialPickerLibrary() { return this.officialLibraries[this.officialPickerType] || { groups: [], loading: false, error: '' }; },
    officialPickerTitle() { return this.officialPickerType === 'background' ? '官方背景' : '官方纸片'; },
    officialPickerEmptyText() { return this.officialPickerType === 'background' ? '官方素材库暂时没有背景' : '官方素材库暂时没有纸片'; },
    officialPickerSelectedId() { return this.officialPickerType === 'background' ? (this.workspace.backgroundImage?.officialId || '') : ''; },
    selectedItem() { return this.workspace.items.find(item => item.id === this.selectedItemId); },
    busyText() { if (this.batchProgress) return `正在制作纸片 ${this.batchProgress.current}/${this.batchProgress.total}…`; return ({ import: '正在准备图片…', rotate: '正在旋转图片…', background: '正在准备背景…', official: '正在获取官方素材…', ocr: '正在识别文字…', 'delete-source': '正在删除原图…', 'save-cut': '正在保存纸片…', preview: '正在生成预览…', export: '正在导出作品…', load: '正在打开素材库…' })[this.busy] || '正在处理…'; }
  },
  watch: {
    previewKey() { this.queuePreview(); }
  },
  onLoad(query) { log.info('进入拼贴工作台', { tab: query.tab || 'cut' }); this.mpNavStyle = getCollageNavStyle(); if (query.tab === 'board') this.activeTab = 'board'; },
  onReady() { this.viewWidth = Math.min(640, uni.getSystemInfoSync().windowWidth - 32); log.debug('页面就绪', { viewWidth: this.viewWidth }); this.measureSource(); },
  onShow() { log.debug('页面显示', { storageKey: this.storageKey }); if (!this.busy && this.storageKey !== workspaceKey()) this.restore(); },
  onHide() { log.debug('页面隐藏'); this.cancelSourceTouch(); this.endItem(); this.endItemAdjustment(); },
  onUnload() { log.info('离开拼贴工作台'); this.disposed = true; this.cancelPreview(); this.cleanupStaleBackgroundFiles(); releaseFiles(); },
  methods: {
    async run(task, action) {
      if (this.busy) { log.debug('任务被占用，忽略', { task, busy: this.busy }); return; }
      this.busy = task; this.error = '';
      this.cancelPreview();
      const started = Date.now();
      log.info(`任务开始 ${task}`);
      try { await this.previewTask; return await action(); }
      catch (error) { log.error(`任务失败 ${task}`, { elapsed: Date.now() - started, error }); this.error = error.message || error.errMsg || '操作失败，请重试'; }
      finally {
        log.debug(`任务结束 ${task}`, { elapsed: Date.now() - started, error: this.error });
        this.busy = ''; if (task === 'save-cut') this.previewQueued = false; else if (this.previewQueued) this.queuePreview();
      }
    },
    persist() {
      try { saveWorkspace(this.storageKey, this.workspace); this.savingError = ''; return true; }
      catch (error) { log.error('草稿保存失败', { storageKey: this.storageKey, error }); this.savingError = '草稿未能保存，请检查存储空间后重试，暂时不要退出。'; return false; }
    },
    async restore() {
      await this.run('load', async () => {
        this.cleanupStaleBackgroundFiles();
        releaseFiles(); this.urls = {}; this.history = []; this.redoHistory = []; this.exportedImage = ''; this.selectedItemId = '';
        this.storageKey = workspaceKey(); this.workspace = loadWorkspace(this.storageKey);
        log.info('恢复本机草稿', { storageKey: this.storageKey, sources: this.workspace.sources.length, materials: this.workspace.materials.length, items: this.workspace.items.length });
        for (const item of [...this.workspace.sources, ...this.workspace.materials]) {
          try { this.urls[item.id] = await resolveFile(item.file); } catch (error) { log.warn('本机素材丢失', { id: item.id, file: item.file, error }); this.error = '部分本机素材已丢失，请重新导入或删除失效素材。'; }
        }
        const background = this.workspace.backgroundImage;
        if (background) {
          try { this.urls[background.id] = await resolveFile(background.file); } catch (error) { log.warn('画布背景丢失', { id: background.id, file: background.file, error }); this.error = '画布背景图已丢失，请重新设置。'; }
        }
        this.sourceId = this.workspace.sources[0]?.id || ''; this.resetCut();
      });
    },
    goBack() { log.debug('返回上一页'); if (!this.busy && !this.savingError) uni.navigateBack(); },
    switchTab(tab) { if (this.busy) return; log.debug('切换标签', { tab }); this.cancelSourceTouch(); this.activeTab = tab; if (tab === 'library' && !this.officialLibraries.paper.loaded) this.loadOfficialLibrary('paper'); this.$nextTick(() => this.measureSource()); },
    async importImage() {
      if (this.busy) return;
      log.info('选择原图');
      const selected = await new Promise(resolve => uni.chooseImage({ count: 1, sizeType: ['original'], sourceType: ['album', 'camera'], success: resolve, fail: (error) => { log.warn('选择原图失败或取消', error); resolve(null); } }));
      if (!selected) return;
      const path = selected.tempFilePaths?.[0] || selected.tempFiles?.[0]?.path;
      if (!path) { log.warn('选择结果缺少图片路径', selected); return; }
      let imported = false;
      await this.run('import', async () => {
        const image = await normalizeImage(this, path);
        const file = await persistFile(image.path);
        const source = { id: uid(), file, width: image.width, height: image.height, createdAt: Date.now(), ocr: null };
        this.urls[source.id] = await resolveFile(file);
        this.workspace.sources.push(source); this.sourceId = source.id; this.resetCut(); imported = this.persist();
        log.info('原图已导入', { sourceId: source.id, size: `${source.width}x${source.height}`, file });
      });
      if (imported && this.mode === 'ocr') await this.recognize();
    },
    resetCut() { this.sourceGesture = null; this.cropGesture = null; this.crop = null; this.manualCrop = null; this.ocrRegion = null; this.padding = 6; this.cutPreview = ''; this.selection = null; this.ocrSelections = []; this.materialName = ''; this.zoom = 100; this.zoomGesture = null; this.sourceScroll = { x: 0, y: 0 }; this.pan = false; this.refreshEdgeSeed(); this.$nextTick(() => this.measureSource()); },
    async selectSource(id) { if (this.busy) return; log.info('切换原图', { sourceId: id }); this.sourceId = id; this.resetCut(); if (this.mode === 'ocr') await this.recognize(); },
    measureSource() {
      const query = uni.createSelectorQuery().in(this);
      query.select('#collage-source-stage').boundingClientRect(rect => { this.sourceRect = rect; });
      query.select('.image-scroll').boundingClientRect(rect => { if (rect?.height) this.sourceViewportHeight = rect.height; });
      query.exec();
    },
    changeZoom(event, live = false) {
      if (this.busy || !this.currentSource) return;
      const value = Number(event.detail.value); if (!Number.isFinite(value)) return;
      if (!this.zoomGesture) {
        const scale = this.sourceScale;
        const point = this.crop
          ? { x: this.crop.x + this.crop.width / 2, y: this.crop.y + this.crop.height / 2 }
          : { x: (this.sourceScroll.x + this.viewWidth / 2) / scale, y: (this.sourceScroll.y + Math.min(this.sourceViewportHeight, this.currentSource.height * scale) / 2) / scale };
        this.zoomGesture = { point, screen: { x: point.x * scale - this.sourceScroll.x, y: point.y * scale - this.sourceScroll.y } };
      }
      const anchor = this.zoomGesture;
      if (!live) this.zoomGesture = null;
      this.updateSourceView(value, anchor);
    },
    updateSourceView(value, anchor) {
      if (this.disposed || !this.currentSource) return;
      this.zoom = Math.round(clamp(value, 100, 300));
      this.sourceScroll = {
        x: clamp(anchor.point.x * this.sourceScale - anchor.screen.x, 0, Math.max(0, this.currentSource.width * this.sourceScale - this.viewWidth)),
        y: clamp(anchor.point.y * this.sourceScale - anchor.screen.y, 0, Math.max(0, this.currentSource.height * this.sourceScale - this.sourceViewportHeight))
      };
    },
    sourceTouchPoints(event) { return Array.from(event.touches || []).map(p => ({ x: p.clientX, y: p.clientY })); },
    startSourceTouch(event, kind = 'draw') {
      if (this.busy || !this.currentSource) return;
      const points = this.sourceTouchPoints(event);
      log.debug('原图触摸开始', { kind, points: points.length, pan: this.pan, hasGesture: !!this.sourceGesture });
      if (points.length >= 2) this.startSourceGesture(points, 'pinch');
      else if (!this.sourceGesture && points.length === 1) {
        if (this.pan) this.startSourceGesture(points, 'pan');
        else this.startCrop(event, kind);
      }
    },
    startSourceGesture(points, kind) {
      // A second finger cancels the tentative crop, including a drag on a handle.
      log.debug('开始原图手势', { kind, points: points.length, zoom: this.zoom });
      this.cancelCrop(); this.zoomGesture = null;
      const midpoint = kind === 'pinch' ? { x: (points[0].x + points[1].x) / 2, y: (points[0].y + points[1].y) / 2 } : points[0];
      const g = { id: uid(), kind, zoom: this.zoom, scale: this.sourceScale, scroll: { ...this.sourceScroll }, midpoint,
        distance: kind === 'pinch' ? Math.max(1, Math.hypot(points[1].x - points[0].x, points[1].y - points[0].y)) : 1, viewport: null, latest: points };
      this.sourceGesture = g;
      uni.createSelectorQuery().in(this).select('.image-scroll').boundingClientRect(rect => {
        if (!rect || this.sourceGesture?.id !== g.id || this.sourceGesture.kind === 'wait') return;
        const gesture = this.sourceGesture;
        gesture.viewport = rect; this.sourceViewportHeight = rect.height;
        gesture.point = { x: (g.scroll.x + midpoint.x - rect.left) / g.scale, y: (g.scroll.y + midpoint.y - rect.top) / g.scale };
        this.moveSourceGesture(gesture.latest);
      }).exec();
    },
    moveSourceTouch(event) {
      if (this.busy || !this.currentSource) return;
      const points = this.sourceTouchPoints(event);
      if (points.length >= 2 && this.sourceGesture?.kind !== 'pinch') this.startSourceGesture(points, 'pinch');
      if (this.sourceGesture) this.moveSourceGesture(points);
      else if (points.length === 1) this.moveCrop(event);
    },
    moveSourceGesture(points) {
      const g = this.sourceGesture;
      if (!g || g.kind === 'wait' || points.length < (g.kind === 'pinch' ? 2 : 1)) return;
      g.latest = points;
      if (!g.viewport) return;
      const midpoint = g.kind === 'pinch' ? { x: (points[0].x + points[1].x) / 2, y: (points[0].y + points[1].y) / 2 } : points[0];
      const zoom = g.kind === 'pinch' ? g.zoom * Math.hypot(points[1].x - points[0].x, points[1].y - points[0].y) / g.distance : g.zoom;
      this.updateSourceView(zoom, { point: g.point, screen: { x: midpoint.x - g.viewport.left, y: midpoint.y - g.viewport.top } });
    },
    endSourceTouch(event) {
      if (this.sourceGesture) {
        // Do not turn the remaining finger into a fresh crop after a pinch.
        log.debug('结束原图手势', { kind: this.sourceGesture.kind, remaining: event.touches?.length || 0, zoom: this.zoom });
        if (event.touches?.length) this.sourceGesture.kind = 'wait';
        else this.sourceGesture = null;
      } else this.endCrop();
    },
    cancelSourceTouch() { log.debug('取消原图手势'); this.cancelCrop(); this.sourceGesture = null; this.zoomGesture = null; },
    togglePan() { if (this.busy) return; this.cancelSourceTouch(); this.pan = !this.pan; log.debug('切换移动图片模式', { pan: this.pan }); this.$nextTick(() => this.measureSource()); },
    async rotateSource() {
      if (this.busy || !this.currentSource) return;
      log.info('旋转原图', { sourceId: this.sourceId, size: `${this.currentSource.width}x${this.currentSource.height}` });
      await this.run('rotate', async () => {
        const source = this.currentSource;
        const path = this.urls[source.id];
        // Old OCR coordinates no longer apply; clean the cloud records before replacing the bitmap.
        if (source.cloudRef || (source.ocrRegions || []).length || source.ocr?.provider === 'tencent') await deleteCollageSource(source, path, this);
        const rotated = await rotateImage(this, path);
        const file = await persistFile(rotated.path);
        const updated = { ...source, file, width: rotated.width, height: rotated.height, ocr: null };
        delete updated.ocrRegions; delete updated.cloudRef;
        this.workspace.sources = this.workspace.sources.map(item => item.id === source.id ? updated : item);
        this.urls[source.id] = await resolveFile(file);
        await removeFile(source.file);
        this.resetCut();
        this.persist();
        log.info('原图已旋转', { sourceId: source.id, size: `${updated.width}x${updated.height}` });
      });
    },
    point(event) { const p = event.touches?.[0] || event.changedTouches?.[0] || event; return { x: p.clientX, y: p.clientY }; },
    startCrop(event, kind) {
      if (this.busy || this.pan || this.sourceGesture || !this.currentSource || this.cropGesture) return;
      const screen = this.point(event); if (!Number.isFinite(screen.x)) return;
      const id = uid();
      this.cropGesture = { id, kind, p: null, screen, rect: this.crop ? { ...this.crop } : null, latest: null };
      uni.createSelectorQuery().in(this).select('#collage-source-stage').boundingClientRect(rect => {
        if (!rect || this.cropGesture?.id !== id || !this.currentSource) return;
        this.sourceRect = rect;
        this.cropGesture.p = { x: clamp((screen.x - rect.left) / this.sourceScale, 0, this.currentSource.width), y: clamp((screen.y - rect.top) / this.sourceScale, 0, this.currentSource.height) };
        if (this.cropGesture.latest) this.moveCrop({ clientX: this.cropGesture.latest.x, clientY: this.cropGesture.latest.y });
      }).exec();
      if (kind === 'draw') { this.crop = null; if (this.mode !== 'ocr') { this.selection = null; this.materialName = ''; } this.refreshEdgeSeed(); }
      this.cutPreview = '';
    },
    moveCrop(event) {
      const g = this.cropGesture; if (!g || !this.currentSource) return;
      if (event.preventDefault) event.preventDefault();
      const p = this.point(event);
      if (!g.p) { g.latest = p; return; }
      const dx = (p.x - g.screen.x) / this.sourceScale, dy = (p.y - g.screen.y) / this.sourceScale;
      const source = this.currentSource;
      if (g.kind === 'draw') this.crop = dragRect(g.p, { x: g.p.x + dx, y: g.p.y + dy }, source.width, source.height);
      else if (g.kind === 'move') this.crop = { ...g.rect, x: clamp(g.rect.x + dx, 0, source.width - g.rect.width), y: clamp(g.rect.y + dy, 0, source.height - g.rect.height) };
      else {
        const r = g.rect, west = g.kind.includes('w'), north = g.kind.includes('n');
        const fixed = { x: west ? r.x + r.width : r.x, y: north ? r.y + r.height : r.y };
        const moving = { x: clamp((west ? r.x : r.x + r.width) + dx, 0, source.width), y: clamp((north ? r.y : r.y + r.height) + dy, 0, source.height) };
        this.crop = dragRect(fixed, moving, source.width, source.height);
      }
    },
    endCrop() {
      this.cropGesture = null;
      if (this.crop && (this.crop.width < 3 || this.crop.height < 3)) this.crop = null;
      log.debug('框选结束', { crop: this.crop });
      const part = this.mode === 'ocr' && this.ocrSelections.find(part => part.id === this.selection?.id); if (part && this.crop) part.rect = { ...this.crop };
    },
    cancelCrop() { if (this.cropGesture) { log.debug('取消框选', { kind: this.cropGesture.kind }); this.crop = this.cropGesture.rect; } this.cropGesture = null; },
    async recognize() {
      if (this.busy || !this.currentSource || this.currentOcr) {
        log.debug('跳过识别', { busy: this.busy, hasSource: !!this.currentSource, hasOcr: !!this.currentOcr });
        return;
      }
      await this.run('ocr', async () => {
        const source = this.currentSource;
        let target = this.ocrSource, path = this.urls[source.id];
        if (this.ocrRegion) {
          const rect = this.ocrRegion;
          if (Math.min(rect.width, rect.height) < 15) throw new Error('框选区域太小，请扩大框选范围后再识别');
          log.info('识别框选区域', { sourceId: source.id, rect });
          path = await renderOcrRegion(this, path, rect);
          if (!target) {
            target = { id: uid(), regionKey: ocrRegionKey(rect), width: rect.width, height: rect.height, rect: { ...rect }, ocr: null };
            if (!source.ocrRegions) source.ocrRegions = [];
            source.ocrRegions.push(target);
            target = source.ocrRegions[source.ocrRegions.length - 1];
          }
        } else {
          log.info('识别整张原图', { sourceId: source.id, size: `${source.width}x${source.height}` });
        }
        const data = await recognizeCollageSource(target, path, this);
        target.ocr = this.ocrRegion ? placeRegionOcr(data, this.ocrRegion, source) : data;
        const persisted = this.persist();
        log.info('识别结果已保存', { sourceId: source.id, lines: target.ocr.lines.length, persisted });
        if (!target.ocr.lines.length) this.error = '没有识别到文字，可以继续手动框选。';
      });
    },
    isPicked(lineId, index) { return this.ocrSelections.some(part => part.lineId === lineId && index >= Math.min(part.start, part.end) && index <= Math.max(part.start, part.end)); },
    pickCharacter(line, index) {
      if (this.busy) return;
      const picked = this.ocrSelections.filter(part => part.lineId === line.id && index >= Math.min(part.start, part.end) && index <= Math.max(part.start, part.end));
      if (picked.length) { picked.forEach(part => this.removeOcrSelection(part.id)); this.error = ''; return; }
      if (!line.chars[index].polygon) { this.error = '这个字没有可靠的坐标，请选择整行后手动调整。'; return; }
      const next = !this.selection || this.selection.lineId !== line.id || this.selection.complete
        ? { id: uid(), lineId: line.id, start: index, end: index, complete: false }
        : { ...this.selection, end: index, complete: true };
      const rect = selectionRect(line, next.start, next.end);
      if (!rect) { this.error = '所选文字中有缺失坐标，请选择整行后手动调整。'; return; }
      const newPart = this.selection?.id !== next.id; this.selection = next;
      if (newPart) this.refreshEdgeSeed();
      this.crop = clipRect(rect, this.currentSource.width, this.currentSource.height);
      this.materialName = line.chars.slice(Math.min(this.selection.start, this.selection.end), Math.max(this.selection.start, this.selection.end) + 1).map(char => char.text).join('');
      log.debug('选字', { lineId: line.id, index, text: this.materialName, crop: this.crop });
      this.queueOcrSelection(); this.cutPreview = ''; this.error = '';
    },
    pickLine(line) { if (this.busy) return; const rect = bounds(line.polygon); if (!rect) { log.warn('整行缺少坐标，无法选择', { lineId: line.id }); return; } this.crop = clipRect(rect, this.currentSource.width, this.currentSource.height); this.materialName = line.text; this.selection = { id: uid(), lineId: line.id, start: 0, end: line.chars.length - 1, complete: true }; this.refreshEdgeSeed(); this.queueOcrSelection(); log.debug('选整行', { lineId: line.id, text: this.materialName, crop: this.crop }); this.error = ''; },
    queueOcrSelection() {
      const part = { ...this.selection, rect: { ...this.crop }, text: this.materialName, seed: this.edgeSeed };
      const duplicate = this.ocrSelections.find(item => item.id !== part.id && item.lineId === part.lineId && Math.min(item.start, item.end) === Math.min(part.start, part.end) && Math.max(item.start, item.end) === Math.max(part.start, part.end));
      if (duplicate) {
        this.ocrSelections = this.ocrSelections.filter(item => item.id !== part.id);
        this.selection.id = duplicate.id; Object.assign(duplicate, { ...part, id: duplicate.id }); return;
      }
      const index = this.ocrSelections.findIndex(item => item.id === part.id);
      if (index >= 0) this.ocrSelections.splice(index, 1, part);
      else this.ocrSelections.push(part);
    },
    activateOcrSelection(part) { if (!this.busy) this.showOcrSelection(part); },
    showOcrSelection(part) { this.selection = { id: part.id, lineId: part.lineId, start: part.start, end: part.end, complete: true }; this.crop = { ...part.rect }; this.materialName = part.text; this.edgeSeed = part.seed; this.lastSavedEdgeSeed = null; this.cutPreview = ''; },
    removeOcrSelection(id) { if (this.busy) return; this.ocrSelections = this.ocrSelections.filter(part => part.id !== id); if (this.selection?.id === id) { this.selection = null; this.crop = null; this.cutPreview = ''; this.materialName = ''; if (this.ocrSelections.length) this.activateOcrSelection(this.ocrSelections[this.ocrSelections.length - 1]); } },
    clearOcrSelections() { if (this.busy) return; this.ocrSelections = []; this.selection = null; this.crop = null; this.materialName = ''; this.cutPreview = ''; },
    refreshEdgeSeed() { this.edgeSeed = randomEdgeSeed(this.edgeSeed); this.edgeVersion = 2; this.lastSavedEdgeSeed = null; this.cutPreview = ''; const part = this.mode === 'ocr' && this.ocrSelections.find(part => part.id === this.selection?.id); if (part) part.seed = this.edgeSeed; },
    setEdge(value) { if (this.busy) return; log.debug('切换边缘样式', { edge: value }); this.edgeStyle = value; this.cutPreview = ''; if (value === 'torn') this.refreshEdgeSeed(); },
    async setMode(value) {
      if (this.busy) return;
      log.info('切换选取模式', { from: this.mode, to: value, crop: this.crop });
      if (this.mode !== value) {
        this.cancelSourceTouch();
        if (value === 'ocr') {
          const region = this.crop && this.currentSource ? clipRect(this.crop, this.currentSource.width, this.currentSource.height) : null;
          this.manualCrop = region ? { ...region } : null;
          if (ocrRegionKey(region) !== ocrRegionKey(this.ocrRegion)) this.clearOcrSelections();
          this.ocrRegion = region;
          this.crop = region ? { ...region } : null;
          log.debug('识别范围', { region, regionKey: ocrRegionKey(region) });
        } else this.crop = this.manualCrop ? { ...this.manualCrop } : null;
        this.mode = value; this.cutPreview = '';
        if (value === 'ocr' && this.ocrSelections.length) this.activateOcrSelection(this.ocrSelections.find(part => part.id === this.selection?.id) || this.ocrSelections[this.ocrSelections.length - 1]);
        this.$nextTick(() => this.measureSource());
      }
      if (value === 'ocr') await this.recognize();
    },
    async rerollTornEdge() { if (this.busy || !this.crop || this.edgeStyle !== 'torn') return; log.debug('更换撕边'); this.refreshEdgeSeed(); await this.previewCut(); },
    setPadding(event) { this.padding = event.detail.value; this.cutPreview = ''; },
    async makeCut() {
      if (!this.crop || !this.currentSource) throw new Error('请先框选一块区域');
      // A saved piece keeps its bitmap; the next piece gets a new contour.
      // Preview and save of that next piece share one seed.
      if (this.edgeStyle === 'torn' && this.lastSavedEdgeSeed === this.edgeSeed) this.refreshEdgeSeed();
      return renderCut(this, this.urls[this.sourceId], this.cutBounds, this.edgeStyle, this.edgeSeed, this.edgeVersion);
    },
    cancelPreview() { clearTimeout(this.previewTimer); this.previewTimer = null; this.previewRevision++; this.previewQueued = false; },
    queuePreview() {
      this.cancelPreview(); this.cutPreview = '';
      if (!this.previewKey || this.disposed) return;
      this.previewQueued = true;
      if (this.busy) return;
      this.previewTimer = setTimeout(() => { this.previewTimer = null; this.previewCut(); }, 150);
    },
    async previewCut() {
      await this.$nextTick();
      if (this.busy || !this.previewKey || this.disposed) return;
      this.cancelPreview();
      const revision = this.previewRevision, previous = this.previewTask;
      const path = this.urls[this.sourceId], rect = { ...this.cutBounds }, style = this.edgeStyle, seed = this.edgeSeed, edgeVersion = this.edgeVersion;
      // Native exports share a canvas. Serialize previews and discard stale results
      // while allowing the next text selection to remain responsive.
      log.debug('生成预览', { revision, rect, style, seed, edgeVersion });
      const job = (async () => {
        try {
          await previous;
          if (revision !== this.previewRevision || this.busy || this.disposed) { log.debug('丢弃过期预览', { revision, current: this.previewRevision }); return; }
          const cut = await renderCut(this, path, rect, style, seed, edgeVersion);
          if (revision === this.previewRevision && !this.busy && !this.disposed) this.cutPreview = cut.path;
        } catch (error) {
          log.warn('预览生成失败', { revision, error });
          if (revision === this.previewRevision && !this.disposed) this.error = error.message || '预览生成失败，请重新选择';
        }
      })();
      this.previewTask = job;
      await job;
      if (this.previewTask === job) this.previewTask = null;
    },
    async saveCut() {
      await this.run('save-cut', async () => {
        if (this.mode === 'ocr' && this.ocrSelections.length) return this.saveOcrBatch();
        const cut = await this.makeCut(); const file = await persistFile(cut.path);
        const material = { id: uid(), file, sourceId: this.sourceId, baseRect: { ...this.crop }, mode: this.mode, padding: this.effectivePadding, edge: this.edgeStyle, seed: this.edgeSeed, edgeVersion: this.edgeVersion, name: this.mode === 'ocr' ? this.materialName.trim().slice(0, 80) : '', width: cut.width, height: cut.height, createdAt: Date.now() };
        this.urls[material.id] = await resolveFile(file); this.workspace.materials.push(material); this.cutPreview = cut.path;
        this.lastSavedEdgeSeed = this.edgeSeed;
        log.info('纸片已保存', { materialId: material.id, size: `${material.width}x${material.height}`, edge: material.edge, padding: material.padding, seed: material.seed, mode: material.mode });
        if (this.persist()) uni.showToast({ title: '已加入素材库', icon: 'success' });
      });
    },
    async saveOcrBatch() {
      const parts = this.ocrSelections.slice(), source = this.currentSource;
      let completed = 0;
      log.info('批量制作纸片', { total: parts.length, edge: this.edgeStyle, padding: this.effectivePadding });
      try {
        for (const part of parts) {
          this.batchProgress = { current: completed + 1, total: parts.length };
          const rect = clipRect(part.rect, source.width, source.height, this.effectivePadding);
          const cut = await renderCut(this, this.urls[source.id], rect, this.edgeStyle, part.seed, this.edgeVersion);
          const file = await persistFile(cut.path);
          const material = { id: uid(), file, sourceId: source.id, baseRect: { ...part.rect }, mode: 'ocr', padding: this.effectivePadding, edge: this.edgeStyle, seed: part.seed, edgeVersion: this.edgeVersion, name: part.text.trim().slice(0, 80), width: cut.width, height: cut.height, createdAt: Date.now() };
          try {
            this.urls[material.id] = await resolveFile(file); this.workspace.materials.push(material);
            if (!this.persist()) throw new Error('本机保存失败，请检查存储空间后重试');
          } catch (error) {
            this.workspace.materials = this.workspace.materials.filter(item => item.id !== material.id);
            delete this.urls[material.id]; await removeFile(file).catch(() => {}); throw error;
          }
          this.ocrSelections = this.ocrSelections.filter(item => item.id !== part.id);
          this.cutPreview = cut.path; completed++;
          log.debug('批量纸片已保存', { current: completed, total: parts.length, materialId: material.id, name: material.name });
        }
        this.selection = null; this.crop = null; this.materialName = '';
        log.info('批量制作完成', { total: completed });
        uni.showToast({ title: `已加入 ${completed} 张纸片`, icon: 'success' });
      } catch (error) {
        log.error('批量制作中断', { completed, remaining: this.ocrSelections.length, error });
        if (completed) throw new Error(`已保存 ${completed} 张，剩余 ${this.ocrSelections.length} 张可重试。${error.message || '制作失败'}`);
        throw error;
      } finally {
        this.batchProgress = null;
        if (this.ocrSelections.length && !this.ocrSelections.some(part => part.id === this.selection?.id)) this.showOcrSelection(this.ocrSelections[0]);
      }
    },
    async confirm(content) { return new Promise(resolve => uni.showModal({ title: '确认删除', content, success: res => resolve(res.confirm), fail: () => resolve(false) })); },
    async deleteSource(source = this.currentSource) {
      if (this.busy) return;
      if (!source) return;
      log.info('删除原图', { sourceId: source.id, hasCloudRef: !!source.cloudRef, regions: (source.ocrRegions || []).length });
      await this.run('delete-source', async () => {
        if (!await this.confirm('删除这张原图及其云端识别数据？已剪好的纸片和画布会保留。')) { log.debug('取消删除原图', { sourceId: source.id }); return; }
        await deleteCollageSource(source, this.urls[source.id], this);
        const sources = this.workspace.sources;
        this.workspace.sources = sources.filter(item => item.id !== source.id);
        if (!this.persist()) { this.workspace.sources = sources; log.warn('删除原图未保存，已回滚', { sourceId: source.id }); return; }
        delete this.urls[source.id];
        if (this.sourceId === source.id) { this.sourceId = this.workspace.sources[0]?.id || ''; this.resetCut(); }
        await removeFile(source.file);
        log.info('原图已删除', { sourceId: source.id });
      });
    },
    async deleteMaterial(material) {
      if (this.busy) return;
      log.info('删除纸片', { materialId: material.id });
      if (!await this.confirm('删除这张纸片，并从当前画布中移除？')) { log.debug('取消删除纸片', { materialId: material.id }); return; }
      this.workspace.materials = this.workspace.materials.filter(item => item.id !== material.id);
      this.workspace.items = this.workspace.items.filter(item => item.materialId !== material.id);
      this.history = []; this.redoHistory = []; this.exportedImage = '';
      if (this.persist()) { delete this.urls[material.id]; await removeFile(material.file); }
    },
    boardSnapshot() { return JSON.stringify({ items: this.workspace.items, background: this.workspace.background, backgroundImage: this.workspace.backgroundImage || null }); },
    checkpoint() { this.itemAdjustment = null; this.history.push(this.boardSnapshot()); if (this.history.length > 40) this.history.shift(); this.redoHistory = []; this.exportedImage = ''; },
    restoreBoardSnapshot(snapshot) {
      const board = JSON.parse(snapshot);
      const current = this.workspace.backgroundImage;
      const restored = board.backgroundImage || null;
      if (current && (!restored || restored.file !== current.file)) this.rememberStaleBackgroundFile(current.file);
      this.workspace.items = board.items; this.workspace.background = board.background; this.workspace.backgroundImage = restored;
      this.selectedItemId = ''; this.itemGesture = null; this.itemAdjustment = null; this.exportedImage = ''; this.persist();
    },
    undo() { if (this.busy || !this.history.length) return; log.debug('画布后退', { history: this.history.length }); this.redoHistory.push(this.boardSnapshot()); this.restoreBoardSnapshot(this.history.pop()); },
    redo() { if (this.busy || !this.redoHistory.length) return; log.debug('画布前进', { redo: this.redoHistory.length }); this.history.push(this.boardSnapshot()); this.restoreBoardSnapshot(this.redoHistory.pop()); },
    addToBoard(material, navigate = true) {
      if (this.busy || !this.urls[material.id]) { log.warn('纸片无法放到画布', { materialId: material.id, busy: this.busy, hasUrl: !!this.urls[material.id] }); return; }
      if (this.workspace.items.length >= 60) { log.warn('画布已达 60 张上限'); this.error = '一张画布最多放 60 张纸片'; return; }
      this.checkpoint(); const width = Math.min(360, material.width, 500 * material.width / material.height);
      const item = { id: uid(), materialId: material.id, x: 450, y: 350 + this.workspace.items.length % 8 * 55, width, height: width * material.height / material.width, rotation: 0 };
      this.workspace.items.push(item); this.selectedItemId = item.id; this.persist();
      log.info('纸片已放到画布', { itemId: item.id, materialId: material.id, items: this.workspace.items.length });
      if (navigate) this.switchTab('board');
    },
    itemStyle(item) { return { left: item.x * this.boardScale + 'px', top: item.y * this.boardScale + 'px', width: item.width * this.boardScale + 'px', height: item.height * this.boardScale + 'px', transform: `translate(-50%, -50%) rotate(${item.rotation}deg)` }; },
    startItem(event, item) { if (this.busy || this.itemGesture) return; this.selectedItemId = item.id; this.itemGesture = { point: this.point(event), x: item.x, y: item.y, moved: false }; },
    moveItem(event) {
      const g = this.itemGesture, item = this.selectedItem; if (!g || !item) return;
      const p = this.point(event); if (Math.hypot(p.x - g.point.x, p.y - g.point.y) < 2 && !g.moved) return;
      if (!g.moved) { this.checkpoint(); g.moved = true; }
      item.x = clamp(g.x + (p.x - g.point.x) / this.boardScale, 0, BOARD.width);
      item.y = clamp(g.y + (p.y - g.point.y) / this.boardScale, 0, BOARD.height);
    },
    endItem() { if (this.itemGesture?.moved) this.persist(); this.itemGesture = null; },
    resizeItem(event, live = false) { this.adjustItem('width', event, live); },
    rotateItem(event, live = false) { this.adjustItem('rotation', event, live); },
    adjustItem(property, event, live) {
      const item = this.selectedItem; if (!item || this.busy) return;
      const value = Number(event.detail.value); if (!Number.isFinite(value)) return;
      if (item[property] !== value) {
        if (this.itemAdjustment?.id !== item.id || this.itemAdjustment?.property !== property) {
          this.checkpoint();
          this.itemAdjustment = { id: item.id, property, aspectRatio: item.height / item.width };
        }
        if (property === 'width') item.height = value * this.itemAdjustment.aspectRatio;
        item[property] = value;
      }
      if (!live) this.endItemAdjustment();
    },
    endItemAdjustment() { if (this.itemAdjustment) this.persist(); this.itemAdjustment = null; },
    layerItem(top) { if (!this.selectedItem || this.busy) return; log.debug('调整纸片层级', { itemId: this.selectedItem.id, top }); this.checkpoint(); const item = this.selectedItem; this.workspace.items = this.workspace.items.filter(i => i.id !== item.id); if (top) this.workspace.items.push(item); else this.workspace.items.unshift(item); this.persist(); },
    removeItem() { if (!this.selectedItem || this.busy) return; log.debug('从画布移除纸片', { itemId: this.selectedItemId }); this.checkpoint(); this.workspace.items = this.workspace.items.filter(item => item.id !== this.selectedItemId); this.selectedItemId = ''; this.persist(); },
    setBackground(color) {
      if (this.busy || (this.workspace.background === color && !this.workspace.backgroundImage)) return;
      log.debug('切换底纸颜色', { color });
      this.checkpoint(); this.workspace.background = color;
      this.clearBackgroundImage();
      this.persist();
    },
    openBackgroundSheet() { if (this.busy) return; log.debug('打开画布背景菜单'); this.backgroundSheetVisible = true; },
    closeBackgroundSheet() { this.backgroundSheetVisible = false; },
    async selectBackgroundAction(index) {
      this.backgroundSheetVisible = false;
      if (index === 0) { await this.chooseBackgroundImage(); return; }
      if (index === 1) this.openOfficialPicker('background');
    },
    async chooseBackgroundImage() {
      if (this.busy) return;
      log.info('选择画布背景图片');
      const selected = await new Promise(resolve => uni.chooseImage({ count: 1, sizeType: ['original'], sourceType: ['album', 'camera'], success: resolve, fail: (error) => { log.warn('选择背景图片失败或取消', error); resolve(null); } }));
      if (!selected) return;
      const path = selected.tempFilePaths?.[0] || selected.tempFiles?.[0]?.path;
      if (!path) { log.warn('背景图片缺少路径', selected); return; }
      await this.run('background', async () => {
        const image = await normalizeImage(this, path);
        const file = await persistFile(image.path);
        const previous = this.workspace.backgroundImage;
        const background = { id: uid(), file, width: image.width, height: image.height, createdAt: Date.now() };
        this.checkpoint();
        this.workspace.backgroundImage = background;
        this.urls[background.id] = await resolveFile(file);
        if (!this.persist()) {
          this.workspace.backgroundImage = previous; delete this.urls[background.id];
          await removeFile(file).catch(() => {});
          return;
        }
        if (previous) this.rememberStaleBackgroundFile(previous.file);
        log.info('画布背景已更换', { id: background.id, size: `${background.width}x${background.height}` });
      });
    },
    async loadOfficialLibrary(type, forceRefresh = false) {
      const library = this.officialLibraries[type];
      if (!library || library.loading) return;
      library.loading = true; library.error = '';
      try {
        const groups = await getOfficialMaterials({ type, forceRefresh, context: this });
        library.groups = groups;
        log.info('官方素材已加载', { type, groups: groups.length });
      } catch (error) {
        log.warn('加载官方素材失败', { type, error });
        library.error = error.message || '官方素材加载失败，请稍后重试';
      } finally {
        library.loaded = true; library.loading = false;
      }
    },
    openOfficialPicker(type = 'paper') {
      if (this.busy) return;
      log.debug('打开官方素材库', { type });
      this.officialPickerType = type; this.officialPickerVisible = true;
      const library = this.officialLibraries[type];
      if (library && (!library.loaded || library.error)) this.loadOfficialLibrary(type, Boolean(library.error));
    },
    closeOfficialPicker() { this.officialPickerVisible = false; },
    async applyOfficialMaterial(item) {
      this.officialPickerVisible = false;
      if (!item || typeof item !== 'object' || !item.url) return;
      if (this.officialPickerType === 'background') await this.useOfficialBackground(item);
      else await this.useOfficialPaper(item);
    },
    // 官方素材按次导入本机，导出、重开和离线使用与自剪纸片一致。
    async useOfficialPaper(material) {
      if (this.busy || !material || !material.url) return;
      log.info('使用官方纸片', { materialId: material.id, name: material.name });
      const entry = await this.run('official', async () => {
        const image = await importOfficialImage(material);
        const record = {
          id: uid(), file: image.ref, sourceId: '', baseRect: null, mode: 'official', padding: 0,
          edge: 'straight', seed: 0, edgeVersion: 2, name: material.name || '', officialId: material.id || '',
          width: image.width, height: image.height, createdAt: Date.now()
        };
        this.workspace.materials.push(record);
        this.urls[record.id] = image.path;
        if (!this.persist()) {
          this.workspace.materials = this.workspace.materials.filter(item => item.id !== record.id);
          delete this.urls[record.id];
          await removeFile(record.file).catch(() => {});
          throw new Error('本机保存失败，请检查存储空间后重试');
        }
        log.info('官方纸片已加入本机素材库', { materialId: material.id, width: record.width, height: record.height });
        return record;
      });
      if (entry) this.addToBoard(entry);
    },
    async useOfficialBackground(material) {
      if (this.busy || !material || !material.url) return;
      log.info('使用官方背景', { materialId: material.id, name: material.name });
      await this.run('official', async () => {
        const image = await importOfficialImage(material);
        const previous = this.workspace.backgroundImage;
        const background = { id: uid(), file: image.ref, width: image.width, height: image.height, name: material.name || '', officialId: material.id || '', createdAt: Date.now() };
        this.checkpoint();
        this.workspace.backgroundImage = background;
        this.urls[background.id] = image.path;
        if (!this.persist()) {
          this.workspace.backgroundImage = previous;
          delete this.urls[background.id];
          await removeFile(image.ref).catch(() => {});
          throw new Error('本机保存失败，请检查存储空间后重试');
        }
        if (previous) this.rememberStaleBackgroundFile(previous.file);
        log.info('官方背景已应用', { materialId: material.id, width: background.width, height: background.height });
      });
    },
    clearBackgroundImage() {
      const background = this.workspace.backgroundImage;
      if (!background) return;
      this.rememberStaleBackgroundFile(background.file);
      this.workspace.backgroundImage = null;
    },
    // 背景图替换后旧文件仍可能被撤销/重做引用，退出页面时再删除未使用的文件。
    rememberStaleBackgroundFile(file) {
      if (file && !this.staleBackgroundFiles.includes(file)) this.staleBackgroundFiles.push(file);
    },
    cleanupStaleBackgroundFiles() {
      const current = this.workspace.backgroundImage;
      const inUse = current ? current.file : '';
      for (const file of this.staleBackgroundFiles) {
        if (file === inUse) continue;
        removeFile(file).catch(() => {});
      }
      this.staleBackgroundFiles = [];
    },
    async exportImage() {
      log.info('导出画布', { items: this.workspace.items.length });
      const path = await this.run('export', async () => { const rendered = await renderBoard(this, this.workspace, this.urls); this.exportedImage = rendered; return rendered; });
      log.info('导出结果', { ok: !!path, path: path || '' });
      return path || '';
    },
    async downloadImage() { log.info('点击下载'); if (await this.exportImage()) this.saveExport(); },
    async publishImage() { log.info('点击发布'); if (await this.exportImage()) this.publishExport(); },
    previewExport() { if (this.exportedImage) uni.previewImage({ urls: [this.exportedImage] }); },
    saveExport() {
      if (!this.exportedImage) return;
      // #ifdef H5
      log.info('H5 下载作品图');
      const link = document.createElement('a'); link.href = this.exportedImage; link.download = `拼贴诗-${Date.now()}.png`; link.click();
      // #endif
      // #ifndef H5
      uni.saveImageToPhotosAlbum({
        filePath: this.exportedImage,
        success: () => { log.info('作品图已保存到相册'); uni.showToast({ title: '已保存到相册' }); },
        fail: (error) => { log.error('保存到相册失败', error); this.error = '保存失败，请检查相册权限，也可以点开作品预览后保存。'; }
      });
      // #endif
    },
    publishExport() {
      if (!this.exportedImage) return;
      const path = this.exportedImage;
      log.info('跳转发布页', { path });
      uni.navigateTo({
        url: '/pages-collage/collage-upload/collage-upload',
        success: result => result.eventChannel.emit('collageExport', { path }),
        fail: error => log.error('打开发布页失败', error)
      });
    }
  }
};
</script>

<style scoped>
.studio { min-height: 100vh; background: #faf8f3; color: #343b34; padding: calc(8px + env(safe-area-inset-top)) 16px calc(24px + env(safe-area-inset-bottom)); box-sizing: border-box; }
.studio-nav, .row, .tabs { display: flex; align-items: center; gap: 10px; }
.studio-nav { max-width: 640px; margin: 0 auto 12px; border-bottom: 1px solid #deded3; }
button { margin: 0; background: #eeeee5; color: #3e4b3e; border-radius: 8px; font-size: 13px; padding: 0 12px; }
button::after { border: 0; }
button[disabled] { opacity: .45; }
.back { flex-shrink: 0; font-size: 30px; line-height: 40px; width: 28px; padding: 0; background: transparent; }
.tabs { flex: 1; min-width: 0; }
.tabs button { flex: 1; background: transparent; border-radius: 0; line-height: 40px; padding: 0; color: #8a8e82; }
.tabs .active { color: #304d3b; border-bottom: 2px solid #304d3b; }
/* #ifdef MP-WEIXIN */
/* 小程序端：避开刘海屏和右上角胶囊按钮，返回按钮与切换栏紧凑靠左 */
.studio { padding-top: var(--collage-nav-top, calc(8px + env(safe-area-inset-top))); }
.studio-nav { padding-right: var(--collage-capsule-right, 200rpx); }
.tabs button { flex: 0 1 auto; min-width: 0; padding: 0 8px; white-space: nowrap; }
/* #endif */
.section, .notice { max-width: 640px; margin: 0 auto; }
.spread { justify-content: space-between; }
.grow { flex: 1; min-width: 0; }
.section-title { font-size: 16px; }
.history-actions { position: absolute; top: 4px; right: 4px; z-index: 2; gap: 6px; }
.history-button { display: flex; align-items: center; justify-content: center; width: 36px; height: 36px; padding: 0; background: transparent; }
.history-button[disabled] { background: transparent; opacity: .3; }
.history-button image { width: 24px; height: 24px; }
.forward-icon { transform: scaleX(-1); }
.muted, .hint { font-size: 12px; color: #858a7d; }
.hint { display: block; line-height: 1.6; margin: 6px 0; }
.source-strip { margin: 6px 0; width: 100%; }
.source-thumbs { display: flex; gap: 10px; padding: 3px; }
.source-strip .source-thumbs { gap: 14px; padding: 10px 8px 3px 3px; }
.source-thumb-wrap { position: relative; flex-shrink: 0; width: 56px; height: 70px; }
.source-add { display: flex; align-items: center; justify-content: center; flex-shrink: 0; width: 56px; height: 70px; box-sizing: border-box; padding: 0; border: 1px dashed #9ca894; border-radius: 4px; background: transparent; color: #6c8068; font-size: 28px; line-height: 1; }
.source-remove { position: absolute; z-index: 1; top: -10px; right: -10px; width: 24px; height: 24px; line-height: 24px; padding: 0; border: 0; border-radius: 0; background: transparent; color: #6c7268; font-size: 16px; font-weight: normal; }
.source-thumb { width: 52px; height: 66px; flex-shrink: 0; border: 2px solid transparent; border-radius: 4px; }
.chosen { border: 2px solid #3d5547 !important; }
.empty { min-height: 280px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 15px; text-align: center; border: 1px dashed #d5d8c9; border-radius: 12px; margin-top: 18px; font-size: 14px; }
.empty-mark { font-size: 36px; color: #899980; }
.mode-row { flex-wrap: wrap; }
.selected, .primary { background: #3d5547; color: #fff; }
.image-scroll { position: relative; overflow: hidden; height: 360px; width: 100%; background: #e4e2da; border-radius: 6px; touch-action: none; }
.source-stage { position: absolute; left: 0; top: 0; transform-origin: 0 0; user-select: none; touch-action: none; will-change: transform; }
.source-image { display: block; width: 100%; height: 100%; pointer-events: none; }
.crop-box { position: absolute; border: 2px solid #547458; box-sizing: border-box; background: rgba(165, 194, 130, .12); box-shadow: 0 0 0 3000px rgba(0,0,0,.12); touch-action: none; }
.handle { position: absolute; width: 22px; height: 22px; border-radius: 50%; background: #fff; border: 2px solid #547458; box-sizing: border-box; }
.nw { top: -11px; left: -11px; } .ne { top: -11px; right: -11px; } .sw { bottom: -11px; left: -11px; } .se { bottom: -11px; right: -11px; }
.ocr-panel, .cut-settings, .item-controls { margin-top: 10px; padding-top: 10px; border-top: 1px solid #dfdfd5; }
.ocr-panel { margin-top: 6px; padding-top: 0; border-top: 0; }
.cut-settings > .row { margin-top: 8px; }
.cut-actions { gap: 8px; }
.cut-actions button { padding: 0 8px; white-space: nowrap; }
.ocr-line { display: flex; align-items: flex-start; gap: 10px; padding: 10px 0; border-bottom: 1px solid #e8e8df; }
.characters, .line-text { flex: 1; line-height: 2; }
.character { display: inline-block; font-size: 18px; padding: 2px 3px; margin: 2px 0; border-radius: 3px; }
.picked { background: #cfdebd; color: #243c2a; }
.ocr-selections { margin-top: 8px; }
.selection-chips { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 6px; }
.selection-chip { display: flex; align-items: center; max-width: 100%; border: 1px solid #deded3; border-radius: 6px; overflow: hidden; }
.selection-chip.active { border-color: #547458; background: #e8eedf; }
.selection-label { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; padding: 0 8px; }
.selection-chip button { background: transparent; border-radius: 0; font-size: 12px; line-height: 30px; }
.selection-remove { flex-shrink: 0; width: 28px; padding: 0; }
.unavailable { color: #a0a39a; border-bottom: 1px dotted #a0a39a; }
.cut-preview, .material-image { background: repeating-conic-gradient(#e9e9e3 0% 25%, #fafaf7 0% 50%) 0 / 14px 14px; border-radius: 6px; margin: 12px 0; }
.cut-preview image { width: 100%; height: 120px; }
.material-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 16px; }
.material-card { background: #fff; padding: 10px; border: 1px solid #e7e5db; border-radius: 8px; min-width: 0; }
.material-image { margin: 0 0 10px; }
.material-image image { width: 100%; height: 110px; }
.material-actions { display: flex; justify-content: flex-end; align-items: center; gap: 6px; }
.material-action { display: flex; align-items: center; justify-content: center; width: 36px; height: 36px; padding: 0; background: transparent; }
.material-action[disabled] { background: transparent; opacity: .3; }
.material-action image { width: 24px; height: 24px; }
.official-section { margin-top: 24px; padding-top: 16px; border-top: 1px solid #dfdfd5; }
.official-error { display: block; margin-top: 10px; font-size: 13px; color: #a45c3d; }
.board { position: relative; overflow: hidden; box-shadow: 0 2px 14px #00000010; border: 1px solid #e0dfd3; box-sizing: content-box; touch-action: none; }
.board-background { position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; }
.board-background-add { position: absolute; right: 8px; bottom: 8px; z-index: 3; display: flex; align-items: center; justify-content: center; width: 40px; height: 40px; padding: 0; border-radius: 50%; background: rgba(255, 255, 255, .92); box-shadow: 0 2px 10px rgba(0, 0, 0, .2); }
.board-background-add image { width: 24px; height: 24px; }
.board-piece { position: absolute; touch-action: none; user-select: none; }
.board-piece image { width: 100%; height: 100%; display: block; pointer-events: none; }
.focused { outline: 1px dashed #718067; outline-offset: 4px; }
.board-empty { position: absolute; top: 45%; left: 0; width: 100%; text-align: center; color: #a6a99a; font-size: 14px; pointer-events: none; }
.background-row { margin: 12px 0; justify-content: space-between; gap: 8px; }
.background-colors, .layer-actions { gap: 4px; flex-shrink: 0; }
.background-colors .muted { white-space: nowrap; margin-right: 2px; }
.layer-actions button { padding: 0 6px; font-size: 12px; white-space: nowrap; }
.swatch { width: 22px; height: 22px; box-sizing: border-box; flex-shrink: 0; border: 2px solid #deded5; border-radius: 50%; }
.board-tray { margin-bottom: 18px; white-space: nowrap; }
.board-tray image { width: 80px; height: 58px; flex-shrink: 0; background: #eeede6; border-radius: 5px; }
.notice { background: #f4e9d8; color: #806337; font-size: 13px; padding: 12px; box-sizing: border-box; line-height: 1.7; margin-bottom: 16px; border-radius: 6px; }
.busy { position: fixed; bottom: 30px; left: 50%; transform: translateX(-50%); padding: 12px 22px; border-radius: 30px; background: #343d33; color: #fff; font-size: 13px; z-index: 200; white-space: nowrap; }
.render-canvas { position: fixed; left: -10000px; top: 0; pointer-events: none; }
.export-panel { margin-top: 20px; padding-top: 20px; border-top: 1px solid #deded3; }
.export-panel > image { width: 100%; margin-bottom: 14px; }
</style>
