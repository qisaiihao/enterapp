<template>
  <view class="page">
    <view class="custom-back-btn" @tap="goBack">
      <image class="back-icon" src="/static/images/back_to_edit.png" mode="aspectFit"></image>
    </view>

    <view class="header">
      <text class="title">拼贴创作</text>
      <view class="actions">
        <button class="ghost-btn" size="mini" @tap="refreshWords" :loading="isLoading">换一批词</button>
        <button class="ghost-btn" size="mini" @tap="undo" :disabled="!canUndo">撤回</button>
      </view>
    </view>

    <view class="content">
      <scroll-view scroll-y class="panel pool-panel" id="pool-zone">
        <view class="group-title">词池（长按拖到下方；拖回词池=撤销）</view>
        <view class="chips">
          <view
            v-for="word in wordsPool"
            :key="word"
            class="chip"
            :class="{'active': isInPoem(word)}"
            data-source="pool"
            @touchstart="onChipTouchStart(word, 'pool', -1, $event)"
            @touchmove="onChipTouchMove($event)"
            @touchend="onChipTouchEnd(word, 'pool', -1, $event)"
          >
            {{ word }}
          </view>
        </view>
      </scroll-view>

      <scroll-view scroll-y class="panel editor-panel" id="editor-drop-zone">
        <view class="editor-header" :class="{'highlight': dropHighlight}">
          <text>正在创作（拖拽放入；拖回词池撤销）</text>
          <view class="editor-actions">
            <button class="ghost-btn" size="mini" @tap="addLineBreak">换行</button>
            <button class="ghost-btn" size="mini" @tap="copyText" :disabled="!poemWords.length">复制</button>
            <button class="ghost-btn" size="mini" @tap="saveDraft" :disabled="!poemWords.length">保存草稿</button>
          </view>
        </view>
        <view class="poem-chips" :class="{'highlight': dropHighlight}">
          <view
            v-for="(word, idx) in poemWords"
            :key="idx"
            class="chip poem-chip"
            :class="{'line-break': word === '\\n'}"
            data-source="poem"
            :data-index="idx"
            @touchstart="onChipTouchStart(word, 'poem', idx, $event)"
            @touchmove="onChipTouchMove($event)"
            @touchend="onChipTouchEnd(word, 'poem', idx, $event)"
          >
            <text v-if="word === '\\n'">↵ 换行</text>
            <text v-else>{{ word }}</text>
          </view>
        </view>
      </scroll-view>
    </view>

    <!-- 拖拽中的浮动词卡 -->
    <view
      v-if="dragging"
      class="drag-ghost"
      :style="{
        top: dragPos.y + 'px',
        left: dragPos.x + 'px'
      }"
    >
      {{ dragWord }}
    </view>
  </view>
</template>
  </view>
</template>

<script>
import { getCollageWords } from '@/api-cache/collage';

export default {
  data() {
    return {
      wordsPool: [],
      poemWords: [],
      history: [],
      isLoading: false,
      seed: Date.now(),
      lastRefreshTs: 0,
      startTouch: null,
      lastTouch: null,
      dropRect: null,
      poolRect: null,
      dragging: false,
      dragWord: '',
      dragPos: { x: 0, y: 0 },
      dropHighlight: false,
      poolHighlight: false
    };
  },
  computed: {
    canUndo() {
      return this.history.length > 0;
    },
    poemText() {
      if (!this.poemWords.length) return '';
      // 将 \n 作为换行，其余用空格连接
      return this.poemWords
        .map((w, i) => {
          if (w === '\n') return '\n';
          // 若前一个是换行则不加空格
          const prev = i > 0 ? this.poemWords[i - 1] : '';
          return prev === '\n' ? w : ` ${w}`;
        })
        .join('')
        .trim();
    }
  },
  onLoad() {
    this.loadWords(false);
    const draft = uni.getStorageSync('collage_poem_draft') || '';
    if (draft) {
      this.poemWords = draft.split(/\s+/).filter(Boolean);
    }
  },
  onReady() {
    this.measureZones();
  },
  methods: {
    goBack() {
      uni.navigateBack();
    },
    measureZones() {
      uni.createSelectorQuery()
        .in(this)
        .select('#editor-drop-zone')
        .boundingClientRect((rect) => {
          if (rect) this.dropRect = rect;
        })
        .select('#pool-zone')
        .boundingClientRect((rect) => {
          if (rect) this.poolRect = rect;
        })
        .exec();
    },
    async loadWords(keepExisting = false) {
      this.isLoading = true;
      try {
        const res = await getCollageWords({
          limit: 12,
          groups: ['nouns', 'verbs', 'imagery'],
          seed: this.seed
        });
        const data = res?.result?.data || {};
        const flat = [];
        Object.values(data).forEach((arr) => {
          (arr || []).forEach((w) => {
            if (w && !flat.includes(w)) flat.push(w);
          });
        });
        this.wordsPool = keepExisting
          ? Array.from(new Set([...(this.wordsPool || []), ...flat]))
          : flat;
      } catch (e) {
        uni.showToast({
          title: e.message || '词库获取失败',
          icon: 'none'
        });
      } finally {
        this.isLoading = false;
      }
    },
    refreshWords() {
      const now = Date.now();
      if (this.isLoading || now - this.lastRefreshTs < 2000) return;
      this.lastRefreshTs = now;
      this.seed = Date.now();
      this.loadWords(false);
    },
    insertWord(word) {
      this.pushHistory();
      this.poemWords.push(word);
    },
    removeWordAt(idx) {
      if (idx < 0 || idx >= this.poemWords.length) return;
      this.pushHistory();
      this.poemWords.splice(idx, 1);
    },
    addLineBreak() {
      this.pushHistory();
      this.poemWords.push('\n');
    },
    undo() {
      if (!this.canUndo) return;
      const last = this.history.pop();
      this.poemWords = last;
    },
    pushHistory() {
      this.history.push([...this.poemWords]);
      if (this.history.length > 50) this.history.shift();
    },
    isInPoem(word) {
      return this.poemWords.includes(word);
    },
    onChipTouchStart(word, source, idx, e) {
      const t = e.touches && e.touches[0];
      this.startTouch = t ? { x: t.pageX, y: t.pageY, source, idx } : null;
      this.lastTouch = this.startTouch;
      if (t) {
        this.dragging = true;
        this.dragWord = word;
        this.dragPos = { x: t.pageX - 30, y: t.pageY - 30 };
      }
    },
    onChipTouchMove(e) {
      const t = e.touches && e.touches[0];
      if (t) {
        this.lastTouch = { x: t.pageX, y: t.pageY };
        this.dragPos = { x: t.pageX - 30, y: t.pageY - 30 };
        const inEditor = this.isPointInRect(this.lastTouch, this.dropRect);
        const inPool = this.isPointInRect(this.lastTouch, this.poolRect);
        this.dropHighlight = inEditor;
        this.poolHighlight = inPool;
      }
    },
    onChipTouchEnd(word, source, idx, e) {
      const t = (e.changedTouches && e.changedTouches[0]) || this.lastTouch || this.startTouch;
      this.dragging = false;
      this.dropHighlight = false;
      this.poolHighlight = false;
      if (!t || !this.startTouch) return;
      const endPos = { x: t.pageX, y: t.pageY };
      const movedEnough =
        Math.hypot(endPos.x - this.startTouch.x, endPos.y - this.startTouch.y) > 20;
      if (!movedEnough) return;

      const inEditor = this.isPointInRect(endPos, this.dropRect);
      const inPool = this.isPointInRect(endPos, this.poolRect);

      if (source === 'pool' && inEditor) {
        this.insertWord(word);
        return;
      }
      if (source === 'poem' && inPool) {
        this.removeWordAt(idx);
        return;
      }
      // 其他区域不处理
    },
    isPointInRect(pos, rect) {
      if (!rect) return false;
      const { left, right, top, bottom } = rect;
      return pos.x >= left && pos.x <= right && pos.y >= top && pos.y <= bottom;
    },
    copyText() {
      if (!this.poemWords.length) return;
      uni.setClipboardData({
        data: this.poemText,
        success() {
          uni.showToast({ title: '已复制', icon: 'success' });
        }
      });
    },
    saveDraft() {
      if (!this.poemWords.length) return;
      uni.setStorageSync('collage_poem_draft', this.poemText);
      uni.showToast({ title: '已保存草稿', icon: 'success' });
    }
  }
};
</script>

<style scoped>
.page {
  position: relative;
  width: 100vw;
  height: 100vh;
  background: #ffffff;
  display: flex;
  flex-direction: column;
}
.custom-back-btn {
  position: absolute;
  top: calc(60rpx + env(safe-area-inset-top, 44px));
  left: 30rpx;
  width: 80rpx;
  height: 80rpx;
  z-index: 10;
}
.back-icon {
  width: 100%;
  height: 100%;
}
.header {
  padding: calc(70rpx + env(safe-area-inset-top, 44px)) 20rpx 6rpx;
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.title {
  font-size: 36rpx;
  font-weight: 600;
}
.actions {
  display: flex;
  gap: 12rpx;
}
.ghost-btn {
  background: #f5f6f7;
  color: #333;
  border-radius: 9999rpx;
}
.content {
  flex: 1;
  padding: 0 12rpx 10rpx;
  display: flex;
  flex-direction: column;
  gap: 8rpx;
  overflow: hidden;
}

.panel {
  background: #fff;
  border-radius: 14rpx;
  box-shadow: 0 4rpx 12rpx rgba(0, 0, 0, 0.03);
  padding: 12rpx;
  overflow: hidden;
}

.pool-panel {
  flex: 1;
}

.editor-panel {
  flex: 1;
}

.group-title {
  font-size: 24rpx;
  font-weight: 600;
  margin-bottom: 8rpx;
}
.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8rpx;
  max-height: 100%;
  overflow-y: auto;
}
.chip {
  padding: 9rpx 16rpx;
  background: #f5f6f7;
  border-radius: 9999rpx;
  font-size: 24rpx;
  color: #333;
  transition: all 0.15s ease;
}
.chip:active {
  transform: scale(0.96);
}
.chip.active {
  background: #9ed7ee;
  color: #0b3c4c;
  box-shadow: 0 6rpx 12rpx rgba(158, 215, 238, 0.45);
}
.editor {
  margin-top: 10rpx;
  padding: 14rpx;
  background: #f9fbfc;
  border-radius: 16rpx;
  box-shadow: 0 6rpx 18rpx rgba(0, 0, 0, 0.04);
}
.editor-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12rpx;
}
.editor-header.highlight {
  box-shadow: 0 0 0 2rpx #9ed7ee inset;
  border-radius: 12rpx;
  padding: 6rpx 10rpx;
}
.editor-actions {
  display: flex;
  gap: 12rpx;
}
.poem-chips {
  min-height: 160rpx;
  padding: 10rpx;
  background: #fff;
  border-radius: 12rpx;
  border: 1rpx solid #e6e6e6;
  box-sizing: border-box;
  display: flex;
  flex-wrap: wrap;
  gap: 10rpx;
  max-height: 100%;
  overflow-y: auto;
}
.poem-chips.highlight {
  border-color: #9ed7ee;
  box-shadow: 0 0 0 2rpx rgba(158, 215, 238, 0.6);
}
.poem-chip.line-break {
  background: #ffe9c7;
  color: #b45b00;
}
.drag-ghost {
  position: fixed;
  z-index: 2000;
  padding: 10rpx 18rpx;
  background: #9ed7ee;
  color: #0b3c4c;
  border-radius: 9999rpx;
  box-shadow: 0 8rpx 18rpx rgba(0,0,0,0.18);
  pointer-events: none;
  opacity: 0.92;
}
</style>
