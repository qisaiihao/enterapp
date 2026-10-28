const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const consumers = [
  'functions/loginWithCredentials', 'functions/loginWithPhone', 'functions/loginWithWechat',
  'functions/registerUser', 'functions/github-auth', '回车键新网站/cloudfunctions/webReader'
];
const source = fs.readFileSync(path.join(root, 'functions/_shared/login-audit.js'));
const check = process.argv.includes('--check');
for (const name of consumers) {
  const target = path.join(root, name, '_lib/login-audit.js');
  if (check) {
    if (!fs.existsSync(target) || !source.equals(fs.readFileSync(target))) throw Error(`Login audit copy out of sync: ${name}`);
  } else {
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, source);
  }
}
console.log(`Login audit shared module ${check ? 'verified' : 'synced'}: ${consumers.length} deployment packages`);
