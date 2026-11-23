<template><view /><app-overlay-host /></template>

<script>
export default {
  onLoad() {
    uni.switchTab({ url: '/pages/activity/activity' });
  }
};
</script>
