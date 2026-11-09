<template>
  <community-shell title="" class="community-page">
    <text class="apply-title">入驻申请</text><text class="intro">资质审核通过后开通社团主页与管理后台</text>
    <community-state v-if="loading || error" :loading="loading" :error="error" :action="authNeeded ? '去登录' : ''" @action="recover" />
    <template v-else>
      <view v-if="application" class="notice"><text class="status-label">{{ labels[application.status] }}</text><text class="status-note">{{ application.status === 'pending' ? '等待平台审核' : application.status === 'approved' ? '诗社已开通' : application.reviewNote || '请修改后重新提交' }}</text><button v-if="application.status === 'approved'" class="text-button" @tap="open('society', { id: application.societyId })">前往诗社主页 ›</button></view>
      <view class="form-grid">
        <view v-for="field in fields" :key="field.key" class="field"><text class="field-label">{{ field.label }}<text v-if="field.required" class="required"> *</text></text><input v-model="form[field.key]" class="field-input" :disabled="locked" :type="field.key === 'phone' ? 'tel' : 'text'" :maxlength="field.max" :placeholder="field.placeholder" /></view>
        <view class="field"><text class="field-label">招募范围<text class="required"> *</text></text><picker :range="recruitmentOptions" range-key="label" :value="recruitmentIndex" :disabled="locked" @change="form.recruitment = recruitmentOptions[$event.detail.value].value"><view class="field-input picker-value">{{ recruitmentLabel }}<text class="picker-arrow">›</text></view></picker></view>
        <view class="field"><text class="field-label">社团简介 <text class="required">*</text></text><textarea v-model="form.description" class="field-area" :disabled="locked" maxlength="1000" /></view>
        <view class="field"><text class="field-label">证明材料 <text class="required">*</text></text><view class="uploads"><view v-for="(file, index) in form.proofFiles" :key="file" class="upload-preview"><image :src="urls[file] || file" mode="aspectFill" @tap="preview(file)" /><button v-if="!locked" class="remove-file" aria-label="移除证明材料" @tap="form.proofFiles.splice(index, 1)">×</button></view><button v-if="!locked && form.proofFiles.length < 3" class="upload-button" :disabled="uploading" @tap="choose('proof')"><text>＋</text></button></view></view>
        <view class="field"><text class="field-label">诗社头像 <text class="required">*</text></text><view class="uploads"><button class="upload-button" :disabled="locked || uploading" @tap="choose('avatar')"><image v-if="form.avatarUrl" :src="urls[form.avatarUrl] || form.avatarUrl" mode="aspectFill" /><template v-else><text>＋</text></template></button></view></view>
      </view>
      <template v-if="!locked"><checkbox-group @change="form.agreed = $event.detail.value.includes('agreed')"><label class="agreement"><checkbox value="agreed" :checked="form.agreed" color="#51413a" /><text>我承诺所提交的材料真实有效，并同意平台在审核必要的范围内使用上述信息。</text></label></checkbox-group><text v-if="formError" class="notice">{{ formError }}</text><view class="submit-row"><button class="primary-button" :disabled="busy || uploading || !form.agreed" :loading="busy || uploading" @tap="submit">{{ application ? '重新提交' : '提交申请' }}</button></view></template>
    </template>
  </community-shell>
  <app-overlay-host />
</template>
<script>
import CommunityShell from '@/pages-community/components/society/CommunityShell.vue';
import CommunityState from '@/pages-community/components/society/CommunityState.vue';
import { societyRequest, societyFileUrls } from '@/api-cache/societies.js';
import { getCurrentUserId } from '@/utils/auth.js';
import { uploadFile } from '@/utils/uploader.js';
import { openSocietyPage, openSocietyLogin, APPLICATION_LABELS, RECRUITMENT_LABELS, RECRUITMENT_OPTIONS, showSocietyError } from '@/pages-community/utils/society.js';
const emptyForm = () => ({ region: '', school: '', name: '', contactName: '', phone: '', foundedAt: '', motto: '', description: '', proofFiles: [], avatarUrl: '', recruitment: 'open', agreed: false });
export default {
  components: { CommunityShell, CommunityState },
  data: () => ({ form: emptyForm(), application: null, urls: {}, uploadPrefix: '', loading: true, error: '', authNeeded: false, formError: '', busy: false, uploading: false, loadedActor: '', labels: APPLICATION_LABELS, recruitmentOptions: RECRUITMENT_OPTIONS, today: new Date().toISOString().slice(0, 10), fields: [
    { key: 'region', label: '所在地区', placeholder: '', max: 40, required: true },
    { key: 'school', label: '学校名称', placeholder: '', max: 60, required: true },
    { key: 'name', label: '社团名称', placeholder: '', max: 40, required: true },
    { key: 'contactName', label: '负责人', placeholder: '', max: 30, required: true },
    { key: 'phone', label: '联系电话', placeholder: '', max: 20, required: true }
  ] }),
  computed: {
    locked() { return ['pending', 'approved'].includes(this.application?.status); },
    recruitmentIndex() { return Math.max(0, RECRUITMENT_OPTIONS.findIndex(option => option.value === this.form.recruitment)); },
    recruitmentLabel() { return RECRUITMENT_LABELS[this.form.recruitment] || RECRUITMENT_LABELS.open; }
  },
  onShow() { this.load(); },
  methods: {
    open: openSocietyPage,
    draftKey() { return `society:application:draft:${getCurrentUserId() || 'guest'}`; },
    recover() { if (this.authNeeded) openSocietyLogin(); else this.load(); },
    async load() {
      this.loading = true; this.error = ''; this.authNeeded = false;
      try {
        const result = await societyRequest('myApplication', {}, this);
        this.application = result.application; this.uploadPrefix = result.uploadPrefix;
        const actor = getCurrentUserId();
        if (this.loadedActor !== actor || this.locked || !this.loadedActor) {
          const draft = uni.getStorageSync(this.draftKey());
          const matchingDraft = draft && draft.applicationRevision === (result.application?.revision || 0);
          this.form = { ...emptyForm(), ...(!this.locked && matchingDraft ? draft : result.application || {}) };
        }
        this.loadedActor = actor; await this.refreshUrls();
      } catch (error) { this.error = error.message; this.authNeeded = error.code === 'AUTH_REQUIRED'; }
      finally { this.loading = false; }
    },
    saveDraft() { uni.setStorageSync(this.draftKey(), { ...this.form, applicationRevision: this.application?.revision || 0 }); uni.showToast({ title: '草稿已保存在本机', icon: 'none' }); },
    async refreshUrls() { this.urls = await societyFileUrls([...this.form.proofFiles, this.form.avatarUrl].filter(Boolean)); },
    preview(file) { uni.previewImage({ urls: this.form.proofFiles.map(id => this.urls[id] || id), current: this.urls[file] || file }); },
    async choose(kind) {
      if (this.uploading || this.locked) return;
      this.uploading = true;
      try {
        const result = await new Promise((resolve, reject) => uni.chooseImage({ count: kind === 'avatar' ? 1 : 3 - this.form.proofFiles.length, sizeType: ['compressed'], success: resolve, fail: reject }));
        for (const file of result.tempFilePaths) {
          const extension = file.match(/\.(png|jpe?g|webp)(?:\?|$)/i)?.[1] || 'jpg';
          const id = await uploadFile(`${this.uploadPrefix}/${kind}/${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${extension}`, file, { context: this, requireAuth: true, pageTag: 'society-application' });
          if (!id) throw new Error('上传失败，请重试');
          if (kind === 'avatar') this.form.avatarUrl = id; else this.form.proofFiles.push(id);
        }
        await this.refreshUrls();
      } catch (error) { if (!/cancel/i.test(error.errMsg || '')) showSocietyError(error); }
      finally { this.uploading = false; }
    },
    async submit() {
      if (this.busy || this.uploading || this.locked) return;
      this.formError = '';
      for (const field of this.fields) if (!this.form[field.key].trim()) { this.formError = `请填写${field.label}`; return; }
      if (this.form.description.trim().length < 10) { this.formError = '请填写至少10字的诗社简介'; return; }
      if (!this.form.proofFiles.length || !this.form.avatarUrl || !this.form.agreed) { this.formError = '请上传证明材料和头像，并确认材料真实有效'; return; }
      this.busy = true;
      try { await societyRequest('submitApplication', { form: this.form }, this); uni.removeStorageSync(this.draftKey()); await this.load(); uni.showToast({ title: '申请已提交', icon: 'success' }); }
      catch (error) { if (error.code === 'AUTH_REQUIRED') this.saveDraft(); else this.formError = error.message; }
      finally { this.busy = false; }
    }
  }
};
</script>
<style scoped>
@import '@/styles/society.css';
.apply-title { display: block; font-size: 50rpx; font-weight: 600; line-height: 1.4; }
.intro { display: block; color: var(--app-muted-text, #938680); font-size: 21rpx; margin: 4rpx 0 56rpx; }
.form-grid .field { display: grid; grid-template-columns: 128rpx minmax(0, 1fr); align-items: start; gap: 12rpx; margin-bottom: 20rpx; }
.form-grid .field-label { margin: 14rpx 0 0; font-size: 25rpx; }
.form-grid .field-input { height: 58rpx; padding: 8rpx 16rpx; border-radius: 14rpx; background: var(--app-surface-bg, #fff); box-shadow: 0 3rpx 7rpx #00000018; }
.form-grid .field-area { min-height: 230rpx; background: var(--app-surface-bg, #fff); box-shadow: 0 3rpx 7rpx #00000018; }
.form-grid picker { width: 100%; }
.picker-value { display: flex; align-items: center; justify-content: space-between; }
.picker-arrow { color: var(--app-muted-text, #9a8d85); }
.submit-row { display: flex; justify-content: flex-end; margin-top: 18rpx; }
.required { color: #99755d; }
.status-label { display: block; font-weight: 600; margin-bottom: 8rpx; }
.status-note { display: block; }
.char-count { display: block; text-align: right; color: var(--app-muted-text, #938680); font-size: 22rpx; }
.uploads { display: flex; flex-wrap: wrap; gap: 22rpx; margin-top: 18rpx; }
.upload-button, .upload-preview { width: 160rpx; height: 160rpx; border-radius: 10rpx; border: 1rpx solid var(--app-border-color, #cfc3b8); position: relative; }
.upload-button { display: flex; flex-direction: column; justify-content: center; align-items: center; background: var(--app-surface-bg, #fff); padding: 0; color: var(--app-muted-text, #9a8d85); }
.upload-button text:first-child { font-size: 44rpx; }.upload-button text:last-child { font-size: 22rpx; }
.upload-button image, .upload-preview image { width: 100%; height: 100%; border-radius: 10rpx; }
.remove-file { position: absolute; right: -12rpx; top: -12rpx; width: 42rpx; height: 42rpx; border-radius: 50%; padding: 0; background: #55413a; color: white; }
.agreement { display: flex; align-items: flex-start; gap: 12rpx; margin-top: 40rpx; color: var(--app-muted-text, #938680); font-size: 23rpx; line-height: 1.8; }
.agreement checkbox { transform: scale(.8); transform-origin: top left; }
</style>
