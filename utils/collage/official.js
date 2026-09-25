import { createCollageLogger } from './debug.js';
import { persistFile, resolveFile } from './storage.js';
import { imageInfo, displaySize } from './renderer.js';

const log = createCollageLogger('official');

function downloadToTempFile(url) {
  return new Promise((resolve, reject) => {
    uni.downloadFile({
      url,
      success: res => {
        if (res.statusCode === 200 && res.tempFilePath) resolve(res.tempFilePath);
        else reject(new Error(`素材下载失败（${res.statusCode || '网络异常'}）`));
      },
      fail: error => {
        log.warn('下载官方素材失败', { url, error });
        reject(new Error('素材下载失败，请检查网络后重试'));
      }
    });
  });
}

// 官方素材保存到本机后再使用：导出不依赖临时链接，H5 也不会污染 Canvas。
// 尺寸以本机文件为准，避免上传时记录的宽高与实际显示方向不一致。
export async function importOfficialImage(material = {}) {
  const url = typeof material.url === 'string' ? material.url : '';
  if (!url) throw new Error('素材地址无效，请刷新后重试');

  let ref;
  let path;
  // #ifdef H5
  try {
    ref = await persistFile(url);
  } catch (error) {
    log.error('保存官方素材失败', { id: material.id, error });
    throw new Error('素材下载失败，请检查网络或跨域配置后重试');
  }
  path = await resolveFile(ref);
  // #endif
  // #ifndef H5
  const tempPath = await downloadToTempFile(url);
  ref = await persistFile(tempPath);
  path = await resolveFile(ref);
  // #endif

  const size = displaySize(await imageInfo(path));
  log.info('官方素材已保存到本机', { id: material.id, name: material.name, width: size.width, height: size.height });
  return { ref, path, width: size.width, height: size.height };
}

const officialMaterials = { importOfficialImage };

export default officialMaterials;
