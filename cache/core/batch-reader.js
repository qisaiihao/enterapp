/** 按实体复用缓存中的进行中请求，再把同一轮缺失的实体合并成有界批次。 */
export function createCachedBatchReader({ namespace, fetchBatch, ttlMs, batchSize = 20 }) {
  const queues = new Map();

  function enqueue(ns, id, scope) {
    let queue = queues.get(ns);
    if (!queue) {
      queue = [];
      queues.set(ns, queue);
      Promise.resolve().then(async () => {
        queues.delete(ns);
        const ids = [...new Set(queue.map(item => item.id))];
        for (let offset = 0; offset < ids.length; offset += batchSize) {
          const chunk = ids.slice(offset, offset + batchSize);
          const selected = new Set(chunk);
          const waiters = queue.filter(item => selected.has(item.id));
          try {
            const values = await fetchBatch(chunk, scope);
            waiters.forEach(({ id, resolve, reject }) => {
              if (values && Object.prototype.hasOwnProperty.call(values, id) && values[id] != null) {
                resolve(values[id]);
              } else {
                reject(new Error('批量查询未返回该实体'));
              }
            });
          } catch (error) {
            waiters.forEach(item => item.reject(error));
          }
        }
      });
    }
    return new Promise((resolve, reject) => queue.push({ id, resolve, reject }));
  }

  async function readMany(ids, scope) {
    const ns = namespace(scope);
    const uniqueIds = [...new Set((Array.isArray(ids) ? ids : []).filter(id => typeof id === 'string' && id))];
    const entries = await Promise.all(uniqueIds.map(async id => {
      try {
        const value = await ns.getOrFetch(id, () => enqueue(ns, id, scope), { ttlMs });
        return [id, value];
      } catch (_) {
        // 不缓存缺失或失败；保持头像/关注查询原有的容错返回值。
        return null;
      }
    }));
    return Object.fromEntries(entries.filter(Boolean));
  }

  return { readMany, async read(id, scope) { return (await readMany([id], scope))[id] || null; } };
}
