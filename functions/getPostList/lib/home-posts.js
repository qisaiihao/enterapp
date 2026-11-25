'use strict';

const NORMAL_POST_BOOST_MS = 24 * 60 * 60 * 1000;

async function rankedHomePosts(query, { skip = 0, limit }) {
  const result = await query.addFields({
    homeSortTime: {
      $add: [
        { $ifNull: ['$createTime', new Date(0)] },
        { $cond: [
          { $and: [
            { $ne: [{ $ifNull: ['$isPoem', false] }, true] },
            { $ne: [{ $ifNull: ['$isDiscussion', false] }, true] }
          ] },
          NORMAL_POST_BOOST_MS,
          0
        ] }
      ]
    }
  }).sort({ homeSortTime: -1, createTime: -1, _id: -1 }).skip(skip).limit(limit).end();
  return (result.list || []).map(({ homeSortTime, ...post }) => post);
}

function validPostIds(ids) {
  return Array.isArray(ids) ? ids.filter(id => typeof id === 'string' && id.length > 0 && id.length <= 128) : [];
}

async function sampleHomePosts(query, { limit }) {
  const result = await query.sample({ size: limit }).end();
  return result.list || [];
}

function homePostCandidates(db, baseFilter, { limit, excludePostIds, previousPostIds }) {
  const size = Math.min(50, Math.max(1, Math.floor(Number(limit) || 10)));
  const used = new Set(validPostIds(excludePostIds));
  const previous = validPostIds(previousPostIds).slice(0, 10);
  const query = (repeatPreviousOnly = false) => {
    const ids = [...new Set(repeatPreviousOnly ? used : [...used, ...previous])];
    const conditions = [baseFilter];
    if (repeatPreviousOnly) conditions.push({ _id: db.command.in(previous) });
    for (let index = 0; index < ids.length; index += 100) {
      conditions.push({ _id: db.command.nin(ids.slice(index, index + 100)) });
    }
    return db.collection('posts').aggregate().match({ $and: conditions });
  };
  const fillFromPrevious = async (posts, selectPosts) => {
    const missing = size - posts.length;
    if (missing <= 0 || !previous.length) return posts;
    posts.forEach(post => used.add(post._id));
    const repeats = await selectPosts(query(true), { limit: missing });
    return posts.concat(repeats);
  };
  return { size, used, query, fillFromPrevious };
}

async function randomHomePosts(db, baseFilter, options) {
  const { size, query, fillFromPrevious } = homePostCandidates(db, baseFilter, options);
  const posts = await sampleHomePosts(query(), { limit: size });
  return fillFromPrevious(posts, sampleHomePosts);
}

async function mixedHomePosts(db, baseFilter, options) {
  const { size, used, query, fillFromPrevious } = homePostCandidates(db, baseFilter, options);
  const groups = Math.floor(size / 10);
  const latestSize = size - groups * 4;
  const latest = await rankedHomePosts(query(), { limit: latestSize });
  if (latest.length < latestSize || !groups) return fillFromPrevious(latest, rankedHomePosts);
  latest.forEach(post => used.add(post._id));

  let hot = [];
  let random = [];
  try {
    const result = await query().match({ votes: db.command.gt(0) })
      .sort({ votes: -1, createTime: -1, _id: -1 }).limit(groups).end();
    hot = result.list || [];
    hot.forEach(post => used.add(post._id));
  } catch (error) {
    console.warn('[getPostList] 广场高赞查询失败，使用其他帖子补齐', error);
  }
  try {
    random = await sampleHomePosts(query(), { limit: groups * 3 });
    random.forEach(post => used.add(post._id));
  } catch (error) {
    console.warn('[getPostList] 广场随机抽样失败，使用其他帖子补齐', error);
  }

  const missing = size - latest.length - hot.length - random.length;
  if (missing > 0) latest.push(...await rankedHomePosts(query(), { limit: missing }));

  const posts = [];
  for (let group = 0; group < groups; group++) {
    const start = group * 6;
    const sample = group * 3;
    posts.push(latest[start], latest[start + 1], random[sample], latest[start + 2], hot[group],
      latest[start + 3], random[sample + 1], latest[start + 4], random[sample + 2], latest[start + 5]);
  }
  return fillFromPrevious(posts.concat(latest.slice(groups * 6)).filter(Boolean), rankedHomePosts);
}

module.exports = { rankedHomePosts, mixedHomePosts, randomHomePosts };
