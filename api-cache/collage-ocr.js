import { cloudCall } from '@/utils/cloudCall.js';
import { uploadFile } from '@/utils/uploader.js';
import { readFileAsBase64 } from '@/utils/fileReader.js';
import { createCollageLogger } from '@/utils/collage/debug.js';

const log = typeof createCollageLogger === 'function' ? createCollageLogger('ocr') : null;
const now = () => Date.now();

async function call(action, payload, context) {
  log?.debug?.(`调用云函数 ${action}`);
  const started = now();
  const response = await cloudCall('collageOcr', { action, ...payload }, {
    context, pageTag: 'collage-ocr', requireAuth: true, timeoutMs: 60000, retry: 0, silent: true
  }).catch(error => {
    log?.error?.(`云函数请求异常 ${action}`, { elapsed: now() - started, error });
    throw error;
  });
  const result = response?.result || response;
  if (!result?.success) {
    log?.warn?.(`云函数返回失败 ${action}`, { elapsed: now() - started, message: result?.message, code: result?.code, requestId: result?.requestId });
    throw new Error(result?.message || '文字识别暂时不可用，请使用手动框选');
  }
  log?.debug?.(`云函数完成 ${action}`, { elapsed: now() - started, cached: !!result.cached });
  return result;
}

export async function recognizeCollageSource(source, path, context) {
  const started = now();
  log?.info?.('开始识别', { sourceId: source.id, size: `${source.width}x${source.height}`, path });
  const status = await call('status', {}, context);
  if (!status.enabled) {
    log?.warn?.('OCR 未启用', { message: status.message });
    throw new Error(status.message || '文字识别尚未就绪，可先使用手动框选');
  }
  // Validate before uploading; base64 is not sent through a logged cloudCall payload.
  const base64 = await readFileAsBase64(path);
  log?.debug?.('读取待识别图片', { chars: base64.length, mb: (base64.length / 1024 / 1024).toFixed(2) });
  if (base64.length > 7 * 1024 * 1024) throw new Error('图片过大，请先裁小图片再识别');
  const prepared = await prepareSource(source, status, context);
  const fileID = await uploadFile(`${prepared.uploadPrefix}${source.id}.jpg`, path, { context, requireAuth: true, pageTag: 'collage-ocr', maxRetries: 0 });
  if (fileID !== prepared.fileID) {
    log?.error?.('图片上传位置不匹配', { expected: prepared.fileID, actual: fileID });
    throw new Error('图片上传位置不匹配，请重试');
  }
  const result = await call('recognize', { sourceId: source.id, token: prepared.token, fileID, width: source.width, height: source.height }, context);
  log?.info?.('识别完成', { sourceId: source.id, lines: result.data?.lines?.length || 0, chars: (result.data?.lines || []).reduce((total, line) => total + (line.chars?.length || 0), 0), elapsed: now() - started });
  return result.data;
}

async function prepareSource(source, status, context, cleanupOnly = false) {
  if (source.cloudRef?.uploadPrefix && source.cloudRef.uploadPrefix !== status.uploadPrefix) {
    log?.error?.('云端归属不一致', { sourceId: source.id, saved: source.cloudRef.uploadPrefix, current: status.uploadPrefix });
    throw new Error('请使用识别这张原图时的账号清理云端数据');
  }
  // Persist intent BEFORE the server request/upload. Deletion can recover by ID
  // even if an upload succeeds but its response never reaches the client.
  source.cloudRef = { ...source.cloudRef, uploadPrefix: status.uploadPrefix, cleanupOnly };
  if (!context.persist()) throw new Error('无法保存原图记录，请先检查本机存储空间');
  const prepared = await call('prepare', { sourceId: source.id, uploadPrefix: status.uploadPrefix, cleanupOnly }, context);
  source.cloudRef = { ...source.cloudRef, fileID: prepared.fileID, token: prepared.token };
  if (!context.persist()) throw new Error('无法保存上传记录，已停止上传，请重试');
  log?.debug?.('云端上传已登记', { sourceId: source.id, fileID: prepared.fileID, cleanupOnly });
  return prepared;
}

export async function deleteCollageSource(source, path, context) {
  log?.info?.('删除原图云端数据', { sourceId: source.id, regions: (source.ocrRegions || []).length });
  for (const region of source.ocrRegions || []) await deleteSingleSource(region, '', context);
  await deleteSingleSource(source, path, context);
  log?.info?.('原图云端数据已清理', { sourceId: source.id });
}

async function deleteSingleSource(source, path, context) {
  if (!source.cloudRef && source.ocr?.provider !== 'tencent') return;
  if ((!source.cloudRef && source.ocr?.provider === 'tencent') || source.cloudRef?.cleanupOnly) {
    // Old originals predate the source index. Recover their content hash with a
    // temporary upload only; this does not call the paid recognition API.
    if (!path) throw new Error('这张旧原图的本机文件已丢失，暂时无法定位其云端识别缓存');
    log?.debug?.('旧原图缺少云端索引，临时上传定位缓存', { sourceId: source.id });
    const status = await call('status', {}, context);
    const prepared = await prepareSource(source, status, context, true);
    const fileID = await uploadFile(`${prepared.uploadPrefix}${source.id}.jpg`, path, { context, requireAuth: true, pageTag: 'collage-ocr-cleanup', maxRetries: 0 });
    if (fileID !== prepared.fileID) throw new Error('云端清理未完成，请重试删除');
  }
  await call('delete', { sourceId: source.id, uploadPrefix: source.cloudRef.uploadPrefix }, context);
}
