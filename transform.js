const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// 1. 配置你的源目录和目标目录（注意 Windows 路径要用双斜杠 \\）
const srcDir = 'C:\\Users\\86199\\app\\回车键_uni';
const destDir = 'C:\\Users\\86199\\app\\回车键Vue3';

// 2. 需要忽略的目录（避免卡死、报错或复制无用编译文件）
const ignoreDirs =['node_modules', '.git', 'unpackage', 'dist', '.hbuilderx'];

// 递归遍历文件夹的核心函数
function walkDir(dir, callback) {
    const files = fs.readdirSync(dir);
    for (let f of files) {
        const dirPath = path.join(dir, f);
        const isDirectory = fs.statSync(dirPath).isDirectory();

        if (isDirectory) {
            if (ignoreDirs.includes(f)) continue; // 跳过忽略的文件夹
            walkDir(dirPath, callback);
        } else {
            callback(dirPath);
        }
    }
}

console.log('🚀 开始扫描并处理文件，请耐心等待（可能需要几分钟）...\n');

// 确保目标根目录存在
if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
}

let vueCount = 0;
let otherCount = 0;

walkDir(srcDir, (filePath) => {
    // 计算相对路径
    const relativePath = path.relative(srcDir, filePath);
    const destFilePath = path.join(destDir, relativePath);

    // 确保目标文件的父目录存在
    const destFileDir = path.dirname(destFilePath);
    if (!fs.existsSync(destFileDir)) {
        fs.mkdirSync(destFileDir, { recursive: true });
    }

    const ext = path.extname(filePath).toLowerCase();

    if (ext === '.vue') {
        console.log(`⏳ [转换中] ${relativePath}`);
        try {
            // 调用 gogocode 转换单文件并输出到目标路径
            const cmd = `gogocode -s "${filePath}" -t gogocode-plugin-vue -o "${destFilePath}"`;
            // stdio: 'pipe' 用于屏蔽过多的控制台输出，只在报错时显示
            execSync(cmd, { stdio: 'pipe' });
            vueCount++;
        } catch (error) {
            console.error(`\n❌ [转换失败] ${relativePath}`);
            if (error.stdout) console.error(error.stdout.toString());
            if (error.stderr) console.error(error.stderr.toString());
        }
    } else {
        // 遇到 js / json / css / 图片 等文件，直接原生复制
        fs.copyFileSync(filePath, destFilePath);
        otherCount++;
    }
});

console.log(`\n🎉 全部处理完成！`);
console.log(`✅ 共成功转换 Vue 文件: ${vueCount} 个`);
console.log(`✅ 共原样复制其他文件: ${otherCount} 个`);
console.log(`📁 请前往查看: ${destDir}`);