const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const shared = path.join(root, 'functions/_shared/posts');
const consumers = require('../functions/_shared/posts/consumers.json');
const files = ['index.js', 'schema.js', 'query.js'];
const check = process.argv.includes('--check');
let failed = false;
// Catch new direct readers/writers that otherwise escape the deployment inventory.
function inspect(directory, consumer) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (['node_modules', '_lib', '_shared'].includes(entry.name)) continue;
    const filename = path.join(directory, entry.name);
    if (entry.isDirectory()) inspect(filename, consumer);
    else if (entry.name.endsWith('.js')) {
      const source = fs.readFileSync(filename, 'utf8');
      if (/collection\(\s*['"]posts['"]|from:\s*['"]posts['"]/.test(source) && !consumers.includes(consumer)) {
        console.error(`Posts access missing from consumers.json: ${path.relative(root, filename)}`); failed = true;
      }
    }
  }
}
for (const base of ['functions', '回车键新网站/cloudfunctions']) {
  for (const entry of fs.readdirSync(path.join(root, base), { withFileTypes: true })) {
    if (entry.isDirectory() && !entry.name.startsWith('_') && entry.name !== 'node_modules') inspect(path.join(root, base, entry.name), `${base}/${entry.name}`);
  }
}
for (const consumer of consumers) {
  const target = path.resolve(root, consumer, '_lib/posts');
  if (!target.startsWith(root + path.sep)) throw new Error('Invalid posts consumer path');
  if (!check) fs.mkdirSync(target, { recursive: true });
  for (const name of files) {
    const content = fs.readFileSync(path.join(shared, name));
    const destination = path.join(target, name);
    if (check) {
      if (!fs.existsSync(destination) || !content.equals(fs.readFileSync(destination))) {
        console.error(`Stale posts module: ${consumer}/_lib/posts/${name}`); failed = true;
      }
    } else fs.writeFileSync(destination, content);
  }
}
if (failed) process.exitCode = 1;
else console.log(`Posts shared modules ${check ? 'verified' : 'synced'}: ${consumers.length} deployment packages`);
