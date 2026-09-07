<template>
  <view class="weekly-share-card-modal">
    <!-- 与诗歌详情页相同的分享弹窗，用户可自行“保存到相册” -->
    <ShareModal
      :show="true"
      :image-url="shareImageUrl"
      :image-urls="[]"
      :longpress-menu-enabled="false"
      :share-config="shareConfig"
      :preview-text="previewText"
      :color-palettes="colorPalettes"
      :poem-lines="poemLines"
      @hide="$emit('hide')"
      @longpress="onImageLongPress"
      @load="onShareImageLoad"
      @error="onShareImageError"
      @save="saveShareImage"
      @font-size-preview="onFontSizePreview"
      @font-family-preview="onFontFamilyPreview"
      @font-settings-change="onFontSettingsChange"
      @color-change="onColorChange"
      @force-regenerate="forceRegenerateCanvas"
    />

    <!-- 隐藏的 canvas 用于生成分享卡片（不同平台使用不同形态） -->
    <!-- #ifdef MP-WEIXIN -->
    <canvas
      id="weeklyShareCanvas"
      type="2d"
      style="position: fixed; top: -9999px; left: -9999px; width: 750px; border-radius: 15px; overflow: hidden;"
      :style="{ height: shareCanvasHeight + 'px' }"
    ></canvas>
    <!-- #endif -->
    <!-- #ifndef MP-WEIXIN -->
    <canvas
      id="weeklyShareCanvas"
      canvas-id="weeklyShareCanvas"
      style="position: fixed; top: -9999px; left: -9999px; width: 750px; border-radius: 15px; overflow: hidden;"
      :style="{ height: shareCanvasHeight + 'px' }"
    ></canvas>
    <!-- #endif -->
  </view>
</template>

<script>
import ShareModal from '@/components/ShareModal.vue';
import {
  calculateShareCardHeight,
  drawShareCardContent,
  exportShareCanvas
} from '@/utils/shareCanvas.js';
import fontManager from '@/utils/fontManager.js';
import { getCurrentPlatform } from '@/utils/platformDetector.js';
import { getWindowInfoCompat } from '@/utils/system-info.js';
import { colorPalettes } from '@/utils/colorPalettes.js';
import { poemLines } from '@/utils/poemLines.js';

const CANVAS_ID = 'weeklyShareCanvas';

function updateCanvas2DFontSize(ctx, fontSize) {
  if (!ctx || !fontSize) return;
  const currentFont = String(ctx.font || '').trim();
  const familyMatch = currentFont.match(/\d+(?:\.\d+)?px\s+(.+)$/);
  const family = familyMatch && familyMatch[1] ? familyMatch[1] : 'sans-serif';
  ctx.font = `${fontSize}px ${family}`;
}

function createCanvas2DCompatContext(nativeCtx) {
  if (!nativeCtx) return null;

  return {
    get font() {
      return nativeCtx.font;
    },
    set font(value) {
      nativeCtx.font = value;
    },
    clearRect(...args) {
      return nativeCtx.clearRect(...args);
    },
    drawImage(...args) {
      return nativeCtx.drawImage(...args);
    },
    measureText(...args) {
      return nativeCtx.measureText(...args);
    },
    fillText(...args) {
      return nativeCtx.fillText(...args);
    },
    beginPath(...args) {
      return nativeCtx.beginPath(...args);
    },
    moveTo(...args) {
      return nativeCtx.moveTo(...args);
    },
    lineTo(...args) {
      return nativeCtx.lineTo(...args);
    },
    arcTo(...args) {
      return nativeCtx.arcTo(...args);
    },
    quadraticCurveTo(...args) {
      return nativeCtx.quadraticCurveTo(...args);
    },
    closePath(...args) {
      return nativeCtx.closePath(...args);
    },
    fill(...args) {
      return nativeCtx.fill(...args);
    },
    stroke(...args) {
      return nativeCtx.stroke(...args);
    },
    save(...args) {
      return nativeCtx.save(...args);
    },
    restore(...args) {
      return nativeCtx.restore(...args);
    },
    clip(...args) {
      return nativeCtx.clip(...args);
    },
    setFillStyle(value) {
      nativeCtx.fillStyle = value;
    },
    setStrokeStyle(value) {
      nativeCtx.strokeStyle = value;
    },
    setLineWidth(value) {
      nativeCtx.lineWidth = value;
    },
    setTextAlign(value) {
      nativeCtx.textAlign = value;
    },
    setFontSize(value) {
      updateCanvas2DFontSize(nativeCtx, value);
    },
    draw(reserve, callback) {
      if (typeof callback === 'function') {
        callback();
      }
    }
  };
}

export default {
  name: 'WeeklyShareCardModal',
  components: {
    ShareModal
  },
  emits: ['hide'],
  props: {
    // 周刊快照 post（来自 detail.posts / detail.featuredSnapshots）
    post: {
      type: Object,
      default: () => ({})
    }
  },
  data() {
    return {
      shareImageUrl: '',
      shareImageFilePath: '',
      shareCanvasHeight: 1000,
      shareImageRetryCount: 0,
      shareRenderToken: 0,
      shareRenderFontFamily: '汇文明朝',
      shareRenderFontScale: 1.0,
      shareRequestedFontFamily: '汇文明朝',
      shareRenderFontPending: false,
      shareConfig: {
        fontSize: 38,
        titleFontSize: 46,
        fontFamily: '汇文明朝',
        backgroundColor: '#a4c4bd',
        textColor: '#333333',
        fontScale: 1.0
      },
      regenerateTimeout: null,
      colorPalettes,
      poemLines
    };
  },
  computed: {
    // 将周刊快照归一化为 shareCanvas 需要的诗歌字段
    sharePost() {
      const raw = this.post || {};
      const content = String(raw.content || raw.copy || '').trim();
      return {
        ...raw,
        _id: raw.postId || raw._id || raw.id || '',
        content,
        title: raw.title || '',
        isPoem: true,
        isOriginal: raw.isOriginal !== false,
        isAnonymous: false,
        author: raw.author || raw.authorName || '',
        authorName: raw.authorName || raw.author || '',
        authorSignature: raw.authorSignature || '',
        backgroundColor: raw.backgroundColor || '',
        textColor: raw.textColor || '',
        votes: Number(raw.votes) || 0,
        commentCount: Number(raw.commentCount || raw.comments) || 0
      };
    },
    shouldShowSignature() {
      const post = this.sharePost;
      if (!post || post.isAnonymous) return false;
      if (post.isPoem && post.isOriginal === false) return false;
      return true;
    },
    previewText() {
      const content = this.sharePost.content || '';
      const firstLine = String(content)
        .split('\n')
        .map(line => (line || '').trim())
        .find(line => line.length > 0);
      return firstLine || '春花秋月何时了';
    }
  },
  watch: {
    post: {
      deep: true,
      handler() {
        if (this._shareCardOpened) {
          this.resetAndRender();
        }
      }
    }
  },
  mounted() {
    this.fontManager = fontManager;
    this._fontLoadedHandler = (payload) => {
      try {
        this.onBuiltinFontLoaded(payload);
      } catch (error) {
        console.warn('[weekly-share-card-font] font-loaded handler failed', error);
      }
    };
    try { uni.$on && uni.$on('font-loaded', this._fontLoadedHandler); } catch (_) {}
    this.$nextTick(() => {
      setTimeout(() => {
        this.resetAndRender();
      }, 60);
    });
  },
  beforeDestroy() {
    try { uni.$off && uni.$off('font-loaded', this._fontLoadedHandler); } catch (_) {}
    this._fontLoadedHandler = null;
    this.clearRegenerateTimeout();
  },
  unmounted() {
    try { uni.$off && uni.$off('font-loaded', this._fontLoadedHandler); } catch (_) {}
    this._fontLoadedHandler = null;
    this.clearRegenerateTimeout();
  },
  methods: {
    clearRegenerateTimeout() {
      if (this.regenerateTimeout) {
        clearTimeout(this.regenerateTimeout);
        this.regenerateTimeout = null;
      }
    },

    resetAndRender() {
      const post = this.sharePost;
      const platform = getCurrentPlatform();
      this.shareConfig = {
        fontSize: 38,
        titleFontSize: 46,
        fontFamily: '汇文明朝',
        backgroundColor: post.backgroundColor || '#a4c4bd',
        textColor: post.textColor || '#333333',
        fontScale: 1.0
      };
      this.shareRenderFontFamily = this.shareConfig.fontFamily || '汇文明朝';
      this.shareRenderFontScale = this.shareConfig.fontScale || 1.0;
      this.shareRequestedFontFamily = this.shareConfig.fontFamily || '汇文明朝';
      this.shareRenderFontPending = false;
      this._fontLoadedRegeneratePending = false;
      this.shareImageUrl = '';
      this.shareImageFilePath = '';
      this.shareImageRetryCount = 0;
      this.shareCanvasHeight = 4000;
      this._shareCardOpened = true;

      const initialDelay = platform === 'app' ? 180 : 0;
      this.$nextTick(() => {
        setTimeout(() => {
          if (!this._shareCardOpened) return;
          this.generateShareImage();
        }, initialDelay);
      });
    },

    // ====== 字体加载 & 绘制（与诗歌详情页分享逻辑一致） ======

    createShareMeasureContext(logicalWidth = 750) {
      // #ifdef MP-WEIXIN
      if (typeof wx !== 'undefined' && typeof wx.createOffscreenCanvas === 'function') {
        try {
          const measureCanvas = wx.createOffscreenCanvas({
            type: '2d',
            width: Math.max(1, Math.round(logicalWidth)),
            height: 64
          });
          const measureCtx = measureCanvas && measureCanvas.getContext && measureCanvas.getContext('2d');
          if (measureCtx) {
            return measureCtx;
          }
        } catch (error) {
          console.warn('[weekly-share-card-canvas] offscreen measure canvas unavailable', error);
        }
      }
      // #endif

      return uni.createCanvasContext(CANVAS_ID, this);
    },

    getShareCanvasRuntime(logicalWidth, logicalHeight) {
      return new Promise((resolve, reject) => {
        // #ifdef MP-WEIXIN
        try {
          const query = (typeof wx !== 'undefined' && wx.createSelectorQuery
            ? wx.createSelectorQuery()
            : uni.createSelectorQuery()
          ).in(this);

          query.select('#weeklyShareCanvas').fields({ node: true, size: true }, (res) => {
            const canvas = res && res.node;
            if (!canvas) {
              reject(new Error('share canvas node unavailable'));
              return;
            }

            const nativeCtx = canvas.getContext && canvas.getContext('2d');
            if (!nativeCtx) {
              reject(new Error('share canvas 2d context unavailable'));
              return;
            }

            const systemInfo = getWindowInfoCompat();
            const pixelRatio = Math.max(1, Number(systemInfo.pixelRatio || 1));
            canvas.width = Math.max(1, Math.round(logicalWidth * pixelRatio));
            canvas.height = Math.max(1, Math.round(logicalHeight * pixelRatio));
            if (typeof nativeCtx.setTransform === 'function') {
              nativeCtx.setTransform(1, 0, 0, 1, 0, 0);
            }
            if (typeof nativeCtx.scale === 'function') {
              nativeCtx.scale(pixelRatio, pixelRatio);
            }

            const runtime = {
              canvas,
              nativeCtx,
              ctx: createCanvas2DCompatContext(nativeCtx),
              logicalWidth,
              logicalHeight,
              pixelRatio
            };
            this._weeklyShareCanvasRuntime = runtime;
            resolve(runtime);
          }).exec();
          return;
        } catch (error) {
          reject(error);
          return;
        }
        // #endif

        resolve(null);
      });
    },

    generateShareImage() {
      const renderToken = (this.shareRenderToken || 0) + 1;
      this.shareRenderToken = renderToken;
      this.shareRenderFontPending = false;
      this.loadFontAndDraw(renderToken);
    },

    async loadFontAndDraw(renderToken) {
      const fontFamily = this.shareConfig.fontFamily || '汇文明朝';
      const platform = getCurrentPlatform();
      this.shareRequestedFontFamily = fontFamily;
      const fontScaleMap = {
        '汇文明朝': 1.0,
        '文楷': 1.0,
        '龙藏体': 1.0,
        '小小皓体': 1.0,
        '南西雅致黑': 1.0,
        '字体圈欣意吉祥宋': 1.0
      };

      console.log('【WeeklyShareCard】开始加载字体:', fontFamily);

      if (fontFamily === 'system') {
        this.shareRenderFontFamily = 'system';
        this.shareRenderFontScale = 1.0;
        this.shareRenderFontPending = false;
        await new Promise(r => setTimeout(r, 50));
        if (renderToken !== this.shareRenderToken) return;
        this.drawCanvas(renderToken);
        return;
      }

      const mpBuiltinFontReady = platform === 'mp-weixin'
        && fontFamily === '汇文明朝'
        && (
          (this.fontManager && typeof this.fontManager.isFontLoaded === 'function' && this.fontManager.isFontLoaded(fontFamily))
          || !!uni.getStorageSync('__builtin_font_huiwen_ready__')
        );

      if (mpBuiltinFontReady) {
        this.shareRenderFontFamily = fontFamily;
        this.shareRenderFontScale = fontScaleMap[fontFamily] || 1.0;
        this.shareRenderFontPending = false;
        await new Promise(r => setTimeout(r, 260));
        if (renderToken !== this.shareRenderToken) return;
        this.drawCanvas(renderToken);
        return;
      }

      const isAppBuiltinFont = platform === 'app' && fontFamily === '汇文明朝';
      const wasFontLoadedBeforeRender = isAppBuiltinFont
        ? !!this._appBuiltinShareFontPrimed
        : !!(this.fontManager
          && typeof this.fontManager.isFontLoaded === 'function'
          && this.fontManager.isFontLoaded(fontFamily));
      const maxAttempts = isAppBuiltinFont ? 2 : 1;
      let lastError = null;

      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        try {
          if (isAppBuiltinFont && !this.fontManager.isFontLoaded(fontFamily)) {
            await new Promise(r => setTimeout(r, 120 + attempt * 80));
            if (renderToken !== this.shareRenderToken) return;
          }

          const fontPath = await this.fontManager.ensureFontAvailable(fontFamily);
          if (renderToken !== this.shareRenderToken) return;

          const fontScale = fontScaleMap[fontFamily] || 1.0;
          const needsAppFontActivationDelay = isAppBuiltinFont && !wasFontLoadedBeforeRender;
          const fontReadyDelay = needsAppFontActivationDelay
            ? 520
            : (platform === 'app' ? 220 : (platform === 'mp-weixin' ? 180 : 100));
          this.shareRenderFontFamily = fontFamily;
          this.shareRenderFontScale = fontScale;
          this.shareRenderFontPending = false;

          if (needsAppFontActivationDelay && this.$nextTick) {
            await new Promise(r => this.$nextTick(r));
            if (renderToken !== this.shareRenderToken) return;
          }

          await new Promise(r => setTimeout(r, fontReadyDelay));
          if (renderToken !== this.shareRenderToken) return;

          if (isAppBuiltinFont) {
            this._appBuiltinShareFontPrimed = true;
          }

          this.drawCanvas(renderToken);
          return;
        } catch (error) {
          lastError = error;
          if (!isAppBuiltinFont || attempt >= maxAttempts - 1) {
            break;
          }
          await new Promise(r => setTimeout(r, 180));
          if (renderToken !== this.shareRenderToken) return;
        }
      }

      if (lastError) {
        console.error('【WeeklyShareCard】字体加载失败:', fontFamily, lastError);

        if (platform === 'mp-weixin' && fontFamily === '汇文明朝') {
          this.shareRenderFontFamily = fontFamily;
          this.shareRenderFontScale = fontScaleMap[fontFamily] || 1.0;
          this.shareRenderFontPending = true;
          await new Promise(r => setTimeout(r, 220));
          if (renderToken !== this.shareRenderToken) return;
          this.drawCanvas(renderToken);
          return;
        }

        // 仅本次渲染回退到系统字体，不覆盖用户配置
        this.shareRenderFontFamily = 'system';
        this.shareRenderFontScale = 1.0;
        this.shareRenderFontPending = false;
        uni.showToast({
          title: '字体加载失败，已回退默认字体',
          icon: 'none',
          duration: 2000
        });

        await new Promise(r => setTimeout(r, 80));
        if (renderToken !== this.shareRenderToken) return;
        this.drawCanvas(renderToken);
      }
    },

    onBuiltinFontLoaded(payload = {}) {
      const loadedFontFamily = payload && payload.fontFamily ? payload.fontFamily : '';
      const requestedFontFamily = this.shareRequestedFontFamily || this.shareConfig.fontFamily || '汇文明朝';
      if (loadedFontFamily && loadedFontFamily !== '汇文明朝') return;
      if (!this._shareCardOpened) return;
      if (requestedFontFamily !== '汇文明朝') return;
      if (this.shareRenderFontFamily !== 'system' && !this.shareRenderFontPending) return;
      if (this._fontLoadedRegeneratePending) return;

      this._fontLoadedRegeneratePending = true;
      setTimeout(() => {
        this._fontLoadedRegeneratePending = false;
        if (!this._shareCardOpened) return;
        const nextRequestedFontFamily = this.shareRequestedFontFamily || this.shareConfig.fontFamily || '汇文明朝';
        if (nextRequestedFontFamily !== '汇文明朝') return;
        if (this.shareRenderFontFamily !== 'system' && !this.shareRenderFontPending) return;
        this.shareRenderFontPending = false;
        this.regenerateShareImage();
      }, 60);
    },

    async drawCanvas(renderToken) {
      try {
        if (renderToken !== this.shareRenderToken) return;
        const canvasWidth = 750;
        const platform = getCurrentPlatform();
        const effectiveShareConfig = {
          ...this.shareConfig,
          fontFamily: this.shareRenderFontFamily || this.shareConfig.fontFamily || '汇文明朝',
          fontScale: this.shareRenderFontScale || this.shareConfig.fontScale || 1.0
        };

        const measureCtx = platform === 'mp-weixin'
          ? this.createShareMeasureContext(canvasWidth)
          : uni.createCanvasContext(CANVAS_ID, this);

        const heightResult = await calculateShareCardHeight({
          measureCtx,
          post: this.sharePost,
          shareConfig: effectiveShareConfig,
          canvasWidth,
          shouldShowSignature: this.shouldShowSignature
        });

        const canvasHeight = heightResult.canvasHeight;
        if (renderToken !== this.shareRenderToken) return;

        // 先更新 Canvas 高度，等待 DOM 更新完成
        this.shareCanvasHeight = canvasHeight;
        if (this.$nextTick) { await new Promise(r => this.$nextTick(r)); }
        await new Promise(r => setTimeout(r, 100));
        if (renderToken !== this.shareRenderToken) return;

        // Canvas 高度更新后，重新创建上下文进行绘制
        let canvasRuntime = null;
        let ctx = null;
        if (platform === 'mp-weixin') {
          try {
            canvasRuntime = await this.getShareCanvasRuntime(canvasWidth, canvasHeight);
            ctx = canvasRuntime && canvasRuntime.ctx;
          } catch (canvasError) {
            console.warn('[weekly-share-card-canvas] 2d canvas unavailable, fallback to legacy canvas', canvasError);
          }
        }
        if (!ctx) {
          ctx = uni.createCanvasContext(CANVAS_ID, this);
        }
        if (!ctx) {
          console.error('【WeeklyShareCard】Canvas上下文创建失败');
          uni.showToast({ title: 'Canvas创建失败', icon: 'none' });
          return;
        }

        ctx.clearRect(0, 0, canvasWidth, canvasHeight);

        await drawShareCardContent({
          ctx,
          post: this.sharePost,
          shareConfig: effectiveShareConfig,
          canvasWidth,
          canvasHeight,
          shouldShowSignature: this.shouldShowSignature,
          ...heightResult
        });

        if (canvasRuntime && canvasRuntime.canvas) {
          await new Promise(r => setTimeout(r, 60));
          if (renderToken !== this.shareRenderToken) return;
          this.exportCanvas(canvasWidth, canvasHeight, renderToken, canvasRuntime);
          return;
        }

        ctx.draw(false, () => {
          if (renderToken !== this.shareRenderToken) return;
          setTimeout(() => {
            if (renderToken !== this.shareRenderToken) return;
            this.exportCanvas(canvasWidth, canvasHeight, renderToken);
          }, 150);
        });
      } catch (error) {
        console.error('【WeeklyShareCard】绘制过程中出现严重错误:', error);
        uni.showToast({ title: '图片生成失败，请重试', icon: 'none' });
      }
    },

    async exportCanvas(canvasWidth, canvasHeight, renderToken, canvasRuntime = null) {
      if (renderToken !== this.shareRenderToken) return;
      const exportWidth = canvasRuntime && canvasRuntime.canvas ? canvasRuntime.canvas.width : canvasWidth;
      const exportHeight = canvasRuntime && canvasRuntime.canvas ? canvasRuntime.canvas.height : canvasHeight;

      try {
        const exportResult = await exportShareCanvas({
          canvasId: CANVAS_ID,
          context: this,
          canvas: canvasRuntime && canvasRuntime.canvas ? canvasRuntime.canvas : null,
          width: exportWidth,
          height: exportHeight,
          fileType: 'jpg',
          quality: 0.9,
          scales: canvasRuntime && canvasRuntime.canvas ? [1] : [2, 2, 1.5, 1],
          retryDelayMs: canvasRuntime && canvasRuntime.canvas ? 60 : 120
        });

        if (renderToken !== this.shareRenderToken) return;

        const raw = (exportResult && exportResult.tempFilePath) || '';
        let imageUrl = raw;

        // H5 端展示时追加时间戳避免图片缓存；小程序/APP 需保留原始临时文件路径用于保存。
        // #ifdef H5
        if (raw && !raw.startsWith('data:') && !/^blob:/i.test(raw)) {
          const cacheBuster = Date.now();
          imageUrl = raw + ((raw.indexOf('?') > -1 ? '&' : '?') + '_' + cacheBuster);
        }
        // #endif

        uni.hideLoading();
        this.shareImageUrl = imageUrl;
        this.shareImageFilePath = raw;
        console.log('[weekly-share-card-canvas] export success', { exportResult });
      } catch (err) {
        if (renderToken !== this.shareRenderToken) return;
        console.error('[weekly-share-card-canvas] export failed', err);
        uni.hideLoading();
        uni.showToast({ title: '图片导出失败', icon: 'none' });
      }
    },

    // ====== 保存到相册 ======

    saveShareImage() {
      const url = this.shareImageUrl;
      const filePath = this.shareImageFilePath;
      const isRemoteUrl = (value) => /^https?:\/\//i.test(value || '');
      const isDataUrl = (value) => typeof value === 'string' && value.startsWith('data:');
      const isLocalFilePath = (value) => {
        if (!value || typeof value !== 'string') return false;
        return /^(wxfile:\/\/|file:\/\/|blob:|\/_doc\/|\/_www\/|\/?storage\/|[A-Za-z]:\\|\/data\/|\/var\/|tmp\/|\.\/tmp\/)/i.test(value)
          || (!isRemoteUrl(value) && !isDataUrl(value));
      };
      if (!url) {
        uni.showToast({ title: '图片生成中…', icon: 'none' });
        return;
      }

      const toastOK = (msg) => uni.showToast({ title: msg || '已保存', icon: 'success' });
      const toastFail = (msg) => uni.showToast({ title: msg || '保存失败', icon: 'none' });

      const handlePermissionFail = () => {
        uni.showModal({
          title: '需要相册权限',
          content: '请在设置中开启保存到相册权限后重试。',
          confirmText: '去设置',
          success: (r) => {
            if (r.confirm && uni.openSetting) {
              uni.openSetting({});
            }
          }
        });
      };

      const saveFromPath = (savePath) => {
        // #ifdef MP-WEIXIN || APP-PLUS || APP-HARMONY
        uni.saveImageToPhotosAlbum({
          filePath: savePath,
          success: () => toastOK('已保存到相册'),
          fail: (err) => {
            console.error('saveImageToPhotosAlbum 失败:', err);
            const msg = (err && err.errMsg) || '';
            if (/auth|authorize|denied|permission/i.test(msg)) {
              handlePermissionFail();
            } else {
              toastFail('保存失败');
            }
          }
        });
        // #endif
      };

      const saveOnH5 = (finalUrl) => {
        // #ifdef H5
        try {
          if (finalUrl.startsWith('data:')) {
            const arr = finalUrl.split(',');
            const mime = arr[0].match(/:(.*?);/)[1] || 'image/png';
            const bstr = atob(arr[1]);
            let n = bstr.length;
            const u8arr = new Uint8Array(n);
            while (n--) u8arr[n] = bstr.charCodeAt(n);
            const blob = new Blob([u8arr], { type: mime });
            const urlObj = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = urlObj;
            a.download = 'poementer.png';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(urlObj);
            toastOK('已开始下载');
          } else {
            const a = document.createElement('a');
            a.href = finalUrl;
            a.download = 'poementer.png';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            toastOK('已开始下载');
          }
        } catch (e) {
          console.error('H5 保存失败，尝试打开新窗口:', e);
          window.open(finalUrl, '_blank');
        }
        // #endif
      };

      // #ifdef MP-WEIXIN || APP-PLUS || APP-HARMONY
      if (filePath && isLocalFilePath(filePath)) {
        saveFromPath(filePath);
        return;
      }
      // #endif

      if (url.startsWith('data:')) {
        // base64 → 临时文件
        // #ifdef MP-WEIXIN || APP-PLUS || APP-HARMONY
        uni.base64ToTempFilePath({
          base64Data: url,
          success: (res) => {
            this.shareImageFilePath = res.filePath;
            saveFromPath(res.filePath);
          },
          fail: (err) => {
            console.error('base64ToTempFilePath 失败:', err);
            toastFail('图片转换失败');
          }
        });
        // #endif
        // #ifdef H5
        saveOnH5(url);
        // #endif
      } else if (/^https?:\/\//i.test(url)) {
        // 远程 URL 先下载
        // #ifdef MP-WEIXIN || APP-PLUS || APP-HARMONY
        uni.downloadFile({
          url,
          success: (res) => {
            if (res.statusCode === 200) {
              const downloadedPath = res.tempFilePath || res.filePath;
              if (downloadedPath) {
                this.shareImageFilePath = downloadedPath;
                saveFromPath(downloadedPath);
              } else {
                console.error('downloadFile succeeded without file path:', res);
                toastFail('保存失败');
              }
            } else {
              console.error('downloadFile 非200:', res.statusCode);
              toastFail('下载失败');
            }
          },
          fail: (err) => {
            console.error('downloadFile 失败:', err);
            toastFail('下载失败');
          }
        });
        // #endif
        // #ifdef H5
        saveOnH5(url);
        // #endif
      } else {
        // 本地临时路径
        // #ifdef MP-WEIXIN || APP-PLUS || APP-HARMONY
        if (url && isLocalFilePath(url)) {
          this.shareImageFilePath = url;
        }
        saveFromPath(url);
        // #endif
        // #ifdef H5
        saveOnH5(url);
        // #endif
      }
    },

    // ====== ShareModal 事件 ======

    onImageLongPress() {
      // #ifdef APP-PLUS || APP-HARMONY
      this.saveShareImage();
      // #endif
      // #ifdef H5 || MP-WEIXIN
      uni.showToast({ title: '长按可保存', icon: 'none' });
      // #endif
    },

    onShareImageLoad() {
      console.log('【WeeklyShareCard】分享图片加载成功');
    },

    onShareImageError() {
      console.error('【WeeklyShareCard】分享图片加载失败');
      if (this.shareImageRetryCount < 2) {
        this.shareImageRetryCount += 1;
        setTimeout(() => {
          this.generateShareImage();
        }, 1000);
      } else {
        uni.showToast({ title: '图片显示失败，请重试', icon: 'none' });
      }
    },

    onFontSizePreview(fontSize) {
      const fontFamily = this.shareConfig.fontFamily || '汇文明朝';
      const fontScaleMap = {
        '汇文明朝': 1.0,
        '文楷': 1.0,
        '龙藏体': 1.0,
        '小小皓体': 1.0,
        '南西雅致黑': 1.0,
        '字体圈欣意吉祥宋': 1.0
      };
      const fontScale = fontScaleMap[fontFamily] || 1.0;

      this.debouncedRegenerateImage({
        ...this.shareConfig,
        fontSize,
        titleFontSize: Math.round(fontSize * 1.21),
        fontScale
      });
    },

    onFontFamilyPreview(fontFamily) {
      const fontScaleMap = {
        '汇文明朝': 1.0,
        '文楷': 1.0,
        '龙藏体': 1.0,
        '小小皓体': 1.0,
        '南西雅致黑': 1.0,
        '字体圈欣意吉祥宋': 1.0
      };
      const fontScale = fontScaleMap[fontFamily] || 1.0;

      this.debouncedRegenerateImage({
        ...this.shareConfig,
        fontFamily,
        fontScale
      });
    },

    onFontSettingsChange(settings) {
      this.shareConfig = {
        ...this.shareConfig,
        fontSize: settings.fontSize,
        titleFontSize: Math.round(settings.fontSize * 1.21),
        fontFamily: settings.fontFamily
      };
      this.regenerateShareImage();
    },

    onColorChange(colorConfig) {
      this.shareConfig = {
        ...this.shareConfig,
        backgroundColor: colorConfig.backgroundColor,
        textColor: colorConfig.textColor
      };
      this.regenerateShareImage();
    },

    debouncedRegenerateImage(tempConfig) {
      clearTimeout(this.regenerateTimeout);
      this.regenerateTimeout = setTimeout(() => {
        this.shareConfig = tempConfig;
        this.regenerateShareImage();
      }, 300);
    },

    regenerateShareImage() {
      console.log('【WeeklyShareCard】重新生成分享图片，新配置:', this.shareConfig);
      this.shareImageUrl = '';
      this.shareImageFilePath = '';
      this.shareImageRetryCount = 0;
      this.shareCanvasHeight = 1000;
      this.$nextTick(() => {
        setTimeout(() => {
          this.generateShareImage();
        }, 50);
      });
    },

    forceRegenerateCanvas() {
      console.log('【WeeklyShareCard】强制重新生成Canvas');
      this.shareImageUrl = '';
      this.shareImageFilePath = '';
      this.shareImageRetryCount = 0;
      this.shareCanvasHeight = 1000;
      this.$nextTick(() => {
        setTimeout(() => {
          this.generateShareImage();
        }, 200);
      });
    }
  }
};
</script>

<style scoped>
.weekly-share-card-modal {
  /* 全屏弹窗及隐藏画布容器 */
}
</style>
