import cacheManager from '@/_utils/cache-manager';
import { buildCacheKey } from './cache-key-builder.js';

const { callCloudAndUnwrap } = require('./_shared/cloud-wrapper.js');

// 通用帖子列表缓存：TTL 90s + SWR 45s
const TTL_MS = 90 * 1000;
const SWR_MS = 45 * 1000;

const ns = cacheManager.namespace('posts:list', { persistent: true, maxItems: 256 });

function buildCloudParams({ page, pageSize, isPoem, isOriginal, isDiscussion, tag, excludeAnonymous, author }) {
  return {
    skip: page * pageSize,
    limit: pageSize,
    isPoem,
    isOriginal,
    isDiscussion,
    tag,
    excludeAnonymous,
    author
  };
}

/**
 * 获取帖子列表（带缓存）
 */
export async function getPostList({
  page = 0,
  pageSize = 10,
  isPoem,
  isOriginal,
  isDiscussion,
  tag,
  excludeAnonymous,
  author,
  context,
  forceRefresh = false,
  onBackgroundUpdate
} = {}) {
  const authorSuffix = author ? `:author:${author}` : '';
  const key = buildCacheKey({ page, pageSize, isPoem, isOriginal, isDiscussion, tag, excludeAnonymous }) + authorSuffix;
  const cacheKey = forceRefresh && page === 0 ? `${key}:ts:${Date.now()}` : key;

  const fetchPosts = async () => {
    const result = await callCloudAndUnwrap(
      'getPostList',
      buildCloudParams({ page, pageSize, isPoem, isOriginal, isDiscussion, tag, excludeAnonymous, author }),
      { pageTag: 'post-list', context },
      '加载帖子失败'
    );
    return result.posts || [];
  };

  // 第一页强刷直接请求
  if (page === 0 && forceRefresh) {
    return fetchPosts();
  }

  return ns.getOrFetch(
    cacheKey,
    fetchPosts,
    {
      ttlMs: TTL_MS,
      swrMs: SWR_MS,
      onBackgroundUpdate
    }
  );
}

/**
 * 清除帖子列表缓存
 */
export function invalidatePostList({ page, pageSize = 10, isPoem, isOriginal, isDiscussion, tag, excludeAnonymous } = {}) {
  if (typeof page === 'number') {
    const key = buildCacheKey({ page, pageSize, isPoem, isOriginal, isDiscussion, tag, excludeAnonymous });
    ns.delete(key);
    return;
  }

  const prefix = buildCacheKey({ page: 0, pageSize, isPoem, isOriginal, isDiscussion, tag, excludeAnonymous });
  const prefixWithoutPage = prefix.replace(/^page:\d+:size:/, '');
  const keys = ns.keys();
  keys.forEach((k) => {
    if (k.includes(prefixWithoutPage)) {
      ns.delete(k);
    }
  });
}

/**
 * 清除所有帖子列表缓存
 */
export function invalidateAllPostList() {
  ns.clear();
}

