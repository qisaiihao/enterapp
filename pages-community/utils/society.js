export const SOCIETY_AVATAR = '/pages-community/static/images/society-raven.png';
export const SOCIETY_TABS = [
  { value: 'news', label: '动态' }, { value: 'works', label: '作品' },
  { value: 'events', label: '活动' }, { value: 'calls', label: '征稿' }, { value: 'about', label: '关于' }
];
export const MANAGE_TABS = [
  { value: 'news', label: '动态管理' }, { value: 'events', label: '活动管理' },
  { value: 'calls', label: '征稿管理' }, { value: 'members', label: '成员管理' }
];
export const APPLICATION_LABELS = { pending: '审核中', approved: '已通过', rejected: '待修改' };
export const ROLE_LABELS = { owner: '负责人', admin: '管理员', member: '成员' };
export const RECRUITMENT_LABELS = { open: '成员公开招募', school: '仅限本校学生' };
export const RECRUITMENT_OPTIONS = [{ value: 'open', label: RECRUITMENT_LABELS.open }, { value: 'school', label: RECRUITMENT_LABELS.school }];
export const CALL_SCOPE_LABELS = { all: '公开征稿', school: '仅限本校', members: '限本诗社' };
export const CALL_SCOPE_OPTIONS = [{ value: 'all', label: CALL_SCOPE_LABELS.all }, { value: 'school', label: CALL_SCOPE_LABELS.school }, { value: 'members', label: CALL_SCOPE_LABELS.members }];

export function societyUrl(page, params = {}) {
  const query = Object.entries(params).filter(([, value]) => value !== undefined && value !== null && value !== '')
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`).join('&');
  return `/pages-community/${page}/${page}${query ? `?${query}` : ''}`;
}
export function openSocietyPage(page, params) { uni.navigateTo({ url: societyUrl(page, params) }); }
export function openSocietyLogin() { uni.navigateTo({ url: '/pages/login/login' }); }
export function decodeSocietyParam(value) {
  try { return decodeURIComponent(String(value || '')); } catch (_) { return ''; }
}
export function societyDate(value, fallback = '') {
  if (!value) return fallback;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return fallback;
  return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')}`;
}
export function showSocietyError(error) {
  uni.showToast({ title: error?.message || '操作失败，请重试', icon: 'none' });
}
