const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();

const { isAdminByPoemId } = require('./_lib/admin-auth');
const DEFAULT_SOURCE_OPENID = 'anonymous_1760806464645';
const DEFAULT_TARGET_OPENID = 'ojYBd1zhoZmBs4XrvqaBHXQoetYw';
const QUERY_LIMIT = 100;
const SAMPLE_LIMIT = 10;

exports.main = async (event, context) => {
  event = event || {};

  const wxContext = cloud.getWXContext();
  const operatorOpenid = getOperatorOpenid(event, wxContext);

  if (!operatorOpenid) {
    return {
      success: false,
      message: '无法获取操作人 openid'
    };
  }

  const hasAdminPermission = await isAdmin(operatorOpenid);
  if (!hasAdminPermission) {
    return {
      success: false,
      message: '权限不足，仅管理员可执行该操作'
    };
  }

  const sourceOpenid = event.sourceOpenid || event.fromOpenid || DEFAULT_SOURCE_OPENID;
  const targetOpenid = event.targetOpenid || event.toOpenid || DEFAULT_TARGET_OPENID;
  const dryRun = event.dryRun !== false;
  const replaceFollowerId = event.replaceFollowerId !== false;
  const replaceFollowedId = event.replaceFollowedId !== false;
  const dedupe = event.dedupe !== false;

  if (!sourceOpenid || !targetOpenid) {
    return {
      success: false,
      message: 'sourceOpenid 和 targetOpenid 不能为空'
    };
  }

  if (sourceOpenid === targetOpenid) {
    return {
      success: false,
      message: 'sourceOpenid 和 targetOpenid 不能相同'
    };
  }

  if (!replaceFollowerId && !replaceFollowedId) {
    return {
      success: false,
      message: 'replaceFollowerId 和 replaceFollowedId 不能同时为 false'
    };
  }

  try {
    const result = {
      success: true,
      dryRun,
      operatorOpenid,
      sourceOpenid,
      targetOpenid,
      options: {
        replaceFollowerId,
        replaceFollowedId,
        dedupe
      },
      matched: {
        followerId: 0,
        followedId: 0,
        total: 0
      },
      updated: {
        followerId: 0,
        followedId: 0,
        total: 0
      },
      deduplicated: 0,
      samples: {
        followerId: [],
        followedId: [],
        removedDuplicates: []
      }
    };

    if (dryRun) {
      if (replaceFollowerId) {
        const preview = await previewFieldReplacement('followerId', sourceOpenid);
        result.matched.followerId = preview.count;
        result.samples.followerId = preview.samples;
      }

      if (replaceFollowedId) {
        const preview = await previewFieldReplacement('followedId', sourceOpenid);
        result.matched.followedId = preview.count;
        result.samples.followedId = preview.samples;
      }

      result.matched.total = result.matched.followerId + result.matched.followedId;
      result.message = '预览完成，未写入数据库';
      return result;
    }

    if (replaceFollowerId) {
      const followerResult = await replaceFieldValue('followerId', sourceOpenid, targetOpenid);
      result.matched.followerId = followerResult.matched;
      result.updated.followerId = followerResult.updated;
      result.samples.followerId = followerResult.samples;
    }

    if (replaceFollowedId) {
      const followedResult = await replaceFieldValue('followedId', sourceOpenid, targetOpenid);
      result.matched.followedId = followedResult.matched;
      result.updated.followedId = followedResult.updated;
      result.samples.followedId = followedResult.samples;
    }

    result.matched.total = result.matched.followerId + result.matched.followedId;
    result.updated.total = result.updated.followerId + result.updated.followedId;

    if (dedupe) {
      const dedupeResult = await removeDuplicateFollows(targetOpenid);
      result.deduplicated = dedupeResult.removed;
      result.samples.removedDuplicates = dedupeResult.samples;
    }

    result.message = '修复完成';
    return result;
  } catch (error) {
    console.error('fixFollowsOpenid 执行失败:', error);
    return {
      success: false,
      message: '修复失败',
      error: error.message
    };
  }
};

function getOperatorOpenid(event, wxContext) {
  if (wxContext && wxContext.OPENID) {
    return wxContext.OPENID;
  }

  if (event && event.userInfo) {
    return event.userInfo.openId || event.userInfo.openid || '';
  }

  return (event && event.openid) || '';
}

async function isAdmin(openid) {
  return isAdminByPoemId({ db, command: db.command, openid, loggerPrefix: 'fixFollowsOpenid' });
}

async function previewFieldReplacement(fieldName, sourceOpenid) {
  const [countRes, sampleRes] = await Promise.all([
    db.collection('follows').where({
      [fieldName]: sourceOpenid
    }).count(),
    db.collection('follows').where({
      [fieldName]: sourceOpenid
    }).limit(SAMPLE_LIMIT).get()
  ]);

  return {
    count: countRes.total || 0,
    samples: sampleRes.data || []
  };
}

async function replaceFieldValue(fieldName, sourceOpenid, targetOpenid) {
  let matched = 0;
  let updated = 0;
  const samples = [];

  while (true) {
    const batchRes = await db.collection('follows').where({
      [fieldName]: sourceOpenid
    }).limit(QUERY_LIMIT).get();

    const docs = batchRes.data || [];
    if (docs.length === 0) {
      break;
    }

    matched += docs.length;

    docs.forEach((doc) => {
      if (samples.length < SAMPLE_LIMIT) {
        samples.push(doc);
      }
    });

    const updateTasks = docs.map((doc) => db.collection('follows').doc(doc._id).update({
      data: {
        [fieldName]: targetOpenid,
        updateTime: new Date()
      }
    }));

    const updateResults = await Promise.all(updateTasks);
    updated += updateResults.reduce((total, item) => total + ((item.stats && item.stats.updated) || 0), 0);

    if (docs.length < QUERY_LIMIT) {
      break;
    }
  }

  return {
    matched,
    updated,
    samples
  };
}

async function removeDuplicateFollows(targetOpenid) {
  const relatedDocs = await listTargetRelatedFollows(targetOpenid);
  const pairMap = new Map();
  const duplicateDocIds = [];

  relatedDocs.forEach((doc) => {
    const pairKey = `${doc.followerId}::${doc.followedId}`;
    if (!pairMap.has(pairKey)) {
      pairMap.set(pairKey, []);
    }
    pairMap.get(pairKey).push(doc);
  });

  pairMap.forEach((docs) => {
    if (docs.length <= 1) {
      return;
    }

    docs.sort(compareFollowDocs);
    docs.slice(1).forEach((doc) => duplicateDocIds.push(doc._id));
  });

  if (duplicateDocIds.length === 0) {
    return {
      removed: 0,
      samples: []
    };
  }

  const removeTasks = duplicateDocIds.map((docId) => db.collection('follows').doc(docId).remove());
  await Promise.all(removeTasks);

  return {
    removed: duplicateDocIds.length,
    samples: duplicateDocIds.slice(0, SAMPLE_LIMIT)
  };
}

async function listTargetRelatedFollows(targetOpenid) {
  const docMap = new Map();

  let followerSkip = 0;
  while (true) {
    const followerRes = await db.collection('follows').where({
      followerId: targetOpenid
    }).skip(followerSkip).limit(QUERY_LIMIT).get();

    const docs = followerRes.data || [];
    docs.forEach((doc) => docMap.set(doc._id, doc));

    if (docs.length < QUERY_LIMIT) {
      break;
    }

    followerSkip += QUERY_LIMIT;
  }

  let followedSkip = 0;
  while (true) {
    const followedRes = await db.collection('follows').where({
      followedId: targetOpenid
    }).skip(followedSkip).limit(QUERY_LIMIT).get();

    const docs = followedRes.data || [];
    docs.forEach((doc) => docMap.set(doc._id, doc));

    if (docs.length < QUERY_LIMIT) {
      break;
    }

    followedSkip += QUERY_LIMIT;
  }

  return Array.from(docMap.values());
}

function compareFollowDocs(leftDoc, rightDoc) {
  const leftTime = normalizeTimestamp(leftDoc.createTime || leftDoc.updateTime);
  const rightTime = normalizeTimestamp(rightDoc.createTime || rightDoc.updateTime);

  if (leftTime !== rightTime) {
    return leftTime - rightTime;
  }

  return String(leftDoc._id).localeCompare(String(rightDoc._id));
}

function normalizeTimestamp(value) {
  if (!value) {
    return 0;
  }

  const date = value instanceof Date ? value : new Date(value);
  const time = date.getTime();
  return Number.isNaN(time) ? 0 : time;
}
