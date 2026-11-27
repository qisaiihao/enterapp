const fs = require('node:fs');
const path = require('node:path');

const functions = path.join(__dirname, '../functions');
const consumers = ['createUser', 'updateUser', 'updateUserProfile', 'registerUser', 'loginWithWechat'];
const source = fs.readFileSync(path.join(functions, '_shared/poem-id.js'));
const check = process.argv.includes('--check');

for (const name of consumers) {
  const target = path.join(functions, name, '_lib/poem-id.js');
  if (check) {
    if (!fs.existsSync(target) || !source.equals(fs.readFileSync(target))) throw Error(`Poem ID helper out of sync: ${name}`);
  } else {
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, source);
  }
}
console.log(`Poem ID helper ${check ? 'verified' : 'synced'}: ${consumers.length} deployment packages`);
