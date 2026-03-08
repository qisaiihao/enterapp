# 全局码风指南（无损重构版）

> 目标：在保持功能与协议不变的前提下，统一页面层、API 层、云函数层的职责边界，降低维护成本。

## 1. 设计原则

1. **无损重构优先**：不改对外协议，不改业务默认值，不新增隐式规则。
2. **分层单一职责**：页面只编排状态，API 只处理协议，云函数只处理业务。
3. **先抽复用再扩功能**：重复逻辑出现第 3 次必须抽象。
4. **可验证交付**：每次重构必须配套语法检查与核心链路回归。

## 2. 分层边界

### 页面层（`pages/**`、`pages-admin/**`、`pages-tools/**`、`pages-user/**`、`pages-content/**`）
- 只做：交互状态、loading、toast、路由跳转、分页拼接。
- 不做：`cloudCall + res.result` 协议判断、action 字段拼接、平台上传分支。
- 必须通过 `api-cache/**` 语义化接口拿业务数据。

**反例**
```js
const res = await cloudCall('follow', { action: 'getFollowerList' });
if (res.result && res.result.success) {
  this.followers = res.result.list || [];
}
```

**正例**
```js
const result = await getFollowerList({ page, pageSize, context: this });
this.followers = result.list;
```

### 接口层（`api-cache/**`）
- 统一职责：参数组装、`cloudCall` 调用、`res.result` 解包、错误归一化。
- 失败时统一 `throw new Error(可展示文案)`，页面层不再解析协议。
- action 型函数优先使用 `callActionAndUnwrap`/`createActionCaller`。

### 云函数层（`functions/**`）
- 对外协议（函数名/action/入参/返回字段）稳定优先。
- 入口仅做：参数校验、鉴权、handler 分发。
- 业务逻辑、公共能力拆入 `functions/_lib/**` 或当前函数 `helpers/**`。

## 3. 命名与常量

- action 名：动词开头，前后端一致（如 `getFollowerList`、`toggleBlock`）。
- refresh key：统一前缀 `shouldRefresh*`，禁止页面硬编码散落。
- 缓存 key：可读格式 `type:${type}:page:${page}:size:${size}`。
- 语义化 API：`list/get/create/update/delete/toggle + Domain`。

## 4. 错误处理与日志

- API 层抛错：
```js
throw new Error(result.error || result.message || '操作失败');
```
- 页面层只处理：`uni.showToast`、结束 loading、可恢复 UI。
- 日志规范：
```js
console.error('[module] action failed:', err);
```
- 关键链路保留必要日志（发布、删除、分页、鉴权），禁止噪音日志泛滥。

## 5. 编码与文案

- 统一 `UTF-8`（无 BOM）。
- 禁止把文件写成 GBK/ANSI。
- 提交前执行：
```bash
npm run check:encoding
```
- 禁止出现乱码特征（例如 `鍥剧`、`馃`、`锟`、`U+FFFD`）。
- 模板标签必须成对闭合（`</view>`、`</text>`）。

## 6. 文件规模阈值与拆分策略

### 前端 `.vue`
- 超过 **900 行** 或 methods 超过 **35 个**：必须拆分。
- 拆分优先级：
1. 云调用与协议处理 -> `api-cache`
2. 业务流程 -> `useXxx` / `xxx-service`
3. 重复 UI -> `components/**`

### 云函数 `.js`
- 超过 **450 行** 或 action 分支超过 **8 个**：必须拆分。
- 拆分形态：`index.js`（分发） + `handlers/*.js` + `_lib/*.js`。

## 7. 重构提交流程（必须执行）

1. 先写/改 API，再改页面调用。
2. 每改完一个子域就跑语法检查。
3. 关键流程手工回归后再提交。
4. 文档与代码同批更新。

## 8. 质量门禁命令

```bash
npm run check:encoding
npm run check:syntax
npm run check:quality
```

说明：
- `check:encoding`：检查 BOM、混合换行、乱码特征。
- `check:syntax`：检查 JS 与 Vue `<script>` 语法。

## 9. 无损重构验收清单（提交前）

- 对外协议不变：函数名/action/入参/返回字段不变。
- 页面行为不变：loading/toast/分页/下拉刷新/回滚流程一致。
- 缓存语义不变：`invalidate*`、`shouldRefresh*` 语义一致。
- 核心链路可回归：登录、发布、详情互动、个人页、关系链路、管理页。

## 10. 推荐模板

### 页面调用模板
```js
try {
  this.isLoading = true;
  const result = await listSomething({ page: this.page, pageSize: this.pageSize, context: this });
  this.items = this.page === 0 ? result.list : this.items.concat(result.list);
  this.hasMore = result.hasMore;
} catch (err) {
  uni.showToast({ title: err.message || '加载失败', icon: 'none' });
} finally {
  this.isLoading = false;
}
```

### API action 模板
```js
const { createActionCaller } = require('./_shared/cloud-wrapper.js');

const callAction = createActionCaller({
  functionName: 'follow',
  pageTagPrefix: 'relation:follow',
  requireAuth: true
});

async function getFollowerList({ page = 0, pageSize = 20, context } = {}) {
  const result = await callAction('getFollowerList', {
    skip: page * pageSize,
    limit: pageSize
  }, {
    context,
    fallbackMessage: '加载失败'
  });

  return {
    list: result.list || [],
    hasMore: !!result.hasMore,
    total: result.total || 0
  };
}
```

## 11. 架构文档维护规范

- 架构文档入口固定为 `docs/ARCHITECTURE.md`，禁止多份“当前版”并存。
- 历史内容统一归档到 `docs/ARCHITECTURE.legacy.md`，不在归档文档继续增量维护。
- 代码结构发生以下变化时，必须同步更新架构文档：
  - 新增/删除核心业务链路
  - 分层边界调整（页面/API/云函数职责变化）
  - 缓存语义或刷新标记语义变化
  - 云函数协议兼容策略变化

## 12. 代码评审最低要求

- 必查 `res.result` 是否泄漏到页面层。
- 必查是否新增页面级 `callCloudFunction` 包装（优先迁移到 `api-cache`）。
- 必查是否引入重复组件实现（同功能多份源码）。
- 必查是否覆盖无损回归清单中的受影响链路。

## 13. Definition of Done（重构任务）

- 改造范围内页面不再解析云函数协议字段。
- 改造范围内 API 方法统一抛错或返回业务对象。
- 所有改动文件通过 `check:encoding` 与 `check:syntax`。
- 架构/码风/回归文档已同步更新。
- 手工回归记录可追溯（至少包含关键链路结果）。

## 14. 禁止事项

- 禁止在页面层拼装云函数 action 协议并直接判断 `success`。
- 禁止在未评估回归影响时批量替换缓存 key 或刷新标记。
- 禁止引入临时 backup 源码文件参与构建或提交。
- 禁止提交乱码注释、乱码文案、乱码日志文本。
