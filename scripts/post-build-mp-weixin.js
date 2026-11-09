/**
 * 微信小程序编译后处理脚本
 * 1. 按 project.config.json 的 packOptions.ignore 物理删除未打包文件（字体、贴纸、未使用素材等）
 * 2. 在 vendor.js 开头注入 wx.cloud 初始化代码
 * 3. 复制自定义 tabBar 原生组件到编译输出目录（custom-tab-bar 作为唯一源码）
 *
 * 说明：packOptions.ignore 只是让微信开发者工具在打包时忽略文件，
 * 但本地构建目录仍会保留这些文件。这里额外做物理删除，确保
 * dist 和 unpackage 两种输出目录都不会把无用资源算进体积。
 */

const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const rootProjectConfigPath = path.join(rootDir, 'project.config.json');
const rootProjectPrivateConfigPath = path.join(rootDir, 'project.private.config.json');

// 支持 dev 和 build 两种模式
const modes = ['dev', 'build'];

function formatBytes(bytes) {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  let value = bytes;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex++;
  }
  return `${value.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

function assertPathInsideOutput(outputDir, targetPath) {
  const resolvedOutputDir = path.resolve(outputDir);
  const resolvedTargetPath = path.resolve(targetPath);
  const relativePath = path.relative(resolvedOutputDir, resolvedTargetPath);

  if (!relativePath || relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
    throw new Error(`拒绝删除输出目录外的路径: ${resolvedTargetPath}`);
  }
}

function collectFilesRecursive(dir) {
  const files = [];
  if (!fs.existsSync(dir)) return files;

  fs.readdirSync(dir).forEach((entryName) => {
    const entryPath = path.join(dir, entryName);
    const stat = fs.statSync(entryPath);
    if (stat.isDirectory()) {
      files.push(...collectFilesRecursive(entryPath));
      return;
    }
    if (stat.isFile()) {
      files.push({
        path: entryPath,
        size: stat.size
      });
    }
  });

  return files;
}

function readPackIgnoreRules() {
  try {
    const config = JSON.parse(fs.readFileSync(rootProjectConfigPath, 'utf8'));
    return (config.packOptions && config.packOptions.ignore) || [];
  } catch (error) {
    console.error('❌ 读取 project.config.json 打包规则失败:', error);
    return [];
  }
}

function removePackedPath(outputDir, rule) {
  const value = String(rule.value || '').replace(/^\//, '').replace(/\/$/, '');
  if (!value) return;

  const targetPath = path.join(outputDir, value);
  const label = rule.type === 'folder' ? `${value}/` : value;

  if (!fs.existsSync(targetPath)) {
    return;
  }

  assertPathInsideOutput(outputDir, targetPath);

  if (rule.type === 'file') {
    const stat = fs.statSync(targetPath);
    if (!stat.isFile()) {
      console.log(`⚠️ 跳过非文件项: ${label}`);
      return;
    }
    fs.unlinkSync(targetPath);
    console.log(`🗑️  已删除未打包文件: ${label} (${formatBytes(stat.size)})`);
    return;
  }

  if (rule.type === 'folder') {
    const stat = fs.statSync(targetPath);
    if (!stat.isDirectory()) {
      console.log(`⚠️ 跳过非目录项: ${label}`);
      return;
    }
    const files = collectFilesRecursive(targetPath);
    const totalBytes = files.reduce((sum, file) => sum + file.size, 0);
    fs.rmSync(targetPath, { recursive: true, force: true });
    console.log(`✅ 已删除目录 ${label}（${files.length} 个文件，节省 ${formatBytes(totalBytes)}）`);
  }
}

function copyProjectConfig(outputDir) {
  try {
    if (fs.existsSync(rootProjectConfigPath)) {
      fs.copyFileSync(rootProjectConfigPath, path.join(outputDir, 'project.config.json'));
      console.log('✅ 已复制 project.config.json 到输出目录');
    } else {
      console.log('⚠️ 根目录 project.config.json 不存在，无法复制');
    }

    if (fs.existsSync(rootProjectPrivateConfigPath)) {
      fs.copyFileSync(rootProjectPrivateConfigPath, path.join(outputDir, 'project.private.config.json'));
      console.log('✅ 已复制 project.private.config.json 到输出目录');
    } else {
      console.log('ℹ️ 根目录 project.private.config.json 不存在，跳过复制');
    }
  } catch (error) {
    console.error('❌ 复制项目配置失败:', error);
  }
}

function injectCloudInit(outputDir) {
  const vendorPath = path.join(outputDir, 'common/vendor.js');

  const initCode = `
// 【自动注入】微信云开发初始化
if (typeof wx !== 'undefined' && wx.cloud && !wx.cloud._kiroInitialized) {
  console.log('☁️ [vendor.js] 初始化 wx.cloud');
  try {
    wx.cloud.init({ env: 'cloud1-5gb0pbyl400845f5', traceUser: true });
    wx.cloud._kiroInitialized = true;
    console.log('✅ [vendor.js] 初始化完成');
  } catch (e) {
    console.error('❌ [vendor.js] 初始化失败:', e);
  }
}
`;

  try {
    if (!fs.existsSync(vendorPath)) {
      console.log(`⚠️ vendor.js 文件不存在: ${vendorPath}`);
      return;
    }

    const content = fs.readFileSync(vendorPath, 'utf8');
    if (content.includes('_kiroInitialized')) {
      console.log('ℹ️ vendor.js 已包含初始化代码，跳过注入');
      return;
    }

    fs.writeFileSync(vendorPath, initCode + content, 'utf8');
    console.log('✅ 已注入 wx.cloud 初始化代码到 vendor.js');
  } catch (error) {
    console.error('❌ 注入失败:', error);
  }
}

function copyTabBar(outputDir) {
  const sourceDir = path.join(rootDir, 'custom-tab-bar');
  const targetDir = path.join(outputDir, 'custom-tab-bar');
  const filesToCopy = ['index.js', 'index.wxml', 'index.wxss', 'index.json'];

  try {
    if (!fs.existsSync(sourceDir)) {
      console.log(`⚠️ 源目录不存在: ${sourceDir}`);
      return;
    }

    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
      console.log(`📁 创建目标目录: ${targetDir}`);
    }

    let copiedCount = 0;
    filesToCopy.forEach((file) => {
      const sourcePath = path.join(sourceDir, file);
      const targetPath = path.join(targetDir, file);

      if (fs.existsSync(sourcePath)) {
        fs.copyFileSync(sourcePath, targetPath);
        copiedCount++;
      } else {
        console.warn(`⚠️ 源文件不存在: ${file}`);
      }
    });

    const vueFilePath = path.join(targetDir, 'index.vue');
    if (fs.existsSync(vueFilePath)) {
      fs.unlinkSync(vueFilePath);
      console.log('🗑️  已删除 index.vue（避免干扰原生组件）');
    }

    if (copiedCount === filesToCopy.length) {
      console.log(`✅ 已复制自定义 tabBar 组件 (${copiedCount}/${filesToCopy.length} 个文件)`);
    } else {
      console.log(`⚠️ 部分文件复制失败 (${copiedCount}/${filesToCopy.length} 个文件)`);
    }
  } catch (error) {
    console.error('❌ 复制 tabBar 组件失败:', error);
  }
}

function getOutputDirs(mode) {
  return [
    path.join(rootDir, `dist/${mode}/mp-weixin`),
    path.join(rootDir, `unpackage/dist/${mode}/mp-weixin`)
  ].filter((outputDir) => fs.existsSync(outputDir));
}

function processOutputDir(mode, outputDir, ignoreRules) {
  const relativeOutput = path.relative(rootDir, outputDir).replace(/\\/g, '/');
  console.log(`\n=== 处理 ${mode} 模式: ${relativeOutput} ===`);

  copyProjectConfig(outputDir);
  injectCloudInit(outputDir);
  copyTabBar(outputDir);

  console.log('--- 清理未打包资源 ---');
  ignoreRules.forEach((rule) => {
    try {
      removePackedPath(outputDir, rule);
    } catch (error) {
      console.error(`❌ 删除 ${rule.value} 失败:`, error);
    }
  });
}

const ignoreRules = readPackIgnoreRules();

modes.forEach((mode) => {
  const outputDirs = getOutputDirs(mode);
  if (outputDirs.length === 0) {
    console.log(`\n=== 处理 ${mode} 模式 ===`);
    console.log(`ℹ️ 输出目录不存在，跳过 ${mode} 模式`);
    return;
  }

  outputDirs.forEach((outputDir) => processOutputDir(mode, outputDir, ignoreRules));
});

console.log('\n=== 处理完成 ===\n');
