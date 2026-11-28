<template>
  <view class="setup-page">
    <view class="setup-content">
      <text class="setup-title">完善个人信息</text>
      <text class="setup-subtitle">设置头像和昵称，让大家认识你</text>

      <view class="avatar-section" @tap="onChooseAvatar">
        <view class="avatar-ring">
          <image class="avatar-image" :src="avatarPreviewSrc" mode="aspectFill"></image>
          <view v-if="isUploadingAvatar" class="avatar-uploading">
            <text class="avatar-uploading-text">上传中</text>
          </view>
        </view>
        <text class="avatar-hint">{{ localAvatarPath ? '点击更换头像' : '点击上传头像（可选）' }}</text>
      </view>

      <view class="form-section">
        <text class="field-label">昵称</text>
        <view class="field-box">
          <input
            class="field-input"
            type="text"
            :value="nickName"
            placeholder="请输入昵称"
            :maxlength="maxNicknameLength"
            @input="onNickNameInput"
          />
        </view>
        <text class="field-count">{{ nickName.length }}/{{ maxNicknameLength }}</text>
      </view>

      <view class="tips">
        <text class="tips-text">微信登录不需要绑定手机号</text>
      </view>
    </view>

    <view class="enter-key-btn" :class="{ disabled: !canSubmit || isSaving }" @tap="onSubmit">
      <view class="ek-layer ek-border"></view>
      <view class="ek-layer ek-fill">
        <text class="ek-text">{{ isSaving ? '保存中…' : '进入 ↵' }}</text>
      </view>
    </view>
    <app-overlay-host />
  </view>
</template>

<script>
import { cloudCall } from '@/utils/cloudCall.js';
import { getAppState, patchAppState, setUserSession } from '@/utils/app-state.js';
import { resolveUserAvatar } from '@/utils/defaultAvatar.js';
import { uploadFileCompat } from '@/utils/upload-compat.js';
// #ifdef APP-PLUS
import { openPendingPoemWidgetDetail } from '@/utils/poemWidgetNavigation.js';
// #endif

const HOME_PAGE = '/pages/poem-square/poem-square';
const MAX_NICKNAME_LENGTH = 30;

export default {
    data() {
        return {
            nickName: '',
            localAvatarPath: '',
            avatarUrl: '',
            isUploadingAvatar: false,
            isSaving: false,
            maxNicknameLength: MAX_NICKNAME_LENGTH,
            userSeed: ''
        };
    },
    computed: {
        canSubmit() {
            const name = this.nickName.trim();
            return !!name && name.length <= this.maxNicknameLength && !this.isUploadingAvatar;
        },
        avatarPreviewSrc() {
            return resolveUserAvatar(
                this.localAvatarPath || this.avatarUrl,
                this.userSeed || this.nickName.trim() || 'wechat-profile-setup'
            );
        }
    },
    onLoad() {
        this.prefillFromSession();
    },
    methods: {
        prefillFromSession() {
            const state = getAppState();
            const userInfo = state.userInfo || {};
            if (userInfo.profileCompleted === true) {
                this.leaveForHome();
                return;
            }
            this.userSeed = userInfo._openid || userInfo.poemId || state.openid || '';
            this.nickName = typeof userInfo.nickName === 'string' && userInfo.nickName !== '微信用户'
                ? userInfo.nickName
                : '';
            this.avatarUrl = typeof userInfo.avatarUrl === 'string' ? userInfo.avatarUrl : '';
        },
        onNickNameInput(event) {
            this.nickName = event && event.detail ? event.detail.value : '';
        },
        chooseMedia() {
            return new Promise((resolve) => {
                const handle = (path) => resolve(path || '');
                if (typeof uni.chooseMedia === 'function') {
                    uni.chooseMedia({
                        count: 1,
                        mediaType: ['image'],
                        sizeType: ['compressed'],
                        sourceType: ['album', 'camera'],
                        success: (res) => {
                            const file = res && res.tempFiles && res.tempFiles[0];
                            handle(file && (file.tempFilePath || file.filePath));
                        },
                        fail: () => resolve('')
                    });
                    return;
                }
                uni.chooseImage({
                    count: 1,
                    sizeType: ['compressed'],
                    sourceType: ['album', 'camera'],
                    success: (res) => handle(res && res.tempFilePaths && res.tempFilePaths[0]),
                    fail: () => resolve('')
                });
            });
        },
        async onChooseAvatar() {
            if (this.isUploadingAvatar || this.isSaving) return;
            const path = await this.chooseMedia();
            if (!path) return;
            this.localAvatarPath = path;
            this.isUploadingAvatar = true;
            try {
                const result = await uploadFileCompat({
                    cloudPath: `user_avatars/${Date.now()}_${Math.floor(Math.random() * 1000)}.jpg`,
                    filePath: path,
                    context: this,
                    pageTag: 'profile-setup',
                    requireAuth: true
                });
                this.avatarUrl = result.fileID;
            } catch (error) {
                this.localAvatarPath = '';
                uni.showToast({ title: '头像上传失败，请重试', icon: 'none' });
            } finally {
                this.isUploadingAvatar = false;
            }
        },
        async onSubmit() {
            if (!this.canSubmit || this.isSaving) return;
            const nickName = this.nickName.trim();
            this.isSaving = true;
            try {
                const response = await cloudCall('completeProfile', {
                    nickName,
                    avatarUrl: this.avatarUrl || ''
                }, { pageTag: 'profile-setup', context: this });
                const result = response && response.result ? response.result : response;
                if (!result || !result.success) {
                    throw new Error((result && result.message) || '保存失败，请重试');
                }
                this.applyCompletedSession(nickName, result.userInfo);
                this.leaveForHome();
            } catch (error) {
                uni.showToast({ title: error.message || '保存失败，请重试', icon: 'none', duration: 3000 });
            } finally {
                this.isSaving = false;
            }
        },
        applyCompletedSession(nickName, returnedUserInfo) {
            const state = getAppState();
            const base = returnedUserInfo || Object.assign({}, state.userInfo, {
                nickName,
                profileCompleted: true
            });
            const userInfo = Object.assign({}, state.userInfo, base, {
                nickName,
                profileCompleted: true
            });
            if (!userInfo.avatarUrl && this.avatarUrl) {
                userInfo.avatarUrl = this.avatarUrl;
            }
            const openid = state.openid || userInfo._openid || null;
            setUserSession(userInfo, openid);
            patchAppState({ isLoggedIn: true });
            try {
                uni.setStorageSync('userInfo', userInfo);
                if (openid) uni.setStorageSync('userOpenId', openid);
            } catch (error) {}
        },
        leaveForHome() {
            // #ifdef APP-PLUS
            const onFail = () => uni.showToast({ title: '诗歌详情打开失败，请重试', icon: 'none' });
            if (openPendingPoemWidgetDetail({ replaceStartup: true, onFail })) return;
            // #endif
            uni.reLaunch({
                url: HOME_PAGE,
                // #ifdef APP-PLUS
                success: () => { openPendingPoemWidgetDetail(); },
                // #endif
                fail: () => {
                    uni.switchTab({ url: HOME_PAGE });
                }
            });
        }
    }
};
</script>

<style>
.setup-page {
  min-height: 100vh;
  background: #fff;
  padding: 80rpx 48rpx 220rpx;
  box-sizing: border-box;
}

.setup-content {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.setup-title {
  font-size: 44rpx;
  font-weight: 600;
  color: #222;
}

.setup-subtitle {
  margin-top: 16rpx;
  font-size: 26rpx;
  color: #999;
}

.avatar-section {
  margin-top: 64rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.avatar-ring {
  position: relative;
  width: 180rpx;
  height: 180rpx;
  border-radius: 50%;
  overflow: hidden;
  background: #f2f2f2;
  border: 6rpx solid #f1f1f1;
  box-shadow: 0 6rpx 16rpx rgba(0, 0, 0, 0.06);
}

.avatar-image {
  width: 100%;
  height: 100%;
  display: block;
}

.avatar-uploading {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
}

.avatar-uploading-text {
  font-size: 24rpx;
  color: #fff;
}

.avatar-hint {
  margin-top: 16rpx;
  font-size: 24rpx;
  color: #999;
}

.form-section {
  width: 100%;
  max-width: 640rpx;
  margin-top: 56rpx;
}

.field-label {
  display: block;
  font-size: 26rpx;
  color: #888;
  margin-bottom: 12rpx;
}

.field-box {
  background: #f5f6f7;
  border-radius: 9999rpx;
  padding: 0 32rpx;
}

.field-input {
  width: 100%;
  height: 96rpx;
  font-size: 30rpx;
  color: #333;
}

.field-count {
  display: block;
  margin-top: 10rpx;
  text-align: right;
  font-size: 22rpx;
  color: #bbb;
}

.tips {
  margin-top: 40rpx;
}

.tips-text {
  font-size: 24rpx;
  color: #b0b0b0;
}

.enter-key-btn {
  position: fixed;
  right: 40rpx;
  bottom: 40rpx;
  width: 220rpx;
  height: 180rpx;
  cursor: pointer;
  transition: all 0.2s ease;
}

.enter-key-btn:active {
  transform: scale(0.95);
}

.enter-key-btn.disabled {
  opacity: 0.5;
  pointer-events: none;
}

.enter-key-btn .ek-layer {
  position: absolute;
  inset: 0;
}

.enter-key-btn .ek-border {
  background: #333;
  filter: drop-shadow(0 6rpx 12rpx rgba(0, 0, 0, 0.18));
  clip-path: polygon(55% 0, 100% 0, 100% 100%, 0 100%, 0 60%, 55% 60%, 55% 0);
  border-radius: 24rpx;
}

.enter-key-btn .ek-fill {
  background: #fff;
  clip-path: polygon(57% 2%, 100% 2%, 100% 100%, 2% 100%, 2% 62%, 57% 62%, 57% 2%);
  border-radius: 22rpx;
}

.enter-key-btn .ek-text {
  position: absolute;
  bottom: 24rpx;
  left: 24rpx;
  font-size: 28rpx;
  color: #333;
  font-weight: 500;
}
</style>
