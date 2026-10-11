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

export { submitPostReport, listPostReports, getPostReport, resolvePostReport };
