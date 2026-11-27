'use strict';

const SOURCES = new Set(['today', 'original', 'repost', 'popular']);
const DAY = 24 * 60 * 60 * 1000;
const CHINA_OFFSET = 8 * 60 * 60 * 1000;
const FEED_SIZE = 16;
const FIELDS = {
  _id: 1, title: 1, content: 1, author: 1, authorName: 1, anonymousAuthorName: 1,
  highlightLines: 1, highlightSentence: 1, seriesCoverHighlight: 1, seriesBlocks: 1,
  backgroundColor: 1, textColor: 1
};

function shorten(value, limit) {
  if (typeof value !== 'string') return '';
  const characters = Array.from(value.trim());
  return characters.length > limit ? `${characters.slice(0, limit - 1).join('')}…` : characters.join('');
}

function highlights(lines) {
  return (Array.isArray(lines) ? lines : []).filter(line => typeof line === 'string' && line.trim()).join('\n');
}

function color(value, fallback) {
  const hex = typeof value === 'string' ? value.trim() : '';
  if (/^#[\da-f]{3}$/i.test(hex)) return '#' + [...hex.slice(1)].map(char => char + char).join('').toUpperCase();
  return /^#[\da-f]{6}$/i.test(hex) ? hex.toUpperCase() : fallback;
}

function describePoem(post) {
  let excerpt = shorten(highlights(post.highlightLines), 180) || shorten(post.seriesCoverHighlight, 180);
  if (!excerpt) {
    for (const block of post.seriesBlocks || []) {
      excerpt = shorten(highlights(block?.highlightLines), 180) || shorten(block?.highlightSentence, 180) || shorten(block?.content, 180);
      if (excerpt) break;
    }
  }
  excerpt ||= shorten(post.content, 180);
  if (!excerpt || typeof post._id !== 'string' || !post._id) return null;
  const author = post.isAnonymous ? (post.anonymousAuthorName || '匿名用户') : (post.author || post.authorName);
  return {
    id: post._id,
    excerpt: excerpt.replace(/\r\n?/g, '\n'),
    title: shorten(post.title, 48),
    author: shorten(author, 32) || '佚名',
    backgroundColor: color(post.backgroundColor, '#F5EFE5'),
    textColor: color(post.textColor, '#302820')
  };
}

async function loadFeed(db, source, now = Date.now()) {
  const { command } = db;
  const day = new Date(now + CHINA_OFFSET).toISOString().slice(0, 10);
  const start = Date.parse(`${day}T00:00:00+08:00`);
  const filter = {
    isPoem: true,
    isHidden: command.neq(true),
    isDeleted: command.neq(true),
    isActivityPost: command.neq(true),
    visibility: command.neq('scheduled'),
    $or: [
      { auditStatus: command.exists(false) },
      { auditStatus: null },
      { auditStatus: '' },
      { auditStatus: 'approved' }
    ]
  };
  if (source === 'today') filter.createTime = { $gte: new Date(start), $lt: new Date(start + DAY) };
  if (source === 'original') filter.isOriginal = true;
  if (source === 'repost') filter.isOriginal = command.neq(true);
  if (source === 'popular') filter.votes = command.gt(0);

  let query = db.collection('posts').aggregate().match(filter);
  if (source === 'popular') query = query.sort({ votes: -1, createTime: -1, _id: -1 }).limit(100);
  const { list = [] } = await query.sample({ size: FEED_SIZE }).project(FIELDS).end();
  return { source, day, poems: list.map(describePoem).filter(Boolean) };
}

function httpResponse(statusCode, payload) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      ...(statusCode === 405 ? { Allow: 'GET' } : {})
    },
    isBase64Encoded: false,
    body: JSON.stringify(payload)
  };
}

async function handle(db, event = {}) {
  const http = typeof event.httpMethod === 'string';
  if (http && event.httpMethod !== 'GET') return httpResponse(405, { error: 'method_not_allowed' });
  const { source } = (http ? event.queryStringParameters : event) || {};
  if (!SOURCES.has(source)) {
    const result = { error: 'invalid_source' };
    return http ? httpResponse(400, result) : result;
  }
  try {
    const result = await loadFeed(db, source);
    return http ? httpResponse(200, result) : result;
  } catch (error) {
    console.error('[poem-widget-feed]', source, error);
    const result = { error: 'feed_unavailable' };
    return http ? httpResponse(503, result) : result;
  }
}

module.exports = { describePoem, handle, loadFeed };
