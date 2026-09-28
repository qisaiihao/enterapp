// 官方素材的纯逻辑：类型、分组、列表归一化和上传校验。
// 客户端不可直接读写数据库，素材只能通过云函数读取或管理员上传。
const MATERIAL_TYPES = ['paper', 'background'];
const MATERIAL_NAME_MAX_LENGTH = 24;
const MATERIAL_MAX_DIMENSION = 2560;
const MATERIAL_FILE_ID_MAX_LENGTH = 1024;
const GROUP_NAME_MAX_LENGTH = 16;
const UNGROUPED_NAME = '未分组';
const DEFAULT_LIST_LIMIT = 100;
const MAX_LIST_LIMIT = 200;
const TYPE_FALLBACK_NAMES = { paper: '官方纸片', background: '官方背景' };

function normalizeType(value) {
  const type = typeof value === 'string' ? value.trim().toLowerCase() : '';
  return MATERIAL_TYPES.includes(type) ? type : '';
}

function normalizeDimension(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? Math.round(number) : 0;
}

function normalizeLimit(value) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) return DEFAULT_LIST_LIMIT;
  return Math.min(MAX_LIST_LIMIT, Math.floor(number));
}

function normalizeName(value, type) {
  const name = typeof value === 'string' ? value.trim().slice(0, MATERIAL_NAME_MAX_LENGTH) : '';
  return name || TYPE_FALLBACK_NAMES[type] || '官方素材';
}

function normalizeGroupName(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeGroupId(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeMaterial(doc) {
  if (!doc || typeof doc !== 'object') return null;
  const type = normalizeType(doc.type);
  const fileID = typeof doc.fileID === 'string' ? doc.fileID.trim() : '';
  if (!type || !fileID.startsWith('cloud://')) return null;
  return {
    id: doc._id ? String(doc._id) : '',
    type,
    name: normalizeName(doc.name, type),
    fileID,
    groupId: normalizeGroupId(doc.groupId),
    width: normalizeDimension(doc.width),
    height: normalizeDimension(doc.height),
    createdAt: doc.createdAt || null
  };
}

function normalizeList(docs) {
  return (Array.isArray(docs) ? docs : []).map(normalizeMaterial).filter(Boolean);
}

function normalizeGroup(doc) {
  if (!doc || typeof doc !== 'object') return null;
  const type = normalizeType(doc.type);
  const name = normalizeGroupName(doc.name).slice(0, GROUP_NAME_MAX_LENGTH);
  if (!type || !name) return null;
  const sort = Number(doc.sort);
  return {
    id: doc._id ? String(doc._id) : '',
    type,
    name,
    sort: Number.isFinite(sort) ? sort : 0,
    createdAt: doc.createdAt || null
  };
}

function normalizeGroupList(docs) {
  return (Array.isArray(docs) ? docs : []).map(normalizeGroup).filter(Boolean);
}

function validateMaterialName(value) {
  const name = typeof value === 'string' ? value.trim() : '';
  if (!name) return { ok: false, error: '请填写素材名称' };
  if (name.length > MATERIAL_NAME_MAX_LENGTH) {
    return { ok: false, error: `素材名称最多 ${MATERIAL_NAME_MAX_LENGTH} 个字` };
  }
  return { ok: true, name };
}

function validateMaterialInput(input = {}) {
  const type = normalizeType(input.type);
  if (!type) return { ok: false, error: '素材类型无效' };

  const fileID = typeof input.fileID === 'string' ? input.fileID.trim() : '';
  if (!fileID.startsWith('cloud://') || fileID.length > MATERIAL_FILE_ID_MAX_LENGTH) {
    return { ok: false, error: '请先上传素材图片' };
  }

  const nameCheck = validateMaterialName(input.name);
  if (!nameCheck.ok) return nameCheck;

  const width = normalizeDimension(input.width);
  const height = normalizeDimension(input.height);
  if (!width || !height) return { ok: false, error: '无法读取素材尺寸，请更换图片后重试' };
  if (Math.max(width, height) > MATERIAL_MAX_DIMENSION) {
    return { ok: false, error: `素材最长边不能超过 ${MATERIAL_MAX_DIMENSION} px` };
  }

  return { ok: true, value: { type, name: nameCheck.name, fileID, width, height, groupId: normalizeGroupId(input.groupId) } };
}

function validateGroupInput(input = {}) {
  const type = normalizeType(input.type);
  if (!type) return { ok: false, error: '素材类型无效' };

  const name = normalizeGroupName(input.name);
  if (!name) return { ok: false, error: '请填写分组名称' };
  if (name.length > GROUP_NAME_MAX_LENGTH) {
    return { ok: false, error: `分组名称最多 ${GROUP_NAME_MAX_LENGTH} 个字` };
  }

  return { ok: true, value: { type, name } };
}

function groupSortKey(group) {
  const created = Date.parse(group.createdAt);
  return Number.isFinite(created) ? created : 0;
}

// 先选组再选素材：未指定分组的素材归入“未分组”，排在最后。
function buildGroups({ materials = [], groups = [], type = '' } = {}) {
  const typedMaterials = type ? materials.filter(material => material.type === type) : materials;
  const typedGroups = (type ? groups.filter(group => group.type === type) : groups)
    .slice()
    .sort((a, b) => (a.sort - b.sort) || (groupSortKey(a) - groupSortKey(b)) || String(a.id).localeCompare(String(b.id)));
  const buckets = typedGroups.map(group => ({ id: group.id, type: group.type, name: group.name, materials: [] }));
  const byId = new Map(buckets.map(bucket => [bucket.id, bucket]));
  const ungrouped = [];
  for (const material of typedMaterials) {
    const bucket = material.groupId ? byId.get(material.groupId) : null;
    if (bucket) bucket.materials.push(material);
    else ungrouped.push(material);
  }
  if (ungrouped.length) {
    buckets.push({ id: '', type: type || '', name: UNGROUPED_NAME, materials: ungrouped });
  }
  return buckets;
}

module.exports = {
  MATERIAL_TYPES,
  MATERIAL_NAME_MAX_LENGTH,
  MATERIAL_MAX_DIMENSION,
  GROUP_NAME_MAX_LENGTH,
  UNGROUPED_NAME,
  DEFAULT_LIST_LIMIT,
  MAX_LIST_LIMIT,
  normalizeType,
  normalizeDimension,
  normalizeLimit,
  normalizeName,
  normalizeGroupName,
  normalizeGroupId,
  normalizeMaterial,
  normalizeList,
  normalizeGroup,
  normalizeGroupList,
  validateMaterialInput,
  validateMaterialName,
  validateGroupInput,
  buildGroups
};
