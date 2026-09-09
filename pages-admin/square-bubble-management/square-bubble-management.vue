<template>
  <view class="bubble-admin">
    <view v-if="loading" class="state">加载中...</view>
    <view v-else-if="error" class="state">
      <text>{{ error }}</text>
      <button @tap="loadConfig">重新加载</button>
    </view>
    <view v-else-if="authorized" class="config-card">
      <view class="switch-row">
        <text>显示广场气泡</text>
        <switch :checked="form.enabled" :disabled="saving" color="#000000" @change="form.enabled = $event.detail.value" />
      </view>
      <text class="label">泡泡文案</text>
      <input v-model="form.text" class="text-input" :maxlength="32" :disabled="saving" placeholder="让乌鸦说点什么，最多32字" />
      <text class="label">点击后打开</text>
      <picker :value="targetIndex" :range="targets" range-key="label" :disabled="saving" @change="form.target = targets[Number($event.detail.value)].value">
        <view class="target-picker">{{ targets[targetIndex].label }} <text>›</text></view>
      </picker>
      <text class="label">预览</text>
      <view class="preview">
        <image class="crow" src="/static/images/icons/activities.png" mode="aspectFit" />
        <SquareSpeechBubble v-if="form.enabled && form.text.trim()" :text="form.text.trim()" />
      </view>
      <button class="save-button" :disabled="saving" :loading="saving" @tap="save">保存</button>
      <text class="hint">保存后重新进入诗歌广场即可看到更新。关闭气泡不会隐藏活动入口。</text>
    </view>
  </view>
</template>

<script>
import SquareSpeechBubble from '@/components/SquareSpeechBubble.vue';
import { getSquareBubbleConfig, saveSquareBubbleConfig, SQUARE_BUBBLE_TARGETS } from '@/api-cache/square-bubble.js';
import { refreshAdminStatus } from '@/utils/admin.js';

export default {
  components: { SquareSpeechBubble },
  data() {
    return { loading: true, saving: false, authorized: false, error: '', targets: SQUARE_BUBBLE_TARGETS,
      form: { enabled: true, text: '来看看本期周刊', target: 'weekly' } };
  },
  computed: {
    targetIndex() { return Math.max(0, this.targets.findIndex(item => item.value === this.form.target)); }
  },
  onLoad() { this.loadConfig(); },
  methods: {
    async loadConfig() {
      this.loading = true;
      this.error = '';
      try {
        this.authorized = await refreshAdminStatus();
        if (!this.authorized) throw new Error('仅管理员可编辑，请确认登录账号后重试');
        this.form = await getSquareBubbleConfig(this);
      } catch (error) { this.error = error.message || '加载失败'; }
      finally { this.loading = false; }
    },
    async save() {
      if (this.saving || !this.authorized) return;
      if (this.form.enabled && !this.form.text.trim()) {
        uni.showToast({ title: '请填写泡泡文案', icon: 'none' });
        return;
      }
      this.saving = true;
      try {
        this.form = await saveSquareBubbleConfig(this.form, this);
        uni.showToast({ title: '已保存', icon: 'success' });
      } catch (error) { uni.showToast({ title: error.message || '保存失败', icon: 'none' }); }
      finally { this.saving = false; }
    }
  }
};
</script>

<style scoped>
.bubble-admin { min-height: 100vh; padding: 30rpx; box-sizing: border-box; background: #f5f5f5; color: #222; }
.state { padding: 60rpx 0; text-align: center; }
.config-card { background: #fff; border-radius: 20rpx; padding: 30rpx; }
.switch-row, .target-picker { display: flex; align-items: center; justify-content: space-between; }
.label { display: block; font-size: 28rpx; margin: 32rpx 0 16rpx; }
.text-input, .target-picker { min-height: 80rpx; padding: 0 20rpx; border: 1rpx solid #ddd; border-radius: 12rpx; font-size: 28rpx; }
.preview { display: flex; align-items: center; gap: 16rpx; min-height: 130rpx; }
.crow { width: 120rpx; height: 98rpx; flex-shrink: 0; }
.save-button { margin-top: 32rpx; background: #000; color: #fff; }
.hint { display: block; margin-top: 24rpx; font-size: 24rpx; line-height: 36rpx; color: #777; }
</style>
