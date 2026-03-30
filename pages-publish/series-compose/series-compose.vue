<template>
  <view class="series-compose-page">
    <view v-if="showFilterPanel" class="series-filter-mask" @tap="closeFilterPanel"></view>

    <view class="series-topbar">
      <view class="series-topbar__inner" :style="{ paddingTop: `${safeAreaTop}px` }">
        <view class="series-topbar__side series-topbar__side--left" @tap="goBack">
          <image class="series-topbar__back-icon" src="/static/images/left_exit.png" mode="aspectFit"></image>
        </view>
        <text class="series-topbar__title">组诗编辑</text>
        <view class="series-topbar__side series-topbar__side--right"></view>
      </view>
    </view>

    <view class="series-compose-content" :style="{ paddingTop: `${contentTopOffset}px` }">
      <view class="series-filter-row">
        <view
          class="series-filter-trigger"
          :class="{ 'series-filter-trigger--active': hasActiveFilter || showFilterPanel }"
          @tap.stop="toggleFilterPanel"
        >
          <image class="series-filter-icon" src="/static/images/filter.png" mode="aspectFit"></image>
        </view>

        <view v-if="showFilterPanel" class="series-filter-panel" @tap.stop>
          <view class="series-filter-section">
            <text class="series-filter-section-title">时间</text>
            <view class="series-filter-options">
              <view
                class="series-filter-option"
                :class="{ 'series-filter-option--active': timeSort === 'latest' }"
                @tap="setTimeSort('latest')"
              >
                最新优先
              </view>
              <view
                class="series-filter-option"
                :class="{ 'series-filter-option--active': timeSort === 'earliest' }"
                @tap="setTimeSort('earliest')"
              >
                最早优先
              </view>
            </view>
          </view>

          <view class="series-filter-section">
            <text class="series-filter-section-title">组合状态</text>
            <view class="series-filter-options">
              <view
                class="series-filter-option"
                :class="{ 'series-filter-option--active': mergeFilter === 'unused' }"
                @tap="setMergeFilter('unused')"
              >
                未组合
              </view>
              <view
                class="series-filter-option"
                :class="{ 'series-filter-option--active': mergeFilter === 'all' }"
                @tap="setMergeFilter('all')"
              >
                全部
              </view>
              <view
                class="series-filter-option"
                :class="{ 'series-filter-option--active': mergeFilter === 'merged' }"
                @tap="setMergeFilter('merged')"
              >
                已组合过
              </view>
            </view>
          </view>
        </view>
      </view>

      <view v-if="displaySingles.length > 0" class="series-list">
        <view
          v-for="item in displaySingles"
          :key="item._id"
          class="series-card"
          :class="{ 'series-card--selected': isSelected(item._id) }"
          @tap="toggleSelect(item._id)"
        >
          <text v-if="getSelectOrder(item._id)" class="series-card-order">{{ getSelectOrder(item._id) }}</text>

          <view class="series-card-meta" :class="{ 'series-card-meta--with-order': isSelected(item._id) }">
            <text class="series-card-title">{{ item.title || '未命名' }}</text>
            <text class="series-card-date">{{ formatDate(item.createTime) }}</text>
          </view>

          <view class="series-card-preview" :class="{ 'series-card-preview--with-order': isSelected(item._id) }">
            <text
              v-for="(line, index) in getPreviewLines(item)"
              :key="`${item._id}-${index}`"
              :class="['series-card-line', { 'series-card-line--expanded': isExpanded(item._id) }]"
            >
              {{ line }}
            </text>
          </view>

          <text class="series-card-expand" @tap.stop="toggleExpand(item._id)">
            {{ isExpanded(item._id) ? '收起' : '展开' }}
          </text>
        </view>
      </view>

      <view v-else class="empty-state">{{ emptyText }}</view>
    </view>

    <view class="bottom-actions">
      <view
        class="bottom-btn bottom-btn--secondary"
        :class="{ 'bottom-btn--disabled': selectedIds.length === 0 }"
        @tap="clearSelection"
      >
        清空选择
      </view>
      <view
        class="bottom-btn bottom-btn--primary"
        :class="{ 'bottom-btn--disabled': selectedIds.length === 0 }"
        @tap="goPreview"
      >
        预览
      </view>
    </view>
  </view>
</template>

<script>
import { cloudCall } from '@/utils/cloudCall.js';

const DEFAULT_BACKGROUND_COLOR = '#a4c4bd';
const DEFAULT_TEXT_COLOR = '#333333';
const DEFAULT_TIME_SORT = 'latest';
const DEFAULT_MERGE_FILTER = 'unused';

export default {
  data() {
    return {
      allSingles: [],
      selectedIds: [],
      expandedIds: [],
      safeAreaTop: 0,
      contentTopOffset: 72,
      showFilterPanel: false,
      timeSort: DEFAULT_TIME_SORT,
      mergeFilter: DEFAULT_MERGE_FILTER
    };
  },
  computed: {
    displaySingles() {
      return this.getFilteredSingles();
    },
    hasActiveFilter() {
      return this.timeSort !== DEFAULT_TIME_SORT || this.mergeFilter !== DEFAULT_MERGE_FILTER;
    },
    emptyText() {
      return this.allSingles.length === 0 ? '暂无可合成的诗歌' : '暂无符合筛选条件的诗歌';
    }
  },
  onLoad() {
    this.initNavMetrics();
    this.fetchSingles();
  },
  onShow() {
    this.fetchSingles();
  },
  methods: {
    initNavMetrics() {
      try {
        const systemInfo = uni.getSystemInfoSync();
        const safeAreaTop = systemInfo.statusBarHeight || 0;
        const navBarHeight = systemInfo.windowWidth ? (systemInfo.windowWidth / 750) * 100 : 50;
        this.safeAreaTop = safeAreaTop;
        this.contentTopOffset = safeAreaTop + navBarHeight + 12;
      } catch (error) {
        console.error('initNavMetrics failed', error);
        this.safeAreaTop = 0;
        this.contentTopOffset = 72;
      }
    },
    async fetchSingles() {
      try {
        const res = await cloudCall('listMySingles', {}, { pageTag: 'series-compose', context: this });
        const posts = (res.result && Array.isArray(res.result.posts)) ? res.result.posts : [];
        this.allSingles = posts;
        this.pruneSelection();
        this.pruneExpanded();
      } catch (e) {
        console.error('listMySingles failed', e);
        uni.showToast({ title: '加载失败', icon: 'none' });
      }
    },
    getFilteredSingles() {
      const next = Array.isArray(this.allSingles) ? this.allSingles.slice() : [];

      const filtered = next.filter((item) => {
        if (this.mergeFilter === 'unused') {
          return !item.mergedToSeriesId;
        }
        if (this.mergeFilter === 'merged') {
          return !!item.mergedToSeriesId;
        }
        return true;
      });

      filtered.sort((a, b) => {
        const timeA = this.getTimestamp(a && a.createTime);
        const timeB = this.getTimestamp(b && b.createTime);
        return this.timeSort === 'earliest' ? timeA - timeB : timeB - timeA;
      });

      return filtered;
    },
    getTimestamp(value) {
      if (!value) {
        return 0;
      }

      if (value instanceof Date) {
        return value.getTime();
      }

      if (typeof value === 'number') {
        return value;
      }

      if (typeof value === 'string') {
        const parsed = new Date(value).getTime();
        return Number.isNaN(parsed) ? 0 : parsed;
      }

      if (value && typeof value === 'object') {
        if (typeof value.toDate === 'function') {
          const date = value.toDate();
          return date instanceof Date ? date.getTime() : 0;
        }
        if (typeof value.seconds === 'number') {
          return value.seconds * 1000;
        }
        if (typeof value._seconds === 'number') {
          return value._seconds * 1000;
        }
      }

      return 0;
    },
    pruneSelection() {
      const visibleIdSet = new Set(this.getFilteredSingles().map((item) => item._id));
      this.selectedIds = this.selectedIds.filter((id) => visibleIdSet.has(id));
    },
    pruneExpanded() {
      const visibleIdSet = new Set(this.getFilteredSingles().map((item) => item._id));
      this.expandedIds = this.expandedIds.filter((id) => visibleIdSet.has(id));
    },
    toggleFilterPanel() {
      this.showFilterPanel = !this.showFilterPanel;
    },
    closeFilterPanel() {
      this.showFilterPanel = false;
    },
    setTimeSort(value) {
      if (this.timeSort === value) {
        return;
      }
      this.timeSort = value;
      this.pruneSelection();
      this.pruneExpanded();
    },
    setMergeFilter(value) {
      if (this.mergeFilter === value) {
        return;
      }
      this.mergeFilter = value;
      this.pruneSelection();
      this.pruneExpanded();
    },
    isSelected(id) {
      return this.selectedIds.includes(id);
    },
    isExpanded(id) {
      return this.expandedIds.includes(id);
    },
    toggleExpand(id) {
      const currentIndex = this.expandedIds.indexOf(id);
      if (currentIndex >= 0) {
        const next = this.expandedIds.slice();
        next.splice(currentIndex, 1);
        this.expandedIds = next;
        return;
      }
      this.expandedIds = this.expandedIds.concat(id);
    },
    toggleSelect(id) {
      const currentItem = this.allSingles.find((item) => item._id === id);
      if (currentItem && currentItem.mergedToSeriesId) {
        uni.showToast({ title: '该诗歌已被组合过', icon: 'none' });
        return;
      }

      const currentIndex = this.selectedIds.indexOf(id);
      if (currentIndex >= 0) {
        const next = this.selectedIds.slice();
        next.splice(currentIndex, 1);
        this.selectedIds = next;
        return;
      }
      this.selectedIds = this.selectedIds.concat(id);
    },
    getSelectOrder(id) {
      const index = this.selectedIds.indexOf(id);
      return index >= 0 ? index + 1 : null;
    },
    clearSelection() {
      if (this.selectedIds.length === 0) {
        return;
      }
      this.selectedIds = [];
    },
    getContentLines(item) {
      const lines = (item && item.content ? item.content : '')
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean);

      if (lines.length > 0) {
        return lines;
      }

      return ['暂无内容'];
    },
    getPreviewLines(item) {
      const lines = this.getContentLines(item);

      if (item && item._id && this.isExpanded(item._id)) {
        return lines;
      }

      if (lines.length >= 2) {
        return lines.slice(0, 2);
      }

      if (lines.length === 1) {
        return [lines[0], ''];
      }
      return ['暂无内容', ''];
    },
    buildSeriesBlocks() {
      const postMap = new Map(this.allSingles.map((post) => [post._id, post]));

      return this.selectedIds.map((id, index) => {
        const post = postMap.get(id) || {};
        const content = post.content || '';
        const contentLines = content
          .split(/\r?\n/)
          .map((line) => line.trim())
          .filter(Boolean);
        const rawHighlightLines = Array.isArray(post.highlightLines)
          ? post.highlightLines.map((line) => String(line || '').trim()).filter(Boolean)
          : [];
        const fallbackHighlight = (post.highlightSentence || contentLines[0] || '').trim();
        const highlightLines = rawHighlightLines.length > 0
          ? rawHighlightLines.slice(0, 3)
          : (fallbackHighlight ? [fallbackHighlight] : []);

        return {
          id,
          postId: id,
          order: index,
          subtitle: post.title || `第${index + 1}首`,
          content,
          preview: contentLines.slice(0, 2),
          highlightSentence: highlightLines[0] || fallbackHighlight || '',
          highlightLines,
          createTime: post.createTime || '',
          backgroundColor: post.backgroundColor || '',
          textColor: post.textColor || DEFAULT_TEXT_COLOR
        };
      });
    },
    buildSeriesHighlight(seriesBlocks) {
      return seriesBlocks
        .reduce((acc, block) => acc.concat(block.highlightLines || []), [])
        .map((line) => String(line || '').trim())
        .filter(Boolean)
        .slice(0, 3);
    },
    async goPreview() {
      if (this.selectedIds.length === 0) {
        return;
      }

      const seriesBlocks = this.buildSeriesBlocks();
      if (seriesBlocks.length === 0) {
        uni.showToast({ title: '请选择诗歌', icon: 'none' });
        return;
      }

      const highlightLines = this.buildSeriesHighlight(seriesBlocks);
      const mergedContent = seriesBlocks
        .map((block) => (block.content || block.subtitle || '').trim())
        .filter(Boolean)
        .join('\n\n');
      const firstBlock = seriesBlocks[0] || {};
      const selectedBackgroundColor = firstBlock.backgroundColor || DEFAULT_BACKGROUND_COLOR;
      const selectedTextColor = firstBlock.textColor || DEFAULT_TEXT_COLOR;
      const previewPost = {
        _id: 'preview-temp-id',
        content: mergedContent,
        author: '',
        title: '',
        textColor: selectedTextColor,
        backgroundColor: selectedBackgroundColor,
        isExpanded: true,
        likeIcon: '/static/images/seed.png',
        imageUrls: [],
        isPoem: true,
        isSeries: true,
        seriesBlocks,
        highlightLines,
        editData: {
          title: '',
          content: mergedContent,
          imageList: [],
          publishMode: 'poem',
          isOriginal: true,
          isSeries: true,
          seriesBlocks,
          selectedTags: [],
          author: '',
          highlightLines,
          highlightSelectedLineIndices: [],
          selectedBackgroundColor,
          selectedTextColor,
          selectedColorCombination: {
            backgroundColor: selectedBackgroundColor,
            textColor: selectedTextColor
          },
          isEditMode: false,
          editingPostId: '',
          seriesSourceMode: 'existing-posts',
          seriesSourceIds: this.selectedIds.slice()
        }
      };

      try {
        uni.setStorageSync('preview_post', previewPost);
      } catch (error) {
        console.error('set preview_post failed', error);
      }

      uni.navigateTo({
        url: '/pages-publish/preview/preview',
        success: (res) => {
          try {
            res.eventChannel.emit('preview-data', { post: previewPost });
          } catch (error) {
            console.error('emit preview-data failed', error);
          }
        }
      });
    },
    formatDate(value) {
      if (!value) {
        return '';
      }

      let date = null;

      if (value instanceof Date) {
        date = value;
      } else if (typeof value === 'number' || typeof value === 'string') {
        date = new Date(value);
      } else if (value && typeof value === 'object') {
        if (typeof value.toDate === 'function') {
          date = value.toDate();
        } else if (typeof value.seconds === 'number') {
          date = new Date(value.seconds * 1000);
        } else if (typeof value._seconds === 'number') {
          date = new Date(value._seconds * 1000);
        }
      }

      if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
        return '';
      }

      const year = date.getFullYear();
      const month = `${date.getMonth() + 1}`.padStart(2, '0');
      const day = `${date.getDate()}`.padStart(2, '0');
      return `${year}-${month}-${day}`;
    },
    goBack() {
      const pages = getCurrentPages();
      if (pages.length > 1) {
        uni.navigateBack();
        return;
      }
      uni.switchTab({
        url: '/pages/index/index'
      });
    }
  }
};
</script>

<style scoped>
.series-compose-page {
  min-height: 100vh;
  box-sizing: border-box;
  background: #ffffff;
}

.series-filter-mask {
  position: fixed;
  inset: 0;
  z-index: 25;
}

.series-topbar {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 20;
  background: #ffffff;
}

.series-topbar__inner {
  position: relative;
  background: #ffffff;
}

.series-topbar__title {
  height: 100rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 36rpx;
  line-height: 50rpx;
  font-weight: 600;
  color: #111111;
}

.series-topbar__side {
  position: absolute;
  top: 0;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1;
}

.series-topbar__side--left {
  left: 0;
  width: 96rpx;
}

.series-topbar__side--right {
  right: 0;
  width: 96rpx;
}

.series-topbar__back-icon {
  width: 22rpx;
  height: 38rpx;
}

.series-compose-content {
  position: relative;
  padding-left: 32rpx;
  padding-right: 32rpx;
  padding-bottom: 220rpx;
  box-sizing: border-box;
}

.series-filter-row {
  position: relative;
  z-index: 30;
  display: flex;
  justify-content: flex-end;
  margin-bottom: 20rpx;
}

.series-filter-trigger {
  width: 64rpx;
  height: 64rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 18rpx;
  background: transparent;
}

.series-filter-trigger--active {
  background: rgba(109, 101, 101, 0.08);
}

.series-filter-icon {
  width: 40rpx;
  height: 40rpx;
}

.series-filter-panel {
  position: absolute;
  top: 74rpx;
  right: 0;
  width: 332rpx;
  padding: 24rpx;
  border-radius: 20rpx;
  background: #ffffff;
  box-shadow: 0 16rpx 40rpx rgba(0, 0, 0, 0.12);
  box-sizing: border-box;
}

.series-filter-section + .series-filter-section {
  margin-top: 18rpx;
}

.series-filter-section-title {
  display: block;
  margin-bottom: 14rpx;
  font-size: 24rpx;
  line-height: 34rpx;
  color: #7e7671;
}

.series-filter-options {
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx;
}

.series-filter-option {
  min-width: 92rpx;
  padding: 10rpx 18rpx;
  border-radius: 999rpx;
  background: #f1efed;
  font-size: 24rpx;
  line-height: 34rpx;
  color: #5a524e;
  text-align: center;
  box-sizing: border-box;
}

.series-filter-option--active {
  background: #6d6565;
  color: #ffffff;
}

.series-list {
  display: flex;
  flex-direction: column;
  gap: 24rpx;
}

.series-card {
  position: relative;
  display: flex;
  flex-direction: column;
  min-height: 232rpx;
  padding: 24rpx 24rpx 6rpx 30rpx;
  border-radius: 10rpx;
  background: #d9d9d9;
  box-sizing: border-box;
  overflow: hidden;
}

.series-card--selected {
  background: #6d6565;
}

.series-card-order {
  position: absolute;
  top: 24rpx;
  right: 24rpx;
  font-size: 112rpx;
  line-height: 1;
  font-weight: 500;
  color: rgba(45, 35, 29, 0.22);
}

.series-card-meta {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12rpx;
}

.series-card-meta--with-order {
  padding-right: 120rpx;
}

.series-card-title {
  flex: 1;
  min-width: 0;
  font-size: 30rpx;
  line-height: 42rpx;
  color: #211816;
  font-weight: 600;
  word-break: break-word;
}

.series-card-date {
  flex: 0 0 auto;
  font-size: 22rpx;
  line-height: 32rpx;
  color: rgba(33, 24, 22, 0.45);
  text-align: right;
  white-space: nowrap;
}

.series-card-preview {
  margin-top: 12rpx;
}

.series-card-preview--with-order {
  padding-right: 120rpx;
}

.series-card-line {
  display: block;
  font-size: 26rpx;
  line-height: 38rpx;
  color: #211816;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.series-card-line--expanded {
  white-space: normal;
  overflow: visible;
  text-overflow: clip;
  word-break: break-word;
}

.series-card-expand {
  display: block;
  margin-top: auto;
  padding-top: 10rpx;
  text-align: right;
  font-size: 22rpx;
  line-height: 30rpx;
  color: rgba(33, 24, 22, 0.45);
}

.empty-state {
  margin-top: 160rpx;
  text-align: center;
  font-size: 28rpx;
  color: #8e8278;
}

.bottom-actions {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  justify-content: space-between;
  gap: 28rpx;
  padding: 20rpx 44rpx calc(28rpx + env(safe-area-inset-bottom));
  padding-bottom: calc(28rpx + constant(safe-area-inset-bottom));
  box-sizing: border-box;
  background: transparent;
}

.bottom-btn {
  flex: 1;
  height: 76rpx;
  border-radius: 38rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 30rpx;
  font-weight: 600;
  box-shadow: 0 10rpx 24rpx rgba(73, 55, 47, 0.12);
}

.bottom-btn--secondary {
  background: #efe2d2;
  color: #5f4a43;
}

.bottom-btn--primary {
  background: #8f6254;
  color: #ffffff;
}

.bottom-btn--disabled {
  opacity: 0.45;
}
</style>
