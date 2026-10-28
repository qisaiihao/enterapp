# 活动分类图标

- `campus.svg`：基于用户提供的 `school-2.svg`。
- `weekly.svg`：基于用户提供的 `cartoon-newspaper-front-page.svg`。
- `market.svg`：基于用户提供的 `shop.svg`。
- `coming-soon.svg`：为“待开发”绘制的施工路障。

前三项保留原素材轮廓，统一为 `#222222`，调整描边与方形画布留白。SVG 是可编辑源文件，同名 PNG 是由 SVG 导出的 192 × 192 透明图像，页面使用 PNG 以兼容 App、H5 和小程序。

修改 SVG 后需同步重新导出同名 PNG。`ActivityCategoryBar.vue` 通过现有 `--app-activity-entry-icon-filter` 适配深色模式；图标下方的标签使用 22rpx 小字。
