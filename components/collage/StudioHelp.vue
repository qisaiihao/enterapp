<template>
  <StudioIconButton class="studio-help" icon="/static/images/collage-tools/help.png" label="操作说明" @action="showHelp" />
</template>

<script>
import StudioIconButton from './StudioIconButton.vue';

export default {
  name: 'StudioHelp',
  components: { StudioIconButton },
  props: { tab: String },
  methods: {
    showHelp() {
      const guides = {
        cut: {
          title: '裁切纸片',
          content: '框选：单指框出文字，拖动选框或四角调整范围。双指缩放、移动图片。\n手掌按钮：切换单指移动图片；再次点击回到框选。旋转按钮每次旋转 90°。\n选字：点选连续文字，或点“整行”；可选择多段后一次制作多张纸片。\n选择直切、剪纸或撕纸；骰子按钮可以换一种撕边。最后点“加入素材库”保存纸片。'
        },
        library: {
          title: '使用纸片',
          content: '点选纸片后，顶部剪刀左侧会显示加号和垃圾桶，分别用于放到画布和删除选中的纸片。再点一次纸片或点空白处取消选择。剪刀按钮返回裁切。\n“官方纸片”右侧的素材按钮可按分组挑选纸片，选中后加入画布并保存到本机。\n纸片和草稿仅保存在当前设备。卸载应用或清理应用、浏览器数据会移除它们，请及时下载作品。'
        },
        board: {
          title: '拼贴作品',
          content: '点选纸片后拖动，用滑块调整大小和角度。\n两个图层按钮分别将纸片置顶、置底，垃圾桶将纸片移出画布；原素材仍保留。右上角可撤销和重做。\n底纸色块切换背景颜色；画布右下角的加号可以上传背景或选择官方背景。\n下载会保存 900 × 1200 图片；发布会带着图片进入发布页。\n纸片和草稿仅保存在当前设备，清理应用数据会移除它们。'
        }
      };
      const guide = guides[this.tab] || guides.cut;
      uni.showModal({ title: guide.title, content: guide.content, showCancel: false, confirmText: '知道了' });
    }
  }
};
</script>

<style scoped>
.studio-help { width: 36px; height: 40px; opacity: .65; }
</style>
