// TODO: AI推荐算法暂时停用
// 诗歌内容驱动的推荐（不依赖标签）
// 复用前后端分离：前端通过 cloudCall 访问本函数
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;
const $ = _.aggregate;

// 配置：候选池与行为权重
const USE_EMBEDDING = true; // 开启后优先使用预计算/实时生成的向量，缺失时自动回退 bigram
const CANDIDATE_LIMIT = 80; // 避免一次性拉取过多，缩小超时风险
const RETURN_LIMIT_DEFAULT = 10;
const INTERACTION_LIMIT = 20; // 最近多少条行为
const EMBEDDING_MAX_INTERACTIONS = 3;
const EMBEDDING_MAX_CANDIDATES = 5;
const ENABLE_EMBEDDING_GENERATION = false; // 默认不在推荐请求中生成 embedding（由预计算任务补齐）
const ACTION_WEIGHT = {
  vote: 1.5,
  view: 1.0,
  longView: 1.2
};

// ---------- 文本/向量工具 ----------
function bigrams(text = '') {
  const clean = String(text || '')
    .replace(/\s+/g, '')
    .replace(/[^\u4e00-\u9fa5a-zA-Z0-9]/g, '');
  const out = [];
  for (let i = 0; i < clean.length - 1; i += 1) {
    out.push(clean.slice(i, i + 2));
  }
  return out;
}

// 将数组向量转 Map，便于与 bigram Map 共用余弦函数
function embeddingArrayToMap(arr = []) {
  const map = new Map();
  arr.forEach((v, i) => {
    const num = Number(v);
    if (!Number.isNaN(num)) map.set(i, num);
  });
  return map;
}

function getPostVector(post) {
  // 优先使用 embedding 字段；缺失则回退 bigram
  if (USE_EMBEDDING && Array.isArray(post.embedding) && post.embedding.length) {
    return embeddingArrayToMap(post.embedding);
  }
  const grams = bigrams(post.content || '');
  const map = new Map();
  grams.forEach((g) => map.set(g, (map.get(g) || 0) + 1));
  return map;
}

function toProfileVector(posts = [], interactions = []) {
  const vec = new Map();
  const now = Date.now();
  interactions.forEach((ia) => {
    const weight =
      ia.interactionType === 'vote'
        ? ACTION_WEIGHT.vote
        : ia.duration && ia.duration >= 20000
          ? ACTION_WEIGHT.longView
          : ACTION_WEIGHT.view;
    const ts = ia.createTime ? new Date(ia.createTime).getTime() : now;
    const recency = Math.exp(-(now - ts) / (1000 * 60 * 60 * 24 * 7)); // 7天衰减
    const post = posts.find((p) => p._id === ia.postId);
    if (!post || !post.content) return;
    const pVec = getPostVector(post);
    pVec.forEach((v, k) => {
      const prev = vec.get(k) || 0;
      vec.set(k, prev + v * weight * recency);
    });
  });
  return vec;
}

function cosineSim(vecA, vecB) {
  if (!vecA.size || !vecB.size) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  vecA.forEach((va, k) => {
    normA += va * va;
    const vb = vecB.get(k);
    if (vb) dot += va * vb;
  });
  vecB.forEach((vb) => {
    normB += vb * vb;
  });
  if (!normA || !normB) return 0;
  return dot / Math.sqrt(normA * normB);
}

function recencyScore(ts) {
  const now = Date.now();
  const time = ts ? new Date(ts).getTime() : now;
  return Math.exp(-(now - time) / (1000 * 60 * 60 * 24 * 5)); // 5天半衰
}

function hotScore(post) {
  const votes = Number(post.votes || 0);
  const comments = Number(post.commentCount || 0);
  return votes * 2 + comments * 5;
}

// ---------- 嵌入填充（缺失时生成并写回） ----------
async function ensureEmbeddings(posts = [], maxGenerate = 20, stats, generationEnabled) {
  const canGenerate = typeof generationEnabled === 'boolean' ? generationEnabled : ENABLE_EMBEDDING_GENERATION;
  if (stats) {
    stats.total = posts.length;
    stats.maxGenerate = maxGenerate;
    stats.generationEnabled = canGenerate;
    stats.useEmbedding = USE_EMBEDDING;
  }
  if (!USE_EMBEDDING) {
    console.log('[poem-reco] ensureEmbeddings: disabled', { total: posts.length });
    if (stats) stats.reason = 'disabled';
    return posts;
  }
  const missing = posts.filter(p => !Array.isArray(p.embedding) || p.embedding.length === 0).slice(0, maxGenerate);
  console.log('[poem-reco] ensureEmbeddings: check', {
    total: posts.length,
    missing: missing.length,
    maxGenerate,
    generationEnabled: canGenerate
  });
  if (stats) stats.missing = missing.length;
  if (!missing.length) {
    console.log('[poem-reco] ensureEmbeddings: all have embedding', { total: posts.length });
    if (stats) stats.reason = 'no_missing';
    return posts;
  }
  if (!canGenerate) {
    console.log('[poem-reco] ensureEmbeddings: generation disabled', {
      total: posts.length,
      missing: missing.length
    });
    if (stats) stats.reason = 'generation_disabled';
    return posts;
  }
  console.log('[poem-reco] ensureEmbeddings: missing embeddings', {
    total: posts.length,
    missing: missing.length,
    maxGenerate
  });

  const texts = missing.map(p => p.content || '');
  try {
    const callStart = Date.now();
    console.log('[poem-reco] embedText call:start', { count: texts.length });
    if (stats) stats.called = true;
    const res = await cloud.callFunction({
      name: 'embedText',
      data: { texts }
    });
    const embeddings = (res && res.result && res.result.embeddings) || [];
    const dim = (res && res.result && res.result.dim) || (embeddings[0] ? embeddings[0].length : 0);
    const elapsedMs = Date.now() - callStart;
    console.log('[poem-reco] embedText call:done', {
      embeddings: embeddings.length,
      dim,
      elapsedMs
    });
    if (stats) {
      stats.embeddingsReturned = embeddings.length;
      stats.dim = dim;
      stats.elapsedMs = elapsedMs;
    }
    let generatedCount = 0;
    let writeBackCount = 0;
    await Promise.all(
      missing.map(async (post, idx) => {
        const emb = embeddings[idx];
        if (Array.isArray(emb) && emb.length) {
          generatedCount += 1;
          post.embedding = emb;
          // 尝试写回，失败不影响主流程
          try {
            await db.collection('posts').doc(post._id).update({
              data: { embedding: emb }
            });
            writeBackCount += 1;
          } catch (e) {
            console.error('[ensureEmbeddings] write back failed', post._id, e);
          }
        }
      })
    );
    console.log('[poem-reco] ensureEmbeddings: generated', {
      generated: generatedCount,
      writeBack: writeBackCount
    });
    if (stats) {
      stats.generated = generatedCount;
      stats.writeBack = writeBackCount;
    }
  } catch (e) {
    console.error('[ensureEmbeddings] embedText call failed', e);
    if (stats) stats.error = String(e);
  }
  return posts;
}

// ---------- 核心逻辑 ----------
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const openid = event.openid || wxContext.OPENID;
  const {
    limit = RETURN_LIMIT_DEFAULT,
    skip = 0,
    excludePostIds = [],
    timeRangeDays = 60
  } = event || {};

  if (!openid) {
    return { success: false, code: 'NO_OPENID', message: '无法获取用户身份' };
  }

  try {
    const debugEmbedding = !!(event && event.debugEmbedding);
    const allowEmbeddingGeneration = !!(event && event.allowEmbeddingGeneration);
    const embeddingStats = debugEmbedding ? { interactions: {}, candidates: {} } : null;

    // 屏蔽列表
    let blockedUserIds = [];
    try {
      const getBlockedUserIds = require('../_lib/get-blocked-user-ids');
      blockedUserIds = await getBlockedUserIds(openid, db);
    } catch (err) {
      console.error('[getPoemContentFeed] blocked list failed', err);
    }

    // 1) 最近互动
    const interactions = await loadInteractions(openid);
    const interactedIds = interactions.map((i) => i.postId);

    // 2) 拉取互动诗文，构建用户画像
    let interactedPosts = await fetchPostsByIds(interactedIds);
    interactedPosts = await ensureEmbeddings(
      interactedPosts,
      EMBEDDING_MAX_INTERACTIONS,
      embeddingStats ? embeddingStats.interactions : null,
      allowEmbeddingGeneration
    );
    const interactedWithEmbedding = interactedPosts.filter(p => Array.isArray(p.embedding) && p.embedding.length).length;
    console.log('[poem-reco] interactions embedding stats', {
      total: interactedPosts.length,
      withEmbedding: interactedWithEmbedding
    });
    const profileVec = toProfileVector(interactedPosts, interactions);

    // 如果没有画像，走兜底最新+热门
    const isColdStart = profileVec.size === 0;

    // 3) 候选集：最近 timeRangeDays 的诗歌
    let candidates = await fetchCandidatePosts({
      excludePostIds: [...excludePostIds, ...interactedIds],
      blockedUserIds,
      limit: CANDIDATE_LIMIT,
      timeRangeDays
    });
    candidates = await ensureEmbeddings(
      candidates,
      EMBEDDING_MAX_CANDIDATES,
      embeddingStats ? embeddingStats.candidates : null,
      allowEmbeddingGeneration
    );
    const candidatesWithEmbedding = candidates.filter(p => Array.isArray(p.embedding) && p.embedding.length).length;
    console.log('[poem-reco] candidates embedding stats', {
      total: candidates.length,
      withEmbedding: candidatesWithEmbedding,
      isColdStart
    });

    let scored = [];
    if (!isColdStart) {
      scored = candidates.map((post) => {
        const vec = getPostVector(post);
        const sim = cosineSim(profileVec, vec);
        const rec = recencyScore(post.createTime);
        const hot = hotScore(post);
        // 归一化热度（粗略）
        const normHot = hot ? Math.log(1 + hot) / 10 : 0;
        const score = 0.6 * sim + 0.2 * rec + 0.2 * normHot;
        return { post, score, sim, rec, normHot };
      });
    } else {
      // 冷启动：按新鲜度+热度
      scored = candidates.map((post) => {
        const rec = recencyScore(post.createTime);
        const normHot = hotScore(post) ? Math.log(1 + hotScore(post)) / 10 : 0;
        const score = 0.5 * rec + 0.5 * normHot;
        return { post, score, sim: 0, rec, normHot };
      });
    }

    scored.sort((a, b) => b.score - a.score);
    const sliced = scored.slice(skip, skip + limit);
    const posts = await processPostsData(
      sliced.map((s) => ({
        ...s.post,
        recommendationType: 'content_based',
        recommendationReason: isColdStart
          ? '为你推荐最新/热门的诗'
          : '基于你最近读/赞过的诗句相似',
        similarity: Number(s.sim || 0)
      }))
    );

    return {
      success: true,
      posts,
      total: posts.length,
      hasMore: scored.length > skip + limit,
      ...(embeddingStats ? { debug: { embedding: embeddingStats } } : {})
    };
  } catch (err) {
    console.error('[getPoemContentFeed] failed', err);
    return { success: false, message: '内容推荐失败', error: String(err) };
  }
};

// ---------- 数据加载 ----------
async function loadInteractions(openid) {
  const voteRes = await db
    .collection('votes_log')
    .where({ _openid: openid, type: 'post' })
    .orderBy('createTime', 'desc')
    .limit(INTERACTION_LIMIT)
    .get();

  // view_events 记录了 duration；view_log 没有 duration
  const viewEventRes = await db
    .collection('view_events')
    .where({ _openid: openid })
    .orderBy('ts', 'desc')
    .limit(INTERACTION_LIMIT)
    .get()
    .catch(() => ({ data: [] }));

  const viewLogRes = await db
    .collection('view_log')
    .where({ _openid: openid, type: 'view' })
    .orderBy('createTime', 'desc')
    .limit(INTERACTION_LIMIT)
    .get()
    .catch(() => ({ data: [] }));

  const interactions = [
    ...voteRes.data.map((i) => ({
      ...i,
      interactionType: 'vote',
      createTime: i.createTime
    })),
    ...viewEventRes.data.map((i) => ({
      ...i,
      interactionType: 'view',
      createTime: i.ts,
      duration: i.duration
    })),
    ...viewLogRes.data.map((i) => ({
      ...i,
      interactionType: 'view',
      createTime: i.createTime
    }))
  ];

  // 去重按 postId，保留最新
  const latestByPost = new Map();
  interactions.forEach((ia) => {
    if (!ia.postId) return;
    const existing = latestByPost.get(ia.postId);
    const ts = ia.createTime ? new Date(ia.createTime).getTime() : 0;
    if (!existing || ts > existing.ts) {
      latestByPost.set(ia.postId, { ...ia, ts });
    }
  });

  return Array.from(latestByPost.values())
    .sort((a, b) => b.ts - a.ts)
    .slice(0, INTERACTION_LIMIT);
}

async function fetchPostsByIds(ids = []) {
  if (!ids.length) return [];
  const batches = [];
  const CHUNK = 50;
  for (let i = 0; i < ids.length; i += CHUNK) {
    batches.push(ids.slice(i, i + CHUNK));
  }
  const results = [];
  for (const chunk of batches) {
    const res = await db
      .collection('posts')
      .where({ _id: _.in(chunk), isPoem: true })
      .field({
        _id: true,
        content: true,
        title: true,
        createTime: true,
        votes: true,
        commentCount: true,
        imageUrl: true,
        imageUrls: true,
        originalImageUrl: true,
        originalImageUrls: true,
        authorAvatar: true,
        poemBgImage: true,
        _openid: true,
        realAuthorOpenid: true,
        isOriginal: true,
        isPoem: true,
        isSeries: true,
        seriesBlocks: true,
        seriesBlockCount: true,
        highlightLines: true,
        embedding: true
      })
      .get();
    results.push(...(res.data || []));
  }
  return results;
}

async function fetchCandidatePosts({ excludePostIds, blockedUserIds, limit, timeRangeDays }) {
  const match = {
    isPoem: true
  };

  if (excludePostIds && excludePostIds.length) {
    match._id = _.nin(excludePostIds);
  }

  if (Array.isArray(blockedUserIds) && blockedUserIds.length) {
    match.$and = [
      { _openid: _.nin(blockedUserIds) },
      {
        $or: [
          { realAuthorOpenid: _.exists(false) },
          { realAuthorOpenid: _.eq(null) },
          { realAuthorOpenid: _.nin(blockedUserIds) }
        ]
      }
    ];
  }

  if (timeRangeDays && timeRangeDays > 0) {
    const since = new Date(Date.now() - timeRangeDays * 24 * 60 * 60 * 1000);
    match.createTime = _.gte(since);
  }

  const res = await db
    .collection('posts')
    .where(match)
    .orderBy('createTime', 'desc')
    .limit(limit)
    .field({
      _id: true,
      content: true,
      title: true,
      createTime: true,
      votes: true,
      commentCount: true,
      imageUrl: true,
      imageUrls: true,
      originalImageUrl: true,
      originalImageUrls: true,
      authorAvatar: true,
      poemBgImage: true,
      _openid: true,
      realAuthorOpenid: true,
      isOriginal: true,
      isPoem: true,
      isSeries: true,
      seriesBlocks: true,
      seriesBlockCount: true,
      highlightLines: true,
      embedding: true
    })
    .get();

  return res.data || [];
}

// ---------- 资源处理（与现有 getRecommendationFeed 一致） ----------
async function processPostsData(posts) {
  if (!posts || !posts.length) return [];

  const fileIDs = new Set();
  posts.forEach((post) => {
    if (!Array.isArray(post.imageUrls)) post.imageUrls = post.imageUrls ? [post.imageUrls] : [];
    if (!Array.isArray(post.originalImageUrls))
      post.originalImageUrls = post.originalImageUrls ? [post.originalImageUrls] : [];

    const urlsToCheck = [
      ...post.imageUrls,
      ...post.originalImageUrls,
      post.imageUrl,
      post.originalImageUrl,
      post.authorAvatar,
      post.poemBgImage
    ].filter((url) => url && url.startsWith && url.startsWith('cloud://'));

    urlsToCheck.forEach((url) => fileIDs.add(url));
  });

  if (fileIDs.size > 0) {
    try {
      const fileListResult = await cloud.getTempFileURL({ fileList: Array.from(fileIDs) });
      const urlMap = new Map();
      fileListResult.fileList.forEach((item) => {
        if (item.status === 0) {
          urlMap.set(item.fileID, item.tempFileURL);
        }
      });

      posts.forEach((post) => {
        const convertUrl = (url) => urlMap.get(url) || url;

        if (post.imageUrl) post.imageUrl = convertUrl(post.imageUrl);
        if (post.originalImageUrl) post.originalImageUrl = convertUrl(post.originalImageUrl);
        if (post.authorAvatar) post.authorAvatar = convertUrl(post.authorAvatar);
        if (post.poemBgImage) post.poemBgImage = convertUrl(post.poemBgImage);

        if (Array.isArray(post.imageUrls)) {
          post.imageUrls = post.imageUrls.map(convertUrl);
        }
        if (Array.isArray(post.originalImageUrls)) {
          post.originalImageUrls = post.originalImageUrls.map(convertUrl);
        }
      });
    } catch (err) {
      console.error('[getPoemContentFeed] temp URL convert failed', err);
    }
  }

  return posts;
}
