import { callActionAndUnwrap } from './_shared/cloud-wrapper.js';

function submitPostReport(payload, context) {
  return callActionAndUnwrap({
    functionName: 'adminManager', action: 'submitPostReport', payload,
    pageTag: 'post-report:submit', context, requireAuth: true,
    fallbackMessage: '举报提交失败'
  });
}

function listPostReports({ status = 'pending', skip = 0, limit = 20, context } = {}) {
  return callActionAndUnwrap({
    functionName: 'adminManager', action: 'listPostReports',
    payload: { status, skip, limit }, pageTag: 'post-report:admin-list',
    context, requireAuth: true, fallbackMessage: '加载举报失败'
  });
}

function resolvePostReport({ reportId, decision, context } = {}) {
  return callActionAndUnwrap({
    functionName: 'adminManager', action: 'resolvePostReport',
    payload: { reportId, decision }, pageTag: 'post-report:admin-resolve',
    context, requireAuth: true, fallbackMessage: '处理举报失败'
  });
}

function getPostReport({ reportId, context } = {}) {
  return callActionAndUnwrap({
    functionName: 'adminManager', action: 'getPostReport',
    payload: { reportId }, pageTag: 'post-report:admin-detail',
    context, requireAuth: true, fallbackMessage: '加载举报详情失败'
  });
}

function listModerationReviews({ status = 'pending', skip = 0, limit = 20, context } = {}) {
  return callActionAndUnwrap({
    functionName: 'adminManager', action: 'listModerationReviews',
    payload: { status, skip, limit }, pageTag: 'content-review:admin-list',
    context, requireAuth: true, fallbackMessage: '加载拦截复核失败'
  });
}

function getModerationReview({ reviewId, context } = {}) {
  return callActionAndUnwrap({
    functionName: 'adminManager', action: 'getModerationReview',
    payload: { reviewId }, pageTag: 'content-review:admin-detail',
    context, requireAuth: true, fallbackMessage: '加载复核详情失败'
  });
}

function resolveModerationReview({ reviewId, decision, note = '', context } = {}) {
  return callActionAndUnwrap({
    functionName: 'adminManager', action: 'resolveModerationReview',
    payload: { reviewId, decision, note }, pageTag: 'content-review:admin-resolve',
    context, requireAuth: true, fallbackMessage: '处理拦截复核失败'
  });
}

export {
  submitPostReport, listPostReports, getPostReport, resolvePostReport,
  listModerationReviews, getModerationReview, resolveModerationReview
};
