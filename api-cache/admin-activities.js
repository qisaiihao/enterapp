const { callActionAndUnwrap } = require('./_shared/cloud-wrapper.js');

async function callAdminActivity(action, payload = {}, { pageTag, context, fallbackMessage } = {}) {
  return callActionAndUnwrap({
    functionName: 'adminManager',
    action,
    payload,
    pageTag: pageTag || `admin-activity:${action}`,
    context,
    requireAuth: true,
    fallbackMessage: fallbackMessage || '操作失败'
  });
}

async function listAdminActivities({
  skip = 0,
  limit = 20,
  status = '',
  includeDeleted = false,
  context
} = {}) {
  return callAdminActivity(
    'listActivities',
    { skip, limit, status, includeDeleted },
    { pageTag: 'admin-activity-management', context, fallbackMessage: '加载失败' }
  );
}

async function getAdminActivityDetail({ activityId, context } = {}) {
  return callAdminActivity(
    'getActivityDetail',
    { activityId },
    { pageTag: 'admin-activity-detail', context, fallbackMessage: '加载失败' }
  );
}

async function createAdminActivity(payload = {}, { context } = {}) {
  return callAdminActivity(
    'createActivity',
    payload,
    { pageTag: 'admin-activity-create', context, fallbackMessage: '保存失败' }
  );
}

async function updateAdminActivity(payload = {}, { context } = {}) {
  return callAdminActivity(
    'updateActivity',
    payload,
    { pageTag: 'admin-activity-update', context, fallbackMessage: '保存失败' }
  );
}

async function setAdminActivityStatus({ activityId, status, context } = {}) {
  return callAdminActivity(
    'setActivityStatus',
    { activityId, status },
    { pageTag: 'admin-activity-status', context, fallbackMessage: '更新失败' }
  );
}

async function deleteAdminActivity({ activityId, context } = {}) {
  return callAdminActivity(
    'deleteActivity',
    { activityId },
    { pageTag: 'admin-activity-delete', context, fallbackMessage: '删除失败' }
  );
}

module.exports = {
  callAdminActivity,
  listAdminActivities,
  getAdminActivityDetail,
  createAdminActivity,
  updateAdminActivity,
  setAdminActivityStatus,
  deleteAdminActivity
};
