export const ACTIVITY_NOTICE_LINK_OPTIONS = [
  { label: '不跳转', url: '' },
  { label: '周刊首页', url: '/pages-content/weekly-home/weekly-home' },
  { label: '活动列表', url: '/pages-content/activity-list/activity-list' },
  { label: '联系我们', url: '/pages-tools/contact/contact' },
  { label: '诗歌广场', url: '/pages/poem-square/poem-square' },
  { label: '个人主页', url: '/pages/profile/profile' }
];

export function normalizeActivityNoticeLink(value) {
  if (typeof value !== 'string') return '';
  const url = value.trim();
  if (!url || url.length > 2048 || /[\s\\\u0000-\u001f\u007f]/.test(url)) return '';
  if (/^https?:\/\/[^/?#@]+(?:[/?#].*)?$/i.test(url)) return url;
  if (/^\/(?:pages|pages-[a-z-]+)\/[a-zA-Z0-9_/-]+(?:\?[^#]*)?$/.test(url)) return url;
  return '';
}

export function openActivityNoticeLink(value) {
  const url = normalizeActivityNoticeLink(value);
  if (!url) return Promise.resolve(false);
  if (/^https?:\/\//i.test(url)) {
    // #ifdef H5
    window.location.assign(url);
    return Promise.resolve(true);
    // #endif
    // #ifndef H5
    return navigate('navigateTo', `/pages-tools/web-link/web-link?url=${encodeURIComponent(url)}`);
    // #endif
  }
  const pagePath = url.split('?')[0];
  const tabPages = ['/pages/index/index', '/pages/mountain/mountain', '/pages/poem-square/poem-square', '/pages/profile/profile'];
  return tabPages.includes(pagePath) ? navigate('switchTab', pagePath) : navigate('navigateTo', url);
}

function navigate(method, url) {
  return new Promise(resolve => {
    uni[method]({
      url,
      success: () => resolve(true),
      fail: () => {
        uni.showToast({ title: '暂时无法打开此链接', icon: 'none' });
        resolve(false);
      }
    });
  });
}
