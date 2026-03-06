# AI推荐算法停用说明

## 停用时间
2026年3月5日

## 停用原因
AI向量化推荐算法尚未完善，暂时停用以避免不必要的云函数调用和资源消耗。

## 已停用的功能

### 1. 前端功能
- **文件**: `pages/index/index.vue`
- **停用内容**:
  - `loadRecommendationPosts()` - 加载推荐帖子的主函数
  - `loadDiscoverPosts()` - 发现页数据加载
  - `refreshDiscoverPosts()` - 刷新发现页推荐
  - `toggleRecommendFeed()` - 推荐流切换按钮（已禁用，点击显示提示）
  - `onHomeRefresh()` 和 `loadHomeMore()` 中的推荐流逻辑

### 2. API缓存层
- **文件**: `api-cache/poem-reco.js`
- **停用内容**:
  - `getContentPoemFeed()` - 现在直接返回空数据
  - `invalidateContentPoemFeed()` - 缓存清理功能已禁用

### 3. 云函数
以下云函数已在 `cloudbaserc.json` 中标记为停用（添加 `_disabled: true` 和 `_comment`）：

#### 3.1 getPoemContentFeed
- **路径**: `functions/getPoemContentFeed/`
- **功能**: 基于内容的诗歌推荐算法
- **配置位置**: 
  - `cloudbaserc.json` 第26-37行（functions数组）
  - `cloudbaserc.json` 第314-321行（framework.plugins.functions.inputs.functions数组）

#### 3.2 embedText
- **路径**: `functions/embedText/`
- **功能**: 文本向量化（embedding）服务
- **配置位置**:
  - `cloudbaserc.json` 第14-25行（functions数组）
  - `cloudbaserc.json` 第192-200行（framework.plugins.functions.inputs.functions数组）

#### 3.3 backfillPostEmbeddings
- **路径**: `functions/backfillPostEmbeddings/`
- **功能**: 定时任务，批量补齐帖子的embedding字段
- **定时触发器**: 已禁用（原配置：每10分钟执行一次）
- **配置位置**:
  - `cloudbaserc.json` 第38-52行（functions数组）
  - `cloudbaserc.json` 第322-335行（framework.plugins.functions.inputs.functions数组）

#### 3.4 getRecommendationFeed
- **路径**: `functions/getRecommendationFeed/`
- **功能**: 混合推荐算法（个性化+热门）
- **配置位置**:
  - `cloudbaserc.json` 第386-392行（framework.plugins.functions.inputs.functions数组）

## 技术细节

### 向量化推荐算法原理
- 使用 ONNX Runtime 和 HuggingFace tokenizers
- 模型：text2vec-base-chinese
- 通过文本内容生成向量，计算余弦相似度进行推荐
- 支持 bigram 回退机制

### 定时任务配置
原定时触发器配置（已禁用）：
```json
{
  "name": "backfill-embedding-timer",
  "type": "timer",
  "config": "0 */10 * * * * *"
}
```

## 恢复步骤

当需要重新启用AI推荐算法时，按以下步骤操作：

### 1. 恢复云函数配置
在 `cloudbaserc.json` 中：
- 移除所有 `_disabled: true` 标记
- 移除所有 `_comment: "TODO: AI推荐算法暂时停用"` 注释
- 将 `backfillPostEmbeddings` 的 `triggers` 从空数组恢复为 `_original_triggers` 中的配置

### 2. 恢复API缓存层
在 `api-cache/poem-reco.js` 中：
- 取消注释被 `/* 以下代码暂时停用 ... */` 包裹的代码
- 移除早期返回的 `return { posts: [], hasMore: false };`

### 3. 恢复前端功能
在 `pages/index/index.vue` 中：
- 取消注释 `loadRecommendationPosts()` 函数体
- 取消注释 `refreshDiscoverPosts()` 中的云函数调用
- 恢复 `toggleRecommendFeed()` 的原始逻辑
- 恢复 `onHomeRefresh()` 和 `loadHomeMore()` 中的推荐流逻辑

### 4. 部署云函数
```bash
# 部署所有推荐相关的云函数
tcb fn deploy getPoemContentFeed
tcb fn deploy embedText
tcb fn deploy backfillPostEmbeddings
tcb fn deploy getRecommendationFeed
```

### 5. 测试验证
- 测试推荐流切换按钮
- 验证发现页推荐内容加载
- 检查定时任务是否正常执行
- 确认向量化服务正常工作

## 相关文件清单

### 前端文件
- `pages/index/index.vue` - 首页推荐流逻辑
- `api-cache/poem-reco.js` - 推荐API缓存封装

### 云函数文件
- `functions/getPoemContentFeed/index.js` - 内容推荐算法
- `functions/embedText/index.js` - 文本向量化服务
- `functions/backfillPostEmbeddings/index.js` - 向量补齐定时任务
- `functions/getRecommendationFeed/index.js` - 混合推荐算法

### 配置文件
- `cloudbaserc.json` - 云函数部署配置

## 注意事项

1. 所有停用的代码都保留了完整的注释，便于后续恢复
2. 定时触发器配置保存在 `_original_triggers` 字段中
3. 前端UI中的推荐按钮已禁用，点击会显示"推荐功能暂时停用"提示
4. 缓存层会直接返回空数据，不会发起云函数调用
5. 云函数代码文件头部已添加 `TODO: AI推荐算法暂时停用` 标记

## 后续计划

- [ ] 完善向量化模型的准确性
- [ ] 优化推荐算法的性能
- [ ] 增加更多推荐策略（协同过滤、标签匹配等）
- [ ] 完善用户行为数据收集
- [ ] 添加推荐效果监控和A/B测试
