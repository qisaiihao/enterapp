#!/usr/bin/env node
/**
 * 小程序端 require() 返回的是 module.exports，因此带
 * `if (typeof module !== 'undefined' && module.exports) { module.exports = {...} }`
 * 兼容块的模块，必须把每个 ESM 具名导出都写进这份手写清单，
 * 否则小程序上拿到的是 undefined（H5/App 走 ESM 不受影响）。
 *
 * 本脚本扫描所有双格式模块，发现遗漏即失败。
 */
const fs = require('fs');
const path = require('path');
const parser = require('@babel/parser');

const ROOT = path.join(__dirname, '..');
const TARGET_DIRS = ['api-cache', 'utils', 'cache', 'common', 'mixins', 'components'];
const DUAL_EXPORT_RE = /typeof\s+module\s*!==?\s*['"]undefined['"]/;

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === 'unpackage') continue;
      walk(full, out);
    } else if (entry.isFile() && entry.name.endsWith('.js')) {
      out.push(full);
    }
  }
  return out;
}

function collectNamedExports(program) {
  const names = new Set();
  for (const node of program.body) {
    if (node.type !== 'ExportNamedDeclaration') continue;
    if (node.declaration) {
      if (node.declaration.id && node.declaration.id.name) names.add(node.declaration.id.name);
      if (node.declaration.declarations) {
        for (const decl of node.declaration.declarations) {
          if (decl.id && decl.id.name) names.add(decl.id.name);
        }
      }
    }
    for (const spec of node.specifiers || []) {
      const exported = spec.exported && (spec.exported.name || spec.exported.value);
      if (exported && exported !== 'default') names.add(exported);
    }
  }
  return names;
}

function isModuleExports(node) {
  return node
    && node.type === 'MemberExpression'
    && !node.computed
    && node.object.type === 'Identifier'
    && node.object.name === 'module'
    && node.property.type === 'Identifier'
    && node.property.name === 'exports';
}

function collectManualExports(program) {
  const names = new Set();
  const visit = (node) => {
    if (!node || typeof node.type !== 'string') return;
    if (node.type === 'AssignmentExpression' && isModuleExports(node.left) && node.right.type === 'ObjectExpression') {
      for (const prop of node.right.properties) {
        if (!prop) continue;
        if (prop.type === 'ObjectProperty' || prop.type === 'Property') {
          const key = prop.key;
          if (key.type === 'Identifier') names.add(key.name);
          else if (key.type === 'StringLiteral') names.add(key.value);
        }
        if (prop.type === 'SpreadElement') names.add('*');
      }
    }
    for (const key of Object.keys(node)) {
      if (key === 'loc' || key === 'start' || key === 'end') continue;
      const value = node[key];
      if (Array.isArray(value)) value.forEach(visit);
      else if (value && typeof value.type === 'string') visit(value);
    }
  };
  visit(program);
  return names;
}

function main() {
  const offenders = [];
  let checked = 0;
  for (const dir of TARGET_DIRS) {
    for (const file of walk(path.join(ROOT, dir))) {
      const source = fs.readFileSync(file, 'utf8');
      if (!DUAL_EXPORT_RE.test(source)) continue;
      checked += 1;
      let ast;
      try {
        ast = parser.parse(source, { sourceType: 'module', plugins: ['optionalChaining', 'classProperties'] });
      } catch (error) {
        offenders.push({ file, missing: [`解析失败: ${error.message}`] });
        continue;
      }
      const named = collectNamedExports(ast.program);
      const manual = collectManualExports(ast.program);
      if (!manual.size) continue;
      if (manual.has('*')) continue;
      const missing = [...named].filter((name) => !manual.has(name));
      if (missing.length) offenders.push({ file, missing });
    }
  }

  if (offenders.length) {
    console.error('[check-dual-exports] FAIL');
    for (const item of offenders) {
      const rel = path.relative(ROOT, item.file);
      console.error(`  ${rel} -> module.exports 缺少: ${item.missing.join(', ')}`);
    }
    process.exit(1);
  }
  console.log(`[check-dual-exports] PASS (${checked} 个双格式模块)`);
}

main();
