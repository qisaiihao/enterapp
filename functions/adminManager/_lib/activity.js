const ACTIVITY_STATUSES = ['draft', 'published', 'archived'];

function normalizeDateInput(value) {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

function normalizeStatus(status) {
  return ACTIVITY_STATUSES.includes(status) ? status : null;
}

function normalizeSortWeight(value, fallback = 0) {
  if (value === undefined || value === null || value === '') return fallback;
  const num = Number(value);
  if (Number.isNaN(num)) return fallback;
  return num;
}

function normalizeActivityRules(value, maxLength = 5000) {
  return String(value || '')
    .replace(/\r\n/g, '\n')
    .trim()
    .slice(0, maxLength);
}

function isActivityOngoing(startTime, endTime, nowTs = Date.now()) {
  const startMs = startTime ? new Date(startTime).getTime() : 0;
  const endMs = endTime ? new Date(endTime).getTime() : 0;
  return startMs > 0 && endMs > 0 && startMs <= nowTs && endMs >= nowTs;
}

function buildAdminActivityView(activity = {}) {
  return {
    ...activity,
    summary: typeof activity.summary === 'string' ? activity.summary : '',
    rules: typeof activity.rules === 'string' ? activity.rules : '',
    postCount: Number(activity.postCount) || 0,
    isOngoing: isActivityOngoing(activity.startTime, activity.endTime)
  };
}

function buildPublicActivityView(activity = {}, { includeRules = false } = {}) {
  const view = {
    _id: activity._id,
    title: activity.title || '',
    summary: activity.summary || '',
    coverImage: activity.coverImage || '',
    startTime: activity.startTime || null,
    endTime: activity.endTime || null,
    status: activity.status || '',
    sortWeight: Number(activity.sortWeight) || 0,
    postCount: Number(activity.postCount) || 0,
    lastPostTime: activity.lastPostTime || null,
    createdBy: activity.createdBy || '',
    createdAt: activity.createdAt || null,
    updatedAt: activity.updatedAt || null,
    isDeleted: activity.isDeleted === true,
    isOngoing: isActivityOngoing(activity.startTime, activity.endTime)
  };

  if (includeRules) {
    view.rules = typeof activity.rules === 'string' ? activity.rules : '';
  }

  return view;
}

module.exports = {
  ACTIVITY_STATUSES,
  normalizeDateInput,
  normalizeStatus,
  normalizeSortWeight,
  normalizeActivityRules,
  isActivityOngoing,
  buildAdminActivityView,
  buildPublicActivityView
};
