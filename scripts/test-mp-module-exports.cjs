const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const buildRoot = path.join(__dirname, '../dist/build/mp-weixin');
function loadModule(relativePath) {
  const module = { exports: {} };
  vm.runInNewContext(fs.readFileSync(path.join(buildRoot, relativePath), 'utf8'), {
    module, exports: module.exports,
    require: () => ({ resolvePostAuthorAvatar: () => '/avatar.png', formatRelativeTime: () => '刚刚' }), console
  }, { filename: relativePath });
  return module.exports;
}

const pagination = loadModule('mixins/pagination.js').paginationMixin;
const gallery = loadModule('mixins/postGallery.js').postGalleryMixin;
assert.ok(pagination && pagination.methods, '编译后的分页 mixin 必须能被页面读取');
assert.ok(gallery && gallery.methods, '编译后的图片 mixin 必须能被页面读取');
// 与小程序 parseComponent 的 mixins 访问方式相同，不能含 undefined。
[pagination, gallery].forEach(item => { void item.options; });
assert.equal(typeof pagination.methods.initPagination, 'function');
const normalizer = loadModule('utils/postNormalizer.js');
assert.equal(typeof normalizer.normalizePostList, 'function');
const posts = normalizer.normalizePostList([{ imageUrl: '/poem.jpg', createTime: '2026-09-09' }]);
assert.equal(posts[0].imageUrls[0], '/poem.jpg');
assert.equal(posts[0].formattedCreateTime, '刚刚');
console.log('小程序编译产物：分页、图片 mixin 和帖子整理模块导出正常');
