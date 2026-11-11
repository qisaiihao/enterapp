'use strict';

// Continue through unseen poems instead of skipping a fixed number of rows:
// poems recommended on an earlier page must not cause newer poems to be skipped.
async function originalPoems(db, baseFilter, { limit, excludePostIds = [] }) {
  const size = Math.min(50, Math.max(1, Math.floor(Number(limit) || 10)));
  if (!Array.isArray(excludePostIds) || excludePostIds.some(id => typeof id !== 'string' || !id || id.length > 128)) {
    throw new Error('已读诗歌标识无效');
  }
  const used = new Set(excludePostIds);
  const query = () => {
    const conditions = [baseFilter];
    // Keep each exclusion predicate bounded for the database query.
    const ids = [...used];
    for (let index = 0; index < ids.length; index += 100) {
      conditions.push({ _id: db.command.nin(ids.slice(index, index + 100)) });
    }
    return db.collection('posts').aggregate().match({ $and: conditions });
  };
  const collect = rows => rows.filter(row => {
    if (!row || !row._id || used.has(row._id)) return false;
    used.add(row._id);
    return true;
  });
  const hotSize = Math.floor(size / 5), randomSize = Math.floor(size / 5);
  const latest = collect((await query().sort({ createTime: -1, _id: -1 }).limit(size - hotSize - randomSize).end()).list || []);
  let hot = [], random = [];
  if (hotSize) {
    try {
      hot = collect((await query().match({ votes: db.command.gt(0) })
        .sort({ votes: -1, createTime: -1, _id: -1 }).limit(hotSize).end()).list || []);
    } catch (_) {
      console.warn('[original-poems] hot query unavailable; filling with recent poems');
    }
  }
  if (randomSize) {
    try {
      random = collect((await query().sample({ size: randomSize }).end()).list || []);
    } catch (_) {
      console.warn('[original-poems] random query unavailable; filling with recent poems');
    }
  }
  const missing = size - latest.length - hot.length - random.length;
  if (missing > 0) latest.push(...collect((await query().sort({ createTime: -1, _id: -1 }).limit(missing).end()).list || []));

  const posts = [];
  let next = 0, hotIndex = 0, randomIndex = 0;
  while (next < latest.length || hotIndex < hot.length || randomIndex < random.length) {
    posts.push(...latest.slice(next, next + 3)); next += 3;
    if (hotIndex < hot.length) posts.push(hot[hotIndex++]);
    if (randomIndex < random.length) posts.push(random[randomIndex++]);
  }
  return posts;
}

module.exports = { originalPoems };
