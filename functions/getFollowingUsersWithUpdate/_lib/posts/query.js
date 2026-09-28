'use strict';

const DERIVED = new Set(['isPoem', 'isDiscussion', 'isActivityPost']);
const SPARSE = new Set(['isAnonymous', 'isSeries', 'isHidden', 'isFoundPoetry']);
const logic = value => value && Array.isArray(value.operands) && ['and', 'or', 'nor', 'not'].includes(value.operator);
const plain = value => Object.prototype.toString.call(value) === '[object Object]';

function literal(value) {
  if (value && Array.isArray(value.operands) && typeof value.operator === 'string') {
    if (logic(value)) return { ['$' + value.operator]: value.operands.map(literal) };
    const key = '$' + (value.operator === 'neq' ? 'ne' : value.operator);
    return { [key]: literal(['in', 'nin', 'all'].includes(value.operator) ? value.operands : value.operands[0]) };
  }
  if (Array.isArray(value)) return value.map(literal);
  if (!plain(value) || value._internalType) return value;
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, literal(item)]));
}

function booleanMatches(condition, value) {
  if (condition === true || condition === false) return condition === value;
  if (condition && typeof condition.toJSON === 'function') return booleanMatches(condition.toJSON(), value);
  if (condition && condition.operator && Array.isArray(condition.operands)) {
    if (condition.operator === 'and') return condition.operands.every(part => booleanMatches(part, value));
    if (condition.operator === 'or') return condition.operands.some(part => booleanMatches(part, value));
    if (condition.operator === 'not') return !booleanMatches(condition.operands[0], value);
  }
  if (!plain(condition)) throw new Error('Unsupported posts boolean predicate');
  return Object.entries(condition).every(([key, operand]) => {
    if (key === '$eq') return value === operand;
    if (key === '$ne') return value !== operand;
    if (key === '$in') return operand.includes(value);
    if (key === '$nin') return !operand.includes(value);
    if (key === '$not') return !booleanMatches(operand, value);
    if (key === '$exists') return operand === true;
    throw new Error(`Unsupported posts boolean operator: ${key}`);
  });
}

function walkPredicate(input, visitor) {
  if (logic(input)) {
    const key = '$' + input.operator;
    return { [key]: input.operator === 'not' ? walkPredicate(input.operands[0], visitor) : input.operands.map(item => walkPredicate(item, visitor)) };
  }
  if (!input || typeof input !== 'object') return input;
  const parts = [];
  const same = {};
  for (const [key, value] of Object.entries(input)) {
    if (['$and', '$or', '$nor'].includes(key)) same[key] = value.map(item => walkPredicate(item, visitor));
    else if (key === '$not') same[key] = walkPredicate(value, visitor);
    else if (logic(value)) {
      parts.push({ ['$' + value.operator]: value.operands.map(operand => walkPredicate({ [key]: operand }, visitor)) });
    }
    else {
      const replacement = visitor(key, value);
      if (replacement) parts.push(replacement);
      else same[key] = value;
    }
  }
  if (!parts.length) return same;
  if (Object.keys(same).length) parts.unshift(same);
  return parts.length === 1 ? parts[0] : { $and: parts };
}

function compatibleWhere(input) {
  let changed = false;
  const v2 = walkPredicate(input, (key, value) => {
    if (!DERIVED.has(key) && !SPARSE.has(key)) return null;
    changed = true;
    const yes = booleanMatches(value, true);
    const no = booleanMatches(value, false);
    if (yes && no) return {};
    if (!yes && !no) return { _id: { $exists: false } };
    if (key === 'isPoem' || key === 'isDiscussion') return { publishMode: { [yes ? '$eq' : '$ne']: key === 'isPoem' ? 'poem' : 'discussion' } };
    if (key === 'isActivityPost') return yes
      ? { activityId: { $exists: true, $nin: ['', null] } }
      : { $or: [{ activityId: { $exists: false } }, { activityId: { $in: ['', null] } }] };
    return { [key]: yes ? true : { $ne: true } };
  });
  if (!changed) return input;
  return literal({ $or: [
    { $and: [{ schemaVersion: { $ne: 2 } }, walkPredicate(input, () => null)] },
    { $and: [{ schemaVersion: 2 }, v2] }
  ] });
}

// Hydrate within the SAME aggregate, only after indexable match/sort/page stages.
// No per-post lookup and no second database request.
function viewFields() {
  const v2 = { $eq: ['$schemaVersion', 2] };
  const fallback = (value, other) => ({ $ifNull: [value, other] });
  const first = value => fallback({ $arrayElemAt: [fallback(value, []), 0] }, '');
  const choose = (modern, legacy) => ({ $cond: [v2, modern, legacy] });
  return {
    isPoem: choose({ $eq: ['$publishMode', 'poem'] }, '$isPoem'),
    isDiscussion: choose({ $eq: ['$publishMode', 'discussion'] }, '$isDiscussion'),
    isActivityPost: choose({ $ne: [fallback('$activityId', ''), ''] }, '$isActivityPost'),
    authorNameSnapshot: choose('$authorName', '$authorNameSnapshot'),
    authorAvatarSnapshot: choose('$authorAvatar', '$authorAvatarSnapshot'),
    anonymousAuthorName: choose('$authorName', '$anonymousAuthorName'),
    highlightSentence: choose(first('$highlightLines'), fallback('$highlightSentence', first('$highlightLines'))),
    discussionSentences: choose(fallback('$sentenceGroups', []), '$discussionSentences'),
    seriesBlockCount: choose({ $size: fallback('$seriesBlocks', []) }, '$seriesBlockCount'),
    seriesCoverImage: choose(first('$seriesBlocks.imageUrl'), '$seriesCoverImage'),
    seriesCoverHighlight: choose(first('$highlightLines'), '$seriesCoverHighlight'),
    imageUrl: choose(first('$imageUrls'), '$imageUrl'),
    originalImageUrl: choose(first(fallback('$originalImageUrls', '$imageUrls')), '$originalImageUrl'),
    originalImageUrls: choose(fallback('$originalImageUrls', fallback('$imageUrls', [])), '$originalImageUrls'),
    poemBgImage: choose(fallback('$poemBgImage', { $cond: [{ $eq: ['$publishMode', 'poem'] }, first('$imageUrls'), ''] }), '$poemBgImage')
  };
}

const DEPENDENCIES = {
  isPoem: ['publishMode'], isDiscussion: ['publishMode'], isActivityPost: ['activityId'],
  authorNameSnapshot: ['authorName'], authorAvatarSnapshot: ['authorAvatar'], anonymousAuthorName: ['authorName', 'isAnonymous'],
  highlightSentence: ['highlightLines'], discussionSentences: ['sentenceGroups'],
  seriesBlockCount: ['seriesBlocks'], seriesCoverImage: ['seriesBlocks'], seriesCoverHighlight: ['highlightLines'],
  imageUrl: ['imageUrls'], originalImageUrl: ['originalImageUrls', 'imageUrls'],
  originalImageUrls: ['imageUrls'], poemBgImage: ['imageUrls', 'publishMode']
};
function expandFields(fields) {
  const out = { ...fields };
  const include = Object.values(out).some(value => value !== 0 && value !== false);
  if (!include) return out;
  out.schemaVersion = true;
  // Type/privacy information must survive selective projections.
  for (const key of ['publishMode', 'isPoem', 'isDiscussion', 'isAnonymous', 'realAuthorOpenid', 'isSeries', 'isOriginal', 'activityId', 'isActivityPost']) out[key] = true;
  for (const [key, dependencies] of Object.entries(DEPENDENCIES)) if (out[key]) for (const dependency of dependencies) out[dependency] = true;
  return out;
}

function postLookup(options) {
  if (options.from !== 'posts') return options;
  if (!options.pipeline) return options;
  let hydrated = false;
  const pipeline = [];
  for (const stage of options.pipeline) {
    if (!hydrated && !['$match', '$sort', '$skip', '$limit'].some(key => key in stage)) {
      pipeline.push({ $addFields: viewFields() }); hydrated = true;
    }
    pipeline.push(stage.$match && !hydrated ? { $match: compatibleWhere(stage.$match) } : stage);
  }
  if (!hydrated) pipeline.push({ $addFields: viewFields() });
  return { ...options, pipeline };
}
module.exports = { compatibleWhere, viewFields, expandFields, postLookup };
