'use strict';

const { ALIASES, SPARSE, compactCreate, compactPatch, toPostView, resolveOwner, isAnonymousPost } = require('./schema');
const { compatibleWhere, viewFields, expandFields, postLookup, scopedPublicWhere } = require('./query');
const visibility = require('./visibility');
const { isRestricted, publicVisibilityWhere } = visibility;

const databases = new WeakMap();
const writeV2 = () => process.env.POSTS_WRITE_SCHEMA === '2';
const sensitivePatch = data => Object.keys(data).some(key => ALIASES.includes(key) || SPARSE.has(key)
  || ['publishMode', 'seriesBlocks', 'imageUrls', 'joinedActivityId'].includes(key)
  || data[key] === '' || data[key] === null || (Array.isArray(data[key]) && !data[key].length));

function createPostsDatabase(raw, options = {}) {
  if (!options.publicOnly && databases.has(raw)) return databases.get(raw);
  const command = options.command || raw.command;
  const versions = new Map();
  const remember = post => {
    if (post && post._id) {
      if (versions.size > 2000) versions.clear();
      versions.set(post._id, post.schemaVersion === 2 ? 2 : 1);
    }
    return toPostView(post);
  };
  const read = result => ({ ...result, data: Array.isArray(result.data) ? result.data.map(remember) : remember(result.data) });

  function wrap(ref, state = {}) {
    return new Proxy(ref, {
      get(target, key) {
        const scopeRoot = () => options.publicOnly && !state.scoped && !state.id ? target.where(publicVisibilityWhere()) : target;
        if (key === 'where') return filter => wrap(target.where(options.publicOnly ? scopedPublicWhere(filter) : compatibleWhere(filter)), { ...state, filter, scoped: true });
        if (key === 'doc') return id => wrap(target.doc(id), { ...state, id });
        if (key === 'field') return fields => wrap(scopeRoot().field(expandFields(fields)), { ...state, scoped: true });
        if (key === 'get') return async (...args) => {
          const result = await scopeRoot().get(...args);
          return options.publicOnly && state.id && isRestricted(result.data) ? { ...result, data: null } : read(result);
        };
        if (key === 'count') return (...args) => scopeRoot().count(...args);
        if (key === 'add') return async request => {
          const modern = writeV2();
          const result = await target.add({ ...request, data: modern ? compactCreate(request.data) : request.data });
          if (result._id) versions.set(result._id, modern ? 2 : 1);
          return result;
        };
        if (key === 'update') return async request => {
          if (!sensitivePatch(request.data)) return target.update(request);
          if (state.id) {
            let version = versions.get(state.id);
            if (!version) {
              const current = await target.get();
              if (!current.data) throw new Error('帖子不存在');
              version = current.data.schemaVersion === 2 ? 2 : 1;
            }
            return target.update({ ...request, data: version === 2 ? compactPatch(request.data, command) : request.data });
          }
          // Infrequent mixed-version maintenance updates need two DB writes,
          // but still execute inside the original cloud invocation.
          const base = state.filter || {};
          const legacy = await raw.collection('posts').where(command.and([base, { schemaVersion: command.neq(2) }])).update(request);
          const modern = await raw.collection('posts').where(command.and([compatibleWhere(base), { schemaVersion: 2 }])).update({ ...request, data: compactPatch(request.data, command) });
          return { ...modern, stats: { ...modern.stats, updated: ((legacy.stats || {}).updated || 0) + ((modern.stats || {}).updated || 0) } };
        };
        if (key === 'set') return () => { throw new Error('posts 不允许整文档覆盖，请使用受控更新'); };
        if (key === 'aggregate') return () => {
          const query = target.aggregate();
          return aggregate(options.publicOnly ? query.match(publicVisibilityWhere()) : query, true);
        };
        const value = target[key];
        if (typeof value !== 'function') return value;
        if (['orderBy', 'limit', 'skip'].includes(key)) return (...args) => wrap(scopeRoot()[key](...args), { ...state, scoped: true });
        return value.bind(target);
      }
    });
  }

  function aggregate(ref, isPost, hydrated = false, postShape = isPost) {
    return new Proxy(ref, {
      get(target, key) {
        const value = target[key];
        if (typeof value !== 'function') return value;
        if (key === 'end') return async (...args) => {
          const result = await value.apply(target, args);
          return isPost && postShape ? { ...result, list: (result.list || []).map(remember) } : result;
        };
        return (...args) => {
          let next = target;
          let ready = hydrated;
          if (isPost && postShape && !ready && ['project', 'addFields', 'group', 'replaceRoot', 'unwind'].includes(key)) {
            next = next.addFields(viewFields()); ready = true;
          }
          if (key === 'match' && isPost && !ready) args[0] = compatibleWhere(args[0]);
          if (key === 'lookup') args[0] = postLookup(args[0], options.publicOnly);
          if (key === 'project' && isPost && postShape) args[0] = expandFields(args[0]);
          return aggregate(next[key](...args), isPost, ready, postShape && !['group', 'count', 'replaceRoot'].includes(key));
        };
      }
    });
  }

  const db = new Proxy(raw, {
    get(target, key) {
      if (key === 'collection') return name => {
        const ref = target.collection(name);
        if (name === 'posts') return wrap(ref);
        // Profiles aggregate from users and join posts in a lookup pipeline.
        return new Proxy(ref, { get(collection, method) {
          if (method === 'aggregate') return () => aggregate(collection.aggregate(), false);
          const value = collection[method];
          return typeof value === 'function' ? value.bind(collection) : value;
        } });
      };
      if (key === 'runTransaction') return (callback, ...args) => target.runTransaction(transaction => callback(createPostsDatabase(transaction, { command })), ...args);
      const value = target[key];
      return typeof value === 'function' ? value.bind(target) : value;
    }
  });
  if (!options.publicOnly) databases.set(raw, db);
  return db;
}

// Strip internal ownership AFTER handlers finish permissions/notifications/filtering.
function publicResult(value) {
  if (Array.isArray(value)) return value.map(publicResult);
  if (!value || typeof value !== 'object' || value instanceof Date || typeof value.toJSON === 'function') return value;
  const result = {};
  for (const [key, item] of Object.entries(value)) {
    if (key !== 'realAuthorOpenid') result[key] = publicResult(item);
  }
  if (result.visibility === 'scheduled' && isRestricted(result)) result.isHidden = true;
  if (isAnonymousPost(result)) {
    result.isAnonymous = true;
    result._openid = '123456';
    result.authorName = result.anonymousAuthorName || '匿名用户';
    result.anonymousAuthorName = result.authorName;
    if (result.author) result.author = result.authorName;
    result.authorAvatar = '/static/images/avatar.png';
    result.authorAvatarSnapshot = result.authorAvatar;
    result.authorSignature = '';
    result.authorNameSnapshot = result.authorName;
  }
  return result;
}
const withPostResponse = handler => async (...args) => publicResult(await handler(...args));

module.exports = { createPostsDatabase, withPostResponse, resolveOwner, toPostView, compactCreate, compactPatch, compatibleWhere, writeV2, ...visibility };
