# 回车键项目文档索引

## 📚 文档结构说明

本文档提供了回车键项目的完整文档索引，帮助开发者快速找到所需的技术文档和指南。

---

## 🎯 核心文档（必读）

### [README.md](./README.md)
- **内容**: 项目完整介绍，包括功能特性、技术栈、快速开始指南
- **适用**: 新项目成员、项目评估、快速上手
- **更新频率**: 随版本更新

### [ARCHITECTURE.md](./ARCHITECTURE.md)
- **内容**: 系统架构设计，技术选型，模块划分
- **适用**: 架构理解、技术决策、模块开发
- **更新频率**: 架构变更时更新

### [项目开发总结.md](./项目开发总结.md)
- **内容**: 开发过程经验总结，问题解决方案，最佳实践
- **适用**: 问题排查、开发参考、经验借鉴
- **更新频率**: 重大问题解决后更新

---

## 🚀 性能优化文档

### [PERFORMANCE_OPTIMIZATION.md](./PERFORMANCE_OPTIMIZATION.md)
- **内容**: 综合性能优化指南，包含前端、后端、缓存系统优化
- **适用**: 性能优化实施、系统调优、用户体验提升
- **更新频率**: 持续更新

### [统一缓存与一致性改造计划.md](./统一缓存与一致性改造计划.md)
- **内容**: 详细的缓存系统设计方案和实施计划
- **适用**: 缓存系统理解、扩展维护
- **更新频率**: 缓存策略调整时更新

---

## 📁 技术文档（docs目录）

### 🔧 系统设计文档
- [docs/REFACTOR_OPTIMIZATION_PLAN.md](./docs/REFACTOR_OPTIMIZATION_PLAN.md) - 重构优化计划
- [docs/REFACTOR_REUSE_PLAN.md](./docs/REFACTOR_REUSE_PLAN.md) - 代码复用重构计划

### ☁️ 云开发文档
- [docs/cloud-functions-deployment-status.md](./docs/cloud-functions-deployment-status.md) - 云函数部署状态
- [docs/backfill-cloud-function-guide.md](./docs/backfill-cloud-function-guide.md) - 数据回填云函数指南
- [docs/database-schema-improved.md](./docs/database-schema-improved.md) - 改进的数据库设计

### 🎨 认证与授权文档
- [docs/GITHUB_AUTH_FLOW.md](./docs/GITHUB_AUTH_FLOW.md) - GitHub认证流程
- [docs/GITHUB_OAUTH_SETUP.md](./docs/GITHUB_OAUTH_SETUP.md) - GitHub OAuth设置
- [docs/H5_GITHUB_AUTH.md](./docs/H5_GITHUB_AUTH.md) - H5端GitHub认证
- [docs/URL_SCHEME_CONFIG.md](./docs/URL_SCHEME_CONFIG.md) - URL方案配置

### 📊 缓存系统文档
- [docs/cache-mechanism-review.md](./docs/cache-mechanism-review.md) - 缓存机制审查
- [docs/cache-sharing-usage.md](./docs/cache-sharing-usage.md) - 缓存共享使用指南
- [docs/cross-page-cache-sharing.md](./docs/cross-page-cache-sharing.md) - 跨页面缓存共享

### 📈 日志与监控文档
- [docs/view-log-analysis.md](./docs/view-log-analysis.md) - 浏览日志分析
- [docs/view-log-implementation-plan.md](./docs/view-log-implementation-plan.md) - 日志系统实施计划
- [docs/view-log-single-record-design.md](./docs/view-log-single-record-design.md) - 单条日志记录设计

---

## 🛠️ 开发工具文档

### 云函数文档
- [functions/README.md](./functions/README.md) - 云函数开发指南
- [functions/AuthHandler/README.md](./functions/AuthHandler/README.md) - 认证处理器文档

### API缓存文档
- [api-cache/events.md](./api-cache/events.md) - 事件系统文档

---

## 📖 文档使用指南

### 🔍 快速查找
- **新手入门**: README.md → ARCHITECTURE.md → 项目开发总结.md
- **性能优化**: PERFORMANCE_OPTIMIZATION.md → 相关缓存文档
- **功能开发**: 对应模块的架构文档 + 相关技术文档
- **问题排查**: 项目开发总结.md → 相关问题文档

### 📝 文档维护
- **新增功能**: 同步更新README.md和ARCHITECTURE.md
- **性能优化**: 更新PERFORMANCE_OPTIMIZATION.md和相关缓存文档
- **问题解决**: 更新项目开发总结.md
- **架构变更**: 更新ARCHITECTURE.md和相关设计文档

### 🔗 文档关联
```
核心文档
├── README.md (项目总览)
├── ARCHITECTURE.md (架构设计)
├── 项目开发总结.md (实施经验)
└── PERFORMANCE_OPTIMIZATION.md (性能指南)

技术文档 (docs/)
├── 系统设计文档
├── 云开发文档
├── 认证授权文档
├── 缓存系统文档
└── 日志监控文档

实现文档
├── functions/ (云函数)
├── api-cache/ (缓存实现)
└── utils/ (工具函数)
```

---

## 📋 文档规范

### ✅ 文档标准
- 使用清晰的结构和标题层级
- 提供实用的代码示例
- 包含必要的使用说明和注意事项
- 保持文档与代码同步更新

### 📝 编写指南
- 使用Markdown格式
- 代码块标明语言类型
- 重要概念使用加粗强调
- 复杂操作提供步骤说明

### 🔄 更新机制
- 代码变更时同步更新相关文档
- 定期审查文档的准确性和完整性
- 重大功能更新时修订核心文档

---

## 📞 问题反馈

如果在使用过程中遇到文档相关问题，可以通过以下方式反馈：

- 查看相关文档的最新版本
- 在项目仓库中提交Issue
- 联系项目维护团队

---

*最后更新: 2025-11-16*
*维护者: 回车键开发团队*