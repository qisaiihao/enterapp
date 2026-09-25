import { callActionAndUnwrap } from './_shared/cloud-wrapper.js';

function callAdminMaterials(action, payload = {}, { pageTag, context, fallbackMessage } = {}) {
  return callActionAndUnwrap({
    functionName: 'adminManager',
    action,
    payload,
    pageTag: pageTag || `admin-collage-materials:${action}`,
    context,
    requireAuth: true,
    fallbackMessage: fallbackMessage || '操作失败'
  });
}

export function listAdminCollageMaterials({ type = '', context } = {}) {
  return callAdminMaterials('listCollageMaterials', { type }, {
    pageTag: 'admin-collage-materials:list',
    context,
    fallbackMessage: '加载素材失败'
  });
}

export function createAdminCollageMaterial({ type, name, fileID, width, height, groupId = '', context } = {}) {
  return callAdminMaterials('createCollageMaterial', { type, name, fileID, width, height, groupId }, {
    pageTag: 'admin-collage-materials:create',
    context,
    fallbackMessage: '保存素材失败'
  });
}

export function updateAdminCollageMaterial({ id, name, groupId, context } = {}) {
  const payload = { id };
  if (typeof name === 'string') payload.name = name;
  if (typeof groupId === 'string') payload.groupId = groupId;
  return callAdminMaterials('updateCollageMaterial', payload, {
    pageTag: 'admin-collage-materials:update',
    context,
    fallbackMessage: '更新素材失败'
  });
}

export function deleteAdminCollageMaterial({ id, context } = {}) {
  return callAdminMaterials('deleteCollageMaterial', { id }, {
    pageTag: 'admin-collage-materials:delete',
    context,
    fallbackMessage: '删除素材失败'
  });
}

export function listAdminCollageMaterialGroups({ type = '', context } = {}) {
  return callAdminMaterials('listCollageMaterialGroups', { type }, {
    pageTag: 'admin-collage-materials:groups',
    context,
    fallbackMessage: '加载分组失败'
  });
}

export function createAdminCollageMaterialGroup({ type, name, context } = {}) {
  return callAdminMaterials('createCollageMaterialGroup', { type, name }, {
    pageTag: 'admin-collage-materials:create-group',
    context,
    fallbackMessage: '创建分组失败'
  });
}

export function renameAdminCollageMaterialGroup({ id, name, context } = {}) {
  return callAdminMaterials('renameCollageMaterialGroup', { id, name }, {
    pageTag: 'admin-collage-materials:rename-group',
    context,
    fallbackMessage: '重命名分组失败'
  });
}

export function deleteAdminCollageMaterialGroup({ id, context } = {}) {
  return callAdminMaterials('deleteCollageMaterialGroup', { id }, {
    pageTag: 'admin-collage-materials:delete-group',
    context,
    fallbackMessage: '删除分组失败'
  });
}

const adminCollageMaterialsApi = {
  listAdminCollageMaterials,
  createAdminCollageMaterial,
  updateAdminCollageMaterial,
  deleteAdminCollageMaterial,
  listAdminCollageMaterialGroups,
  createAdminCollageMaterialGroup,
  renameAdminCollageMaterialGroup,
  deleteAdminCollageMaterialGroup
};

export default adminCollageMaterialsApi;

if (typeof module !== 'undefined' && module.exports) {
  module.exports = adminCollageMaterialsApi;
  module.exports.default = adminCollageMaterialsApi;
}
