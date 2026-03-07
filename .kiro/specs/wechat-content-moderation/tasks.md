# Implementation Plan

- [x] 1. 创建云函数基础结构和配置




  - 创建 `functions/contentCheck` 目录
  - 配置云函数的 package.json 和依赖
  - 设置环境变量配置（WECHAT_APPID, WECHAT_SECRET）
  - 创建云函数入口文件 index.js 的基本框架
  - _Requirements: 3.1, 3.5_

- [x] 2. 实现 Token 管理模块


  - 创建 `functions/contentCheck/tokenManager.js`
  - 实现 getAccessToken() 方法，从缓存或微信API获取token
  - 实现 refreshAccessToken() 方法，调用微信API刷新token
  - 实现 validateToken() 方法，验证token有效性
  - 实现token缓存逻辑（数据库存储，带过期时间）
  - _Requirements: 3.1, 3.2_

- [ ]* 2.1 编写 Token 管理的属性测试
  - **Property 4: Token injection**
  - **Validates: Requirements 3.1**

- [x] 3. 实现微信 API 调用模块


  - 创建 `functions/contentCheck/wechatAPIClient.js`
  - 实现 msgSecCheck() 方法，调用文本安全检测API
  - 实现 mediaCheckAsync() 方法，调用图片安全检测API
  - 处理 HTTP 请求和响应解析
  - 实现 UTF-8 编码处理
  - _Requirements: 1.1, 2.1, 3.5_

- [ ]* 3.1 编写 UTF-8 编码的属性测试
  - **Property 6: UTF-8 encoding**
  - **Validates: Requirements 3.5**

- [x] 4. 实现审核日志记录模块


  - 创建 `functions/contentCheck/moderationLogger.js`
  - 实现 logModeration() 方法，将审核详情写入数据库
  - 实现内容脱敏逻辑（文本截断到100字）
  - 创建数据库集合 moderation_logs 的数据结构
  - 实现错误日志记录功能
  - _Requirements: 4.5, 6.4_

- [ ]* 4.1 编写日志记录的属性测试
  - **Property 8: Error log completeness**
  - **Validates: Requirements 4.5**
  - **Property 12: Failed moderation logging**
  - **Validates: Requirements 6.4**

- [x] 5. 实现输入验证模块


  - 创建 `functions/contentCheck/validator.js`
  - 实现文本内容验证（非空、长度限制2500字）
  - 实现图片URL验证（格式、支持的扩展名）
  - 实现场景参数验证（1-4范围）
  - 实现 openid 验证
  - _Requirements: 1.2, 1.3, 2.2, 2.3, 5.3_

- [ ]* 5.1 编写输入验证的单元测试
  - 测试空字符串和纯空白字符串被拒绝
  - 测试2500字符边界
  - 测试无效URL格式
  - 测试不支持的图片格式
  - 测试无效场景值
  - _Requirements: 1.2, 1.3, 2.2, 2.3, 5.3_

- [x] 6. 实现云函数主逻辑


  - 在 `functions/contentCheck/index.js` 中实现主处理函数
  - 实现文本审核流程（type='text'）
  - 实现图片审核流程（type='image'）
  - 实现批量审核流程（type='batch'）
  - 集成 tokenManager、wechatAPIClient、validator、moderationLogger
  - 实现 openid 自动注入逻辑
  - _Requirements: 1.1, 2.1, 3.3, 8.5_

- [ ]* 6.1 编写 OpenID 提取的属性测试
  - **Property 5: OpenID extraction**
  - **Validates: Requirements 3.3**

- [ ]* 6.2 编写结果结构的属性测试
  - **Property 1: Valid text input returns valid result structure**
  - **Validates: Requirements 1.1**
  - **Property 2: Valid image URL returns valid result structure**
  - **Validates: Requirements 2.1**

- [x] 7. 实现错误处理和重试机制


  - 实现系统繁忙错误（errcode: -1）的自动重试（最多3次）
  - 实现 token 过期错误（errcode: 40001）的自动刷新和重试
  - 实现频率限制错误（errcode: 44991, 45009）的错误映射
  - 实现网络超时处理
  - 实现未知错误码的日志记录和通用错误返回
  - 实现错误消息的中文映射
  - _Requirements: 4.1, 4.2, 4.3, 4.4_

- [ ]* 7.1 编写错误处理的单元测试
  - 测试系统繁忙错误重试3次
  - 测试 token 刷新流程
  - 测试频率限制错误映射
  - 测试网络超时处理
  - _Requirements: 4.1, 4.2, 4.3_

- [ ]* 7.2 编写未知错误的属性测试
  - **Property 7: Unknown error logging**
  - **Validates: Requirements 4.4**

- [x] 8. 实现缓存机制


  - 创建 `functions/contentCheck/cacheManager.js`
  - 实现内容指纹生成（用于缓存key）
  - 实现缓存读取逻辑（5分钟TTL）
  - 实现缓存写入逻辑
  - 在主逻辑中集成缓存检查
  - _Requirements: 7.4, 7.5_

- [ ]* 8.1 编写缓存的属性测试
  - **Property 14: Cache deduplication**
  - **Validates: Requirements 7.4**

- [ ]* 8.2 编写缓存过期的单元测试
  - 测试5分钟内返回缓存结果
  - 测试5分钟后重新调用API
  - _Requirements: 7.5_

- [x] 9. 创建客户端工具类


  - 创建 `utils/contentModeration.js`
  - 实现 checkText() 方法
  - 实现 checkImage() 方法
  - 实现 checkContent() 批量审核方法
  - 集成 cloudCall 调用云函数
  - 实现默认参数处理（scene默认为2）
  - _Requirements: 1.1, 2.1, 5.2, 8.1, 8.2, 8.5_

- [ ]* 9.1 编写客户端 API 的属性测试
  - **Property 15: Promise return type**
  - **Validates: Requirements 8.2**
  - **Property 17: Batch processing completeness**
  - **Validates: Requirements 8.5**

- [x] 10. 实现场景参数和可选参数支持


  - 在云函数中实现场景参数处理
  - 实现 title、nickname、signature 可选参数的传递
  - 在客户端工具类中添加可选参数支持
  - _Requirements: 5.1, 5.4, 5.5_

- [ ]* 10.1 编写场景参数的属性测试
  - **Property 9: Scene parameter support**
  - **Validates: Requirements 5.1**
  - **Property 10: Optional parameters pass-through**
  - **Validates: Requirements 5.5**

- [ ]* 10.2 编写默认场景值的单元测试
  - 测试未指定场景时使用默认值2
  - 测试 scene=1 时支持 signature 参数
  - _Requirements: 5.2, 5.4_

- [x] 11. 实现结果转换和简化


  - 在云函数中实现微信API响应到客户端响应的转换
  - 实现 suggest 字段到 passed 布尔值的映射
  - 实现用户友好的中文错误消息
  - 确保客户端只接收简化的结果
  - _Requirements: 6.1, 6.2, 6.3, 6.5_

- [ ]* 11.1 编写结果转换的单元测试
  - 测试 suggest='pass' 映射到 passed=true
  - 测试 suggest='risky' 映射到 passed=false
  - 测试 suggest='review' 映射到 passed=false
  - _Requirements: 6.2, 6.3_

- [ ]* 11.2 编写结果结构的属性测试
  - **Property 11: Result structure consistency**
  - **Validates: Requirements 6.1**

- [x] 12. 实现 trace_id 持久化


  - 在图片审核流程中保存 trace_id 到数据库
  - 实现 trace_id 查询接口（可选）
  - 在审核日志中记录 trace_id
  - _Requirements: 2.4_

- [ ]* 12.1 编写 trace_id 持久化的属性测试
  - **Property 3: Trace ID persistence**
  - **Validates: Requirements 2.4**

- [x] 13. 实现并发处理支持


  - 确保云函数支持并发调用
  - 在批量审核中使用 Promise.all() 并行处理
  - 测试并发请求的独立性
  - _Requirements: 7.3_

- [ ]* 13.1 编写并发处理的属性测试
  - **Property 13: Concurrent request independence**
  - **Validates: Requirements 7.3**

- [x] 14. 添加回调支持（可选功能）


  - 在客户端工具类中添加回调参数
  - 实现审核完成后的回调调用
  - _Requirements: 8.4_

- [ ]* 14.1 编写回调的属性测试
  - **Property 16: Callback invocation**
  - **Validates: Requirements 8.4**

- [x] 15. 创建数据库集合和索引


  - 创建 moderation_logs 集合
  - 创建 access_tokens 集合
  - 添加 openid 索引到 moderation_logs
  - 添加 createTime 索引到 moderation_logs
  - 配置 TTL 索引用于缓存过期
  - _Requirements: 6.4_

- [x] 16. 集成测试和端到端验证


  - 测试完整的文本审核流程（客户端→云函数→微信API→数据库）
  - 测试完整的图片审核流程
  - 测试批量审核流程
  - 测试 token 刷新流程
  - 测试错误处理和重试
  - 测试缓存命中和未命中场景
  - _Requirements: All_

- [ ]* 16.1 编写集成测试
  - 端到端文本审核测试
  - 端到端图片审核测试
  - 批量审核测试
  - Token 刷新测试
  - 错误处理测试
  - 缓存测试
  - _Requirements: All_

- [x] 17. 文档和使用示例


  - 创建 README.md 说明如何使用审核组件
  - 添加代码示例（文本审核、图片审核、批量审核）
  - 文档化错误码和错误消息
  - 添加常见问题解答
  - _Requirements: 8.1_

- [x] 18. 最终检查点 - 确保所有测试通过



  - 确保所有测试通过，如有问题请询问用户

- [ ] 19. 集成内容审核到发布帖子流程（仅小程序端）


  - 在 `pages/add/add.vue` 中集成文本和图片审核
  - 在发布前调用 `checkContent()` 批量审核文本和图片
  - 审核时显示"审核中..."加载提示
  - 审核不通过时显示友好的错误提示并阻止发布
  - 确保只在小程序端（mp-weixin）执行审核，H5和App端跳过
  - 支持普通模式、诗歌模式、讨论模式、组诗模式的内容审核
  - _Requirements: 1.1, 2.1, 8.1_

- [ ] 20. 集成内容审核到评论发布流程（仅小程序端）


  - 在评论组件中集成文本审核
  - 在发布评论前调用 `checkText()` 审核评论内容
  - 审核时显示"审核中..."加载提示
  - 审核不通过时显示友好的错误提示并阻止发布
  - 确保只在小程序端执行审核
  - _Requirements: 1.1, 8.1_

- [ ] 21. 集成内容审核到头像上传流程（仅小程序端）


  - 在 `pages-user/profile-edit/profile-edit.vue` 中集成图片审核
  - 在上传头像前调用 `checkImage()` 审核头像图片
  - 审核时显示"审核中..."加载提示
  - 审核不通过时显示友好的错误提示并阻止上传
  - 确保只在小程序端执行审核
  - _Requirements: 2.1, 8.1_

- [ ] 22. 集成内容审核到个人资料更新流程（仅小程序端）


  - 在 `pages-user/profile-edit/profile-edit.vue` 中集成文本审核
  - 在保存个人资料前审核昵称、个性描述等文本字段
  - 审核时显示"审核中..."加载提示
  - 审核不通过时显示友好的错误提示并阻止保存
  - 确保只在小程序端执行审核
  - _Requirements: 1.1, 8.1_

- [ ] 23. 集成内容审核到诗人资料上传流程（仅小程序端）


  - 在诗人资料编辑页面中集成文本和图片审核
  - 在保存诗人资料前审核文本内容和头像图片
  - 审核时显示"审核中..."加载提示
  - 审核不通过时显示友好的错误提示并阻止保存
  - 确保只在小程序端执行审核
  - _Requirements: 1.1, 2.1, 8.1_

- [ ] 24. 创建平台检测辅助函数


  - 在 `utils/contentModeration.js` 中添加平台检测函数
  - 封装 `shouldModerate()` 函数，返回是否需要审核（仅小程序端返回true）
  - 在所有审核调用前使用该函数判断是否需要审核
  - _Requirements: 8.1_

- [ ] 25. 测试集成后的审核流程


  - 在小程序端测试发布帖子的审核流程
  - 在小程序端测试发布评论的审核流程
  - 在小程序端测试上传头像的审核流程
  - 在小程序端测试更新个人资料的审核流程
  - 在H5和App端测试跳过审核的流程
  - 测试审核不通过时的错误提示
  - 测试审核通过后的正常发布流程
  - _Requirements: All_

- [ ] 26. 最终检查点 - 确保集成测试通过


  - 确保所有集成测试通过，如有问题请询问用户
