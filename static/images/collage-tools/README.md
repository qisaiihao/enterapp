# 拼贴工具图标

本目录六个图标为项目自绘 SVG，参考 [Koboyo Original 图标](https://koboyo.com/icons/original) 和项目已有 `static/images/newicons/` 的黑色、轻微不规则线条风格，没有复制站点的图形路径。

- `move`：手掌，表示移动图片模式。
- `rotate`：弧形箭头与纸张，表示旋转原图。
- `shuffle`：骰子，表示随机更换撕纸边缘。
- `bring-front` / `send-back`：重叠纸片，实心纸片分别在前方、后方，表示置顶与置底。
- `scissors`：剪刀，表示继续裁切。

SVG 使用 `96 × 96` 方形画布及 `#222222` 墨色。同名 PNG 为 `192 × 192` 透明导出，供 App、H5 和微信小程序中的 `<image>` 使用。修改 SVG 后须同步重新导出 PNG。

返回、删除、素材库、下载等已有操作继续复用 `newicons/back.png`、`delete.png`、`library.png`、`save_share.png`。

`help.png` 由项目已有 `images/icons/question.svg` 导出为透明 PNG，复用问号图形并保持页面图标的跨端格式一致；SVG 源仍维护在原位置。
