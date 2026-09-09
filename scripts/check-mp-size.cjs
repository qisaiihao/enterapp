const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../dist/build/mp-weixin');
const app = JSON.parse(fs.readFileSync(path.join(root, 'app.json'), 'utf8'));
const config = JSON.parse(fs.readFileSync(path.join(root, 'project.config.json'), 'utf8'));
const ignores = (config.packOptions && config.packOptions.ignore) || [];
const includes = (config.packOptions && config.packOptions.include) || [];
const roots = (app.subPackages || app.subpackages || []).map(item => item.root.replace(/\/$/, ''));
const sizes = new Map([['主包', 0], ...roots.map(name => [name, 0])]);
const excluded = new Map();
const mainFiles = [];
let rawMain = 0;
function matches(file, rule) {
  const value = String(rule.value || '').replace(/^\//, '').replace(/\/$/, '');
  if (rule.type === 'file') return file === value;
  if (rule.type === 'folder') return file.startsWith(value + '/');
  throw new Error(`体积检查尚不支持打包规则 ${rule.type}，请同步更新脚本`);
}
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) { walk(full); continue; }
    const file = path.relative(root, full).replace(/\\/g, '/');
    const bytes = fs.statSync(full).size;
    const pkg = roots.find(name => file.startsWith(name + '/')) || '主包';
    if (pkg === '主包') rawMain += bytes;
    const ignored = ignores.find(rule => matches(file, rule));
    if (ignored && !includes.some(rule => matches(file, rule))) {
      excluded.set(ignored.value, (excluded.get(ignored.value) || 0) + bytes);
      continue;
    }
    sizes.set(pkg, sizes.get(pkg) + bytes);
    if (pkg === '主包') mainFiles.push({ file, bytes });
  }
}
walk(root);
const mib = bytes => (bytes / 1024 / 1024).toFixed(3) + ' MiB';
console.log(`主包目录原始体积：${mib(rawMain)}`);
for (const [name, bytes] of excluded) console.log(`打包排除 ${name}：${mib(bytes)}`);
let failed = false;
for (const [name, bytes] of sizes) {
  console.log(`${name}：${mib(bytes)} (${bytes} bytes)`);
  if (bytes > 2 * 1024 * 1024) failed = true;
}
console.log('主包最大文件：');
for (const item of mainFiles.sort((a, b) => b.bytes - a.bytes).slice(0, 8)) {
  console.log(`  ${item.file} ${(item.bytes / 1024).toFixed(1)} KiB`);
}
console.log('按打包排除规则估算，最终体积以微信开发者工具为准。');
if (failed) { console.error('存在超过 2 MiB 的代码包'); process.exitCode = 1; }
