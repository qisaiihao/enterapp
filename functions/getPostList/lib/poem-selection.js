'use strict';

function unseenPoemQuery(db, baseFilter, { limit, excludePostIds = [] }) {
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
  return { query, size, used };
}

async function randomPoems(db, baseFilter, options) {
  const { query, size } = unseenPoemQuery(db, baseFilter, options);
  return (await query().sample({ size }).end()).list || [];
}

// Continue through unseen poems so recommendations do not skip newer poems.
async function originalPoems(db, baseFilter, options) {
  const { query, size, used } = unseenPoemQuery(db, baseFilter, options);
  const collect = rows => rows.filter(row => {
    if (!row || !row._id || used.has(row._id)) return false;
    used.add(row._id);
    return true;
  });
  const randomSize = Math.floor(size / 5) * 2;
  const latest = collect((await query().sort({ createTime: -1, _id: -1 }).limit(size - randomSize).end()).list || []);
  let random = [];
  if (randomSize) {
    try {
      random = collect((await query().sample({ size: randomSize }).end()).list || []);
    } catch (_) {
      console.warn('[original-poems] random query unavailable; filling with recent poems');
    }
  }
  const missing = size - latest.length - random.length;
  if (missing > 0) latest.push(...collect((await query().sort({ createTime: -1, _id: -1 }).limit(missing).end()).list || []));

  const posts = [];
  let latestIndex = 0, randomIndex = 0;
  while (latestIndex < latest.length || randomIndex < random.length) {
    posts.push(...latest.slice(latestIndex, latestIndex + 3), ...random.slice(randomIndex, randomIndex + 2));
    latestIndex += 3;
    randomIndex += 2;
  }
  return posts;
}

module.exports = { originalPoems, randomPoems };
