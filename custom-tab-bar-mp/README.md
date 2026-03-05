# 小程序原生TabBar组件

这个目录包含微信小程序的自定义tabBar原生组件文件。

## 文件说明

- `index.js` - 组件逻辑（数据、方法、事件处理）
- `index.wxml` - 组件模板（UI结构）
- `index.wxss` - 组件样式（CSS）
- `index.json` - 组件配置

## 使用方式

这些文件会在编译时自动复制到小程序输出目录：
```
unpackage/dist/[dev|build]/mp-weixin/custom-tab-bar/
```

复制由 `scripts/post-build-mp-weixin.js` 脚本自动完成。

## 修改指南

1. 修改此目录下的文件
2. 运行 `node scripts/post-build-mp-weixin.js`
3. 在微信开发者工具中刷新

## 注意事项

- **不要**直接修改 `unpackage/dist/` 下的文件
- **不要**删除此目录
- **务必**将此目录提交到版本控制

## 与Vue组件的关系

- `custom-tab-bar/index.vue` - H5/App端使用
- `custom-tab-bar-mp/` - 小程序端使用

两者功能相同，但实现方式不同。
