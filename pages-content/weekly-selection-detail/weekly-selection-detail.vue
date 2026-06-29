<template>
  <WeeklyFeatureDetailView
    :detail="detail"
    fallback-url="/pages-content/weekly-selection/weekly-selection"
  />
</template>

<script>
import WeeklyFeatureDetailView from '@/components/weekly/WeeklyFeatureDetailView.vue';
import { getWeeklyIssueDetail } from '@/api-cache/weekly.js';

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
      const result = await getWeeklyIssueDetail({
        id: this.detailId,
        context: this,
        forceRefresh: true,
        recordView: true
      });
      if (result && result.detail) {
        this.detail = result.detail;
      }
    }
  }
};
</script>
