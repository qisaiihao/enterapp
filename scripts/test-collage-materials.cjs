const assert = require('node:assert/strict');
const core = require('../functions/getCollageMaterials/core');
const adminLib = require('../functions/adminManager/_lib/collage-material');

function main() {
  for (const lib of [core, adminLib]) {
    assert.deepEqual(lib.MATERIAL_TYPES, ['paper', 'background']);
    assert.equal(lib.normalizeType('paper'), 'paper');
    assert.equal(lib.normalizeType(' Background '), 'background');
    assert.equal(lib.normalizeType('image'), '');
    assert.equal(lib.normalizeType(null), '');

    const list = lib.normalizeList([
      { _id: 'a', type: 'paper', name: ' 月光 ', fileID: 'cloud://env.bucket/a.png', width: 100.4, height: '200', groupId: ' g1 ', createdAt: new Date(0) },
      { _id: 'b', type: 'background', fileID: 'cloud://env.bucket/b.jpg', width: 900, height: 1200 },
      { _id: 'c', type: 'paper', fileID: 'https://example.com/c.png', width: 10, height: 10 },
      { _id: 'd', type: 'other', fileID: 'cloud://env.bucket/d.png', width: 10, height: 10 },
      null
    ]);
    assert.equal(list.length, 2, '只保留类型和 fileID 合法的素材');
    assert.deepEqual({ ...list[0], createdAt: undefined }, {
      id: 'a', type: 'paper', name: '月光', fileID: 'cloud://env.bucket/a.png', groupId: 'g1', width: 100, height: 200, createdAt: undefined
    });
    assert.equal(list[1].name, '官方背景', '缺少名称时使用类型默认名');
    assert.equal(list[1].groupId, '', '缺少分组时归入未分组');
    assert.equal(lib.normalizeMaterial({ _id: 'e', type: 'paper', fileID: 'cloud://env.bucket/e.png', width: -5, height: 0 }).width, 0);

    const valid = lib.validateMaterialInput({ type: 'paper', name: ' 纸片 ', fileID: 'cloud://env.bucket/a.png', width: 120, height: 60.6, groupId: ' g1 ' });
    assert.deepEqual(valid, { ok: true, value: { type: 'paper', name: '纸片', fileID: 'cloud://env.bucket/a.png', width: 120, height: 61, groupId: 'g1' } });

    assert.equal(lib.validateMaterialInput({ type: 'image', name: 'x', fileID: 'cloud://env/a.png', width: 1, height: 1 }).ok, false);
    assert.equal(lib.validateMaterialInput({ type: 'paper', name: '', fileID: 'cloud://env/a.png', width: 1, height: 1 }).error, '请填写素材名称');
    assert.equal(lib.validateMaterialInput({ type: 'paper', name: 'x'.repeat(25), fileID: 'cloud://env/a.png', width: 1, height: 1 }).ok, false);
    assert.equal(lib.validateMaterialInput({ type: 'paper', name: 'x', fileID: 'https://env/a.png', width: 1, height: 1 }).error, '请先上传素材图片');
    assert.equal(lib.validateMaterialInput({ type: 'paper', name: 'x', fileID: 'cloud://env/a.png', width: 0, height: 10 }).ok, false);
    assert.equal(lib.validateMaterialInput({ type: 'background', name: 'x', fileID: 'cloud://env/a.png', width: lib.MATERIAL_MAX_DIMENSION + 1, height: 10 }).ok, false);
    assert.equal(lib.validateMaterialInput({ type: 'background', name: 'x', fileID: 'cloud://env/a.png', width: lib.MATERIAL_MAX_DIMENSION, height: 10 }).ok, true);

    assert.deepEqual(lib.validateMaterialName(' 纸片 '), { ok: true, name: '纸片' });
    assert.equal(lib.validateMaterialName('').error, '请填写素材名称');
    assert.equal(lib.validateMaterialName(null).ok, false);
    assert.equal(lib.validateMaterialName('x'.repeat(lib.MATERIAL_NAME_MAX_LENGTH)).ok, true);
    assert.equal(lib.validateMaterialName('x'.repeat(lib.MATERIAL_NAME_MAX_LENGTH + 1)).error, `素材名称最多 ${lib.MATERIAL_NAME_MAX_LENGTH} 个字`);

    assert.equal(lib.GROUP_NAME_MAX_LENGTH, 16);
    assert.equal(lib.normalizeGroupId(' g1 '), 'g1');
    assert.equal(lib.normalizeGroupName(' 春日 '), '春日');
    assert.equal(lib.normalizeGroupName(null), '');
    assert.deepEqual(lib.validateGroupInput({ type: 'paper', name: ' 春日 ' }), { ok: true, value: { type: 'paper', name: '春日' } });
    assert.equal(lib.validateGroupInput({ type: 'paper', name: '' }).error, '请填写分组名称');
    assert.equal(lib.validateGroupInput({ type: 'paper', name: 'x'.repeat(17) }).error, `分组名称最多 ${lib.GROUP_NAME_MAX_LENGTH} 个字`);
    assert.equal(lib.validateGroupInput({ type: 'image', name: '春日' }).ok, false);

    const groups = lib.normalizeGroupList([
      { _id: 'g1', type: 'paper', name: ' 春日 ', sort: 2, createdAt: new Date('2026-01-01') },
      { _id: 'g2', type: 'paper', name: '', sort: 1 },
      { _id: 'g3', type: 'image', name: '无效类型' },
      null
    ]);
    assert.deepEqual(groups.map(group => ({ id: group.id, name: group.name, sort: group.sort })), [
      { id: 'g1', name: '春日', sort: 2 }
    ], '分组缺少名称或类型时忽略');
    assert.equal(lib.normalizeGroup({ _id: 'g4', type: 'paper', name: 'x'.repeat(30) }).name.length, lib.GROUP_NAME_MAX_LENGTH);
  }

  // 管理端和公开读取必须对同一份数据给出一致结果。
  const sample = { _id: 'same', type: 'background', name: '', fileID: 'cloud://env.bucket/same.png', groupId: 'g1', width: 900, height: 1200 };
  assert.deepEqual(core.normalizeMaterial(sample), adminLib.normalizeMaterial(sample));
  const groupSample = { _id: 'g1', type: 'paper', name: ' 春日 ', sort: '3' };
  assert.deepEqual(core.normalizeGroup(groupSample), adminLib.normalizeGroup(groupSample));
  assert.equal(core.DEFAULT_LIST_LIMIT, 100);
  assert.equal(core.normalizeLimit(undefined), core.DEFAULT_LIST_LIMIT);
  assert.equal(core.normalizeLimit(0), core.DEFAULT_LIST_LIMIT);
  assert.equal(core.normalizeLimit(20), 20);
  assert.equal(core.normalizeLimit(9999), core.MAX_LIST_LIMIT);
  assert.equal(core.normalizeLimit('40'), 40);

  const materials = [
    { id: 'm1', type: 'paper', name: '甲', groupId: 'g1' },
    { id: 'm2', type: 'paper', name: '乙', groupId: '' },
    { id: 'm3', type: 'paper', name: '丙', groupId: 'missing' },
    { id: 'm4', type: 'background', name: '背景', groupId: 'g1' }
  ];
  const rawGroups = [
    { id: 'g2', type: 'paper', name: '夏', sort: 5, createdAt: null },
    { id: 'g1', type: 'paper', name: '春', sort: 1, createdAt: null },
    { id: 'gb', type: 'background', name: '背景组', sort: 0, createdAt: null }
  ];
  const paperBuckets = core.buildGroups({ materials, groups: rawGroups, type: 'paper' });
  assert.deepEqual(paperBuckets.map(bucket => bucket.name), ['春', '夏', '未分组'], '分组按 sort 升序，未分组排最后');
  assert.deepEqual(paperBuckets.map(bucket => bucket.materials.map(material => material.id)), [['m1'], [], ['m2', 'm3']], '分组引用失效的素材归入未分组');
  const backgroundBuckets = core.buildGroups({ materials, groups: rawGroups, type: 'background' });
  assert.deepEqual(backgroundBuckets.map(bucket => bucket.name), ['背景组', '未分组'], '只返回同类型分组');
  assert.deepEqual(backgroundBuckets[0].materials.map(material => material.id), [], '分组类型不匹配的素材不会混入');
  assert.deepEqual(backgroundBuckets[1].materials.map(material => material.id), ['m4'], '分组类型不匹配时归入未分组');
  assert.deepEqual(core.buildGroups({ materials, groups: rawGroups, type: 'paper' }).find(bucket => bucket.id === '').id, '');
  assert.deepEqual(core.buildGroups({ materials: [], groups: [], type: 'paper' }), [], '没有素材和分组时返回空列表');

  console.log('[test-collage-materials] PASS: 素材与分组的归一化、列表过滤、名称兜底、素材名称与上传校验、分组归档、公开读取与管理端一致性');
}

module.exports = main;
if (require.main === module) main();
