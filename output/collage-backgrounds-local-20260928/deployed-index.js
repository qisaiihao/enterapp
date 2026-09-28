// 获取拼贴诗官方素材库（公开只读）。
// 素材由管理员通过 adminManager 上传和维护，客户端按分组读取素材。
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()
const { normalizeType, normalizeLimit, normalizeList, normalizeGroupList, buildGroups } = require('./core')

const MATERIAL_COLLECTION = 'collage_materials'
const GROUP_COLLECTION = 'collage_material_groups'

exports.main = async (event = {}) => {
  const action = event.action || 'list'
  if (action !== 'list') {
    return { success: false, error: `unknown action: ${action}` }
  }

  try {
    const type = normalizeType(event.type)
    const limit = normalizeLimit(event.limit)
    let materialQuery = db.collection(MATERIAL_COLLECTION)
    let groupQuery = db.collection(GROUP_COLLECTION)
    if (type) {
      materialQuery = materialQuery.where({ type })
      groupQuery = groupQuery.where({ type })
    }

    const [materialResult, groupResult] = await Promise.all([
      materialQuery.orderBy('createdAt', 'desc').limit(limit).get(),
      groupQuery.orderBy('createdAt', 'asc').limit(limit).get()
    ])

    const materials = normalizeList(materialResult.data)
    const groups = buildGroups({ materials, groups: normalizeGroupList(groupResult.data), type })
    console.log('getCollageMaterials list:', { type: type || 'all', count: materials.length, groups: groups.length })
    return {
      success: true,
      groups,
      materials,
      hasMore: materialResult.data.length >= limit
    }
  } catch (error) {
    console.error('getCollageMaterials error:', error)
    return {
      success: false,
      error: error.message || '获取官方素材失败'
    }
  }
}
