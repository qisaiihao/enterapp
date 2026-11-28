import { formatErrorForLog } from '@/utils/error-log.js';
import { hasAcceptedPrivacyConsent } from '@/utils/privacyConsent.js';

const DETAIL_PAGE = 'pages/post-detail/post-detail';
const STARTUP_PAGES = ['pages/splash/splash', 'pages-user/profile-setup/profile-setup'];
let pendingPostId = '';
let opening = false;

export function queuePoemWidgetDetail(postId) {
  pendingPostId = postId;
  openPendingPoemWidgetDetail();
}

export function openPendingPoemWidgetDetail({ replaceStartup = false, onFail } = {}) {
  if (!pendingPostId || opening || !hasAcceptedPrivacyConsent()) return false;

  const pages = getCurrentPages();
  const page = pages[pages.length - 1];
  if (!replaceStartup && (!page || STARTUP_PAGES.includes(page.route))) return false;

  const postId = pendingPostId;
  pendingPostId = '';
  if (page?.route === DETAIL_PAGE && (page.$page?.options || page.options)?.id === postId) return true;

  opening = true;
  const options = {
    url: `/${DETAIL_PAGE}?id=${encodeURIComponent(postId)}`,
    success: () => {
      opening = false;
      openPendingPoemWidgetDetail();
    },
    fail: (error) => {
      opening = false;
      if (replaceStartup) {
        pendingPostId ||= postId;
        onFail(error);
        return;
      }
      console.warn(`[App] open poem widget detail failed: ${formatErrorForLog(error)}`);
      uni.showToast({ title: '诗歌详情打开失败', icon: 'none' });
      openPendingPoemWidgetDetail();
    }
  };
  if (replaceStartup) uni.reLaunch(options);
  else uni.navigateTo(options);
  return true;
}
