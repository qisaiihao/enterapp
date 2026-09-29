import { bindWechatAccount } from '@/api-cache/wechat-auth.js';

export default {
  data() { return { wechatConflictType: '', targetWechatBound: false }; },
  onUnload() {
    this._wechatBindRequest = (this._wechatBindRequest || 0) + 1;
    clearTimeout(this._wechatNavigationTimer);
    this.pendingLoginResult = null;
  },
  methods: {
    clearWechatBindingDialogs() {
      this.showBindWechatModal = false;
      this.showRebindConfirmModal = false;
      this.showOpenidConflictModal = false;
      this.boundAccountInfo = null;
      this.conflictAccountInfo = null;
      this.wechatConflictType = '';
      this.targetWechatBound = false;
    },
    finishWechatLogin(result, bound) {
      if (!result || this.loginPageUnloaded) return;
      const userInfo = bound ? { ...result.userInfo, wechatOpenId: result.currentOpenid } : result.userInfo;
      this.applyUserSession(userInfo, result.openid, { isLoggedIn: true });
      this.clearWechatBindingDialogs();
      this.pendingLoginResult = null;
      this.password = '';
      this.loginSmsCode = '';
      uni.showToast({ title: bound ? '绑定成功，下次可使用微信登录' : '登录成功', icon: 'success' });
      clearTimeout(this._wechatNavigationTimer);
      this._wechatNavigationTimer = setTimeout(() => {
        if (!this.loginPageUnloaded) uni.switchTab({ url: '/pages/poem-square/poem-square' });
      }, 1500);
    },
    skipBindWechat() {
      if (this.isBindingWechat) return;
      this.finishWechatLogin(this.pendingLoginResult, false);
    },
    handleBindWechat() { return this.submitWechatBinding(false); },
    confirmRebind() { return this.submitWechatBinding(true); },
    confirmOpenidConflict() { return this.submitWechatBinding(true); },
    cancelRebind() { this.returnToWechatBinding(); },
    cancelOpenidConflict() { this.returnToWechatBinding(); },
    returnToWechatBinding() {
      if (this.isBindingWechat || !this.pendingLoginResult) return;
      this.clearWechatBindingDialogs();
      this.showBindWechatModal = true;
    },
    completeBindWechat(result) { this.finishWechatLogin(result, true); },
    async submitWechatBinding(forceRebind) {
      if (this.isBindingWechat || !this.pendingLoginResult || this.loginPageUnloaded) return;
      const login = this.pendingLoginResult;
      const token = (this._wechatBindRequest || 0) + 1;
      this._wechatBindRequest = token;
      const current = () => !this.loginPageUnloaded && token === this._wechatBindRequest && this.pendingLoginResult === login;
      this.isBindingWechat = true;
      uni.showLoading({ title: '绑定中...', mask: true });
      try {
        const result = await bindWechatAccount(login.userInfo.poemId, forceRebind, this);
        if (!current()) return;
        if (result.success) {
          this.completeBindWechat(login);
          return;
        }
        if (result.code === 'OPENID_CONFLICT' || result.code === 'WECHAT_ALREADY_BOUND') {
          this.clearWechatBindingDialogs();
          this.wechatConflictType = result.conflictType || '';
          this.targetWechatBound = !!result.targetWechatBound;
          if (result.code === 'OPENID_CONFLICT') {
            this.conflictAccountInfo = result.conflictAccount;
            this.showOpenidConflictModal = true;
          } else {
            this.boundAccountInfo = result.boundAccount;
            this.showRebindConfirmModal = true;
          }
          return;
        }
        if (result.code === 'BIND_AUTH_REQUIRED') {
          this.clearWechatBindingDialogs();
          this.pendingLoginResult = null;
          this.password = '';
          this.loginSmsCode = '';
        }
        uni.showToast({ title: result.message || '绑定失败，请重试', icon: 'none' });
      } catch (error) {
        if (current()) uni.showToast({ title: error.message || '绑定失败，请重试', icon: 'none' });
      } finally {
        if (token === this._wechatBindRequest) this.isBindingWechat = false;
        uni.hideLoading();
      }
    }
  }
};
