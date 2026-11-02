<template>
  <view class="editor community-page">
    <community-state v-if="loading || error" :loading="loading" :error="error" @action="load" />
    <template v-if="!loading && !error">
      <view class="field"><text class="field-label">标题</text><input v-model="form.title" class="field-input" maxlength="100" /></view>
      <view class="field"><text class="field-label">正文</text><textarea v-if="kind === 'news'" v-model="form.content" class="field-area" maxlength="5000" /><textarea v-else v-model="form.description" class="field-area" maxlength="5000" /></view>
      <template v-if="kind !== 'news'">
        <view class="field"><text class="field-label">{{ kind === 'call' ? '征稿要求' : '参与须知' }}</text><textarea v-model="form.requirements" class="field-area" maxlength="2000" /></view>
        <view class="field"><text class="field-label">分类</text><input v-model="form.category" class="field-input" maxlength="20" /></view>
        <view class="field"><text class="field-label">封面</text><button class="secondary-button" :disabled="uploading" @tap="upload(-1)"><image v-if="coverUrl" class="cover" :src="coverUrl" mode="aspectFit" /><text v-else>＋</text></button></view>
        <view v-for="field in timeFields" :key="field.key" class="field"><text class="field-label">{{ field.label }}</text><view class="row"><picker mode="date" :value="days[field.key]" @change="days[field.key] = $event.detail.value"><view class="field-input">{{ days[field.key] || '日期' }}</view></picker><picker mode="time" :value="times[field.key]" @change="times[field.key] = $event.detail.value"><view class="field-input">{{ times[field.key] || '时间' }}</view></picker></view></view>
        <template v-if="kind === 'event'"><view class="field"><text class="field-label">地点</text><input v-model="form.location" class="field-input" maxlength="200" /></view><view class="field"><text class="field-label">人数上限</text><input v-model="form.capacity" type="number" class="field-input" placeholder="不限" /></view></template>
        <view class="field"><text class="field-label">{{ kind === 'call' ? '收稿范围' : '参与范围' }}</text><picker v-if="kind === 'call'" :range="callScopeOptions" range-key="label" :value="callScopeIndex" @change="form.audience = callScopeOptions[$event.detail.value].value"><view class="field-input">{{ callScopeLabel }}</view></picker><picker v-else :range="['所有用户', '诗社成员']" :value="form.audience === 'members' ? 1 : 0" @change="form.audience = Number($event.detail.value) ? 'members' : 'all'"><view class="field-input">{{ form.audience === 'members' ? '诗社成员' : '所有用户' }}</view></picker></view>
        <view v-if="kind === 'call'" class="field"><text class="field-label">合办诗社</text><view v-for="host in selectedHosts" :key="host._id" class="row"><text class="grow">{{ host.name }}</text><button class="text-button" @tap="removeHost(host._id)">移除</button></view><view class="row"><input v-model="hostQuery" class="field-input" maxlength="40" /><button class="text-button" @tap="searchHosts">搜索</button></view><button v-for="host in hosts" :key="host._id" class="text-button host" @tap="addHost(host)">{{ host.name }}</button></view>
        <view v-for="(guest, index) in form.guests" :key="index" class="panel"><button class="secondary-button" :disabled="uploading" @tap="upload(index)"><image v-if="guest.avatarUrl" class="avatar" :src="guest.avatarDisplay || guest.avatarUrl" mode="aspectFit" /><text v-else>＋</text></button><input v-model="guest.role" class="field-input" placeholder="嘉宾 / 指导老师 / 评审" maxlength="20" /><input v-model="guest.name" class="field-input" placeholder="姓名" maxlength="40" /><input v-model="guest.bio" class="field-input" placeholder="简介" maxlength="200" /><button class="text-button" @tap="form.guests.splice(index, 1)">删除</button></view>
        <button v-if="form.guests.length < 10" class="text-button" @tap="form.guests.push({ role: '嘉宾', name: '', bio: '', avatarUrl: '' })">添加嘉宾</button>
      </template>
      <view class="actions"><button class="secondary-button" :disabled="busy" @tap="$emit('cancel')">取消</button><button class="primary-button" :loading="busy" :disabled="loading || busy || uploading" @tap="save">{{ itemId ? '保存' : '发布' }}</button></view>
    </template>
  </view>
</template>
<script>
import CommunityState from './CommunityState.vue';
import { societyRequest, societyFileUrls } from '@/api-cache/societies.js';
import { uploadFile } from '@/utils/uploader.js';
import { getCurrentUserId } from '@/utils/auth.js';
import { showSocietyError, CALL_SCOPE_OPTIONS, CALL_SCOPE_LABELS } from '@/utils/society.js';
export default {
  components: { CommunityState }, props: { societyId: String, kind: String, itemId: String }, emits: ['cancel', 'saved'],
  data: () => ({ callScopeOptions: CALL_SCOPE_OPTIONS, form: { title: '', content: '', description: '', requirements: '', category: '', coverImage: '', location: '', capacity: '', audience: 'all', guests: [], invitedSocietyIds: [] }, days: {}, times: {}, hosts: [], selectedHosts: [], hostQuery: '', coverUrl: '', loading: false, busy: false, uploading: false, error: '', requestId: `${Date.now()}-${Math.random().toString(36).slice(2)}`, actor: '' }),
  computed: { callScopeIndex() { return Math.max(0, CALL_SCOPE_OPTIONS.findIndex(option => option.value === this.form.audience)); }, callScopeLabel() { return CALL_SCOPE_LABELS[this.form.audience] || CALL_SCOPE_LABELS.all; }, timeFields() { return this.kind === 'event' ? [{ key: 'startTime', label: '开始时间' }, { key: 'endTime', label: '结束时间' }, { key: 'registrationEnd', label: '报名截止' }] : [{ key: 'deadline', label: '征稿截止' }]; } },
  mounted() { this.actor = getCurrentUserId(); this.load(); },
  methods: {
    async load() { if (!this.itemId) return; this.loading = true; this.error = ''; try {
      const { item } = await societyRequest('editContent', { societyId: this.societyId, kind: this.kind, id: this.itemId }, this);
      this.form = { ...this.form, ...item, coverImage: item.coverImageFileId || item.coverImage || '', guests: (item.guests || []).map(guest => ({ ...guest, avatarDisplay: guest.avatarUrl, avatarUrl: guest.avatarUrlFileId || guest.avatarUrl })) };
      for (const field of this.timeFields) { if (item[field.key]) { const stamp = new Date(new Date(item[field.key]).getTime() + 8 * 3600000).toISOString(); this.days[field.key] = stamp.slice(0, 10); this.times[field.key] = stamp.slice(11, 16); } }
      this.selectedHosts = await Promise.all((item.invitedSocietyIds || []).map(async id => { try { return (await societyRequest('detail', { societyId: id }, this)).society; } catch (_) { return { _id: id, name: '诗社已停用' }; } }));
      this.coverUrl = this.form.coverImage ? (await societyFileUrls([this.form.coverImage]))[this.form.coverImage] || this.form.coverImage : '';
    } catch (error) { this.error = error.message; } finally { this.loading = false; } },
    async searchHosts() { try { this.hosts = (await societyRequest('list', { query: this.hostQuery }, this)).societies.filter(host => host._id !== this.societyId && !this.form.invitedSocietyIds.includes(host._id)); } catch (error) { showSocietyError(error); } },
    addHost(host) { if (this.selectedHosts.length >= 10) return; this.selectedHosts.push(host); this.form.invitedSocietyIds.push(host._id); this.hosts = this.hosts.filter(item => item._id !== host._id); },
    removeHost(id) { this.form.invitedSocietyIds = this.form.invitedSocietyIds.filter(value => value !== id); this.selectedHosts = this.selectedHosts.filter(host => host._id !== id); },
    async upload(guestIndex = -1) { if (this.uploading) return; this.uploading = true; try {
      const result = await new Promise((resolve, reject) => uni.chooseImage({ count: 1, sizeType: ['compressed'], success: resolve, fail: reject }));
      if (getCurrentUserId() !== this.actor) throw new Error('账号已切换，请重新打开编辑页');
      const { uploadPrefix } = await societyRequest('myApplication', {}, this);
      const file = result.tempFilePaths[0]; const extension = file.match(/\.(png|jpe?g|webp)(?:\?|$)/i)?.[1] || 'jpg';
      const fileId = await uploadFile(`${uploadPrefix}/content/${Date.now()}-${Math.random().toString(36).slice(2)}.${extension}`, file, { context: this, requireAuth: true, pageTag: 'society-content' });
      if (!fileId) throw new Error('上传失败');
      const display = (await societyFileUrls([fileId]))[fileId] || fileId; if (guestIndex >= 0 && this.form.guests[guestIndex]) { this.form.guests[guestIndex].avatarUrl = fileId; this.form.guests[guestIndex].avatarDisplay = display; } else { this.form.coverImage = fileId; this.coverUrl = display; }
    } catch (error) { if (!/cancel/i.test(error.errMsg || '')) showSocietyError(error); } finally { this.uploading = false; } },
    async save() { if (this.busy || this.uploading) return; this.busy = true; try {
      if (getCurrentUserId() !== this.actor) throw new Error('账号已切换，请重新打开编辑页');
      const form = { ...this.form };
      if (this.kind !== 'news') for (const field of this.timeFields) { if (!this.days[field.key] || !this.times[field.key]) throw new Error(`请选择${field.label}`); form[field.key] = `${this.days[field.key]}T${this.times[field.key]}:00+08:00`; }
      await societyRequest('saveContent', { societyId: this.societyId, kind: this.kind, id: this.itemId || '', revision: this.form.revision, requestId: this.requestId, form }, this); this.$emit('saved');
    } catch (error) { showSocietyError(error); } finally { this.busy = false; } }
  }
};
</script>
<style scoped>
@import '@/styles/society.css';
.editor { margin: 24rpx 0; }.editor picker { flex: 1; min-width: 0; }.cover { width: 100%; height: 220rpx; }.host { display: block; }.editor .panel input { margin-bottom: 12rpx; }
</style>
