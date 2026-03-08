#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = process.cwd();
const TEXT_EXTS = new Set(['.js', '.ts', '.vue', '.json', '.md', '.css', '.scss', '.html']);
const IGNORE_DIRS = new Set([
  '.git',
  'node_modules',
  'uni_modules',
  'unpackage',
  '.hbuilderx',
  '.kiro',
  '.claude',
  '.vscode',
  'cache',
  '.tmp-adminManager-deploy-1772786047',
  '.tmp-getPostList-min-1772786521',
  '.tmp-getPostList-min2-1772786575'
]);

const mojibakePatterns = [
  /鍥剧/,
  /鍙栨秷/,
  /鎴戞/,
  /澶辫触/,
  /馃/,
  /锟/,
  /鏃犳硶/,
  /绠＄悊/,
  /ï¿½/
];
const MOJIBAKE_PATTERN_EXEMPT_FILES = new Set([
  'docs/general-code-style-guide.md',
  'docs/encoding-and-mojibake-guide.md',
  'scripts/check-encoding.js'
]);

function shouldIgnoreDir(absPath) {
  const rel = path.relative(ROOT, absPath).replace(/\\/g, '/');
  if (!rel) return false;
  const parts = rel.split('/');
  if (parts.some((part) => IGNORE_DIRS.has(part))) return true;
  if (rel.startsWith('functions/') && rel.includes('/node_modules/')) return true;
  return false;
}

function collectFiles(dir, out = []) {
  if (shouldIgnoreDir(dir)) return out;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      collectFiles(abs, out);
      continue;
    }
    if (!entry.isFile()) continue;
    if (!TEXT_EXTS.has(path.extname(entry.name).toLowerCase())) continue;
    out.push(abs);
  }
  return out;
}

function parseStatusPath(entry) {
  if (!entry) {
    return null;
  }

  // renamed entry: "old -> new"
  const arrowIndex = entry.indexOf(' -> ');
  if (arrowIndex >= 0) {
    return entry.slice(arrowIndex + 4);
  }
  return entry;
}

function collectChangedFiles() {
  const result = spawnSync('git', ['status', '--porcelain'], {
    cwd: ROOT,
    encoding: 'utf8'
  });

  // 某些受限环境不允许在 Node 中 spawn 子进程
  if (result.error && result.error.code === 'EPERM') {
    const raw = process.env.CHECK_FILES || '';
    if (!raw.trim()) {
      return [];
    }
    return raw
      .split(/\r?\n|;/)
      .map((item) => item.trim())
      .filter(Boolean)
      .map((relPath) => path.join(ROOT, relPath.replace(/\\/g, '/')))
      .filter((absPath) => fs.existsSync(absPath) && fs.statSync(absPath).isFile());
  }

  if (result.status !== 0) {
    return [];
  }

  const out = [];
  const seen = new Set();
  const lines = (result.stdout || '').split(/\r?\n/).filter(Boolean);

  for (const line of lines) {
    if (line.length < 4) {
      continue;
    }
    const status = line.slice(0, 2);
    const rawPath = line.slice(3).trim();
    const relPath = parseStatusPath(rawPath);

    if (!relPath) {
      continue;
    }
    if (status.includes('D')) {
      continue;
    }

    const normalized = relPath.replace(/\\/g, '/');
    const absPath = path.join(ROOT, normalized);
    if (!fs.existsSync(absPath) || !fs.statSync(absPath).isFile()) {
      continue;
    }

    const ext = path.extname(normalized).toLowerCase();
    if (!TEXT_EXTS.has(ext)) {
      continue;
    }
    if (shouldIgnoreDir(path.dirname(absPath))) {
      continue;
    }

    if (!seen.has(absPath)) {
      seen.add(absPath);
      out.push(absPath);
    }
  }

  return out;
}

function checkFile(absPath) {
  const rel = path.relative(ROOT, absPath).replace(/\\/g, '/');
  const buf = fs.readFileSync(absPath);
  const text = buf.toString('utf8');
  const issues = [];

  if (buf.length >= 3 && buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf) {
    issues.push('contains UTF-8 BOM');
  }

  if (text.includes('\uFFFD')) {
    issues.push('contains replacement character (U+FFFD), possible invalid encoding');
  }

  if (/\r\n/.test(text) && /(^|[^\r])\n/.test(text)) {
    issues.push('mixed line endings (CRLF and LF)');
  }

  const hasAnyNewline = /\r\n|\n/.test(text);
  if (text.length > 0 && hasAnyNewline && !/\n$/.test(text)) {
    issues.push('missing final newline');
  }

  if (!MOJIBAKE_PATTERN_EXEMPT_FILES.has(rel)) {
    for (const pattern of mojibakePatterns) {
      if (pattern.test(text)) {
        issues.push(`contains possible mojibake pattern: ${pattern}`);
        break;
      }
    }
  }

  return { rel, issues };
}

function main() {
  const args = new Set(process.argv.slice(2));
  const checkAll = args.has('--all') || process.env.CHECK_ENCODING_SCOPE === 'all';

  let files = [];
  if (checkAll) {
    files = collectFiles(ROOT);
  } else {
    files = collectChangedFiles();
  }

  if (files.length === 0) {
    console.log(`[check-encoding] PASS (no files to check, scope=${checkAll ? 'all' : 'changed'})`);
    return;
  }

  const problems = [];

  for (const file of files) {
    const result = checkFile(file);
    if (result.issues.length > 0) {
      problems.push(result);
    }
  }

  if (problems.length === 0) {
    console.log(`[check-encoding] PASS (${files.length} files checked, scope=${checkAll ? 'all' : 'changed'})`);
    return;
  }

  console.error(`[check-encoding] FAIL (${problems.length} files with issues, scope=${checkAll ? 'all' : 'changed'})`);
  for (const p of problems) {
    console.error(`- ${p.rel}`);
    for (const issue of p.issues) {
      console.error(`  - ${issue}`);
    }
  }
  process.exitCode = 1;
}

main();
