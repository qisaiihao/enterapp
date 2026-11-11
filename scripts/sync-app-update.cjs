'use strict';
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'functions/_shared/app-update.js'), 'utf8');
for (const target of ['functions/checkAppUpdate/_lib/policy.js', 'uniCloud-aliyun/cloudfunctions/common/app-update/policy.js']) {
  const file = path.join(root, target);
  if (process.argv.includes('--check')) {
    if (!fs.existsSync(file) || fs.readFileSync(file, 'utf8') !== source) throw Error(`升级策略未同步：${target}`);
  } else {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, source);
  }
}
console.log('App 更新策略已同步核对');
