import { callActionAndUnwrap } from './_shared/cloud-wrapper.js';

async function callAdminWeekly(action, payload = {}, { pageTag, context, fallbackMessage } = {}) {
  return callActionAndUnwrap({
    functionName: 'adminManager',
    action,
    payload,
    pageTag: pageTag || `admin-weekly:${action}`,
    context,
    requireAuth: true,
    fallbackMessage: fallbackMessage || '操作失败'
  });
}

function listAdminWeeklyIssues({ skip = 0, limit = 20, status = '', context } = {}) {
  return callAdminWeekly(
    'listWeeklyIssues',
    { skip, limit, status },
    { pageTag: 'admin-weekly-issues', context, fallbackMessage: '加载周刊失败' }
  );
}

function createAdminWeeklyIssue(payload = {}, { context } = {}) {
  return callAdminWeekly(
    'createWeeklyIssue',
    payload,
    { pageTag: 'admin-weekly-create-issue', context, fallbackMessage: '保存周刊失败' }
  );
}

function updateAdminWeeklyIssue(payload = {}, { context } = {}) {
  return callAdminWeekly(
    'updateWeeklyIssue',
    payload,
    { pageTag: 'admin-weekly-update-issue', context, fallbackMessage: '更新周刊失败' }
  );
}

function publishAdminWeeklyIssue({ issueId, context } = {}) {
  return callAdminWeekly(
    'publishWeeklyIssue',
    { issueId },
    { pageTag: 'admin-weekly-publish-issue', context, fallbackMessage: '发布周刊失败' }
  );
}

function archiveAdminWeeklyIssue({ issueId, context } = {}) {
  return callAdminWeekly(
    'archiveWeeklyIssue',
    { issueId },
    { pageTag: 'admin-weekly-archive-issue', context, fallbackMessage: '归档周刊失败' }
  );
}

function deleteAdminWeeklyIssue({ issueId, context } = {}) {
  return callAdminWeekly(
    'deleteWeeklyIssue',
    { issueId },
    { pageTag: 'admin-weekly-delete-issue', context, fallbackMessage: '删除周刊失败' }
  );
}

function generateAdminWeeklyRanking({ issueId = '', periodStart = '', periodEnd = '', limit = 10, context } = {}) {
  return callAdminWeekly(
    'generateWeeklyRanking',
    { issueId, periodStart, periodEnd, limit },
    { pageTag: 'admin-weekly-ranking', context, fallbackMessage: '生成热榜失败' }
  );
}

function listAdminWeeklyCandidatePosts({ skip = 0, limit = 20, keyword = '', context } = {}) {
  return callAdminWeekly(
    'listWeeklyCandidatePosts',
    { skip, limit, keyword },
    { pageTag: 'admin-weekly-candidates', context, fallbackMessage: '加载候选作品失败' }
  );
}

function listAdminWeeklyTopics({ skip = 0, limit = 20, status = '', context } = {}) {
  return callAdminWeekly(
    'listWeeklyTopics',
    { skip, limit, status },
    { pageTag: 'admin-weekly-topics', context, fallbackMessage: '加载主题失败' }
  );
}

function createAdminWeeklyTopic(payload = {}, { context } = {}) {
  return callAdminWeekly(
    'createWeeklyTopic',
    payload,
    { pageTag: 'admin-weekly-create-topic', context, fallbackMessage: '保存主题失败' }
  );
}

function updateAdminWeeklyTopic(payload = {}, { context } = {}) {
  return callAdminWeekly(
    'updateWeeklyTopic',
    payload,
    { pageTag: 'admin-weekly-update-topic', context, fallbackMessage: '更新主题失败' }
  );
}

function publishAdminWeeklyTopic({ topicId, context } = {}) {
  return callAdminWeekly(
    'publishWeeklyTopic',
    { topicId },
    { pageTag: 'admin-weekly-publish-topic', context, fallbackMessage: '发布主题失败' }
  );
}

function archiveAdminWeeklyTopic({ topicId, context } = {}) {
  return callAdminWeekly(
    'archiveWeeklyTopic',
    { topicId },
    { pageTag: 'admin-weekly-archive-topic', context, fallbackMessage: '归档主题失败' }
  );
}

const adminWeeklyApi = {
  callAdminWeekly,
  listAdminWeeklyIssues,
  createAdminWeeklyIssue,
  updateAdminWeeklyIssue,
  publishAdminWeeklyIssue,
  archiveAdminWeeklyIssue,
  deleteAdminWeeklyIssue,
  generateAdminWeeklyRanking,
  listAdminWeeklyCandidatePosts,
  listAdminWeeklyTopics,
  createAdminWeeklyTopic,
  updateAdminWeeklyTopic,
  publishAdminWeeklyTopic,
  archiveAdminWeeklyTopic
};

export {
  callAdminWeekly,
  listAdminWeeklyIssues,
  createAdminWeeklyIssue,
  updateAdminWeeklyIssue,
  publishAdminWeeklyIssue,
  archiveAdminWeeklyIssue,
  deleteAdminWeeklyIssue,
  generateAdminWeeklyRanking,
  listAdminWeeklyCandidatePosts,
  listAdminWeeklyTopics,
  createAdminWeeklyTopic,
  updateAdminWeeklyTopic,
  publishAdminWeeklyTopic,
  archiveAdminWeeklyTopic
};

export default adminWeeklyApi;
