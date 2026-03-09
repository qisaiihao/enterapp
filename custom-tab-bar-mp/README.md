# 小程序原生TabBar组件（已废弃）

> 当前小程序原生 tabbar 源码已迁移到 `custom-tab-bar/` 目录维护。
> 本目录仅保留历史说明，避免双份源码漂移。

这个目录曾用于存放微信小程序的自定义 tabBar 原生组件文件。

## 文件说明

- `index.js` - 组件逻辑（数据、方法、事件处理）
- `index.wxml` - 组件模板（UI结构）
- `index.wxss` - 组件样式（CSS）
- `index.json` - 组件配置

## 使用方式

请改为维护 `custom-tab-bar/` 下的 `index.js / index.wxml / index.wxss / index.json`。

## 修改指南

1. 修改 `custom-tab-bar/` 目录下对应文件
2. 运行 `node scripts/post-build-mp-weixin.js`
3. 在微信开发者工具中刷新

## 注意事项

- **不要**直接修改 `unpackage/dist/` 下的文件
- **不要**依赖本目录作为小程序 tabbar 的主源码
- **务必**以 `custom-tab-bar/` 为唯一维护来源

## 与Vue组件的关系

- `custom-tab-bar/index.vue` - H5/App 端使用
- `custom-tab-bar/index.js|wxml|wxss|json` - 小程序端使用

同目录下按平台分别生效，避免两套目录维护。
