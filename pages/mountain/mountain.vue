<template><view /><app-overlay-host /></template>

<script>
export default {
  onLoad() {
    uni.setStorageSync('poemFeed:openMode', 'reading');
    uni.switchTab({ url: '/pages/poem-square/poem-square' });
  }
};
</script>
