const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { parse } = require('@babel/parser');

// 支持检查 HBuilderX 发行目录；npm build:app 默认检查 CLI 的正式产物。
const output = process.argv[2] || process.env.UNI_OUTPUT_DIR || path.join(__dirname, '../dist/build/app');
const file = path.join(output, 'app-service.js');
const ast = parse(fs.readFileSync(file, 'utf8'), { sourceType: 'unambiguous' });
let registered = false;
let implemented = false;

function visit(node) {
  if (!node || typeof node !== 'object') return;
  if (Array.isArray(node)) return node.forEach(visit);
  if (node.type === 'CallExpression' && node.callee.type === 'MemberExpression'
    && node.callee.property.name === 'component'
    && node.arguments[0]?.value === 'app-overlay-host' && node.arguments[1]) {
    registered = true;
  }
  if (node.type === 'ObjectExpression') {
    const props = node.properties;
    if (props.some(prop => prop.key?.name === 'name' && prop.value?.value === 'AppOverlayHost')
      && props.some(prop => prop.key?.name === 'mounted')
      && props.some(prop => prop.key?.name === 'beforeUnmount')) implemented = true;
  }
  for (const [key, value] of Object.entries(node)) {
    if (!['loc', 'start', 'end'].includes(key)) visit(value);
  }
}
visit(ast);
assert.ok(registered, 'App bundle must explicitly register app-overlay-host; unresolved template tags cannot display dialogs');
assert.ok(implemented, 'App bundle must include the overlay host implementation and lifecycle');
console.log('[check-app-overlay-bundle] PASS: explicit host registration and implementation in ' + file);
