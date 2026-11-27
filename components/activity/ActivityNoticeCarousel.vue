<template>
  <view
    class="activity-notice-carousel"
    :class="{
      'activity-notice-carousel--two-up': isTwoUp,
      'activity-notice-carousel--wide-single': isWideLayout && !isTwoUp
    }"
  >
    <!-- #ifdef APP-PLUS || H5 -->
    <view
      :id="viewportId"
      class="notice-viewport notice-viewport--track"
      :class="{
        'notice-viewport--two-up': isTwoUp,
        'notice-viewport--draggable': canLoop
      }"
      :carouselConfig="carouselConfig"
      :change:carouselConfig="noticeCarouselView.syncConfig"
    >
      <view class="notice-track">
        <view
          v-for="slide in trackSlides"
          :key="slide.renderKey"
          class="notice-track-item"
        >
          <view class="notice-slide-slot">
            <view
              :class="[
                'notice-card',
                slide.notice.tone || 'default',
                { 'is-linked': !!slide.notice.linkUrl, 'has-image': !!slide.notice.image }
              ]"
              @tap="handleSelect(slide.notice)"
            >
              <image
                v-if="slide.notice.image"
                class="notice-image"
                :src="slide.notice.image"
                mode="aspectFill"
                :draggable="false"
                @error="onImageError(slide.notice)"
              />
              <template v-else>
                <view class="notice-copy">
                  <text class="notice-kicker">{{ slide.notice.kicker }}</text>
                  <text class="notice-title">{{ slide.notice.title }}</text>
                  <text class="notice-summary">{{ slide.notice.summary }}</text>
                </view>
                <view class="notice-art">
                  <text class="notice-art-mark">{{ slide.notice.mark }}</text>
                </view>
              </template>
            </view>
          </view>
        </view>
      </view>
    </view>
    <!-- #endif -->

    <!-- #ifndef APP-PLUS || H5 -->
    <view class="notice-viewport" :class="{ 'notice-viewport--two-up': isTwoUp }">
      <swiper
        :key="'notice-swiper-' + displayCount + '-' + mpSwiperSlides.length"
        class="notice-swiper"
        :current="swiperCurrent"
        :display-multiple-items="displayCount"
        :autoplay="canLoop && active"
        :interval="4200"
        :duration="360"
        :circular="mpCanCircular"
        @change="handleChange"
      >
        <swiper-item
          v-for="slide in mpSwiperSlides"
          :key="slide.renderKey"
          class="notice-swiper-item"
        >
          <view class="notice-slide-slot">
            <view
              :class="[
                'notice-card',
                slide.notice.tone || 'default',
                { 'is-linked': !!slide.notice.linkUrl, 'has-image': !!slide.notice.image }
              ]"
              @tap="handleSelect(slide.notice)"
            >
              <image
                v-if="slide.notice.image"
                class="notice-image"
                :src="slide.notice.image"
                mode="aspectFill"
                @error="onImageError(slide.notice)"
              />
              <template v-else>
                <view class="notice-copy">
                  <text class="notice-kicker">{{ slide.notice.kicker }}</text>
                  <text class="notice-title">{{ slide.notice.title }}</text>
                  <text class="notice-summary">{{ slide.notice.summary }}</text>
                </view>
                <view class="notice-art">
                  <text class="notice-art-mark">{{ slide.notice.mark }}</text>
                </view>
              </template>
            </view>
          </view>
        </swiper-item>
      </swiper>
    </view>
    <!-- #endif -->

    <view v-if="canLoop" class="notice-dots" aria-hidden="true">
      <view
        v-for="(notice, index) in safeNotices"
        :key="`${notice.value}-dot`"
        :class="['notice-dot', safeCurrentIndex === index ? 'active' : '']"
        @tap="handleDotTap(index)"
      ></view>
    </view>
  </view>
</template>

<script>
import { normalizeActivityNoticeLink } from '@/utils/activityNoticeLink.js';

let nextCarouselUid = 0;

export default {
  name: 'ActivityNoticeCarousel',
  emits: ['select'],
  props: {
    notices: {
      type: Array,
      default: () => []
    },
    active: {
      type: Boolean,
      default: true
    }
  },
  data() {
    return {
      viewportId: `activity-notice-viewport-${++nextCarouselUid}`,
      activeIndex: 0,
      swiperCurrent: 0,
      jumpIndex: 0,
      jumpSeq: 0,
      failedImages: {},
      lastDragEndAt: 0
    };
  },
  computed: {
    safeNotices() {
      return (Array.isArray(this.notices) ? this.notices : [])
        .filter(item => item && item.value && item.title)
        .map(item => {
          const base = {
            kicker: '公告',
            summary: '',
            mark: '',
            tone: 'default',
            image: '',
            ...item
          };
          base.linkUrl = normalizeActivityNoticeLink(item.linkUrl);
          if (base.image && this.failedImages[item.value]) {
            base.image = '';
          }
          return base;
        });
    },
    isTwoUp() {
      return !!(this.isWideLayout && this.safeNotices.length >= 2);
    },
    displayCount() {
      return this.isTwoUp ? 2 : 1;
    },
    canLoop() {
      return this.safeNotices.length > this.displayCount;
    },
    cloneCount() {
      return this.canLoop ? this.displayCount : 0;
    },
    trackSlides() {
      const list = this.safeNotices;
      if (!list.length) return [];
      const clones = this.cloneCount;
      if (clones <= 0) {
        return list.map(notice => ({
          renderKey: `real-${notice.value}`,
          notice
        }));
      }
      const head = [];
      for (let i = 0; i < clones; i++) {
        const idx = (list.length - clones + i + list.length) % list.length;
        head.push({
          renderKey: `head-${i}-${list[idx].value}`,
          notice: list[idx]
        });
      }
      const body = list.map(notice => ({
        renderKey: `real-${notice.value}`,
        notice
      }));
      const tail = [];
      for (let i = 0; i < clones; i++) {
        const idx = i % list.length;
        tail.push({
          renderKey: `tail-${i}-${list[idx].value}`,
          notice: list[idx]
        });
      }
      return head.concat(body, tail);
    },
    mpSwiperSlides() {
      const list = this.safeNotices;
      if (!list.length) return [];
      // 宽屏双卡循环至少需要 displayCount * 2 项，避免 3 张卡片时原生 swiper 首尾抢位闪烁。
      const shouldDouble = this.canLoop && this.displayCount > 1 && list.length < this.displayCount * 2;
      if (!shouldDouble) {
        return list.map(notice => ({
          renderKey: `mp-${notice.value}`,
          notice
        }));
      }
      return list
        .map(notice => ({ renderKey: `mp-a-${notice.value}`, notice }))
        .concat(list.map(notice => ({ renderKey: `mp-b-${notice.value}`, notice })));
    },
    mpCanCircular() {
      return this.canLoop && this.mpSwiperSlides.length > this.displayCount;
    },
    safeCurrentIndex() {
      const len = this.safeNotices.length;
      if (len <= 0) return 0;
      const maxIndex = this.canLoop ? len - 1 : Math.max(0, len - this.displayCount);
      return Math.min(Math.max(0, this.activeIndex), maxIndex);
    },
    noticesSignature() {
      return `${this.displayCount}|${this.cloneCount}|${this.safeNotices.map(item => item.value).join(',')}`;
    },
    carouselConfig() {
      return {
        viewportId: this.viewportId,
        count: this.safeNotices.length,
        displayCount: this.displayCount,
        cloneCount: this.cloneCount,
        canLoop: this.canLoop,
        active: !!this.active,
        interval: 4200,
        duration: 320,
        signature: this.noticesSignature,
        jumpIndex: this.jumpIndex,
        jumpSeq: this.jumpSeq
      };
    }
  },
  watch: {
    noticesSignature() {
      const next = this.safeCurrentIndex;
      this.activeIndex = next;
      this.swiperCurrent = next;
    }
  },
  methods: {
    handleSelect(notice) {
      if (this.lastDragEndAt && Date.now() - this.lastDragEndAt < 280) {
        return;
      }
      if (notice && notice.linkUrl) this.$emit('select', notice);
    },
    handleChange(event) {
      const raw = event && event.detail ? Number(event.detail.current) : 0;
      const len = this.safeNotices.length;
      if (!Number.isFinite(raw) || len <= 0) {
        this.activeIndex = 0;
        return;
      }
      this.activeIndex = ((Math.round(raw) % len) + len) % len;
    },
    handleDotTap(index) {
      if (!this.canLoop) return;
      const len = this.safeNotices.length;
      if (len <= 0) return;
      const normalized = ((Math.round(index) % len) + len) % len;
      this.activeIndex = normalized;
      this.swiperCurrent = normalized;
      this.jumpIndex = normalized;
      this.jumpSeq += 1;
    },
    onViewIndexChange(payload) {
      const next = payload && Number.isFinite(Number(payload.index)) ? Number(payload.index) : 0;
      const len = this.safeNotices.length;
      if (len <= 0) {
        this.activeIndex = 0;
        return;
      }
      this.activeIndex = ((Math.round(next) % len) + len) % len;
    },
    onViewDragEnd() {
      this.lastDragEndAt = Date.now();
    },
    onImageError(notice) {
      if (!notice || !notice.value) return;
      this.failedImages = {
        ...this.failedImages,
        [notice.value]: true
      };
    }
  }
};
</script>

<!-- #ifdef APP-PLUS || H5 -->
<script module="noticeCarouselView" lang="renderjs">
const DEADZONE_PX = 8;
const SWIPE_DISTANCE_RATIO = 0.22;
const SWIPE_VELOCITY_THRESHOLD = 0.3;
const SWIPE_VELOCITY_MIN_DX = 12;

export default {
  beforeUnmount() {
    this.teardownController();
  },
  destroyed() {
    this.teardownController();
  },
  methods: {
    teardownController() {
      const ctrl = this._carouselCtrl;
      if (!ctrl) return;
      ctrl.destroy();
      this._carouselCtrl = null;
    },
    syncConfig(newVal, oldVal, ownerInstance) {
      if (!newVal || !newVal.viewportId || typeof document === 'undefined') return;
      if (!this._carouselCtrl || this._carouselCtrl.viewportId !== newVal.viewportId) {
        this.teardownController();
        this._carouselCtrl = this.createController(newVal.viewportId, ownerInstance);
      } else if (ownerInstance) {
        this._carouselCtrl.ownerInstance = ownerInstance;
      }
      this._carouselCtrl.update(newVal);
    },
    createController(viewportId, ownerInstance) {
      const ctrl = {
        viewportId,
        ownerInstance,
        viewportEl: null,
        trackEl: null,
        config: null,
        bound: false,
        destroyed: false,
        realIndex: 0,
        trackIndex: 0,
        lastSignature: '',
        lastJumpSeq: 0,
        slideWidth: 0,
        dragging: false,
        dragMode: '',
        axis: '',
        startX: 0,
        startY: 0,
        lastX: 0,
        lastTime: 0,
        dx: 0,
        velocity: 0,
        isAnimating: false,
        settleTimer: null,
        autoplayTimer: null,
        mountRetryTimer: null,
        suppressClickUntil: 0,
        handlers: null,

        ensureElements() {
          if (this.destroyed) return false;
          const viewport = document.getElementById(this.viewportId);
          if (!viewport) return false;
          const track = viewport.querySelector('.notice-track');
          if (!track) return false;
          if (this.viewportEl !== viewport || this.trackEl !== track) {
            this.unbindEvents();
            this.viewportEl = viewport;
            this.trackEl = track;
            this.bindEvents();
          }
          return true;
        },

        getStepPercent() {
          const count = this.config && this.config.displayCount > 0 ? this.config.displayCount : 1;
          return 100 / count;
        },

        measureSlideWidth() {
          if (!this.viewportEl || !this.config) return 0;
          const width = this.viewportEl.clientWidth || 0;
          if (width <= 0) return 0;
          const count = this.config.displayCount > 0 ? this.config.displayCount : 1;
          return width / count;
        },

        normalizeRealIndex(index) {
          const count = this.config ? this.config.count : 0;
          if (count <= 0) return 0;
          return ((Math.round(index) % count) + count) % count;
        },

        clearSettleTimer() {
          if (this.settleTimer) {
            clearTimeout(this.settleTimer);
            this.settleTimer = null;
          }
        },

        stopAutoplay() {
          if (this.autoplayTimer) {
            clearTimeout(this.autoplayTimer);
            this.autoplayTimer = null;
          }
        },

        scheduleAutoplay() {
          this.stopAutoplay();
          if (this.destroyed || !this.config || !this.config.canLoop || !this.config.active) return;
          if (typeof document !== 'undefined' && document.hidden) return;
          const interval = Math.max(1500, Number(this.config.interval) || 4200);
          this.autoplayTimer = setTimeout(() => {
            this.autoplayTimer = null;
            if (this.destroyed || this.dragging || !this.config || !this.config.canLoop || !this.config.active) return;
            if (typeof document !== 'undefined' && document.hidden) return;
            if (!this.ensureElements()) return;
            const width = this.measureSlideWidth();
            if (width <= 0) {
              this.scheduleAutoplay();
              return;
            }
            this.slideWidth = width;
            this.normalizeTrackPositionIfNeeded(true);
            this.animateToTrackIndex(this.trackIndex + 1);
            this.scheduleAutoplay();
          }, interval);
        },

        notifyIndex(index) {
          if (!this.ownerInstance || typeof this.ownerInstance.callMethod !== 'function') return;
          try {
            this.ownerInstance.callMethod('onViewIndexChange', { index });
          } catch (_) {}
        },

        notifyDragEnd() {
          if (!this.ownerInstance || typeof this.ownerInstance.callMethod !== 'function') return;
          try {
            this.ownerInstance.callMethod('onViewDragEnd', { ts: Date.now() });
          } catch (_) {}
        },

        applyRestTransform() {
          if (!this.trackEl || !this.config) return;
          this.clearSettleTimer();
          this.isAnimating = false;
          const stepPct = this.getStepPercent();
          const xPct = -this.trackIndex * stepPct;
          this.trackEl.style.transition = 'none';
          this.trackEl.style.webkitTransition = 'none';
          const transform = `translate3d(${xPct}%, 0, 0)`;
          this.trackEl.style.webkitTransform = transform;
          this.trackEl.style.transform = transform;
        },

        normalizeTrackPositionIfNeeded(forceFlush = false) {
          if (!this.config || !this.config.canLoop || !this.trackEl) return;
          const clones = this.config.cloneCount;
          const count = this.config.count;
          if (count <= 0 || clones <= 0) return;
          if (this.trackIndex < clones || this.trackIndex >= clones + count) {
            this.realIndex = this.normalizeRealIndex(this.trackIndex - clones);
            this.trackIndex = clones + this.realIndex;
            this.applyRestTransform();
            if (forceFlush) {
              void this.trackEl.offsetWidth;
            }
          }
        },

        settleAnimation() {
          if (this.destroyed || !this.trackEl || !this.config) return;
          this.clearSettleTimer();
          this.isAnimating = false;
          if (this.config.canLoop) {
            const clones = this.config.cloneCount;
            this.realIndex = this.normalizeRealIndex(this.trackIndex - clones);
            this.trackIndex = clones + this.realIndex;
          } else {
            this.realIndex = 0;
            this.trackIndex = 0;
          }
          this.applyRestTransform();
        },

        animateToTrackIndex(targetTrackIndex, options = {}) {
          if (!this.trackEl || !this.config) return;
          const fromDrag = !!options.fromDrag;
          const currentVisualDx = fromDrag ? Number(options.currentDx) || 0 : 0;
          const prevTrackIndex = this.trackIndex;
          const clones = this.config.cloneCount;
          const count = this.config.count;
          const displayCount = this.config.displayCount;
          const totalSlides = count + clones * 2;
          const maxTrackIndex = Math.max(0, totalSlides - displayCount);
          const clampedTarget = Math.min(Math.max(0, Math.round(targetTrackIndex)), maxTrackIndex);

          const nextReal = this.config.canLoop
            ? this.normalizeRealIndex(clampedTarget - clones)
            : 0;
          const indexChanged = nextReal !== this.realIndex;
          this.trackIndex = clampedTarget;
          this.realIndex = nextReal;
          if (indexChanged) {
            this.notifyIndex(nextReal);
          }

          const width = this.slideWidth > 0 ? this.slideWidth : this.measureSlideWidth();
          if (width <= 0) {
            this.settleAnimation();
            return;
          }
          this.slideWidth = width;

          const startX = -prevTrackIndex * width + currentVisualDx;
          const targetX = -this.trackIndex * width;
          if (Math.abs(targetX - startX) < 0.5) {
            this.settleAnimation();
            return;
          }

          if (!fromDrag) {
            const startTransform = `translate3d(${startX}px, 0, 0)`;
            this.trackEl.style.webkitTransition = 'none';
            this.trackEl.style.transition = 'none';
            this.trackEl.style.webkitTransform = startTransform;
            this.trackEl.style.transform = startTransform;
            void this.trackEl.offsetWidth;
          }

          const duration = Math.max(160, Number(this.config.duration) || 320);
          const transition = `transform ${duration}ms cubic-bezier(0.22, 1, 0.36, 1)`;
          const transform = `translate3d(${targetX}px, 0, 0)`;

          this.clearSettleTimer();
          this.isAnimating = true;
          this.trackEl.style.webkitTransition = transition;
          this.trackEl.style.transition = transition;
          this.trackEl.style.webkitTransform = transform;
          this.trackEl.style.transform = transform;

          this.settleTimer = setTimeout(() => {
            this.settleAnimation();
          }, duration + 50);
        },

        handlePointerStart(x, y, mode) {
          if (!this.config || !this.config.canLoop || !this.trackEl) return;
          this.stopAutoplay();
          if (this.isAnimating) {
            this.settleAnimation();
          } else {
            this.normalizeTrackPositionIfNeeded(false);
          }
          const width = this.measureSlideWidth();
          if (width <= 0) {
            this.scheduleAutoplay();
            return;
          }
          this.slideWidth = width;
          // 切换到像素基准，保证拖拽与松手动画同单位无缝衔接。
          const baseTransform = `translate3d(${-this.trackIndex * width}px, 0, 0)`;
          this.trackEl.style.webkitTransition = 'none';
          this.trackEl.style.transition = 'none';
          this.trackEl.style.webkitTransform = baseTransform;
          this.trackEl.style.transform = baseTransform;

          this.dragging = true;
          this.dragMode = mode;
          this.axis = '';
          this.startX = x;
          this.startY = y;
          this.lastX = x;
          this.lastTime = Date.now();
          this.dx = 0;
          this.velocity = 0;
        },

        handlePointerMove(x, y, event) {
          if (!this.dragging || !this.trackEl || !this.config) return;
          const moveDx = x - this.startX;
          const moveDy = y - this.startY;

          if (!this.axis) {
            if (Math.abs(moveDx) < DEADZONE_PX && Math.abs(moveDy) < DEADZONE_PX) {
              return;
            }
            if (Math.abs(moveDx) > Math.abs(moveDy) * 1.05) {
              this.axis = 'x';
            } else {
              this.axis = 'y';
              this.dragging = false;
              this.dragMode = '';
              this.dx = 0;
              this.velocity = 0;
              this.applyRestTransform();
              this.scheduleAutoplay();
              return;
            }
          }

          if (this.axis !== 'x') return;
          if (event) {
            if (event.cancelable) event.preventDefault();
            event.stopPropagation();
          }

          const now = Date.now();
          const dt = Math.max(1, now - this.lastTime);
          const instVelocity = (x - this.lastX) / dt;
          this.velocity = this.velocity * 0.65 + instVelocity * 0.35;
          this.lastX = x;
          this.lastTime = now;

          const width = this.slideWidth;
          const maxShift = width * (this.config.cloneCount >= 2 ? 1.45 : 1.05);
          let visualDx = moveDx;
          if (Math.abs(visualDx) > width) {
            const sign = visualDx > 0 ? 1 : -1;
            const excess = Math.abs(visualDx) - width;
            visualDx = sign * Math.min(maxShift, width + excess * 0.35);
          }

          this.dx = visualDx;
          const transform = `translate3d(${-this.trackIndex * width + visualDx}px, 0, 0)`;
          this.trackEl.style.webkitTransform = transform;
          this.trackEl.style.transform = transform;
        },

        handlePointerEnd(isCancel) {
          if (!this.dragging) return;
          const wasHorizontal = this.axis === 'x';
          const finalDx = this.dx;
          const finalVelocity = this.velocity;
          const width = this.slideWidth;

          this.dragging = false;
          this.dragMode = '';
          this.axis = '';
          this.dx = 0;
          this.velocity = 0;

          if (!wasHorizontal || width <= 0) {
            this.applyRestTransform();
            this.scheduleAutoplay();
            return;
          }

          this.suppressClickUntil = Date.now() + 300;
          this.notifyDragEnd();

          let step = 0;
          if (isCancel) {
            if (Math.abs(finalDx) > width * 0.5) {
              step = finalDx < 0 ? 1 : -1;
            }
          } else {
            const distanceThreshold = width * SWIPE_DISTANCE_RATIO;
            if (finalDx < -distanceThreshold || (finalVelocity < -SWIPE_VELOCITY_THRESHOLD && finalDx < -SWIPE_VELOCITY_MIN_DX)) {
              step = 1;
            } else if (finalDx > distanceThreshold || (finalVelocity > SWIPE_VELOCITY_THRESHOLD && finalDx > SWIPE_VELOCITY_MIN_DX)) {
              step = -1;
            }
          }

          this.animateToTrackIndex(this.trackIndex + step, { fromDrag: true, currentDx: finalDx });
          this.scheduleAutoplay();
        },

        bindEvents() {
          if (this.bound || !this.viewportEl || !this.trackEl) return;
          const onTouchStart = (e) => {
            if (!e.touches || e.touches.length !== 1) return;
            const touch = e.touches[0];
            this.handlePointerStart(touch.clientX, touch.clientY, 'touch');
          };
          const onTouchMove = (e) => {
            if (!this.dragging || this.dragMode !== 'touch') return;
            if (!e.touches || e.touches.length !== 1) {
              this.handlePointerEnd(true);
              return;
            }
            const touch = e.touches[0];
            this.handlePointerMove(touch.clientX, touch.clientY, e);
          };
          const onTouchEnd = () => {
            if (this.dragging && this.dragMode === 'touch') {
              this.handlePointerEnd(false);
            }
          };
          const onTouchCancel = () => {
            if (this.dragging && this.dragMode === 'touch') {
              this.handlePointerEnd(true);
            }
          };
          const onMouseDown = (e) => {
            if (e.button !== 0) return;
            this.handlePointerStart(e.clientX, e.clientY, 'mouse');
          };
          const onMouseMove = (e) => {
            if (this.dragging && this.dragMode === 'mouse') {
              this.handlePointerMove(e.clientX, e.clientY, e);
            }
          };
          const onMouseUp = () => {
            if (this.dragging && this.dragMode === 'mouse') {
              this.handlePointerEnd(false);
            }
          };
          const onClickCapture = (e) => {
            if (Date.now() < this.suppressClickUntil) {
              e.preventDefault();
              e.stopPropagation();
            }
          };
          const onTransitionEnd = (e) => {
            if (e.target !== this.trackEl) return;
            if (e.propertyName && e.propertyName !== 'transform' && e.propertyName !== '-webkit-transform') return;
            if (this.isAnimating) {
              this.settleAnimation();
            }
          };
          const onResize = () => {
            if (this.destroyed || !this.trackEl || !this.config) return;
            if (this.dragging) {
              this.handlePointerEnd(true);
              return;
            }
            this.settleAnimation();
          };
          const onVisibilityChange = () => {
            if (this.destroyed) return;
            if (typeof document !== 'undefined' && document.hidden) {
              if (this.dragging) this.handlePointerEnd(true);
              this.stopAutoplay();
            } else {
              this.settleAnimation();
              this.scheduleAutoplay();
            }
          };

          const onBlur = () => {
            if (this.destroyed) return;
            if (this.dragging) this.handlePointerEnd(true);
          };

          this.viewportEl.addEventListener('touchstart', onTouchStart, { passive: true });
          this.viewportEl.addEventListener('touchmove', onTouchMove, { passive: false });
          this.viewportEl.addEventListener('touchend', onTouchEnd, { passive: true });
          this.viewportEl.addEventListener('touchcancel', onTouchCancel, { passive: true });
          this.viewportEl.addEventListener('mousedown', onMouseDown);
          this.viewportEl.addEventListener('click', onClickCapture, true);
          this.trackEl.addEventListener('transitionend', onTransitionEnd);
          window.addEventListener('mousemove', onMouseMove);
          window.addEventListener('mouseup', onMouseUp);
          window.addEventListener('resize', onResize);
          window.addEventListener('blur', onBlur);
          document.addEventListener('visibilitychange', onVisibilityChange);

          this.handlers = {
            onTouchStart,
            onTouchMove,
            onTouchEnd,
            onTouchCancel,
            onMouseDown,
            onMouseMove,
            onMouseUp,
            onClickCapture,
            onTransitionEnd,
            onResize,
            onBlur,
            onVisibilityChange
          };
          this.bound = true;
        },

        unbindEvents() {
          if (!this.bound || !this.handlers) return;
          const h = this.handlers;
          if (this.viewportEl) {
            this.viewportEl.removeEventListener('touchstart', h.onTouchStart);
            this.viewportEl.removeEventListener('touchmove', h.onTouchMove);
            this.viewportEl.removeEventListener('touchend', h.onTouchEnd);
            this.viewportEl.removeEventListener('touchcancel', h.onTouchCancel);
            this.viewportEl.removeEventListener('mousedown', h.onMouseDown);
            this.viewportEl.removeEventListener('click', h.onClickCapture, true);
          }
          if (this.trackEl) {
            this.trackEl.removeEventListener('transitionend', h.onTransitionEnd);
          }
          window.removeEventListener('mousemove', h.onMouseMove);
          window.removeEventListener('mouseup', h.onMouseUp);
          window.removeEventListener('resize', h.onResize);
          window.removeEventListener('blur', h.onBlur);
          document.removeEventListener('visibilitychange', h.onVisibilityChange);
          this.handlers = null;
          this.bound = false;
        },

        update(nextConfig) {
          this.config = nextConfig;
          if (!this.ensureElements()) {
            if (this.mountRetryTimer) clearTimeout(this.mountRetryTimer);
            this.mountRetryTimer = setTimeout(() => {
              this.mountRetryTimer = null;
              if (!this.destroyed && this.config) {
                this.update(this.config);
              }
            }, 32);
            return;
          }

          const signatureChanged = nextConfig.signature !== this.lastSignature;
          if (signatureChanged) {
            this.lastSignature = nextConfig.signature;
            this.dragging = false;
            this.dragMode = '';
            this.axis = '';
            this.dx = 0;
            this.velocity = 0;
            this.realIndex = nextConfig.canLoop ? this.normalizeRealIndex(this.realIndex) : 0;
            this.trackIndex = nextConfig.canLoop ? nextConfig.cloneCount + this.realIndex : 0;
            this.applyRestTransform();
          }

          if (nextConfig.jumpSeq && nextConfig.jumpSeq !== this.lastJumpSeq) {
            this.lastJumpSeq = nextConfig.jumpSeq;
            if (nextConfig.canLoop && !this.dragging) {
              this.stopAutoplay();
              const targetReal = this.normalizeRealIndex(nextConfig.jumpIndex);
              this.normalizeTrackPositionIfNeeded(true);
              this.slideWidth = this.measureSlideWidth();
              this.animateToTrackIndex(nextConfig.cloneCount + targetReal);
            }
          }

          if (nextConfig.canLoop && nextConfig.active) {
            if (!this.dragging) this.scheduleAutoplay();
          } else {
            this.stopAutoplay();
            if (!this.dragging && !this.isAnimating) {
              this.applyRestTransform();
            }
          }
        },

        destroy() {
          this.destroyed = true;
          this.stopAutoplay();
          this.clearSettleTimer();
          if (this.mountRetryTimer) {
            clearTimeout(this.mountRetryTimer);
            this.mountRetryTimer = null;
          }
          this.unbindEvents();
          this.viewportEl = null;
          this.trackEl = null;
          this.ownerInstance = null;
        }
      };

      return ctrl;
    }
  }
};
</script>
<!-- #endif -->

<style scoped>
.activity-notice-carousel {
  padding: 28rpx 24rpx 0;
  box-sizing: border-box;
}

.notice-viewport {
  position: relative;
  width: 100%;
  padding-top: 56.25%;
}

.notice-viewport--track {
  overflow: hidden;
  touch-action: pan-y;
  user-select: none;
  -webkit-user-select: none;
}

.notice-viewport--draggable {
  cursor: grab;
}

.notice-viewport--draggable:active {
  cursor: grabbing;
}

.notice-viewport--two-up {
  padding-top: 28.125%;
}

.activity-notice-carousel--two-up {
  padding: 16px 12px 0;
}

.activity-notice-carousel--wide-single .notice-viewport {
  max-width: 560px;
  margin: 0 auto;
  padding-top: min(56.25%, 315px);
}

.notice-track {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: row;
  flex-wrap: nowrap;
  will-change: transform;
  backface-visibility: hidden;
  -webkit-backface-visibility: hidden;
}

.notice-track-item {
  width: 100%;
  height: 100%;
  flex: 0 0 100%;
  min-width: 100%;
  box-sizing: border-box;
  transform: translateZ(0);
}

.notice-viewport--two-up .notice-track-item {
  width: 50%;
  flex: 0 0 50%;
  min-width: 50%;
}

.notice-swiper {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
}

.notice-swiper-item {
  height: 100%;
  box-sizing: border-box;
}

.notice-slide-slot {
  width: 100%;
  height: 100%;
  box-sizing: border-box;
}

.activity-notice-carousel--two-up .notice-slide-slot {
  padding: 0 8px;
}

.activity-notice-carousel--two-up .notice-card {
  border-radius: 12px;
}

.notice-card {
  position: relative;
  height: 100%;
  overflow: hidden;
  border-radius: 8rpx;
  background: #efe7d6;
  box-sizing: border-box;
  transform: translateZ(0);
}

.notice-card:not(.has-image)::before {
  content: '';
  position: absolute;
  inset: 0;
  background:
    linear-gradient(115deg, rgba(255, 255, 255, 0.18) 0 26%, transparent 26% 100%),
    linear-gradient(90deg, rgba(255, 255, 255, 0.34), rgba(255, 255, 255, 0));
  pointer-events: none;
}

.notice-card.is-linked {
  cursor: pointer;
}

.notice-card.is-linked:active {
  opacity: 0.88;
}

.notice-card:not(.has-image)::after {
  content: '';
  position: absolute;
  right: -50rpx;
  top: -58rpx;
  width: 420rpx;
  height: 400rpx;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.36);
}

.notice-card.weekly {
  background: #dbe8df;
}

.notice-card.cooperation {
  background: #e9dfd4;
}

.notice-card.market {
  background: #dde5ee;
}

.notice-image {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: #efe7d6;
  pointer-events: none;
  -webkit-user-drag: none;
}

.notice-copy {
  position: relative;
  z-index: 2;
  width: 68%;
  height: 100%;
  display: flex;
  flex-direction: column;
  justify-content: center;
  padding: 38rpx 0 38rpx 42rpx;
  box-sizing: border-box;
}

.notice-kicker {
  display: block;
  margin-bottom: 16rpx;
  color: #3b6f48;
  font-size: 28rpx;
  line-height: 36rpx;
  font-weight: 600;
}

.notice-title {
  display: block;
  color: #111111;
  font-size: 56rpx;
  line-height: 68rpx;
  font-weight: 700;
}

.notice-summary {
  display: block;
  margin-top: 18rpx;
  color: rgba(17, 17, 17, 0.72);
  font-size: 28rpx;
  line-height: 36rpx;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.notice-art {
  position: absolute;
  z-index: 2;
  right: 32rpx;
  top: 32rpx;
  bottom: 32rpx;
  width: 282rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 8rpx;
  background:
    repeating-linear-gradient(
      -30deg,
      rgba(255, 255, 255, 0.44) 0,
      rgba(255, 255, 255, 0.44) 2rpx,
      transparent 2rpx,
      transparent 34rpx
    ),
    rgba(255, 255, 255, 0.18);
}

.notice-art-mark {
  color: rgba(17, 17, 17, 0.66);
  font-size: 96rpx;
  line-height: 108rpx;
  font-weight: 700;
}

.notice-dots {
  height: 52rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 18rpx;
}

.notice-dot {
  width: 16rpx;
  height: 16rpx;
  border-radius: 50%;
  background: #e6e6e6;
  cursor: pointer;
  transition: background 0.2s ease, transform 0.2s ease;
}

.notice-dot.active {
  background: #cfcfcf;
  transform: scale(1.08);
}

@media (prefers-color-scheme: dark) {
  .notice-card {
    background: #d7d0c4;
  }
}
</style>
