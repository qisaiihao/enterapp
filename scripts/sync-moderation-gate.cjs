const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'functions/_shared/moderation-gate.js'));
const reviewSource = fs.readFileSync(path.join(root, 'functions/_shared/moderation-review.js'));
const adminAuthSource = fs.readFileSync(path.join(root, 'functions/adminManager/_lib/admin-auth.js'));
const consumers = [
  'contentCheck',
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
for (const name of [...consumers, 'adminManager']) {
  const dir = path.join(root, 'functions', name, '_lib');
  const resources = [{ filename: 'moderation-review.js', source: reviewSource }];
  if (name !== 'adminManager') resources.push({ filename: 'admin-auth.js', source: adminAuthSource });
  for (const resource of resources) {
    const target = path.join(dir, resource.filename);
    if (check) {
      if (!fs.existsSync(target) || !resource.source.equals(fs.readFileSync(target))) {
        console.error(`Stale moderation review resource: ${name}/${resource.filename}`);
        stale = true;
      }
    } else {
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(target, resource.source);
    }
  }
}
if (stale) process.exitCode = 1;
else console.log(`Moderation gate and review ${check ? 'verified' : 'synced'}: ${consumers.length} publishing functions and adminManager`);
