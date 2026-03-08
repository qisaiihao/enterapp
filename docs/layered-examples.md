# 分层示例（页面 / API / 云函数）

## 1. 页面层示例

```js
// pages-user/fans/fans.vue
const result = await getFollowerList({ page, pageSize: this.PAGE_SIZE, context: this });
this.followers = page === 0 ? result.list : this.followers.concat(result.list);
```

页面只关心 `result.list/hasMore/total`，不关心云函数协议字段。

## 2. API 层示例

```js
// api-cache/relation.js
const result = await callFollowAction('getFollowerList', {
  skip: page * pageSize,
  limit: pageSize
}, {
  context,
  fallbackMessage: '加载失败'
});
```

API 层负责 action、协议解包、错误文案。

## 3. 云函数层示例

```js
// functions/follow/index.js
switch (action) {
  case 'getFollowerList':
    return await getFollowerList(openid, event.skip || 0, event.limit || 20);
}
```

云函数入口做分发与鉴权，业务函数只处理业务。
