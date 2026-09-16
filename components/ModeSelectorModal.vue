<template>
    <AppActionSheet :visible="show" title="选择发布模式" :items="items" :is-dark="isDark"
        @cancel="$emit('close')" @select="onSelect" />
</template>

<script>
import AppActionSheet from '@/components/overlay/AppActionSheet.vue';

export default {
    name: 'ModeSelectorModal',
    components: { AppActionSheet },
    emits: ['close', 'select'],
    props: {
        show: Boolean,
        publishMode: { type: String, default: 'normal' },
        isOriginal: Boolean,
        isSeries: Boolean,
        isDark: { type: Boolean, default: null }
    },
    computed: {
        items() {
            const modes = [
                { text: '原创诗歌', mode: 'poem', isOriginal: true },
                { text: '非原创诗歌', mode: 'poem', isOriginal: false }
            ];
            if (!this.isSeries) modes.push(
                { text: '普通帖子', mode: 'normal', isOriginal: null },
                { text: '讨论帖子', mode: 'discussion', isOriginal: null }
            );
            return modes.map(item => ({
                ...item,
                description: this.publishMode === item.mode && (item.mode !== 'poem' || this.isOriginal === item.isOriginal)
                    ? '当前模式' : ''
            }));
        }
    },
    methods: {
        onSelect(index) {
            const { mode, isOriginal } = this.items[index];
            this.$emit('select', { mode, isOriginal });
        }
    }
};
</script>
