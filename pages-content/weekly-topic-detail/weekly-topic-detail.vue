<template>
  <WeeklyFeatureDetailView
    :detail="detail"
    fallback-url="/pages-content/weekly-topic-submission/weekly-topic-submission"
  />
</template>

<script>
import WeeklyFeatureDetailView from '@/components/weekly/WeeklyFeatureDetailView.vue';
import { getWeeklyTopicDetail } from '@/api-cache/weekly.js';

function createEmptyDetail() {
  return {
    title: '',
    authorName: '',
    authorAvatar: '',
    authorSignature: '',
    workCount: 0,
    posts: []
  };
}

export default {
  components: { WeeklyFeatureDetailView },
  data() {
    return {
      detailId: '',
      detail: createEmptyDetail()
    };
  },
  onLoad(options = {}) {
    this.detailId = options.id || '';
    this.detail = createEmptyDetail();
    this.loadDetail();
  },
  methods: {
    async loadDetail() {
      const result = await getWeeklyTopicDetail({ id: this.detailId, context: this });
      if (result && result.detail) {
        this.detail = result.detail;
      }
    }
  }
};
</script>
