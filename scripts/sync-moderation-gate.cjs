const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'functions/_shared/moderation-gate.js'));
const consumers = [
  'addComment',
  'createDiscussionPost',
  'createPost',
  'updatePostContent',
  'uploadCollagePoetry'
];
const check = process.argv.includes('--check');
let stale = false;
for (const name of consumers) {
  const dir = path.join(root, 'functions', name, '_lib');
  const target = path.join(dir, 'moderation-gate.js');
  if (check) {
    if (!fs.existsSync(target) || !source.equals(fs.readFileSync(target))) {
      console.error(`Stale moderation gate: ${name}`);
      stale = true;
    }
  } else {
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(target, source);
  }
}
if (stale) process.exitCode = 1;
else console.log(`Moderation gate ${check ? 'verified' : 'synced'}: ${consumers.length} functions`);
