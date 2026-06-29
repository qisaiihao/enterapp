import { callActionAndUnwrap } from './_shared/cloud-wrapper.js';

async function callAdminNotice(action, payload = {}, { pageTag, context, fallbackMessage } = {}) {
  return callActionAndUnwrap({
    functionName: 'adminManager',
    action,
    payload,
    pageTag: pageTag || `admin-activity-notice:${action}`,
    context,
    requireAuth: true,
    fallbackMessage: fallbackMessage || '操作失败'
  });
}

async function listAdminActivityNotices({
  skip = 0,
  limit = 20,
  status = '',
  includeDeleted = false,
  context
} = {}) {
  return callAdminNotice(
    'listActivityNotices',
    { skip, limit, status, includeDeleted },
    { pageTag: 'admin-activity-notice-list', context, fallbackMessage: '加载失败' }
  );
}

async function createAdminActivityNotice(payload = {}, { context } = {}) {
  return callAdminNotice(
    'createActivityNotice',
    payload,
    { pageTag: 'admin-activity-notice-create', context, fallbackMessage: '保存失败' }
  );
}

async function updateAdminActivityNotice(payload = {}, { context } = {}) {
  return callAdminNotice(
    'updateActivityNotice',
    payload,
    { pageTag: 'admin-activity-notice-update', context, fallbackMessage: '保存失败' }
  );
}

async function setAdminActivityNoticeStatus({ noticeId, status, context } = {}) {
  return callAdminNotice(
    'setActivityNoticeStatus',
    { noticeId, status },
    { pageTag: 'admin-activity-notice-status', context, fallbackMessage: '更新失败' }
  );
}

async function deleteAdminActivityNotice({ noticeId, context } = {}) {
  return callAdminNotice(
    'deleteActivityNotice',
    { noticeId },
    { pageTag: 'admin-activity-notice-delete', context, fallbackMessage: '删除失败' }
  );
}

const adminActivityNoticesApi = {
  listAdminActivityNotices,
  createAdminActivityNotice,
  updateAdminActivityNotice,
  setAdminActivityNoticeStatus,
  deleteAdminActivityNotice
};

export {
  listAdminActivityNotices,
  createAdminActivityNotice,
  updateAdminActivityNotice,
  setAdminActivityNoticeStatus,
  deleteAdminActivityNotice
};

export default adminActivityNoticesApi;
