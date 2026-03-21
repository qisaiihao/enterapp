# fixFollowsOpenid

用于批量修复 `follows` 集合里错误的 openid 引用。

默认会把：

- `anonymous_1760806464645`
- 替换为 `ojYBd1zhoZmBs4XrvqaBHXQoetYw`

支持修复的字段：

- `followerId`
- `followedId`

只允许管理员调用。

## 推荐调用方式

先预览：

```js
uniCloud.callFunction({
  name: 'fixFollowsOpenid',
  data: {
    dryRun: true,
    sourceOpenid: 'anonymous_1760806464645',
    targetOpenid: 'ojYBd1zhoZmBs4XrvqaBHXQoetYw'
  }
})
```

确认后执行：

```js
uniCloud.callFunction({
  name: 'fixFollowsOpenid',
  data: {
    dryRun: false,
    sourceOpenid: 'anonymous_1760806464645',
    targetOpenid: 'ojYBd1zhoZmBs4XrvqaBHXQoetYw',
    replaceFollowerId: true,
    replaceFollowedId: true,
    dedupe: true
  }
})
```

## 返回结果

会返回：

- 匹配数量
- 实际更新数量
- 去重删除数量
- 样本记录

