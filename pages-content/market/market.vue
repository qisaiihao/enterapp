<template>
  <!-- #ifdef MP-WEIXIN -->
  <page-meta :page-style="'background-color: ' + appThemeVars['--app-page-bg'] + ';'" />
  <!-- #endif -->
  <view class="market-page" :data-app-theme="appThemeMode" :style="appThemeVars">
    <view class="exhibition">
      <view class="intro">
        <text class="title">我们做了一些文创</text>
        <text class="intro-copy">我们还没有在应用内销售商品的资质，但我们确实做了一些文创。</text>
      </view>
      <view v-for="group in groups" :key="group.id" class="collection">
        <text class="collection-title">{{ group.title }}</text>
        <view class="photos" :class="group.id">
          <view v-for="photo in group.photos" :key="photo.file" class="photo">
            <view class="frame" :style="{ paddingTop: photo.ratio }">
              <button v-if="failed[photo.file]" class="retry" @tap="failed[photo.file] = false">图片加载失败，点击重试</button>
              <image
                v-else
                class="photo-image"
                :src="baseUrl + photo.file"
                :alt="photo.alt"
                mode="aspectFit"
                lazy-load
                @tap="preview(group, photo)"
                @error="failed[photo.file] = true"
              />
            </view>
          </view>
        </view>
      </view>
    </view>
    <app-overlay-host />
  </view>
</template>

<script>
export default {
  data() {
    return {
      baseUrl: 'https://636c-cloud1-5gb0pbyl400845f5-1378788263.tcb.qcloud.la/activity/market/',
      failed: {},
      groups: [
        {
          id: 'postcards',
          title: 'poementer 系列明信片',
          photos: [
            { file: 'postcard-set-5fc333e331.jpg', ratio: '75%', alt: '五张明信片的合影' },
            { file: 'postcard-calendar-3c99ddbb52.jpg', ratio: '149.84%', alt: '七月台历前的乌鸦' },
            { file: 'postcard-lamp-2a99df3528.jpg', ratio: '75%', alt: '月亮灯旁的明信片' }
          ]
        },
        {
          id: 'floppy',
          title: '软盘',
          photos: [
            { file: 'floppy-front-e104129f57.jpg', ratio: '133.33%', alt: '正面的回车键标签' },
            { file: 'floppy-back-ca395678cf.jpg', ratio: '133.33%', alt: '半透明的背面' }
          ]
        },
        {
          id: 'sticker-stamps',
          title: '贴纸与邮票（待生产）',
          photos: [
            { file: 'sticker-collection-e05807d655.jpg', ratio: '117.73%', alt: '白底贴纸设计图' },
            { file: 'sticker-stamp-black-4ffbb8e3c8.jpg', ratio: '117.73%', alt: '黑底贴纸与邮票设计图' }
          ]
        }
      ]
    };
  },
  methods: {
    preview(group, photo) {
      uni.previewImage({
        current: this.baseUrl + photo.file,
        urls: group.photos.map(item => this.baseUrl + item.file)
      });
    }
  }
};
</script>

<style scoped>
.market-page {
  min-height: 100vh;
  background: var(--app-page-bg, #fff);
  color: var(--app-primary-text, #222);
}
.exhibition {
  max-width: 680px;
  margin: 0 auto;
  padding: 48rpx 32rpx calc(64rpx + env(safe-area-inset-bottom, 0px));
}
.title, .intro-copy, .collection-title {
  display: block;
}
.title {
  font-size: 48rpx;
  font-weight: 600;
}
.intro-copy {
  margin-top: 20rpx;
  font-size: 29rpx;
  line-height: 1.75;
  color: var(--app-secondary-text, #555);
}
.collection {
  margin-top: 44rpx;
  border-top: 1px solid var(--app-border-color, #ddd);
  padding-top: 26rpx;
}
.collection-title {
  margin-bottom: 20rpx;
  font-size: 32rpx;
  font-weight: 600;
}
.photos {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 24rpx 16rpx;
}
.postcards {
  grid-template-columns: minmax(0, 1fr) minmax(0, 2fr);
}
.postcards .photo:first-child {
  grid-column: 1 / -1;
}
.frame {
  position: relative;
  overflow: hidden;
  background: var(--app-border-color, #eee);
  border-radius: 8rpx;
}
.photo-image, .retry {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
}
.retry {
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  color: var(--app-secondary-text, #555);
  font-size: 24rpx;
}
.retry::after {
  border: 0;
}
</style>
