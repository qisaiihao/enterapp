import { createActionCaller } from './_shared/cloud-wrapper.js';

const callFollowAction = createActionCaller({
  functionName: 'follow',
  pageTagPrefix: 'relation:follow',
  requireAuth: true,
  defaultFallbackMessage: '操作失败'
});

const callBlockAction = createActionCaller({
  functionName: 'block',
  pageTagPrefix: 'relation:block',
  requireAuth: true,
  defaultFallbackMessage: '操作失败'
});

function mapListResult(result) {
  return {
    list: Array.isArray(result.list) ? result.list : [],
    total: typeof result.total === 'number' ? result.total : 0,
    hasMore: !!result.hasMore
  };
}

async function getFollowingList({ page = 0, pageSize = 20, context } = {}) {
  const result = await callFollowAction('getFollowingList', {
    skip: page * pageSize,
    limit: pageSize
  }, {
    pageTag: 'relation:get-following',
    context,
    fallbackMessage: '加载失败'
  });

  return mapListResult(result);
}

async function getFollowerList({ page = 0, pageSize = 20, context } = {}) {
  const result = await callFollowAction('getFollowerList', {
    skip: page * pageSize,
    limit: pageSize
  }, {
    pageTag: 'relation:get-followers',
    context,
    fallbackMessage: '加载失败'
  });

  return mapListResult(result);
}

async function toggleFollowRelation({ targetOpenid, context, pageTag } = {}) {
  if (!targetOpenid) {
    throw new Error('目标用户ID不能为空');
  }

  const result = await callFollowAction('toggleFollow', {
    targetOpenid
  }, {
    pageTag: pageTag || 'relation:toggle-follow',
    context,
    fallbackMessage: '操作失败'
  });

  return {
    isFollowing: !!result.isFollowing,
    isMutual: !!result.isMutual
  };
}

async function checkFollowRelation({ targetOpenid, context, pageTag } = {}) {
  if (!targetOpenid) {
    throw new Error('目标用户ID不能为空');
  }

  const result = await callFollowAction('checkFollow', {
    targetOpenid
  }, {
    pageTag: pageTag || 'relation:check-follow',
    context,
    fallbackMessage: '查询失败'
  });

  return {
    isFollowing: !!result.isFollowing,
    isFollower: !!result.isFollower,
    isMutual: !!result.isMutual
  };
}

async function markFollowNotificationsRead({ context } = {}) {
  const result = await callFollowAction('markFollowNotificationsRead', {}, {
    pageTag: 'relation:mark-follow-read',
    context,
    fallbackMessage: '操作失败'
  });

  return {
    updated: typeof result.updated === 'number' ? result.updated : 0
  };
}

async function getFollowCounts({ targetOpenid, context, pageTag } = {}) {
  const result = await callFollowAction('getFollowCounts', {
    targetOpenid
  }, {
    pageTag: pageTag || 'relation:get-follow-counts',
    context,
    fallbackMessage: '查询失败'
  });

  return {
    followingCount: typeof result.followingCount === 'number' ? result.followingCount : 0,
    followerCount: typeof result.followerCount === 'number' ? result.followerCount : 0
  };
}

async function getBlockedList({ page = 0, pageSize = 20, context } = {}) {
  const result = await callBlockAction('getBlockedList', {
    skip: page * pageSize,
    limit: pageSize
  }, {
    pageTag: 'relation:get-blocked',
    context,
    fallbackMessage: '加载失败'
  });

  return mapListResult(result);
}

async function toggleBlockRelation({ targetOpenid, context, pageTag } = {}) {
  if (!targetOpenid) {
    throw new Error('目标用户ID不能为空');
  }

  const result = await callBlockAction('toggleBlock', {
    targetOpenid
  }, {
    pageTag: pageTag || 'relation:toggle-block',
    context,
    fallbackMessage: '操作失败'
  });

  return {
    isBlocked: !!result.isBlocked
  };
}

async function checkBlockRelation({ targetOpenid, context, pageTag } = {}) {
  if (!targetOpenid) {
    throw new Error('目标用户ID不能为空');
  }

  const result = await callBlockAction('checkBlock', {
    targetOpenid
  }, {
    pageTag: pageTag || 'relation:check-block',
    context,
    fallbackMessage: '查询失败'
  });

  return {
    isBlocked: !!result.isBlocked
  };
}

const relationApi = {
  getFollowingList,
  getFollowerList,
  toggleFollowRelation,
  checkFollowRelation,
  markFollowNotificationsRead,
  getFollowCounts,
  getBlockedList,
  toggleBlockRelation,
  checkBlockRelation
};

export {
  getFollowingList,
  getFollowerList,
  toggleFollowRelation,
  checkFollowRelation,
  markFollowNotificationsRead,
  getFollowCounts,
  getBlockedList,
  toggleBlockRelation,
  checkBlockRelation
};

export default relationApi;

if (typeof module !== 'undefined' && module.exports) {
  module.exports = relationApi;
  module.exports.default = relationApi;
}
