<template>
  <view class="cropper-page">
    <view class="canvas-wrap">
      <canvas
        class="crop-canvas"
        canvas-id="noticeCropCanvas"
        :style="{ width: canvasW + 'px', height: canvasH + 'px' }"
        @touchstart="onTouchStart"
        @touchmove.stop.prevent="onTouchMove"
        @touchend="onTouchEnd"
        @touchcancel="onTouchEnd"
      ></canvas>
      <view class="crop-border"></view>
    </view>

    <view class="hint">拖动图片调整位置，双指缩放调整大小</view>

    <view class="bottom-bar">
      <view class="bar-btn" @tap="chooseAgain">重新选择</view>
      <view class="bar-btn primary" @tap="confirmCrop">确定裁剪</view>
    </view>

    <canvas
      class="output-canvas"
      canvas-id="noticeCropOut"
      :style="{ width: outputW + 'px', height: outputH + 'px' }"
    ></canvas>
  </view>
</template>

<script>
const DEFAULT_CROP_RATIO = 16 / 7;
const OUTPUT_W = 1600;
const OUTPUT_H = Math.round(OUTPUT_W / DEFAULT_CROP_RATIO);
const MIN_ZOOM = 1;
const MAX_ZOOM = 4;

function parseRatio(value) {
  if (!value) return DEFAULT_CROP_RATIO;
  const parts = String(value).split('/');
  const w = Number(parts[0]);
  const h = Number(parts[1]);
  if (Number.isFinite(w) && Number.isFinite(h) && w > 0 && h > 0) {
    return w / h;
  }
  return DEFAULT_CROP_RATIO;
}

function touchDistance(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

export default {
  data() {
    return {
      sourcePath: '',
      imgW: 0,
      imgH: 0,
      canvasW: 0,
      canvasH: 0,
      baseScale: 1,
      scale: 1,
      offsetX: 0,
      offsetY: 0,
      ready: false,
      touchStart: null,
      cropRatio: DEFAULT_CROP_RATIO,
      emitEvent: 'notice-image-cropped',
      outputW: OUTPUT_W,
      outputH: OUTPUT_H
    };
  },
  onLoad(options) {
    const src = options && options.src ? decodeURIComponent(options.src) : '';
    this.cropRatio = parseRatio(options && options.ratio);
    this.emitEvent = (options && options.event) || 'notice-image-cropped';
    this.outputH = Math.round(this.outputW / this.cropRatio);
    this.sourcePath = src;
    this.initCanvas();
  },
  onUnload() {
    this.touchStart = null;
  },
  methods: {
    initCanvas() {
      const sys = uni.getSystemInfoSync();
      const windowWidth = (sys && sys.windowWidth) || 375;
      const margin = Math.round(windowWidth * 0.05);
      const canvasW = windowWidth - margin * 2;
      this.canvasW = canvasW;
      this.canvasH = Math.round(canvasW / this.cropRatio);
      this.loadSource();
    },

    async loadSource() {
      if (!this.sourcePath) {
        uni.showToast({ title: '未获取到图片', icon: 'none' });
        setTimeout(() => uni.navigateBack(), 800);
        return;
      }
      try {
        const info = await new Promise((resolve, reject) => {
          uni.getImageInfo({ src: this.sourcePath, success: resolve, fail: reject });
        });
        this.imgW = info.width || 0;
        this.imgH = info.height || 0;
        if (!this.imgW || !this.imgH) {
          throw new Error('图片尺寸无效');
        }
        this.baseScale = Math.max(this.canvasW / this.imgW, this.canvasH / this.imgH);
        this.scale = this.baseScale;
        this.offsetX = 0;
        this.offsetY = 0;
        this.ready = true;
        this.render();
      } catch (error) {
        uni.showToast({ title: '图片加载失败', icon: 'none' });
        setTimeout(() => uni.navigateBack(), 800);
      }
    },

    render() {
      if (!this.ready) return;
      const ctx = uni.createCanvasContext('noticeCropCanvas', this);
      ctx.clearRect(0, 0, this.canvasW, this.canvasH);
      const dw = this.imgW * this.scale;
      const dh = this.imgH * this.scale;
      const dx = this.canvasW / 2 - dw / 2 + this.offsetX;
      const dy = this.canvasH / 2 - dh / 2 + this.offsetY;
      ctx.drawImage(this.sourcePath, dx, dy, dw, dh);
      ctx.draw();
    },

    clampOffset(offset, scale) {
      const maxX = Math.max(0, (this.imgW * scale - this.canvasW) / 2);
      const maxY = Math.max(0, (this.imgH * scale - this.canvasH) / 2);
      return Math.min(maxX, Math.max(-maxX, offset));
    },

    toTouchList(touches) {
      if (Array.isArray(touches)) return touches;
      if (touches && typeof touches.length === 'number') {
        return Array.from(touches);
      }
      return [];
    },

    onTouchStart(event) {
      const touches = this.toTouchList(event && event.touches);
      if (touches.length === 0) return;
      this.touchStart = {
        touches: touches.map(t => ({ x: t.clientX, y: t.clientY })),
        scale: this.scale,
        offsetX: this.offsetX,
        offsetY: this.offsetY
      };
    },

    onTouchMove(event) {
      const touches = this.toTouchList(event && event.touches);
      if (touches.length === 0 || !this.touchStart || !this.ready) return;

      if (touches.length === 1) {
        const dx = touches[0].clientX - this.touchStart.touches[0].x;
        const dy = touches[0].clientY - this.touchStart.touches[0].y;
        this.offsetX = this.clampOffset(this.touchStart.offsetX + dx, this.touchStart.scale);
        this.offsetY = this.clampOffset(this.touchStart.offsetY + dy, this.touchStart.scale);
      } else if (touches.length >= 2 && this.touchStart.touches.length >= 2) {
        const prevDist = touchDistance(this.touchStart.touches[0], this.touchStart.touches[1]);
        const curDist = touchDistance(
          { x: touches[0].clientX, y: touches[0].clientY },
          { x: touches[1].clientX, y: touches[1].clientY }
        );
        if (prevDist > 0) {
          const zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, (curDist / prevDist) * (this.touchStart.scale / this.baseScale)));
          this.scale = this.baseScale * zoom;
          this.offsetX = this.clampOffset(this.touchStart.offsetX, this.scale);
          this.offsetY = this.clampOffset(this.touchStart.offsetY, this.scale);
        }
      }
      this.render();
    },

    onTouchEnd() {
      this.touchStart = null;
    },

    chooseAgain() {
      uni.chooseImage({
        count: 1,
        sizeType: ['compressed'],
        sourceType: ['album', 'camera'],
        success: (res) => {
          const path = (res && res.tempFilePaths && res.tempFilePaths[0]) || '';
          if (!path) return;
          this.sourcePath = path;
          this.loadSource();
        }
      });
    },

    confirmCrop() {
      if (!this.ready) return;
      uni.showLoading({ title: '裁剪中...' });
      const ctx = uni.createCanvasContext('noticeCropOut', this);
      ctx.clearRect(0, 0, this.outputW, this.outputH);
      const sx = (this.imgW * this.scale / 2 - this.canvasW / 2 - this.offsetX) / this.scale;
      const sy = (this.imgH * this.scale / 2 - this.canvasH / 2 - this.offsetY) / this.scale;
      const sw = this.canvasW / this.scale;
      const sh = this.canvasH / this.scale;
      ctx.drawImage(this.sourcePath, sx, sy, sw, sh, 0, 0, this.outputW, this.outputH);
      ctx.draw(false, () => {
        uni.canvasToTempFilePath({
          canvasId: 'noticeCropOut',
          x: 0,
          y: 0,
          width: this.outputW,
          height: this.outputH,
          destWidth: this.outputW,
          destHeight: this.outputH,
          fileType: 'jpg',
          quality: 0.92,
            success: (res) => {
            const path = res && res.tempFilePath;
            uni.hideLoading();
            if (path) {
              uni.$emit(this.emitEvent, { path });
              uni.navigateBack();
            } else {
              uni.showToast({ title: '裁剪失败', icon: 'none' });
            }
          },
          fail: () => {
            uni.hideLoading();
            uni.showToast({ title: '裁剪失败', icon: 'none' });
          }
        });
      });
    }
  }
};
</script>

<style scoped>
.cropper-page {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: #111111;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 60rpx 0 40rpx;
  box-sizing: border-box;
  overflow: hidden;
}

.canvas-wrap {
  position: relative;
  border-radius: 8rpx;
  overflow: hidden;
}

.crop-canvas {
  display: block;
}

.crop-border {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  border: 2rpx solid rgba(255, 255, 255, 0.85);
  box-sizing: border-box;
  pointer-events: none;
}

.hint {
  margin-top: 40rpx;
  color: rgba(255, 255, 255, 0.55);
  font-size: 26rpx;
}

.bottom-bar {
  margin-top: 48rpx;
  width: 100%;
  display: flex;
  justify-content: center;
  gap: 32rpx;
}

.bar-btn {
  min-width: 220rpx;
  height: 84rpx;
  line-height: 84rpx;
  text-align: center;
  border-radius: 999rpx;
  font-size: 30rpx;
  background: rgba(255, 255, 255, 0.14);
  color: #fff;
  padding: 0 36rpx;
  box-sizing: border-box;
}

.bar-btn.primary {
  background: #1f9d55;
  color: #fff;
}

.output-canvas {
  position: fixed;
  left: -9999px;
  top: -9999px;
}
</style>