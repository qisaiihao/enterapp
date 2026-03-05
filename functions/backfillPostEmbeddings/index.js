// TODO: AI推荐算法暂时停用
// 定时任务：批量补齐帖子的 embedding 字段
const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;
const STATE_COLLECTION = 'system_config';
const STATE_DOC_ID = 'embedding_backfill_cursor';

function hasEmbedding(post) {
  return Array.isArray(post.embedding) && post.embedding.length > 0;
}

exports.main = async (event, context) => {
  const {
    cursor,
    batchSize = 10,
    onlyPoem = true,
    dryRun = false
  } = event || {};

  let effectiveCursor = cursor;
  if (!effectiveCursor) {
    try {
      const stateRes = await db.collection(STATE_COLLECTION).doc(STATE_DOC_ID).get();
      if (stateRes && stateRes.data && stateRes.data.cursor) {
        effectiveCursor = stateRes.data.cursor;
      }
    } catch (e) {
      console.warn('[backfillPostEmbeddings] load cursor failed', e && e.message ? e.message : e);
    }
  }

  const match = {};
  if (onlyPoem) match.isPoem = true;
  if (effectiveCursor) match._id = _.gt(effectiveCursor);

  const res = await db
    .collection('posts')
    .where(match)
    .orderBy('_id', 'asc')
    .limit(batchSize)
    .field({
      _id: true,
      content: true,
      embedding: true
    })
    .get();

  const posts = res.data || [];
  if (!posts.length) {
    return {
      success: true,
      done: true,
      nextCursor: null,
      processed: 0,
      missing: 0,
      embedded: 0
    };
  }

  const missing = posts.filter((p) => !hasEmbedding(p) && p.content && String(p.content).trim());
  const texts = missing.map((p) => p.content || '');

  let embeddings = [];
  if (!dryRun && missing.length > 0) {
    const callRes = await cloud.callFunction({
      name: 'embedText',
      data: { texts }
    });
    embeddings = (callRes && callRes.result && callRes.result.embeddings) || [];
  }

  let writeCount = 0;
  if (!dryRun && embeddings.length > 0) {
    const tasks = missing.map((post, idx) => {
      const emb = embeddings[idx];
      if (!Array.isArray(emb) || emb.length === 0) return null;
      writeCount += 1;
      return db.collection('posts').doc(post._id).update({
        data: { embedding: emb }
      });
    }).filter(Boolean);
    if (tasks.length > 0) {
      await Promise.all(tasks);
    }
  }

  const nextCursor = posts[posts.length - 1]._id;
  if (!dryRun) {
    try {
      await db.collection(STATE_COLLECTION).doc(STATE_DOC_ID).set({
        data: {
          cursor: nextCursor,
          updatedAt: new Date(),
          onlyPoem,
          batchSize
        }
      });
    } catch (e) {
      console.warn('[backfillPostEmbeddings] save cursor failed', e && e.message ? e.message : e);
    }
  }

  return {
    success: true,
    done: posts.length < batchSize,
    nextCursor,
    processed: posts.length,
    missing: missing.length,
    embedded: writeCount
  };
};
