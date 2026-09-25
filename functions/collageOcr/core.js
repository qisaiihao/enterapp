const crypto = require('crypto');
const hash = value => crypto.createHash('sha256').update(value).digest('hex');

function polygon(value) {
  if (!Array.isArray(value) || value.length !== 4) return null;
  const points = value.map(p => ({ x: p.X, y: p.Y }));
  return points.every(p => Number.isFinite(p.x) && Number.isFinite(p.y)) ? points : null;
}

// Stable provider-independent response; no guessed/equal-width character positions.
function normalizeTencent(response) {
  const lines = (response.TextDetections || []).map((line, index) => {
    const words = Array.isArray(line.Words) ? line.Words : [];
    const coords = Array.isArray(line.WordCoordPoint) ? line.WordCoordPoint : [];
    const text = line.DetectedText || '';
    const aligned = words.map(word => word.Character).join('') === text && coords.length === words.length;
    return {
      id: `line-${index}`, text, confidence: line.Confidence,
      polygon: polygon(line.Polygon),
      chars: aligned ? words.map((word, i) => ({ text: word.Character, polygon: polygon(coords[i]?.WordCoordinate), confidence: word.Confidence })) : []
    };
  }).filter(line => line.text);
  return { provider: 'tencent', model: 'GeneralAccurateOCR', schemaVersion: 1, lines };
}

function publicError(error) {
  const code = String(error.code || '');
  if (code.includes('ResourceUnavailable') || code.includes('ResourcesSoldOut') || code.includes('Arrears') || code.includes('UnOpenError')) return '文字识别额度尚未就绪或已用完，请稍后再试；手动框选仍可使用';
  if (code.includes('AuthFailure') || code.includes('Unauthorized')) return '文字识别服务配置尚未完成，请先使用手动框选';
  if (code.includes('LimitExceeded') || code.includes('RequestLimit')) return '识别请求较多，请稍后再试';
  if (code.includes('Image') || code.includes('InvalidParameter')) return '这张图片暂时无法识别，请换一张清晰的图片或手动框选';
  return '文字识别暂时失败，请稍后重试或使用手动框选';
}

function createService({ store, recognize, download, cleanup, fileForPath, dimensions, enabled, limit = 1000, dailyLimit = 20, now = () => Date.now() }) {
  return async function handle(event, identity) {
    if (!identity) return { success: false, code: 'AUTH_REQUIRED', message: '请重新登录后再识别图片' };
    const owner = hash(identity).slice(0, 32);
    const prefix = `collage-ocr/${owner}/`;
    if (event.action === 'status') return { success: true, enabled, uploadPrefix: prefix, message: enabled ? '' : '文字识别尚未就绪，可先使用手动框选' };
    const sourceId = event.sourceId;
    if (typeof sourceId !== 'string' || !/^[a-zA-Z0-9-]{1,80}$/.test(sourceId)) return { success: false, message: '原图标识无效，请重新导入' };
    const sourceKey = `source-${hash(`${owner}:${sourceId}`)}`;
    if (event.uploadPrefix && event.uploadPrefix !== prefix) return { success: false, message: '请使用识别这张原图时的账号清理云端数据' };
    if (event.action === 'prepare') {
      if (!enabled && !event.cleanupOnly) return { success: false, message: '文字识别尚未就绪，可先使用手动框选' };
      const fileID = await fileForPath(`${prefix}${sourceId}.jpg`);
      const source = await store.prepareSource({ sourceKey, owner, fileID, token: crypto.randomBytes(16).toString('hex'), cleanupOnly: !!event.cleanupOnly, time: now() });
      return { success: true, fileID: source.fileID, token: source.token, uploadPrefix: prefix };
    }
    if (event.action === 'delete') {
      try {
        const source = await store.getSource(sourceKey, owner);
        // Legacy clients did not save a source-to-cache link. A one-time upload
        // of their local original recovers its content key without calling OCR.
        if (source?.cleanupOnly && !source.legacyCacheKey) {
          const buffer = await download(source.fileID);
          if (!Buffer.isBuffer(buffer) || buffer.length > 5 * 1024 * 1024) throw new Error('INVALID_IMAGE');
          await store.rememberLegacyKey(sourceKey, owner, hash(`${owner}:${hash(buffer)}:tencent-accurate-v1`));
        }
        const fileID = source?.fileID || await fileForPath(`${prefix}${sourceId}.jpg`);
        await cleanup(fileID); // A partial SDK deletion result must count as failure.
        await store.removeSource(sourceKey, owner);
        return { success: true };
      } catch (_) {
        return { success: false, message: '云端清理未完成，原图已保留，请检查网络后重试删除' };
      }
    }
    if (event.action !== 'recognize') return { success: false, message: '不支持的操作' };
    if (typeof event.fileID !== 'string' || !new RegExp(`^cloud://[^/]+/${prefix}[a-zA-Z0-9-]+\\.jpg$`).test(event.fileID)) return { success: false, message: '图片来源无效，请重新导入' };
    const source = await store.getSource(sourceKey, owner);
    if (!source || source.cleanupOnly || source.token !== event.token || source.fileID !== event.fileID) return { success: false, message: '原图已删除或上传已失效，请重新导入' };
    try {
      if (!enabled) return { success: false, message: '文字识别尚未就绪，可先使用手动框选' };
      const buffer = await download(event.fileID);
      if (!Buffer.isBuffer(buffer) || buffer.length > 5 * 1024 * 1024) return { success: false, message: '图片过大，请先裁小再识别' };
      const size = dimensions(buffer);
      if (size.width !== event.width || size.height !== event.height || Math.max(size.width, size.height) > 2560 || Math.min(size.width, size.height) < 15) return { success: false, message: '图片尺寸不匹配，请重新导入图片' };
      const key = hash(`${owner}:${hash(buffer)}:tencent-accurate-v1`);
      const time = now();
      const chinaDate = new Date(time + 8 * 3600000).toISOString().slice(0, 10);
      const operationToken = crypto.randomBytes(16).toString('hex');
      const reservation = await store.reserve({ key, owner, sourceKey, sourceToken: event.token, operationToken, month: chinaDate.slice(0, 7), day: chinaDate, time, limit, dailyLimit });
      if (reservation.cached) return { success: true, cached: true, data: reservation.cached };
      if (reservation.message) return { success: false, message: reservation.message };
      try {
        const result = await recognize(buffer.toString('base64'));
        const data = { ...normalizeTencent(result), width: size.width, height: size.height };
        if (!await store.complete(key, { state: 'done', data, updatedAt: now() }, operationToken)) return { success: false, message: '原图已删除或识别请求已失效' };
        return { success: true, cached: false, data };
      } catch (error) {
        const message = publicError(error);
        await store.complete(key, { state: 'failed', message, updatedAt: now() }, operationToken);
        return { success: false, message };
      }
    } finally {
      // Only a validated file in this caller's temporary namespace can be deleted.
      await cleanup(event.fileID).catch(() => {});
    }
  };
}

module.exports = { createService, normalizeTencent, publicError, hash };
