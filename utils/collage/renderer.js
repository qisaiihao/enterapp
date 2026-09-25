import { edgePath, fitSize, orientedSize, BOARD } from './geometry.js';
import { createTornPaper } from './tornPaper.js';
import { createCollageLogger } from './debug.js';

const log = createCollageLogger('canvas');
const now = () => Date.now();

export function imageInfo(src) {
  return new Promise((resolve, reject) => uni.getImageInfo({
    src,
    success: res => { log.debug('图片信息', { src, width: res.width, height: res.height, orientation: res.orientation, type: res.type }); resolve(res); },
    fail: error => { log.error('读取图片信息失败', { src, error }); reject(new Error('图片无法读取，请选择 JPG 或 PNG 图片')); }
  }));
}

export async function renderCanvas(page, width, height, painter, fileType = 'png', pixelEffect = null) {
  // #ifdef H5
  // Decode all bitmaps before drawing. The legacy uni H5 canvas can acknowledge a
  // draw before an asynchronously loaded image has actually reached the surface.
  const started = now();
  const commands = [];
  painter(new Proxy({}, { get: (_, method) => (...args) => commands.push({ method, args }) }));
  const bitmaps = new Map();
  for (const command of commands) {
    if (command.method !== 'drawImage' || bitmaps.has(command.args[0])) continue;
    const bitmap = new Image();
    await new Promise((resolve, reject) => {
      bitmap.onload = resolve;
      bitmap.onerror = () => reject(new Error('图片加载失败，请重新导入'));
      bitmap.src = command.args[0];
    });
    bitmaps.set(command.args[0], bitmap);
  }
  const surface = document.createElement('canvas');
  surface.width = width; surface.height = height;
  const native = surface.getContext('2d');
  for (const { method, args } of commands) {
    if (method === 'setFillStyle') native.fillStyle = args[0];
    else if (method === 'drawImage') native.drawImage(bitmaps.get(args[0]), ...args.slice(1));
    else native[method](...args);
  }
  if (pixelEffect) {
    for (const region of pixelEffect.regions) {
      const pixels = native.getImageData(region.x, region.y, region.width, region.height);
      pixelEffect.apply(pixels.data, region);
      native.putImageData(pixels, region.x, region.y);
    }
  }
  log.debug('导出图片', { width, height, fileType, elapsed: now() - started });
  return surface.toDataURL(fileType === 'jpg' ? 'image/jpeg' : 'image/png', 0.92);
  // #endif
  // #ifndef H5
  page.renderWidth = width;
  page.renderHeight = height;
  await page.$nextTick();
  await new Promise(resolve => setTimeout(resolve, 32));
  const started = now();
  const ctx = uni.createCanvasContext('collage-render', page);
  log.debug('开始绘制', { width, height, fileType, tornEdge: !!pixelEffect });
  ctx.clearRect(0, 0, width, height);
  painter(ctx);
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      log.error('图片绘制超时', { width, height, elapsed: now() - started });
      reject(new Error('图片绘制超时，请重试'));
    }, 15000);
    ctx.draw(false, () => { clearTimeout(timer); log.debug('绘制完成', { width, height, elapsed: now() - started }); resolve(); });
  });
  if (pixelEffect) {
    try {
      for (const [index, region] of pixelEffect.regions.entries()) {
        log.debug('处理撕边像素', { region: index + 1, total: pixelEffect.regions.length, rect: region });
        const pixels = await canvasPixels('canvasGetImageData', region, page);
        pixelEffect.apply(pixels.data, region);
        await canvasPixels('canvasPutImageData', { ...region, data: pixels.data }, page);
      }
    } catch (error) {
      error.pixelEffect = true;
      throw error;
    }
  }
  return new Promise((resolve, reject) => uni.canvasToTempFilePath({
    canvasId: 'collage-render', x: 0, y: 0, width, height, destWidth: width, destHeight: height,
    fileType, quality: 0.92,
    success: res => { log.debug('导出图片', { fileType, path: res.tempFilePath, elapsed: now() - started }); resolve(res.tempFilePath); },
    fail: error => { log.error('图片导出失败', { width, height, fileType, error }); reject(new Error('图片导出失败，请重试')); }
  }, page));
  // #endif
}

function canvasPixels(method, options, page) {
  const rect = { x: options.x, y: options.y, width: options.width, height: options.height };
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      log.error(`${method} 超时`, { rect });
      reject(new Error('撕边处理超时，请重试'));
    }, 15000);
    uni[method]({ canvasId: 'collage-render', ...options,
      success: result => { clearTimeout(timer); resolve(result); },
      fail: error => {
        clearTimeout(timer);
        const reason = error && error.errMsg ? error.errMsg : '';
        log.error(`${method} 失败`, { rect, reason, error });
        reject(new Error(reason ? `撕边处理失败（${reason}），请重试` : '撕边处理失败，请重试'));
      }
    }, page);
  });
}

export function displaySize(info) {
  // #ifdef MP-WEIXIN
  // wx.getImageInfo reports the unrotated pixel size, while drawImage applies the EXIF orientation.
  return orientedSize(info.width, info.height, info.orientation);
  // #endif
  // #ifndef MP-WEIXIN
  return { width: info.width, height: info.height };
  // #endif
}

export async function normalizeImage(page, path) {
  const info = await imageInfo(path);
  const display = displaySize(info);
  const size = fitSize(display.width, display.height);
  log.info('生成工作图', { from: `${info.width}x${info.height}`, orientation: info.orientation || 'up', to: `${size.width}x${size.height}` });
  const result = await renderCanvas(page, size.width, size.height, ctx => {
    ctx.setFillStyle('#ffffff');
    ctx.fillRect(0, 0, size.width, size.height);
    ctx.drawImage(info.path || path, 0, 0, size.width, size.height);
  }, 'jpg');
  return { ...size, path: result };
}

export async function rotateImage(page, path) {
  const info = await imageInfo(path);
  const result = await renderCanvas(page, info.height, info.width, ctx => {
    ctx.translate(info.height, 0);
    ctx.rotate(Math.PI / 2);
    ctx.drawImage(info.path || path, 0, 0, info.width, info.height);
  }, 'jpg');
  log.info('顺时针旋转工作图', { from: `${info.width}x${info.height}`, to: `${info.height}x${info.width}` });
  return { width: info.height, height: info.width, path: result };
}

export async function renderOcrRegion(page, path, rect) {
  const info = await imageInfo(path);
  log.debug('裁切识别区域', { rect });
  return renderCanvas(page, rect.width, rect.height, ctx => {
    ctx.drawImage(info.path || path, rect.x, rect.y, rect.width, rect.height, 0, 0, rect.width, rect.height);
  }, 'jpg');
}

export async function renderCut(page, path, rect, style, seed, edgeVersion = 2) {
  const size = fitSize(rect.width, rect.height, 1600);
  const info = await imageInfo(path);
  log.debug('生成纸片', { rect, output: `${size.width}x${size.height}`, style, seed, edgeVersion });
  if (style === 'torn' && edgeVersion >= 2) log.debug('应用撕纸像素效果', { seed });
  const paper = style === 'torn' && edgeVersion >= 2 ? createTornPaper(size.width, size.height, seed) : null;
  const paint = async pixelEffect => {
    const result = await renderCanvas(page, size.width, size.height, ctx => {
      const points = edgePath(size.width, size.height, pixelEffect ? 'straight' : style, seed);
      ctx.save();
      ctx.beginPath();
      points.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
      ctx.closePath();
      ctx.clip();
      ctx.drawImage(info.path || path, rect.x, rect.y, rect.width, rect.height, 0, 0, size.width, size.height);
      ctx.restore();
    }, 'png', pixelEffect);
    return { ...size, path: result };
  };
  if (!paper) return paint(null);
  try {
    return await paint(paper);
  } catch (error) {
    if (!error.pixelEffect) throw error;
    // 微信开发者工具不支持 canvasPutImageData，真机才执行像素撕边。
    log.warn('撕纸像素处理不可用，改用轮廓撕边', { error: error.message });
    return paint(null);
  }
}

export async function renderBoard(page, workspace, urls) {
  const paths = {};
  const background = workspace.backgroundImage || null;
  log.info('渲染画布', { items: workspace.items.length, background: workspace.background, hasBackgroundImage: !!background });
  let backgroundPath = '';
  if (background) {
    const source = urls[background.id];
    if (!source) {
      log.error('画布背景缺失', { backgroundId: background.id });
      throw new Error('画布背景图已丢失，请重新设置');
    }
    backgroundPath = (await imageInfo(source)).path || source;
  }
  for (const item of workspace.items) {
    const source = urls[item.materialId];
    if (!source) {
      log.error('画布素材缺失', { itemId: item.id, materialId: item.materialId });
      throw new Error('部分素材已丢失，请移除后再导出');
    }
    if (!paths[item.materialId]) paths[item.materialId] = (await imageInfo(source)).path || source;
  }
  return renderCanvas(page, BOARD.width, BOARD.height, ctx => {
    ctx.setFillStyle(workspace.background);
    ctx.fillRect(0, 0, BOARD.width, BOARD.height);
    if (backgroundPath) {
      // 背景图按画布等比铺满，多余部分居中裁掉。
      const scale = Math.max(BOARD.width / background.width, BOARD.height / background.height);
      const width = background.width * scale, height = background.height * scale;
      ctx.drawImage(backgroundPath, (BOARD.width - width) / 2, (BOARD.height - height) / 2, width, height);
    }
    workspace.items.forEach(item => {
      ctx.save();
      ctx.translate(item.x, item.y);
      ctx.rotate(item.rotation * Math.PI / 180);
      ctx.drawImage(paths[item.materialId], -item.width / 2, -item.height / 2, item.width, item.height);
      ctx.restore();
    });
  });
}
