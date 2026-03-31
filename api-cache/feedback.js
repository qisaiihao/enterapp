/**
 * 反馈相关 API 封装
 */
import { callActionAndUnwrap } from './_shared/cloud-wrapper.js';

async function callFeedbackManager(action, payload = {}, options = {}) {
  const {
    pageTag = 'feedback',
    context,
    requireAuth = false,
    fallbackMessage = '操作失败'
  } = options;

  return callActionAndUnwrap({
    functionName: 'feedbackManager',
    action,
    payload,
    pageTag,
    context,
    requireAuth,
    fallbackMessage
  });
}

/**
 * 提交反馈
 */
function submitFeedback(feedbackData, options = {}) {
  if (!feedbackData || !feedbackData.content || !feedbackData.content.trim()) {
    return Promise.reject(new Error('反馈内容不能为空'));
  }

  const imageUrls = Array.isArray(feedbackData.imageUrls)
    ? feedbackData.imageUrls
    : (Array.isArray(feedbackData.images) ? feedbackData.images : []);

  const params = {
    content: feedbackData.content.trim(),
    imageUrls,
    type: feedbackData.type || 'other',
    images: feedbackData.images || imageUrls,
    contactInfo: feedbackData.contactInfo || {},
    userAgent: feedbackData.userAgent || '',
    timestamp: Date.now()
  };

  return callFeedbackManager('submitFeedback', params, Object.assign({
    pageTag: 'feedback',
    requireAuth: false,
    fallbackMessage: '反馈提交失败'
  }, options));
}

/**
 * 获取反馈列表（管理员）
 */
async function getFeedbackList({ page = 0, pageSize = 20, skip, limit, status = '', type = '', context, ...options } = {}) {
  const safeLimit = Math.max(1, Number(limit || pageSize) || 20);
  const safeSkip = Math.max(0, Number.isFinite(Number(skip)) ? Number(skip) : (Number(page) || 0) * safeLimit);

  const params = {
    skip: safeSkip,
    limit: safeLimit
  };

  if (status) params.status = status;
  if (type) params.type = type;

  return callFeedbackManager('getFeedbackList', params, Object.assign({
    pageTag: 'feedback-admin',
    context,
    requireAuth: true,
    fallbackMessage: '加载失败'
  }, options));
}

/**
 * 更新反馈状态（管理员）
 * 云函数当前仅支持标记为已处理，导出名保持不变以兼容调用方。
 */
function updateFeedbackStatus(feedbackId, status, comment = '', options = {}) {
  if (!feedbackId) {
    return Promise.reject(new Error('反馈ID不能为空'));
  }

  return callFeedbackManager('markAsProcessed', {
    feedbackId,
    status,
    comment
  }, Object.assign({
    pageTag: 'feedback-admin',
    requireAuth: true,
    fallbackMessage: '操作失败'
  }, options));
}

/**
 * 删除反馈（管理员）
 */
function deleteFeedback(feedbackId, options = {}) {
  if (!feedbackId) {
    return Promise.reject(new Error('反馈ID不能为空'));
  }

  return callFeedbackManager('deleteFeedback', {
    feedbackId
  }, Object.assign({
    pageTag: 'feedback-admin',
    requireAuth: true,
    fallbackMessage: '删除失败'
  }, options));
}

/**
 * 获取反馈详情
 */
function getFeedbackDetail(feedbackId, options = {}) {
  if (!feedbackId) {
    return Promise.reject(new Error('反馈ID不能为空'));
  }

  return callFeedbackManager('getFeedbackDetail', {
    feedbackId
  }, Object.assign({
    pageTag: 'feedback-admin',
    requireAuth: true,
    fallbackMessage: '加载失败'
  }, options));
}

const feedbackApi = {
  callFeedbackManager,
  submitFeedback,
  getFeedbackList,
  updateFeedbackStatus,
  deleteFeedback,
  getFeedbackDetail
};

export {
  callFeedbackManager,
  submitFeedback,
  getFeedbackList,
  updateFeedbackStatus,
  deleteFeedback,
  getFeedbackDetail
};

export default feedbackApi;

if (typeof module !== 'undefined' && module.exports) {
  module.exports = feedbackApi;
  module.exports.default = feedbackApi;
}
