const path = require('path');
const { spawn } = require('child_process');

const rootDir = path.resolve(__dirname, '..');

process.env.UNI_INPUT_DIR = process.env.UNI_INPUT_DIR || rootDir;
process.env.VITE_ROOT_DIR = process.env.VITE_ROOT_DIR || rootDir;

const uniBin = require.resolve('@dcloudio/vite-plugin-uni/bin/uni.js', {
  paths: [rootDir]
});

const child = spawn(process.execPath, [uniBin, ...process.argv.slice(2)], {
  cwd: rootDir,
  env: process.env,
  stdio: 'inherit'
});

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 0);
});
