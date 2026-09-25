import fileUrlCache from '@/cache/core/file-url.js';
import { callCloudAndUnwrap } from './_shared/cloud-wrapper.js';

const TTL_MS = 5 * 60 * 1000;
const cache = new Map();
const pending = new Map();

async function resolveMaterialUrls(materials) {
  const fileIDs = materials.map(item => item.fileID).filter(Boolean);
  if (!fileIDs.length) return materials;
  let urls = {};
  try {
    urls = await fileUrlCache.getTempUrls(fileIDs);
  } catch (error) {
    urls = {};
  }
  // 解析失败时保留 cloud:// fileID，微信小程序仍可直接显示。
  return materials.map(item => ({ ...item, url: urls[item.fileID] || item.fileID }));
}

async function fetchOfficialGroups({ type, context }) {
  const result = await callCloudAndUnwrap(
    'getCollageMaterials',
    { action: 'list', type },
    { pageTag: 'collage-materials', context, requireAuth: false, injectOpenId: false },
    '加载官方素材失败'
  );
  const rawGroups = Array.isArray(result.groups) && result.groups.length
    ? result.groups
    : (Array.isArray(result.materials) && result.materials.length
      ? [{ id: '', name: '未分组', materials: result.materials }]
      : []);
  const materials = rawGroups.flatMap(group => (Array.isArray(group.materials) ? group.materials : []));
  const resolved = await resolveMaterialUrls(materials);
  const byId = new Map(resolved.map(item => [item.id, item]));
  return rawGroups.map(group => ({
    id: group.id || '',
    name: group.name || '未分组',
    materials: (Array.isArray(group.materials) ? group.materials : []).map(item => byId.get(item.id) || item)
  }));
}

/**
 * 获取官方素材分组（公开只读）。分组内按上传时间倒序，未分组素材排在最后。
 * @param {Object} options
 * @param {'paper'|'background'} options.type 素材类型，省略则返回全部
 * @param {boolean} options.forceRefresh 是否跳过本地缓存
 */
export async function getOfficialMaterials({ type = '', forceRefresh = false, context } = {}) {
  const key = type || 'all';
  const cached = cache.get(key);
  if (!forceRefresh && cached && Date.now() - cached.at < TTL_MS) return cached.items;
  if (pending.has(key)) return pending.get(key);

  const task = fetchOfficialGroups({ type, context })
    .then(items => {
      cache.set(key, { at: Date.now(), items });
      return items;
    })
    .finally(() => pending.delete(key));
  pending.set(key, task);
  return task;
}

export function invalidateOfficialMaterials(type) {
  if (!type) {
    cache.clear();
    return;
  }
  cache.delete(type);
  cache.delete('all');
}

const collageMaterialsApi = { getOfficialMaterials, invalidateOfficialMaterials };

export default collageMaterialsApi;

if (typeof module !== 'undefined' && module.exports) {
  module.exports = collageMaterialsApi;
  module.exports.default = collageMaterialsApi;
}
