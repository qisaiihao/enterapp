# 回填云函数创建与调用指南

本文档总结了创建和调用回填云函数的完整流程，以及需要避免的常见错误。

## 目录

1. [创建回填云函数](#创建回填云函数)
2. [注册云函数](#注册云函数)
3. [部署云函数](#部署云函数)
4. [调用云函数](#调用云函数)
5. [常见错误与避免方法](#常见错误与避免方法)
6. [最佳实践](#最佳实践)

---

## 创建回填云函数

### 1. 创建云函数目录结构

```bash
functions/
  └── backfillPostSignatures/
      ├── index.js           # 云函数主文件
      └── package.json       # 依赖配置
```

### 2. 编写云函数主文件 (`index.js`)

#### 核心设计要点：

1. **支持批量处理**：使用 `batchSize` 参数控制单次处理的文档数量
2. **支持分页**：使用 `offset` 参数支持手动分页，避免一次性处理过多数据
3. **支持强制模式**：使用 `force` 参数决定是否强制更新已有数据
4. **返回详细信息**：返回 `processed`、`updated`、`skipped`、`nextOffset` 等字段，方便调用方追踪进度

#### 示例代码结构：

```javascript
const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();
const _ = db.command;

exports.main = async (event) => {
  const { batchSize = 50, offset = 0, force = false } = event || {};
  
  // 1. 查询需要处理的文档
  const query = db.collection('posts');
  let postsRes;
  if (force) {
    // 强制模式：处理所有文档
    postsRes = await query
      .orderBy('createTime', 'desc')
      .skip(offset)
      .limit(batchSize)
      .get();
  } else {
    // 默认模式：只处理缺失字段的文档
    postsRes = await query
      .where({
        authorSignature: _.exists(false)
      })
      .orderBy('createTime', 'desc')
      .skip(offset)
      .limit(batchSize)
      .get();
  }
  
  // 2. 批量查询关联数据（避免逐个查询）
  const userIdSet = new Set();
  posts.forEach(post => {
    if (post._openid) {
      userIdSet.add(post._openid);
    }
  });
  
  const usersRes = await db.collection('users')
    .where({ _openid: _.in(Array.from(userIdSet)) })
    .field({ _openid: true, signatureUrl: true })
    .get();
  
  const userMap = new Map(
    usersRes.data.map(user => [user._openid, user.signatureUrl || ''])
  );
  
  // 3. 批量更新文档
  let updated = 0;
  for (const post of posts) {
    const signatureUrl = userMap.get(post._openid) || '';
    await db.collection('posts').doc(post._id).update({
      data: { authorSignature: signatureUrl }
    });
    updated++;
  }
  
  // 4. 返回详细结果
  return {
    success: true,
    processed: posts.length,
    updated,
    skipped: posts.length - updated,
    nextOffset: offset + posts.length,
    message: `成功更新 ${updated} 个帖子`
  };
};
```

### 3. 创建 package.json

```json
{
  "name": "backfillPostSignatures",
  "version": "1.0.0",
  "description": "回填历史帖子的签名字段",
  "main": "index.js",
  "dependencies": {
    "wx-server-sdk": "~2.6.3"
  }
}
```

---

## 注册云函数

### 在 `cloudbaserc.json` 中注册

**位置**：`cloudbaserc.json` → `framework.plugins.functions.inputs.functions` 数组

```json
{
  "envId": "cloud1-5gb0pbyl400845f5",
  "framework": {
    "plugins": {
      "functions": {
        "inputs": {
          "functions": [
            {
              "name": "backfillPostSignatures",
              "root": "./functions/backfillPostSignatures",
              "timeout": 60,
              "memory": 256
            }
          ]
        }
      }
    }
  }
}
```

**配置说明**：
- `name`: 云函数名称，必须与目录名一致
- `root`: 云函数目录的相对路径（相对于项目根目录）
- `timeout`: 超时时间（秒），回填操作可能需要较长时间，建议设置为 60
- `memory`: 内存配置（MB），256MB 通常足够

---

## 部署云函数

### ✅ 正确方式：从项目根目录部署

```bash
# 确保在项目根目录（包含 cloudbaserc.json 的目录）
cd /path/to/project

# 部署所有云函数（推荐）
tcb fn deploy

# 或者只部署特定云函数
tcb fn deploy backfillPostSignatures -e <envId>
```

### ❌ 错误方式 1：从云函数目录部署

```bash
# ❌ 错误：不要在云函数目录内执行
cd functions/backfillPostSignatures
tcb fn deploy  # 这会失败，找不到 cloudbaserc.json
```

**错误信息**：
```
CloudBaseError: 未识别到有效的环境 Id，请使用 cloudbaserc 配置文件进行操作或通过 -e 参数指定环境 Id
```

### ❌ 错误方式 2：使用不存在的选项

```bash
# ❌ 错误：tcb fn deploy 不支持 --code 和 --functions 选项
tcb fn deploy --code ./functions/backfillPostSignatures
tcb fn deploy --functions backfillPostSignatures
```

**错误信息**：
```
error: unknown option '--code'
error: unknown option '--functions'
```

---

## 调用云函数

### ✅ 正确方式：使用 tcb fn invoke

```bash
# 基本调用（使用默认参数）
tcb fn invoke backfillPostSignatures -e <envId>

# 带参数的调用
tcb fn invoke backfillPostSignatures -e <envId> --params '{"batchSize":50,"offset":0}'

# 强制模式调用
tcb fn invoke backfillPostSignatures -e <envId> --params '{"batchSize":100,"offset":0,"force":true}'
```

### PowerShell 中的 JSON 转义

在 PowerShell 中，JSON 字符串需要用反引号转义引号：

```powershell
# PowerShell 正确写法
tcb fn invoke backfillPostSignatures -e cloud1-5gb0pbyl400845f5 --params '{\"batchSize\":50,\"offset\":0}'

# 或者使用双引号包裹整个 JSON
tcb fn invoke backfillPostSignatures -e cloud1-5gb0pbyl400845f5 --params "{\`"batchSize\`":50,\`"offset\`":0}"
```

### 批量调用示例

```bash
# 方式1：手动循环调用
offset=0
for i in {1..10}; do
  tcb fn invoke backfillPostSignatures -e <envId> --params "{\"batchSize\":50,\"offset\":$offset}"
  offset=$((offset + 50))
  sleep 1  # 避免请求过快
done

# 方式2：使用 Node.js 脚本
node batch-backfill.js
```

---

## 常见错误与避免方法

### 错误 1：路径不存在错误

**错误信息**：
```
CloudBaseError: [backfillPostSignatures] 部署失败，函数代码打包失败：路径不存在：C:\...\functions\backfillPostSignatures\functions\backfillPostSignatures
```

**原因**：
- `cloudbaserc.json` 中的 `root` 路径配置错误
- 云函数目录结构不正确

**解决方法**：
1. 检查 `cloudbaserc.json` 中的 `root` 路径是否为相对路径：`"./functions/backfillPostSignatures"`
2. 确保云函数目录存在于项目根目录下
3. 确保从项目根目录执行部署命令

### 错误 2：环境 ID 未识别

**错误信息**：
```
CloudBaseError: 未识别到有效的环境 Id，请使用 cloudbaserc 配置文件进行操作或通过 -e 参数指定环境 Id
```

**原因**：
- 不在项目根目录执行命令
- `cloudbaserc.json` 不存在或格式错误
- 环境 ID 配置缺失

**解决方法**：
1. 确保在项目根目录执行命令
2. 检查 `cloudbaserc.json` 中是否包含 `envId` 字段
3. 如果使用 `-e` 参数，确保环境 ID 正确

### 错误 3：超时错误

**错误信息**：
```
Function execution timeout
```

**原因**：
- `batchSize` 设置过大
- `timeout` 配置过小

**解决方法**：
1. 减小 `batchSize`（建议 50-100）
2. 增加 `cloudbaserc.json` 中的 `timeout` 值（建议 60 秒）
3. 使用 `offset` 分页处理

### 错误 4：内存不足

**错误信息**：
```
Memory limit exceeded
```

**原因**：
- `memory` 配置过小
- 批量处理的数据量过大

**解决方法**：
1. 增加 `cloudbaserc.json` 中的 `memory` 值（建议 256MB 或更高）
2. 减小 `batchSize`

### 错误 5：查询条件错误

**错误信息**：
```
查询返回空结果，但实际有数据需要处理
```

**原因**：
- 使用 `_.exists(false)` 查询时，字段为 `null` 或空字符串的情况无法匹配
- 需要使用 `force` 模式或更复杂的查询条件

**解决方法**：
```javascript
// ❌ 错误：无法匹配 null 或空字符串
.where({ authorSignature: _.exists(false) })

// ✅ 正确：使用 $or 匹配多种情况
.where(
  _.or([
    { authorSignature: _.exists(false) },
    { authorSignature: '' },
    { authorSignature: null }
  ])
)

// 或者使用 force 模式
force: true
```

---

## 最佳实践

### 1. 云函数设计

- ✅ **批量处理**：使用批量查询和更新，避免逐个操作
- ✅ **分页处理**：使用 `offset` 和 `batchSize` 控制单次处理量
- ✅ **详细日志**：记录处理进度和错误信息
- ✅ **返回详细信息**：返回 `processed`、`updated`、`skipped`、`nextOffset` 等字段

### 2. 部署流程

- ✅ **从项目根目录部署**：确保 `cloudbaserc.json` 能被正确识别
- ✅ **验证配置**：部署前检查 `cloudbaserc.json` 中的配置是否正确
- ✅ **测试部署**：先部署测试，确认无误后再批量处理

### 3. 调用流程

- ✅ **小批量测试**：先用小 `batchSize`（如 10）测试
- ✅ **逐步增加**：确认无误后逐步增加 `batchSize`
- ✅ **监控日志**：关注云函数日志，及时发现问题
- ✅ **错误处理**：对失败的操作进行重试

### 4. 批量回填脚本示例

```javascript
// batch-backfill.js
const { execSync } = require('child_process');

const ENV_ID = 'cloud1-5gb0pbyl400845f5';
const BATCH_SIZE = 50;

async function backfillAll() {
  let offset = 0;
  let totalUpdated = 0;
  let batchCount = 0;

  while (true) {
    try {
      const command = `tcb fn invoke backfillPostSignatures -e ${ENV_ID} --params '{"batchSize":${BATCH_SIZE},"offset":${offset}}'`;
      
      console.log(`批次 ${batchCount + 1}: offset=${offset}`);
      
      const output = execSync(command, { encoding: 'utf-8' });
      const resultMatch = output.match(/返回结果：({[^}]+})/);
      
      if (resultMatch) {
        const result = JSON.parse(resultMatch[1]);
        
        console.log(`✅ 批次完成: 处理 ${result.processed}, 更新 ${result.updated}`);
        
        totalUpdated += result.updated;
        offset = result.nextOffset;
        batchCount++;

        if (result.processed === 0) {
          console.log('\n🎉 所有数据回填完成！');
          break;
        }

        await new Promise(resolve => setTimeout(resolve, 1000));
      } else {
        console.error('❌ 无法解析返回结果');
        break;
      }
    } catch (error) {
      console.error(`❌ 批次失败:`, error.message);
      break;
    }
  }

  console.log(`\n📊 总计: ${batchCount} 批次, 更新 ${totalUpdated} 条记录`);
}

backfillAll();
```

---

## 总结

### 关键要点

1. **创建**：云函数目录结构要正确，代码要支持批量处理和分页
2. **注册**：在 `cloudbaserc.json` 中正确配置 `name`、`root`、`timeout`、`memory`
3. **部署**：**必须从项目根目录执行** `tcb fn deploy`
4. **调用**：使用 `tcb fn invoke` 命令，注意 PowerShell 中的 JSON 转义
5. **错误处理**：遇到错误时检查路径、配置、参数是否正确

### 快速检查清单

- [ ] 云函数目录结构正确
- [ ] `package.json` 存在且依赖正确
- [ ] `cloudbaserc.json` 中已注册云函数
- [ ] `root` 路径是相对路径（如 `"./functions/xxx"`）
- [ ] `timeout` 和 `memory` 配置合理
- [ ] 在项目根目录执行部署命令
- [ ] 调用时使用正确的环境 ID
- [ ] JSON 参数格式正确（PowerShell 需要转义）

---

**最后更新**：2025-11-05

