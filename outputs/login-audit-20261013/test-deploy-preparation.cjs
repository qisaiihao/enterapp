const assert = require('node:assert/strict');
const { compareOnlineEntries, checkSyntax, configurationSha, indexes, validateVerifiedReceipt } = require('./deploy-login-audit.cjs');

const originalEntries = new Map([
  ['index.js', { sha256: 'before' }],
  ['node_modules/dependency.js', { sha256: 'dependency-unchanged' }],
  ['package.json', { sha256: 'package-unchanged' }]
]);
const packageEntries = new Map([
  ['index.js', { sha256: 'after' }],
  ['_lib/login-audit.js', { sha256: 'helper' }]
]);
const item = { name: 'fixture', originalEntries, packageEntries };
assert.equal(compareOnlineEntries(item, new Map(originalEntries)), 'baseline');
const deployedEntries = new Map([...originalEntries, ...packageEntries]);
assert.equal(compareOnlineEntries(item, deployedEntries), 'already-deployed');
const previousItem = { ...item, previousVerifiedFiles: { 'index.js': 'previous-index', '_lib/login-audit.js': 'previous-helper' } };
const previousEntries = new Map([...originalEntries, ['index.js', { sha256: 'previous-index' }], ['_lib/login-audit.js', { sha256: 'previous-helper' }]]);
assert.equal(compareOnlineEntries(previousItem, previousEntries), 'previous-deployment');
assert.equal(compareOnlineEntries(previousItem, deployedEntries), 'already-deployed');
assert.equal(compareOnlineEntries(previousItem, new Map(originalEntries)), 'baseline');
assert.throws(() => compareOnlineEntries(item, previousEntries), error => error.code === 'ONLINE_AUDIT_FILE_DRIFT');
const mixedVersion = new Map(previousEntries);
mixedVersion.set('_lib/login-audit.js', { sha256: 'helper' });
assert.throws(() => compareOnlineEntries(previousItem, mixedVersion), error => error.code === 'ONLINE_AUDIT_FILE_DRIFT');
const changedPreviousDependency = new Map(previousEntries);
changedPreviousDependency.set('node_modules/dependency.js', { sha256: 'changed' });
assert.throws(() => compareOnlineEntries(previousItem, changedPreviousDependency), error => error.code === 'ONLINE_OTHER_FILE_DRIFT');
for (const [name, value, code] of [
  ['node_modules/dependency.js', { sha256: 'changed' }, 'ONLINE_OTHER_FILE_DRIFT'],
  ['unapproved.js', { sha256: 'new' }, 'ONLINE_NEW_FILE_DRIFT'],
  ['index.js', { sha256: 'unexpected-local-change' }, 'ONLINE_AUDIT_FILE_DRIFT']
]) {
  const entries = new Map(deployedEntries);
  entries.set(name, value);
  assert.throws(() => compareOnlineEntries(item, entries), error => error.code === code);
}
const missingDependency = new Map(deployedEntries);
missingDependency.delete('node_modules/dependency.js');
assert.throws(() => compareOnlineEntries(item, missingDependency), error => error.code === 'ONLINE_OTHER_FILE_DRIFT');
const partial = new Map(deployedEntries);
partial.delete('_lib/login-audit.js');
assert.throws(() => compareOnlineEntries(item, partial), error => error.code === 'ONLINE_AUDIT_FILE_DRIFT');
checkSyntax('fixture', 'const value = { ...source };', 'Nodejs10.15');
assert.throws(() => checkSyntax('fixture', 'const value = source?.field;', 'Nodejs10.15'), error => error.code === 'RUNTIME_SYNTAX_MISMATCH');
assert.throws(() => checkSyntax('fixture', 'const value = crypto.randomUUID();', 'Nodejs10.15'), error => error.code === 'RUNTIME_API_MISMATCH');
const config = { Runtime: 'Nodejs10.15', Timeout: 3, Environment: { Variables: [{ Key: 'example', Value: 'first' }] }, Triggers: [] };
assert.notEqual(configurationSha(config), configurationSha({ ...config, Environment: { Variables: [{ Key: 'example', Value: 'changed' }] } }));
assert.notEqual(configurationSha(config), configurationSha({ ...config, Triggers: [{ Type: 'http' }] }));
assert.equal(indexes.length, 4);
assert.ok(indexes.every(index => index.keys[index.keys.length - 1][0] === 'loginTime' && index.keys[index.keys.length - 1][1] === '-1'));
assert.throws(() => validateVerifiedReceipt({ mode: 'apply', status: 'failed', envId: 'fixture' }, 'fixture'), error => error.code === 'UNVERIFIED_PREVIOUS_RECEIPT');
const verifiedNames = ['loginWithCredentials', 'loginWithPhone', 'loginWithWechat', 'registerUser', 'github-auth', 'webReader'];
const verifiedReceipt = { mode: 'apply', status: 'complete', envId: 'fixture',
  functions: verifiedNames.map(name => ({ name, files: { 'index.js': 'a'.repeat(64), '_lib/login-audit.js': 'b'.repeat(64) } })),
  events: verifiedNames.map(name => ({ name, status: 'deployed-verified' })) };
assert.equal(validateVerifiedReceipt(verifiedReceipt, 'fixture'), verifiedReceipt);
assert.throws(() => validateVerifiedReceipt(verifiedReceipt, 'another-environment'), error => error.code === 'UNVERIFIED_PREVIOUS_RECEIPT');
assert.throws(() => validateVerifiedReceipt({ ...verifiedReceipt, events: verifiedReceipt.events.slice(1) }, 'fixture'), error => error.code === 'PREVIOUS_RECEIPT_NOT_VERIFIED');
assert.throws(() => validateVerifiedReceipt({ ...verifiedReceipt, functions: verifiedReceipt.functions.map(item => ({ ...item, files: { 'index.js': 'a'.repeat(64) } })) }, 'fixture'), error => error.code === 'PREVIOUS_RECEIPT_FILES_INVALID');
console.log('Deployment preparation safety checks passed.');
