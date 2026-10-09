<template>
  <view class="settings-page" :data-app-theme="appThemeMode" :style="[appThemeVars, readFontVars]">
    <view class="settings-header">
      <view class="settings-back-btn" @tap="goBack">
        <image class="back-icon" src="/static/images/left_exit.png" mode="aspectFit"></image>
      </view>
      <text class="settings-title">设置</text>
    </view>

    <view class="settings-content">
      <view class="settings-section">
        <view class="settings-section-title">阅读字号</view>
        <view class="settings-card">
          <view class="settings-row">
            <text class="settings-row-label">正文阅读字号</text>
            <view class="font-size-options">
              <view
                v-for="item in fontSizeOptions"
                :key="item.value"
                :class="['font-size-option', activeFontSize === item.value ? 'active' : '']"
                @tap="onFontSizeChange(item.value)"
              >
                <text>{{ item.label }}</text>
              </view>
            </view>
          </view>
          <text class="settings-row-desc">调整诗歌正文、详情正文等阅读文字的大小，行高会同步适配。</text>
        </view>
      </view>

      <view class="settings-section" v-if="isLoggedIn">
        <view class="settings-section-title">账号</view>
        <view class="settings-card">
          <view class="settings-row" @tap="openCancelAccount">
            <text class="settings-row-label danger">注销账号</text>
            <text class="settings-row-value">›</text>
          </view>
          <text class="settings-row-desc">注销后账号资料、收藏、关注、消息等数据将被删除，已发布内容将匿名化显示为“已注销用户”，此操作不可恢复。</text>
        </view>
      </view>

      <view class="settings-section">
        <view class="settings-section-title">关于</view>
        <view class="settings-card">
          <view class="settings-row">
            <text class="settings-row-label">版本</text>
            <text class="settings-row-value">{{ appVersion }}</text>
          </view>
          <!-- #ifdef APP-PLUS -->
          <view class="settings-row" @tap="checkUpdate">
            <text class="settings-row-label">检查更新</text>
            <text class="settings-row-value">{{ checkingUpdate ? '正在检查…' : '›' }}</text>
          </view>
          <!-- #endif -->
          <view class="settings-row" @tap="navigateToPrivacy">
            <text class="settings-row-label">隐私政策</text>
            <text class="settings-row-value">›</text>
          </view>
        </view>
      </view>
    </view>
  </view>

  <AppDialog
    :visible="showCancelExplain"
    :danger="true"
    title="注销账号"
    confirm-text="继续注销"
    cancel-text="取消"
    @confirm="proceedCancelAccount"
    @cancel="showCancelExplain = false"
  >
    <view class="cancel-explain">
      <text class="cancel-explain-text">注销后，以下数据将被删除且无法恢复：</text>
      <text class="cancel-explain-text">· 账号资料、登录方式、收藏、关注、草稿、消息等</text>
      <text class="cancel-explain-text">· 已发布的诗歌、讨论和评论将匿名化保留，作者显示为“已注销用户”</text>
      <text class="cancel-explain-text">· 该账号将无法登录，同一手机号或 Poem ID 可重新注册</text>
    </view>
  </AppDialog>

  <AppDialog
    :visible="showCancelPassword"
    :busy="cancelling"
    :danger="true"
    :editable="true"
    :password="true"
    title="身份验证"
    message="请输入账号密码以确认注销"
    placeholder="账号密码"
    :confirm-text="cancelling ? '注销中…' : '确认注销'"
    cancel-text="取消"
    @confirm="confirmCancelWithPassword"
    @cancel="showCancelPassword = false"
  />

  <AppDialog
    :visible="showCancelFinal"
    :busy="cancelling"
    :danger="true"
    title="确认注销"
    message="账号注销后无法恢复，确认继续吗？"
    :confirm-text="cancelling ? '注销中…' : '确认注销'"
    cancel-text="取消"
    @confirm="confirmCancelAccount"
    @cancel="showCancelFinal = false"
  />

  <app-overlay-host />
</template>

<script>
import { versionName } from '@/manifest.json';
import AppDialog from '@/components/overlay/AppDialog.vue';
// #ifdef APP-PLUS
import { checkAndUpdate, getAppVersionInfo } from '@/utils/appUpdate.js';
// #endif
import { cancelAccount, logout } from '@/api-cache/profile-actions.js';
import { resetAllCachesOnAccountChange } from '@/utils/accountCacheReset.js';
import { clearCachedAdminFlag } from '@/utils/admin.js';
import { clearUserSession, getAppState, patchAppState } from '@/utils/app-state.js';
import { getSystemInfoCompat } from '@/utils/system-info.js';
import {
  READ_FONT_LEVELS,
  READ_FONT_LEVEL_NAMES,
  getReadFontSizeLevel,
  setReadFontSize
} from '@/utils/fontSize.js';

export default {
  components: { AppDialog },
  data() {
    return {
      appVersion: versionName,
      checkingUpdate: false,
      pageInlineStyle: {},
      isLoggedIn: false,
      showCancelExplain: false,
      showCancelPassword: false,
      showCancelFinal: false,
      cancelling: false,
      activeFontSize: getReadFontSizeLevel(),
      fontSizeOptions: READ_FONT_LEVEL_NAMES.map(value => ({
        value,
        label: READ_FONT_LEVELS[value].label
      }))
    };
  },
  onLoad() {
    this.setupHeaderLayout();
    // #ifdef APP-PLUS
    getAppVersionInfo().then(info => { this.appVersion = info.wgtVersion; }).catch(() => {});
    // #endif
  },
  onShow() {
    this.isLoggedIn = !!getAppState().isLoggedIn;
  },
  methods: {
    async checkUpdate() {
      // #ifdef APP-PLUS
      if (this.checkingUpdate) return;
      this.checkingUpdate = true;
      try { await checkAndUpdate({ manual: true }); }
      catch (_) { /* The update module displays the error. */ }
      finally { this.checkingUpdate = false; }
      // #endif
    },
    setupHeaderLayout() {
      try {
        const systemInfo = getSystemInfoCompat();
        const safeAreaTop = (systemInfo.safeAreaInsets && systemInfo.safeAreaInsets.top) || systemInfo.statusBarHeight || 0;
        if (safeAreaTop > 0) {
          this.pageInlineStyle = { '--settings-safe-area-top': `${safeAreaTop}px` };
        }
      } catch (error) {
        console.warn('[settings] setup header layout failed:', error);
      }
    },

    onFontSizeChange(value) {
      this.activeFontSize = setReadFontSize(value);
      uni.showToast({ title: `已切换为${READ_FONT_LEVELS[value].label}字号`, icon: 'none' });
    },

    navigateToPrivacy() {
      uni.navigateTo({ url: '/pages/privacy/privacy' });
    },

    openCancelAccount() {
      if (this.cancelling) return;
      this.showCancelExplain = true;
    },

    async proceedCancelAccount() {
      if (this.cancelling) return;
      this.showCancelExplain = false;
      this.cancelling = true;
      try {
        const result = await cancelAccount({ dryRun: true }, this);
        if (result.requiresPassword) this.showCancelPassword = true;
        else this.showCancelFinal = true;
      } catch (error) {
        uni.showToast({ title: this.cancelErrorMessage(error), icon: 'none' });
      } finally {
        this.cancelling = false;
      }
    },

    confirmCancelWithPassword(password) {
      return this.submitCancelAccount(password);
    },

    confirmCancelAccount() {
      return this.submitCancelAccount('');
    },

    async submitCancelAccount(password) {
      if (this.cancelling) return;
      this.cancelling = true;
      try {
        await cancelAccount({ password }, this);
        this.showCancelPassword = false;
        this.showCancelFinal = false;
        await this.performAccountTeardown();
      } catch (error) {
        const code = error && error.result && error.result.code;
        const message = code === 'PASSWORD_MISMATCH'
          ? '密码不正确，请重新输入'
          : (error && error.message) || '注销失败，请重试';
        uni.showToast({ title: message, icon: 'none' });
      } finally {
        this.cancelling = false;
      }
    },

    cancelErrorMessage(error) {
      const result = error && error.result;
      if (result && result.code === 'IDENTITY_MISMATCH') return '当前微信与账号不匹配，请重新登录';
      if (result && result.code === 'AMBIGUOUS_ACCOUNT') return '账号标识重复，请联系管理员核查';
      return (error && error.message) || '注销失败，请重试';
    },

    async performAccountTeardown() {
      try {
        await resetAllCachesOnAccountChange({});
      } catch (error) {
        console.warn('[注销账号] 清空缓存失败:', error);
      }
      uni.removeStorageSync('userInfo');
      uni.removeStorageSync('userOpenId');
      uni.removeStorageSync('openid');
      clearUserSession();
      clearCachedAdminFlag();
      this.isLoggedIn = false;
      console.log('✅ [注销账号] 本地数据清除完成');

      logout(this).then((loginRes) => {
        if (loginRes && loginRes.anonymousOpenid) {
          patchAppState({ openid: loginRes.anonymousOpenid });
          uni.setStorageSync('userOpenId', loginRes.anonymousOpenid);
        }
      }).catch((error) => {
        console.warn('[注销账号] 匿名 openid 初始化失败:', error);
      });

      uni.showToast({ title: '账号已注销', icon: 'success', duration: 1500 });
      setTimeout(() => {
        uni.redirectTo({ url: '/pages/login/login' });
      }, 1500);
    },

    goBack() {
      try {
        const pages = typeof getCurrentPages === 'function' ? getCurrentPages() : [];
        if (pages && pages.length > 1) {
          uni.navigateBack({ delta: 1 });
          return;
        }
      } catch (_) {}
      uni.switchTab({ url: '/pages/profile/profile' });
    }
  }
};
</script>

<style scoped>
.settings-page {
  min-height: 100vh;
  background: var(--app-page-bg, #ffffff);
  color: var(--app-primary-text, #111111);
  box-sizing: border-box;
}

.settings-header {
  position: relative;
  height: calc(var(--settings-safe-area-top, 0px) + 88rpx);
  padding-top: var(--settings-safe-area-top, 0px);
  box-sizing: border-box;
  background: var(--app-surface-bg, #ffffff);
  border-bottom: 1rpx solid var(--app-border-color, #f0f0f0);
}

.settings-back-btn {
  position: absolute;
  left: 30rpx;
  bottom: 16rpx;
  width: 56rpx;
  height: 56rpx;
  display: flex;
  align-items: center;
  justify-content: center;
}

.back-icon {
  width: 22rpx;
  height: 38rpx;
  display: block;
  filter: var(--app-icon-filter, none);
}

.settings-title {
  position: absolute;
  left: 120rpx;
  right: 120rpx;
  bottom: 24rpx;
  font-size: 30rpx;
  line-height: 40rpx;
  font-weight: 600;
  color: var(--app-primary-text, #000000);
  text-align: center;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.settings-content {
  padding: 30rpx 26rpx 60rpx;
  box-sizing: border-box;
}

.settings-section + .settings-section {
  margin-top: 44rpx;
}

.settings-section-title {
  font-size: 24rpx;
  color: var(--app-muted-text, #999999);
  margin-bottom: 14rpx;
  padding-left: 6rpx;
}

.settings-card {
  background: var(--app-surface-bg, #ffffff);
  border-radius: 16rpx;
  padding: 8rpx 26rpx;
  box-sizing: border-box;
  border: 1rpx solid var(--app-border-color, #f0f0f0);
}

.settings-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20rpx;
  padding: 26rpx 0;
  border-bottom: 1rpx solid var(--app-border-color, #f0f0f0);
}

.settings-card .settings-row:last-child {
  border-bottom: none;
}

.settings-row-label {
  font-size: 28rpx;
  color: var(--app-primary-text, #333333);
  flex-shrink: 0;
}

.settings-row-value {
  font-size: 28rpx;
  color: var(--app-muted-text, #999999);
}

.settings-row-label.danger {
  color: #c43d3d;
}

[data-app-theme="dark"] .settings-row-label.danger {
  color: #f08a8a;
}

.cancel-explain-text {
  display: block;
  font-size: 28rpx;
  line-height: 1.6;
  color: var(--overlay-muted, #666);
  overflow-wrap: anywhere;
}

.cancel-explain-text + .cancel-explain-text {
  margin-top: 14rpx;
}

.settings-row-desc {
  display: block;
  padding: 20rpx 0 24rpx;
  font-size: 22rpx;
  line-height: 32rpx;
  color: var(--app-muted-text, #999999);
}

.font-size-options {
  display: flex;
  gap: 14rpx;
}

.font-size-option {
  min-width: 96rpx;
  padding: 14rpx 10rpx;
  text-align: center;
  border-radius: 10rpx;
  background: var(--app-control-active-bg, #f5f5f5);
  color: var(--app-primary-text, #333333);
  font-size: 26rpx;
  transition: all 0.2s ease;
}

.font-size-option.active {
  background: var(--app-control-accent-bg, #111111);
  color: var(--app-control-accent-text, #ffffff);
}
</style>
