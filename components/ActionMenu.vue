<template>
  <AppActionSheet :visible="visible" title="帖子操作" :items="items" variant="plain"
    @cancel="$emit('close')" @select="onSelect" />
</template>
<script>
import AppActionSheet from '@/components/overlay/AppActionSheet.vue';
export default {
  name: 'ActionMenu',
  components: { AppActionSheet },
  emits: ['close', 'edit', 'compose-series', 'toggle-visibility', 'delete'],
  props: { visible: Boolean, isHidden: Boolean },
  computed: {
    items() {
      return [
        { text: '编辑', event: 'edit' },
        { text: '组诗合成', event: 'compose-series' },
        { text: this.isHidden ? '取消隐藏' : '隐藏', event: 'toggle-visibility' },
        { text: '删除该动态', event: 'delete' }
      ];
    }
  },
  methods: { onSelect(index) { this.$emit(this.items[index].event); } }
};
</script>
