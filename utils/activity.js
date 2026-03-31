const ACTIVITY_STATUS_OPTIONS = Object.freeze([
  { value: 'draft', label: '草稿' },
  { value: 'published', label: '发布' },
  { value: 'archived', label: '归档' }
]);

function decodeParamSafe(value) {
  if (typeof value !== 'string') return '';
  try {
    return decodeURIComponent(value);
  } catch (error) {
    return value;
  }
}

function parseDate(input) {
  if (!input) return null;
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

function formatDateYmd(input, fallback = '--') {
  const date = parseDate(input);
  if (!date) return fallback;
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function formatRange(startTime, endTime, fallback = '--') {
  return `${formatDateYmd(startTime, fallback)} ~ ${formatDateYmd(endTime, fallback)}`;
}

function isActivityOngoing(startTime, endTime, nowTs = Date.now()) {
  const start = parseDate(startTime);
  const end = parseDate(endTime);
  if (!start || !end) return false;
  return start.getTime() <= nowTs && end.getTime() >= nowTs;
}

function getActivityStatusLabel(status, fallback = '未知') {
  const option = ACTIVITY_STATUS_OPTIONS.find((item) => item.value === status);
  return option ? option.label : fallback;
}

const activityUtils = {
  ACTIVITY_STATUS_OPTIONS,
  decodeParamSafe,
  formatDateYmd,
  formatRange,
  isActivityOngoing,
  getActivityStatusLabel
};

export {
  ACTIVITY_STATUS_OPTIONS,
  decodeParamSafe,
  formatDateYmd,
  formatRange,
  isActivityOngoing,
  getActivityStatusLabel
};

export default activityUtils;

if (typeof module !== 'undefined' && module.exports) {
  module.exports = activityUtils;
  module.exports.default = activityUtils;
}
