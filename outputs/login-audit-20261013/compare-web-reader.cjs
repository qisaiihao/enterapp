const fs = require('node:fs');
const path = require('node:path');
const { execFileSync, spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '../..');
const cliModules = path.join(process.env.CLOUDBASE_GLOBAL_ROOT || path.join(process.env.APPDATA, 'npm/node_modules'), '@cloudbase/cli/node_modules');
const AdmZip = require(path.join(cliModules, 'adm-zip'));
const zip = new AdmZip(path.join(__dirname, 'cloud-before/webReader.zip'));
const remote = zip.getEntry('index.js').getData().toString('utf8').replace(/\r\n/g, '\n');
const baseline = execFileSync('git', ['show', 'HEAD:回车键新网站/cloudfunctions/webReader/index.js'], {
  cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore']
}).replace(/\r\n/g, '\n');
const baselineFile = path.join(__dirname, 'cloud-before/webReader-index-git-head.js');
const remoteFile = path.join(__dirname, 'cloud-before/webReader-index-remote.js');
fs.writeFileSync(baselineFile, baseline);
fs.writeFileSync(remoteFile, remote);
const result = spawnSync('git', ['diff', '--no-index', '--unified=0', baselineFile, remoteFile], { cwd: root, encoding: 'utf8' });
if (result.status > 1) throw new Error('Diff failed');
const lines = result.stdout.split('\n');
const safeLine = line => {
  if (/process\.env|secret|credential|token|password|access.?key/i.test(line)) return '[sensitive-related line omitted]';
  return line.replace(/(['"`])(?:\\.|(?!\1).)*?\1/g, '[string]');
};
const changed = lines.filter(line => /^[-+]/.test(line) && !/^---|^\+\+\+/.test(line));
const summary = {
  name: 'webReader', added: changed.filter(line => line[0] === '+').length,
  removed: changed.filter(line => line[0] === '-').length,
  hunks: lines.filter(line => line.startsWith('@@')),
  redactedChangedStatements: changed.map(safeLine)
};
fs.writeFileSync(path.join(__dirname, 'web-reader-drift-summary.json'), JSON.stringify(summary, null, 2));
console.log(JSON.stringify(summary, null, 2));
