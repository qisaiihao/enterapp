/**
 * 微信小程序编译后处理脚本
 * 1. 在 vendor.js 开头注入 wx.cloud 初始化代码
 * 2. 复制自定义 tabBar 原生组件到编译输出目录
 */

const fs = require('fs');
const path = require('path');

// 支持 dev 和 build 两种模式
const modes = ['dev', 'build'];

modes.forEach(mode => {
  console.log(`\n=== 处理 ${mode} 模式 ===`);
  
  // 1. 注入 wx.cloud 初始化代码
  const vendorPath = path.join(__dirname, `../unpackage/dist/${mode}/mp-weixin/common/vendor.js`);

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
    if (fs.existsSync(vendorPath)) {
      const content = fs.readFileSync(vendorPath, 'utf8');
      
      // 检查是否已经注入过
      if (!content.includes('_kiroInitialized')) {
        const newContent = initCode + content;
        fs.writeFileSync(vendorPath, newContent, 'utf8');
        console.log('✅ 已注入 wx.cloud 初始化代码到 vendor.js');
      } else {
        console.log('ℹ️ vendor.js 已包含初始化代码，跳过注入');
      }
    } else {
      console.log(`⚠️ vendor.js 文件不存在: ${vendorPath}`);
    }
  } catch (error) {
    console.error('❌ 注入失败:', error);
  }

  // 2. 复制自定义 tabBar 原生组件
  const sourceDir = path.join(__dirname, '../custom-tab-bar-mp');
  const targetDir = path.join(__dirname, `../unpackage/dist/${mode}/mp-weixin/custom-tab-bar`);

  const filesToCopy = ['index.js', 'index.wxml', 'index.wxss', 'index.json'];

  try {
    // 检查源目录是否存在
    if (!fs.existsSync(sourceDir)) {
      console.log(`⚠️ 源目录不存在: ${sourceDir}`);
      return;
    }

    // 确保目标目录存在
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
      console.log(`📁 创建目标目录: ${targetDir}`);
    }

    // 复制每个文件
    let copiedCount = 0;
    filesToCopy.forEach(file => {
      const sourcePath = path.join(sourceDir, file);
      const targetPath = path.join(targetDir, file);
      
      if (fs.existsSync(sourcePath)) {
        fs.copyFileSync(sourcePath, targetPath);
        copiedCount++;
      } else {
        console.warn(`⚠️ 源文件不存在: ${file}`);
      }
    });

    // 删除可能干扰的 index.vue 文件
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
});

console.log('\n=== 处理完成 ===\n');
