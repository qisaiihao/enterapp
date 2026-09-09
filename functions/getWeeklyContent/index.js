const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()
const _ = db.command
const $ = _.aggregate

const ISSUE_COLLECTION = 'weekly_issues'
const TOPIC_COLLECTION = 'weekly_topics'
const ISSUE_VIEW_COLLECTION = 'weekly_issue_views'
const WEEKLY_CONFIG_COLLECTION = 'weekly_configs'
const WEEKLY_FEATURED_CONFIG_DOC_ID = 'featured_issues'
const WEEKLY_RANKING_LIMIT = 10
const WEEKLY_RANKING_WINDOW_MS = 7 * 24 * 60 * 60 * 1000

function isCollectionMissing(error) {
  const message = String((error && (error.errMsg || error.message)) || '')
  return error && (error.errCode === -502005 || message.includes('collection not exists') || message.includes('collection not exist'))
}

function safeNumber(value, fallback = 0) {
  const num = Number(value)
  return Number.isFinite(num) ? num : fallback
}

function getMapNumber(map, key, fallback = 0) {
  return map && map.has(key) ? safeNumber(map.get(key), fallback) : fallback
}

function formatDate(value) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}${m}${d}`
}

function formatDateRange(start, end, fallback = '') {
  const s = formatDate(start)
  const e = formatDate(end)
  return s && e ? `${s}-${e}` : fallback
}

function normalizeDateValue(value) {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

function getWeeklyPeriodBounds(periodStart, periodEnd) {
  const start = normalizeDateValue(periodStart)
  const end = normalizeDateValue(periodEnd)
  if (!start || !end) return null
  const safeStart = new Date(start)
  const safeEnd = new Date(end)
  safeStart.setHours(0, 0, 0, 0)
  safeEnd.setHours(23, 59, 59, 999)
  if (safeEnd.getTime() < safeStart.getTime()) return null
  return { start: safeStart, end: safeEnd }
}

function normalizeSnapshot(post = {}, index = 0) {
  const votes = safeNumber(post.votes)
  const comments = safeNumber(post.comments || post.commentCount)
  const views = safeNumber(post.views || post.viewCount)
  const content = String(post.content || '')
  const imageUrls = Array.isArray(post.imageUrls)
    ? post.imageUrls
    : (post.imageUrl ? [post.imageUrl] : [])
  const originalImageUrls = Array.isArray(post.originalImageUrls)
    ? post.originalImageUrls
    : (post.originalImageUrl ? [post.originalImageUrl] : [])
  const copy = String(post.copy || content || post.title || 'poem content pending')
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean)
    .slice(0, 6)
    .join('\n')

  return {
    postId: post.postId || post._id || '',
    isOriginal: post.isOriginal !== false,
    rank: safeNumber(post.rank, index + 1),
    title: post.title || 'Untitled',
    content,
    copy,
    authorName: post.authorName || post.author || '匿名用户',
    authorAvatar: post.authorAvatar || '',
    authorSignature: post.authorSignature || '',
    backgroundColor: post.backgroundColor || '',
    textColor: post.textColor || '',
    imageUrl: post.imageUrl || post.poemBgImage || imageUrls[0] || '',
    imageUrls,
    originalImageUrl: post.originalImageUrl || originalImageUrls[0] || '',
    originalImageUrls,
    poemBgImage: post.poemBgImage || '',
    votes,
    comments,
    views,
    score: safeNumber(post.score, votes * 3 + comments * 2 + views),
    createTime: post.createTime || null
  }
}

function summarizeSnapshots(snapshots = []) {
  return snapshots.reduce((acc, item) => {
    acc.views += safeNumber(item.views)
    acc.likes += safeNumber(item.votes)
    acc.comments += safeNumber(item.comments)
    return acc
  }, { views: 0, likes: 0, comments: 0 })
}

function getSnapshotPostId(snapshot = {}) {
  return snapshot.postId || snapshot._id || snapshot.id || ''
}

function getIssuePostIds(issue = {}) {
  const fromIds = Array.isArray(issue.featuredPostIds) ? issue.featuredPostIds : []
  const fromSnapshots = Array.isArray(issue.featuredSnapshots)
    ? issue.featuredSnapshots.map(getSnapshotPostId)
    : []
  const fromRanking = Array.isArray(issue.rankingSnapshot)
    ? issue.rankingSnapshot.map(getSnapshotPostId)
    : []
  return Array.from(new Set([...fromIds, ...fromSnapshots, ...fromRanking].filter(Boolean)))
}

function getTopicPostIds(topic = {}) {
  const fromIds = Array.isArray(topic.selectedPostIds) ? topic.selectedPostIds : []
  const fromSnapshots = Array.isArray(topic.selectedSnapshots)
    ? topic.selectedSnapshots.map(getSnapshotPostId)
    : []
  return Array.from(new Set([...fromIds, ...fromSnapshots].filter(Boolean)))
}

function getPostStats(post = {}) {
  return {
    votes: safeNumber(post.votes),
    comments: safeNumber(post.commentCount || post.comments),
    views: safeNumber(post.views || post.viewCount || post.viewScore)
  }
}

function normalizePostIds(postIds = [], max = 200) {
  return Array.from(new Set((postIds || []).filter(Boolean))).slice(0, max)
}

async function getCachedPostStatsMap(postIds = []) {
  const ids = normalizePostIds(postIds)
  const statsMap = new Map()
  if (!ids.length) return statsMap

  for (let index = 0; index < ids.length; index += 100) {
    const chunk = ids.slice(index, index + 100)
    const res = await db.collection('posts')
      .where({
        _id: _.in(chunk)
      })
      .field({
        _id: true,
        votes: true,
        comments: true,
        commentCount: true,
        views: true,
        viewCount: true,
        viewScore: true,
        imageUrl: true,
        imageUrls: true,
        originalImageUrl: true,
        originalImageUrls: true,
        poemBgImage: true
      })
      .get()
    ;(res.data || []).forEach(post => {
      statsMap.set(post._id, getPostStats(post))
    })
  }

  return statsMap
}

async function aggregatePostCountMap(collectionName, postIds = [], extraMatch = {}) {
  const ids = normalizePostIds(postIds)
  const countMap = new Map()
  if (!ids.length) return countMap

  for (let index = 0; index < ids.length; index += 100) {
    const chunk = ids.slice(index, index + 100)
    const res = await db.collection(collectionName).aggregate()
      .match({
        ...extraMatch,
        postId: _.in(chunk)
      })
      .group({
        _id: '$postId',
        count: $.sum(1)
      })
      .end()
    ;(res.list || []).forEach(item => {
      if (item && item._id) {
        countMap.set(item._id, safeNumber(item.count))
      }
    })
  }

  return countMap
}

async function safeAggregatePostCountMap(collectionName, postIds = [], extraMatch = {}) {
  try {
    return {
      ok: true,
      map: await aggregatePostCountMap(collectionName, postIds, extraMatch)
    }
  } catch (error) {
    if (!isCollectionMissing(error)) {
      console.warn(`[getWeeklyContent] aggregate ${collectionName} failed:`, error)
    }
    return {
      ok: false,
      map: new Map()
    }
  }
}

async function ensureCollection(collectionName) {
  try {
    await db.createCollection(collectionName)
  } catch (error) {
    const message = String((error && (error.errMsg || error.message)) || '')
    if (
      (error && error.errCode === -501001) ||
      message.includes('already exists') ||
      message.includes('collection exists') ||
      message.includes('duplicate')
    ) {
      return true
    }
    try {
      await db.collection(collectionName).limit(1).get()
      return true
    } catch (_) {
      throw error
    }
  }
  return true
}

async function getIssueViewCountMap(issueIds = []) {
  const ids = normalizePostIds(issueIds, 100)
  const countMap = new Map()
  if (!ids.length) return countMap

  try {
    for (let index = 0; index < ids.length; index += 100) {
      const chunk = ids.slice(index, index + 100)
      const res = await db.collection(ISSUE_VIEW_COLLECTION).aggregate()
        .match({
          issueId: _.in(chunk)
        })
        .group({
          _id: '$issueId',
          count: $.sum(1)
        })
        .end()
      ;(res.list || []).forEach(item => {
        if (item && item._id) {
          countMap.set(item._id, safeNumber(item.count))
        }
      })
    }
  } catch (error) {
    if (!isCollectionMissing(error)) {
      console.warn('[getWeeklyContent] aggregate issue views failed:', error)
    }
  }

  return countMap
}

async function recordWeeklyIssueView(issueId = '', event = {}) {
  const safeIssueId = String(issueId || '').trim()
  if (!safeIssueId) return false

  try {
    await ensureCollection(ISSUE_VIEW_COLLECTION)
    const wxContext = cloud.getWXContext()
    const openid = wxContext.OPENID || event.openid || ''
    const data = {
      issueId: safeIssueId,
      type: 'issue',
      source: String(event.source || 'weekly-detail').slice(0, 60),
      createTime: new Date()
    }
    if (openid) data._openid = openid
    if (event.sessionId) data.sessionId = String(event.sessionId).slice(0, 80)

    await db.collection(ISSUE_VIEW_COLLECTION).add({ data })
    try {
      await db.collection(ISSUE_COLLECTION).doc(safeIssueId).update({
        data: {
          views: _.inc(1),
          lastViewedAt: new Date()
        }
      })
    } catch (updateError) {
      console.warn('[getWeeklyContent] update issue view cache failed:', updateError)
    }
    return true
  } catch (error) {
    console.warn('[getWeeklyContent] record issue view failed:', error)
    return false
  }
}

async function getPostStatsMap(postIds = []) {
  const ids = normalizePostIds(postIds)
  const statsMap = new Map()
  if (!ids.length) return statsMap

  const [cachedStatsMap, voteStats, commentStats, viewEventStats, viewLogStats] = await Promise.all([
    getCachedPostStatsMap(ids),
    safeAggregatePostCountMap('votes_log', ids, { type: 'post' }),
    safeAggregatePostCountMap('comments', ids),
    safeAggregatePostCountMap('view_events', ids),
    safeAggregatePostCountMap('view_log', ids, { type: 'view' })
  ])

  ids.forEach(postId => {
    const cached = cachedStatsMap.get(postId) || {}
    const hasViewEvents = viewEventStats.ok && viewEventStats.map.has(postId)
    const hasViewLogs = viewLogStats.ok && viewLogStats.map.has(postId)
    const realViews = getMapNumber(viewEventStats.map, postId) + getMapNumber(viewLogStats.map, postId)
    statsMap.set(postId, {
      votes: voteStats.ok ? safeNumber(voteStats.map.get(postId)) : safeNumber(cached.votes),
      comments: commentStats.ok ? safeNumber(commentStats.map.get(postId)) : safeNumber(cached.comments),
      views: hasViewEvents || hasViewLogs ? realViews : safeNumber(cached.views),
      imageUrl: cached.imageUrl || cached.poemBgImage || '',
      imageUrls: Array.isArray(cached.imageUrls) ? cached.imageUrls : (cached.imageUrl ? [cached.imageUrl] : []),
      originalImageUrl: cached.originalImageUrl || '',
      originalImageUrls: Array.isArray(cached.originalImageUrls) ? cached.originalImageUrls : (cached.originalImageUrl ? [cached.originalImageUrl] : []),
      poemBgImage: cached.poemBgImage || ''
    })
  })

  return statsMap
}

function applyFreshStatsToSnapshots(snapshots = [], statsMap = new Map()) {
  return (Array.isArray(snapshots) ? snapshots : []).map(snapshot => {
    const postId = getSnapshotPostId(snapshot)
    const stats = postId ? statsMap.get(postId) : null
    if (!stats) return snapshot
    return {
      ...snapshot,
      votes: stats.votes,
      comments: stats.comments,
      views: stats.views,
      imageUrl: snapshot.imageUrl || stats.imageUrl || stats.poemBgImage || '',
      imageUrls: Array.isArray(snapshot.imageUrls) && snapshot.imageUrls.length ? snapshot.imageUrls : (Array.isArray(stats.imageUrls) ? stats.imageUrls : []),
      originalImageUrl: snapshot.originalImageUrl || stats.originalImageUrl || '',
      originalImageUrls: Array.isArray(snapshot.originalImageUrls) && snapshot.originalImageUrls.length ? snapshot.originalImageUrls : (Array.isArray(stats.originalImageUrls) ? stats.originalImageUrls : []),
      poemBgImage: snapshot.poemBgImage || stats.poemBgImage || ''
    }
  })
}

function summarizePostIds(postIds = [], statsMap = new Map()) {
  return (postIds || []).reduce((acc, postId) => {
    const stats = statsMap.get(postId)
    if (!stats) return acc
    acc.views += stats.views
    acc.likes += stats.votes
    acc.comments += stats.comments
    return acc
  }, { views: 0, likes: 0, comments: 0 })
}

async function applyFreshIssueStats(issue = {}, { issueViewCountMap = new Map() } = {}) {
  const postIds = getIssuePostIds(issue)
  const statsMap = await getPostStatsMap(postIds)
  const stats = summarizePostIds(postIds, statsMap)
  const issueId = issue._id || issue.id || ''
  const issueViews = issueViewCountMap.has(issueId)
    ? safeNumber(issueViewCountMap.get(issueId))
    : safeNumber(issue.views)
  return {
    ...issue,
    featuredSnapshots: applyFreshStatsToSnapshots(issue.featuredSnapshots, statsMap),
    rankingSnapshot: applyFreshStatsToSnapshots(issue.rankingSnapshot, statsMap),
    views: issueViews,
    likes: stats.likes,
    comments: stats.comments
  }
}

async function listWeeklyRankingCandidatePosts(bounds) {
  const posts = []
  const pageSize = 100
  for (let skip = 0; ; skip += pageSize) {
    const res = await db.collection('posts')
      .where({
        isPoem: true,
        isHidden: _.neq(true),
        createTime: _.gte(bounds.start).and(_.lte(bounds.end))
      })
      .orderBy('createTime', 'desc')
      .skip(skip)
      .orderBy('_id', 'desc')
      .limit(pageSize)
      .get()

    const batch = res.data || []
    posts.push(...batch)
    if (batch.length < pageSize) break
  }

  return posts
}

async function computeRecentWeeklyRanking({ limit = WEEKLY_RANKING_LIMIT, now = new Date() } = {}) {
  const end = new Date(now)
  const bounds = { start: new Date(end.getTime() - WEEKLY_RANKING_WINDOW_MS), end }
  const posts = await listWeeklyRankingCandidatePosts(bounds)
  if (!posts.length) return []

  const ids = posts.map(post => post && post._id).filter(Boolean)
  // 按批次统计全部候选，避免统计工具的单次 200 个 ID 上限漏算。
  const statsMap = new Map()
  for (let index = 0; index < ids.length; index += 100) {
    const batchStats = await getPostStatsMap(ids.slice(index, index + 100))
    batchStats.forEach((stats, id) => statsMap.set(id, stats))
  }
  const rankingLimit = Math.min(20, Math.max(1, Number(limit) || WEEKLY_RANKING_LIMIT))

  return posts
    .map((post) => {
      const stats = statsMap.get(post._id) || getPostStats(post)
      const votes = safeNumber(stats.votes)
      const comments = safeNumber(stats.comments)
      const views = safeNumber(stats.views)
      return normalizeSnapshot({
        ...post,
        postId: post._id,
        votes,
        comments,
        views,
        imageUrl: post.imageUrl || stats.imageUrl || stats.poemBgImage || '',
        imageUrls: Array.isArray(post.imageUrls) && post.imageUrls.length ? post.imageUrls : (Array.isArray(stats.imageUrls) ? stats.imageUrls : []),
        originalImageUrl: post.originalImageUrl || stats.originalImageUrl || '',
        originalImageUrls: Array.isArray(post.originalImageUrls) && post.originalImageUrls.length ? post.originalImageUrls : (Array.isArray(stats.originalImageUrls) ? stats.originalImageUrls : []),
        poemBgImage: post.poemBgImage || stats.poemBgImage || '',
        score: votes * 3 + comments * 2 + views
      })
    })
    .sort((left, right) => {
      const scoreDiff = safeNumber(right.score) - safeNumber(left.score)
      if (scoreDiff !== 0) return scoreDiff
      const timeDiff = new Date(right.createTime || 0).getTime() - new Date(left.createTime || 0).getTime()
      return timeDiff || String(left.postId).localeCompare(String(right.postId))
    })
    .slice(0, rankingLimit)
    .map((item, index) => ({ ...item, rank: index + 1 }))
}

async function applyFreshIssuesStats(issues = []) {
  const list = Array.isArray(issues) ? issues : []
  const issueViewCountMap = await getIssueViewCountMap(list.map(issue => issue && (issue._id || issue.id)).filter(Boolean))
  return Promise.all(list.map(issue => applyFreshIssueStats(issue, { issueViewCountMap })))
}

async function applyFreshTopicStats(topic = {}) {
  const postIds = getTopicPostIds(topic)
  const statsMap = await getPostStatsMap(postIds)
  const stats = summarizePostIds(postIds, statsMap)
  return {
    ...topic,
    selectedSnapshots: applyFreshStatsToSnapshots(topic.selectedSnapshots, statsMap),
    views: stats.views,
    likes: stats.likes,
    comments: stats.comments
  }
}

function normalizeAuthorKey(value = '') {
  return String(value || '').trim().toLowerCase()
}

function attachAuthorFeaturedCounts(snapshots = [], countInfo = {}) {
  const authorCountMap = countInfo.authorCountMap || new Map()
  const list = Array.isArray(snapshots) ? snapshots : []
  const localAuthorCountMap = list.reduce((acc, item) => {
    const authorKey = normalizeAuthorKey(item && (item.authorName || item.author))
    if (authorKey) acc.set(authorKey, safeNumber(acc.get(authorKey)) + 1)
    return acc
  }, new Map())

  return list.map(item => {
    const authorKey = normalizeAuthorKey(item && item.authorName)
    const authorHistoricalFeaturedCount = authorKey ? safeNumber(authorCountMap.get(authorKey)) : 0
    const authorCurrentDetailFeaturedCount = authorKey ? safeNumber(localAuthorCountMap.get(authorKey)) : 0
    return {
      ...item,
      authorHistoricalFeaturedCount,
      authorCurrentDetailFeaturedCount,
      authorFeaturedCount: authorHistoricalFeaturedCount + authorCurrentDetailFeaturedCount
    }
  })
}

function getSnapshotCoverImage(snapshot = {}) {
  if (!snapshot) return ''
  if (snapshot.coverImage) return snapshot.coverImage
  if (snapshot.imageUrl) return snapshot.imageUrl
  if (Array.isArray(snapshot.imageUrls) && snapshot.imageUrls[0]) return snapshot.imageUrls[0]
  if (snapshot.poemBgImage) return snapshot.poemBgImage
  if (snapshot.originalImageUrl) return snapshot.originalImageUrl
  if (Array.isArray(snapshot.originalImageUrls) && snapshot.originalImageUrls[0]) return snapshot.originalImageUrls[0]
  return ''
}

function getIssueCoverImage(issue = {}, snapshots = []) {
  if (issue.coverImage) return issue.coverImage
  const list = Array.isArray(snapshots) ? snapshots : []
  for (const snapshot of list) {
    const cover = getSnapshotCoverImage(snapshot)
    if (cover) return cover
  }
  return ''
}

function buildIssueView(issue = {}, { includeDetail = false } = {}) {
  const snapshots = Array.isArray(issue.featuredSnapshots)
    ? issue.featuredSnapshots.map(normalizeSnapshot)
    : []
  const stats = summarizeSnapshots(snapshots)
  const coverImage = getIssueCoverImage(issue, snapshots)
  const view = {
    _id: issue._id || '',
    id: issue._id || '',
    title: issue.title || 'Weekly Selection',
    coverImage,
    imageUrl: coverImage,
    imageUrls: coverImage ? [coverImage] : [],
    shelfTitle: issue.shelfTitle || '',
    periodStart: issue.periodStart || null,
    periodEnd: issue.periodEnd || null,
    dateRange: issue.dateRange || formatDateRange(issue.periodStart, issue.periodEnd),
    heroItems: Array.isArray(issue.heroItems) ? issue.heroItems : [],
    featuredCount: snapshots.length,
    views: issue.views !== undefined ? safeNumber(issue.views) : stats.views,
    likes: issue.likes !== undefined ? safeNumber(issue.likes) : stats.likes,
    comments: issue.comments !== undefined ? safeNumber(issue.comments) : stats.comments,
    sortWeight: safeNumber(issue.sortWeight),
    publishedAt: issue.publishedAt || null
  }
  if (includeDetail) {
    view.featuredSnapshots = snapshots
    view.rankingSnapshot = Array.isArray(issue.rankingSnapshot)
      ? issue.rankingSnapshot.map(normalizeSnapshot)
      : []
    view.topicIds = Array.isArray(issue.topicIds) ? issue.topicIds : []
  }
  return view
}

function buildTopicView(topic = {}, { includeDetail = false } = {}) {
  const snapshots = Array.isArray(topic.selectedSnapshots)
    ? topic.selectedSnapshots.map(normalizeSnapshot)
    : []
  const stats = summarizeSnapshots(snapshots)
  const view = {
    _id: topic._id || '',
    id: topic._id || '',
    title: topic.title || 'Weekly Topic',
    summary: topic.summary || '',
    periodStart: topic.periodStart || null,
    periodEnd: topic.periodEnd || null,
    dateRange: topic.dateRange || formatDateRange(topic.periodStart, topic.periodEnd),
    selectedCount: snapshots.length,
    views: topic.views !== undefined ? safeNumber(topic.views) : stats.views,
    likes: topic.likes !== undefined ? safeNumber(topic.likes) : stats.likes,
    comments: topic.comments !== undefined ? safeNumber(topic.comments) : stats.comments,
    sortWeight: safeNumber(topic.sortWeight),
    publishedAt: topic.publishedAt || null
  }
  if (includeDetail) {
    view.selectedSnapshots = snapshots
  }
  return view
}

async function listPublishedIssues({ skip = 0, limit = 20 } = {}) {
  try {
    const res = await db.collection(ISSUE_COLLECTION)
      .where({
        status: 'published',
        isDeleted: _.neq(true)
      })
      .orderBy('publishedAt', 'desc')
      .orderBy('periodEnd', 'desc')
      .skip(Math.max(0, Number(skip) || 0))
      .limit(Math.min(50, Math.max(1, Number(limit) || 20)))
      .get()
    return res.data || []
  } catch (error) {
    if (isCollectionMissing(error)) return []
    throw error
  }
}

async function getConfiguredFeaturedIssueIds() {
  try {
    const res = await db.collection(WEEKLY_CONFIG_COLLECTION).doc(WEEKLY_FEATURED_CONFIG_DOC_ID).get()
    const issueIds = res && res.data && Array.isArray(res.data.issueIds) ? res.data.issueIds : []
    return issueIds.map((id) => String(id || '').trim()).filter(Boolean)
  } catch (error) {
    const message = String((error && (error.errMsg || error.message)) || '')
    const docMissing = error && (error.errCode === -502004 || message.includes('document not exists') || message.includes('document does not exist'))
    if (isCollectionMissing(error) || docMissing) return []
    console.warn('[getWeeklyContent] load featured config failed:', error)
    return []
  }
}

async function fetchPublishedIssuesByIds(ids = []) {
  const list = (Array.isArray(ids) ? ids : []).map((id) => String(id || '').trim()).filter(Boolean)
  if (!list.length) return []
  const byId = new Map()
  try {
    for (let index = 0; index < list.length; index += 100) {
      const chunk = list.slice(index, index + 100)
      const res = await db.collection(ISSUE_COLLECTION)
        .where({
          _id: _.in(chunk),
          status: 'published',
          isDeleted: _.neq(true)
        })
        .get()
      ;(res.data || []).forEach((issue) => {
        if (issue && issue._id) byId.set(issue._id, issue)
      })
    }
  } catch (error) {
    console.warn('[getWeeklyContent] fetch published issues by ids failed:', error)
  }
  return list.map((id) => byId.get(id)).filter(Boolean)
}

async function listPublishedTopics({ skip = 0, limit = 20 } = {}) {
  try {
    const res = await db.collection(TOPIC_COLLECTION)
      .where({
        status: 'published',
        isDeleted: _.neq(true)
      })
      .orderBy('publishedAt', 'desc')
      .orderBy('periodEnd', 'desc')
      .skip(Math.max(0, Number(skip) || 0))
      .limit(Math.min(50, Math.max(1, Number(limit) || 20)))
      .get()
    return res.data || []
  } catch (error) {
    if (isCollectionMissing(error)) return []
    throw error
  }
}

async function getAuthorFeaturedCountMap({ excludeIssueId = '' } = {}) {
  const authorCountMap = new Map()
  let skip = 0
  const pageSize = 100

  try {
    while (true) {
      const res = await db.collection(ISSUE_COLLECTION)
        .where({
          status: 'published',
          isDeleted: _.neq(true)
        })
        .field({
          featuredSnapshots: true
        })
        .skip(skip)
        .limit(pageSize)
        .get()

      const issues = res.data || []
      issues.forEach(issue => {
        if (excludeIssueId && issue._id === excludeIssueId) return
        const snapshots = Array.isArray(issue.featuredSnapshots) ? issue.featuredSnapshots : []
        snapshots.forEach(snapshot => {
          const authorKey = normalizeAuthorKey(snapshot && (snapshot.authorName || snapshot.author))
          if (!authorKey) return
          authorCountMap.set(authorKey, safeNumber(authorCountMap.get(authorKey)) + 1)
        })
      })

      if (issues.length < pageSize) break
      skip += pageSize
    }
  } catch (error) {
    if (isCollectionMissing(error)) return { authorCountMap }
    console.warn('[getWeeklyContent] get author featured counts failed:', error)
  }

  return { authorCountMap }
}

async function getPublishedIssue(issueId) {
  if (!issueId) return null
  try {
    const res = await db.collection(ISSUE_COLLECTION).doc(issueId).get()
    const issue = res.data || null
    if (!issue || issue.status !== 'published' || issue.isDeleted === true) return null
    return issue
  } catch (error) {
    if (isCollectionMissing(error)) return null
    throw error
  }
}

async function getPublishedTopic(topicId) {
  if (!topicId) return null
  try {
    const res = await db.collection(TOPIC_COLLECTION).doc(topicId).get()
    const topic = res.data || null
    if (!topic || topic.status !== 'published' || topic.isDeleted === true) return null
    return topic
  } catch (error) {
    if (isCollectionMissing(error)) return null
    throw error
  }
}

async function hydrateSnapshotColors(snapshots = []) {
  const list = Array.isArray(snapshots) ? snapshots : []
  const missingColorIds = list
    .filter(item => item && item.postId && (!item.backgroundColor || !item.textColor))
    .map(item => item.postId)
  const ids = Array.from(new Set(missingColorIds)).slice(0, 100)
  if (!ids.length) return list

  try {
    const res = await db.collection('posts')
      .where({
        _id: _.in(ids)
      })
      .field({
        _id: true,
        backgroundColor: true,
        textColor: true
      })
      .get()
    const colorById = new Map((res.data || []).map(post => [post._id, post]))
    return list.map(item => {
      const source = colorById.get(item.postId)
      if (!source) return item
      return {
        ...item,
        backgroundColor: item.backgroundColor || source.backgroundColor || '',
        textColor: item.textColor || source.textColor || ''
      }
    })
  } catch (error) {
    console.warn('[getWeeklyContent] hydrate snapshot colors failed:', error)
    return list
  }
}

async function buildDetailFromIssue(issue) {
  const view = buildIssueView(issue, { includeDetail: true })
  view.featuredSnapshots = await hydrateSnapshotColors(view.featuredSnapshots)
  const authorFeaturedCountMap = await getAuthorFeaturedCountMap({ excludeIssueId: view._id || view.id || '' })
  view.featuredSnapshots = attachAuthorFeaturedCounts(view.featuredSnapshots, authorFeaturedCountMap)
  const first = view.featuredSnapshots[0] || {}
  return {
    ...view,
    title: view.title,
    authorName: first.authorName || '鍥炶溅閿紪杈戦儴',
    authorAvatar: first.authorAvatar || '',
    authorSignature: first.authorSignature || '',
    workCount: view.featuredSnapshots.length,
    posts: view.featuredSnapshots
  }
}

async function buildDetailFromTopic(topic) {
  const view = buildTopicView(topic, { includeDetail: true })
  view.selectedSnapshots = await hydrateSnapshotColors(view.selectedSnapshots)
  const authorFeaturedCountMap = await getAuthorFeaturedCountMap()
  view.selectedSnapshots = attachAuthorFeaturedCounts(view.selectedSnapshots, authorFeaturedCountMap)
  const first = view.selectedSnapshots[0] || {}
  return {
    ...view,
    title: view.title,
    authorName: first.authorName || '鍥炶溅閿紪杈戦儴',
    authorAvatar: first.authorAvatar || '',
    authorSignature: first.authorSignature || view.summary || '',
    workCount: view.selectedSnapshots.length,
    posts: view.selectedSnapshots
  }
}

// ====== 当前用户对快照的点赞状态（已点赞的 postId 集合） ======

function collectSnapshotPostIds(snapshotArrays = []) {
  return Array.from(new Set((Array.isArray(snapshotArrays) ? snapshotArrays : []).reduce((acc, list) => {
    if (Array.isArray(list)) {
      list.forEach((snapshot) => {
        const postId = getSnapshotPostId(snapshot)
        if (postId) acc.push(postId)
      })
    }
    return acc
  }, [])))
}

// 与 vote 云函数保持一致：点赞记录存于 votes_log，字段 _openid/postId/type='post'
async function getLikedPostIdsMap(postIds = [], openid = '') {
  const likedMap = new Map()
  if (!openid) return likedMap
  const ids = normalizePostIds(postIds)
  if (!ids.length) return likedMap
  try {
    for (let index = 0; index < ids.length; index += 100) {
      const chunk = ids.slice(index, index + 100)
      const res = await db.collection('votes_log')
        .where({
          _openid: openid,
          postId: _.in(chunk),
          type: 'post'
        })
        .field({ postId: true })
        .get()
      ;(res.data || []).forEach((item) => {
        if (item && item.postId) likedMap.set(item.postId, true)
      })
    }
  } catch (error) {
    if (!isCollectionMissing(error)) {
      console.warn('[getWeeklyContent] fetch caller liked posts failed:', error)
    }
  }
  return likedMap
}

// 仅给“已点赞”的快照补 isVoted:true；未点赞/未知的保持原样，便于前端结合本地缓存叠加
function attachLikedToSnapshots(snapshots = [], likedMap = new Map()) {
  const list = Array.isArray(snapshots) ? snapshots : []
  if (!list.length || !likedMap.size) return list
  return list.map((snapshot) => {
    const postId = getSnapshotPostId(snapshot)
    return postId && likedMap.has(postId) ? { ...snapshot, isVoted: true } : snapshot
  })
}

// 给 detail 对象里的 posts/featuredSnapshots/selectedSnapshots/rankingSnapshot 统一补点赞状态
async function attachLikedStateToDetail(detail = {}, openid = '') {
  if (!detail || !openid) return detail
  const arrays = [
    detail.posts,
    detail.featuredSnapshots,
    detail.selectedSnapshots,
    detail.rankingSnapshot
  ].filter(Array.isArray)
  if (!arrays.length) return detail
  const likedMap = await getLikedPostIdsMap(collectSnapshotPostIds(arrays), openid)
  if (!likedMap.size) return detail
  if (Array.isArray(detail.posts)) detail.posts = attachLikedToSnapshots(detail.posts, likedMap)
  if (Array.isArray(detail.featuredSnapshots)) detail.featuredSnapshots = attachLikedToSnapshots(detail.featuredSnapshots, likedMap)
  if (Array.isArray(detail.selectedSnapshots)) detail.selectedSnapshots = attachLikedToSnapshots(detail.selectedSnapshots, likedMap)
  if (Array.isArray(detail.rankingSnapshot)) detail.rankingSnapshot = attachLikedToSnapshots(detail.rankingSnapshot, likedMap)
  return detail
}

// 给单独的榜单快照列表补点赞状态
async function attachLikedToSnapshotList(list = [], openid = '') {
  if (!openid || !Array.isArray(list) || !list.length) return list
  const likedMap = await getLikedPostIdsMap(collectSnapshotPostIds([list]), openid)
  return likedMap.size ? attachLikedToSnapshots(list, likedMap) : list
}

function getCallerOpenid(event = {}) {
  try {
    const wxContext = cloud.getWXContext()
    if (wxContext && wxContext.OPENID) return wxContext.OPENID
  } catch (_) {}
  return event.openid || ''
}

exports.main = async (event = {}) => {
  const mode = String(event.mode || 'home').trim()
  const skip = Math.max(0, Number(event.skip) || 0)
  const limit = Math.min(50, Math.max(1, Number(event.limit) || 20))
  const id = String(event.id || event.issueId || event.topicId || '').trim()
  const shouldRecordView = event.recordView === true

  try {
    if (mode === 'issues') {
      const issues = await listPublishedIssues({ skip, limit })
      const freshIssues = await applyFreshIssuesStats(issues)
      return {
        success: true,
        issues: freshIssues.map(issue => buildIssueView(issue)),
        hasMore: issues.length === limit
      }
    }

    if (mode === 'issueDetail') {
      if (id && shouldRecordView) {
        await recordWeeklyIssueView(id, event)
      }
      const issue = await getPublishedIssue(id)
      const issueViewCountMap = issue ? await getIssueViewCountMap([issue._id || id]) : new Map()
      const freshIssue = issue ? await applyFreshIssueStats(issue, { issueViewCountMap }) : null
      const detail = freshIssue ? await buildDetailFromIssue(freshIssue) : null
      await attachLikedStateToDetail(detail, getCallerOpenid(event))
      return {
        success: true,
        detail
      }
    }

    if (mode === 'topics') {
      const topics = await listPublishedTopics({ skip, limit })
      const freshTopics = await Promise.all(topics.map(topic => applyFreshTopicStats(topic)))
      return {
        success: true,
        topics: freshTopics.map(topic => buildTopicView(topic)),
        hasMore: topics.length === limit
      }
    }

    if (mode === 'topicDetail') {
      const topic = await getPublishedTopic(id)
      const freshTopic = topic ? await applyFreshTopicStats(topic) : null
      const detail = freshTopic ? await buildDetailFromTopic(freshTopic) : null
      await attachLikedStateToDetail(detail, getCallerOpenid(event))
      return {
        success: true,
        detail
      }
    }

    if (mode === 'ranking') {
      const rankingItems = await computeRecentWeeklyRanking({ limit: 20 })
      const callerOpenid = getCallerOpenid(event)
      const rankingItemsLiked = await attachLikedToSnapshotList(rankingItems, callerOpenid)
      return {
        success: true,
        issue: null,
        rankingItems: rankingItemsLiked
      }
    }

    const [latestIssues, topics] = await Promise.all([
      listPublishedIssues({ skip: 0, limit: 6 }),
      listPublishedTopics({ skip: 0, limit: 6 })
    ])
    const configuredIds = await getConfiguredFeaturedIssueIds()
    let issues
    if (configuredIds.length) {
      issues = await fetchPublishedIssuesByIds(configuredIds)
      if (!issues.length) issues = latestIssues
    } else {
      issues = latestIssues
    }
    const current = latestIssues[0] || null
    const issueViewCountMap = await getIssueViewCountMap(Array.from(new Set([
      ...issues.map(issue => issue && issue._id),
      current && current._id
    ].filter(Boolean))))
    const [freshIssues, freshTopics, rankingItems] = await Promise.all([
      Promise.all(issues.map(issue => applyFreshIssueStats(issue, { issueViewCountMap }))),
      Promise.all(topics.map(topic => applyFreshTopicStats(topic))),
      computeRecentWeeklyRanking({ limit: WEEKLY_RANKING_LIMIT })
    ])
    const currentIndex = issues.findIndex(issue => issue && issue._id && current && issue._id === current._id)
    const freshCurrent = currentIndex > -1
      ? freshIssues[currentIndex]
      : (current ? await applyFreshIssueStats(current, { issueViewCountMap }) : null)
    const callerOpenid = getCallerOpenid(event)
    const currentIssue = freshCurrent ? buildIssueView(freshCurrent, { includeDetail: true }) : null
    await attachLikedStateToDetail(currentIssue, callerOpenid)
    const rankingItemsLiked = await attachLikedToSnapshotList(rankingItems, callerOpenid)
    return {
      success: true,
      currentIssue,
      heroItems: current && Array.isArray(current.heroItems) ? current.heroItems : [],
      issues: freshIssues.map(issue => buildIssueView(issue)),
      topics: freshTopics.map(topic => buildTopicView(topic)),
      rankingItems: rankingItemsLiked
    }
  } catch (error) {
    console.error('[getWeeklyContent] failed:', error)
    return {
      success: false,
      message: '获取周刊内容失败',
      error: error.message
    }
  }
}
