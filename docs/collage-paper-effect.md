# 撕纸边缘实现与来源

## 参考源码

- [TornPaper.js / happy358](https://github.com/happy358/TornPaper)，[源码](https://github.com/happy358/TornPaper/blob/main/tornpaper.js)，[MIT 许可](https://github.com/happy358/TornPaper/blob/main/LICENSE)。主要参考其噪声位移、轻微柔化、纹理分层的处理思路。
- [Alex Walker 的 SVG 纸张纹理示例](https://gist.github.com/alexmwalker/b404eaa69c458076b7662ddb11fc244f)：参考纹理沿边界叠加的思路。
- [Brendan Sparrow 的 Torn Edges using SVG](https://codepen.io/brendansparrow/pen/QXZGLx)：参考多层噪声生成轮廓的方式。

上述参考实现使用 SVG。工作台要将效果写入透明 PNG，并同时支持 App、微信小程序和 H5，因此 `utils/collage/tornPaper.js` 是独立编写的 Canvas 像素处理适配，没有直接复制这些项目的源码，也不依赖浏览器 SVG 滤镜。

## 新版效果（edgeVersion = 2）

1. 连续、多尺度噪声产生宽缓起伏和细小缺口，替代等间距随机折线。
2. 实体边缘外侧加入稀疏、稍带倾斜的半透明纤维。
3. 极窄的边缘断面随位置略微提亮，保留原纸色，不加均匀白描边。
4. 中央区域不做模糊、位移或纹理叠加，保持文字、照片像素原样。
5. 只处理四块互不重叠的边缘条带，单次像素数据传输上限约 144 KiB（最长边 1600 px），避免整张图来回传输。

固定随机种子可重现相同结果；换一种撕边、新建纸片时沿用工作台原有随机切换逻辑。

新纸片保存 `edgeVersion: 2`。既有 PNG、画布和导出不会自动重绘。

## 验证

- `npm run test:collage-studio` 包含像素确定性、透明纤维、中央原色保留、小尺寸边界、条带不重叠、原生 Canvas 调用顺序及失败处理测试。原生 API 使用模拟环境。
- `npm run test:collage-browser` 使用真实浏览器验证裁切、保存和随机切换，并生成 `unpackage/collage-tests/torn-edge-comparison.png`。对比图左列为旧效果，右列为新版；各纸片下方展示 4 倍边缘细节。
- App／微信小程序真机的像素读写与最终视觉效果仍需验收。
