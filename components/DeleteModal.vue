<template>
  <AppActionSheet :visible="visible" :title="title" :items="items" variant="plain"
    @cancel="$emit('close')" @select="onSelect" />
</template>
<script>
import AppActionSheet from '@/components/overlay/AppActionSheet.vue';
export default {
  name: 'DeleteModal',
  components: { AppActionSheet },
  emits: ['close', 'save-draft', 'hide', 'confirm'],
  props: {
    visible: Boolean,
    title: { type: String, default: '删除帖子' },
    isHidden: Boolean,
    showDraft: { type: Boolean, default: true }
  },
  computed: {
    items() {
      const items = [];
      if (this.showDraft) items.push({ text: '删除并存为草稿', event: 'save-draft' });
      items.push({
        text: this.isHidden ? '已仅自己可见' : '仅自己可见',
        description: '保留作品且仅自己可见',
        event: 'hide', disabled: this.isHidden
      });
      items.push({ text: '删除帖子', description: '将永久删除，无法找回', event: 'confirm', danger: true });
      return items;
    }
  },
  methods: {
    onSelect(index) {
      const item = this.items[index];
      if (item && !item.disabled) this.$emit(item.event);
    }
  }
};
</script>
