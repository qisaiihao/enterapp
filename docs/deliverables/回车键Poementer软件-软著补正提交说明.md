# 回车键Poementer软件软著补正提交说明

## 1. 文档材料

建议提交以下文档材料：

| 文件 | 用途 |
| --- | --- |
| `回车键Poementer软件-操作手册.pdf` | 补正文档主件，包含登录、注册、主界面、浏览、互动、发布、个人中心、搜索、活动等图文操作流程 |
| `回车键Poementer软件-设计开发说明书.pdf` | 设计说明补充，包含软件结构、功能模块、接口、流程、数据、缓存、测试和运行设计 |

可留存或按需要提供的编辑源文件：

| 文件 | 用途 |
| --- | --- |
| `回车键Poementer软件-操作手册.md` | 操作手册 Markdown 源文档 |
| `回车键Poementer软件-操作手册.html` | 可浏览、可导入 Word 的操作手册中间文件 |
| `回车键Poementer软件-设计开发说明书.md` | 设计说明 Markdown 源文档 |
| `回车键Poementer软件-设计开发说明书.html` | 可浏览、可导入 Word 的设计说明中间文件 |

## 2. 源程序材料

建议提交以下源程序材料：

| 文件 | 用途 |
| --- | --- |
| `回车键Poementer软件-源程序登记提交版.pdf` | 源程序正式提交稿，A4 竖版、白底黑字、每页 50 行、共 60 页，页眉为软件名称，页码为 1-60 |
| `回车键Poementer软件-源程序登记提交版.html` | 可导入 Word 后继续微调页眉、页码、字体和打印边距的源文件 |
| `回车键Poementer软件-源程序页码清单.md` | 选编文件、完整序列页码、前 30 页和后 30 页映射说明，供内部核对 |
| `回车键Poementer软件-源程序选编清单.json` | 源码选编配置，供重新生成提交稿使用 |

## 3. 版式核对

提交前建议确认：

1. 文档 PDF 页面清晰，图片、表格和文字未被遮挡。
2. 操作手册已包含如何登录、主界面说明、主要功能模块和完整操作流程。
3. 源程序 PDF 为 A4 竖版，不含封面和目录。
4. 源程序 PDF 共 60 页，每页 50 行源码网格。
5. 源程序页眉为“回车键Poementer软件”，页码为“第 1 页 / 共 60 页”至“第 60 页 / 共 60 页”。
6. 源程序最后一页以 `functions/addComment/index.js` 模块完整结束。

## 4. 重新生成命令

```bash
npm run export:manual
npm run export:doc
npm run export:source
```

如 PowerShell 执行策略拦截 `npm`，可使用：

```bash
npm.cmd run export:manual
npm.cmd run export:doc
npm.cmd run export:source
```
