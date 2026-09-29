const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const consumers = ['loginWithCredentials', 'loginWithPhone', 'loginWithWechat', 'bindWechatToAccount'];
const source = fs.readFileSync(path.join(root, 'functions/_shared/wechat-auth/index.js'));
const check = process.argv.includes('--check');
for (const name of consumers) {
  const target = path.join(root, 'functions', name, '_lib/wechat-auth.js');
  if (check) {
    if (!fs.existsSync(target) || !source.equals(fs.readFileSync(target))) throw Error(`Wechat auth copy out of sync: ${name}`);
  } else {
    fs.mkdirSync(path.dirname(target), { recursive: true }); fs.writeFileSync(target, source);
  }
}
console.log(`Wechat auth shared module ${check ? 'verified' : 'synced'}: ${consumers.length} deployment packages`);
