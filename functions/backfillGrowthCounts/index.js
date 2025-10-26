const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();

// Buckets definition (include all posts: visible/hidden/discussion)
// 统一阈值：与前端显示一致 (3/7/15)
const BUCKETS = [
  { key: 'seed', min: 1, max: 3 },
  { key: 'leaf', min: 4, max: 7 },
  { key: 'flower', min: 8, max: 15 },
  { key: 'peach', min: 16, max: Infinity },
];
const bucketOf = (v) => {
  v = typeof v === 'number' ? v : 0;
  if (v < 1) return null;
  for (const b of BUCKETS) {
    if (v >= b.min && v <= b.max) return b.key;
  }
  return null;
};

exports.main = async (event, context) => {
  console.log('[backfillGrowthCounts] start');
  try {
    // fetch all users (only _openid)
    const usersRes = await db.collection('users').field({ _openid: true }).get();
    const users = usersRes.data || [];
    console.log('[backfillGrowthCounts] users:', users.length);

    let updated = 0;
    for (const u of users) {
      const openid = u._openid;
      const counts = { seed: 0, leaf: 0, flower: 0, peach: 0 };

      let skip = 0;
      const limit = 100;
      // include all posts of user
      /* eslint-disable no-constant-condition */
      while (true) {
        const page = await db.collection('posts')
          .where({ _openid: openid })
          .skip(skip)
          .limit(limit)
          .field({ votes: true })
          .get();
        const data = page.data || [];
        for (const p of data) {
          const v = p.votes || 0;
          const b = bucketOf(v);
          if (b) counts[b] += 1;
        }
        if (data.length < limit) break;
        skip += limit;
      }

      await db.collection('users').where({ _openid: openid }).update({
        data: {
          growthCounts: counts,
          growthUpdatedAt: db.serverDate(),
        }
      });
      updated += 1;
    }

    console.log('[backfillGrowthCounts] done, updated:', updated);
    return { success: true, updated };
  } catch (e) {
    console.error('[backfillGrowthCounts] failed:', e);
    return { success: false, message: e.message };
  }
};

