/**
 * 发布内容相关 API 封装
 */
const { callCloudAndUnwrap } = require('./_shared/cloud-wrapper.js');

function checkDuplicatePoem(title, author, isOriginal, options = {}) {
  if (!title || !title.trim()) {
    return Promise.reject(new Error('标题不能为空'));
  }

  return callCloudAndUnwrap(
    'checkDuplicatePoem',
    {
      title: title.trim(),
      author: author ? author.trim() : '',
      isOriginal: Boolean(isOriginal)
    },
    Object.assign({
      pageTag: 'add',
      requireAuth: true
    }, options),
    '重复检查失败'
  ).then((result) => ({
    isDuplicate: !!result.isDuplicate,
    duplicateCount: result.duplicateCount || 0
  }));
}

function contentAudit(auditData, options = {}) {
  if (!auditData) {
    return Promise.reject(new Error('审核数据不能为空'));
  }

  const payload = {
    ...auditData
  };
  if (typeof payload.content !== 'string') payload.content = '';
  if (typeof payload.title !== 'string') payload.title = '';
  if (!Array.isArray(payload.images) && !Array.isArray(payload.fileIDs)) {
    payload.images = [];
  }

  return callCloudAndUnwrap(
    'contentCheck',
    payload,
    Object.assign({
      pageTag: 'add',
      requireAuth: true
    }, options),
    '内容审核失败'
  );
}

function uploadFile(cloudPath, fileContent, options = {}) {
  if (!cloudPath) {
    return Promise.reject(new Error('文件路径不能为空'));
  }
  if (!fileContent) {
    return Promise.reject(new Error('文件内容不能为空'));
  }

  return callCloudAndUnwrap(
    'upload',
    { cloudPath, fileContent },
    Object.assign({
      pageTag: 'add',
      requireAuth: true
    }, options),
    '上传失败'
  );
}

function saveDraft(draftData, options = {}) {
  if (!draftData) {
    return Promise.reject(new Error('草稿数据不能为空'));
  }
  return callCloudAndUnwrap(
    'getMyProfileData',
    {
      action: 'saveDraft',
      draftData
    },
    Object.assign({
      pageTag: 'add',
      requireAuth: true
    }, options),
    '保存草稿失败'
  );
}

function getDrafts(options = {}) {
  return callCloudAndUnwrap(
    'getMyProfileData',
    { action: 'getDrafts' },
    Object.assign({
      pageTag: 'add',
      requireAuth: true
    }, options),
    '获取草稿失败'
  ).then((result) => result.drafts || []);
}

function deleteDraft(draftId, options = {}) {
  if (!draftId) {
    return Promise.reject(new Error('草稿ID不能为空'));
  }
  return callCloudAndUnwrap(
    'getMyProfileData',
    {
      action: 'deleteDraft',
      draftId
    },
    Object.assign({
      pageTag: 'add',
      requireAuth: true
    }, options),
    '删除草稿失败'
  );
}

function publishPost(postData, options = {}) {
  if (!postData) {
    return Promise.reject(new Error('帖子数据不能为空'));
  }
  if (!postData.content || !postData.content.trim()) {
    return Promise.reject(new Error('content不能为空'));
  }
  if (
    postData.publishMode === 'poem' &&
    !postData.isOriginal &&
    (!postData.author || !postData.author.trim())
  ) {
    return Promise.reject(new Error('非原创诗歌必须提供作者信息'));
  }

  return callCloudAndUnwrap(
    'submitPost',
    postData,
    Object.assign({
      pageTag: 'add',
      requireAuth: true
    }, options),
    '发布失败'
  );
}

module.exports = {
  checkDuplicatePoem,
  contentAudit,
  uploadFile,
  saveDraft,
  getDrafts,
  deleteDraft,
  publishPost
};
