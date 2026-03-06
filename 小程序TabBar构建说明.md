# 小程序TabBar构建说明

## 文件结构

```
项目根目录/
├── custom-tab-bar/              # Vue组件（H5/App使用）
│   └── index.vue
├── custom-tab-bar-mp/           # 小程序原生组件源文件
│   ├── index.js
│   ├── index.wxml
│   ├── index.wxss
│   └── index.json
├── scripts/
│   └── post-build-mp-weixin.js  # 构建后处理脚本
└── unpackage/dist/
    ├── dev/mp-weixin/           # 开发模式输出
    └── build/mp-weixin/         # 生产模式输出
        └── custom-tab-bar/      # 自动复制的原生组件
            ├── index.js
            ├── index.wxml
            ├── index.wxss
            ├── index.json
            └── index.vue        # uni-app编译的（不影响）
```

## 构建流程

### 1. uni-app编译
当你在HBuilderX中点击"运行"或"发行"到微信小程序时：
- uni-app会编译Vue组件到 `unpackage/dist/[dev|build]/mp-weixin/`
- `custom-tab-bar/index.vue` 会被编译到输出目录

### 2. 自动后处理
编译完成后，`scripts/post-build-mp-weixin.js` 会自动执行：
- 复制 `custom-tab-bar-mp/` 下的4个原生组件文件
- 覆盖到编译输出目录的 `custom-tab-bar/`
- 同时处理 dev 和 build 两种模式

### 3. 最终结果
编译输出目录会同时包含：
- index.vue（uni-app编译的，小程序会忽略）
- index.js/wxml/wxss/json（原生组件，小程序会使用这些）

## 如何使用

### 方式1：HBuilderX自动执行（推荐）

在HBuilderX中配置自动执行脚本：

1. 打开 `manifest.json`
2. 找到"mp-weixin"配置
3. 添加构建钩子（如果支持）

或者在 `package.json` 中配置：
```json
{
  "scripts": {
    "dev:mp-weixin": "cross-env NODE_ENV=development UNI_PLATFORM=mp-weixin vue-cli-service uni-build --watch && node scripts/post-build-mp-weixin.js",
    "build:mp-weixin": "cross-env NODE_ENV=production UNI_PLATFORM=mp-weixin vue-cli-service uni-build && node scripts/post-build-mp-weixin.js"
  }
}
```

### 方式2：手动执行

每次编译后手动运行：
```bash
node scripts/post-build-mp-weixin.js
```

### 方式3：使用文件监听（开发模式）

安装 nodemon：
```bash
npm install -D nodemon
```

创建监听脚本 `scripts/watch-build.js`：
```javascript
const chokidar = require('chokidar');
const { execSync } = require('child_process');

const watcher = chokidar.watch('unpackage/dist/*/mp-weixin/app.json', {
  persistent: true
});

watcher.on('change', () => {
  console.log('检测到编译完成，执行后处理...');
  execSync('node scripts/post-build-mp-weixin.js', { stdio: 'inherit' });
});

console.log('开始监听编译输出...');
```

## 修改原生组件

如果需要修改小程序tabBar的样式或逻辑：

1. **修改源文件**：编辑 `custom-tab-bar-mp/` 下的文件
2. **运行脚本**：执行 `node scripts/post-build-mp-weixin.js`
3. **刷新小程序**：在微信开发者工具中刷新

**注意**：不要直接修改 `unpackage/dist/` 下的文件，因为每次编译都会被覆盖。

## 修改Vue组件

如果需要修改H5/App端的tabBar：

1. **修改文件**：编辑 `custom-tab-bar/index.vue`
2. **重新编译**：HBuilderX会自动编译

## 故障排除

### 问题1：tabBar不显示

检查编译输出目录：
```bash
ls -la unpackage/dist/build/mp-weixin/custom-tab-bar/
```

应该看到5个文件：
- index.js ✓
- index.wxml ✓
- index.wxss ✓
- index.json ✓
- index.vue（可选）

如果缺少原生组件文件，手动运行：
```bash
node scripts/post-build-mp-weixin.js
```

### 问题2：修改不生效

1. 确认修改的是 `custom-tab-bar-mp/` 下的文件
2. 运行后处理脚本
3. 在微信开发者工具中点击"编译"

### 问题3：脚本执行失败

检查源文件是否存在：
```bash
ls -la custom-tab-bar-mp/
```

应该看到4个文件：
- index.js
- index.wxml
- index.wxss
- index.json

## 版本控制

### 需要提交的文件
```
custom-tab-bar/index.vue
custom-tab-bar-mp/index.js
custom-tab-bar-mp/index.wxml
custom-tab-bar-mp/index.wxss
custom-tab-bar-mp/index.json
scripts/post-build-mp-weixin.js
```

### 不需要提交的文件（.gitignore）
```
unpackage/
```

## 自动化建议

### 使用 npm scripts

在 `package.json` 中添加：
```json
{
  "scripts": {
    "postbuild:mp-weixin": "node scripts/post-build-mp-weixin.js",
    "copy-tabbar": "node scripts/post-build-mp-weixin.js"
  }
}
```

使用：
```bash
npm run copy-tabbar
```

### 使用 Git Hooks

安装 husky：
```bash
npm install -D husky
```

配置 pre-commit hook：
```json
{
  "husky": {
    "hooks": {
      "pre-commit": "node scripts/post-build-mp-weixin.js"
    }
  }
}
```

## 技术原理

### 为什么需要这样做？

1. **uni-app的限制**
   - uni-app会编译 `custom-tab-bar/` 下的Vue文件
   - 但小程序需要原生组件（Component）
   - 两者不能共存于同一目录

2. **解决方案**
   - 源文件分离：Vue组件和原生组件分开存放
   - 构建时合并：编译后自动复制原生组件
   - 小程序优先：小程序会优先使用原生组件文件

### 为什么index.vue不影响？

微信小程序加载自定义tabBar时：
1. 首先查找 `custom-tab-bar/index.js`
2. 如果找到，就使用原生组件
3. 忽略其他文件（如index.vue）

所以即使目录中有index.vue，小程序也会正确使用原生组件。

## 参考

- [微信小程序自定义tabBar](https://developers.weixin.qq.com/miniprogram/dev/framework/ability/custom-tabbar.html)
- [uni-app构建钩子](https://uniapp.dcloud.net.cn/collocation/package.html)
