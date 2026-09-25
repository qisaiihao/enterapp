function first(result) { return Array.isArray(result.data) ? result.data[0] : result.data; }
function checked(result) { if (result.code) throw result; return result; }
async function readDocument(ref) {
  try { return first(checked(await ref.get())); }
  catch (error) {
    if (String(error.code).includes('DOCUMENT_NOT_EXIST')) return null;
    throw error;
  }
}

function createStore(db) {
  return {
    async prepareSource({ sourceKey, owner, fileID, token, cleanupOnly = false, time }) {
      return db.runTransaction(async tx => {
        const ref = tx.collection('collage_ocr_cache').doc(sourceKey);
        const prior = await readDocument(ref);
        if (prior) return prior;
        const data = { kind: 'source', owner, fileID, token, cleanupOnly, updatedAt: time };
        checked(await ref.set(data)); return data;
      });
    },
    async getSource(sourceKey, owner) {
      const source = await readDocument(db.collection('collage_ocr_cache').doc(sourceKey));
      if (source && source.owner !== owner) throw new Error('SOURCE_OWNER_MISMATCH');
      return source;
    },
    async rememberLegacyKey(sourceKey, owner, key) {
      return db.runTransaction(async tx => {
        const ref = tx.collection('collage_ocr_cache').doc(sourceKey), source = await readDocument(ref);
        if (!source || source.owner !== owner) throw new Error('SOURCE_MISSING');
        checked(await ref.update({ legacyCacheKey: key }));
      });
    },
    async removeSource(sourceKey, owner) {
      return db.runTransaction(async tx => {
        const sourceRef = tx.collection('collage_ocr_cache').doc(sourceKey);
        const source = await readDocument(sourceRef);
        if (!source) return;
        if (source.owner !== owner) throw new Error('SOURCE_OWNER_MISMATCH');
        const caches = [];
        for (const key of new Set([source.cacheKey, source.legacyCacheKey].filter(Boolean))) {
          const ref = tx.collection('collage_ocr_cache').doc(key), cache = await readDocument(ref);
          caches.push({ ref, cache });
        }
        for (const { ref, cache } of caches) {
          if (!cache || cache.owner !== owner) continue;
          const sourceKeys = (cache.sourceKeys || []).filter(id => id !== sourceKey);
          if (sourceKeys.length) checked(await ref.update({ sourceKeys }));
          else checked(await ref.remove());
        }
        checked(await sourceRef.remove());
      });
    },
    async reserve({ key, owner, sourceKey, sourceToken, operationToken, month, day, time, limit, dailyLimit }) {
      return db.runTransaction(async tx => {
        const sourceRef = sourceKey ? tx.collection('collage_ocr_cache').doc(sourceKey) : null;
        const source = sourceRef ? await readDocument(sourceRef) : null;
        if (sourceKey && (!source || source.owner !== owner || source.token !== sourceToken || source.cleanupOnly)) return { message: '原图已删除或上传已失效，请重新导入' };
        const cache = tx.collection('collage_ocr_cache').doc(key);
        const prior = await readDocument(cache);
        const coolingDown = prior && time - prior.updatedAt < 5 * 60000;
        const monthly = tx.collection('collage_ocr_usage').doc(`month-${month}`);
        const daily = tx.collection('collage_ocr_usage').doc(`day-${day}-${owner}`);
        // Finish transaction reads before attaching source references or writing counters.
        const monthlyData = prior?.state === 'done' || coolingDown ? null : await readDocument(monthly);
        const dailyData = prior?.state === 'done' || coolingDown ? null : await readDocument(daily);
        const sourceKeys = [...new Set([...(prior?.sourceKeys || []), ...(sourceKey ? [sourceKey] : [])])];
        if (sourceRef) checked(await sourceRef.update({ cacheKey: key }));
        if (prior && sourceKey) checked(await cache.update({ sourceKeys }));
        if (prior?.state === 'done') return { cached: prior.data };
        if (coolingDown) return { message: prior.state === 'failed' ? prior.message : '图片正在识别，请稍后重试' };
        if ((monthlyData?.count || 0) >= limit) return { message: '本月文字识别次数已用完，仍可使用手动框选' };
        if ((dailyData?.count || 0) >= dailyLimit) return { message: '今天的文字识别次数已用完，明天再试；仍可使用手动框选' };
        checked(await monthly.set({ count: (monthlyData?.count || 0) + 1, updatedAt: time }));
        checked(await daily.set({ count: (dailyData?.count || 0) + 1, updatedAt: time }));
        checked(await cache.set({ state: 'pending', owner, sourceKeys, operationToken, updatedAt: time }));
        return {};
      });
    },
    async complete(key, value, operationToken) {
      return db.runTransaction(async tx => {
        const ref = tx.collection('collage_ocr_cache').doc(key), current = await readDocument(ref);
        // Deletion or a newer request must not be undone by a late OCR response.
        if (!current || current.operationToken !== operationToken) return false;
        checked(await ref.update(value)); return true;
      });
    }
  };
}

module.exports = { createStore };
