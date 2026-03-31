import { callActionAndUnwrap } from './_shared/cloud-wrapper.js';

async function callAdminManager(action, payload = {}, { pageTag, context, fallbackMessage } = {}) {
  return callActionAndUnwrap({
    functionName: 'adminManager',
    action,
    payload,
    pageTag: pageTag || `admin-manager:${action}`,
    context,
    requireAuth: true,
    fallbackMessage: fallbackMessage || '操作失败'
  });
}

function listAdminPosts({ page = 0, pageSize = 20, context } = {}) {
  return callAdminManager(
    'getAllPosts',
    { page, pageSize },
    { pageTag: 'admin-posts', context, fallbackMessage: '加载失败' }
  );
}

function updateAdminPostType({ postId, postType, context } = {}) {
  return callAdminManager(
    'updatePostType',
    { postId, postType },
    { pageTag: 'admin-posts:update-type', context, fallbackMessage: '更新失败' }
  );
}

function deleteAdminPost({ postId, context } = {}) {
  return callAdminManager(
    'deletePost',
    { postId },
    { pageTag: 'admin-posts:delete', context, fallbackMessage: '删除失败' }
  );
}

function listAdminPoets({ offset = 0, limit = 20, context } = {}) {
  return callAdminManager(
    'getPoetList',
    { offset, limit },
    { pageTag: 'admin-poets', context, fallbackMessage: '加载失败' }
  );
}

function deleteAdminPoet({ poetId, context } = {}) {
  return callAdminManager(
    'deletePoet',
    { poetId },
    { pageTag: 'admin-poets:delete', context, fallbackMessage: '删除失败' }
  );
}

function getAdminUserPassword({ query, context } = {}) {
  return callAdminManager(
    'getUserPassword',
    { query },
    { pageTag: 'admin-password-recovery', context, fallbackMessage: '查询失败' }
  );
}

function getBatchReplaceConfig({ context } = {}) {
  return callAdminManager(
    'getBatchReplaceConfig',
    {},
    { pageTag: 'admin-batch-replace:config', context, fallbackMessage: '获取配置失败' }
  );
}

function previewAdminFieldReplace({ collectionName, fieldName, findValue, replaceValue, context } = {}) {
  return callAdminManager(
    'previewFieldReplace',
    { collectionName, fieldName, findValue, replaceValue },
    { pageTag: 'admin-batch-replace:preview', context, fallbackMessage: '预览失败' }
  );
}

function executeAdminFieldReplace({ collectionName, fieldName, findValue, replaceValue, context } = {}) {
  return callAdminManager(
    'executeFieldReplace',
    { collectionName, fieldName, findValue, replaceValue },
    { pageTag: 'admin-batch-replace:execute', context, fallbackMessage: '替换失败' }
  );
}

const adminManagerApi = {
  callAdminManager,
  listAdminPosts,
  updateAdminPostType,
  deleteAdminPost,
  listAdminPoets,
  deleteAdminPoet,
  getAdminUserPassword,
  getBatchReplaceConfig,
  previewAdminFieldReplace,
  executeAdminFieldReplace
};

export {
  callAdminManager,
  listAdminPosts,
  updateAdminPostType,
  deleteAdminPost,
  listAdminPoets,
  deleteAdminPoet,
  getAdminUserPassword,
  getBatchReplaceConfig,
  previewAdminFieldReplace,
  executeAdminFieldReplace
};

export default adminManagerApi;

if (typeof module !== 'undefined' && module.exports) {
  module.exports = adminManagerApi;
  module.exports.default = adminManagerApi;
}
