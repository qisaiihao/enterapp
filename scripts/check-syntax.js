#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawnSync } = require('child_process');
const vm = require('vm');

const ROOT = process.cwd();
const IGNORE_DIRS = new Set([
  '.git',
  'node_modules',
  'uni_modules',
  'unpackage',
  '.hbuilderx',
  '.kiro',
  '.claude',
  '.vscode',
  'cache'
]);

const TARGET_DIRS = [
  'pages',
  'pages-admin',
  'pages-content',
  'pages-tools',
  'pages-user',
  'components',
  'utils',
  'api-cache',
  'functions',
  'scripts'
];

function parseStatusPath(entry) {
  if (!entry) return null;
  const arrowIndex = entry.indexOf(' -> ');
  if (arrowIndex >= 0) {
    return entry.slice(arrowIndex + 4);
  }
  return entry;
}

function shouldIgnoreDir(absPath) {
  const rel = path.relative(ROOT, absPath).replace(/\\/g, '/');
  if (!rel) return false;
  const parts = rel.split('/');
  if (parts.some((part) => IGNORE_DIRS.has(part))) return true;
  if (rel.startsWith('functions/') && rel.includes('/node_modules/')) return true;
  return false;
}

function collectChangedByExt(ext) {
  const result = spawnSync('git', ['status', '--porcelain'], {
    cwd: ROOT,
    encoding: 'utf8'
  });

  if (result.error && result.error.code === 'EPERM') {
    const raw = process.env.CHECK_FILES || '';
    if (!raw.trim()) {
      return [];
    }

    const out = [];
    const seen = new Set();
    const paths = raw
      .split(/\r?\n|;/)
      .map((item) => item.trim())
      .filter(Boolean);

    for (const relPath of paths) {
      const normalized = relPath.replace(/\\/g, '/');
      const absPath = path.join(ROOT, normalized);
      if (!fs.existsSync(absPath) || !fs.statSync(absPath).isFile()) continue;
      if (path.extname(normalized).toLowerCase() !== ext) continue;
      if (shouldIgnoreDir(path.dirname(absPath))) continue;
      if (!seen.has(absPath)) {
        seen.add(absPath);
        out.push(absPath);
      }
    }
    return out;
  }

  if (result.status !== 0) {
    return [];
  }

  const out = [];
  const seen = new Set();
  const lines = (result.stdout || '').split(/\r?\n/).filter(Boolean);
  for (const line of lines) {
    if (line.length < 4) continue;
    const status = line.slice(0, 2);
    if (status.includes('D')) continue;

    const relPath = parseStatusPath(line.slice(3).trim());
    if (!relPath) continue;

    const normalized = relPath.replace(/\\/g, '/');
    const absPath = path.join(ROOT, normalized);
    if (!fs.existsSync(absPath) || !fs.statSync(absPath).isFile()) continue;
    if (path.extname(normalized).toLowerCase() !== ext) continue;
    if (shouldIgnoreDir(path.dirname(absPath))) continue;

    if (!seen.has(absPath)) {
      seen.add(absPath);
      out.push(absPath);
    }
  }
  return out;
}

function collectByExt(startDir, ext, out = []) {
  if (!fs.existsSync(startDir) || shouldIgnoreDir(startDir)) return out;
  const entries = fs.readdirSync(startDir, { withFileTypes: true });
  for (const entry of entries) {
    const abs = path.join(startDir, entry.name);
    if (entry.isDirectory()) {
      collectByExt(abs, ext, out);
      continue;
    }
    if (entry.isFile() && path.extname(entry.name).toLowerCase() === ext) {
      out.push(abs);
    }
  }
  return out;
}

function transpileModuleLikeSyntax(source) {
  return source
    .replace(/^\uFEFF/, '')
    // side-effect imports & named/default imports
    .replace(/^[ \t]*import[\s\S]*?;[ \t]*$/gm, '')
    .replace(/^[ \t]*export[ \t]+default[ \t]+/gm, 'module.exports = ')
    .replace(/^[ \t]*export[ \t]+async[ \t]+function[ \t]+/gm, 'async function ')
    .replace(/^[ \t]*export[ \t]+(const|let|var|function|class)[ \t]+/gm, '$1 ')
    .replace(/^[ \t]*export[ \t]*\{[\s\S]*?\}[ \t]*;?[ \t]*$/gm, '');
}

function runInProcessCheck(source, filePath) {
  const transformed = transpileModuleLikeSyntax(source);
  try {
    new vm.Script(transformed, { filename: filePath });
    return { status: 0, stderr: '', stdout: '' };
  } catch (error) {
    return {
      status: 1,
      stderr: error && error.stack ? error.stack : String(error),
      stdout: ''
    };
  }
}

function runNodeCheck(filePath) {
  const result = spawnSync(process.execPath, ['--check', filePath], {
    cwd: ROOT,
    encoding: 'utf8'
  });

  // 某些受限环境不允许在 Node 进程中再 spawn Node（EPERM）
  if (result.error && result.error.code === 'EPERM') {
    const source = fs.readFileSync(filePath, 'utf8');
    return runInProcessCheck(source, filePath);
  }

  return result;
}

function checkJsFiles({ checkAll = false } = {}) {
  const jsFiles = checkAll ? (() => {
    const all = [];
    for (const dir of TARGET_DIRS) {
      collectByExt(path.join(ROOT, dir), '.js', all);
    }
    return all;
  })() : collectChangedByExt('.js');

  if (jsFiles.length === 0) {
    return { total: 0, failures: [] };
  }

  const failures = [];
  for (const file of jsFiles) {
    const result = runNodeCheck(file);
    if (result.status !== 0) {
      failures.push({ file, stderr: result.stderr || result.stdout || 'Unknown error' });
    }
  }

  return { total: jsFiles.length, failures };
}

function checkVueScripts({ checkAll = false } = {}) {
  const vueFiles = checkAll ? (() => {
    const all = [];
    for (const dir of TARGET_DIRS) {
      collectByExt(path.join(ROOT, dir), '.vue', all);
    }
    return all;
  })() : collectChangedByExt('.vue');

  if (vueFiles.length === 0) {
    return { total: 0, failures: [] };
  }

  const failures = [];
  for (const file of vueFiles) {
    const content = fs.readFileSync(file, 'utf8');
    const match = content.match(/<script[^>]*>([\s\S]*?)<\/script>/i);
    if (!match) continue;

    const tempFile = path.join(os.tmpdir(), `codex-vue-check-${Date.now()}-${Math.random().toString(36).slice(2)}.js`);
    fs.writeFileSync(tempFile, match[1], 'utf8');

    const result = runNodeCheck(tempFile);
    fs.unlinkSync(tempFile);

    if (result.status !== 0) {
      failures.push({ file, stderr: result.stderr || result.stdout || 'Unknown error' });
    }
  }

  return { total: vueFiles.length, failures };
}

function main() {
  const args = new Set(process.argv.slice(2));
  const checkAll = args.has('--all');

  const jsResult = checkJsFiles({ checkAll });
  const vueResult = checkVueScripts({ checkAll });
  const allFailures = [...jsResult.failures, ...vueResult.failures];

  if (jsResult.total === 0 && vueResult.total === 0) {
    console.log(`[check-syntax] PASS (no files to check, scope=${checkAll ? 'all' : 'changed'})`);
    return;
  }

  if (allFailures.length === 0) {
    console.log(`[check-syntax] PASS (js: ${jsResult.total}, vue: ${vueResult.total}, scope=${checkAll ? 'all' : 'changed'})`);
    return;
  }

  console.error(`[check-syntax] FAIL (${allFailures.length} files, scope=${checkAll ? 'all' : 'changed'})`);
  for (const failure of allFailures) {
    const rel = path.relative(ROOT, failure.file).replace(/\\/g, '/');
    console.error(`- ${rel}`);
    console.error(failure.stderr.trim());
  }

  process.exitCode = 1;
}

main();
